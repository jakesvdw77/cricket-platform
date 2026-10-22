package com.cricketlegend.service.support;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/116-team-stats.md, "Precise definitions": the one place a team statistic is defined. Pure: it turns one team's
 * additive {@link TeamStatsCounters} into every derived figure, so the team table, the team page and the tests can never
 * disagree. No Spring, no repository, no entity, no caller or access information.
 *
 * <p>Rounding is {@link RoundingMode#HALF_UP} applied once, at the division that produces the figure (the two rates of Net
 * Run Rate are held to 40 decimals before their difference is rounded to 2 decimals, owner decision 2026-10-21). A figure
 * with no valid denominator is {@code null}, never 0, infinity or NaN. Innings that are not usable (runs, wickets or balls
 * missing) are already left out of the counters and only appear in the coverage.
 */
public final class TeamStatsCalculator {

    /** The rule printed beside every Net Run Rate (116 decision 13). */
    public static final String NRR_RULE = "FULL_QUOTA";

    /** One statistic the data does not support yet; removing an item when capture lands is a one-line change here. */
    public record NotCaptured(String code, String label, String reason) {
    }

    /** The statistics the data does not support yet (116 Non-goals), in one list. */
    public static final List<NotCaptured> NOT_CAPTURED = List.of(new NotCaptured(
            "PARTNERSHIPS", "Partnerships (runs by wicket)", "The scorecard does not record the fall of wickets."));

    /** Whether Net Run Rate is shown, and why not. */
    public enum NrrStatus {
        SHOWN,
        NOT_ONE_COMPETITION,
        NO_USABLE_RESULTS
    }

    /** The figures of one team; the service wraps them with the team and the echoed scope. */
    public record Figures(
            Basis basis,
            Record record,
            Batting batting,
            Chasing chasing,
            Bowling bowling,
            Extras extras,
            NetRunRate netRunRate,
            List<NotCaptured> notCaptured) {
    }

    /**
     * What was counted and what was disclosed. {@code resultsCounted}: counted team results (forfeits included);
     * {@code resultsNoBallBowled}: left out for want of a ball; {@code forfeitsReceived}/{@code forfeitsConceded}: counted
     * forfeits; {@code resultsWithBothInnings}: counted results with a usable innings on each side.
     */
    public record Basis(
            long resultsCounted,
            long internalResults,
            long resultsNoBallBowled,
            long forfeitsReceived,
            long forfeitsConceded,
            long resultsWithBothInnings) {
    }

    /** The record; a forfeit is a win for the side that received it and a loss for the side that conceded it. */
    public record Record(
            long played,
            long won,
            long lost,
            long tied,
            long drawn,
            long noResult,
            long decisive,
            BigDecimal winPercent) {
    }

    /** An innings total with the match date (the match itself is a page fact). */
    public record Total(long runs, long wickets, boolean allOut, Instant matchDate) {
    }

    /** {@code inningsUsable}/{@code inningsCounted}: usable and all own innings; {@code inningsClassifiable}: for the lowest total. */
    public record BattingCoverage(long inningsUsable, long inningsCounted, long inningsClassifiable) {
    }

    public record Batting(
            Long runs,
            Long wicketsLost,
            long innings,
            BigDecimal runsPerInnings,
            BigDecimal battingAverage,
            BigDecimal runRate,
            Long ballsFaced,
            Total highestTotal,
            Total lowestTotal,
            BattingCoverage coverage) {
    }

    public record Chase(long runs, long target, long wickets, Instant matchDate) {
    }

    public record VictoryByRuns(long margin, Instant matchDate) {
    }

    /** {@code ballsRemaining} is null when the chase innings or the scheduled quota is unknown. */
    public record VictoryByWickets(long margin, Long ballsRemaining, Instant matchDate) {
    }

    public record Chasing(Chase highestSuccessfulChase, VictoryByRuns largestVictoryByRuns, VictoryByWickets largestVictoryByWickets) {
    }

    public record BowlingCoverage(long inningsUsable, long inningsCounted) {
    }

    public record Bowling(
            Long wicketsTaken,
            Long runsConceded,
            Long ballsBowled,
            BigDecimal bowlingAverage,
            BigDecimal economy,
            BowlingCoverage coverage) {
    }

