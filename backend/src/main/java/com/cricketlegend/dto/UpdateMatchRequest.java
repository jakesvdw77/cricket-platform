package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
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
 *
 * <p>{@code acknowledgedWarnings} (optional, docs/specs/132-match-scheduling-rules.md) are the scheduling warning codes
 * the manager has confirmed (Save Anyway); an error finding is never overridden by it.
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
        UUID playingAreaId,
        List<String> acknowledgedWarnings) {

    /** Without acknowledgements: every scheduling warning (docs/specs/132) is returned as a 409 to confirm. */
    public UpdateMatchRequest(
            UUID homeTeamId, String homeTeamName, UUID awayTeamId, String awayTeamName, String homeTeamLogoUrl,
            String awayTeamLogoUrl, UUID leagueId, UUID seasonId, Instant matchDate, String venue,
            UUID homeLeagueTeamId, UUID awayLeagueTeamId, String scoringUrl, String streamingUrl, UUID playingAreaId) {
        this(homeTeamId, homeTeamName, awayTeamId, awayTeamName, homeTeamLogoUrl, awayTeamLogoUrl, leagueId, seasonId,
                matchDate, venue, homeLeagueTeamId, awayLeagueTeamId, scoringUrl, streamingUrl, playingAreaId, null);
    }
}
