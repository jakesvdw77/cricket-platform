package com.cricketlegend.service.support;

import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueFormat;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.SectionAvailabilityMatchResolver;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * The slot rule of docs/specs/076-team-selection.md section 5. A slot is a local calendar date
 * ({@code ZoneId.systemDefault()}, as {@code SectionAvailabilityMatchResolverImpl}) plus Morning or
 * Afternoon (the existing {@link SectionAvailabilityMatchResolver#dayPartOf} rule). A match occupies
 * slots by its league's format: T20, T30, unset or no league its own single slot; T45, T50 and
 * ONE_DAY both slots of its date; THREE_DAY and FIVE_DAY both slots of 3 and 5 consecutive dates.
 * Two matches collide when their occupied slots intersect. A player is <em>taken</em> when he is a
 * selection row (the 12th man included) of a side of another active match of the same club that
 * collides, or of the other side of the same match (a derby).
 */
@Component
public class MatchSlots {

    /** The widest span reaching back from a match's date is a five-day match starting 4 days earlier. */
    private static final int MAX_LOOK_BACK_DAYS = 4;

    private static final DateTimeFormatter SLOT_DATE = DateTimeFormatter.ofPattern("EEE d MMM", Locale.ENGLISH);

    private record Slot(LocalDate date, DayPart part) {
    }

    private final MatchRepository matchRepository;
    private final MatchSideRepository matchSideRepository;
    private final MatchSidePlayerRepository matchSidePlayerRepository;
    private final LeagueRepository leagueRepository;
    private final TeamRepository teamRepository;
    private final SectionAvailabilityMatchResolver matchResolver;

    public MatchSlots(
            MatchRepository matchRepository,
            MatchSideRepository matchSideRepository,
            MatchSidePlayerRepository matchSidePlayerRepository,
            LeagueRepository leagueRepository,
            TeamRepository teamRepository,
            SectionAvailabilityMatchResolver matchResolver) {
        this.matchRepository = matchRepository;
        this.matchSideRepository = matchSideRepository;
        this.matchSidePlayerRepository = matchSidePlayerRepository;
        this.leagueRepository = leagueRepository;
        this.teamRepository = teamRepository;
        this.matchResolver = matchResolver;
    }

    /**
     * For each of {@code playerIds} who is taken for this match's slots by a team other than {@code
     * ownTeamId}'s side of this match, where. A player's own side is never reported against him
     * here; a duplicate that already exists elsewhere is. If several collide the earliest match wins.
     */
    public Map<UUID, TakenBy> taken(Match match, UUID ownTeamId, Collection<UUID> playerIds) {
        if (playerIds.isEmpty()) {
            return Map.of();
        }
        ZoneId zone = ZoneId.systemDefault();
        LocalDate firstDate = match.getMatchDate().atZone(zone).toLocalDate();
        LocalDate lastDate = firstDate.plusDays(spanDays(leagueOf(match)) - 1L);
        Instant from = firstDate.minusDays(MAX_LOOK_BACK_DAYS).atStartOfDay(zone).toInstant();
        Instant to = lastDate.plusDays(1).atStartOfDay(zone).toInstant();

        Map<UUID, Match> windowMatches = matchRepository.findActiveInWindow(match.getClubId(), from, to).stream()
                .collect(Collectors.toMap(Match::getId, m -> m, (a, b) -> a));
        windowMatches.remove(match.getId());
        Map<UUID, League> leagues = leaguesOf(windowMatches.values());
        Set<Slot> mine = occupied(match, leagueOf(match));

        Map<UUID, Match> colliding = new HashMap<>();
        for (Match other : windowMatches.values()) {
            if (intersects(mine, occupied(other, leagues.get(other.getLeagueId())))) {
                colliding.put(other.getId(), other);
            }
        }
        colliding.put(match.getId(), match);

        List<MatchSide> sides = matchSideRepository.findByMatchIdIn(colliding.keySet()).stream()
                .filter(side -> !(side.getMatchId().equals(match.getId()) && side.getTeamId().equals(ownTeamId)))
                .toList();
        if (sides.isEmpty()) {
            return Map.of();
        }
        Map<UUID, MatchSide> sideById = sides.stream().collect(Collectors.toMap(MatchSide::getId, side -> side));
        Set<UUID> wanted = new HashSet<>(playerIds);
        Map<UUID, Team> teams = teamRepository
                .findAllById(sides.stream().map(MatchSide::getTeamId).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(Team::getId, team -> team));

        Map<UUID, TakenBy> result = new HashMap<>();
        for (MatchSidePlayer row : matchSidePlayerRepository.findByMatchSideIdIn(sideById.keySet())) {
            if (!wanted.contains(row.getPlayerProfileId())) {
                continue;
            }
            MatchSide side = sideById.get(row.getMatchSideId());
            Team team = teams.get(side.getTeamId());
            if (team == null) {
                continue;
            }
            TakenBy candidate = takenBy(match, colliding.get(side.getMatchId()), side, team);
            result.merge(row.getPlayerProfileId(), candidate, MatchSlots::earlier);
        }
        return result;
    }

    private TakenBy takenBy(Match thisMatch, Match holder, MatchSide side, Team team) {
        return new TakenBy(
                team.getId(), team.getName(), team.getClubId(), team.getSectionId(),
                holder.getId(), holder.getMatchDate(), slotText(holder.getMatchDate()),
                side.getId(), holder.getId().equals(thisMatch.getId()), side.isAnnounced());
    }

    private static TakenBy earlier(TakenBy a, TakenBy b) {
        return Comparator.comparing(TakenBy::matchDate).thenComparing(TakenBy::matchId).compare(a, b) <= 0 ? a : b;
    }

    /** "Sat 3 Oct (morning)": the local date and day part of a kickoff. */
    public String slotText(Instant matchDate) {
        String date = SLOT_DATE.format(matchDate.atZone(ZoneId.systemDefault()));
        String part = matchResolver.dayPartOf(matchDate) == DayPart.MORNING ? "morning" : "afternoon";
        return date + " (" + part + ")";
    }

    private Set<Slot> occupied(Match match, League league) {
        LocalDate date = match.getMatchDate().atZone(ZoneId.systemDefault()).toLocalDate();
        LeagueFormat format = league == null ? null : league.getFormat();
        Set<Slot> slots = new HashSet<>();
        if (!takesWholeDays(format)) {
            slots.add(new Slot(date, matchResolver.dayPartOf(match.getMatchDate())));
            return slots;
        }
        for (int day = 0; day < spanDays(format); day++) {
            slots.add(new Slot(date.plusDays(day), DayPart.MORNING));
            slots.add(new Slot(date.plusDays(day), DayPart.AFTERNOON));
        }
        return slots;
    }

    private boolean takesWholeDays(LeagueFormat format) {
        return format != null && format != LeagueFormat.T20 && format != LeagueFormat.T30;
    }

    private int spanDays(League league) {
        return spanDays(league == null ? null : league.getFormat());
    }

    private int spanDays(LeagueFormat format) {
        if (format == LeagueFormat.THREE_DAY) {
            return 3;
        }
        return format == LeagueFormat.FIVE_DAY ? 5 : 1;
    }

    private boolean intersects(Set<Slot> a, Set<Slot> b) {
        return a.stream().anyMatch(b::contains);
    }

    private League leagueOf(Match match) {
        if (match.getLeagueId() == null) {
            return null;
        }
        return leagueRepository.findById(match.getLeagueId()).orElse(null);
    }

    private Map<UUID, League> leaguesOf(Collection<Match> matches) {
        Set<UUID> leagueIds = matches.stream()
                .map(Match::getLeagueId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (leagueIds.isEmpty()) {
            return new HashMap<>();
        }
        return leagueRepository.findAllById(leagueIds).stream()
                .collect(Collectors.toMap(League::getId, league -> league));
    }
}
