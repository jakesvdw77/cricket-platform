package com.cricketlegend.service;

import com.cricketlegend.dto.PlayerDashboardDto;
import com.cricketlegend.service.support.HeldPlayerHistory;
import com.cricketlegend.service.support.StatsScope;
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

    /**
     * docs/specs/147: the same series for a player the caller holds, in the Player Hub scope (only published results a
     * manager switched on; no section reach). Authorisation is the caller's ({@code MyPlayerAccess}); the club and the
     * player come from the held player. A season, league or team of another club is a 404.
     */
    PlayerDashboardDto getForHeldPlayer(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            StatsScope.Competition competition);

    /**
     * docs/specs/147: everything the Player Hub "My stats" payload and drill are built from, read once (a fixed number of
     * statements) for the same scope as {@link #getForHeldPlayer}, whose series it carries. The per-season counters ignore
     * the Season filter; every other filter applies.
     */
    HeldPlayerHistory historyForHeldPlayer(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            StatsScope.Competition competition);
}
