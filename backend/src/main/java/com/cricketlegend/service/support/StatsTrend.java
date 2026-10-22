package com.cricketlegend.service.support;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * docs/specs/117-stats-dashboard.md, trend hints (Economy rate, Dot balls): the pooled figure of the last
 * {@link DashboardLimits#TREND_SPAN} points against the pooled figure of the points before them, with a direction. A hint
 * exists only when each half holds at least {@link DashboardLimits#TREND_MIN_PER_HALF} points. Pooled means the sum of the
 * numerators over the sum of the denominators (never the mean of the point figures), rounded once to {@code scale} places;
 * the direction compares the two rounded figures and is {@link Direction#FLAT} when they are within {@code flatBand}
 * (inclusive). Pure: no Spring, repository, entity, caller or access information.
 */
public final class StatsTrend {

    public enum Direction {
        UP,
        DOWN,
        FLAT
    }

    /** One chart point's ratio parts, for pooling. */
    public record Weighted(BigDecimal numerator, BigDecimal denominator) {
    }

    /** {@code recent} and {@code earlier} are the two pooled figures. */
    public record Hint(BigDecimal recent, BigDecimal earlier, Direction direction) {
    }

    private StatsTrend() {}

    /** The hint for points given oldest first, or null when either half is too small or a half has no denominator. */
    public static Hint of(List<Weighted> oldestFirst, int scale, BigDecimal flatBand) {
        int n = oldestFirst.size();
        int recentStart = Math.max(0, n - DashboardLimits.TREND_SPAN);
        int earlierStart = Math.max(0, recentStart - DashboardLimits.TREND_SPAN);
        List<Weighted> recent = oldestFirst.subList(recentStart, n);
        List<Weighted> earlier = oldestFirst.subList(earlierStart, recentStart);
        if (recent.size() < DashboardLimits.TREND_MIN_PER_HALF || earlier.size() < DashboardLimits.TREND_MIN_PER_HALF) {
            return null;
        }
        BigDecimal recentValue = pooled(recent, scale);
        BigDecimal earlierValue = pooled(earlier, scale);
        if (recentValue == null || earlierValue == null) {
            return null;
        }
        BigDecimal change = recentValue.subtract(earlierValue);
        Direction direction = change.abs().compareTo(flatBand) <= 0
                ? Direction.FLAT
                : change.signum() > 0 ? Direction.UP : Direction.DOWN;
        return new Hint(recentValue, earlierValue, direction);
    }

    /** Σ numerator / Σ denominator to {@code scale} places, HALF_UP, null when the denominator is not positive. */
    public static BigDecimal pooled(List<Weighted> points, int scale) {
        BigDecimal numerator = BigDecimal.ZERO;
        BigDecimal denominator = BigDecimal.ZERO;
        for (Weighted point : points) {
            numerator = numerator.add(point.numerator());
            denominator = denominator.add(point.denominator());
        }
        return denominator.signum() <= 0 ? null : numerator.divide(denominator, scale, RoundingMode.HALF_UP);
    }
}
