package com.cricketlegend.service;

import com.cricketlegend.dto.PlayerMatchListDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/115-player-match-list.md: one page of a player's counted matches with the player's figures in each, computed
 * on read from the same appearances, filters and access as {@link PlayerStatsService#get}.
 */
public interface PlayerMatchListService {

    /**
     * Filter errors are exactly those of {@link PlayerStatsService#get} (404 unknown or other-club player, season,
     * league, team or section; 400 bad {@code competition}; 403 a section or team outside a section-scoped caller's
     * reach). {@code page} (default 0) must be zero or more, {@code size} (default 20) from 1 to 100 and {@code direction}
     * {@code asc} or {@code desc} (default {@code desc}, newest first), otherwise a {@code ValidationException}. A player
     * with no counted match, or a caller whose reach leaves nothing, gets an empty page.
     */
    PlayerMatchListDto list(
            Authentication authentication,
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            UUID sectionId,
            String competition,
            String direction,
            Integer page,
            Integer size);
}
