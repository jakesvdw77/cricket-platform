package com.cricketlegend.service.support.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.service.support.schedule.ScheduleDateParser.FileNote;
import com.cricketlegend.service.support.schedule.ScheduleDateParser.Result;
import com.cricketlegend.service.support.schedule.ScheduleDateParser.YearContext;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

/** docs/specs/098, "Parsing rules": every accepted date format, day-first only, and the once-per-file notes. */
class ScheduleDateParserTest {

    private static final LocalDate SUNDAY = LocalDate.of(2026, 9, 13);

    @Test
    void sourceSheetFormatWithSeptAndTwoDigitYearIsRead() {
        Result r = ScheduleDateParser.parseText("13-Sept-26");
        assertThat(r.date()).isEqualTo(SUNDAY);
        assertThat(r.twoDigitYear()).isTrue();
    }

    @Test
    void longMonthNameIsRead() {
        assertThat(ScheduleDateParser.parseText("13 September 2026").date()).isEqualTo(SUNDAY);
        assertThat(ScheduleDateParser.parseText("13th of September 2026").date()).isEqualTo(SUNDAY);
        assertThat(ScheduleDateParser.parseText("13 sep 2026").date()).isEqualTo(SUNDAY);
    }

    @Test
    void monthFirstWithNameIsRead() {
        assertThat(ScheduleDateParser.parseText("September 13, 2026").date()).isEqualTo(SUNDAY);
    }

    @Test
    void numericDatesAreDayFirst() {
        assertThat(ScheduleDateParser.parseText("13/9/26").date()).isEqualTo(SUNDAY);
        assertThat(ScheduleDateParser.parseText("13/09/2026").date()).isEqualTo(SUNDAY);
        assertThat(ScheduleDateParser.parseText("13-09-2026").date()).isEqualTo(SUNDAY);
        assertThat(ScheduleDateParser.parseText("13.09.2026").date()).isEqualTo(SUNDAY);
        // 9/10 is the 9th of October, never the 10th of September
        assertThat(ScheduleDateParser.parseText("9/10/2026").date()).isEqualTo(LocalDate.of(2026, 10, 9));
    }

    @Test
    void isoAndDateTimeTextAreRead() {
        assertThat(ScheduleDateParser.parseText("2026-09-13").date()).isEqualTo(SUNDAY);
        assertThat(ScheduleDateParser.parseText("2026-09-13T08:00:00").date()).isEqualTo(SUNDAY);
        assertThat(ScheduleDateParser.parse(SUNDAY).date()).isEqualTo(SUNDAY);
        assertThat(ScheduleDateParser.parse(SUNDAY.atTime(8, 0)).date()).isEqualTo(SUNDAY);
    }

    @Test
    void excelSerialNumberIsReadAndFlagged() {
        long serial = java.time.temporal.ChronoUnit.DAYS.between(LocalDate.of(1899, 12, 30), SUNDAY);
        Result fromNumber = ScheduleDateParser.parse((double) serial);
        assertThat(fromNumber.date()).isEqualTo(SUNDAY);
        assertThat(fromNumber.excelSerial()).isTrue();
        assertThat(ScheduleDateParser.parseText(String.valueOf(serial)).date()).isEqualTo(SUNDAY);
    }

    @Test
    void aSmallNumberIsNotADate() {
        Result r = ScheduleDateParser.parse(12.0);
        assertThat(r.ok()).isFalse();
        assertThat(r.errorCode()).isEqualTo(ScheduleDateParser.DATE_INVALID);
    }

    @Test
    void weekdayPrefixIsAcceptedAndReported() {
        Result short3 = ScheduleDateParser.parseText("Sun 13 Sep 2026");
        assertThat(short3.date()).isEqualTo(SUNDAY);
        assertThat(short3.weekday()).isEqualTo(DayOfWeek.SUNDAY);
        Result full = ScheduleDateParser.parseText("Sunday, 13 September 2026");
        assertThat(full.date()).isEqualTo(SUNDAY);
        assertThat(full.weekday()).isEqualTo(DayOfWeek.SUNDAY);
    }

