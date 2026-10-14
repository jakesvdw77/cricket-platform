package com.cricketlegend.exception;

/**
 * docs/specs/100-match-results-core.md: a published result cannot be edited or deleted; it must be unpublished first.
 * Maps to 409.
 */
public class ResultPublishedException extends ConflictException {

    public ResultPublishedException(String message) {
        super(message);
    }
}
