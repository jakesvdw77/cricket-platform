package com.cricketlegend.domain;

import com.cricketlegend.exception.ValidationException;
import java.util.Locale;

/**
 * The quick filter behind a Players counter (docs/specs/088-players-polls-alignment.md): the list's {@code focus}
 * parameter narrows it to players in a team squad for a season, players selected for a match of a season, or players
 * waiting to be verified. The summary counters use the same constants, so a counter and the list it filters cannot
 * disagree.
 */
public enum PlayerListFocus {
    IN_SQUAD("in-squad"),
    SELECTED("selected"),
    UNVERIFIED("unverified");

    private final String value;

    PlayerListFocus(String value) {
        this.value = value;
    }

    /** The request value, e.g. {@code in-squad}. */
    public String value() {
        return value;
    }

    /** True for the two focuses that look at a season ({@code seasonId} is then required). */
    public boolean needsSeason() {
        return this != UNVERIFIED;
    }

    /**
     * Parses the {@code focus} request value ({@code in-squad|selected|unverified}, any case). A missing or blank value
     * means no focus ({@code null}); anything else is a 400.
     */
    public static PlayerListFocus parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalised = raw.trim().toLowerCase(Locale.ROOT);
        for (PlayerListFocus focus : values()) {
            if (focus.value.equals(normalised)) {
                return focus;
            }
        }
        throw new ValidationException("focus must be 'in-squad', 'selected' or 'unverified'");
    }
}
