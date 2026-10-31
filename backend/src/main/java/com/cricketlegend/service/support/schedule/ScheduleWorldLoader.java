package com.cricketlegend.service.support.schedule;

import com.cricketlegend.domain.ImportAlias;
import com.cricketlegend.domain.ImportBatchEntity;
import com.cricketlegend.domain.ImportEntityAction;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueAffiliation;
import com.cricketlegend.domain.LeagueSeason;
import com.cricketlegend.domain.LeagueTeam;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.ImportAliasRepository;
import com.cricketlegend.repository.ImportBatchEntityRepository;
import com.cricketlegend.repository.LeagueAffiliationRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.LeagueSeasonRepository;
import com.cricketlegend.repository.LeagueTeamRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.support.LeagueSeasonAccessValidation;
import com.cricketlegend.service.support.MatchSideNames;
import com.cricketlegend.service.support.NameAliases;
import com.cricketlegend.service.support.schedule.TeamNameMatcher.CandidateSource;
import com.cricketlegend.service.support.schedule.TeamNameMatcher.RememberedAlias;
import com.cricketlegend.service.support.schedule.TeamNameMatcher.TeamCandidate;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Reads what the league schedule import needs from the database, once per preview or re-validation and in a fixed,
 * small number of queries (docs/specs/098, R16): the league, season and the club's teams, the candidate lists of the
 * spec's six sources, remembered aliases, and the existing matches the rules compare against. Read only; no writes.
 */
@Component
public class ScheduleWorldLoader {

    public static final String ALIAS_KIND = "TEAM";
    public static final String ALIAS_OWN_TEAM = "OWN_TEAM";
    public static final String ALIAS_LEAGUE_TEAM = "LEAGUE_TEAM";

