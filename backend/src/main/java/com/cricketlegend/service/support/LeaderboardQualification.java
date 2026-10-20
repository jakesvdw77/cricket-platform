package com.cricketlegend.service.support;

import java.util.Collection;

/**
 * docs/specs/103-player-stats.md, "Minimum qualification on the Awards view": the filter-aware default minimums, in one
 * place. Let M be the largest number of matches played by any one player in the filtered scope. Minimum innings is
 * {@code clamp(ceil(M / 2), 1, 5)} and minimum overs {@code clamp(M, 2, 10)}. The same values drive the muted Small sample
 * hint on the standings, so the standings and the awards agree on what "small" means. Pure.
 */
public final class LeaderboardQualification {

    private static final int MAX_INNINGS = 5;
    private static final int MIN_OVERS = 2;
    private static final int MAX_OVERS = 10;

    /** The default minimums for one scope. */
    public record Defaults(int innings, int overs) {
    }

    private LeaderboardQualification() {}

    /** Defaults from M, the busiest player's matches in the scope (0 when nobody played). */
    public static Defaults defaultsFor(long busiestPlayersMatches) {
        long m = Math.max(0, busiestPlayersMatches);
        int innings = (int) clamp((m + 1) / 2, 1, MAX_INNINGS);
        int overs = (int) clamp(m, MIN_OVERS, MAX_OVERS);
        return new Defaults(innings, overs);
    }

    /** Defaults for a scope, taking M as the largest {@code matches} among the players' counters. */
    public static Defaults defaultsForScope(Collection<PlayerStatsCounters> players) {
        long busiest = 0;
        for (PlayerStatsCounters counters : players) {
            busiest = Math.max(busiest, counters.matches());
        }
        return defaultsFor(busiest);
    }

    /** The value a board's minimum takes given an innings and an overs figure: null when the board has no minimum. */
    public static Integer valueFor(LeaderboardBoard board, int innings, int overs) {
        return switch (board.getMinimumKind()) {
            case INNINGS -> innings;
            case OVERS -> overs;
            case NONE -> null;
        };
    }

    /** The suggested minimum of a board under the defaults: null when the board has no minimum. */
    public static Integer suggestedFor(LeaderboardBoard board, Defaults defaults) {
        return valueFor(board, defaults.innings(), defaults.overs());
    }

    private static long clamp(long value, long min, long max) {
        return Math.max(min, Math.min(max, value));
    }
}
