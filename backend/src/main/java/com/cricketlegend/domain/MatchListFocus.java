package com.cricketlegend.domain;

import com.cricketlegend.exception.ValidationException;
import java.util.Locale;

/**
 * The quick filter behind a Matches counter (docs/specs/087-matches-polls-alignment.md): the list's {@code
 * focus} parameter narrows it to this week's matches, those with an unannounced own side, or those with no
 * availability poll. The summary counters use the same constants, so a counter and the list it filters cannot
 * disagree.
 */
public enum MatchListFocus {
    THIS_WEEK("this-week"),
    NOT_ANNOUNCED("not-announced"),
    NO_POLL("no-poll");

    private final String value;

    MatchListFocus(String value) {
        this.value = value;
    }

    /** The request value, e.g. {@code not-announced}. */
    public String value() {
        return value;
    }

    /**
     * Parses the {@code focus} request value ({@code this-week|not-announced|no-poll}, any case). A missing or
     * blank value means no focus ({@code null}); anything else is a 400.
     */
    public static MatchListFocus parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalised = raw.trim().toLowerCase(Locale.ROOT);
        for (MatchListFocus focus : values()) {
            if (focus.value.equals(normalised)) {
                return focus;
            }
        }
        throw new ValidationException("focus must be 'this-week', 'not-announced' or 'no-poll'");
    }
}
