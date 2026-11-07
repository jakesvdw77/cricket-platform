package com.cricketlegend.service;

import com.cricketlegend.dto.TeamDashboardDto;
import com.cricketlegend.service.support.StatsScope;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/117-stats-dashboard.md: the team Dashboard's series for the same counted team results, filters and access as
 * {@link TeamStatsService#team}, shaped by {@code TeamDashboardSeriesBuilder} through {@code TeamStatsCalculator}.
 */
public interface TeamDashboardService {

    /**
     * Filter errors are exactly those of {@link TeamStatsService#team} (404 unknown or other-club team, season or league;
     * 400 bad {@code competition}; 403 a team outside a section-scoped caller's reach). A team with no counted result is a
     * normal read with empty series.
     */
    TeamDashboardDto get(
            Authentication authentication, UUID clubId, UUID teamId, UUID seasonId, UUID leagueId, String competition);

    /**
     * docs/specs/147: the same series for the Player Hub scope (only published results a manager switched on for the Player
     * Hub; no section reach, the caller was authorised by {@code MyPlayerAccess}). An unknown or other-club team, season or
     * league is a {@code NotFoundException}.
     */
    TeamDashboardDto getForHeldPlayer(
            UUID clubId, UUID teamId, UUID seasonId, UUID leagueId, StatsScope.Competition competition);
}
