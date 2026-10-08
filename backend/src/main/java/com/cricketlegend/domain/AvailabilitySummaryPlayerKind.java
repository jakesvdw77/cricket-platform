package com.cricketlegend.domain;

import com.cricketlegend.exception.ValidationException;
import java.util.Locale;

/** Which players the availability players list (docs/specs/084) returns: those who answered, or those still to answer. */
public enum AvailabilitySummaryPlayerKind {
    RESPONDED,
    AWAITING;

    /** Parses the {@code kind} request value ({@code responded|awaiting}, any case); 400 otherwise. */
    public static AvailabilitySummaryPlayerKind parse(String value) {
        if (value != null) {
            for (AvailabilitySummaryPlayerKind kind : values()) {
                if (kind.name().equals(value.trim().toUpperCase(Locale.ROOT))) {
                    return kind;
                }
            }
        }
        throw new ValidationException("kind must be 'responded' or 'awaiting'");
    }
}