    private static final DateTimeFormatter ALIAS_DATE = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.UK);

    private final LeagueRepository leagueRepository;
    private final SeasonRepository seasonRepository;
    private final LeagueSeasonRepository leagueSeasonRepository;
    private final LeagueAffiliationRepository affiliationRepository;
    private final TeamRepository teamRepository;
    private final LeagueTeamRepository leagueTeamRepository;
    private final MatchRepository matchRepository;
    private final ImportAliasRepository aliasRepository;
    private final ImportBatchEntityRepository batchEntityRepository;
    private final ScheduleDeletionBlockers blockers;

    public ScheduleWorldLoader(
            LeagueRepository leagueRepository,
            SeasonRepository seasonRepository,
            LeagueSeasonRepository leagueSeasonRepository,
            LeagueAffiliationRepository affiliationRepository,
            TeamRepository teamRepository,
            LeagueTeamRepository leagueTeamRepository,
            MatchRepository matchRepository,
            ImportAliasRepository aliasRepository,
            ImportBatchEntityRepository batchEntityRepository,
            ScheduleDeletionBlockers blockers) {
        this.leagueRepository = leagueRepository;
        this.seasonRepository = seasonRepository;
        this.leagueSeasonRepository = leagueSeasonRepository;
        this.affiliationRepository = affiliationRepository;
        this.teamRepository = teamRepository;
        this.leagueTeamRepository = leagueTeamRepository;
        this.matchRepository = matchRepository;
        this.aliasRepository = aliasRepository;
        this.batchEntityRepository = batchEntityRepository;
        this.blockers = blockers;
    }

    /** The teams side of the world: the target league and season and every candidate source. */
    public record Teams(
            UUID clubId,
            League league,
            Season season,
            LeagueSeason leagueSeason,
            Map<UUID, Team> ownTeams,
            Set<UUID> affiliated,
            List<LeagueTeam> thisSeason,
            List<LeagueTeam> previous,
            List<LeagueTeam> other,
            Map<UUID, String> seasonLabels,
            Map<UUID, String> leagueNames,
            Set<UUID> createdByImport) {

        public LeagueTeam thisSeasonTeam(UUID id) {
            return thisSeason.stream().filter(t -> t.getId().equals(id)).findFirst().orElse(null);
        }

        /** A league team of an earlier season or another league (a copy source), or null. */
        public LeagueTeam sourceTeam(UUID id) {
            return java.util.stream.Stream.concat(previous.stream(), other.stream())
                    .filter(t -> t.getId().equals(id)).findFirst().orElse(null);
        }
    }

    /** 404 when the league or season is not this club's (the cheap check behind {@code scopeKey}). */
    public void assertScope(UUID clubId, UUID leagueId, UUID seasonId) {
        LeagueSeasonAccessValidation.assertLeagueBelongsToClub(leagueRepository, leagueId, clubId);
        LeagueSeasonAccessValidation.assertSeasonBelongsToClub(seasonRepository, seasonId, clubId);
    }

    /** The club's known venue spellings, sorted, for the template and the AI help. */
    public List<String> venues(UUID clubId) {
        return matchRepository.findDistinctVenuesByClubId(clubId).stream().sorted(String.CASE_INSENSITIVE_ORDER).toList();
    }

    /** The league, season and every candidate source. 404 when the league or season is not this club's. */
    public Teams loadTeams(UUID clubId, UUID leagueId, UUID seasonId) {
        LeagueSeasonAccessValidation.assertLeagueBelongsToClub(leagueRepository, leagueId, clubId);
        LeagueSeasonAccessValidation.assertSeasonBelongsToClub(seasonRepository, seasonId, clubId);
        League league = leagueRepository.findById(leagueId).orElseThrow();
        Season season = seasonRepository.findById(seasonId).orElseThrow();
        LeagueSeason leagueSeason = leagueSeasonRepository.findByLeagueIdAndSeasonId(leagueId, seasonId).orElse(null);

        Map<UUID, Team> ownTeams = new LinkedHashMap<>();
        teamRepository.findByClubId(clubId).forEach(t -> ownTeams.put(t.getId(), t));
        Set<UUID> affiliated = new HashSet<>();
        for (LeagueAffiliation a : affiliationRepository.findByLeagueIdInAndSeasonId(List.of(leagueId), seasonId)) {
            affiliated.add(a.getTeamId());
        }
        Map<UUID, String> seasonLabels = new HashMap<>();
        Map<UUID, LocalDate> seasonStarts = new HashMap<>();
        for (Season s : seasonRepository.findByClubId(clubId)) {
            seasonLabels.put(s.getId(), s.getLabel());
            seasonStarts.put(s.getId(), s.getStartDate());
        }
        Map<UUID, String> leagueNames = new HashMap<>();
        List<UUID> otherLeagueIds = new ArrayList<>();
        for (League l : leagueRepository.findByClubId(clubId)) {
            leagueNames.put(l.getId(), l.getName());
            if (!l.getId().equals(leagueId)) {
                otherLeagueIds.add(l.getId());
            }
        }
        List<LeagueTeam> thisSeason = leagueTeamRepository.findByLeagueAndSeason(leagueId, seasonId);
        Set<String> taken = new HashSet<>();
        thisSeason.forEach(t -> taken.add(key(t.getName())));
        Comparator<LeagueTeam> newestFirst = Comparator.comparing(
                (LeagueTeam t) -> seasonStarts.getOrDefault(t.getSeasonId(), LocalDate.MIN)).reversed();
        List<LeagueTeam> previous = distinctByName(
                leagueTeamRepository.findByLeagueIdAndSeasonIdNot(leagueId, seasonId), taken, newestFirst);
        List<LeagueTeam> other = otherLeagueIds.isEmpty()
                ? List.of()
                : distinctByName(leagueTeamRepository.findByLeagueIdIn(otherLeagueIds), taken, newestFirst);

        Set<UUID> createdByImport = new HashSet<>();
        if (!thisSeason.isEmpty()) {
            for (ImportBatchEntity e : batchEntityRepository.findByEntityTypeAndEntityIdIn(
                    "LEAGUE_TEAM", thisSeason.stream().map(LeagueTeam::getId).toList())) {
                if (e.getAction() == ImportEntityAction.CREATED) {
                    createdByImport.add(e.getEntityId());
                }
            }
        }
        return new Teams(clubId, league, season, leagueSeason, ownTeams, affiliated, thisSeason, previous, other,
                seasonLabels, leagueNames, createdByImport);
    }

    /** Active league teams not already named in this season, one per name (the newest season's wins). */
    private static List<LeagueTeam> distinctByName(
            List<LeagueTeam> teams, Set<String> takenNames, Comparator<LeagueTeam> order) {
        Set<String> seen = new HashSet<>(takenNames);
        List<LeagueTeam> out = new ArrayList<>();
        teams.stream().filter(LeagueTeam::isActive).sorted(order.thenComparing(LeagueTeam::getName)).forEach(t -> {
            if (seen.add(key(t.getName()))) {
                out.add(t);
            }
        });
        return out;
    }

    static String key(String name) {
        return name == null ? "" : name.trim().toLowerCase(Locale.ROOT);
    }

    /** The candidates in the spec's source order; {@code ownOnly} keeps only the club's own teams (identify step). */
    public List<TeamCandidate> candidates(Teams teams, boolean ownOnly) {
        List<TeamCandidate> out = new ArrayList<>();
        List<Team> own = teams.ownTeams().values().stream().filter(Team::isActive)
                .sorted(Comparator.comparing(Team::getName)).toList();
        for (Team t : own) {
            if (teams.affiliated().contains(t.getId())) {
                out.add(ownCandidate(CandidateSource.OWN_AFFILIATED, t));
            }
        }
        if (!ownOnly) {
            for (LeagueTeam t : teams.thisSeason()) {
                out.add(leagueCandidate(CandidateSource.LEAGUE_THIS_SEASON, t, teams));
            }
            for (LeagueTeam t : teams.previous()) {
                out.add(leagueCandidate(CandidateSource.LEAGUE_PREVIOUS_SEASON, t, teams));
            }
            for (LeagueTeam t : teams.other()) {
                out.add(leagueCandidate(CandidateSource.LEAGUE_OTHER, t, teams));
            }
        }
        for (Team t : own) {
            if (!teams.affiliated().contains(t.getId())) {
                out.add(ownCandidate(CandidateSource.OWN_OTHER, t));
            }
        }
        return out;
    }

    private static TeamCandidate ownCandidate(CandidateSource source, Team t) {
        return new TeamCandidate(source, ALIAS_OWN_TEAM, t.getId(), t.getName(), t.getAbbreviation(), null, null,
                true, false);
    }

    private TeamCandidate leagueCandidate(CandidateSource source, LeagueTeam t, Teams teams) {
        return new TeamCandidate(source, ALIAS_LEAGUE_TEAM, t.getId(), t.getName(), t.getAbbreviation(),
                teams.seasonLabels().get(t.getSeasonId()), teams.leagueNames().get(t.getLeagueId()), t.isActive(),
                teams.createdByImport().contains(t.getId()));
    }

    /**
     * The club's remembered aliases for this league, each resolved to a concrete candidate (an alias to a league team
     * name finds that name this season, or else a copy source); an alias whose target no longer exists is dropped.
     */
    public List<RememberedAlias> aliases(Teams teams, boolean ownOnly) {
        List<RememberedAlias> out = new ArrayList<>();
        for (ImportAlias alias : aliasRepository.findByClubIdAndKindAndScopeKeyAndActiveTrue(
                teams.clubId(), ALIAS_KIND, aliasScopeKey(teams.league().getId()))) {
            TeamCandidate target = null;
            if (ALIAS_OWN_TEAM.equals(alias.getTargetKind()) && alias.getTargetTeamId() != null) {
                Team t = teams.ownTeams().get(alias.getTargetTeamId());
                if (t != null && t.isActive()) {
                    target = ownCandidate(CandidateSource.ALIAS, t);
                }
            } else if (!ownOnly && ALIAS_LEAGUE_TEAM.equals(alias.getTargetKind()) && alias.getTargetName() != null) {
                String wanted = key(alias.getTargetName());
                LeagueTeam found = teams.thisSeason().stream().filter(t -> key(t.getName()).equals(wanted))
                        .findFirst().orElse(null);
                if (found == null) {
                    found = java.util.stream.Stream.concat(teams.previous().stream(), teams.other().stream())
                            .filter(t -> key(t.getName()).equals(wanted)).findFirst().orElse(null);
                }
                if (found != null) {
                    target = leagueCandidate(CandidateSource.ALIAS, found, teams);
                }
            }
            if (target != null) {
                String on = alias.getCreatedAt() == null ? null
                        : ALIAS_DATE.format(alias.getCreatedAt().atZone(ZoneId.systemDefault()));
                out.add(new RememberedAlias(alias.getAliasNormalised(), target, on));
            }
        }
        return out;
    }

    /** The alias scope: a remembered name belongs to one club and one league, across seasons. */
    public static String aliasScopeKey(UUID leagueId) {
        return "league:" + leagueId;
    }

    public static String aliasKey(String sheetName) {
        return NameAliases.normalise(sheetName);
    }

    // ---- existing matches ----------------------------------------------------------------------------------------

    /** The existing matches the rules compare against, and the club's known venue spellings. */
    public record Existing(List<ExistingMatch> matches, List<String> venues) {}

    /**
     * Every match of this league and season (identity), plus every other active match of the club in the file's date
     * window (own-team overlap and venue clashes in any league), whoever created them; dependants are read once for
     * the league's own matches (an update that moves the time is blocked by them).
     */
    public Existing loadExisting(Teams teams, LocalDate from, LocalDate to, ZoneId zone) {
        UUID clubId = teams.clubId();
        List<Match> leagueMatches = matchRepository.findByLeagueIdAndSeasonId(teams.league().getId(), teams.season().getId());
        Map<UUID, Match> byId = new LinkedHashMap<>();
        leagueMatches.stream().filter(m -> clubId.equals(m.getClubId())).forEach(m -> byId.put(m.getId(), m));
        if (from != null && to != null) {
            Instant start = from.minusDays(1).atStartOfDay(zone).toInstant();
            Instant end = to.plusDays(2).atStartOfDay(zone).toInstant();
            for (Match m : matchRepository.findActiveInWindow(clubId, start, end)) {
                byId.putIfAbsent(m.getId(), m);
            }
        }
        Map<UUID, Set<String>> dependants = blockers.reasonsFor(leagueMatches.stream().map(Match::getId).toList());
        List<ExistingMatch> out = new ArrayList<>(byId.size());
        for (Match m : byId.values()) {
            out.add(new ExistingMatch(
                    m.getId(), m.getLeagueId(), m.getSeasonId(), m.getMatchDate(), m.getVenue(),
                    side(m.getHomeTeamId(), m.getHomeLeagueTeamId(), MatchSideNames.home(m, teams.ownTeams())),
                    side(m.getAwayTeamId(), m.getAwayLeagueTeamId(), MatchSideNames.away(m, teams.ownTeams())),
                    m.isActive(), dependants.getOrDefault(m.getId(), Set.of())));
        }
        return new Existing(out, matchRepository.findDistinctVenuesByClubId(clubId));
    }

    private static ExistingMatch.Side side(UUID teamId, UUID leagueTeamId, String name) {
        return new ExistingMatch.Side(teamId, leagueTeamId, name);
    }
}
