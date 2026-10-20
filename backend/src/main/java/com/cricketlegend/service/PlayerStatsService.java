package com.cricketlegend.service;

import com.cricketlegend.dto.PlayerStatsDto;
import com.cricketlegend.dto.PlayerStatsFilterOptionsDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/103-player-stats.md: one player's statistics, computed on read from the club's published results. Every
 * filter is optional; no filter is career. Statistics are verified club figures only (published results, our
 * registered non-substitute rows).
 */
public interface PlayerStatsService {

    /**
     * {@code sectionId} includes its descendant sections; a section-scoped caller is narrowed to the teams of their
     * accessible sections (and a {@code sectionId} or {@code teamId} outside them is refused with 403). An unknown or
     * other-club player, season, league, team or section is a {@code NotFoundException}; a {@code competition} other
     * than {@code LEAGUE} or {@code FRIENDLY} is a {@code ValidationException}. A player with no counted appearance
     * returns zero counters, not a 404.
     */
    PlayerStatsDto get(
            Authentication authentication,
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            UUID sectionId,
            String competition);

    /**
     * Docs/specs/103 decision 22: the seasons, leagues, teams, sections and competition types in the player's counted
     * appearances (same counting rules as {@link #get}, no user filters). A section-scoped caller sees only teams in
     * their sections. An unknown or other-club player is a {@code NotFoundException}; no counted appearance returns
     * empty lists.
     */
    PlayerStatsFilterOptionsDto filterOptions(Authentication authentication, UUID clubId, UUID playerId);
}
