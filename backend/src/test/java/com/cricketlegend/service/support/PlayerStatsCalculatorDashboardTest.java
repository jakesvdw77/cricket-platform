package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.service.support.PlayerStatsCalculator.BowlingCredit;
import com.cricketlegend.service.support.PlayerStatsCalculator.WicketSplit;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * docs/specs/117-stats-dashboard.md, "Player economy rate", "Wicket-type split" and the single-figure definitions the
 * Dashboard series call: economy, overs, average, share, dismissal counts and the wickets-by-type split.
 */
class PlayerStatsCalculatorDashboardTest {

    private static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }

    // ---- economy / matchOvers / matchEconomy ----

    @Test
    void aMatchEconomyIsRunsPerOverOfThatMatchsBalls() {
        assertThat(PlayerStatsCalculator.matchEconomy(30, 36, 6)).isEqualByComparingTo("5.00");
    }

    @Test
    void aFiveBallOverMatchIsCountedAgainstItsOwnBallsPerOver() {
        // 30 balls at five per over is six overs (5.00), not five overs (6.00)
        assertThat(PlayerStatsCalculator.matchEconomy(30, 30, 5)).isEqualByComparingTo("5.00");
        assertThat(PlayerStatsCalculator.matchEconomy(30, 30, 6)).isEqualByComparingTo("6.00");
    }

    @Test
    void zeroBallsIsAGapNeverZeroOrInfinity() {
        assertThat(PlayerStatsCalculator.matchEconomy(12, 0, 6)).isNull();
        assertThat(PlayerStatsCalculator.matchOvers(0, 6)).isNull();
        assertThat(PlayerStatsCalculator.economy(12, BigDecimal.ZERO)).isNull();
        assertThat(PlayerStatsCalculator.economy(12, null)).isNull();
    }

    @Test
    void aNonPositiveBallsPerOverGivesNoOvers() {
        assertThat(PlayerStatsCalculator.matchOvers(12, 0)).isNull();
        assertThat(PlayerStatsCalculator.matchEconomy(12, 12, 0)).isNull();
    }

    @Test
    void matchOversIsBallsOverBallsPerOver() {
        assertThat(PlayerStatsCalculator.matchOvers(36, 6)).isEqualByComparingTo("6");
        assertThat(PlayerStatsCalculator.matchOvers(30, 5)).isEqualByComparingTo("6");
        assertThat(PlayerStatsCalculator.matchOvers(4, 6)).isBetween(bd("0.6666666666"), bd("0.6666666667"));
    }

    @Test
    void economyRoundsHalfUpOnceToTwoDecimals() {
        assertThat(PlayerStatsCalculator.economy(1, bd("8"))).isEqualByComparingTo("0.13"); // 0.125
        assertThat(PlayerStatsCalculator.economy(1, bd("16"))).isEqualByComparingTo("0.06"); // 0.0625 is below the half
        assertThat(PlayerStatsCalculator.economy(25, bd("6"))).isEqualByComparingTo("4.17"); // 4.1666
        assertThat(PlayerStatsCalculator.economy(25, bd("6")).scale()).isEqualTo(2);
    }

    @Test
    void anOddSpellOfFourBallsStillRoundsToTheHalf() {
        // 7 runs off 4 balls = 10.5 an over; the 20-place overs figure must not push it off the half
        assertThat(PlayerStatsCalculator.matchEconomy(7, 4, 6)).isEqualByComparingTo("10.50");
    }

    @Test
    void theBowlingTabEconAndTheMatchFigureShareOneDefinition() {
        var counters = PlayerStatsTestData.counters().bowl(1, 36, 30, 2);
        var tab = PlayerStatsCalculator.calculate(counters.build(), PlayerStatsFacts.EMPTY).bowling().economy();

        assertThat(tab).isEqualByComparingTo(PlayerStatsCalculator.matchEconomy(30, 36, 6));
    }

    // ---- battingAverage / percent ----

    @Test
    void battingAverageIsRunsPerDismissalToTwoDecimals() {
        assertThat(PlayerStatsCalculator.battingAverage(100, 4)).isEqualByComparingTo("25.00");
        assertThat(PlayerStatsCalculator.battingAverage(10, 3)).isEqualByComparingTo("3.33");
        assertThat(PlayerStatsCalculator.battingAverage(1, 8)).isEqualByComparingTo("0.13");
    }

    @Test
    void battingAverageIsNullWithNoDismissalNotRunsOrInfinity() {
        assertThat(PlayerStatsCalculator.battingAverage(150, 0)).isNull();
        assertThat(PlayerStatsCalculator.battingAverage(0, 0)).isNull();
    }

    @Test
    void battingAverageMatchesTheBattingTab() {
        var counters = PlayerStatsTestData.counters().bat(5, 3, 105);
        var tab = PlayerStatsCalculator.calculate(counters.build(), PlayerStatsFacts.EMPTY).batting().average();

        assertThat(PlayerStatsCalculator.battingAverage(105, 3)).isEqualByComparingTo(tab);
    }

    @Test
    void percentIsOneDecimalHalfUpAndNullAtZeroTotal() {
        assertThat(PlayerStatsCalculator.percent(1, 3)).isEqualByComparingTo("33.3");
        assertThat(PlayerStatsCalculator.percent(1, 16)).isEqualByComparingTo("6.3"); // 6.25
        assertThat(PlayerStatsCalculator.percent(1, 8)).isEqualByComparingTo("12.5");
        assertThat(PlayerStatsCalculator.percent(0, 5)).isEqualByComparingTo("0.0");
        assertThat(PlayerStatsCalculator.percent(5, 5)).isEqualByComparingTo("100.0");
        assertThat(PlayerStatsCalculator.percent(0, 0)).isNull();
        assertThat(PlayerStatsCalculator.percent(3, 0)).isNull();
    }

    // ---- dismissalCounts ----

    @Test
    void bothNotOutKindsAreOneNotOutEntryAndDidNotBatIsNotAnInnings() {
        Map<DismissalType, Long> counts = PlayerStatsCalculator.dismissalCounts(java.util.Arrays.asList(
                DismissalType.BOWLED,
                DismissalType.NOT_OUT,
                DismissalType.DID_NOT_BAT,
                DismissalType.RETIRED_NOT_OUT,
                null,
                DismissalType.CAUGHT,
                DismissalType.BOWLED));

        assertThat(counts)
                .containsOnlyKeys(DismissalType.NOT_OUT, DismissalType.BOWLED, DismissalType.CAUGHT)
                .containsEntry(DismissalType.NOT_OUT, 2L)
                .containsEntry(DismissalType.BOWLED, 2L)
                .containsEntry(DismissalType.CAUGHT, 1L);
        assertThat(counts.keySet()).first().isEqualTo(DismissalType.NOT_OUT);
        assertThat(counts.values().stream().mapToLong(Long::longValue).sum()).isEqualTo(5);
    }

    @Test
    void nonBowlerWicketsAreDismissalsInTheirOwnRightAndOnlyCountedTypesAreReturned() {
        Map<DismissalType, Long> counts = PlayerStatsCalculator.dismissalCounts(
                List.of(DismissalType.RUN_OUT, DismissalType.RETIRED_OUT, DismissalType.TIMED_OUT, DismissalType.RUN_OUT));

        assertThat(counts)
                .containsOnlyKeys(DismissalType.RUN_OUT, DismissalType.RETIRED_OUT, DismissalType.TIMED_OUT)
                .containsEntry(DismissalType.RUN_OUT, 2L);
        assertThat(counts.keySet()).containsExactly(DismissalType.RUN_OUT, DismissalType.TIMED_OUT, DismissalType.RETIRED_OUT);
    }

    @Test
    void noInningsGivesNoSlices() {
        assertThat(PlayerStatsCalculator.dismissalCounts(List.of())).isEmpty();
    }

    // ---- splitWickets ----

    private static BowlingCredit credit(UUID row, int wickets, DismissalType type, long credited) {
        return new BowlingCredit(row, wickets, type, credited);
    }

    /** A bowling row with no batter naming the bowler (no opposition card, or nothing credited). */
    private static BowlingCredit bare(UUID row, int wickets) {
        return new BowlingCredit(row, wickets, null, 0);
    }

    @Test
    void fullyCreditedInningsGivesOneOfEachAndNothingNotItemised() {
        UUID row = UUID.randomUUID();

        WicketSplit split = PlayerStatsCalculator.splitWickets(List.of(
                credit(row, 3, DismissalType.BOWLED, 1),
                credit(row, 3, DismissalType.CAUGHT, 1),
                credit(row, 3, DismissalType.LBW, 1)));

        assertThat(split.types())
                .containsOnlyKeys(DismissalType.BOWLED, DismissalType.CAUGHT, DismissalType.LBW)
                .containsValues(1L, 1L, 1L);
        assertThat(split.notItemised()).isZero();
        assertThat(split.total()).isEqualTo(3);
        assertThat(split.itemised()).isEqualTo(3);
        assertThat(split.inningsItemised()).isEqualTo(1);
        assertThat(split.inningsWithWickets()).isEqualTo(1);
    }

    @Test
    void partlyCreditedInningsLeavesTheRestNotItemised() {
        UUID row = UUID.randomUUID();

        WicketSplit split = PlayerStatsCalculator.splitWickets(List.of(
                credit(row, 3, DismissalType.BOWLED, 1), credit(row, 3, DismissalType.STUMPED, 1)));

        assertThat(split.types()).containsOnlyKeys(DismissalType.BOWLED, DismissalType.STUMPED);
        assertThat(split.notItemised()).isEqualTo(1);
        assertThat(split.total()).isEqualTo(3);
        assertThat(split.itemised()).isEqualTo(2);
    }

    @Test
    void creditedEqualToWicketsIsTheBoundaryThatStillItemises() {
        UUID row = UUID.randomUUID();

        WicketSplit split = PlayerStatsCalculator.splitWickets(List.of(credit(row, 2, DismissalType.CAUGHT, 2)));

        assertThat(split.types()).containsEntry(DismissalType.CAUGHT, 2L);
        assertThat(split.notItemised()).isZero();
    }

    @Test
    void moreCreditedThanStoredWicketsItemisesNothingAndTheStoredWicketsWin() {
        UUID row = UUID.randomUUID();

        WicketSplit split = PlayerStatsCalculator.splitWickets(List.of(
                credit(row, 2, DismissalType.BOWLED, 2), credit(row, 2, DismissalType.CAUGHT, 1)));

        assertThat(split.types()).isEmpty();
        assertThat(split.notItemised()).isEqualTo(2);
        assertThat(split.total()).isEqualTo(2);
        assertThat(split.itemised()).isZero();
        assertThat(split.inningsItemised()).isZero();
        assertThat(split.inningsWithWickets()).isEqualTo(1);
    }

    @Test
    void anOverCreditedInningsDoesNotSpoilAnotherInningsThatItemises() {
        UUID over = UUID.randomUUID();
        UUID fine = UUID.randomUUID();

        WicketSplit split = PlayerStatsCalculator.splitWickets(List.of(
                credit(over, 1, DismissalType.BOWLED, 2),
                credit(fine, 2, DismissalType.LBW, 2)));

        assertThat(split.types()).containsOnlyKeys(DismissalType.LBW).containsEntry(DismissalType.LBW, 2L);
        assertThat(split.notItemised()).isEqualTo(1);
        assertThat(split.total()).isEqualTo(3);
        assertThat(split.inningsItemised()).isEqualTo(1);
        assertThat(split.inningsWithWickets()).isEqualTo(2);
    }

    @Test
    void noOppositionBattingCardGivesAllNotItemised() {
        WicketSplit split = PlayerStatsCalculator.splitWickets(List.of(bare(UUID.randomUUID(), 4)));

        assertThat(split.types()).isEmpty();
        assertThat(split.notItemised()).isEqualTo(4);
        assertThat(split.total()).isEqualTo(4);
        assertThat(split.inningsItemised()).isZero();
    }

    @Test
    void aBlankBowlerOnADismissalLeavesItNotItemised() {
        UUID row = UUID.randomUUID();
        // two batters out bowled, only one names the bowler: the join gives credited 1, w stays 2
        WicketSplit split = PlayerStatsCalculator.splitWickets(List.of(credit(row, 2, DismissalType.BOWLED, 1)));

        assertThat(split.types()).containsEntry(DismissalType.BOWLED, 1L);
        assertThat(split.notItemised()).isEqualTo(1);
    }

    @Test
    void aCreditedTypeWithNoCountIsIgnored() {
        UUID row = UUID.randomUUID();

        WicketSplit split = PlayerStatsCalculator.splitWickets(List.of(credit(row, 1, DismissalType.BOWLED, 0)));

        assertThat(split.types()).isEmpty();
        assertThat(split.notItemised()).isEqualTo(1);
    }

    @ParameterizedTest
    @EnumSource(
            value = DismissalType.class,
            names = {"RUN_OUT", "RETIRED_OUT", "HANDLED_BALL", "OBSTRUCTING_FIELD", "HIT_BALL_TWICE", "TIMED_OUT",
                "NOT_OUT", "DID_NOT_BAT", "RETIRED_NOT_OUT"})
    void typesABowlerIsNeverCreditedWithAreNeverCountedEvenWhenABowlerIsNamed(DismissalType type) {
        UUID row = UUID.randomUUID();

        WicketSplit split = PlayerStatsCalculator.splitWickets(List.of(credit(row, 1, type, 1)));

        assertThat(split.types()).isEmpty();
        assertThat(split.notItemised()).isEqualTo(1);
        assertThat(split.total()).isEqualTo(1);
        assertThat(split.itemised()).isZero();
    }

    @Test
    void aNonCreditedTypeAlongsideACreditedOneDoesNotCountTowardsTheCredited() {
        UUID row = UUID.randomUUID();

        WicketSplit split = PlayerStatsCalculator.splitWickets(List.of(
                credit(row, 2, DismissalType.BOWLED, 1), credit(row, 2, DismissalType.RUN_OUT, 1)));

        assertThat(split.types()).containsOnlyKeys(DismissalType.BOWLED);
        assertThat(split.notItemised()).isEqualTo(1);
    }

    @Test
    void caughtAndBowledIsItsOwnSliceNotMergedWithCaught() {
        UUID row = UUID.randomUUID();

        WicketSplit split = PlayerStatsCalculator.splitWickets(List.of(
                credit(row, 2, DismissalType.CAUGHT, 1), credit(row, 2, DismissalType.CAUGHT_AND_BOWLED, 1)));

        assertThat(split.types())
                .containsEntry(DismissalType.CAUGHT, 1L)
                .containsEntry(DismissalType.CAUGHT_AND_BOWLED, 1L);
    }

    @Test
    void aRowWithNoStoredWicketsContributesNothingEvenIfCredited() {
        UUID row = UUID.randomUUID();

        WicketSplit split = PlayerStatsCalculator.splitWickets(List.of(
                bare(row, 0), credit(UUID.randomUUID(), 0, DismissalType.BOWLED, 1)));

        assertThat(split.total()).isZero();
        assertThat(split.types()).isEmpty();
        assertThat(split.notItemised()).isZero();
        assertThat(split.inningsWithWickets()).isZero();
        assertThat(split.inningsItemised()).isZero();
    }

    @Test
    void twoInningsSumPerType() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();

        WicketSplit split = PlayerStatsCalculator.splitWickets(List.of(
                credit(a, 2, DismissalType.BOWLED, 1),
                credit(a, 2, DismissalType.LBW, 1),
                credit(b, 3, DismissalType.BOWLED, 2),
                credit(b, 3, DismissalType.STUMPED, 1)));

        assertThat(split.types())
                .containsEntry(DismissalType.BOWLED, 3L)
                .containsEntry(DismissalType.LBW, 1L)
                .containsEntry(DismissalType.STUMPED, 1L);
        assertThat(split.total()).isEqualTo(5);
        assertThat(split.notItemised()).isZero();
        assertThat(split.inningsItemised()).isEqualTo(2);
    }

    @Test
    void severalCreditsOfOneTypeInOneRowAreSummed() {
        UUID row = UUID.randomUUID();

        WicketSplit split = PlayerStatsCalculator.splitWickets(
                List.of(credit(row, 3, DismissalType.CAUGHT, 1), credit(row, 3, DismissalType.CAUGHT, 1)));

        assertThat(split.types()).containsEntry(DismissalType.CAUGHT, 2L);
        assertThat(split.notItemised()).isEqualTo(1);
    }

    @Test
    void anEmptyInputIsAllZero() {
        WicketSplit split = PlayerStatsCalculator.splitWickets(List.of());

        assertThat(split.types()).isEmpty();
        assertThat(split.total()).isZero();
        assertThat(split.notItemised()).isZero();
        assertThat(split.itemised()).isZero();
        assertThat(split.inningsWithWickets()).isZero();
    }

    @Test
    void typesPlusNotItemisedAlwaysEqualTheStoredWickets() {
        // every stored wicket count 0..5 against every credited count 0..6 (above and below it) in two rows
        for (int stored = 0; stored <= 5; stored++) {
            for (int credited = 0; credited <= 6; credited++) {
                UUID row = UUID.randomUUID();
                UUID other = UUID.randomUUID();
                List<BowlingCredit> credits = new ArrayList<>();
                credits.add(credit(row, stored, DismissalType.BOWLED, credited));
                credits.add(credit(row, stored, DismissalType.RUN_OUT, 2));
                credits.add(credit(other, 3, DismissalType.CAUGHT, 1));

                WicketSplit split = PlayerStatsCalculator.splitWickets(credits);

                long typeSum = split.types().values().stream().mapToLong(Long::longValue).sum();
                assertThat(typeSum + split.notItemised()).as("stored %d credited %d", stored, credited).isEqualTo(stored + 3L);
                assertThat(split.total()).isEqualTo(stored + 3L);
                assertThat(split.itemised()).isEqualTo(typeSum);
            }
        }
    }

    @Test
    void theSplitAgreesWithTheBowlingTabsDismissalModesWhenNothingIsOverCredited() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        var counters = PlayerStatsTestData.counters().bowl(2, 60, 70, 5);
        var facts = new PlayerStatsFacts(
                List.of(), List.of(), List.of(), Map.of(),
                Map.of(DismissalType.BOWLED, 2L, DismissalType.CAUGHT, 1L));
        var tab = PlayerStatsCalculator.calculate(counters.build(), facts).bowling();

        WicketSplit split = PlayerStatsCalculator.splitWickets(List.of(
                credit(a, 3, DismissalType.BOWLED, 2),
                credit(a, 3, DismissalType.RUN_OUT, 1),
                credit(b, 2, DismissalType.CAUGHT, 1)));

        assertThat(split.total()).isEqualTo(tab.wickets());
        assertThat(split.notItemised()).isEqualTo(tab.dismissalsNotRecorded());
        assertThat(split.types().get(DismissalType.BOWLED)).isEqualTo(tab.dismissalModes().get("BOWLED"));
        assertThat(split.types().get(DismissalType.CAUGHT)).isEqualTo(tab.dismissalModes().get("CAUGHT"));
    }

    @Test
    void economyWeightIsRunsOverThatMatchesOvers() {
        StatsTrend.Weighted weight = PlayerStatsCalculator.economyWeight(30, 24, 6);

        assertThat(weight.numerator()).isEqualByComparingTo("30");
        assertThat(weight.denominator()).isEqualByComparingTo(PlayerStatsCalculator.matchOvers(24, 6));
    }
}
