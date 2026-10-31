package com.cricketlegend.service.support.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

/** docs/specs/098, "Parsing rules": the accepted time forms, the 24:00 error and the daylight-saving errors. */
class ScheduleTimeParserTest {

    @Test
    void acceptedTextForms() {
        assertThat(ScheduleTimeParser.parseText("08:00").time()).isEqualTo(LocalTime.of(8, 0));
        assertThat(ScheduleTimeParser.parseText("8.00").time()).isEqualTo(LocalTime.of(8, 0));
        assertThat(ScheduleTimeParser.parseText("14h30").time()).isEqualTo(LocalTime.of(14, 30));
        assertThat(ScheduleTimeParser.parseText("14h").time()).isEqualTo(LocalTime.of(14, 0));
        assertThat(ScheduleTimeParser.parseText("2:30 pm").time()).isEqualTo(LocalTime.of(14, 30));
        assertThat(ScheduleTimeParser.parseText("2.30PM").time()).isEqualTo(LocalTime.of(14, 30));
        assertThat(ScheduleTimeParser.parseText("12:15 am").time()).isEqualTo(LocalTime.of(0, 15));
        assertThat(ScheduleTimeParser.parseText("12 pm").time()).isEqualTo(LocalTime.NOON);
        assertThat(ScheduleTimeParser.parseText("08:00:45").time()).isEqualTo(LocalTime.of(8, 0));
        assertThat(ScheduleTimeParser.parseText("2026-09-13 08:00").time()).isEqualTo(LocalTime.of(8, 0));
    }

    @Test
    void excelFractionOfADayIsRead() {
        assertThat(ScheduleTimeParser.parse(0.5).time()).isEqualTo(LocalTime.NOON);
        assertThat(ScheduleTimeParser.parse(0.3333333333).time()).isEqualTo(LocalTime.of(8, 0));
        assertThat(ScheduleTimeParser.parseText("0.6041667").time()).isEqualTo(LocalTime.of(14, 30));
    }

    @Test
    void typedTemporalValuesDropSeconds() {
        assertThat(ScheduleTimeParser.parse(LocalTime.of(9, 5, 33)).time()).isEqualTo(LocalTime.of(9, 5));
        assertThat(ScheduleTimeParser.parse(LocalDate.of(2026, 9, 13).atTime(9, 5, 33)).time())
                .isEqualTo(LocalTime.of(9, 5));
    }

    @Test
    void twentyFourHundredAndLaterAreErrors() {
        assertThat(ScheduleTimeParser.parseText("24:00").message()).contains("24:00");
        assertThat(ScheduleTimeParser.parseText("25:10").ok()).isFalse();
        assertThat(ScheduleTimeParser.parse(1.0).ok()).isFalse();
        assertThat(ScheduleTimeParser.parse(-0.2).ok()).isFalse();
    }

    @Test
    void blankAndUnreadableAreErrorsWithTheCode() {
        assertThat(ScheduleTimeParser.parseText("").errorCode()).isEqualTo(ScheduleTimeParser.TIME_INVALID);
        assertThat(ScheduleTimeParser.parseText(null).ok()).isFalse();
        assertThat(ScheduleTimeParser.parse(null).ok()).isFalse();
        assertThat(ScheduleTimeParser.parseText("after lunch").message()).contains("Could not read");
        assertThat(ScheduleTimeParser.parseText("13:75").ok()).isFalse();
        assertThat(ScheduleTimeParser.parseText("13 pm").ok()).isFalse();
    }

    @Test
    void toInstantUsesTheZone() {
        ScheduleTimeParser.InstantResult r = ScheduleTimeParser.toInstant(LocalDate.of(2026, 9, 13),
                LocalTime.of(8, 0), ZoneId.of("Africa/Johannesburg"));
        assertThat(r.instant()).isEqualTo(Instant.parse("2026-09-13T06:00:00Z"));
    }

    @Test
    void aTimeInADaylightSavingGapIsAnError() {
        // London clocks went forward at 01:00 on 29 March 2026: 01:30 does not exist.
        ScheduleTimeParser.InstantResult r = ScheduleTimeParser.toInstant(LocalDate.of(2026, 3, 29),
                LocalTime.of(1, 30), ZoneId.of("Europe/London"));
        assertThat(r.ok()).isFalse();
        assertThat(r.errorCode()).isEqualTo(ScheduleTimeParser.TIME_INVALID);
        assertThat(r.message()).contains("does not exist");
    }

    @Test
    void aTimeInADaylightSavingOverlapIsAnError() {
        // London clocks went back at 02:00 on 25 October 2026: 01:30 happens twice.
        ScheduleTimeParser.InstantResult r = ScheduleTimeParser.toInstant(LocalDate.of(2026, 10, 25),
                LocalTime.of(1, 30), ZoneId.of("Europe/London"));
        assertThat(r.ok()).isFalse();
        assertThat(r.message()).contains("twice");
    }
}
