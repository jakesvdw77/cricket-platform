package com.cricketlegend.exception;

import java.util.UUID;

/**
 * A field with the same name, city and country already exists (docs/specs/099-fields-directory.md). Maps to HTTP 409
 * via its {@link ConflictException} base, with {@link #getExistingPlayingAreaId()} added to the problem body by {@code
 * GlobalExceptionHandler} so the client can offer the existing field.
 */
public class DuplicateFieldException extends ConflictException {

    private final UUID existingPlayingAreaId;

    public DuplicateFieldException(String message, UUID existingPlayingAreaId) {
        super(message);
        this.existingPlayingAreaId = existingPlayingAreaId;
    }

    public UUID getExistingPlayingAreaId() {
        return existingPlayingAreaId;
    }
}
