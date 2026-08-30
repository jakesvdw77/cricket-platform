package com.cricketlegend.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * POST /api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams payload. {@code clubId}/{@code
 * sectionId} come from the URL path, not the body — a {@code Team} is always created in the
 * context of a specific section. See docs/specs/026-teams.md.
 */
public record CreateTeamRequest(@NotBlank String name, String logoUrl) {
}
