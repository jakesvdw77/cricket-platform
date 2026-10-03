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
 *
 * <p>{@code homeLeagueTeamId}/{@code awayLeagueTeamId} (optional, docs/specs/070-league-teams.md)
 * pick a registered league team for that side: they exclude the same side's {@code *TeamId}, and
 * the side's {@code *TeamName}/{@code *TeamLogoUrl} are ignored and overwritten from the league
 * team. The match must have a league, and the league team must belong to its league and season.
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
        String venue,
        UUID homeLeagueTeamId,
        UUID awayLeagueTeamId) {
}
