package com.cricketlegend.service.impl;

import com.cricketlegend.domain.ImportOutcome;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.ScheduleFindingDto;
import com.cricketlegend.exception.ScheduleRuleException;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.MatchScheduleRules;
import com.cricketlegend.service.support.MatchSideNames;
import com.cricketlegend.service.support.ServerClock;
import com.cricketlegend.service.support.schedule.ExistingMatch;
import com.cricketlegend.service.support.schedule.LeagueScheduleIdentity;
import com.cricketlegend.service.support.schedule.LeagueScheduleIdentity.Evaluation;
import com.cricketlegend.service.support.schedule.MatchScheduleWorld;
import com.cricketlegend.service.support.schedule.ResolvedSide;
import com.cricketlegend.service.support.schedule.ScheduleConstants;
import com.cricketlegend.service.support.schedule.ScheduleFixture;
import com.cricketlegend.service.support.schedule.ScheduleOverlapRules;
import com.cricketlegend.service.support.schedule.ScheduleOverlapRules.Finding;
import com.cricketlegend.service.support.schedule.ScheduleOverlapRules.Item;
import com.cricketlegend.service.support.schedule.ScheduleRule;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/132-match-scheduling-rules.md. Reads the club's active matches once in the window the rules look at
 * (the identity rules look {@link ScheduleConstants#DEFAULT_WINDOW_DAYS} days either way), maps each to the
 * {@link ExistingMatch} the import's pure rules use, and renders their findings in the manual routes' wording. The
 * time zone is the server's, as everywhere outside the import (no per-club zone yet).
 */
@Service
public class MatchScheduleRulesImpl implements MatchScheduleRules {

    private static final int WINDOW_PAD_DAYS = ScheduleConstants.DEFAULT_WINDOW_DAYS + 1;

    private final MatchRepository matchRepository;
    private final TeamRepository teamRepository;

    public MatchScheduleRulesImpl(MatchRepository matchRepository, TeamRepository teamRepository) {
        this.matchRepository = matchRepository;
        this.teamRepository = teamRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ScheduleFindingDto> check(UUID clubId, Candidate candidate, UUID excludeMatchId) {
        return check(clubId, candidate, excludeMatchId, true);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ScheduleFindingDto> check(UUID clubId, Candidate candidate, UUID excludeMatchId, boolean checkPastDate) {
        ZoneId zone = ZoneId.systemDefault();
        MatchScheduleWorld world = load(clubId, List.of(candidate), excludeMatchId, zone);
        List<ScheduleFindingDto> out = new ArrayList<>(evaluate(candidate, world, zone));
        if (checkPastDate) {
            addPastDate(candidate, out);
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public List<List<ScheduleFindingDto>> checkBatch(UUID clubId, List<Candidate> candidates) {
        if (candidates.isEmpty()) {
            return List.of();
        }
        ZoneId zone = ZoneId.systemDefault();
        MatchScheduleWorld world = load(clubId, candidates, null, zone);
        List<List<ScheduleFindingDto>> out = new ArrayList<>(candidates.size());
        for (Candidate c : candidates) {
            List<ScheduleFindingDto> found = new ArrayList<>(evaluate(c, world, zone));
            addPastDate(c, found);
            out.add(found);
            UUID id = UUID.randomUUID();
            world.virtual.add(id);
            world.matches.add(new ExistingMatch(id, c.leagueId(), c.seasonId(), c.start(), c.venue(),
                    side(c.homeTeamId(), c.homeLeagueTeamId(), nameOf(c.homeTeamId(), c.homeName(), world)),
                    side(c.awayTeamId(), c.awayLeagueTeamId(), nameOf(c.awayTeamId(), c.awayName(), world)),
                    true, Set.of()));
        }
        return out;
    }

    @Override
    public void enforce(List<ScheduleFindingDto> findings, Collection<String> acknowledged) {
        if (findings.isEmpty()) {
            return;
        }
        Set<String> ack = acknowledged == null ? Set.of() : new HashSet<>(acknowledged);
        boolean blocked = findings.stream().anyMatch(ScheduleFindingDto::isError)
                || findings.stream().anyMatch(f -> !ack.contains(f.code()));
        if (blocked) {
            throw new ScheduleRuleException(findings);
        }
    }

    /** PAST_DATE (docs/specs/132): the start is before the start of today on the server clock. A warning, after the errors. */
    private static void addPastDate(Candidate c, List<ScheduleFindingDto> out) {
        if (c.start().isBefore(ServerClock.startOfToday())) {
            out.add(new ScheduleFindingDto(ScheduleRule.PAST_DATE.name(), ScheduleFindingDto.WARNING,
                    "This match is dated in the past.", "date", null));
        }
    }

    // ---- reading ---------------------------------------------------------------------------------------------------

    private MatchScheduleWorld load(UUID clubId, List<Candidate> candidates, UUID excludeMatchId, ZoneId zone) {
        LocalDate min = null;
        LocalDate max = null;
        for (Candidate c : candidates) {
            LocalDate d = c.start().atZone(zone).toLocalDate();
            min = min == null || d.isBefore(min) ? d : min;
            max = max == null || d.isAfter(max) ? d : max;
        }
        Instant from = min.minusDays(WINDOW_PAD_DAYS).atStartOfDay(zone).toInstant();
        Instant to = max.plusDays(WINDOW_PAD_DAYS + 1L).atStartOfDay(zone).toInstant();
        List<Match> matches = matchRepository.findActiveInWindow(clubId, from, to).stream()
                .filter(m -> !m.getId().equals(excludeMatchId)).toList();
        MatchScheduleWorld world = new MatchScheduleWorld();
        Set<UUID> teamIds = new HashSet<>();
        for (Match m : matches) {
            addIfSet(teamIds, m.getHomeTeamId());
            addIfSet(teamIds, m.getAwayTeamId());
        }
        for (Candidate c : candidates) {
            addIfSet(teamIds, c.homeTeamId());
            addIfSet(teamIds, c.awayTeamId());
        }
        if (!teamIds.isEmpty()) {
            teamRepository.findAllById(teamIds).forEach(t -> world.teams.put(t.getId(), t));
        }
        for (Match m : matches) {
            world.matches.add(new ExistingMatch(m.getId(), m.getLeagueId(), m.getSeasonId(), m.getMatchDate(),
                    m.getVenue(),
                    side(m.getHomeTeamId(), m.getHomeLeagueTeamId(), MatchSideNames.home(m, world.teams)),
                    side(m.getAwayTeamId(), m.getAwayLeagueTeamId(), MatchSideNames.away(m, world.teams)),
                    m.isActive(), Set.of()));
        }
        return world;
    }

    private static void addIfSet(Set<UUID> ids, UUID id) {
        if (id != null) {
            ids.add(id);
        }
    }

    private static ExistingMatch.Side side(UUID teamId, UUID leagueTeamId, String name) {
        return new ExistingMatch.Side(teamId, leagueTeamId, name);
    }

    private static String nameOf(UUID teamId, String name, MatchScheduleWorld world) {
        if (name != null) {
            return name;
        }
        Team team = teamId == null ? null : world.teams.get(teamId);
        return team == null ? "" : team.getName();
    }

    // ---- rules -----------------------------------------------------------------------------------------------------

    private List<ScheduleFindingDto> evaluate(Candidate c, MatchScheduleWorld world, ZoneId zone) {
        String homeName = nameOf(c.homeTeamId(), c.homeName(), world);
        String awayName = nameOf(c.awayTeamId(), c.awayName(), world);
        LocalDate date = c.start().atZone(zone).toLocalDate();
        LocalTime time = c.start().atZone(zone).toLocalTime().truncatedTo(ChronoUnit.MINUTES);
        List<ExistingMatch> active = world.matches.stream().filter(ExistingMatch::active).toList();
        Map<UUID, ExistingMatch> byId = new HashMap<>();
        active.forEach(m -> byId.put(m.id(), m));

        List<ScheduleFindingDto> out = new ArrayList<>();
        UUID duplicateOf = identity(c, homeName, awayName, date, time, active, world, zone, out);

        Set<String> own = new java.util.LinkedHashSet<>();
        if (c.homeTeamId() != null) {
            own.add("T:" + c.homeTeamId());
        }
        if (c.awayTeamId() != null) {
            own.add("T:" + c.awayTeamId());
        }
        Item subject = new Item(0, null, c.start(), date, LeagueScheduleIdentity.normaliseVenue(c.venue()), c.venue(), own);
        List<Item> items = new ArrayList<>();
        items.add(subject);
        for (ExistingMatch m : active) {
            LocalDate d = m.start().atZone(zone).toLocalDate();
            if (!d.equals(date)) {
                continue;
            }
            Set<String> keys = new java.util.LinkedHashSet<>();
            if (m.home().teamId() != null) {
                keys.add("T:" + m.home().teamId());
            }
            if (m.away().teamId() != null) {
                keys.add("T:" + m.away().teamId());
            }
            items.add(new Item(null, m.id(), m.start(), d, LeagueScheduleIdentity.normaliseVenue(m.venue()), m.venue(), keys));
        }
        for (Finding f : ScheduleOverlapRules.ownTeam(items)) {
            Item other = f.others().get(0);
            if (duplicateOf != null && duplicateOf.equals(other.matchId())) {
                continue; // the exact repeat is reported once, as DUPLICATE_MATCH
            }
            String team = f.ownKey().equals("T:" + c.homeTeamId()) ? homeName : awayName;
            ExistingMatch m = byId.get(other.matchId());
            String opponent = m == null ? "another team" : opponentOf(m, f.ownKey());
            String when = LeagueScheduleIdentity.formatTime(localTime(other, zone)) + " on "
                    + LeagueScheduleIdentity.formatDate(date);
            if (f.rule() == ScheduleRule.OWN_TEAM_OVERLAP) {
                out.add(finding(f.rule(), ScheduleFindingDto.ERROR, f.field(),
                        team + " already plays " + opponent + " at " + when + ", less than "
                                + ScheduleConstants.OWN_TEAM_MIN_GAP_MINUTES / 60 + " hours from "
                                + LeagueScheduleIdentity.formatTime(time) + ".",
                        other, world));
            } else {
                out.add(finding(f.rule(), ScheduleFindingDto.WARNING, f.field(),
                        team + " also plays " + opponent + " at " + when + ".", other, world));
            }
        }
        for (Finding f : ScheduleOverlapRules.venue(items)) {
            List<String> times = f.others().stream().limit(3)
                    .map(o -> LeagueScheduleIdentity.formatTime(localTime(o, zone))).toList();
            out.add(finding(f.rule(), ScheduleFindingDto.WARNING, f.field(),
                    c.venue().trim() + " is also used on " + LeagueScheduleIdentity.formatDate(date) + " at "
                            + String.join(", ", times) + ", less than " + ScheduleConstants.VENUE_MIN_GAP_MINUTES / 60
                            + " hours from " + LeagueScheduleIdentity.formatTime(time) + ".",
                    f.others().get(0), world));
        }
        out.sort(Comparator.comparing((ScheduleFindingDto f) -> !f.isError()));
        return out;
    }

    /** The identity rules; returns the id of an exact repeat (DUPLICATE_MATCH), else null. */
    private UUID identity(Candidate c, String homeName, String awayName, LocalDate date, LocalTime time,
            List<ExistingMatch> active, MatchScheduleWorld world, ZoneId zone, List<ScheduleFindingDto> out) {
        ScheduleFixture fixture = new ScheduleFixture(0, resolved(c.homeTeamId(), c.homeLeagueTeamId(), homeName),
                resolved(c.awayTeamId(), c.awayLeagueTeamId(), awayName), date, time, c.venue());
        Evaluation e = LeagueScheduleIdentity.evaluate(
                c.leagueId(), c.seasonId(), fixture, active, zone, ScheduleConstants.DEFAULT_WINDOW_DAYS);
        String pair = homeName + " v " + awayName;
        if (e.outcome() == ImportOutcome.DUPLICATE || e.outcome() == ImportOutcome.DIFFERS) {
            ExistingMatch other = e.existing();
            boolean sameSlot = e.differences().stream()
                    .noneMatch(d -> "TIME".equals(d.field()) || "HOME_AWAY".equals(d.field()));
            String at = LeagueScheduleIdentity.formatTime(other.start().atZone(zone).toLocalTime()
                    .truncatedTo(ChronoUnit.MINUTES));
            if (sameSlot) {
                out.add(finding(ScheduleRule.DUPLICATE_MATCH, ScheduleFindingDto.ERROR, "teams",
                        pair + " is already scheduled for " + LeagueScheduleIdentity.formatDate(date) + " at " + at
                                + ".", other, world));
                return other.id();
            }
            out.add(finding(ScheduleRule.DUPLICATE_SAME_DAY, ScheduleFindingDto.WARNING, "teams",
                    other.home().name() + " v " + other.away().name() + " is already scheduled for "
                            + LeagueScheduleIdentity.formatDate(date) + " at " + at + ".", other, world));
        } else if (e.outcome() == ImportOutcome.POSSIBLE_DUPLICATE) {
            e.possibles().forEach(p -> out.add(new ScheduleFindingDto(
                    p.code(), ScheduleFindingDto.WARNING, p.message(), "teams", null)));
        }
        return null;
    }

    private static ResolvedSide resolved(UUID teamId, UUID leagueTeamId, String name) {
        if (teamId != null) {
            return ResolvedSide.ownTeam(teamId, name, true, Set.of());
        }
        if (leagueTeamId != null) {
            return ResolvedSide.leagueTeam(leagueTeamId, name, true, Set.of());
        }
        return ResolvedSide.toCreate(name == null ? "" : name, null);
    }

    private static String opponentOf(ExistingMatch m, String ownKey) {
        boolean homeIsOurs = m.home().teamId() != null && ownKey.equals("T:" + m.home().teamId());
        return homeIsOurs ? m.away().name() : m.home().name();
    }

    private static LocalTime localTime(Item item, ZoneId zone) {
        return item.start().atZone(zone).toLocalTime().truncatedTo(ChronoUnit.MINUTES);
    }

    private static ScheduleFindingDto finding(
            ScheduleRule rule, String severity, String field, String message, Item other, MatchScheduleWorld world) {
        return finding(rule, severity, field, message, other.matchId(), world);
    }

    private static ScheduleFindingDto finding(
            ScheduleRule rule, String severity, String field, String message, ExistingMatch other, MatchScheduleWorld world) {
        return finding(rule, severity, field, message, other.id(), world);
    }

    private static ScheduleFindingDto finding(
            ScheduleRule rule, String severity, String field, String message, UUID otherId, MatchScheduleWorld world) {
        return new ScheduleFindingDto(
                rule.name(), severity, message, field, otherId == null || world.virtual.contains(otherId) ? null : otherId);
    }
}
