package com.cricketlegend.service.support;

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
}
