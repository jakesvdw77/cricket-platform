package com.cricketlegend.service.support;

import com.cricketlegend.dto.ImportIssueDto;
import com.cricketlegend.dto.ImportRowDto;
import java.util.List;

/** The validated rows (status, outcome, action and issue codes filled in) and every issue found. */
public record ValidationResult(List<ImportRowDto> rows, List<ImportIssueDto> issues) {

    public ValidationResult {
        rows = rows == null ? List.of() : rows;
        issues = issues == null ? List.of() : issues;
    }
}
