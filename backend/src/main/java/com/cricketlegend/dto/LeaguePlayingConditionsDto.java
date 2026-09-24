package com.cricketlegend.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Read shape of a {@link com.cricketlegend.domain.LeaguePlayingConditions} — the current Playing
 * Conditions PDF document for a {@code (league, season)} pair. See
 * docs/specs/050-league-schedule-and-fixtures.md.
 */
public record LeaguePlayingConditionsDto(
        UUID id, UUID leagueId, UUID seasonId, String documentUrl, Instant uploadedAt, UUID uploadedBy) {
}
