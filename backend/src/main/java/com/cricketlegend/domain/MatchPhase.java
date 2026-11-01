package com.cricketlegend.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;

/**
 * docs/specs/135: where a match is in its life, computed on the server clock and never stored. The one place the live
 * rule lives: a match is LIVE when it is active, has started, has no published result and now is before start plus
 * {@link #LIVE_WINDOW_HOURS}. A link (scoring or streaming) never decides it. A match with no start time counts as
 * {@link #DEFAULT_START} (owner decision 2026-11-02).
 */
public enum MatchPhase {
    LIVE,
    UPCOMING,
    RECENT;

    /** Owner decision 2026-11-02: one constant for every format. */
    public static final int LIVE_WINDOW_HOURS = 8;

    /** The start time used when a match has none. */
    public static final LocalTime DEFAULT_START = LocalTime.of(9, 0);

    /** The start instant of a match on the server clock; a null time counts as {@link #DEFAULT_START}. */
    public static Instant startOf(LocalDate date, LocalTime time) {
        return date.atTime(time == null ? DEFAULT_START : time).atZone(ZoneId.systemDefault()).toInstant();
    }

    public static MatchPhase of(boolean active, boolean hasPublishedResult, Instant start, Instant now) {
        if (hasPublishedResult) {
            return RECENT;
        }
        if (start.isAfter(now)) {
            return UPCOMING;
        }
        boolean withinWindow = now.isBefore(start.plusSeconds(LIVE_WINDOW_HOURS * 3600L));
        return active && withinWindow ? LIVE : RECENT;
    }
}
