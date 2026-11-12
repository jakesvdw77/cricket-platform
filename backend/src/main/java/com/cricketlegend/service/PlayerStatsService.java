package com.cricketlegend.service;

import com.cricketlegend.dto.PlayerStatsDto;
import com.cricketlegend.dto.PlayerStatsFilterOptionsDto;
import com.cricketlegend.service.support.StatsScope;
import java.util.List;
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

    /**
     * Docs/specs/145, the Player Hub: the held player's figures over only the results a manager switched on for the
     * Player Hub, so what a parent sees adds up. The caller was authorised by {@code MyPlayerAccess}; no section
     * narrowing. A season, league or team of another club is a {@code NotFoundException}.
     */
    PlayerStatsDto getForHeldPlayer(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            StatsScope.Competition competition);

    /** As {@link #filterOptions}, over only the results shown in the Player Hub, for the held player. */
    PlayerStatsFilterOptionsDto filterOptionsForHeldPlayer(UUID clubId, UUID playerId);

    /**
     * The distinct (season, league, team) combinations of the held player's counted results shown in the Player Hub,
     * from the same read as {@link #filterOptionsForHeldPlayer}; a null league is a friendly.
     */
    List<PlayerStatsCombo> comboOptionsForHeldPlayer(UUID clubId, UUID playerId);

    /** One season, league (null for a friendly) and team combination. */
    record PlayerStatsCombo(UUID seasonId, UUID leagueId, UUID teamId) {}
}
