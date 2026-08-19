package com.cricketlegend.exception;

/**
 * A Club.slug that already exists (case-insensitive), on create or update.
 * Maps to HTTP 409 via its ConflictException base — see docs/standards/backend.md.
 */
public class DuplicateSlugException extends ConflictException {
    public DuplicateSlugException(String message) {
        super(message);
    }
}