    @Test
    void monthThirteenIsAnErrorNeverReinterpretedAsMonthFirst() {
        Result r = ScheduleDateParser.parseText("09/13/2026");
        assertThat(r.ok()).isFalse();
        assertThat(r.errorCode()).isEqualTo(ScheduleDateParser.DATE_INVALID);
        assertThat(r.message()).contains("Month cannot be 13");
    }

    @Test
    void impossibleDayAndUnknownMonthAreErrors() {
        assertThat(ScheduleDateParser.parseText("31 Sep 2026").ok()).isFalse();
        assertThat(ScheduleDateParser.parseText("29/02/2027").ok()).isFalse();
        assertThat(ScheduleDateParser.parseText("29/02/2028").ok()).isTrue();
        assertThat(ScheduleDateParser.parseText("13 Foo 2026").message()).contains("not a month name");
    }

    @Test
    void blankAndGarbageAreErrors() {
        assertThat(ScheduleDateParser.parseText("  ").message()).isEqualTo("The date is missing.");
        assertThat(ScheduleDateParser.parseText(null).ok()).isFalse();
        assertThat(ScheduleDateParser.parse(null).ok()).isFalse();
        assertThat(ScheduleDateParser.parseText("next sunday").ok()).isFalse();
    }

    @Test
    void twoDigitYearsAreAlwaysTwentyYy() {
        assertThat(ScheduleDateParser.parseText("13/9/26").date().getYear()).isEqualTo(2026);
        assertThat(ScheduleDateParser.parseText("13/9/99").date().getYear()).isEqualTo(2099);
        assertThat(ScheduleDateParser.parseText("13/9/00").date().getYear()).isEqualTo(2000);
    }

    @Test
    void aMissingYearIsCompletedFromTheSeasonOnlyWhenOneIsGiven() {
        YearContext season = new YearContext(LocalDate.of(2026, 10, 1), LocalDate.of(2027, 3, 31));
        assertThat(ScheduleDateParser.parseText("15 Nov", season).date()).isEqualTo(LocalDate.of(2026, 11, 15));
        assertThat(ScheduleDateParser.parseText("15 Feb", season).date()).isEqualTo(LocalDate.of(2027, 2, 15));
        assertThat(ScheduleDateParser.parseText("15 Feb", season).yearInferred()).isTrue();
        assertThat(ScheduleDateParser.parseText("15 Nov").ok()).isFalse();
    }

    @Test
    void fileNotesCarryTheTwoDigitYearNoteAndTheDayFirstWarning() {
        List<Result> ambiguous = List.of(ScheduleDateParser.parseText("3/4/26"), ScheduleDateParser.parseText("5/6/26"));
        List<FileNote> notes = ScheduleDateParser.fileNotes(ambiguous);
        assertThat(notes).extracting(FileNote::code).containsExactly("DATE_TWO_DIGIT_YEAR", "DATE_DAY_FIRST");
        assertThat(notes.get(0).warning()).isFalse();
        assertThat(notes.get(1).warning()).isTrue();
        assertThat(notes.get(1).rowIndexes()).containsExactly(0, 1);
    }

    @Test
    void aDayAboveTwelveProvesDayFirstSoNoWarningIsRaised() {
        List<Result> proven = List.of(ScheduleDateParser.parseText("3/4/2026"), ScheduleDateParser.parseText("13/4/2026"));
        assertThat(ScheduleDateParser.fileNotes(proven)).isEmpty();
    }

    @Test
    void errorsAndTextDatesRaiseNoNotes() {
        assertThat(ScheduleDateParser.fileNotes(List.of(ScheduleDateParser.parseText("garbage"),
                ScheduleDateParser.parseText("13 September 2026")))).isEmpty();
    }
}
