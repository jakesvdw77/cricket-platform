package com.cricketlegend.exception;

/**
 * Requested resource does not exist. Maps to HTTP 404 — see docs/standards/backend.md's
 * exception matrix.
 */
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }
}
