package com.cricketlegend.exception;

import com.cricketlegend.dto.ResultIssueDto;
import java.util.List;

/**
 * docs/specs/100-match-results-core.md: a result that fails validation, or one with unacknowledged warnings at
 * publish. Maps to 400 via its {@link ValidationException} base, with {@link #getErrors()} and {@link #getWarnings()}
 * added to the problem body by {@code GlobalExceptionHandler}, in plain English. docs/specs/101 adds {@link
 * #getIssues()}: the same problems as typed issues (code, step, side, severity), additive beside the string lists.
 */
public class InvalidResultException extends ValidationException {

    private final transient List<String> errors;
    private final transient List<String> warnings;
    private final transient List<ResultIssueDto> issues;

    public InvalidResultException(String message, List<String> errors, List<String> warnings) {
        this(message, errors, warnings, List.of());
    }

    public InvalidResultException(
            String message, List<String> errors, List<String> warnings, List<ResultIssueDto> issues) {
        super(message);
        this.errors = List.copyOf(errors);
        this.warnings = List.copyOf(warnings);
        this.issues = List.copyOf(issues);
    }

    public List<String> getErrors() {
        return errors;
    }

    public List<String> getWarnings() {
        return warnings;
    }

    public List<ResultIssueDto> getIssues() {
        return issues;
    }
}
