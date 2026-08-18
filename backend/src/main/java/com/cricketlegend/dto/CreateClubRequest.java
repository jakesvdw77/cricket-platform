package com.cricketlegend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * POST /api/v1/platform/clubs payload. No status field — a Club created through this endpoint
 * always lands ACTIVE, set directly by ClubServiceImpl (see docs/specs/010-minimal-club-creation.md);
 * status only ever moves afterward via the dedicated suspend/reactivate endpoints. slug's format
 * (lowercase alphanumeric, single hyphens, DNS-label length bounds) is enforced here; the ADR-04
 * reserved-word blocklist and uniqueness are business rules enforced in ClubServiceImpl, not bean
 * validation.
 */
public record CreateClubRequest(
        @NotBlank String name,
        @NotBlank
        @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$")
        @Size(min = 3, max = 63)
        String slug) {
}
