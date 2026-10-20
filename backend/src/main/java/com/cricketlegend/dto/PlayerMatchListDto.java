package com.cricketlegend.dto;

import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardPageInfo;
import com.cricketlegend.dto.PlayerStatsDto.PlayerStatsScope;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/115-player-match-list.md: one page of a player's counted matches (the same appearances, filters and access as
 * {@link PlayerStatsDto}), newest first unless {@code direction=asc}. {@code page.totalElements} is the number of counted
 * matches under the filters, so it equals {@code basis.matchesCounted} of the stats read. The DTO carries no access
 * information and no other person's name.
 */
public record PlayerMatchListDto(
        UUID playerId, PlayerStatsScope scope, LeaderboardPageInfo page, List<PlayerMatchRowDto> rows) {
}
