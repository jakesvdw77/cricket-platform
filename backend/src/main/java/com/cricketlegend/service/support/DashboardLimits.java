package com.cricketlegend.service.support;

import java.math.BigDecimal;

/**
 * docs/specs/117-stats-dashboard.md, "Caps and ordering" and the trend hints: the named constants of the Dashboard series in
 * one place. Pure.
 */
public final class DashboardLimits {

    /** Per-match bar and line charts return the most recent this many points. */
    public static final int POINT_LIMIT = 30;

    /** Running trends and donuts cover at most this many counted matches (newest kept). */
    public static final int HISTORY_CAP = 300;

    /** The history read asks for one more than the cap; the extra row proves the scope was truncated. */
    public static final int HISTORY_READ = HISTORY_CAP + 1;

    /** A trend hint compares the last this many matches with the same number before them. */
    public static final int TREND_SPAN = 5;

    /** A trend hint is given only when each half holds at least this many matches. */
    public static final int TREND_MIN_PER_HALF = 3;

    /** Economy: a change of at most this many runs per over is "flat" (spec 117, Economy rate). */
    public static final BigDecimal ECONOMY_FLAT_BAND = new BigDecimal("0.25");

    /** Dot balls: a change of at most this many percentage points is "flat" (spec 117, Dot balls). */
    public static final BigDecimal DOT_PERCENT_FLAT_BAND = new BigDecimal("0.5");

    private DashboardLimits() {}
}
