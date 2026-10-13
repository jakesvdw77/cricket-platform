package com.cricketlegend.exception;

/**
 * A rejected field was chosen for a match (docs/specs/099-fields-directory.md). Maps to HTTP 400 via its {@link
 * ValidationException} base.
 */
public class FieldRejectedException extends ValidationException {
    public FieldRejectedException(String message) {
        super(message);
    }
}
