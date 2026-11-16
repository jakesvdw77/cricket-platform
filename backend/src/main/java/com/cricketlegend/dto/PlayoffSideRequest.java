package com.cricketlegend.dto;

import java.util.UUID;

/**
 * One side of a playoff game (docs/specs/155-playoff-and-knockout-fixtures.md): exactly one of a TBC {@code placeholder}
 * text ("1st in the pool"), one of our {@code teamId}s, or a {@code leagueTeamId}.
 */
public record PlayoffSideRequest(String placeholder, UUID teamId, UUID leagueTeamId) {
}
