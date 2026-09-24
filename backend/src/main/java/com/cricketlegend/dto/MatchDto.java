package com.cricketlegend.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Read shape of a club's own {@link com.cricketlegend.domain.Match} — a scheduled fixture, home
 * and away sides each either a real {@code Team} id or a free-text opponent name.
 * {@code homeTeamLogoUrl}/{@code awayTeamLogoUrl} (docs/specs/050-league-schedule-and-fixtures.md)
 * are populated only alongside a free-text opponent name, null for a real {@code Team} side (whose
 * logo is resolved separately via {@code Team.logoUrl}). See docs/specs/029-league-management.md.
 */
public record MatchDto(
        UUID id,
        UUID clubId,
        UUID homeTeamId,
        String homeTeamName,
        UUID awayTeamId,
        String awayTeamName,
        String homeTeamLogoUrl,
        String awayTeamLogoUrl,
        UUID leagueId,
        UUID seasonId,
        Instant matchDate,
        String venue,
        boolean active,
        boolean homeSideAnnounced,
        boolean awaySideAnnounced,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy) {
}
