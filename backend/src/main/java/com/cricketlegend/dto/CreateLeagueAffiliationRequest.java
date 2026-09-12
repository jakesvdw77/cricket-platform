package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * POST /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations payload — affiliates {@code
 * teamId} into the path's {@code leagueId} for {@code seasonId}. Both must belong to the same
 * {@code clubId} as the league (404 otherwise, checked at the service layer). See
 * docs/specs/029-league-management.md.
 */
public record CreateLeagueAffiliationRequest(@NotNull UUID teamId, @NotNull UUID seasonId) {
}
