package com.cricketlegend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * PUT /api/v1/platform/clubs/{id} payload. Same editable fields as {@link CreateClubRequest} —
 * name and slug only, no status field. slug is re-validated against format, the ADR-04
 * reserved-word blocklist, and uniqueness-excluding-self on every update, per
 * docs/specs/010-minimal-club-creation.md.
 */
public record UpdateClubRequest(
        @NotBlank String name,
        @NotBlank
        @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$")
        @Size(min = 3, max = 63)
        String slug) {
}
