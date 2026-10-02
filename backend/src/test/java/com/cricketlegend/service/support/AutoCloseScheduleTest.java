package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

/** docs/specs/064-unified-availability-polls.md: close time is kickoff minus 24h, or null when Autoclose is off. */
class AutoCloseScheduleTest {

    private static final Instant KICKOFF = Instant.parse("2026-10-10T09:00:00Z");

    @Test
    void autoCloseOnSchedulesTwentyFourHoursBeforeTheEarliestMatch() {
        assertThat(AutoCloseSchedule.scheduledCloseAt(true, KICKOFF)).isEqualTo(Instant.parse("2026-10-09T09:00:00Z"));
    }

    @Test
    void autoCloseOffReturnsNull() {
        assertThat(AutoCloseSchedule.scheduledCloseAt(false, KICKOFF)).isNull();
    }

    @Test
    void canReopenOnlyStrictlyBeforeTheCloseTimeUnlessAutoCloseIsOff() {
        Instant closeAt = Instant.parse("2026-10-09T09:00:00Z");

        assertThat(AutoCloseSchedule.canReopen(true, closeAt, closeAt.minusSeconds(1))).isTrue();
        assertThat(AutoCloseSchedule.canReopen(true, closeAt, closeAt)).isFalse();
        assertThat(AutoCloseSchedule.canReopen(true, closeAt, closeAt.plusSeconds(1))).isFalse();
        assertThat(AutoCloseSchedule.canReopen(false, null, closeAt)).isTrue();
        assertThat(AutoCloseSchedule.canReopen(true, null, closeAt)).isTrue();
    }
}