    /** One extras figure with its own coverage: {@code inningsRecorded} of {@code inningsCounted} opposition innings. */
    public record ExtrasFigure(Long value, long inningsRecorded, long inningsCounted) {
    }

    public record Extras(
            Long conceded,
            BigDecimal averagePerMatch,
            ExtrasFigure total,
            ExtrasFigure wides,
            ExtrasFigure noBalls,
            ExtrasFigure byes,
            ExtrasFigure legByes,
            ExtrasFigure penaltyRuns) {
    }

    /** {@code value} is set only when {@code status} is SHOWN; {@code matchesUsed} of {@code matchesCounted} results fed it. */
    public record NetRunRate(
            NrrStatus status,
            BigDecimal value,
            String rule,
            long matchesUsed,
            long matchesCounted,
            UUID leagueId,
            UUID seasonId) {
    }

    /** How one counted result reads for the team on the form strip. */
    public enum FormResult {
        WON,
        LOST,
        TIED,
        DRAWN,
        NO_RESULT
    }

    /** One result for the form strip; {@code forfeit} marks a win or loss by forfeit (no scores). */
    public record FormLine(FormResult result, boolean forfeit) {
    }

    private static final BigInteger TEN = BigInteger.TEN;

    private TeamStatsCalculator() {}

    public static Figures calculate(TeamStatsCounters c) {
        TeamStatsCounters.Results r = c.results();
        long resultsWithInnings = r.results() - r.forfeitsReceived() - r.forfeitsConceded();
        Basis basis = new Basis(
                r.results(),
                r.internal(),
                r.noBallBowled(),
                r.forfeitsReceived(),
                r.forfeitsConceded(),
                c.resultsWithBothInnings());
        return new Figures(
                basis,
                record(r),
                batting(c),
                chasing(c.keys()),
                bowling(c),
                extras(c),
                netRunRate(c.netRunRate(), resultsWithInnings),
                NOT_CAPTURED);
    }

    // ---- form ----

    /**
     * How a counted result reads for the team on {@code side} (the same rules as the record: a forfeit is a win for the
     * side that received it, {@code winningSide}, and a loss for the other).
     */
    public static FormLine formLine(String outcome, String winningSide, String side) {
        return switch (outcome) {
            case "WON" -> new FormLine(side.equals(winningSide) ? FormResult.WON : FormResult.LOST, false);
            case "FORFEIT" -> new FormLine(side.equals(winningSide) ? FormResult.WON : FormResult.LOST, true);
            case "TIE" -> new FormLine(FormResult.TIED, false);
            case "DRAW" -> new FormLine(FormResult.DRAWN, false);
            case "NO_RESULT", "ABANDONED" -> new FormLine(FormResult.NO_RESULT, false);
            default -> throw new IllegalArgumentException("A counted result has an outcome that no team rule covers.");
        };
    }

    // ---- record ----

    private static Record record(TeamStatsCounters.Results r) {
        long won = r.won() + r.forfeitsReceived();
        long lost = r.lost() + r.forfeitsConceded();
        long decisive = won + lost;
        long played = decisive + r.tied() + r.drawn() + r.noResult();
        return new Record(played, won, lost, r.tied(), r.drawn(), r.noResult(), decisive, ratio(won * 100, decisive, 1));
    }

    // ---- batting ----

    private static Batting batting(TeamStatsCounters c) {
        TeamStatsCounters.Innings own = c.own();
        boolean any = own.usable() > 0;
        return new Batting(
                any ? own.runs() : null,
                any ? own.wickets() : null,
                own.usable(),
                any ? ratio(own.runs(), own.usable(), 2) : null,
                any ? ratio(own.runs(), own.wickets(), 2) : null,
                ratio(own.runsWithBalls(), own.overs(), 2),
                any ? own.balls() : null,
                total(c.keys().highTotal(), false),
                total(c.keys().lowTotal(), true),
                new BattingCoverage(own.usable(), own.innings(), own.lowClassifiable()));
    }

