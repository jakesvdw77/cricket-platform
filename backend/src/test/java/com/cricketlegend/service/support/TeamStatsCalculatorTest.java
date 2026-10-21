package com.cricketlegend.service.support;

import static com.cricketlegend.service.support.TeamStatsTestData.chaseKey;
import static com.cricketlegend.service.support.TeamStatsTestData.counters;
import static com.cricketlegend.service.support.TeamStatsTestData.highKey;
import static com.cricketlegend.service.support.TeamStatsTestData.lowKey;
import static com.cricketlegend.service.support.TeamStatsTestData.victoryRunsKey;
import static com.cricketlegend.service.support.TeamStatsTestData.victoryWicketsKey;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.service.support.TeamStatsCalculator.Figures;
import com.cricketlegend.service.support.TeamStatsCalculator.FormResult;
import com.cricketlegend.service.support.TeamStatsCalculator.NrrStatus;
import com.cricketlegend.service.support.TeamStatsTestData.Counters;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/116-team-stats.md, "Precise definitions": every team figure, from hand-built counters. The calculator only
 * turns additive counters into figures. Which innings is complete, which win is a successful chase, which result may feed
 * Net Run Rate, and which win has a comparable margin are decided by the SQL predicates (TeamStatsSql) before the counters
 * exist; those rules are pinned as text by TeamStatsSqlLiteralsTest and exercised against a real database by the
 * integration tier. What is tested here is everything the calculator itself defines: the formulas, the rounding, the
 * nulls, the coverage, the key decoding (and the ordering contract of the keys), Net Run Rate and the form mapping.
 */
class TeamStatsCalculatorTest {

    private static final long E1 = 1_760_000_000L;
    private static final long E2 = 1_760_086_400L; // one day later

    private static Figures calc(Counters c) {
        return TeamStatsCalculator.calculate(c.build());
    }

