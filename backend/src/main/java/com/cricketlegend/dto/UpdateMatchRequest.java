package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

/**
 * PUT /api/v1/manage/clubs/{clubId}/matches/{matchId} payload — rescheduling, changing
 * venue/opponent/league/season are all just an edit, no separate "reschedule" action. Same
 * validation as {@link CreateMatchRequest}, including {@code homeTeamLogoUrl}/{@code
 * awayTeamLogoUrl}'s logo-only-alongside-matching-name rule (docs/specs/050-league-schedule-and-
 * fixtures.md). See docs/specs/029-league-management.md.
 *
 * <p>{@code playingAreaId} (optional, docs/specs/099-fields-directory.md) picks a field from the directory: the match's
 * {@code venue} is then written from the field's name and wins over any {@code venue} sent alongside. Without it,
 * {@code venue} is stored as sent and any previous field link is cleared.
 */
public record UpdateMatchRequest(
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
        UUID awayLeagueTeamId,
        String scoringUrl,
        String streamingUrl,
        UUID playingAreaId) {
}
