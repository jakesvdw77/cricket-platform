package com.cricketlegend.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * GET /api/v1/public/polls/{pollId}: the squad poll's header only. No players, no responses.
 * See docs/specs/077-public-availability-form-verification.md.
 */
public record PublicPollHeaderDto(
        UUID pollId,
        boolean open,
        UUID clubId,
        String homeTeamName,
        String awayTeamName,
        Instant matchDate,
        String venue,
        String leagueName,
        String seasonLabel,
        String teamName,
        Instant scheduledCloseAt) {
}
