package com.cricketlegend.service.support;

import java.time.Instant;
import java.util.UUID;

/**
 * docs/specs/103-player-stats.md, "Boards": the match of a player's best innings (highest score or best bowling), read by
 * one follow-up query. {@code balls} is balls faced (highest score) or bowled (best bowling), null when not recorded; it
 * only breaks a tie between equal highest scores. Input to {@link LeaderboardRanker}.
 */
public record LeaderboardInningsFact(UUID matchId, Instant matchDate, String opponent, Integer balls) {
}
