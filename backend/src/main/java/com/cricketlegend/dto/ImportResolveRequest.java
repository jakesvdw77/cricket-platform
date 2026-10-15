package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/104-match-results-import-adaptors.md: the explicit confirm. {@code document} is as the preview returned it
 * and is fully re-validated (nothing about it is trusted, exactness included); {@code matchId} and {@code teamMapping}
 * are the manager's choices; {@code replaceExistingDraft} must be true when the match already has a draft result.
 */
public record ImportResolveRequest(
        @NotNull ImportedResultDto document,
        @NotNull UUID matchId,
        @NotNull List<TeamMappingDto> teamMapping,
        boolean replaceExistingDraft) {
}
