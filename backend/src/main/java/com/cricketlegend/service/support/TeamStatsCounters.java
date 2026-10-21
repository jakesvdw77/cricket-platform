package com.cricketlegend.service.support;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * docs/specs/116-team-stats.md, "SQL approach" point 3: one team's additive counters, summed and counted from stored columns
 * by the aggregate query and never derived there. {@link TeamStatsCalculator} is the only place a figure is defined from
 * these. The {@link Keys} are the encoded maxima and minima documented on {@code TeamStatsSql} (null when there was no such
 * innings or result); only the calculator decodes them. Pure: no Spring, no repository, no entity.
 */
public record TeamStatsCounters(
        Results results,
        Innings own,
        Innings opposition,
        Extras extras,
        Keys keys,
        NetRunRate netRunRate,
        long resultsWithBothInnings) {

    public static final TeamStatsCounters EMPTY = new TeamStatsCounters(
            new Results(0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
            new Innings(0, 0, 0, 0, 0, 0, BigDecimal.ZERO, 0, 0),
            new Innings(0, 0, 0, 0, 0, 0, BigDecimal.ZERO, 0, 0),
            new Extras(
                    new Component(0, 0),
                    new Component(0, 0),
                    new Component(0, 0),
                    new Component(0, 0),
                    new Component(0, 0),
                    new Component(0, 0)),
            new Keys(null, null, null, null, null),
            new NetRunRate(0, 0, 0, BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, null, null),
            0);

    /**
     * Counted team results by outcome from this team's side. {@code won} and {@code lost} are WON outcomes only; a forfeit
     * is in {@code forfeitsReceived} (a win) or {@code forfeitsConceded} (a loss) and the calculator adds them to the
     * record. {@code noBallBowled}: NO_RESULT or ABANDONED results left out for want of a ball (not in {@code results}).
     */
    public record Results(
            long results,
            long won,
            long lost,
            long tied,
            long drawn,
            long noResult,
            long forfeitsReceived,
            long forfeitsConceded,
            long internal,
            long noBallBowled) {
    }

    /**
     * The regular innings of one side of the counted non-forfeit results. {@code innings}: all of them; {@code usable}:
     * those with runs, wickets and balls recorded, which alone feed {@code runs}, {@code wickets}, {@code balls},
     * {@code runsWithBalls} (usable innings with balls above zero) and {@code overs} (their balls over balls per over).
     * {@code highLowInnings}: usable innings of WON, TIE or DRAW results; {@code lowClassifiable}: of those, innings whose
     * completeness can be decided (own side only).
     */
    public record Innings(
            long innings,
            long usable,
            long runs,
            long wickets,
            long balls,
            long runsWithBalls,
            BigDecimal overs,
            long highLowInnings,
            long lowClassifiable) {
    }

    /** The opposition's extras: the sum over innings that recorded each figure and how many innings recorded it. */
    public record Extras(
            Component total, Component wides, Component noBalls, Component byes, Component legByes, Component penalty) {
    }

    /** {@code innings}: opposition innings that recorded the figure; {@code sum}: their total. */
    public record Component(long innings, long sum) {
    }

    /** The encoded maxima and minima (see {@code TeamStatsSql}): highest and lowest total, chase, largest victories. */
    public record Keys(
            BigDecimal highTotal,
            BigDecimal lowTotal,
            BigDecimal chase,
            BigDecimal victoryByRuns,
            BigDecimal victoryByWickets) {
    }

    /** Sums over the Net Run Rate usable results only; {@code leagueId}/{@code seasonId} are one of those results'. */
    public record NetRunRate(
            long matches,
            long ownRuns,
            long oppRuns,
            BigDecimal ownOvers,
            BigDecimal oppOvers,
            long leagues,
            long seasons,
            UUID leagueId,
            UUID seasonId) {
    }
}
