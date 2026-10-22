package com.cricketlegend.service;

import com.cricketlegend.dto.TeamDashboardDto;
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
}
