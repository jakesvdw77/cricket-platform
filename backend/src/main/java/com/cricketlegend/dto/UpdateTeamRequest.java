package com.cricketlegend.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * PUT /api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId} payload. Deliberately
 * has no {@code sectionId} field — re-parenting a {@code Team} to a different {@code Section} is
 * out of scope (see docs/specs/026-teams.md's Non-goals). See docs/specs/026-teams.md.
 */
public record UpdateTeamRequest(@NotBlank String name, String logoUrl) {
}
