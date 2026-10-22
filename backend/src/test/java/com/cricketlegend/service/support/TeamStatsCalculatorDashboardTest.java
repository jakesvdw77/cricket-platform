package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.service.support.TeamStatsCalculator.DotsPoint;
import com.cricketlegend.service.support.TeamStatsCalculator.ExtrasPoint;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/117-stats-dashboard.md, "Team series": the single-result definitions the team Dashboard calls (run rate,
 * running net run rate, dot percentage, one innings' dot balls and extras).
 */
class TeamStatsCalculatorDashboardTest {

    private static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }

    // ---- nrrValue / rate ----

    @Test
    void netRunRateIsTheDifferenceOfTheTwoRunRates() {
        assertThat(TeamStatsCalculator.nrrValue(300, bd("50"), 250, bd("50"))).isEqualByComparingTo("1.00");
        assertThat(TeamStatsCalculator.nrrValue(200, bd("50"), 250, bd("50"))).isEqualByComparingTo("-1.00");
    }

    @Test
    void netRunRateRoundsOnlyTheDifferenceHalfUp() {
        // 1001/200 = 5.005 and 501/250 = 2.004: the difference 3.001 is 3.00; rounding each rate first would give 3.01
        assertThat(TeamStatsCalculator.nrrValue(1001, bd("200"), 501, bd("250"))).isEqualByComparingTo("3.00");
    }

    @Test
    void netRunRateIsNullWhenEitherSideHasNoOvers() {
        assertThat(TeamStatsCalculator.nrrValue(100, null, 90, bd("20"))).isNull();
        assertThat(TeamStatsCalculator.nrrValue(100, bd("20"), 90, null)).isNull();
        assertThat(TeamStatsCalculator.nrrValue(100, BigDecimal.ZERO, 90, bd("20"))).isNull();
        assertThat(TeamStatsCalculator.nrrValue(100, bd("20"), 90, BigDecimal.ZERO)).isNull();
    }

    @Test
    void aRunRateIsRunsPerOverToTwoDecimalsHalfUp() {
        assertThat(TeamStatsCalculator.rate(30, bd("5"))).isEqualByComparingTo("6.00");
        assertThat(TeamStatsCalculator.rate(1, bd("8"))).isEqualByComparingTo("0.13");
        assertThat(TeamStatsCalculator.rate(25, bd("6"))).isEqualByComparingTo("4.17");
        assertThat(TeamStatsCalculator.rate(25, bd("6")).scale()).isEqualTo(2);
    }

    @Test
    void aRunRateIsNullWithoutOversNeverZero() {
        assertThat(TeamStatsCalculator.rate(50, null)).isNull();
        assertThat(TeamStatsCalculator.rate(50, BigDecimal.ZERO)).isNull();
    }

    // ---- dotPercent ----

    @Test
    void dotPercentIsOneDecimalHalfUpOnce() {
        assertThat(TeamStatsCalculator.dotPercent(1, 3)).isEqualByComparingTo("33.3");
        assertThat(TeamStatsCalculator.dotPercent(1, 16)).isEqualByComparingTo("6.3"); // 6.25
        assertThat(TeamStatsCalculator.dotPercent(0, 100)).isEqualByComparingTo("0.0");
        assertThat(TeamStatsCalculator.dotPercent(100, 100)).isEqualByComparingTo("100.0");
    }

    @Test
    void dotPercentIsNullWithoutBalls() {
        assertThat(TeamStatsCalculator.dotPercent(0, 0)).isNull();
        assertThat(TeamStatsCalculator.dotPercent(5, 0)).isNull();
    }

    // ---- dotsForMatch ----

    @Test
    void whenEveryBowlerRowRecordedDotsTheMatchHasDotsBallsAndPercent() {
        DotsPoint point = TeamStatsCalculator.dotsForMatch(120L, 40L, 3, 3);

        assertThat(point.ballsBowled()).isEqualTo(120);
        assertThat(point.dots()).isEqualTo(40);
        assertThat(point.percent()).isEqualByComparingTo("33.3");
    }

    @Test
    void oneBowlerRowWithoutDotsMakesTheMatchDotsAndPercentNullNeverAPartialSum() {
        // the query's sum covers the two rows that recorded dots; the third did not
        DotsPoint point = TeamStatsCalculator.dotsForMatch(120L, 30L, 3, 2);

        assertThat(point.ballsBowled()).isEqualTo(120);
        assertThat(point.dots()).isNull();
        assertThat(point.percent()).isNull();
    }

    @Test
    void aRecordedZeroIsARealZero() {
        DotsPoint point = TeamStatsCalculator.dotsForMatch(120L, 0L, 3, 3);

        assertThat(point.dots()).isZero();
        assertThat(point.percent()).isEqualByComparingTo("0.0");
    }

    @Test
    void zeroBallsBowledGivesNoPercent() {
        DotsPoint point = TeamStatsCalculator.dotsForMatch(0L, 0L, 0, 0);

        assertThat(point.ballsBowled()).isZero();
        assertThat(point.percent()).isNull();
    }

    @Test
    void noBowlerRowsAtAllIsAllNull() {
        DotsPoint point = TeamStatsCalculator.dotsForMatch(null, null, 0, 0);

        assertThat(point.ballsBowled()).isNull();
        assertThat(point.dots()).isNull();
        assertThat(point.percent()).isNull();
    }

    @Test
    void dotsPercentRoundsHalfUpOnce() {
        assertThat(TeamStatsCalculator.dotsForMatch(16L, 1L, 1, 1).percent()).isEqualByComparingTo("6.3");
    }

    // ---- extrasForMatch ----

    @Test
    void anItemisedInningsKeepsItsComponentsTotalAndIsItemised() {
        ExtrasPoint point = TeamStatsCalculator.extrasForMatch(10L, 4L, 2L, 3L, 1L, 0L);

        assertThat(point.itemised()).isTrue();
        assertThat(point.notItemised()).isNull();
        assertThat(point.total()).isEqualTo(10);
    }

    @Test
    void aRecordedZeroComponentStillMakesTheInningsItemised() {
        ExtrasPoint point = TeamStatsCalculator.extrasForMatch(0L, 0L, null, null, null, null);

        assertThat(point.itemised()).isTrue();
        assertThat(point.total()).isZero();
        assertThat(point.notItemised()).isNull();
    }

    @Test
    void aTotalOnlyInningsIsNotItemisedAndCarriesItsTotal() {
        ExtrasPoint point = TeamStatsCalculator.extrasForMatch(12L, null, null, null, null, null);

        assertThat(point.itemised()).isFalse();
        assertThat(point.notItemised()).isEqualTo(12);
        assertThat(point.total()).isEqualTo(12);
    }

    @Test
    void aTotalOnlyZeroIsARealZeroNotAGap() {
        ExtrasPoint point = TeamStatsCalculator.extrasForMatch(0L, null, null, null, null, null);

        assertThat(point.itemised()).isFalse();
        assertThat(point.notItemised()).isZero();
        assertThat(point.total()).isZero();
    }

    @Test
    void nothingRecordedIsAGapNeverZero() {
        ExtrasPoint point = TeamStatsCalculator.extrasForMatch(null, null, null, null, null, null);

        assertThat(point.itemised()).isFalse();
        assertThat(point.notItemised()).isNull();
        assertThat(point.total()).isNull();
    }

    @Test
    void componentsWithoutAStoredTotalSumToTheTotal() {
        ExtrasPoint point = TeamStatsCalculator.extrasForMatch(null, 3L, null, 2L, null, null);

        assertThat(point.itemised()).isTrue();
        assertThat(point.total()).isEqualTo(5);
        assertThat(point.notItemised()).isNull();
    }
}
