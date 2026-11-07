package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.MyStatsDto;
import com.cricketlegend.dto.MyStatsInningsPageDto;
import com.cricketlegend.dto.PlayerStatsDto;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.MyStatsService;
import com.cricketlegend.service.PlayerDashboardService;
import com.cricketlegend.service.PlayerStatsService;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.HeldPlayerHistory;
import com.cricketlegend.service.support.MyPlayerAccess;
import com.cricketlegend.service.support.MyStatsBuilder;
import com.cricketlegend.service.support.MyStatsDrill;
import com.cricketlegend.service.support.PlayerStatsCalculator;
import com.cricketlegend.service.support.StatsDrillFilter;
import com.cricketlegend.service.support.StatsScope;
import com.cricketlegend.service.support.StatsScopeResolver;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/147. Authorised only by {@link MyPlayerAccess#resolve}; the club and the player come from the held player,
 * never from the request. The counters and derived figures are {@link PlayerStatsService}'s, the per-match history is
 * {@link PlayerDashboardService}'s (both reach the statistics repositories, the only classes allowed to), the rest is
 * shaped by the pure {@link MyStatsBuilder} and {@link MyStatsDrill} through {@code PlayerStatsCalculator}. Nothing here
 * defines a figure. Opponent, bowler and teammate names are returned (Decision 3) but never logged.
 */
@Service
class MyStatsServiceImpl implements MyStatsService {

    private final MyPlayerAccess access;
    private final PlayerStatsService statsService;
    private final PlayerDashboardService dashboardService;
    private final SeasonRepository seasonRepository;
    private final MatchAvailabilityPollRepository pollRepository;
    private final MatchSidePlayerRepository selectionRepository;
    private final MatchRepository matchRepository;
    private final TeamSquadMemberRepository squadRepository;

    MyStatsServiceImpl(
            MyPlayerAccess access,
            PlayerStatsService statsService,
            PlayerDashboardService dashboardService,
            SeasonRepository seasonRepository,
            MatchAvailabilityPollRepository pollRepository,
            MatchSidePlayerRepository selectionRepository,
            MatchRepository matchRepository,
            TeamSquadMemberRepository squadRepository) {
        this.access = access;
        this.statsService = statsService;
        this.dashboardService = dashboardService;
        this.seasonRepository = seasonRepository;
        this.pollRepository = pollRepository;
        this.selectionRepository = selectionRepository;
        this.matchRepository = matchRepository;
        this.squadRepository = squadRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public MyStatsDto get(
            Authentication authentication,
            String playerKey,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition) {
        HeldPlayer held = access.resolve(authentication, playerKey);
        UUID clubId = held.profile().getClubId();
        UUID playerId = held.profile().getId();
        StatsScope.Competition comp = StatsScopeResolver.parseCompetition(competition);

        PlayerStatsDto stats = statsService.getForHeldPlayer(clubId, playerId, seasonId, leagueId, teamId, comp);
        HeldPlayerHistory history = dashboardService.historyForHeldPlayer(clubId, playerId, seasonId, leagueId, teamId, comp);

        Map<UUID, Season> seasons =
                seasonRepository.findByClubId(clubId).stream().collect(Collectors.toMap(Season::getId, Function.identity()));
        List<PlayerStatsCalculator.SeasonCounters> seasonCounters = history.seasons().stream()
                .filter(s -> seasons.containsKey(s.seasonId()))
                .map(s -> new PlayerStatsCalculator.SeasonCounters(
                        s.seasonId(),
                        seasons.get(s.seasonId()).getLabel(),
                        seasons.get(s.seasonId()).getStartDate(),
                        s.matches(),
                        s.innings(),
                        s.dismissals(),
                        s.runs(),
                        s.wickets()))
                .toList();
        List<PlayerStatsCalculator.PollFact> polls = pollRepository.findPollFactsForPlayer(clubId, playerId).stream()
                .map(v -> new PlayerStatsCalculator.PollFact(
                        v.getMatchId(), v.getSeasonId(), v.getLeagueId(), v.getTeamId(), v.getStatus()))
                .toList();
        List<PlayerStatsCalculator.SelectionFact> selections =
                selectionRepository.findSelectionFactsForPlayer(clubId, playerId, Instant.now()).stream()
                        .map(v -> new PlayerStatsCalculator.SelectionFact(
                                v.getMatchId(), v.getSeasonId(), v.getLeagueId(), v.getTeamId()))
                        .toList();
        return MyStatsBuilder.build(
                stats,
                history,
                new MyStatsBuilder.Extras(
                        held.subject().getFirstName(),
                        held.subject().getDateOfBirth(),
                        seasonId,
                        leagueId,
                        teamId,
                        comp,
                        seasonCounters,
                        polls,
                        selections,
                        fixturesRemaining(clubId, playerId, seasonId, leagueId, teamId, comp)));
    }

    @Override
    @Transactional(readOnly = true)
    public MyStatsInningsPageDto innings(
            Authentication authentication,
            String playerKey,
            String kind,
            String filter,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            Integer page,
            Integer size) {
        HeldPlayer held = access.resolve(authentication, playerKey);
        StatsScope.Competition comp = StatsScopeResolver.parseCompetition(competition);
        StatsDrillFilter.Kind drillKind = StatsDrillFilter.parseKind(kind);
        StatsDrillFilter.Filter drillFilter = StatsDrillFilter.parseFilter(drillKind, filter);
        MyStatsDrill.checkPaging(page, size);
        HeldPlayerHistory history = dashboardService.historyForHeldPlayer(
                held.profile().getClubId(), held.profile().getId(), seasonId, leagueId, teamId, comp);
        return MyStatsDrill.page(drillKind, drillFilter, history, page, size);
    }

    /**
     * Upcoming active matches of the player's teams in the chosen season: the Team filter when given, else the teams whose
     * squad holds the player that season. Null when no season is chosen.
     */
    private Long fixturesRemaining(
            UUID clubId, UUID playerId, UUID seasonId, UUID leagueId, UUID teamId, StatsScope.Competition comp) {
        if (seasonId == null) {
            return null;
        }
        Set<UUID> teamIds = teamId != null
                ? Set.of(teamId)
                : squadRepository.findByPlayerProfileId(playerId).stream()
                        .filter(m -> seasonId.equals(m.getSeasonId()))
                        .map(TeamSquadMember::getTeamId)
                        .collect(Collectors.toSet());
        if (teamIds.isEmpty()) {
            return 0L;
        }
        return PlayerStatsCalculator.fixturesRemaining(
                matchRepository.findUpcomingLeagueIdsForTeams(clubId, seasonId, teamIds, Instant.now()), leagueId, comp);
    }
}
