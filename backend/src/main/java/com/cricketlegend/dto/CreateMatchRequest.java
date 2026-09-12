package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

/**
 * POST /api/v1/manage/clubs/{clubId}/matches payload. Exactly one of {@code homeTeamId}/{@code
 * homeTeamName} must be set, and exactly one of {@code awayTeamId}/{@code awayTeamName} —
 * validated at the service layer (400), ahead of the DB {@code CHECK} constraints. {@code
 * seasonId} is required (not optional, per this spec's own pre-build amendment); {@code leagueId}
 * stays optional. See docs/specs/029-league-management.md.
 */
public record CreateMatchRequest(
        UUID homeTeamId,
        String homeTeamName,
        UUID awayTeamId,
        String awayTeamName,
        UUID leagueId,
        @NotNull UUID seasonId,
        @NotNull Instant matchDate,
        String venue) {
}
