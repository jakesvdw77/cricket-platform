package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/** docs/specs/117-stats-dashboard.md, "Caps and ordering": the named limits are the numbers the spec states. */
class DashboardLimitsTest {

    @Test
    void theWindowCapAndReadSizeAreThirtyThreeHundredAndOneMore() {
        assertThat(DashboardLimits.POINT_LIMIT).isEqualTo(30);
        assertThat(DashboardLimits.HISTORY_CAP).isEqualTo(300);
        assertThat(DashboardLimits.HISTORY_READ).isEqualTo(301);
    }

    @Test
    void theTrendSpanMinimumAndFlatBandsAreTheSpecifiedOnes() {
        assertThat(DashboardLimits.TREND_SPAN).isEqualTo(5);
        assertThat(DashboardLimits.TREND_MIN_PER_HALF).isEqualTo(3);
        assertThat(DashboardLimits.ECONOMY_FLAT_BAND).isEqualByComparingTo(new BigDecimal("0.25"));
        assertThat(DashboardLimits.DOT_PERCENT_FLAT_BAND).isEqualByComparingTo(new BigDecimal("0.5"));
    }
}
