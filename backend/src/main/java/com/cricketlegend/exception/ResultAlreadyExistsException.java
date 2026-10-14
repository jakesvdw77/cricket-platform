package com.cricketlegend.exception;

/** docs/specs/100-match-results-core.md: the match already has a result (lost a race to create one). Maps to 409. */
public class ResultAlreadyExistsException extends ConflictException {

    public ResultAlreadyExistsException(String message) {
        super(message);
    }
}
