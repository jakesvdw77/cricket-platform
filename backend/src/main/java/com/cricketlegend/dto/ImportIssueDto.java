package com.cricketlegend.dto;

import com.cricketlegend.domain.ImportIssueSeverity;
import java.util.List;

/**
 * A validation finding (docs/specs/097-import-framework.md): a stable machine {@code code}, the rows it affects, the
 * field, a plain-English {@code message} for a club admin and an optional {@code hint}. Clients read {@code code},
 * never the message text. An empty {@code rowNumbers} means the whole file.
 */
public record ImportIssueDto(
        String code,
        ImportIssueSeverity severity,
        List<Integer> rowNumbers,
        String field,
        String message,
        String hint) {

    public ImportIssueDto {
        rowNumbers = rowNumbers == null ? List.of() : rowNumbers;
    }
}
