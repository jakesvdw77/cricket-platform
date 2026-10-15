package com.cricketlegend.exception;

/**
 * docs/specs/104-match-results-import-adaptors.md: the input cannot be decoded or parsed at all (not UTF-8, malformed
 * JSON with its line and column, a corrupt file). One plain-English message. Maps to 400.
 */
public class UnreadableImportInputException extends InvalidImportInputException {

    public UnreadableImportInputException(String message) {
        super(message);
    }
}
