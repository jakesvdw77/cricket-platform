package com.cricketlegend.exception;

/**
 * The request conflicts with the resource's current state (e.g. an illegal status transition).
 * Maps to HTTP 409 — see docs/standards/backend.md's exception matrix.
 */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
