package com.cricketlegend.dto;

import java.util.List;

/**
 * docs/specs/104-match-results-import-adaptors.md: the read-only outcome of a preview (it writes nothing). {@code
 * document} is the common-format document with exactness filled for match, teams, toss and result; {@code
 * matchCandidates} the matches it could belong to; {@code teamMapping} the proposed side of each file team (for the
 * match the request launched from, or the strongest candidate); {@code existingForExternalId} the result this provider
 * id was already imported onto, if any.
 */
public record ImportPreviewDto(
        ImportedResultDto document,
        List<MatchCandidateDto> matchCandidates,
        List<TeamMappingDto> teamMapping,
        ExistingResultDto existingForExternalId,
        List<ImportNoteDto> notes) {
}