    /** Decodes the highest or lowest total key (see {@code TeamStatsSql}); the lowest key stores the date inverted. */
    private static Total total(BigDecimal key, boolean inverted) {
        if (key == null) {
            return null;
        }
        BigInteger k = key.toBigIntegerExact();
        long runs = digits(k, 13, 12).longValue();
        long epoch = digits(k, 3, 10).longValue();
        boolean allOut = digits(k, 2, 1).longValue() == 1;
        long wickets = digits(k, 0, 2).longValue();
        return new Total(runs, wickets, allOut, Instant.ofEpochSecond(inverted ? 9_999_999_999L - epoch : epoch));
    }

    // ---- chasing and victories ----

    private static Chasing chasing(TeamStatsCounters.Keys keys) {
        Chase chase = null;
        if (keys.chase() != null) {
            BigInteger k = keys.chase().toBigIntegerExact();
            chase = new Chase(
                    digits(k, 21, 12).longValue(),
                    digits(k, 2, 9).longValue(),
                    digits(k, 0, 2).longValue(),
                    Instant.ofEpochSecond(digits(k, 11, 10).longValue()));
        }
        VictoryByRuns byRuns = null;
        if (keys.victoryByRuns() != null) {
            BigInteger k = keys.victoryByRuns().toBigIntegerExact();
            byRuns = new VictoryByRuns(digits(k, 10, 8).longValue(), Instant.ofEpochSecond(digits(k, 0, 10).longValue()));
        }
        VictoryByWickets byWickets = null;
        if (keys.victoryByWickets() != null) {
            BigInteger k = keys.victoryByWickets().toBigIntegerExact();
            long remainingPlusOne = digits(k, 10, 8).longValue();
            byWickets = new VictoryByWickets(
                    digits(k, 18, 4).longValue(),
                    remainingPlusOne == 0 ? null : remainingPlusOne - 1,
                    Instant.ofEpochSecond(digits(k, 0, 10).longValue()));
        }
        return new Chasing(chase, byRuns, byWickets);
    }

    /** The {@code width} decimal digits of {@code key} starting at 10^{@code shift}. */
    private static BigInteger digits(BigInteger key, int shift, int width) {
        return key.divide(TEN.pow(shift)).mod(TEN.pow(width));
    }

    // ---- bowling ----

    private static Bowling bowling(TeamStatsCounters c) {
        TeamStatsCounters.Innings opp = c.opposition();
        boolean any = opp.usable() > 0;
        return new Bowling(
                any ? opp.wickets() : null,
                any ? opp.runs() : null,
                any ? opp.balls() : null,
                any ? ratio(opp.runs(), opp.wickets(), 2) : null,
                ratio(opp.runsWithBalls(), opp.overs(), 2),
                new BowlingCoverage(opp.usable(), opp.innings()));
    }

    // ---- extras ----

    private static Extras extras(TeamStatsCounters c) {
        long counted = c.opposition().innings();
        TeamStatsCounters.Extras e = c.extras();
        return new Extras(
                e.total().innings() > 0 ? e.total().sum() : null,
                ratio(e.total().sum(), e.total().innings(), 2),
                figure(e.total(), counted),
                figure(e.wides(), counted),
                figure(e.noBalls(), counted),
                figure(e.byes(), counted),
                figure(e.legByes(), counted),
                figure(e.penalty(), counted));
    }

    private static ExtrasFigure figure(TeamStatsCounters.Component component, long counted) {
        return new ExtrasFigure(component.innings() > 0 ? component.sum() : null, component.innings(), counted);
    }

    // ---- net run rate ----

    private static NetRunRate netRunRate(TeamStatsCounters.NetRunRate n, long matchesCounted) {
        if (n.matches() == 0 || n.ownOvers().signum() <= 0 || n.oppOvers().signum() <= 0) {
            return new NetRunRate(NrrStatus.NO_USABLE_RESULTS, null, NRR_RULE, n.matches(), matchesCounted, null, null);
        }
        if (n.leagues() > 1 || n.seasons() > 1) {
            return new NetRunRate(NrrStatus.NOT_ONE_COMPETITION, null, NRR_RULE, n.matches(), matchesCounted, null, null);
        }
        return new NetRunRate(
                NrrStatus.SHOWN,
                nrrValue(n.ownRuns(), n.ownOvers(), n.oppRuns(), n.oppOvers()),
                NRR_RULE,
                n.matches(),
                matchesCounted,
                n.leagueId(),
                n.seasonId());
    }

