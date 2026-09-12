package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

/**
 * PUT /api/v1/manage/clubs/{clubId}/matches/{matchId} payload — rescheduling, changing
 * venue/opponent/league/season are all just an edit, no separate "reschedule" action. Same
 * validation as {@link CreateMatchRequest}. See docs/specs/029-league-management.md.
 */
public record UpdateMatchRequest(
        UUID homeTeamId,
        String homeTeamName,
        UUID awayTeamId,
        String awayTeamName,
        UUID leagueId,
        @NotNull UUID seasonId,
        @NotNull Instant matchDate,
        String venue) {
}
