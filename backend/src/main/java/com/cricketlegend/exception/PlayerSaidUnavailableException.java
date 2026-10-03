package com.cricketlegend.exception;

/**
 * A player's answer on the poll covering this match is Unavailable, so he cannot be selected. Maps to HTTP 409 via its {@link ConflictException} base — see docs/specs/076-team-selection.md.
 */
public class PlayerSaidUnavailableException extends ConflictException {
    public PlayerSaidUnavailableException(String message) {
        super(message);
    }
}
