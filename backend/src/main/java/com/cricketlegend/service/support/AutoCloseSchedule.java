package com.cricketlegend.service.support;

import com.cricketlegend.exception.InvalidCloseTimeException;
import java.time.Duration;
import java.time.Instant;

/**
 * The one place the autoclose rule lives (docs/specs/064-unified-availability-polls.md): a poll
 * with Autoclose on closes {@link #CLOSE_BEFORE_MATCH} before its earliest covered match's
 * kickoff; with Autoclose off it never closes by itself ({@code null}). Shared by the per-match
 * squad poll and the group poll so the 24-hour rule is not duplicated.
 */
public final class AutoCloseSchedule {

    public static final Duration CLOSE_BEFORE_MATCH = Duration.ofHours(24);

    private AutoCloseSchedule() {}

    /**
     * Whether a manual reopen is still allowed: always for a poll with no automatic close time
     * (Autoclose off), otherwise only strictly before {@code scheduledCloseAt}.
     */
    public static boolean canReopen(boolean autoClose, Instant scheduledCloseAt, Instant now) {
        return !autoClose || scheduledCloseAt == null || now.isBefore(scheduledCloseAt);
    }

    public static Instant scheduledCloseAt(boolean autoClose, Instant earliestMatchDate) {
        return autoClose ? earliestMatchDate.minus(CLOSE_BEFORE_MATCH) : null;
    }

    /**
     * The close time to store on create: an explicit {@code requested} time (Autoclose on) goes
     * through {@link #validateCloseTime}; when absent the default ({@link #scheduledCloseAt}, kickoff
     * minus 24h) is kept; Autoclose off always yields {@code null}.
     */
    public static Instant resolveCreateCloseTime(
            boolean autoClose, Instant requested, Instant earliestKickoff, Instant now) {
        if (autoClose && requested != null) {
            return validateCloseTime(true, requested, earliestKickoff, now);
        }
        return scheduledCloseAt(autoClose, earliestKickoff);
    }

    /**
     * The one close-time rule (docs/specs/066-poll-close-time-and-unified-cards.md), shared by the
     * create and edit paths of both poll kinds. Returns the value to store: {@code null} when
     * Autoclose is off (any supplied time is ignored), otherwise {@code scheduledCloseAt}.
     *
     * @throws InvalidCloseTimeException (400) when Autoclose is on and the time is missing, not
     *     strictly after {@code now}, or after {@code earliestKickoff} (equal to kickoff is allowed)
     */
    public static Instant validateCloseTime(
            boolean autoClose, Instant scheduledCloseAt, Instant earliestKickoff, Instant now) {
        if (!autoClose) {
            return null;
        }
        if (scheduledCloseAt == null) {
            throw new InvalidCloseTimeException("A closing time is required when Autoclose is on.");
        }
        if (!scheduledCloseAt.isAfter(now)) {
            throw new InvalidCloseTimeException("Choose a closing time in the future.");
        }
        if (earliestKickoff != null && scheduledCloseAt.isAfter(earliestKickoff)) {
            throw new InvalidCloseTimeException("Choose a closing time before the first match starts.");
        }
        return scheduledCloseAt;
    }
}
