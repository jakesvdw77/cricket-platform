package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

/**
 * POST /api/v1/manage/clubs/{clubId}/matches payload. Exactly one of {@code homeTeamId}/{@code
 * homeTeamName} must be set, and exactly one of {@code awayTeamId}/{@code awayTeamName} —
 * validated at the service layer (400), ahead of the DB {@code CHECK} constraints. {@code
 * seasonId} is required (not optional, per this spec's own pre-build amendment); {@code leagueId}
 * stays optional. {@code homeTeamLogoUrl}/{@code awayTeamLogoUrl} (optional, per
 * docs/specs/050-league-schedule-and-fixtures.md) may only be set alongside the matching side's
 * {@code *TeamName} (i.e. {@code *TeamId} null) — validated at the service layer (400). See
 * docs/specs/029-league-management.md.
 */
public record CreateMatchRequest(
        UUID homeTeamId,
        String homeTeamName,
        UUID awayTeamId,
        String awayTeamName,
        String homeTeamLogoUrl,
        String awayTeamLogoUrl,
        UUID leagueId,
        @NotNull UUID seasonId,
        @NotNull Instant matchDate,
        String venue) {
}
