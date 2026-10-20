package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.dto.PlayerStatsDto.PlayerBatting;
import com.cricketlegend.dto.PlayerStatsDto.PlayerBowling;
import com.cricketlegend.dto.PlayerStatsDto.PlayerNotCaptured;
import com.cricketlegend.service.support.PlayerStatsFacts.InningsFact;
import com.cricketlegend.service.support.PlayerStatsFacts.PositionFact;
import com.cricketlegend.service.support.PlayerStatsFacts.SpellFact;
import com.cricketlegend.service.support.PlayerStatsTestData.Counters;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/103-player-stats.md, "Precise definitions" and "Card captured, partial figures": every derived figure comes
 * from the additive counters through {@link PlayerStatsCalculator} alone. The classification of single innings (what is
 * an innings, a duck, a 50, a 5-wicket band) happens in the aggregate query and is covered by the repository integration
 * test; here the counters stand for already-classified innings and the tests pin what the calculator does with them.
 */
class PlayerStatsCalculatorTest {

    private static PlayerBatting batting(Counters c) {
        return PlayerStatsCalculator.calculate(c.build(), PlayerStatsFacts.EMPTY).batting();
    }

    private static PlayerBowling bowling(Counters c) {
        return PlayerStatsCalculator.calculate(c.build(), PlayerStatsFacts.EMPTY).bowling();
    }

    private static PlayerStatsCalculator.Figures figures(Counters c, PlayerStatsFacts facts) {
        return PlayerStatsCalculator.calculate(c.build(), facts);
    }

