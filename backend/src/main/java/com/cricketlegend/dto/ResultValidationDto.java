package com.cricketlegend.dto;

import com.cricketlegend.domain.ResultIssueSeverity;
import java.util.List;

/**
 * docs/specs/100-match-results-core.md: the outcome of a validation dry run, in plain English. Errors block
 * publishing; warnings are acknowledged at publish. {@code canPublish} is true when there are no errors. {@code issues}
 * (docs/specs/101) is the same errors and warnings plus info lines, each with a code, step and side; it is additive
 * beside the plain {@code errors} and {@code warnings} strings.
 */
public record ResultValidationDto(
        boolean canPublish, List<String> errors, List<String> warnings, List<ResultIssueDto> issues) {

    public ResultValidationDto(List<String> errors, List<String> warnings) {
        this(errors.isEmpty(), List.copyOf(errors), List.copyOf(warnings), List.of());
    }

    /** Builds the response from typed issues: the string lists are the error and warning messages in order. */
    public static ResultValidationDto of(List<ResultIssueDto> issues) {
        List<String> errors = messages(issues, ResultIssueSeverity.ERROR);
        return new ResultValidationDto(
                errors.isEmpty(), errors, messages(issues, ResultIssueSeverity.WARNING), List.copyOf(issues));
    }

    private static List<String> messages(List<ResultIssueDto> issues, ResultIssueSeverity severity) {
        return issues.stream().filter(i -> i.severity() == severity).map(ResultIssueDto::message).toList();
    }
}
