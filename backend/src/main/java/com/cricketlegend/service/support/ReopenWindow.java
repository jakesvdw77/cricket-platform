package com.cricketlegend.service.support;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;

/**
 * The one place the "matches in the past" reopen rule lives (docs/specs/082-poll-card-improvements.md):
 * a poll (squad poll or group round) can be reopened only while {@code now <= latest + 24 hours},
 * where {@code latest} is the start of the poll's latest match. A group round's window that
 * somehow has no match falls back to the end of its window date in the server zone ({@link
 * ZoneId#systemDefault()}, the same convention as {@link MatchSlots} and {@link ServerClock}). This
 * rule is in addition to {@link AutoCloseSchedule#canReopen}; both must hold. Used by both
 * services' {@code open} and by the {@code canReopen} flag on the poll DTOs, so the UI never offers
 * what the server refuses.
 */
public final class ReopenWindow {

    /** How long after its latest match started a poll can still be reopened. */
    public static final Duration GRACE = Duration.ofHours(24);

    public static final String REFUSED_MESSAGE =
            "This poll can no longer be reopened because its matches are in the past.";

    private ReopenWindow() {}

    /**
     * The anchor instant for a poll: the latest of its matches' start times and, for any window
     * without a match, the end of that window's date. {@code null} when there is nothing to anchor
     * on (no matches and no windows), which never blocks a reopen.
     */
    public static Instant latestStart(Collection<Instant> matchStarts, Collection<LocalDate> matchlessWindowDates) {
        return latestStart(matchStarts, matchlessWindowDates, ZoneId.systemDefault());
    }

    static Instant latestStart(
            Collection<Instant> matchStarts, Collection<LocalDate> matchlessWindowDates, ZoneId zone) {
        Instant latest = null;
        for (Instant start : matchStarts) {
            if (start != null && (latest == null || start.isAfter(latest))) {
                latest = start;
            }
        }
        for (LocalDate date : matchlessWindowDates) {
            if (date == null) {
                continue;
            }
            Instant endOfDay = date.plusDays(1).atStartOfDay(zone).toInstant();
            if (latest == null || endOfDay.isAfter(latest)) {
                latest = endOfDay;
            }
        }
        return latest;
    }

    /** Whether a reopen is allowed now: always when there is no anchor, else {@code now <= latest + 24h}. */
    public static boolean allows(Instant latestStart, Instant now) {
        return latestStart == null || !now.isAfter(latestStart.plus(GRACE));
    }

    public static boolean allows(Instant latestStart, Clock clock) {
        return allows(latestStart, clock.instant());
    }
}