    private static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }

    // ---- nothing played ----

    @Test
    void aPlayerWithNoDataHasNullRatesNotZeroInfinityOrNaN() {
        var f = PlayerStatsCalculator.calculate(PlayerStatsCounters.EMPTY, PlayerStatsFacts.EMPTY);

        assertThat(f.batting().innings()).isZero();
        assertThat(f.batting().average()).isNull();
        assertThat(f.batting().strikeRate()).isNull();
        assertThat(f.batting().boundaryPercentage()).isNull();
        assertThat(f.batting().ballsPerBoundary()).isNull();
        assertThat(f.batting().highestScore()).isNull();
        assertThat(f.bowling().average()).isNull();
        assertThat(f.bowling().economy()).isNull();
        assertThat(f.bowling().strikeRate()).isNull();
        assertThat(f.bowling().dotBallPercentage()).isNull();
        assertThat(f.bowling().best()).isNull();
        assertThat(f.bowling().mixedOverLengths()).isFalse();
        assertThat(f.bowling().dismissalsNotRecorded()).isZero();
        assertThat(f.fielding().dismissalsPerMatch()).isNull();
    }

    @Test
    void basisCarriesMatchesAndTheCardCounts() {
        Counters c = PlayerStatsTestData.counters().matches(7);
        c.resultsWithBattingCard = 5;
        c.resultsWithBowlingCard = 3;

        var basis = figures(c, PlayerStatsFacts.EMPTY).basis();

        assertThat(basis.matchesCounted()).isEqualTo(7);
        assertThat(basis.resultsWithBattingCard()).isEqualTo(5);
        assertThat(basis.resultsWithBowlingCard()).isEqualTo(3);
    }

    // ---- batting: innings, dismissals, not outs, average ----

    @Test
    void inningsAreDismissalsPlusNotOuts() {
        // 5 innings: 3 dismissals (retired out counts as one), 2 not outs (retired not out counts as one)
        PlayerBatting b = batting(PlayerStatsTestData.counters().matches(5).bat(5, 3, 120));

        assertThat(b.innings()).isEqualTo(5);
        assertThat(b.dismissals()).isEqualTo(3);
        assertThat(b.notOuts()).isEqualTo(2);
        assertThat(b.innings()).isEqualTo(b.dismissals() + b.notOuts());
    }

    @Test
    void averageIsNullWithZeroDismissalsNeverInfinity() {
        PlayerBatting b = batting(PlayerStatsTestData.counters().bat(4, 0, 200));

        assertThat(b.average()).isNull();
        assertThat(b.notOuts()).isEqualTo(4);
    }

    @Test
    void averageIsRunsPerDismissalToTwoDecimalsHalfUp() {
        assertThat(batting(PlayerStatsTestData.counters().bat(3, 3, 100)).average()).isEqualByComparingTo("33.33");
        // 1 / 8 = 0.125 rounds half up to 0.13
        assertThat(batting(PlayerStatsTestData.counters().bat(8, 8, 1)).average()).isEqualByComparingTo("0.13");
        assertThat(batting(PlayerStatsTestData.counters().bat(8, 8, 1)).average().scale()).isEqualTo(2);
    }

    @Test
    void anAverageOfZeroRunsWithADismissalIsZeroNotNull() {
        assertThat(batting(PlayerStatsTestData.counters().bat(1, 1, 0)).average()).isEqualByComparingTo("0.00");
    }

    // ---- batting: highest score ----

    @Test
    void highestScoreKeyDecodesRunsAndStar() {
        PlayerBatting b = batting(PlayerStatsTestData.counters().bat(2, 1, 100).highest(87, true));

        assertThat(b.highestScore().runs()).isEqualTo(87);
        assertThat(b.highestScore().notOut()).isTrue();
    }

    @Test
    void anOutHighestScoreHasNoStar() {
        PlayerBatting b = batting(PlayerStatsTestData.counters().bat(2, 2, 100).highest(87, false));

        assertThat(b.highestScore().notOut()).isFalse();
    }

    @Test
    void aFiftyNotOutIsHigherThanAFiftyOutButBelowFiftyOne() {
        assertThat(PlayerStatsCalculator.highestScoreKey(50, true))
                .isGreaterThan(PlayerStatsCalculator.highestScoreKey(50, false));
        assertThat(PlayerStatsCalculator.highestScoreKey(51, false))
                .isGreaterThan(PlayerStatsCalculator.highestScoreKey(50, true));
        PlayerBatting b = batting(PlayerStatsTestData.counters().bat(2, 1, 100).highest(50, true));
        assertThat(b.highestScore().runs()).isEqualTo(50);
        assertThat(b.highestScore().notOut()).isTrue();
    }

    @Test
    void aZeroHighestScoreIsStillAScore() {
        PlayerBatting b = batting(PlayerStatsTestData.counters().bat(1, 1, 0).highest(0, false));

        assertThat(b.highestScore().runs()).isZero();
        assertThat(b.highestScore().notOut()).isFalse();
    }

    // ---- batting: milestones and ducks (counters are classified by the aggregate query) ----

    @Test
    void milestoneCountersAreInclusiveAndCenturiesAreExclusiveOfHalfCenturies() {
        // innings of 29, 30, 49, 50, 99, 100: 30+ = 5, 50+ = 3 (the century included), 100+ = 1 = centuries,
        // half-centuries (50 to 99) = 2
        Counters c = PlayerStatsTestData.counters().bat(6, 6, 357).milestones(5, 3, 1);
        c.centuries = 1;
        c.halfCenturies = 2;

        PlayerBatting b = batting(c);

        assertThat(b.thirtyPlus()).isEqualTo(5);
        assertThat(b.fiftyPlus()).isEqualTo(3);
        assertThat(b.hundredPlus()).isEqualTo(1);
        assertThat(b.centuries()).isEqualTo(b.hundredPlus());
        assertThat(b.halfCenturies()).isEqualTo(2);
        assertThat(b.fiftyPlus()).isEqualTo(b.halfCenturies() + b.centuries());
    }

    @Test
    void ducksAndGoldenDucksPassThroughAndGoldenIsNeverMoreThanDucks() {
        // a duck, a golden duck (1 ball), a duck with unknown balls (not golden), a retired out on 0 (not a duck)
        Counters c = PlayerStatsTestData.counters().bat(4, 4, 0);
        c.ducks = 3;
        c.goldenDucks = 1;

        PlayerBatting b = batting(c);

        assertThat(b.ducks()).isEqualTo(3);
        assertThat(b.goldenDucks()).isEqualTo(1);
        assertThat(b.goldenDucks()).isLessThanOrEqualTo(b.ducks());
    }

    // ---- batting: strike rate and coverage ----

    @Test
    void strikeRateUsesOnlyInningsThatRecordedBalls() {
        // 3 innings, 160 runs; only 2 recorded balls: 60 runs off 50 balls. The 100 runs without balls never inflate it.
        Counters c = PlayerStatsTestData.counters().bat(3, 3, 160).ballsOn(2, 60, 50);

        PlayerBatting b = batting(c);

        assertThat(b.strikeRate()).isEqualByComparingTo("120.00");
        assertThat(b.ballsFaced()).isEqualTo(50);
        assertThat(b.coverage().inningsWithBalls()).isEqualTo(2);
        assertThat(b.coverage().inningsCounted()).isEqualTo(3);
    }

    @Test
    void strikeRateIsNullWhenNoBallsWereRecordedIncludingTheZeroBallsWithRunsCase() {
        // an innings of 40 with balls = 0 is treated as balls not recorded: no innings with balls, no balls faced
        PlayerBatting b = batting(PlayerStatsTestData.counters().bat(1, 1, 40).ballsOn(0, 0, 0));

        assertThat(b.strikeRate()).isNull();
        assertThat(b.ballsFaced()).isZero();
        assertThat(b.coverage().inningsWithBalls()).isZero();
        assertThat(b.coverage().inningsCounted()).isEqualTo(1);
    }

    @Test
    void strikeRateRoundsHalfUpToTwoDecimals() {
        // 1 run off 3 balls = 33.333..., 5 off 8 = 62.5, 1 off 8 = 12.5; 1 off 16 = 6.25
        assertThat(batting(PlayerStatsTestData.counters().bat(1, 1, 1).ballsOn(1, 1, 3)).strikeRate())
                .isEqualByComparingTo("33.33");
        // 1 run off 160 balls = 0.625 -> 0.63
        assertThat(batting(PlayerStatsTestData.counters().bat(1, 1, 1).ballsOn(1, 1, 160)).strikeRate())
                .isEqualByComparingTo("0.63");
    }

    @Test
    void aZeroRunInningsWithBallsGivesAZeroStrikeRateNotNull() {
        assertThat(batting(PlayerStatsTestData.counters().bat(1, 1, 0).ballsOn(1, 0, 5)).strikeRate())
                .isEqualByComparingTo("0.00");
    }

    // ---- batting: boundaries ----

    @Test
    void boundaryPercentageAndBallsPerBoundaryUseOnlyInningsWithCompleteColumns() {
        // 3 innings of 100 runs; only 1 recorded fours and sixes: 3 fours + 1 six = 18 of its 40 runs, off 30 balls
        Counters c = PlayerStatsTestData.counters().bat(3, 3, 100).fours(3).sixes(1);
        c.inningsWithBoundaries = 1;
        c.boundaryRuns = 18;
        c.runsWithBoundaries = 40;
        c.ballsForBoundaries = 30;
        c.boundaryCount = 4;

        PlayerBatting b = batting(c);

        assertThat(b.boundaryPercentage()).isEqualByComparingTo("45.0");
        assertThat(b.ballsPerBoundary()).isEqualByComparingTo("7.5");
        assertThat(b.coverage().inningsWithBoundaries()).isEqualTo(1);
        assertThat(b.coverage().inningsCounted()).isEqualTo(3);
        assertThat(b.fours()).isEqualTo(3);
        assertThat(b.sixes()).isEqualTo(1);
    }

    @Test
    void boundaryFiguresAreNullWithNoRunsOrNoBoundaries() {
        Counters c = PlayerStatsTestData.counters().bat(1, 1, 0);
        c.inningsWithBoundaries = 1;
        c.ballsForBoundaries = 12;

        PlayerBatting b = batting(c);

        assertThat(b.boundaryPercentage()).isNull();
        assertThat(b.ballsPerBoundary()).isNull();
    }

    @Test
    void boundaryFiguresRoundHalfUpToOneDecimal() {
        Counters c = PlayerStatsTestData.counters().bat(1, 1, 50);
        c.inningsWithBoundaries = 1;
        c.boundaryRuns = 1;
        c.runsWithBoundaries = 2000; // 0.05 -> 0.1
        c.ballsForBoundaries = 1;
        c.boundaryCount = 20; // 0.05 -> 0.1

        PlayerBatting b = batting(c);

        assertThat(b.boundaryPercentage()).isEqualByComparingTo("0.1");
        assertThat(b.ballsPerBoundary()).isEqualByComparingTo("0.1");
    }

    // ---- dismissal modes (batter) ----

    @Test
    void batterDismissalModesAreNonZeroInEnumOrderAndIncludeNotOutAndOther() {
        PlayerStatsFacts facts = new PlayerStatsFacts(
                List.of(),
                List.of(),
                List.of(),
                Map.of(
                        DismissalType.NOT_OUT, 4L,
                        DismissalType.RETIRED_OUT, 1L,
                        DismissalType.CAUGHT, 3L,
                        DismissalType.BOWLED, 2L,
                        DismissalType.TIMED_OUT, 1L,
                        DismissalType.LBW, 0L),
                Map.of());

        Map<String, Long> modes = figures(PlayerStatsTestData.counters().bat(11, 7, 100), facts).batting().dismissalModes();

        assertThat(modes).containsExactly(
                Map.entry("NOT_OUT", 4L),
                Map.entry("BOWLED", 2L),
                Map.entry("CAUGHT", 3L),
                Map.entry("TIMED_OUT", 1L),
                Map.entry("RETIRED_OUT", 1L));
    }

    // ---- bowling: ratios ----

    @Test
    void bowlingRatesAreNullWithZeroWicketsAndZeroBalls() {
        PlayerBowling none = bowling(PlayerStatsTestData.counters());
        assertThat(none.average()).isNull();
        assertThat(none.economy()).isNull();
        assertThat(none.strikeRate()).isNull();

        // bowled 12 balls for 14 runs, no wicket: economy exists, average and strike rate do not
        PlayerBowling wicketless = bowling(PlayerStatsTestData.counters().bowl(1, 12, 14, 0));
        assertThat(wicketless.average()).isNull();
        assertThat(wicketless.strikeRate()).isNull();
        assertThat(wicketless.economy()).isEqualByComparingTo("7.00");
    }

    @Test
    void anInningsWithRunsButNoLegalBallsStillHasNoEconomy() {
        // only wides and no-balls conceded: 1 innings bowled, 0 legal balls
        Counters c = PlayerStatsTestData.counters().bowl(1, 0, 7, 0);

        assertThat(bowling(c).economy()).isNull();
        assertThat(bowling(c).inningsBowled()).isEqualTo(1);
    }

    @Test
    void bowlingAverageAndStrikeRateAreRunsAndBallsPerWicket() {
        PlayerBowling w = bowling(PlayerStatsTestData.counters().bowl(2, 48, 100, 6));

        assertThat(w.average()).isEqualByComparingTo("16.67");
        assertThat(w.strikeRate()).isEqualByComparingTo("8.0");
        assertThat(w.economy()).isEqualByComparingTo("12.50");
    }

    @Test
    void strikeRateIsOneDecimalHalfUp() {
        // 1 ball per 20 wickets is not possible, so use 13 balls for 8 wickets = 1.625 -> 1.6; 1 / 16 = 0.0625 -> 0.1
        assertThat(bowling(PlayerStatsTestData.counters().bowl(1, 13, 10, 8)).strikeRate()).isEqualByComparingTo("1.6");
        assertThat(bowling(PlayerStatsTestData.counters().bowl(1, 1, 10, 20)).strikeRate()).isEqualByComparingTo("0.1");
    }

    @Test
    void economyWithUnequalBallsPerOverUsesEachMatchsOvers() {
        // a 5-ball match (25 balls = 5 overs) and a 6-ball match (18 balls = 3 overs): 8 overs; 41 runs / 8 = 5.125.
        // Rounded once, half up, 5.13. (Naive 43 balls / 6 gives 7.1 overs and 5.77, which is wrong.)
        Counters c = PlayerStatsTestData.counters().bowl(2, 43, 41, 3).overs("8.0000000000").ballsPerOver(5, 6);

        PlayerBowling w = bowling(c);

        assertThat(w.economy()).isEqualByComparingTo("5.13");
        assertThat(w.economy().scale()).isEqualTo(2);
    }

    @Test
    void economyRoundsHalfUpOnceAtTheEnd() {
        // 1 run over 8 overs = 0.125 -> 0.13
        assertThat(bowling(PlayerStatsTestData.counters().bowl(1, 48, 1, 0).overs("8")).economy())
                .isEqualByComparingTo("0.13");
        // thirds of an over: 7 runs in 7 balls (1.1666666667 overs) is 6.00, not 5.99 from a pre-rounded 1.17
        assertThat(bowling(PlayerStatsTestData.counters().bowl(1, 7, 7, 0)).economy()).isEqualByComparingTo("6.00");
    }

    @Test
    void mixedOverLengthsAreFlaggedAndASingleLengthIsNot() {
        assertThat(bowling(PlayerStatsTestData.counters().bowl(2, 43, 41, 3).ballsPerOver(5, 6)).mixedOverLengths())
                .isTrue();
        PlayerBowling uniform = bowling(PlayerStatsTestData.counters().bowl(2, 48, 41, 3).ballsPerOver(6));
        assertThat(uniform.mixedOverLengths()).isFalse();
        assertThat(uniform.ballsPerOver()).containsExactly(6);
        assertThat(uniform.ballsBowled()).isEqualTo(48);
    }

    // ---- bowling: best bowling ----

    @Test
    void bestBowlingKeyDecodesWicketsAndRuns() {
        PlayerBowling w = bowling(PlayerStatsTestData.counters().bowl(1, 24, 17, 4).best(4, 17, 24));

        assertThat(w.best().wickets()).isEqualTo(4);
        assertThat(w.best().runs()).isEqualTo(17);
    }

    @Test
    void bestBowlingOrdersByWicketsThenFewerRunsThenMoreBalls() {
        long fiveForMany = PlayerStatsCalculator.bestBowlingKey(5, 60, 30);
        long fourForFew = PlayerStatsCalculator.bestBowlingKey(4, 5, 30);
        long fourFor17 = PlayerStatsCalculator.bestBowlingKey(4, 17, 24);
        long fourFor20 = PlayerStatsCalculator.bestBowlingKey(4, 20, 30);
        long fourFor17Longer = PlayerStatsCalculator.bestBowlingKey(4, 17, 30);

        assertThat(fiveForMany).isGreaterThan(fourForFew);
        assertThat(fourFor17).isGreaterThan(fourFor20);
        assertThat(fourFor17Longer).isGreaterThan(fourFor17);
    }

    @Test
    void bestBowlingKeyRoundTripsEdgeFigures() {
        for (long[] f : new long[][] {{0, 0, 0}, {1, 0, 6}, {3, 0, 12}, {10, 99, 60}, {6, 99_999, 600}}) {
            PlayerBowling w = bowling(PlayerStatsTestData.counters().bowl(1, 6, 1, f[0]).best(f[0], f[1], f[2]));
            assertThat(w.best().wickets()).as("wickets of %s", java.util.Arrays.toString(f)).isEqualTo(f[0]);
            assertThat(w.best().runs()).as("runs of %s", java.util.Arrays.toString(f)).isEqualTo(f[1]);
        }
    }

    @Test
    void noBestBowlingKeyMeansNoBestBowling() {
        assertThat(bowling(PlayerStatsTestData.counters().bowl(1, 6, 5, 0)).best()).isNull();
    }

    // ---- bowling: hauls, maidens, extras, dots ----

    @Test
    void haulBandsDoNotOverlapAndSumToInningsWithThreeOrMoreWickets() {
        // innings of 2, 3, 4, 5 and 6 wickets: exactly 3 = 1, exactly 4 = 1, 5 or more = 2
        PlayerBowling w = bowling(PlayerStatsTestData.counters().bowl(5, 150, 120, 20).hauls(1, 1, 2));

        assertThat(w.threeWicketHauls()).isEqualTo(1);
        assertThat(w.fourWicketHauls()).isEqualTo(1);
        assertThat(w.fiveWicketHauls()).isEqualTo(2);
        assertThat(w.threeWicketHauls() + w.fourWicketHauls() + w.fiveWicketHauls()).isEqualTo(4);
    }

    @Test
    void maidensWidesAndNoBallsPassThroughWithTheirCoverage() {
        Counters c = PlayerStatsTestData.counters().bowl(4, 96, 80, 5);
        c.maidens = 3;
        c.wides = 6;
        c.noBalls = 2;
        c.inningsWithWides = 3;
        c.inningsWithNoBalls = 2;

        PlayerBowling w = bowling(c);

        assertThat(w.maidens()).isEqualTo(3);
        assertThat(w.wides()).isEqualTo(6);
        assertThat(w.noBalls()).isEqualTo(2);
        assertThat(w.coverage().inningsWithWides()).isEqualTo(3);
        assertThat(w.coverage().inningsWithNoBalls()).isEqualTo(2);
        assertThat(w.coverage().inningsCounted()).isEqualTo(4);
    }

    @Test
    void dotBallPercentageIsDotsOverTheBallsOfTheSameInningsToOneDecimal() {
        // 4 innings bowled (96 balls) but only 2 recorded dots: 30 dots in those 2 innings' 60 balls
        PlayerBowling w = bowling(PlayerStatsTestData.counters().bowl(4, 96, 80, 5).dots(2, 30, 60));

        assertThat(w.dotBallPercentage()).isEqualByComparingTo("50.0");
        assertThat(w.dots()).isEqualTo(30);
        assertThat(w.coverage().inningsWithDots()).isEqualTo(2);
        assertThat(bowling(PlayerStatsTestData.counters().bowl(1, 18, 10, 1).dots(1, 6, 18)).dotBallPercentage())
                .isEqualByComparingTo("33.3");
    }

    @Test
    void dotBallPercentageIsNullWhenNoInningsRecordedDots() {
        assertThat(bowling(PlayerStatsTestData.counters().bowl(2, 48, 30, 2)).dotBallPercentage()).isNull();
    }

    // ---- bowling: dismissal modes ----

    @Test
    void bowlerModesCountOnlyBowlerCreditedTypesAndReconcileWithNotRecorded() {
        PlayerStatsFacts facts = new PlayerStatsFacts(
                List.of(),
                List.of(),
                List.of(),
                Map.of(),
                Map.of(
                        DismissalType.CAUGHT, 2L,
                        DismissalType.BOWLED, 1L,
                        DismissalType.RUN_OUT, 1L,
                        DismissalType.LBW, 0L));

        PlayerBowling w = figures(PlayerStatsTestData.counters().bowl(2, 48, 30, 5), facts).bowling();

        assertThat(w.dismissalModes()).containsExactly(Map.entry("BOWLED", 1L), Map.entry("CAUGHT", 2L));
        assertThat(w.dismissalsNotRecorded()).isEqualTo(2);
        assertThat(w.dismissalModes().values().stream().mapToLong(Long::longValue).sum() + w.dismissalsNotRecorded())
                .isEqualTo(w.wickets());
    }

    @Test
    void notRecordedNeverGoesNegative() {
        PlayerStatsFacts facts = new PlayerStatsFacts(
                List.of(), List.of(), List.of(), Map.of(), Map.of(DismissalType.BOWLED, 3L));

        PlayerBowling w = figures(PlayerStatsTestData.counters().bowl(1, 24, 30, 2), facts).bowling();

        assertThat(w.dismissalsNotRecorded()).isZero();
    }

    // ---- fielding ----

    @Test
    void fieldingTotalsAndPerMatchUseMatchesAsTheDenominator() {
        // 3 catches, 1 stumping, 2 run outs = 6 dismissals over 4 matches (not over the rows that exist)
        var fielding = figures(PlayerStatsTestData.counters().matches(4).fielding(3, 1, 2), PlayerStatsFacts.EMPTY)
                .fielding();

        assertThat(fielding.catches()).isEqualTo(3);
        assertThat(fielding.stumpings()).isEqualTo(1);
        assertThat(fielding.runOuts()).isEqualTo(2);
        assertThat(fielding.dismissals()).isEqualTo(6);
        assertThat(fielding.dismissalsPerMatch()).isEqualByComparingTo("1.50");
    }

    @Test
    void fieldingPerMatchRoundsHalfUpAndIsNullWithNoMatches() {
        assertThat(figures(PlayerStatsTestData.counters().matches(3).fielding(1, 0, 0), PlayerStatsFacts.EMPTY)
                        .fielding()
                        .dismissalsPerMatch())
                .isEqualByComparingTo("0.33");
        assertThat(figures(PlayerStatsTestData.counters().matches(0).fielding(0, 0, 0), PlayerStatsFacts.EMPTY)
                        .fielding()
                        .dismissalsPerMatch())
                .isNull();
    }

    @Test
    void aMatchWithNoFieldingRowStillCountsInTheDenominator() {
        // played 10 matches, credited in one: 1 / 10, not 1 / 1
        assertThat(figures(PlayerStatsTestData.counters().matches(10).fielding(1, 0, 0), PlayerStatsFacts.EMPTY)
                        .fielding()
                        .dismissalsPerMatch())
                .isEqualByComparingTo("0.10");
    }

    // ---- awards and record ----

    @Test
    void awardsPassThrough() {
        var awards = figures(PlayerStatsTestData.counters().awards(2, 3), PlayerStatsFacts.EMPTY).awards();

        assertThat(awards.playerOfTheMatch()).isEqualTo(2);
        assertThat(awards.teamPlayerOfTheMatch()).isEqualTo(3);
    }

    @Test
    void recordKeepsADerbyAsInternalAndNoResultOrAbandonedAddsToNone() {
        // 6 matches: 3 won, 1 lost, 0 tied, 0 drawn, 1 derby (internal), 1 no-result with play (a match, in none of them)
        Counters c = PlayerStatsTestData.counters().matches(6);
        c.won = 3;
        c.lost = 1;
        c.internal = 1;

        var record = figures(c, PlayerStatsFacts.EMPTY).record();

        assertThat(record.won()).isEqualTo(3);
        assertThat(record.lost()).isEqualTo(1);
        assertThat(record.tied()).isZero();
        assertThat(record.drawn()).isZero();
        assertThat(record.internal()).isEqualTo(1);
        assertThat(record.won() + record.lost() + record.tied() + record.drawn() + record.internal())
                .isLessThan(c.matches);
    }

    // ---- form and positions ----

    @Test
    void recentFormKeepsTheOrderItWasGivenAndNullRunsOrBalls() {
        UUID m1 = UUID.randomUUID();
        UUID m2 = UUID.randomUUID();
        Instant newer = Instant.parse("2026-10-10T10:00:00Z");
        Instant older = Instant.parse("2026-10-03T10:00:00Z");
        PlayerStatsFacts facts = new PlayerStatsFacts(
                List.of(new InningsFact(m1, newer, 42, true, null), new InningsFact(m2, older, null, false, 17)),
                List.of(new SpellFact(m1, newer, 3, 21, 24, 6)),
                List.of(),
                Map.of(),
                Map.of());

        var form = figures(PlayerStatsTestData.counters(), facts).form();

        assertThat(form.batting()).extracting(i -> i.matchId()).containsExactly(m1, m2);
        assertThat(form.batting().get(0).runs()).isEqualTo(42);
        assertThat(form.batting().get(0).notOut()).isTrue();
        assertThat(form.batting().get(0).balls()).isNull();
        assertThat(form.batting().get(1).runs()).isNull();
        assertThat(form.bowling()).hasSize(1);
        assertThat(form.bowling().get(0).wickets()).isEqualTo(3);
        assertThat(form.bowling().get(0).ballsPerOver()).isEqualTo(6);
    }

    @Test
    void battingPositionAverageIsNullWithoutADismissal() {
        PlayerStatsFacts facts = new PlayerStatsFacts(
                List.of(),
                List.of(),
                List.of(new PositionFact(1, 4, 90, 3), new PositionFact(5, 2, 30, 0)),
                Map.of(),
                Map.of());

        var positions = figures(PlayerStatsTestData.counters().bat(6, 3, 120), facts).batting().positions();

        assertThat(positions).extracting(p -> p.position()).containsExactly(1, 5);
        assertThat(positions.get(0).average()).isEqualByComparingTo("30.00");
        assertThat(positions.get(1).average()).isNull();
        assertThat(positions.get(1).runs()).isEqualTo(30);
    }

    // ---- not captured catalogue ----

    @Test
    void notCapturedCatalogueIsTheSixUnsupportedStatisticsAndIsReturnedWithEveryRead() {
        List<PlayerNotCaptured> list = PlayerStatsCalculator.NOT_CAPTURED;

        assertThat(list).extracting(PlayerNotCaptured::code).containsExactly(
                "BATTING_DOT_BALL_PERCENTAGE",
                "PARTNERSHIPS_AND_FALL_OF_WICKETS",
                "BOUNDARIES_CONCEDED",
                "WICKETKEEPER_DISMISSALS",
                "CATCHES_DROPPED",
                "DIRECT_HITS");
        assertThat(list).extracting(PlayerNotCaptured::tab).containsOnly("BATTING", "BOWLING", "FIELDING");
        assertThat(list).allSatisfy(item -> {
            assertThat(item.label()).isNotBlank();
            assertThat(item.reason()).isNotBlank();
        });
        assertThat(PlayerStatsCalculator.calculate(PlayerStatsCounters.EMPTY, PlayerStatsFacts.EMPTY).notCaptured())
                .isEqualTo(list);
    }

    @Test
    void theBowlersDotBallPercentageIsNotListedAsNotCaptured() {
        assertThat(PlayerStatsCalculator.NOT_CAPTURED)
                .extracting(PlayerNotCaptured::tab, PlayerNotCaptured::code)
                .doesNotContain(org.assertj.core.groups.Tuple.tuple("BOWLING", "BOWLING_DOT_BALL_PERCENTAGE"));
    }
}
