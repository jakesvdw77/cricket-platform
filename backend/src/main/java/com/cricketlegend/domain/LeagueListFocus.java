package com.cricketlegend.domain;

import com.cricketlegend.exception.ValidationException;
import java.util.Locale;

/**
 * The quick filter behind a Leagues counter (docs/specs/091-leagues-gold-standard.md): the list's {@code focus}
 * parameter narrows it to active leagues, leagues with a match in the coming week, or leagues that need attention (an
 * active league with no teams entered or no matches scheduled in the season). The summary counters use the same
 * definitions, so a counter and the list it filters cannot disagree.
 */
public enum LeagueListFocus {
    ACTIVE("active"),
    THIS_WEEK("this-week"),
    ATTENTION("attention");

    private final String value;

    LeagueListFocus(String value) {
        this.value = value;
    }

    /** The request value, e.g. {@code this-week}. */
    public String value() {
        return value;
    }

    /**
     * Parses the {@code focus} request value ({@code active|this-week|attention}, any case). A missing or blank value
     * means no focus ({@code null}); anything else is a 400.
     */
    public static LeagueListFocus parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalised = raw.trim().toLowerCase(Locale.ROOT);
        for (LeagueListFocus focus : values()) {
            if (focus.value.equals(normalised)) {
                return focus;
            }
        }
        throw new ValidationException("focus must be 'active', 'this-week' or 'attention'");
    }
}
