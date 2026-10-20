package com.cricketlegend.service.support;

import java.math.BigDecimal;
import java.util.List;

/**
 * docs/specs/103-player-stats.md, "Shape of the read": one player's additive counters, summed and counted from stored
 * columns by the aggregate query and never derived there. {@link PlayerStatsCalculator} is the only place a figure is
 * defined from these. The two {@code *Key} fields are the encoded maxima the spec describes (highest score
 * {@code runs * 2 + (not out ? 1 : 0)}; best bowling {@code wickets * 10^10 + (99999 - runs) * 10^5 + balls}), null when
 * there was no such innings.
 */
public record PlayerStatsCounters(
        long matches,
        long resultsWithBattingCard,
        long resultsWithBowlingCard,
        Batting batting,
        Bowling bowling,
        Fielding fielding,
        Awards awards,
        Record record) {

    public static final PlayerStatsCounters EMPTY = new PlayerStatsCounters(
            0,
            0,
            0,
            new Batting(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null),
            new Bowling(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, BigDecimal.ZERO, List.of(), 0, 0, 0, null),
            new Fielding(0, 0, 0),
            new Awards(0, 0),
            new Record(0, 0, 0, 0, 0));

    /**
     * {@code inningsWithBalls}/{@code runsWithBalls}: innings that recorded balls (a 0-ball innings with runs counts
     * as not recorded) and their runs. {@code boundary*}: innings where both fours and sixes were recorded.
     * {@code ballsForBoundaries}/{@code boundaryCount}: balls and fours plus sixes of innings that recorded all three.
     */
    public record Batting(
            long innings,
            long notOuts,
            long dismissals,
            long runs,
            long ballsFaced,
            long inningsWithBalls,
            long runsWithBalls,
            long fours,
            long sixes,
            long inningsWithBoundaries,
            long boundaryRuns,
            long runsWithBoundaries,
            long ballsForBoundaries,
            long boundaryCount,
            long ducks,
            long goldenDucks,
            long thirtyPlus,
            long fiftyPlus,
            long hundredPlus,
            long centuries,
            long halfCenturies,
            Long highestScoreKey) {
    }

    /**
     * {@code overs} is the sum over bowling rows of balls divided by that match's balls per over;
     * {@code ballsPerOver} the distinct over lengths among rows that bowled a ball.
     */
    public record Bowling(
            long inningsBowled,
            long balls,
            long runs,
            long wickets,
            long maidens,
            long wides,
            long noBalls,
            long dots,
            long inningsWithWides,
            long inningsWithNoBalls,
            long inningsWithDots,
            long ballsWithDots,
            BigDecimal overs,
            List<Integer> ballsPerOver,
            long threeWicketHauls,
            long fourWicketHauls,
            long fiveWicketHauls,
            Long bestBowlingKey) {
    }

    public record Fielding(long catches, long stumpings, long runOuts) {
    }

    public record Awards(long playerOfTheMatch, long teamPlayerOfTheMatch) {
    }

    public record Record(long won, long lost, long tied, long drawn, long internal) {
    }
}