    private static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }

    // ---- record ----

    @Test
    void playedIsTheSumOfEveryCountedOutcome() {
        var record = calc(counters().record(5, 4, 2, 1, 3)).record();

        assertThat(record.won()).isEqualTo(5);
        assertThat(record.lost()).isEqualTo(4);
        assertThat(record.tied()).isEqualTo(2);
        assertThat(record.drawn()).isEqualTo(1);
        assertThat(record.noResult()).isEqualTo(3);
        assertThat(record.played()).isEqualTo(15);
        assertThat(record.decisive()).isEqualTo(9);
    }

    @Test
    void aTeamWithNoResultAtAllHasAnAllZeroRecordAndNoWinPercent() {
        var f = calc(counters());

        assertThat(f.record().played()).isZero();
        assertThat(f.record().winPercent()).isNull();
        assertThat(f.basis().resultsCounted()).isZero();
    }

    @Test
    void winPercentIsWinsOverWinsPlusLossesWithTiesDrawsAndNoResultsOutOfTheDenominator() {
        var record = calc(counters().record(2, 2, 5, 3, 1)).record();

        assertThat(record.winPercent()).isEqualByComparingTo("50.0");
        assertThat(record.played()).isEqualTo(13);
    }

    @Test
    void winPercentIsNullWithNoDecisiveResultNeverZero() {
        assertThat(calc(counters().record(0, 0, 3, 2, 1)).record().winPercent()).isNull();
    }

    @Test
    void winPercentIsOneHundredForAllWinsAndZeroForAllLosses() {
        assertThat(calc(counters().record(4, 0, 0, 0, 0)).record().winPercent()).isEqualByComparingTo("100.0");
        assertThat(calc(counters().record(0, 4, 0, 0, 0)).record().winPercent()).isEqualByComparingTo("0.0");
    }

    @Test
    void winPercentRoundsHalfUpOnceToOneDecimal() {
        // 1/16 = 6.25 exactly, 3/16 = 18.75 exactly, 1/32 = 3.125, 2/3 = 66.666...
        assertThat(calc(counters().record(1, 15, 0, 0, 0)).record().winPercent()).isEqualByComparingTo("6.3");
        assertThat(calc(counters().record(3, 13, 0, 0, 0)).record().winPercent()).isEqualByComparingTo("18.8");
        assertThat(calc(counters().record(1, 31, 0, 0, 0)).record().winPercent()).isEqualByComparingTo("3.1");
        var twoThirds = calc(counters().record(2, 1, 0, 0, 0)).record().winPercent();
        assertThat(twoThirds).isEqualByComparingTo("66.7");
        assertThat(twoThirds.scale()).isEqualTo(1);
    }

    @Test
    void aNoResultWithPlayAddsToPlayedAndToNoneOfWonLostTiedDrawn() {
        var record = calc(counters().record(0, 0, 0, 0, 1)).record();

        assertThat(record.played()).isEqualTo(1);
        assertThat(record.won() + record.lost() + record.tied() + record.drawn()).isZero();
        assertThat(record.winPercent()).isNull();
    }

    @Test
    void forfeitsReceivedAreWinsAndForfeitsConcededAreLossesInPlayedAndWinPercent() {
        var f = calc(counters().record(2, 1, 0, 0, 0).forfeits(1, 1));

        assertThat(f.record().won()).isEqualTo(3);
        assertThat(f.record().lost()).isEqualTo(2);
        assertThat(f.record().played()).isEqualTo(5);
        assertThat(f.record().decisive()).isEqualTo(5);
        assertThat(f.record().winPercent()).isEqualByComparingTo("60.0");
        assertThat(f.basis().forfeitsReceived()).isEqualTo(1);
        assertThat(f.basis().forfeitsConceded()).isEqualTo(1);
        assertThat(f.basis().resultsCounted()).isEqualTo(5);
    }

    @Test
    void aForfeitFeedsNoRunsWicketsAverageHighLowExtrasOrNetRunRateFigure() {
        // a team whose only counted result is a forfeit received: no innings counters exist for it
        var f = calc(counters().forfeits(1, 0));

        assertThat(f.record().played()).isEqualTo(1);
        assertThat(f.record().won()).isEqualTo(1);
        assertThat(f.record().winPercent()).isEqualByComparingTo("100.0");
        assertThat(f.batting().runs()).isNull();
        assertThat(f.batting().wicketsLost()).isNull();
        assertThat(f.batting().battingAverage()).isNull();
        assertThat(f.batting().runRate()).isNull();
        assertThat(f.batting().highestTotal()).isNull();
        assertThat(f.batting().lowestTotal()).isNull();
        assertThat(f.chasing().highestSuccessfulChase()).isNull();
        assertThat(f.chasing().largestVictoryByRuns()).isNull();
        assertThat(f.bowling().wicketsTaken()).isNull();
        assertThat(f.bowling().economy()).isNull();
        assertThat(f.extras().conceded()).isNull();
        assertThat(f.netRunRate().status()).isEqualTo(NrrStatus.NO_USABLE_RESULTS);
        assertThat(f.netRunRate().matchesCounted()).isZero();
    }

    @Test
    void aDerbyGivesOneTeamAWinAndTheOtherALossOrBothATie() {
        var winner = calc(counters().record(1, 0, 0, 0, 0)).record();
        var loser = calc(counters().record(0, 1, 0, 0, 0)).record();
        var tieA = calc(counters().record(0, 0, 1, 0, 0)).record();
        var tieB = calc(counters().record(0, 0, 1, 0, 0)).record();

        assertThat(winner.won()).isEqualTo(1);
        assertThat(loser.lost()).isEqualTo(1);
        assertThat(winner.played()).isEqualTo(loser.played()).isEqualTo(1);
        assertThat(tieA.tied()).isEqualTo(tieB.tied()).isEqualTo(1);
    }

    @Test
    void theBasisReportsWhatWasLeftOutAndTheInternalResults() {
        Counters c = counters().record(3, 0, 0, 0, 0);
        c.internal = 2;
        c.noBallBowled = 4;
        c.bothInnings = 3;

        var basis = calc(c).basis();

        assertThat(basis.resultsCounted()).isEqualTo(3);
        assertThat(basis.internalResults()).isEqualTo(2);
        assertThat(basis.resultsNoBallBowled()).isEqualTo(4);
        assertThat(basis.resultsWithBothInnings()).isEqualTo(3);
        assertThat(calc(c).record().played()).isEqualTo(3); // the no-ball results are not played
    }

    // ---- form line ----

    @Test
    void aWonResultReadsWonForTheWinningSideAndLostForTheOther() {
        assertThat(TeamStatsCalculator.formLine("WON", "HOME", "HOME").result()).isEqualTo(FormResult.WON);
        assertThat(TeamStatsCalculator.formLine("WON", "HOME", "AWAY").result()).isEqualTo(FormResult.LOST);
        assertThat(TeamStatsCalculator.formLine("WON", "AWAY", "AWAY").result()).isEqualTo(FormResult.WON);
        assertThat(TeamStatsCalculator.formLine("WON", "AWAY", "HOME").result()).isEqualTo(FormResult.LOST);
        assertThat(TeamStatsCalculator.formLine("WON", "HOME", "HOME").forfeit()).isFalse();
    }

    @Test
    void aForfeitReadsWonForTheReceiverAndLostForTheConcederBothFlagged() {
        var received = TeamStatsCalculator.formLine("FORFEIT", "AWAY", "AWAY");
        var conceded = TeamStatsCalculator.formLine("FORFEIT", "AWAY", "HOME");

        assertThat(received.result()).isEqualTo(FormResult.WON);
        assertThat(received.forfeit()).isTrue();
        assertThat(conceded.result()).isEqualTo(FormResult.LOST);
        assertThat(conceded.forfeit()).isTrue();
    }

    @Test
    void tieDrawAndNoResultOrAbandonedReadTheSameFromEitherSide() {
        for (String side : new String[] {"HOME", "AWAY"}) {
            assertThat(TeamStatsCalculator.formLine("TIE", null, side).result()).isEqualTo(FormResult.TIED);
            assertThat(TeamStatsCalculator.formLine("DRAW", null, side).result()).isEqualTo(FormResult.DRAWN);
            assertThat(TeamStatsCalculator.formLine("NO_RESULT", null, side).result()).isEqualTo(FormResult.NO_RESULT);
            assertThat(TeamStatsCalculator.formLine("ABANDONED", null, side).result()).isEqualTo(FormResult.NO_RESULT);
            assertThat(TeamStatsCalculator.formLine("TIE", null, side).forfeit()).isFalse();
        }
    }

    @Test
    void anOutcomeThatIsNeverCountedHasNoFormLine() {
        assertThatThrownBy(() -> TeamStatsCalculator.formLine("SOMETHING_ELSE", null, "HOME"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ---- batting ----

    @Test
    void runsWicketsAverageRunsPerInningsAndRunRateFromUsableInnings() {
        Counters c = counters().bat(3, 450, 12, 600, "100");
        c.ownInnings = 4; // a fourth innings is not usable (a blank runs, wickets or balls)

        var b = calc(c).batting();

        assertThat(b.runs()).isEqualTo(450);
        assertThat(b.wicketsLost()).isEqualTo(12);
        assertThat(b.innings()).isEqualTo(3);
        assertThat(b.runsPerInnings()).isEqualByComparingTo("150.00");
        assertThat(b.battingAverage()).isEqualByComparingTo("37.50");
        assertThat(b.runRate()).isEqualByComparingTo("4.50");
        assertThat(b.ballsFaced()).isEqualTo(600);
    }

    @Test
    void anInningsThatIsNotUsableIsCountedInCoverageAndNeverAsZero() {
        Counters c = counters().bat(2, 300, 10, 360, "60");
        c.ownInnings = 5;

        var coverage = calc(c).batting().coverage();

        assertThat(coverage.inningsUsable()).isEqualTo(2);
        assertThat(coverage.inningsCounted()).isEqualTo(5);
        assertThat(calc(c).batting().runsPerInnings()).isEqualByComparingTo("150.00"); // over 2, not over 5
    }

    @Test
    void withNoUsableInningsEveryBattingFigureIsNullNotZero() {
        Counters c = counters();
        c.ownInnings = 2;

        var b = calc(c).batting();

        assertThat(b.runs()).isNull();
        assertThat(b.wicketsLost()).isNull();
        assertThat(b.runsPerInnings()).isNull();
        assertThat(b.battingAverage()).isNull();
        assertThat(b.runRate()).isNull();
        assertThat(b.ballsFaced()).isNull();
        assertThat(b.coverage().inningsUsable()).isZero();
        assertThat(b.coverage().inningsCounted()).isEqualTo(2);
    }

    @Test
    void battingAverageIsNullAtZeroWicketsLostButRunsAndRateStay() {
        var b = calc(counters().bat(2, 200, 0, 240, "40")).batting();

        assertThat(b.battingAverage()).isNull();
        assertThat(b.wicketsLost()).isZero();
        assertThat(b.runsPerInnings()).isEqualByComparingTo("100.00");
        assertThat(b.runRate()).isEqualByComparingTo("5.00");
    }

    @Test
    void runRateAcrossFiveAndSixBallOversIsHandComputed() {
        // match A: 6-ball overs, 150 runs in 120 balls = 20 overs. match B: 5-ball overs, 90 runs in 75 balls = 15 overs.
        // (150 + 90) / (20 + 15) = 240 / 35 = 6.857142... -> 6.86
        var b = calc(counters().bat(2, 240, 14, 195, "35")).batting();

        assertThat(b.runRate()).isEqualByComparingTo("6.86");
    }

    @Test
    void anAllOutInningsCountsItsActualBallsInThePlainRunRate() {
        // 100 all out in 90 of 120 scheduled balls: 100 / 15 = 6.67, not the full-quota 100 / 20 = 5.00
        var b = calc(counters().bat(1, 100, 10, 90, "15")).batting();

        assertThat(b.runRate()).isEqualByComparingTo("6.67");
    }

    @Test
    void theRunRateUsesOnlyInningsWithBallsWhileRunsKeepAUsableInningsWithNoBalls() {
        Counters c = counters().bat(2, 130, 5, 120, "20");
        c.ownRunsWithBalls = 100; // the other usable innings (30 runs) recorded zero balls

        var b = calc(c).batting();

        assertThat(b.runs()).isEqualTo(130);
        assertThat(b.runRate()).isEqualByComparingTo("5.00");
    }

    @Test
    void ratesRoundHalfUpOnceAtTheEnd() {
        // 1 run in 8 overs = 0.125 exactly -> 0.13
        assertThat(calc(counters().bat(1, 1, 0, 48, "8")).batting().runRate()).isEqualByComparingTo("0.13");
        // 125 runs / 3 innings = 41.666... -> 41.67
        assertThat(calc(counters().bat(3, 125, 5, 100, "16.5")).batting().runsPerInnings()).isEqualByComparingTo("41.67");
    }

    @Test
    void zeroBallsGivesANullRunRate() {
        assertThat(calc(counters().bat(1, 50, 4, 0, "0")).batting().runRate()).isNull();
    }

    // ---- highest and lowest totals (decoded keys) ----

    @Test
    void theHighestTotalDecodesRunsWicketsAllOutAndDate() {
        Counters c = counters().bat(1, 212, 6, 120, "20");
        c.highTotalKey = highKey(212, 6, false, E1);

        var total = calc(c).batting().highestTotal();

        assertThat(total.runs()).isEqualTo(212);
        assertThat(total.wickets()).isEqualTo(6);
        assertThat(total.allOut()).isFalse();
        assertThat(total.matchDate()).isEqualTo(Instant.ofEpochSecond(E1));
    }

    @Test
    void anAllOutHighTotalDecodesTenWicketsAndTheFlag() {
        Counters c = counters();
        c.highTotalKey = highKey(99, 10, true, E1);

        var total = calc(c).batting().highestTotal();

        assertThat(total.allOut()).isTrue();
        assertThat(total.wickets()).isEqualTo(10);
        assertThat(total.runs()).isEqualTo(99);
    }

    @Test
    void aTotalOfZeroRunsDecodes() {
        Counters c = counters();
        c.highTotalKey = highKey(0, 10, true, E1);

        assertThat(calc(c).batting().highestTotal().runs()).isZero();
    }

    @Test
    void theHighestTotalIsNullWhenNoInningsQualified() {
        assertThat(calc(counters()).batting().highestTotal()).isNull();
        assertThat(calc(counters()).batting().lowestTotal()).isNull();
    }

    @Test
    void onEqualHighTotalsTheMoreRecentMatchWinsTheMaximumAndFewerRunsNeverBeatMore() {
        BigDecimal older = highKey(200, 5, false, E1);
        BigDecimal newer = highKey(200, 9, true, E2);
        BigDecimal higherButOlder = highKey(201, 5, false, E1);

        assertThat(older.max(newer)).isEqualTo(newer);
        assertThat(newer.max(higherButOlder)).isEqualTo(higherButOlder);

        Counters c = counters();
        c.highTotalKey = older.max(newer);
        assertThat(calc(c).batting().highestTotal().matchDate()).isEqualTo(Instant.ofEpochSecond(E2));
    }

    @Test
    void theLowestTotalDecodesWithTheInvertedDate() {
        Counters c = counters();
        c.lowTotalKey = lowKey(54, 10, true, E1);

        var total = calc(c).batting().lowestTotal();

        assertThat(total.runs()).isEqualTo(54);
        assertThat(total.allOut()).isTrue();
        assertThat(total.wickets()).isEqualTo(10);
        assertThat(total.matchDate()).isEqualTo(Instant.ofEpochSecond(E1));
    }

    @Test
    void onEqualLowTotalsTheMinimumPicksTheMoreRecentMatchAndFewerRunsAlwaysWin() {
        BigDecimal older = lowKey(80, 10, true, E1);
        BigDecimal newer = lowKey(80, 10, true, E2);
        BigDecimal lowerButOlder = lowKey(79, 10, true, E1);

        assertThat(older.min(newer)).isEqualTo(newer);
        assertThat(newer.min(lowerButOlder)).isEqualTo(lowerButOlder);
    }

    @Test
    void theLowestTotalCoverageReportsHowManyInningsWereClassifiable() {
        Counters c = counters().bat(4, 400, 20, 480, "80");
        c.highLowInnings = 4;
        c.lowClassifiable = 3;

        var coverage = calc(c).batting().coverage();

        assertThat(coverage.inningsClassifiable()).isEqualTo(3);
    }

    // ---- highest successful chase, largest victories (decoded keys) ----

    @Test
    void theHighestSuccessfulChaseDecodesRunsTargetWicketsAndDate() {
        Counters c = counters();
        c.chaseKey = chaseKey(181, 180, 4, E1);

        var chase = calc(c).chasing().highestSuccessfulChase();

        assertThat(chase.runs()).isEqualTo(181);
        assertThat(chase.target()).isEqualTo(180);
        assertThat(chase.wickets()).isEqualTo(4);
        assertThat(chase.matchDate()).isEqualTo(Instant.ofEpochSecond(E1));
    }

    @Test
    void theHighestOfSeveralChasesWinsTheMaximumKey() {
        BigDecimal small = chaseKey(120, 119, 3, E2);
        BigDecimal big = chaseKey(240, 239, 8, E1);

        assertThat(small.max(big)).isEqualTo(big);
        Counters c = counters();
        c.chaseKey = small.max(big);
        assertThat(calc(c).chasing().highestSuccessfulChase().runs()).isEqualTo(240);
    }

    @Test
    void largestVictoryByRunsDecodesMarginAndDate() {
        Counters c = counters();
        c.victoryRunsKey = victoryRunsKey(112, E1);

        var victory = calc(c).chasing().largestVictoryByRuns();

        assertThat(victory.margin()).isEqualTo(112);
        assertThat(victory.matchDate()).isEqualTo(Instant.ofEpochSecond(E1));
    }

    @Test
    void equalRunMarginsAreBrokenByTheMoreRecentMatchAndALargerMarginAlwaysWins() {
        BigDecimal older = victoryRunsKey(50, E1);
        BigDecimal newer = victoryRunsKey(50, E2);
        BigDecimal largerButOlder = victoryRunsKey(51, E1);

        assertThat(older.max(newer)).isEqualTo(newer);
        assertThat(newer.max(largerButOlder)).isEqualTo(largerButOlder);
    }

    @Test
    void largestVictoryByWicketsDecodesMarginBallsRemainingAndDate() {
        Counters c = counters();
        c.victoryWicketsKey = victoryWicketsKey(10, 42L, E1);

        var victory = calc(c).chasing().largestVictoryByWickets();

        assertThat(victory.margin()).isEqualTo(10);
        assertThat(victory.ballsRemaining()).isEqualTo(42);
        assertThat(victory.matchDate()).isEqualTo(Instant.ofEpochSecond(E1));
    }

    @Test
    void ballsRemainingZeroIsKnownAndDistinctFromUnknown() {
        Counters exactlyOnTheLastBall = counters();
        exactlyOnTheLastBall.victoryWicketsKey = victoryWicketsKey(3, 0L, E1);
        Counters unknown = counters();
        unknown.victoryWicketsKey = victoryWicketsKey(3, null, E1);

        assertThat(calc(exactlyOnTheLastBall).chasing().largestVictoryByWickets().ballsRemaining()).isZero();
        assertThat(calc(unknown).chasing().largestVictoryByWickets().ballsRemaining()).isNull();
    }

    @Test
    void equalWicketMarginsAreBrokenByMostBallsRemainingThenTheMoreRecentMatch() {
        BigDecimal fewerBalls = victoryWicketsKey(8, 10L, E2);
        BigDecimal moreBallsOlder = victoryWicketsKey(8, 30L, E1);
        BigDecimal moreBallsNewer = victoryWicketsKey(8, 30L, E2);
        BigDecimal biggerMargin = victoryWicketsKey(9, 0L, E1);
        BigDecimal unknownBalls = victoryWicketsKey(8, null, E2);

        assertThat(fewerBalls.max(moreBallsOlder)).isEqualTo(moreBallsOlder);
        assertThat(moreBallsOlder.max(moreBallsNewer)).isEqualTo(moreBallsNewer);
        assertThat(moreBallsNewer.max(biggerMargin)).isEqualTo(biggerMargin);
        assertThat(unknownBalls.max(fewerBalls)).isEqualTo(fewerBalls); // a known balls-remaining beats an unknown one
    }

    @Test
    void withNoQualifyingWinNoVictoryOrChaseIsReported() {
        var chasing = calc(counters().record(3, 0, 0, 0, 0)).chasing();

        assertThat(chasing.highestSuccessfulChase()).isNull();
        assertThat(chasing.largestVictoryByRuns()).isNull();
        assertThat(chasing.largestVictoryByWickets()).isNull();
    }

    // ---- bowling ----

    @Test
    void wicketsTakenRunsConcededAverageAndEconomy() {
        var b = calc(counters().bowl(4, 520, 26, 480, "80")).bowling();

        assertThat(b.wicketsTaken()).isEqualTo(26);
        assertThat(b.runsConceded()).isEqualTo(520);
        assertThat(b.ballsBowled()).isEqualTo(480);
        assertThat(b.bowlingAverage()).isEqualByComparingTo("20.00");
        assertThat(b.economy()).isEqualByComparingTo("6.50");
        assertThat(b.coverage().inningsUsable()).isEqualTo(4);
    }

    @Test
    void wicketsTakenAreTheOppositionsWicketsSoRunOutsCountWhereverNoBowlerIsCredited() {
        // the counter is the opposition innings' stored wickets (a team figure, not bowler-credited): 10 dismissals
        // of which 2 were run-outs still make 10 wickets taken
        var b = calc(counters().bowl(1, 150, 10, 120, "20")).bowling();

        assertThat(b.wicketsTaken()).isEqualTo(10);
    }

    @Test
    void bowlingAverageIsNullAtZeroWicketsTakenAndEconomyStays() {
        var b = calc(counters().bowl(2, 200, 0, 240, "40")).bowling();

        assertThat(b.wicketsTaken()).isZero();
        assertThat(b.bowlingAverage()).isNull();
        assertThat(b.economy()).isEqualByComparingTo("5.00");
    }

    @Test
    void economyWithUnequalBallsPerOverIsHandComputed() {
        // A: 6-ball overs, 100 runs in 120 balls = 20 overs. B: 8-ball overs, 72 runs in 96 balls = 12 overs.
        // 172 / 32 = 5.375 -> 5.38
        var b = calc(counters().bowl(2, 172, 12, 216, "32")).bowling();

        assertThat(b.economy()).isEqualByComparingTo("5.38");
    }

    @Test
    void economyIsNullWithNoBallsAndEveryBowlingFigureNullWithNoUsableInnings() {
        assertThat(calc(counters().bowl(1, 50, 3, 0, "0")).bowling().economy()).isNull();

        Counters none = counters();
        none.oppInnings = 3;
        var b = calc(none).bowling();
        assertThat(b.wicketsTaken()).isNull();
        assertThat(b.runsConceded()).isNull();
        assertThat(b.ballsBowled()).isNull();
        assertThat(b.bowlingAverage()).isNull();
        assertThat(b.economy()).isNull();
        assertThat(b.coverage().inningsUsable()).isZero();
        assertThat(b.coverage().inningsCounted()).isEqualTo(3);
    }

    // ---- extras ----

    @Test
    void extrasConcededAndAveragePerMatchAreOverTheInningsThatRecordedThem() {
        Counters c = counters().bowl(4, 400, 20, 480, "80");
        c.extrasTotal = new TeamStatsCounters.Component(3, 45); // one of four innings is summary level (extras null)

        var e = calc(c).extras();

        assertThat(e.conceded()).isEqualTo(45);
        assertThat(e.averagePerMatch()).isEqualByComparingTo("15.00"); // 45 / 3, not 45 / 4
        assertThat(e.total().inningsRecorded()).isEqualTo(3);
        assertThat(e.total().inningsCounted()).isEqualTo(4);
    }

    @Test
    void extrasAreNullNotZeroWhenNoInningsRecordedThem() {
        Counters c = counters().bowl(2, 200, 8, 240, "40");

        var e = calc(c).extras();

        assertThat(e.conceded()).isNull();
        assertThat(e.averagePerMatch()).isNull();
        assertThat(e.wides().value()).isNull();
        assertThat(e.wides().inningsRecorded()).isZero();
        assertThat(e.wides().inningsCounted()).isEqualTo(2);
    }

    @Test
    void eachExtrasComponentHasItsOwnValueAndCoverage() {
        Counters c = counters().bowl(5, 500, 20, 600, "100");
        c.extrasTotal = new TeamStatsCounters.Component(5, 60);
        c.wides = new TeamStatsCounters.Component(4, 25);
        c.noBalls = new TeamStatsCounters.Component(3, 7);
        c.byes = new TeamStatsCounters.Component(2, 9);
        c.legByes = new TeamStatsCounters.Component(1, 4);
        c.penalty = new TeamStatsCounters.Component(0, 0);

        var e = calc(c).extras();

        assertThat(e.wides().value()).isEqualTo(25);
        assertThat(e.wides().inningsRecorded()).isEqualTo(4);
        assertThat(e.noBalls().value()).isEqualTo(7);
        assertThat(e.noBalls().inningsRecorded()).isEqualTo(3);
        assertThat(e.byes().value()).isEqualTo(9);
        assertThat(e.byes().inningsRecorded()).isEqualTo(2);
        assertThat(e.legByes().value()).isEqualTo(4);
        assertThat(e.legByes().inningsRecorded()).isEqualTo(1);
        assertThat(e.penaltyRuns().value()).isNull();
        assertThat(e.penaltyRuns().inningsRecorded()).isZero();
        assertThat(e.penaltyRuns().inningsCounted()).isEqualTo(5);
        assertThat(e.averagePerMatch()).isEqualByComparingTo("12.00");
    }

    // ---- net run rate ----

    @Test
    void netRunRateOnAHandComputedThreeMatchTable() {
        // M1: own 150 in 20.0 ov (all out at the 20-over quota counts 20); opp 120 in 20.0 (all out, quota).
        // M2: own 100 in 20.0 (all out at the 5-ball quota: 100 balls / 5 = 20); opp 101 in 15.0 (chased in 75 balls / 5).
        // M3: own 180 in 20.0; opp 160 in 20.0 (all out, quota).
        // own 430 / 60 = 7.16666..., opp 381 / 55 = 6.92727... ; difference 0.23939... -> 0.24
        Counters c = counters().record(2, 1, 0, 0, 0).nrr(3, 430, "60", 381, "55", 1, 1);

        var n = calc(c).netRunRate();

        assertThat(n.status()).isEqualTo(NrrStatus.SHOWN);
        assertThat(n.value()).isEqualByComparingTo("0.24");
        assertThat(n.value().scale()).isEqualTo(2);
        assertThat(n.rule()).isEqualTo("FULL_QUOTA");
        assertThat(n.matchesUsed()).isEqualTo(3);
        assertThat(n.matchesCounted()).isEqualTo(3);
        assertThat(n.leagueId()).isNotNull();
        assertThat(n.seasonId()).isNotNull();
    }

    @Test
    void aNegativeNetRunRateKeepsItsSign() {
        var n = calc(counters().record(0, 3, 0, 0, 0).nrr(3, 381, "55", 430, "60", 1, 1)).netRunRate();

        assertThat(n.value()).isEqualByComparingTo("-0.24");
    }

    @Test
    void anExactlyZeroNetRunRateIsShownAsZeroNotMissing() {
        var n = calc(counters().record(1, 1, 0, 0, 0).nrr(2, 300, "50", 300, "50", 1, 1)).netRunRate();

        assertThat(n.status()).isEqualTo(NrrStatus.SHOWN);
        assertThat(n.value()).isEqualByComparingTo("0.00");
        assertThat(n.value().signum()).isZero();
    }

    @Test
    void netRunRateRoundsHalfUpOnceAtTheEndNotRateByRate() {
        // own 49 / 8 = 6.125 and opp 48004 / 8000 = 6.0005: true difference 0.1245 -> 0.12.
        // Rounding each rate to 2 decimals first (6.13 - 6.00) would wrongly give 0.13.
        var n = calc(counters().record(1, 0, 0, 0, 0).nrr(1, 49, "8", 48004, "8000", 1, 1)).netRunRate();

        assertThat(n.value()).isEqualByComparingTo("0.12");
    }

    @Test
    void aNegativeHalfRoundsAwayFromZero() {
        // own 48 / 8 = 6.000, opp 49 / 8 = 6.125 -> -0.125 -> -0.13 (HALF_UP)
        var n = calc(counters().record(0, 1, 0, 0, 0).nrr(1, 48, "8", 49, "8", 1, 1)).netRunRate();

        assertThat(n.value()).isEqualByComparingTo("-0.13");
    }

    @Test
    void aPositiveHalfRoundsUp() {
        // own 49 / 8 = 6.125, opp 48 / 8 = 6.000 -> +0.125 -> 0.13
        var n = calc(counters().record(1, 0, 0, 0, 0).nrr(1, 49, "8", 48, "8", 1, 1)).netRunRate();

        assertThat(n.value()).isEqualByComparingTo("0.13");
    }

    @Test
    void netRunRateIsTwoDecimalsEvenForANiceNumber() {
        var n = calc(counters().record(1, 0, 0, 0, 0).nrr(1, 120, "20", 100, "20", 1, 1)).netRunRate();

        assertThat(n.value()).isEqualByComparingTo("1.00");
        assertThat(n.value().scale()).isEqualTo(2);
    }

    @Test
    void withNoUsableResultTheStatusSaysSoAndThereIsNoValue() {
        var n = calc(counters().record(2, 0, 0, 1, 0)).netRunRate();

        assertThat(n.status()).isEqualTo(NrrStatus.NO_USABLE_RESULTS);
        assertThat(n.value()).isNull();
        assertThat(n.matchesUsed()).isZero();
        assertThat(n.matchesCounted()).isEqualTo(3);
        assertThat(n.rule()).isEqualTo("FULL_QUOTA");
    }

    @Test
    void zeroOversOnEitherSideIsNoUsableResultNotADivisionByZero() {
        assertThat(calc(counters().record(1, 0, 0, 0, 0).nrr(1, 10, "0", 5, "10", 1, 1)).netRunRate().status())
                .isEqualTo(NrrStatus.NO_USABLE_RESULTS);
        assertThat(calc(counters().record(1, 0, 0, 0, 0).nrr(1, 10, "10", 5, "0", 1, 1)).netRunRate().value())
                .isNull();
    }

    @Test
    void moreThanOneLeagueOrSeasonIsNotOneCompetitionAndHasNoValue() {
        var twoLeagues = calc(counters().record(3, 0, 0, 0, 0).nrr(3, 400, "60", 300, "60", 2, 1)).netRunRate();
        var twoSeasons = calc(counters().record(3, 0, 0, 0, 0).nrr(3, 400, "60", 300, "60", 1, 2)).netRunRate();

        assertThat(twoLeagues.status()).isEqualTo(NrrStatus.NOT_ONE_COMPETITION);
        assertThat(twoLeagues.value()).isNull();
        assertThat(twoLeagues.matchesUsed()).isEqualTo(3);
        assertThat(twoSeasons.status()).isEqualTo(NrrStatus.NOT_ONE_COMPETITION);
        assertThat(twoSeasons.value()).isNull();
        assertThat(twoSeasons.leagueId()).isNull();
    }

    @Test
    void matchesUsedIsOutOfTheCountedResultsExcludingForfeitsWhichHaveNoInnings() {
        // 6 counted rows: 2 forfeits (no innings), 1 draw and 1 no result excluded by the SQL, 2 usable results
        Counters c = counters().record(2, 0, 0, 1, 1).forfeits(1, 1).nrr(2, 300, "40", 250, "40", 1, 1);

        var n = calc(c).netRunRate();

        assertThat(c.build().results().results()).isEqualTo(6);
        assertThat(n.matchesUsed()).isEqualTo(2);
        assertThat(n.matchesCounted()).isEqualTo(4);
    }

    @Test
    void theNetRunRateCarriesTheLeagueAndSeasonOfTheUsableResults() {
        UUID league = UUID.randomUUID();
        UUID season = UUID.randomUUID();
        Counters c = counters().record(1, 0, 0, 0, 0).nrr(1, 120, "20", 100, "20", 1, 1);
        c.nrrLeagueId = league;
        c.nrrSeasonId = season;

        var n = calc(c).netRunRate();

        assertThat(n.leagueId()).isEqualTo(league);
        assertThat(n.seasonId()).isEqualTo(season);
    }

    // ---- not captured ----

    @Test
    void theNotCapturedCatalogueHoldsPartnershipsOnly() {
        var list = calc(counters()).notCaptured();

        assertThat(list).hasSize(1);
        assertThat(list.get(0).code()).isEqualTo("PARTNERSHIPS");
        assertThat(list.get(0).label()).containsIgnoringCase("partnerships");
        assertThat(list.get(0).reason()).isNotBlank();
        assertThat(TeamStatsCalculator.NOT_CAPTURED).isSameAs(list);
    }
}
