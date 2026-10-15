package com.cricketlegend.exception;

/**
 * docs/specs/104-match-results-import-adaptors.md: the import would replace an existing draft and the overwrite was
 * not acknowledged. Maps to 409.
 */
public class ImportWouldOverwriteDraftException extends ConflictException {

    public ImportWouldOverwriteDraftException(String message) {
        super(message);
    }
}
