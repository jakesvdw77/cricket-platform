package com.cricketlegend.exception;

/**
 * docs/specs/104-match-results-import-adaptors.md: the chosen match already has a published result; unpublish it
 * before importing. Maps to 409.
 */
public class ImportMatchAlreadyHasResultException extends ConflictException {

    public ImportMatchAlreadyHasResultException(String message) {
        super(message);
    }
}
