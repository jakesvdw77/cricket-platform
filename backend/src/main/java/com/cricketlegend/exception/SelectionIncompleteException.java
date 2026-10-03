package com.cricketlegend.exception;

/**
 * A side cannot be announced yet: players without a batting position, more places used than exist, or more players than the most allowed. The message names what is missing. Maps to HTTP 400 via its {@link ValidationException} base — see docs/specs/076-team-selection.md.
 */
public class SelectionIncompleteException extends ValidationException {
    public SelectionIncompleteException(String message) {
        super(message);
    }
}
