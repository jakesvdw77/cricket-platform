package com.cricketlegend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * PUT /api/v1/manage/clubs/{clubId}/contacts/{contactId} payload — a full-resource replace, same
 * field set as {@link CreateClubContactRequest}. See docs/specs/021-club-contacts.md.
 */
public record UpdateClubContactRequest(
        @Valid @NotNull ContactDto contact,
        @NotBlank String role,
        boolean isPrimary,
        String photoUrl) {
}
