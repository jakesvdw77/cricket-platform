package com.cricketlegend.exception;

/**
 * A Subscription was created or updated to point at a Product whose status isn't ACTIVE.
 * Maps to HTTP 409 via its ConflictException base — see docs/standards/backend.md.
 */
public class ProductNotActiveException extends ConflictException {
    public ProductNotActiveException(String message) {
        super(message);
    }
}
