package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** docs/specs/100-match-results-core.md: balls render as overs.balls, including a non-six ball over. */
class OversFormatTest {

    @Test
    void renders220BallsAtSixPerOverAs36Point4() {
        assertThat(OversFormat.display(220, 6)).isEqualTo("36.4");
    }

    @Test
    void rendersWholeOversAndZero() {
        assertThat(OversFormat.display(120, 6)).isEqualTo("20.0");
        assertThat(OversFormat.display(0, 6)).isEqualTo("0.0");
    }

    @Test
    void usesTheMatchsBallsPerOver() {
        assertThat(OversFormat.display(43, 8)).isEqualTo("5.3");
        assertThat(OversFormat.display(25, 5)).isEqualTo("5.0");
    }
}
