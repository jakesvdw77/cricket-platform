package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * POST /api/v1/manage/clubs/{clubId}/matches/{matchId}/polls payload — {@code teamId} must equal
 * the match's own {@code homeTeamId}/{@code awayTeamId} (400 otherwise), and a poll for that team
 * must not already exist on this match (409). {@code autoClose} defaults to {@code true} when
 * null/absent (docs/specs/064-unified-availability-polls.md). See docs/specs/032-match-availability-polls.md.
 */
public record CreateMatchAvailabilityPollRequest(@NotNull UUID teamId, Boolean autoClose) {
}
