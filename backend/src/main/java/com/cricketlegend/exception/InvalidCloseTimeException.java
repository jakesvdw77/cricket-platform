package com.cricketlegend.exception;

/**
 * A poll close time (squad or group poll) failed validation: missing while Autoclose is on, not in
 * the future, or after the earliest covered match's kickoff. Maps to HTTP 400 via its {@link
 * ValidationException} base. See docs/specs/066-poll-close-time-and-unified-cards.md.
 */
public class InvalidCloseTimeException extends ValidationException {
    public InvalidCloseTimeException(String message) {
        super(message);
    }
}
