package com.cricketlegend.exception;

/**
 * An owner (Club) that already has an ACTIVE Subscription was assigned a second one.
 * Maps to HTTP 409 via its ConflictException base — see docs/standards/backend.md.
 */
public class DuplicateActiveSubscriptionException extends ConflictException {
    public DuplicateActiveSubscriptionException(String message) {
        super(message);
    }
}
