package com.cricketlegend.service.support;

import com.cricketlegend.dto.ImportIssueDto;
import com.cricketlegend.dto.ImportRowDto;
import com.cricketlegend.dto.PlannedChangeDto;
import com.cricketlegend.dto.ReferenceProposalDto;
import java.util.List;
import java.util.Map;

/**
 * The typed form of {@code import_batch.payload}: normalised rows, issues, proposals, planned changes and file
 * warnings. Stored as jsonb through {@link ImportJson}; never exposed raw (rows come through the paginated endpoint).
 * {@code meta} is the file's metadata as the handler's parse reported it; {@code earlierImportWarning} is the
 * whole-file re-import notice, or null. Spec 125: {@code rows} are the effective rows (file rows with the manager's
 * edits and added rows, as evaluated); {@code fileRows} are the parsed file rows, never changed (a payload stored
 * before spec 125 has none, and its {@code rows} are the file rows).
 */
public record ImportPayload(
        List<ImportRowDto> rows,
        List<ImportRowDto> fileRows,
        List<ImportIssueDto> issues,
        List<ReferenceProposalDto> proposals,
        List<PlannedChangeDto> plannedChanges,
        List<String> fileWarnings,
        Map<String, String> meta,
        String earlierImportWarning) {

    public ImportPayload {
        rows = rows == null ? List.of() : rows;
        fileRows = fileRows == null ? rows : fileRows;
        issues = issues == null ? List.of() : issues;
        proposals = proposals == null ? List.of() : proposals;
        plannedChanges = plannedChanges == null ? List.of() : plannedChanges;
        fileWarnings = fileWarnings == null ? List.of() : fileWarnings;
        meta = meta == null ? Map.of() : meta;
    }
}
