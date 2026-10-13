package com.cricketlegend.exception;

/** docs/specs/100-match-results-core.md: an inactive match cannot have a result captured or published. Maps to 409. */
public class MatchNotCapturableException extends ConflictException {

    public MatchNotCapturableException(String message) {
        super(message);
    }
}
