package com.cricketlegend.exception;

/**
 * A player's answer on the poll covering this match is Unsure or No response, so he cannot be
 * selected until his answer is set to Available. Maps to HTTP 409 via its {@link ConflictException}
 * base — see docs/specs/076-team-selection.md.
 */
public class PlayerNotConfirmedException extends ConflictException {
    public PlayerNotConfirmedException(String message) {
        super(message);
    }
}
