package com.cricketlegend.exception;

import java.util.List;

/**
 * docs/specs/100-match-results-core.md: a result that fails validation, or one with unacknowledged warnings at
 * publish. Maps to 400 via its {@link ValidationException} base, with {@link #getErrors()} and {@link #getWarnings()}
 * added to the problem body by {@code GlobalExceptionHandler}, in plain English.
 */
public class InvalidResultException extends ValidationException {

    private final transient List<String> errors;
    private final transient List<String> warnings;

    public InvalidResultException(String message, List<String> errors, List<String> warnings) {
        super(message);
        this.errors = List.copyOf(errors);
        this.warnings = List.copyOf(warnings);
    }

    public List<String> getErrors() {
        return errors;
    }

    public List<String> getWarnings() {
        return warnings;
    }
}
