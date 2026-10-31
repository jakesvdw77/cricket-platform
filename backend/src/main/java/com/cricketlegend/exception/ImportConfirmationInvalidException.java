package com.cricketlegend.exception;

/**
 * The confirmation token or creations digest is missing, wrong, expired, for another user or revision, or no longer
 * matches the reviewed data (docs/specs/097-import-framework.md, principle 1). Maps to 409. Nothing was written.
 */
public class ImportConfirmationInvalidException extends ConflictException {

    public ImportConfirmationInvalidException(String message) {
        super(message);
    }
}
