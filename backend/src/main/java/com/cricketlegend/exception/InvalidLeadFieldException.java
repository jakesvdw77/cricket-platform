package com.cricketlegend.exception;

/**
 * A Lead field combination that violates a business rule not expressible as bean validation
 * (e.g. setting convertedClubId on a transition that isn't CONVERTED).
 * Maps to HTTP 409 via its ConflictException base — see docs/standards/backend.md.
 */
public class InvalidLeadFieldException extends ConflictException {
    public InvalidLeadFieldException(String message) {
        super(message);
    }
}
