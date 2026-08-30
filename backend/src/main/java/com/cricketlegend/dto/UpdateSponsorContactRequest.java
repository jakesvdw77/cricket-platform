package com.cricketlegend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * PUT /api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId} payload — a
 * full-resource replace, same field set as {@link CreateSponsorContactRequest}. See
 * docs/specs/024-sponsor-contacts.md.
 */
public record UpdateSponsorContactRequest(
        @Valid @NotNull ContactDto contact, @NotBlank String role, boolean isPrimary) {
}
