package com.cricketlegend.dto;

import com.cricketlegend.domain.ImportBatchStatus;
import com.cricketlegend.domain.ImportScopeMode;
import com.cricketlegend.domain.ImportSource;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * An import batch as the client sees it (docs/specs/097-import-framework.md). The stored payload is never exposed raw:
 * rows come only through {@code GET .../rows}; {@code firstRows} is the first page, sent on preview and decisions only.
 * {@code confirmationToken} and {@code creationsDigest} are present only when the saved decisions leave zero errors and
 * every warning acknowledged. {@code decisions} are the saved decisions, never null (an empty object when none).
 */
public record ImportBatchDto(
        UUID id,
        UUID clubId,
        String type,
        int templateVersion,
        ImportBatchStatus status,
        String scopeKey,
        Map<String, Object> scope,
        ImportScopeMode scopeMode,
        String timeZone,
        String fileName,
        ImportSource source,
        long fileSizeBytes,
        int revision,
        Map<String, Object> counts,
        List<ImportIssueDto> issues,
        List<ReferenceProposalDto> proposals,
        List<PlannedChangeDto> plannedChanges,
        List<String> fileWarnings,
        String earlierImportWarning,
        ImportDecisionsDto decisions,
        List<ImportRowDto> firstRows,
        String confirmationToken,
        String creationsDigest,
        String lastError,
        UUID createdBy,
        Instant createdAt,
        Instant expiresAt,
        UUID committedBy,
        Instant committedAt,
        UUID deletedBy,
        Instant deletedAt) {
}
