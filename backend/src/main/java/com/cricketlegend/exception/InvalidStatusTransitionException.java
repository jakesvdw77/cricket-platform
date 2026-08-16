package com.cricketlegend.exception;

/**
 * A status transition that isn't allowed by the entity's transition table (e.g. Lead's
 * NEW/CONTACTED/CONVERTED/DISMISSED rules in docs/specs/004-landing-page.md).
 * Maps to HTTP 409 via its ConflictException base — see docs/standards/backend.md.
 */
public class InvalidStatusTransitionException extends ConflictException {
    public InvalidStatusTransitionException(String message) {
        super(message);
    }
}
