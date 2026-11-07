package com.cricketlegend.service.impl;

import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.dto.MyTeamStatsDto;
import com.cricketlegend.dto.PlayerStatsFilterOptionsDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchAvailabilityPollRepository.TeamPollAnswerCountView;
import com.cricketlegend.service.MyTeamStatsService;
import com.cricketlegend.service.PlayerStatsService;
import com.cricketlegend.service.TeamDashboardService;
import com.cricketlegend.service.TeamStatsService;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.HeldTeamHistory;
import com.cricketlegend.service.support.MyPlayerAccess;
import com.cricketlegend.service.support.MyTeamStatsBuilder;
import com.cricketlegend.service.support.StatsScope;
import com.cricketlegend.service.support.StatsScopeResolver;
import com.cricketlegend.service.support.TeamStatsCalculator;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/147. Authorised only by {@link MyPlayerAccess#resolve}; the club comes from the held player, never from the
 * request, and the team must be one of the held player's own (a team in the player's results filter options, the same rule
 * as the Results page). The team page and the extra facts are {@link TeamStatsService}'s and the series is {@link
 * TeamDashboardService}'s (both reach the statistics repositories, the only classes allowed to), the availability poll
 * counts come from the poll repository, and the lot is shaped by the pure {@link MyTeamStatsBuilder} through {@code
 * TeamStatsCalculator}. Nothing here defines a figure. Player and opponent names are returned but never logged.
 */
@Service
class MyTeamStatsServiceImpl implements MyTeamStatsService {

    private final MyPlayerAccess access;
    private final PlayerStatsService playerStatsService;
    private final TeamStatsService teamStatsService;
    private final TeamDashboardService teamDashboardService;
    private final MatchAvailabilityPollRepository pollRepository;

    MyTeamStatsServiceImpl(
            MyPlayerAccess access,
            PlayerStatsService playerStatsService,
            TeamStatsService teamStatsService,
            TeamDashboardService teamDashboardService,
            MatchAvailabilityPollRepository pollRepository) {
        this.access = access;
        this.playerStatsService = playerStatsService;
        this.teamStatsService = teamStatsService;
        this.teamDashboardService = teamDashboardService;
        this.pollRepository = pollRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public MyTeamStatsDto get(
            Authentication authentication,
            String playerKey,
            UUID teamId,
            UUID seasonId,
            UUID leagueId,
            String competition) {
        HeldPlayer held = access.resolve(authentication, playerKey);
        UUID clubId = held.profile().getClubId();
        if (teamId == null) {
            throw new ValidationException("teamId is required.");
        }
        StatsScope.Competition comp = StatsScopeResolver.parseCompetition(competition);
        PlayerStatsFilterOptionsDto options = playerStatsService.filterOptionsForHeldPlayer(clubId, held.profile().getId());
        if (!options.teamIds().contains(teamId)) {
            throw new NotFoundException("Team not found");
        }

        HeldTeamHistory history = teamStatsService.historyForHeldPlayer(clubId, teamId, seasonId, leagueId, comp);
        var series = teamDashboardService.getForHeldPlayer(clubId, teamId, seasonId, leagueId, comp);
        return MyTeamStatsBuilder.build(
                history, series, new MyTeamStatsBuilder.Extras(seasonId, leagueId, teamId, comp, availableCounts(history, teamId)));
    }

    /** How many players answered "available" in each closed poll of the team among the counted matches (no matches, no read). */
    private List<Long> availableCounts(HeldTeamHistory history, UUID teamId) {
        List<UUID> matchIds = history.resultsOldestFirst().stream()
                .filter(r -> !"FORFEIT".equals(r.outcome()))
                .map(TeamStatsCalculator.ResultFact::matchId)
                .distinct()
                .toList();
        if (matchIds.isEmpty()) {
            return List.of();
        }
        return pollRepository.countAnswersForTeamPolls(teamId, matchIds, AvailabilityStatus.AVAILABLE).stream()
                .map(TeamPollAnswerCountView::getAnswered)
                .map(n -> n == null ? 0L : n)
                .toList();
    }
}
