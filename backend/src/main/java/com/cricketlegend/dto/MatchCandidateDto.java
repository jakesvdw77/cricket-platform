package com.cricketlegend.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/104-match-results-import-adaptors.md: a match of the club the import could belong to, with the evidence for
 * it ({@code reasons}, strongest first) and, when the match already has a result, what that result is. Nothing is ever
 * chosen for the manager.
 */
public record MatchCandidateDto(
        UUID matchId,
        String label,
        Instant matchDate,
        String homeName,
        String awayName,
        String leagueName,
        String venue,
        List<ImportMatchReason> reasons,
        ExistingResultDto existingResult) {
}
