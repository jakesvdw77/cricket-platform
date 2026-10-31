package com.cricketlegend.service.support.schedule;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads the {@code Time} cell and combines it with the date into an instant in the import's zone
 * (docs/specs/098-league-schedule-import.md, "Parsing rules"). Pure and stateless. Seconds and a date part are ignored;
 * there is no default time; 24:00 or more is an error; a local time that does not exist or is ambiguous at a daylight
 * saving change is an error.
 */
public final class ScheduleTimeParser {

    public static final String TIME_INVALID = "TIME_INVALID";

    private static final Pattern DATE_PART = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}[t ]\\s*(.*)$");
    private static final Pattern FRACTION = Pattern.compile("^0[.,]\\d{3,}$");
    private static final Pattern TWELVE_HOUR =
            Pattern.compile("^(\\d{1,2})(?:[:.h](\\d{2}))?(?::(\\d{2}))?\\s*([ap])\\.?\\s*m\\.?$");
    private static final Pattern TWENTY_FOUR_HOUR = Pattern.compile("^(\\d{1,2})\\s*[:.h]\\s*(\\d{2})(?::(\\d{2}))?$");
    private static final Pattern HOUR_ONLY = Pattern.compile("^(\\d{1,2})\\s*h$");

    private ScheduleTimeParser() {}

    /** {@code time} is null on an error; {@code errorCode} and {@code message} then say why. */
    public record Result(LocalTime time, String errorCode, String message) {

        public boolean ok() {
            return time != null;
        }

        static Result ok(LocalTime time) {
            return new Result(time, null, null);
        }

        static Result error(String message) {
            return new Result(null, TIME_INVALID, message);
        }
    }

    /** The combined instant, or an error when the local time falls in a daylight-saving gap or overlap. */
    public record InstantResult(Instant instant, String errorCode, String message) {

        public boolean ok() {
            return instant != null;
        }
    }

    /** Reads a cell value: a time, a date-time, an Excel number or text. */
    public static Result parse(Object cell) {
        if (cell == null) {
            return Result.error("The start time is missing.");
        }
        if (cell instanceof LocalTime t) {
            return Result.ok(t.withSecond(0).withNano(0));
        }
        if (cell instanceof LocalDateTime dt) {
            return Result.ok(dt.toLocalTime().withSecond(0).withNano(0));
        }
        if (cell instanceof Number n) {
            return fromNumber(n.doubleValue());
        }
        return parseText(cell.toString());
    }

    private static Result fromNumber(double value) {
        if (value < 0 || Double.isNaN(value)) {
            return Result.error("That number is not a time.");
        }
        // A whole number of days (1 is 24:00) carries no time of day at all.
        if (value >= 1 && Math.abs(value - Math.rint(value)) < 1e-9) {
            return Result.error("24:00 or later is not a valid start time. Use a time from 00:00 to 23:59.");
        }
        double fraction = value - Math.floor(value);
        int minutes = (int) Math.round(fraction * 1440);
        if (minutes >= 1440) {
            return Result.error("24:00 or later is not a valid start time. Use a time from 00:00 to 23:59.");
        }
        return Result.ok(LocalTime.of(minutes / 60, minutes % 60));
    }

    /** Reads cell text: {@code 14:30}, {@code 8.00}, {@code 14h30}, {@code 2:30 pm}, {@code 08:00:00}. */
    public static Result parseText(String text) {
        if (text == null || text.trim().isEmpty()) {
            return Result.error("The start time is missing.");
        }
        String s = text.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        Matcher datePart = DATE_PART.matcher(s);
        if (datePart.matches()) {
            s = datePart.group(1).trim();
            if (s.isEmpty()) {
                return Result.error("The start time is missing.");
            }
        }
        if (FRACTION.matcher(s).matches()) {
            return fromNumber(Double.parseDouble(s.replace(',', '.')));
        }
        Matcher twelve = TWELVE_HOUR.matcher(s);
        if (twelve.matches()) {
            int hour = Integer.parseInt(twelve.group(1));
            int minute = twelve.group(2) == null ? 0 : Integer.parseInt(twelve.group(2));
            int second = twelve.group(3) == null ? 0 : Integer.parseInt(twelve.group(3));
            if (hour < 1 || hour > 12 || minute > 59 || second > 59) {
                return unreadable(text);
            }
            boolean pm = "p".equals(twelve.group(4));
            return Result.ok(LocalTime.of(hour % 12 + (pm ? 12 : 0), minute));
        }
        Matcher full = TWENTY_FOUR_HOUR.matcher(s);
        if (full.matches()) {
            return twentyFour(text, Integer.parseInt(full.group(1)), Integer.parseInt(full.group(2)),
                    full.group(3) == null ? 0 : Integer.parseInt(full.group(3)));
        }
        Matcher hourOnly = HOUR_ONLY.matcher(s);
        if (hourOnly.matches()) {
            return twentyFour(text, Integer.parseInt(hourOnly.group(1)), 0, 0);
        }
        return unreadable(text);
    }

    private static Result twentyFour(String text, int hour, int minute, int second) {
        if (hour >= 24) {
            return Result.error(hour == 24 && minute == 0
                    ? "24:00 is not a valid start time. Use 00:00 for midnight."
                    : "The hour must be 0 to 23.");
        }
        if (minute > 59 || second > 59) {
            return unreadable(text);
        }
        return Result.ok(LocalTime.of(hour, minute));
    }

    private static Result unreadable(String text) {
        return Result.error("Could not read '" + text.trim() + "' as a time. Use a time such as 14:30 or 2:30 pm.");
    }

    /** Combines a local date and time in the zone; a gap or an overlap at a clock change is an error. */
    public static InstantResult toInstant(LocalDate date, LocalTime time, ZoneId zone) {
        LocalDateTime local = LocalDateTime.of(date, time.withSecond(0).withNano(0));
        List<java.time.ZoneOffset> offsets = zone.getRules().getValidOffsets(local);
        if (offsets.isEmpty()) {
            return new InstantResult(null, TIME_INVALID,
                    "That start time does not exist on that date because the clocks change; choose another time.");
        }
        if (offsets.size() > 1) {
            return new InstantResult(null, TIME_INVALID,
                    "That start time happens twice on that date because the clocks change; choose another time.");
        }
        return new InstantResult(local.toInstant(offsets.get(0)), null, null);
    }
}
