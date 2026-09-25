package com.cricketlegend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * PUT /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId} payload — a
 * full-resource replace, same field set as {@link CreateLeagueContactRequest}. See
 * docs/specs/054-league-contacts.md.
 */
public record UpdateLeagueContactRequest(
        @Valid @NotNull ContactDto contact, @NotBlank String role, boolean isPrimary) {
}
