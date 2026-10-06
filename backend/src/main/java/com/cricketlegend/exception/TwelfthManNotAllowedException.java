package com.cricketlegend.exception;

/**
 * The match's limits have no 12th man place (the league's playing conditions do not allow substitutions, or the league is of 12). Maps to HTTP 400 via its {@link ValidationException} base — see docs/specs/076-team-selection.md.
 */
public class TwelfthManNotAllowedException extends ValidationException {
    public TwelfthManNotAllowedException(String message) {
        super(message);
    }
}
