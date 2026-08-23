package com.cricketlegend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * POST /api/v1/manage/clubs/{clubId}/contacts payload. {@code contact}'s own {@code @NotBlank}/
 * {@code @Email} annotations (on {@link ContactDto}) do the field-level validation — nothing
 * re-declared here; {@code @Valid} is required for those nested annotations to actually run. See
 * docs/specs/021-club-contacts.md.
 */
public record CreateClubContactRequest(
        @Valid @NotNull ContactDto contact,
        @NotBlank String role,
        boolean isPrimary,
        String photoUrl) {
}
