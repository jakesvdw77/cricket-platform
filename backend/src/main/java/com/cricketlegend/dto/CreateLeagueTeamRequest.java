package com.cricketlegend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * POST .../league-teams payload. {@code name} is trimmed by the service and must be non-blank
 * (400). See docs/specs/070-league-teams.md.
 */
public record CreateLeagueTeamRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 16) String abbreviation,
        @Size(max = 1024) String logoUrl) {
}
