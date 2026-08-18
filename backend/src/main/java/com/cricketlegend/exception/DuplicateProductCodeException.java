package com.cricketlegend.exception;

/**
 * A Product.code that already exists (case-insensitive), on create or update.
 * Maps to HTTP 409 via its ConflictException base — see docs/standards/backend.md.
 */
public class DuplicateProductCodeException extends ConflictException {
    public DuplicateProductCodeException(String message) {
        super(message);
    }
}
