package com.cricketlegend.domain;

import com.cricketlegend.exception.ValidationException;
import java.util.Locale;

/**
 * docs/specs/100-match-results-core.md: the quick filter behind a Results counter, like {@link MatchListFocus}. The
 * summary counters and the list's {@code focus} parameter share these constants so a counter and the list it filters
 * cannot disagree.
 */
public enum ResultListFocus {
    PLAYED("played"),
    WON("won"),
    LOST("lost"),
    TIED_OR_NONE("tied-or-none"),
    DRAFTS("drafts");

    private final String value;

    ResultListFocus(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    /** Parses the {@code focus} request value (any case). Missing or blank means no focus ({@code null}); anything else is a 400. */
    public static ResultListFocus parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalised = raw.trim().toLowerCase(Locale.ROOT);
        for (ResultListFocus focus : values()) {
            if (focus.value.equals(normalised)) {
                return focus;
            }
        }
        throw new ValidationException("focus must be 'played', 'won', 'lost', 'tied-or-none' or 'drafts'");
    }
}
