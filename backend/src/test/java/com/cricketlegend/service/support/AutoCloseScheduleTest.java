package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.exception.InvalidCloseTimeException;
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

    private static final Instant NOW = Instant.parse("2026-10-01T09:00:00Z");

    @Test
    void validateCloseTimeAcceptsAFutureTimeBeforeKickoffAndReturnsIt() {
        Instant closeAt = Instant.parse("2026-10-05T09:00:00Z");

        assertThat(AutoCloseSchedule.validateCloseTime(true, closeAt, KICKOFF, NOW)).isEqualTo(closeAt);
    }

    @Test
    void validateCloseTimeAllowsATimeEqualToKickoff() {
        assertThat(AutoCloseSchedule.validateCloseTime(true, KICKOFF, KICKOFF, NOW)).isEqualTo(KICKOFF);
    }

    @Test
    void validateCloseTimeAllowsOneSecondAfterNow() {
        Instant closeAt = NOW.plusSeconds(1);

        assertThat(AutoCloseSchedule.validateCloseTime(true, closeAt, KICKOFF, NOW)).isEqualTo(closeAt);
    }

    @Test
    void validateCloseTimeAutoCloseOffStoresNullAndIgnoresWhateverWasSent() {
        assertThat(AutoCloseSchedule.validateCloseTime(false, null, KICKOFF, NOW)).isNull();
        assertThat(AutoCloseSchedule.validateCloseTime(false, NOW.minusSeconds(60), KICKOFF, NOW)).isNull();
        assertThat(AutoCloseSchedule.validateCloseTime(false, KICKOFF.plusSeconds(60), KICKOFF, NOW)).isNull();
    }

    @Test
    void validateCloseTimeRejectsAMissingTimeWhenAutoCloseIsOn() {
        assertThatThrownBy(() -> AutoCloseSchedule.validateCloseTime(true, null, KICKOFF, NOW))
                .isInstanceOf(InvalidCloseTimeException.class)
                .hasMessage("A closing time is required when Autoclose is on.");
    }

    @Test
    void validateCloseTimeRejectsATimeEqualToNowAsPast() {
        assertThatThrownBy(() -> AutoCloseSchedule.validateCloseTime(true, NOW, KICKOFF, NOW))
                .isInstanceOf(InvalidCloseTimeException.class)
                .hasMessage("Choose a closing time in the future.");
    }

    @Test
    void validateCloseTimeRejectsATimeBeforeNow() {
        assertThatThrownBy(() -> AutoCloseSchedule.validateCloseTime(true, NOW.minusSeconds(1), KICKOFF, NOW))
                .isInstanceOf(InvalidCloseTimeException.class)
                .hasMessage("Choose a closing time in the future.");
    }

    @Test
    void validateCloseTimeRejectsATimeAfterKickoff() {
        assertThatThrownBy(() -> AutoCloseSchedule.validateCloseTime(true, KICKOFF.plusSeconds(1), KICKOFF, NOW))
                .isInstanceOf(InvalidCloseTimeException.class)
                .hasMessage("Choose a closing time before the first match starts.");
    }

    @Test
    void resolveCreateCloseTimeUsesAnExplicitValidTime() {
        Instant closeAt = Instant.parse("2026-10-05T09:00:00Z");

        assertThat(AutoCloseSchedule.resolveCreateCloseTime(true, closeAt, KICKOFF, NOW)).isEqualTo(closeAt);
    }

    @Test
    void resolveCreateCloseTimeDefaultsToTwentyFourHoursBeforeKickoffWhenAbsent() {
        assertThat(AutoCloseSchedule.resolveCreateCloseTime(true, null, KICKOFF, NOW))
                .isEqualTo(Instant.parse("2026-10-09T09:00:00Z"));
    }

    @Test
    void resolveCreateCloseTimeIsNullWhenAutoCloseIsOffEvenIfATimeIsSent() {
        assertThat(AutoCloseSchedule.resolveCreateCloseTime(false, Instant.parse("2026-10-05T09:00:00Z"), KICKOFF, NOW))
                .isNull();
    }

    @Test
    void resolveCreateCloseTimeRejectsAnExplicitPastOrTooLateTime() {
        assertThatThrownBy(() -> AutoCloseSchedule.resolveCreateCloseTime(true, NOW, KICKOFF, NOW))
                .isInstanceOf(InvalidCloseTimeException.class);
        assertThatThrownBy(() -> AutoCloseSchedule.resolveCreateCloseTime(true, KICKOFF.plusSeconds(1), KICKOFF, NOW))
                .isInstanceOf(InvalidCloseTimeException.class);
    }
}
