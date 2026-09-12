package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * POST /api/v1/manage/clubs/{clubId}/matches/{matchId}/sides payload — {@code teamId} must equal
 * the match's own {@code homeTeamId}/{@code awayTeamId} (400 otherwise), and a side for that team
 * must not already exist (409). See docs/specs/029-league-management.md.
 */
public record CreateMatchSideRequest(@NotNull UUID teamId) {
}
