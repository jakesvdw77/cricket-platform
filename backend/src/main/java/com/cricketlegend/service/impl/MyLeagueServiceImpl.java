package com.cricketlegend.service.impl;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueAffiliation;
import com.cricketlegend.domain.LeagueSeason;
import com.cricketlegend.domain.LeagueTeam;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.MatchResultDto;
import com.cricketlegend.dto.MyKeyDatesDto;
import com.cricketlegend.dto.MyLeagueDto;
import com.cricketlegend.dto.MyLeagueSummaryDto;
import com.cricketlegend.dto.MyLeagueTeamDto;
import com.cricketlegend.dto.MyLeaguesDto;
import com.cricketlegend.dto.MyPlayingConditionsDto;
import com.cricketlegend.dto.MyResultItemDto;
import com.cricketlegend.dto.MyScheduleItemDto;
import com.cricketlegend.dto.MySeasonOptionDto;
import com.cricketlegend.dto.MyTeamRefDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.MyLeagueMapper;
import com.cricketlegend.repository.LeagueAffiliationRepository;
import com.cricketlegend.repository.LeaguePlayingConditionsRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.LeagueSeasonRepository;
import com.cricketlegend.repository.LeagueTeamRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchRepository.LeagueMatchSummary;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.ClubShareSettingsService;
import com.cricketlegend.service.MyLeagueService;
import com.cricketlegend.service.ResultService;
import com.cricketlegend.service.support.LeagueResultText;
import com.cricketlegend.service.support.LeagueSide;
import com.cricketlegend.service.support.MyLeagueMembership;
import com.cricketlegend.service.support.MyPlayerAccess;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.SeasonResolution;
import com.cricketlegend.service.support.ServerClock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/123 (Player Hub leagues). Authorised only by {@link MyPlayerAccess#resolve}; the club is the held player's
 * club and the "player's teams" come only from that player's own squad rows. A league is visible when one of those teams
 * (squad row in the season) is affiliated to it for the season, and it is active and the club's own; anything else is a
 * 404. Results come from {@link ResultService#publishedResults} only. No contacts and no manager-only data are mapped.
 */
@Service
class MyLeagueServiceImpl implements MyLeagueService {

    private final MyPlayerAccess myPlayerAccess;
    private final SeasonRepository seasonRepository;
    private final TeamSquadMemberRepository squadRepository;
    private final TeamRepository teamRepository;
    private final LeagueRepository leagueRepository;
    private final LeagueAffiliationRepository affiliationRepository;
    private final LeagueTeamRepository leagueTeamRepository;
    private final LeaguePlayingConditionsRepository conditionsRepository;
    private final LeagueSeasonRepository leagueSeasonRepository;
    private final MatchRepository matchRepository;
    private final ResultService resultService;
    private final MyLeagueMapper mapper;
    private final ClubShareSettingsService shareSettingsService;

    MyLeagueServiceImpl(
            MyPlayerAccess myPlayerAccess,
            SeasonRepository seasonRepository,
            TeamSquadMemberRepository squadRepository,
            TeamRepository teamRepository,
            LeagueRepository leagueRepository,
            LeagueAffiliationRepository affiliationRepository,
            LeagueTeamRepository leagueTeamRepository,
            LeaguePlayingConditionsRepository conditionsRepository,
            LeagueSeasonRepository leagueSeasonRepository,
            MatchRepository matchRepository,
            ResultService resultService,
            MyLeagueMapper mapper,
            ClubShareSettingsService shareSettingsService) {
        this.myPlayerAccess = myPlayerAccess;
        this.seasonRepository = seasonRepository;
        this.squadRepository = squadRepository;
        this.teamRepository = teamRepository;
        this.leagueRepository = leagueRepository;
        this.affiliationRepository = affiliationRepository;
        this.leagueTeamRepository = leagueTeamRepository;
        this.conditionsRepository = conditionsRepository;
        this.leagueSeasonRepository = leagueSeasonRepository;
        this.matchRepository = matchRepository;
        this.resultService = resultService;
        this.mapper = mapper;
        this.shareSettingsService = shareSettingsService;
    }

    @Override
    @Transactional(readOnly = true)
    public MyLeaguesDto list(Authentication authentication, String playerKey, UUID requestedSeasonId) {
        HeldPlayer held = myPlayerAccess.resolve(authentication, playerKey);
        UUID clubId = held.profile().getClubId();
        List<Season> seasons = seasonRepository.findByClubId(clubId);
        UUID seasonId = SeasonResolution.resolve(seasons, requestedSeasonId);
        MyLeagueMembership membership = membership(clubId, held.profile().getId());

        UUID currentId = SeasonResolution.currentSeasonId(seasons);
        List<MySeasonOptionDto> options = seasons.stream()
                .filter(s -> s.getId().equals(seasonId) || s.getId().equals(currentId)
                        || !membership.forSeason(s.getId()).isEmpty())
                .sorted(Comparator.comparing(Season::getStartDate).reversed()
                        .thenComparing(Season::getCreatedAt, Comparator.reverseOrder()))
                .map(s -> mapper.toOption(s, s.getId().equals(currentId)))
                .toList();

        Map<UUID, Set<UUID>> mine = membership.forSeason(seasonId);
        if (mine.isEmpty()) {
            return new MyLeaguesDto(options, seasonId, List.of());
        }
        Set<UUID> leagueIds = mine.keySet();
        Map<UUID, Integer> teamCounts = teamCounts(leagueIds, seasonId);
        Map<UUID, LeagueMatchSummary> matches = new HashMap<>();
        for (LeagueMatchSummary summary : matchRepository.summariseByLeagueForSeason(clubId, seasonId, ServerClock.now())) {
            matches.put(summary.getLeagueId(), summary);
        }
        List<MyLeagueSummaryDto> leagues = leagueIds.stream()
                .map(membership.leagues()::get)
                .sorted(byName())
                .map(league -> {
                    LeagueMatchSummary summary = matches.get(league.getId());
                    List<MyTeamRefDto> myTeams = mine.get(league.getId()).stream()
                            .map(membership.teams()::get)
                            .sorted(Comparator.comparing((Team t) -> t.getName().toLowerCase()).thenComparing(Team::getName))
                            .map(mapper::toRef)
                            .toList();
                    return new MyLeagueSummaryDto(
                            league.getId(), league.getName(), league.getLogoUrl(), league.getMinAge(), league.getMaxAge(),
                            teamCounts.getOrDefault(league.getId(), 0), myTeams,
                            summary == null || summary.getNextMatchDate() == null
                                    ? null : ServerClock.localDate(summary.getNextMatchDate()),
                            summary == null ? 0 : (int) summary.getMatchCount());
                })
                .toList();
        return new MyLeaguesDto(options, seasonId, leagues);
    }

    @Override
    @Transactional(readOnly = true)
    public MyLeagueDto get(Authentication authentication, String playerKey, UUID leagueId, UUID requestedSeasonId) {
        HeldPlayer held = myPlayerAccess.resolve(authentication, playerKey);
        UUID clubId = held.profile().getClubId();
        List<Season> seasons = seasonRepository.findByClubId(clubId);
        UUID seasonId = SeasonResolution.resolve(seasons, requestedSeasonId);
        MyLeagueMembership membership = membership(clubId, held.profile().getId());
        Set<UUID> myTeamIds = seasonId == null ? null : membership.forSeason(seasonId).get(leagueId);
        if (myTeamIds == null) {
            throw new NotFoundException("League not found");
        }
        League league = membership.leagues().get(leagueId);
        Season season = seasons.stream().filter(s -> s.getId().equals(seasonId)).findFirst().orElseThrow();

        // Teams: the club's own affiliated active teams, then the league's registered active opponents.
        List<LeagueAffiliation> affiliations = affiliationRepository.findByLeagueIdInAndSeasonId(Set.of(leagueId), seasonId);
        Map<UUID, Team> ownTeams = teamRepository.findAllById(
                        affiliations.stream().map(LeagueAffiliation::getTeamId).collect(Collectors.toSet()))
                .stream()
                .filter(t -> t.isActive() && clubId.equals(t.getClubId()))
                .collect(Collectors.toMap(Team::getId, Function.identity()));
        List<MyLeagueTeamDto> teams = new ArrayList<>();
        ownTeams.values().stream().sorted(Comparator.comparing((Team t) -> t.getName().toLowerCase()).thenComparing(Team::getName))
                .forEach(t -> teams.add(mapper.toTeam(t, myTeamIds.contains(t.getId()))));
        leagueTeamRepository.findByLeagueIdInAndSeasonIdAndActiveTrue(Set.of(leagueId), seasonId).stream()
                .sorted(Comparator.comparing((LeagueTeam t) -> t.getName().toLowerCase()).thenComparing(LeagueTeam::getName))
                .forEach(t -> teams.add(mapper.toTeam(t, false)));

        MyPlayingConditionsDto conditions = conditionsRepository.findByLeagueIdAndSeasonId(leagueId, seasonId)
                .map(mapper::toConditions).orElse(null);

        List<Match> matches = matchRepository
                .findByClubIdAndLeagueIdAndSeasonIdAndActiveTrueOrderByMatchDateAscIdAsc(clubId, leagueId, seasonId);
        Map<UUID, Team> sideTeams = new HashMap<>(ownTeams);
        Set<UUID> missing = new HashSet<>();
        for (Match m : matches) {
            for (UUID id : new UUID[] {m.getHomeTeamId(), m.getAwayTeamId()}) {
                if (id != null && !sideTeams.containsKey(id)) {
                    missing.add(id);
                }
            }
        }
        if (!missing.isEmpty()) {
            teamRepository.findAllById(missing).stream()
                    .filter(t -> clubId.equals(t.getClubId()))
                    .forEach(t -> sideTeams.put(t.getId(), t));
        }

        List<MyScheduleItemDto> schedule = new ArrayList<>();
        for (Match m : matches) {
            LeagueSide home = side(m.getHomeTeamId(), m.getHomeTeamName(), m.getHomeTeamLogoUrl(), sideTeams, "TBC");
            LeagueSide away = side(m.getAwayTeamId(), m.getAwayTeamName(), m.getAwayTeamLogoUrl(), sideTeams, "TBC");
            schedule.add(new MyScheduleItemDto(
                    m.getId(), ServerClock.localDate(m.getMatchDate()), ServerClock.localTime(m.getMatchDate()),
                    home.name(), home.logoUrl(), away.name(), away.logoUrl(), blankToNull(m.getVenue()),
                    isMine(m, myTeamIds)));
        }

        Map<UUID, MatchResultDto> published =
                resultService.publishedResults(clubId, matches.stream().map(Match::getId).toList());
        List<MyResultItemDto> results = new ArrayList<>();
        for (Match m : matches) {
            MatchResultDto result = published.get(m.getId());
            if (result == null) {
                continue;
            }
            String homeName = side(m.getHomeTeamId(), m.getHomeTeamName(), null, sideTeams, "Home team").name();
            String awayName = side(m.getAwayTeamId(), m.getAwayTeamName(), null, sideTeams, "Away team").name();
            results.add(new MyResultItemDto(
                    m.getId(), ServerClock.localDate(m.getMatchDate()), homeName, awayName,
                    LeagueResultText.sideScore(result, com.cricketlegend.domain.ResultSide.HOME),
                    LeagueResultText.sideScore(result, com.cricketlegend.domain.ResultSide.AWAY),
                    LeagueResultText.resultLine(result, homeName, awayName), isMine(m, myTeamIds)));
        }
        results.sort(Comparator.comparing(MyResultItemDto::date).reversed());

        Optional<LeagueSeason> dates = leagueSeasonRepository.findByLeagueIdAndSeasonId(leagueId, seasonId);
        Instant now = ServerClock.now();
        Optional<Match> next = matches.stream().filter(m -> !m.getMatchDate().isBefore(now)).findFirst();
        MyKeyDatesDto keyDates = new MyKeyDatesDto(
                dates.map(LeagueSeason::getStartDate).orElse(null),
                dates.map(LeagueSeason::getEndDate).orElse(null),
                matches.isEmpty() ? null : ServerClock.localDate(matches.get(0).getMatchDate()),
                matches.isEmpty() ? null : ServerClock.localDate(matches.get(matches.size() - 1).getMatchDate()),
                next.map(m -> ServerClock.localDate(m.getMatchDate())).orElse(null));

        return new MyLeagueDto(
                mapper.toInfo(league), mapper.toSeason(season), conditions, teams, schedule, results, keyDates,
                shareSettingsService.get(clubId).disabledFormats().getOrDefault("LEAGUE", List.of()));
    }

    /**
     * The held player's own squad teams (active teams of the club) joined to their affiliations for the same season,
     * with the active leagues of the club. Only the player's own profile id feeds it.
     */
    private MyLeagueMembership membership(UUID clubId, UUID profileId) {
        Map<UUID, Set<UUID>> squadTeamsBySeason = new HashMap<>();
        for (TeamSquadMember row : squadRepository.findByPlayerProfileId(profileId)) {
            squadTeamsBySeason.computeIfAbsent(row.getSeasonId(), k -> new LinkedHashSet<>()).add(row.getTeamId());
        }
        Set<UUID> teamIds = squadTeamsBySeason.values().stream().flatMap(Set::stream).collect(Collectors.toSet());
        if (teamIds.isEmpty()) {
            return new MyLeagueMembership(Map.of(), Map.of(), Map.of());
        }
        Map<UUID, Team> teams = teamRepository.findAllById(teamIds).stream()
                .filter(t -> t.isActive() && clubId.equals(t.getClubId()))
                .collect(Collectors.toMap(Team::getId, Function.identity()));
        List<LeagueAffiliation> affiliations = affiliationRepository.findByTeamIdIn(teams.keySet()).stream()
                .filter(a -> squadTeamsBySeason.getOrDefault(a.getSeasonId(), Set.of()).contains(a.getTeamId()))
                .toList();
        Map<UUID, League> leagues = leagueRepository
                .findAllById(affiliations.stream().map(LeagueAffiliation::getLeagueId).collect(Collectors.toSet()))
                .stream()
                .filter(l -> l.isActive() && clubId.equals(l.getClubId()))
                .collect(Collectors.toMap(League::getId, Function.identity()));
        Map<UUID, Map<UUID, Set<UUID>>> result = new HashMap<>();
        for (LeagueAffiliation a : affiliations) {
            if (leagues.containsKey(a.getLeagueId())) {
                result.computeIfAbsent(a.getSeasonId(), k -> new HashMap<>())
                        .computeIfAbsent(a.getLeagueId(), k -> new LinkedHashSet<>())
                        .add(a.getTeamId());
            }
        }
        return new MyLeagueMembership(result, leagues, teams);
    }

    /** Active own teams plus active registered opponents per league, the same set the Teams tab lists. */
    private Map<UUID, Integer> teamCounts(Set<UUID> leagueIds, UUID seasonId) {
        Map<UUID, Set<UUID>> ids = new HashMap<>();
        Set<UUID> affiliated = new HashSet<>();
        List<LeagueAffiliation> affiliations = affiliationRepository.findByLeagueIdInAndSeasonId(leagueIds, seasonId);
        affiliations.forEach(a -> affiliated.add(a.getTeamId()));
        Set<UUID> activeTeams = teamRepository.findAllById(affiliated).stream()
                .filter(Team::isActive).map(Team::getId).collect(Collectors.toSet());
        for (LeagueAffiliation a : affiliations) {
            if (activeTeams.contains(a.getTeamId())) {
                ids.computeIfAbsent(a.getLeagueId(), k -> new HashSet<>()).add(a.getTeamId());
            }
        }
        for (LeagueTeam t : leagueTeamRepository.findByLeagueIdInAndSeasonIdAndActiveTrue(leagueIds, seasonId)) {
            ids.computeIfAbsent(t.getLeagueId(), k -> new HashSet<>()).add(t.getId());
        }
        return ids.entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().size()));
    }

    private static Comparator<League> byName() {
        return Comparator.comparing((League l) -> l.getName().toLowerCase()).thenComparing(League::getName);
    }

    private static boolean isMine(Match m, Set<UUID> myTeamIds) {
        return (m.getHomeTeamId() != null && myTeamIds.contains(m.getHomeTeamId()))
                || (m.getAwayTeamId() != null && myTeamIds.contains(m.getAwayTeamId()));
    }

    /** A real team carries its name on the Team, an opponent on the match; the match's own logo wins over the team's. */
    private static LeagueSide side(UUID teamId, String matchName, String matchLogo, Map<UUID, Team> teams, String fallback) {
        Team team = teamId == null ? null : teams.get(teamId);
        String name = team != null && team.getName() != null && !team.getName().isBlank()
                ? team.getName().trim()
                : Objects.requireNonNullElse(blankToNull(matchName), fallback);
        String logo = matchLogo != null && !matchLogo.isBlank() ? matchLogo : team == null ? null : team.getLogoUrl();
        return new LeagueSide(name, logo);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
