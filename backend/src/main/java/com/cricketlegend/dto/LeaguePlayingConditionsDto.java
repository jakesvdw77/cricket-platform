package com.cricketlegend.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Read shape of a {@link com.cricketlegend.domain.LeaguePlayingConditions} — the current Playing
 * Conditions record for a {@code (league, season)} pair: the uploaded PDF document plus, per
 * docs/specs/052-league-playing-conditions.md, the structured match-format/points/bonus-points
 * fields. {@code documentUrl}/{@code uploadedAt} are nullable — a row can exist with structured
 * fields saved and no PDF ever uploaded; {@code uploadedBy} was already nullable. Every structured
 * field is independently nullable too — see docs/specs/052-league-playing-conditions.md's Data
 * Model Changes for the "required together as a group by the write endpoint" nuance.
 */
public record LeaguePlayingConditionsDto(
        UUID id,
        UUID leagueId,
        UUID seasonId,
        String documentUrl,
        Instant uploadedAt,
        UUID uploadedBy,
        Integer maxOversPerInnings,
        Integer powerplayOvers,
        Integer maxOversPerBowler,
        String fieldingRestrictionsNotes,
        Integer pointsForWin,
        Integer pointsForLoss,
        Integer pointsForDraw,
        Integer pointsForNoResult,
        Integer pointsForForfeitWin,
        boolean bonusPointsEnabled,
        Integer bonusBattingOversThreshold,
        Integer bonusBowlingRestrictionPercentage,
        String additionalNotes) {
}
