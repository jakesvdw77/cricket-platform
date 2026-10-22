package com.cricketlegend.service;

import com.cricketlegend.dto.PlayerDashboardDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/117-stats-dashboard.md: the player Dashboard's series for the same appearances, filters and access as {@link
 * PlayerStatsService#get}, shaped by {@code PlayerDashboardSeriesBuilder} through {@code PlayerStatsCalculator}.
 */
public interface PlayerDashboardService {

    /**
     * Filter errors are exactly those of {@link PlayerStatsService#get} (404 unknown or other-club player, season, league,
     * team or section; 400 bad {@code competition}; 403 a section or team outside a section-scoped caller's reach). A player
     * with no counted match, or a caller whose reach leaves nothing, gets empty series and a zero basis.
     */
    PlayerDashboardDto get(
            Authentication authentication,
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            UUID sectionId,
            String competition);
}
