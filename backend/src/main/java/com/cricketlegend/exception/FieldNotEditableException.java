package com.cricketlegend.exception;

/**
 * A manager tried to edit a field they may not (verified, or captured by another club) - docs/specs/099-fields-directory.md.
 * Maps to HTTP 409 via its {@link ConflictException} base.
 */
public class FieldNotEditableException extends ConflictException {
    public FieldNotEditableException(String message) {
        super(message);
    }
}
