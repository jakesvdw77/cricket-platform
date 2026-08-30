package com.cricketlegend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * POST /api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts payload. {@code contact}'s own
 * {@code @NotBlank}/{@code @Email} annotations (on {@link ContactDto}) do the field-level
 * validation — nothing re-declared here; {@code @Valid} is required for those nested annotations
 * to actually run. No {@code photoUrl} — see docs/specs/024-sponsor-contacts.md's Non-goals. See
 * docs/specs/024-sponsor-contacts.md.
 */
public record CreateSponsorContactRequest(
        @Valid @NotNull ContactDto contact, @NotBlank String role, boolean isPrimary) {
}
