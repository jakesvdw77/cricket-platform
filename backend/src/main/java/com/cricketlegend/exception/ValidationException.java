package com.cricketlegend.exception;

/**
 * Request data fails a business validation rule. Maps to HTTP 400 — see
 * docs/standards/backend.md's exception matrix.
 */
public class ValidationException extends RuntimeException {
    public ValidationException(String message) {
        super(message);
    }
}