    /**
     * Net Run Rate (116): the two run rates held to 40 decimals before their difference is rounded to 2 decimals, HALF_UP
     * once; null when either side has no overs. The page's Net run rate and the Dashboard's running values come from here.
     */
    public static BigDecimal nrrValue(long ownRuns, BigDecimal ownOvers, long oppRuns, BigDecimal oppOvers) {
        if (ownOvers == null || ownOvers.signum() <= 0 || oppOvers == null || oppOvers.signum() <= 0) {
            return null;
        }
        BigDecimal scored = BigDecimal.valueOf(ownRuns).divide(ownOvers, 40, RoundingMode.HALF_UP);
        BigDecimal conceded = BigDecimal.valueOf(oppRuns).divide(oppOvers, 40, RoundingMode.HALF_UP);
        return scored.subtract(conceded).setScale(2, RoundingMode.HALF_UP);
    }

    // ---- docs/specs/117-stats-dashboard.md: single-result definitions the Dashboard series call ----

    /** A run rate (116): runs per over to 2 decimals, HALF_UP once; null when there are no overs. */
    public static BigDecimal rate(long runs, BigDecimal overs) {
        return ratio(runs, overs, 2);
    }

    /** A dot-ball percentage (103): {@code dots / balls x 100} to 1 decimal, HALF_UP once; null without balls. */
    public static BigDecimal dotPercent(long dots, long balls) {
        return ratio(dots * 100, balls, 1);
    }

    /**
     * One innings' dot balls (spec 117): {@code ballsBowled} is the sum of our bowler rows' balls (null without bowler rows);
     * {@code dots} is their sum only when every bowler row that bowled a ball recorded dots ({@code rowsDotted} of {@code
     * rowsBowled}), else null (never a partial sum); {@code percent} is null when {@code dots} is null or no ball was bowled.
     */
    public record DotsPoint(Integer ballsBowled, Integer dots, BigDecimal percent) {
    }

    public static DotsPoint dotsForMatch(Long balls, Long dots, long rowsBowled, long rowsDotted) {
        Integer ballsBowled = balls == null ? null : Math.toIntExact(balls);
        boolean complete = dots != null && rowsDotted == rowsBowled;
        Integer recorded = complete ? Math.toIntExact(dots) : null;
        BigDecimal percent = complete && balls != null ? dotPercent(dots, balls) : null;
        return new DotsPoint(ballsBowled, recorded, percent);
    }

    /**
     * One innings' extras (spec 117): {@code itemised} when any component is recorded; {@code notItemised} is the stored
     * total of an innings that recorded a total but no component; {@code total} is the stored total (null: none recorded).
     */
    public record ExtrasPoint(boolean itemised, Long notItemised, Long total) {
    }

    public static ExtrasPoint extrasForMatch(Long total, Long wides, Long noBalls, Long byes, Long legByes, Long penaltyRuns) {
        boolean itemised = wides != null || noBalls != null || byes != null || legByes != null || penaltyRuns != null;
        // 101: with any component recorded the total is the sum of the recorded components
        Long effective = total;
        if (effective == null && itemised) {
            effective = 0L;
            for (Long component : new Long[] {wides, noBalls, byes, legByes, penaltyRuns}) {
                effective += component == null ? 0L : component;
            }
        }
        return new ExtrasPoint(itemised, !itemised && effective != null ? effective : null, effective);
    }

    // ---- division ----

    private static BigDecimal ratio(long numerator, long denominator, int scale) {
        return denominator <= 0
                ? null
                : BigDecimal.valueOf(numerator).divide(BigDecimal.valueOf(denominator), scale, RoundingMode.HALF_UP);
    }

    private static BigDecimal ratio(long numerator, BigDecimal denominator, int scale) {
        return denominator == null || denominator.signum() <= 0
                ? null
                : BigDecimal.valueOf(numerator).divide(denominator, scale, RoundingMode.HALF_UP);
    }
}
