package com.cricketlegend.service.support;

import com.cricketlegend.dto.LeaderboardTableDto;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardTableRow;

/**
 * docs/specs/147: one page of a standings table for the Player Hub scope together with the held player's own row in the
 * whole ordered table ({@code me}, null when the player is not listed, for example below the minimum or without a figure)
 * and its zero-based {@code position} in that order (-1 when not listed). Pure data; carries no access information.
 */
public record HeldLeaderboardTable(LeaderboardTableDto table, LeaderboardTableRow me, int position) {
}
