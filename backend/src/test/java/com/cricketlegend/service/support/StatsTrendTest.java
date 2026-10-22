package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.service.support.StatsTrend.Direction;
import com.cricketlegend.service.support.StatsTrend.Weighted;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * docs/specs/117-stats-dashboard.md, trend hints: the last five points against the five before, each half needing at least
 * three, pooled (sum over sum), flat inside an inclusive band.
 */
class StatsTrendTest {

    private static final BigDecimal BAND = new BigDecimal("0.25");

    private static Weighted w(String numerator, String denominator) {
        return new Weighted(new BigDecimal(numerator), new BigDecimal(denominator));
    }

    private static Weighted unit(String value) {
        return w(value, "1");
    }

    /** {@code earlier} points of {@code earlierValue} then {@code recent} points of {@code recentValue}, oldest first. */
    private static List<Weighted> series(int earlier, String earlierValue, int recent, String recentValue) {
        List<Weighted> points = new ArrayList<>();
        for (int i = 0; i < earlier; i++) {
            points.add(unit(earlierValue));
        }
        for (int i = 0; i < recent; i++) {
            points.add(unit(recentValue));
        }
        return points;
    }

    @Test
    void noHintWithoutThreePointsInTheEarlierHalf() {
        assertThat(StatsTrend.of(series(2, "6", 5, "4"), 2, BAND)).isNull();
    }

    @Test
    void aHintAppearsAtExactlyThreeEarlierPoints() {
        var hint = StatsTrend.of(series(3, "6", 5, "4"), 2, BAND);

        assertThat(hint).isNotNull();
        assertThat(hint.recent()).isEqualByComparingTo("4.00");
        assertThat(hint.earlier()).isEqualByComparingTo("6.00");
        assertThat(hint.direction()).isEqualTo(Direction.DOWN);
    }

    @Test
    void noHintWhenThereIsNoEarlierHalfAtAll() {
        assertThat(StatsTrend.of(series(0, "6", 5, "4"), 2, BAND)).isNull();
        assertThat(StatsTrend.of(series(0, "6", 4, "4"), 2, BAND)).isNull();
        assertThat(StatsTrend.of(List.of(), 2, BAND)).isNull();
    }

    @Test
    void theHalvesAreTheLastFiveAndTheFiveBeforeEvenWithMoreHistory() {
        List<Weighted> points = new ArrayList<>(series(10, "1000", 0, "0"));
        points.addAll(series(5, "100", 5, "2"));

        var hint = StatsTrend.of(points, 2, BAND);

        assertThat(hint.recent()).isEqualByComparingTo("2.00");
        assertThat(hint.earlier()).isEqualByComparingTo("100.00");
        assertThat(hint.direction()).isEqualTo(Direction.DOWN);
    }

    @Test
    void anEarlierHalfOfFewerThanFivePointsIsUsedWhenItHasAtLeastThree() {
        // 4 earlier points: all four are the earlier half
        var hint = StatsTrend.of(series(4, "5", 5, "7"), 2, BAND);

        assertThat(hint.earlier()).isEqualByComparingTo("5.00");
        assertThat(hint.recent()).isEqualByComparingTo("7.00");
        assertThat(hint.direction()).isEqualTo(Direction.UP);
    }

    @Test
    void figuresArePooledNotTheMeanOfThePointFigures() {
        // earlier: 30/5, 2/1, 1/1 = 33/7 = 4.71 (the mean of 6, 2 and 1 would be 3.00)
        List<Weighted> points = new ArrayList<>(List.of(w("30", "5"), w("2", "1"), w("1", "1")));
        points.addAll(series(0, "0", 5, "10"));

        var hint = StatsTrend.of(points, 2, BAND);

        assertThat(hint.earlier()).isEqualByComparingTo("4.71");
        assertThat(hint.recent()).isEqualByComparingTo("10.00");
        assertThat(hint.direction()).isEqualTo(Direction.UP);
    }

    @Test
    void pooledRoundsHalfUpOnceAtTheGivenScale() {
        assertThat(StatsTrend.pooled(List.of(w("1", "8")), 2)).isEqualByComparingTo("0.13");
        assertThat(StatsTrend.pooled(List.of(w("1", "16")), 1)).isEqualByComparingTo("0.1");
        assertThat(StatsTrend.pooled(List.of(w("5", "8")), 1)).isEqualByComparingTo("0.6");
        assertThat(StatsTrend.pooled(List.of(w("1", "8")), 2).scale()).isEqualTo(2);
    }

    @Test
    void pooledIsNullWithNoDenominator() {
        assertThat(StatsTrend.pooled(List.of(), 2)).isNull();
        assertThat(StatsTrend.pooled(List.of(w("5", "0"), w("3", "0")), 2)).isNull();
    }

    @Test
    void noHintWhenAHalfHasNothingToDivideBy() {
        List<Weighted> points = new ArrayList<>(List.of(w("5", "0"), w("5", "0"), w("5", "0")));
        points.addAll(series(0, "0", 5, "4"));

        assertThat(StatsTrend.of(points, 2, BAND)).isNull();
    }

    /** The flat band is inclusive: a change of exactly 0.25 is flat, a hair more is a direction. */
    @ParameterizedTest
    @CsvSource({
        "4.25, FLAT",
        "4.26, UP",
        "3.75, FLAT",
        "3.74, DOWN",
        "4.00, FLAT",
        "5.00, UP",
        "3.00, DOWN"
    })
    void theFlatBandIsInclusive(String recentValue, Direction expected) {
        var hint = StatsTrend.of(series(3, "4.00", 5, recentValue), 2, BAND);

        assertThat(hint.direction()).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource({
        "30.5, FLAT",
        "30.6, UP",
        "29.5, FLAT",
        "29.4, DOWN"
    })
    void theDotBallBandOfHalfAPointIsInclusiveToo(String recentValue, Direction expected) {
        var hint = StatsTrend.of(series(3, "30.0", 5, recentValue), 1, new BigDecimal("0.5"));

        assertThat(hint.direction()).isEqualTo(expected);
    }

    @Test
    void theDirectionComparesTheRoundedFigures() {
        // pooled 4.2549 rounds to 4.25 against 4.00: exactly the band, so flat (unrounded it would be 0.2549, up)
        var hint = StatsTrend.of(series(3, "4.00", 5, "4.2549"), 2, BAND);

        assertThat(hint.recent()).isEqualByComparingTo("4.25");
        assertThat(hint.direction()).isEqualTo(Direction.FLAT);
    }
}
