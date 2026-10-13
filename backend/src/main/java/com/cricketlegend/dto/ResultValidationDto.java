package com.cricketlegend.dto;

import java.util.List;

/**
 * docs/specs/100-match-results-core.md: the outcome of a validation dry run, in plain English. Errors block
 * publishing; warnings are acknowledged at publish. {@code canPublish} is true when there are no errors.
 */
public record ResultValidationDto(boolean canPublish, List<String> errors, List<String> warnings) {

    public ResultValidationDto(List<String> errors, List<String> warnings) {
        this(errors.isEmpty(), List.copyOf(errors), List.copyOf(warnings));
    }
}
