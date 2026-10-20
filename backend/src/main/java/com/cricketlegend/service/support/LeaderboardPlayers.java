package com.cricketlegend.service.support;

import java.util.List;

/**
 * docs/specs/103-player-stats.md: everyone in a leaderboard scope as {@link LeaderboardRanker} candidates, the scope they
 * were read for and the number of distinct published results behind them.
 */
public record LeaderboardPlayers(StatsScope scope, List<LeaderboardRanker.Candidate> candidates, long resultsCounted) {
}
