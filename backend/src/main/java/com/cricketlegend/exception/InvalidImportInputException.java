package com.cricketlegend.exception;

/**
 * docs/specs/104-match-results-import-adaptors.md: an import input that cannot be used. Maps to 400 via its {@link
 * ValidationException} base; {@code GlobalExceptionHandler} adds the structured detail of the subtypes ({@code errors},
 * {@code supported}). Not instantiated directly: throw one of the named subclasses.
 */
public abstract class InvalidImportInputException extends ValidationException {

    protected InvalidImportInputException(String message) {
        super(message);
    }
}
