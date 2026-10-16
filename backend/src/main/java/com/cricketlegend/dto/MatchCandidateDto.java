package com.cricketlegend.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/104-match-results-import-adaptors.md: a match of the club the import could belong to, with the evidence for
 * it ({@code reasons}, strongest first) and, when the match already has a result, what that result is. Nothing is ever
 * chosen for the manager. {@code homeIsClubTeam} / {@code awayIsClubTeam} say whether that side is one of the club's own
 * teams (a typed outside name is not), because an import needs one such side.
 */
public record MatchCandidateDto(
        UUID matchId,
        String label,
        Instant matchDate,
        String homeName,
        String awayName,
        boolean homeIsClubTeam,
        boolean awayIsClubTeam,
        String leagueName,
        String venue,
        List<ImportMatchReason> reasons,
        ExistingResultDto existingResult) {
}
