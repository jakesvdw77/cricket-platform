package com.cricketlegend.service.support.schedule;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Month;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads the {@code Date} cell of a league schedule file (docs/specs/098-league-schedule-import.md, "Parsing rules").
 * Pure and stateless. Numeric dates are day first only; a month-first form is an error, never reinterpreted. The
 * once-per-file notes (two-digit years, day-first ambiguity) are decided by {@link #fileNotes}, from the per-cell flags.
 */
public final class ScheduleDateParser {

    public static final String DATE_INVALID = "DATE_INVALID";

    private static final long SERIAL_MIN = 20000;
    private static final long SERIAL_MAX = 80000;
    private static final LocalDate EXCEL_EPOCH = LocalDate.of(1899, 12, 30);

    private static final Pattern WEEKDAY_PREFIX =
            Pattern.compile("^(mon|tue|wed|thu|fri|sat|sun)[a-z]*[.,]?\\s*", Pattern.CASE_INSENSITIVE);
    private static final Pattern SERIAL = Pattern.compile("^(\\d{5})(?:[.,]\\d+)?$");
    private static final Pattern YEAR_FIRST =
            Pattern.compile("^(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})(?:[T ].*)?$");
    private static final Pattern NUMERIC = Pattern.compile("^(\\d{1,2})[/\\-.](\\d{1,2})[/\\-.](\\d{4}|\\d{2})$");
    private static final Pattern NUMERIC_NO_YEAR = Pattern.compile("^(\\d{1,2})[/\\-.](\\d{1,2})$");
    private static final Pattern MONTH_NAME =
            Pattern.compile("^(\\d{1,2})[\\s\\-./,]*([A-Za-z]{3,})\\.?(?:[\\s\\-./,]*(\\d{4}|\\d{2}))?$");
    private static final Pattern MONTH_FIRST =
            Pattern.compile("^([A-Za-z]{3,})\\.?[\\s\\-./,]*(\\d{1,2})(?:[\\s\\-./,]+(\\d{4}|\\d{2}))?$");
    private static final Pattern ORDINAL = Pattern.compile("(?<=\\d)(?:st|nd|rd|th)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern OF_WORD = Pattern.compile("\\s+of\\s+", Pattern.CASE_INSENSITIVE);

    private static final Map<String, DayOfWeek> WEEKDAYS = Map.of(
            "mon", DayOfWeek.MONDAY, "tue", DayOfWeek.TUESDAY, "wed", DayOfWeek.WEDNESDAY, "thu", DayOfWeek.THURSDAY,
            "fri", DayOfWeek.FRIDAY, "sat", DayOfWeek.SATURDAY, "sun", DayOfWeek.SUNDAY);

    private ScheduleDateParser() {}

    /**
     * One cell read. {@code date} is null on an error ({@code errorCode} and {@code message} then say why, in plain
     * English). The flags feed the file-level notes and the weekday check; {@code weekday} is the weekday word that was
     * written in the cell, if any.
     */
    public record Result(
            LocalDate date,
            String errorCode,
            String message,
            boolean twoDigitYear,
            boolean yearInferred,
            boolean excelSerial,
            boolean numericText,
            boolean ambiguousOrder,
            DayOfWeek weekday,
            String raw) {

        public boolean ok() {
            return date != null;
        }

        static Result error(String message, String raw) {
            return new Result(null, DATE_INVALID, message, false, false, false, false, false, null, raw);
        }
    }

    /**
     * The season the file is for, used only to complete a date written without a year. Either end may be null; with both
     * null no year is inferred and a missing year stays an error.
     */
    public record YearContext(LocalDate seasonStart, LocalDate seasonEnd) {

        boolean usable() {
            return seasonStart != null || seasonEnd != null;
        }
    }

    /** A once-per-file note computed from every cell. {@code warning} true means it must be acknowledged. */
    public record FileNote(String code, boolean warning, List<Integer> rowIndexes, String message) {}

    /** Reads a cell value: a date, a date-time, an Excel number or text. */
    public static Result parse(Object cell) {
        return parse(cell, null);
    }

    /** As {@link #parse(Object)}, completing a missing year from the season in {@code context} (may be null). */
    public static Result parse(Object cell, YearContext context) {
        if (cell == null) {
            return Result.error("The date is missing.", "");
        }
        if (cell instanceof LocalDate d) {
            return new Result(d, null, null, false, false, false, false, false, null, d.toString());
        }
        if (cell instanceof LocalDateTime dt) {
            LocalDate d = dt.toLocalDate();
            return new Result(d, null, null, false, false, false, false, false, null, d.toString());
        }
        if (cell instanceof Number n) {
            return fromNumber(n.doubleValue(), String.valueOf(n));
        }
        return parseText(cell.toString(), context);
    }

    private static Result fromNumber(double value, String raw) {
        if (value >= SERIAL_MIN && value < SERIAL_MAX) {
            return serial((long) Math.floor(value), raw);
        }
        return Result.error("That number is not a date. Use a date such as 2026-09-13 or 13 Sep 2026.", raw);
    }

    private static Result serial(long days, String raw) {
        return new Result(EXCEL_EPOCH.plusDays(days), null, null, false, false, true, false, false, null, raw);
    }

    /** Reads cell text. */
    public static Result parseText(String text) {
        return parseText(text, null);
    }

    /** Reads cell text, completing a missing year from the season in {@code context} (may be null). */
    public static Result parseText(String text, YearContext context) {
        if (text == null || text.trim().isEmpty()) {
            return Result.error("The date is missing.", "");
        }
        String raw = text.trim().replaceAll("\\s+", " ");
        String s = raw;
        DayOfWeek weekday = null;
        Matcher prefix = WEEKDAY_PREFIX.matcher(s);
        if (prefix.find() && prefix.end() < s.length()) {
            weekday = WEEKDAYS.get(prefix.group(1).toLowerCase(Locale.ROOT));
            s = s.substring(prefix.end()).trim();
        }
        s = OF_WORD.matcher(ORDINAL.matcher(s).replaceAll("")).replaceAll(" ").trim();

        Matcher serial = SERIAL.matcher(s);
        if (serial.matches()) {
            long days = Long.parseLong(serial.group(1));
            if (days >= SERIAL_MIN && days < SERIAL_MAX) {
                Result r = serial(days, raw);
                return withWeekday(r, weekday);
            }
        }

        Matcher iso = YEAR_FIRST.matcher(s);
        if (iso.matches()) {
            return build(raw, weekday, Integer.parseInt(iso.group(3)), Integer.parseInt(iso.group(2)), iso.group(1), false, context);
        }
        Matcher numeric = NUMERIC.matcher(s);
        if (numeric.matches()) {
            return build(raw, weekday, Integer.parseInt(numeric.group(1)), Integer.parseInt(numeric.group(2)),
                    numeric.group(3), true, context);
        }
        Matcher noYear = NUMERIC_NO_YEAR.matcher(s);
        if (noYear.matches() && context != null && context.usable()) {
            return build(raw, weekday, Integer.parseInt(noYear.group(1)), Integer.parseInt(noYear.group(2)), null, true,
                    context);
        }
        Matcher named = MONTH_NAME.matcher(s);
        if (named.matches()) {
            Month month = month(named.group(2));
            if (month == null) {
                return Result.error("'" + named.group(2) + "' is not a month name.", raw);
            }
            return build(raw, weekday, Integer.parseInt(named.group(1)), month.getValue(), named.group(3), false,
                    context);
        }
        Matcher first = MONTH_FIRST.matcher(s);
        if (first.matches()) {
            Month month = month(first.group(1));
            if (month == null) {
                return Result.error("'" + first.group(1) + "' is not a month name.", raw);
            }
            return build(raw, weekday, Integer.parseInt(first.group(2)), month.getValue(), first.group(3), false,
                    context);
        }
        return Result.error("Could not read '" + raw + "' as a date. Use a date such as 2026-09-13, 13/09/2026 or "
                + "13 Sep 2026 (the year is required).", raw);
    }

    private static Result withWeekday(Result r, DayOfWeek weekday) {
        return new Result(r.date(), null, null, r.twoDigitYear(), r.yearInferred(), r.excelSerial(), r.numericText(), r.ambiguousOrder(),
                weekday, r.raw());
    }

    private static Result build(
            String raw, DayOfWeek weekday, int day, int month, String yearText, boolean numeric, YearContext context) {
        if (month < 1 || month > 12) {
            return Result.error("Month cannot be " + month + ". Dates are read day first (day/month/year), so "
                    + "'" + raw + "' cannot be read.", raw);
        }
        boolean twoDigit = yearText != null && yearText.length() == 2;
        boolean inferred = yearText == null;
        int year;
        if (inferred) {
            if (context == null || !context.usable()) {
                return Result.error("Could not read '" + raw + "' as a date. Use a date such as 2026-09-13, 13/09/2026 "
                        + "or 13 Sep 2026 (the year is required).", raw);
            }
            year = inferYear(day, month, context);
        } else {
            year = twoDigit ? 2000 + Integer.parseInt(yearText) : Integer.parseInt(yearText);
        }
        if (year < 1900 || year > 2200) {
            return Result.error("The year " + year + " is not valid.", raw);
        }
        YearMonth ym = YearMonth.of(year, month);
        if (day < 1 || day > ym.lengthOfMonth()) {
            return Result.error("There is no " + day + " " + Month.of(month).getDisplayName(TextStyle.FULL, Locale.ENGLISH)
                    + " " + year + ".", raw);
        }
        boolean ambiguous = numeric && day <= 12 && day != month;
        return new Result(LocalDate.of(year, month, day), null, null, twoDigit, inferred, false, numeric, ambiguous,
                weekday, raw);
    }

    /**
     * The year, from the season years, in which day and month fall inside the season; otherwise the first season year
     * in which the date exists (so the season check reports it), otherwise the season start year (an error follows).
     */
    private static int inferYear(int day, int month, YearContext context) {
        int from = context.seasonStart() != null ? context.seasonStart().getYear() : context.seasonEnd().getYear();
        int to = context.seasonEnd() != null ? context.seasonEnd().getYear() : from;
        if (to < from || to - from > 5) {
            to = from;
        }
        Integer firstValid = null;
        for (int y = from; y <= to; y++) {
            if (month < 1 || month > 12 || day < 1 || day > YearMonth.of(y, month).lengthOfMonth()) {
                continue;
            }
            LocalDate d = LocalDate.of(y, month, day);
            boolean inside = (context.seasonStart() == null || !d.isBefore(context.seasonStart()))
                    && (context.seasonEnd() == null || !d.isAfter(context.seasonEnd()));
            if (inside) {
                return y;
            }
            if (firstValid == null) {
                firstValid = y;
            }
        }
        return firstValid != null ? firstValid : from;
    }

    /** First three letters name the month; the word must be a prefix of the full English name ("Sept", "Marc"). */
    private static Month month(String word) {
        String w = word.toLowerCase(Locale.ROOT);
        for (Month m : Month.values()) {
            String full = m.getDisplayName(TextStyle.FULL, Locale.ENGLISH).toLowerCase(Locale.ROOT);
            if (w.length() >= 3 && full.startsWith(w)) {
                return m;
            }
        }
        return null;
    }

    /**
     * The once-per-file notes over all parsed cells in row order (pass only the rows that count):
     * {@code DATE_TWO_DIGIT_YEAR} (a note) when any year was two digits, and {@code DATE_DAY_FIRST} (a warning) when
     * numeric dates exist, at least one is readable both ways and none has a day above 12 that proves day-first.
     * {@code rowIndexes} are positions in the list passed in.
     */
    public static List<FileNote> fileNotes(List<Result> results) {
        List<Integer> twoDigit = new java.util.ArrayList<>();
        List<Integer> ambiguous = new java.util.ArrayList<>();
        List<Integer> inferred = new java.util.ArrayList<>();
        boolean provenDayFirst = false;
        String example = null;
        for (int i = 0; i < results.size(); i++) {
            Result r = results.get(i);
            if (r == null || !r.ok()) {
                continue;
            }
            if (r.twoDigitYear()) {
                twoDigit.add(i);
            }
            if (r.yearInferred()) {
                inferred.add(i);
            }
            if (r.numericText()) {
                if (r.date().getDayOfMonth() > 12) {
                    provenDayFirst = true;
                }
                if (r.ambiguousOrder()) {
                    ambiguous.add(i);
                    if (example == null) {
                        example = r.raw() + " is " + r.date().getDayOfMonth() + " "
                                + r.date().getMonth().getDisplayName(TextStyle.FULL, Locale.ENGLISH);
                    }
                }
            }
        }
        List<FileNote> notes = new java.util.ArrayList<>();
        if (!twoDigit.isEmpty()) {
            notes.add(new FileNote("DATE_TWO_DIGIT_YEAR", false, twoDigit, "Two-digit years were read as 20yy."));
        }
        if (!inferred.isEmpty()) {
            notes.add(new FileNote("DATE_YEAR_INFERRED", false, inferred,
                    "The year was taken from the season for dates written without one."));
        }
        if (!ambiguous.isEmpty() && !provenDayFirst) {
            notes.add(new FileNote("DATE_DAY_FIRST", true, ambiguous,
                    "Dates were read day first; check " + example + "."));
        }
        return notes;
    }
}
