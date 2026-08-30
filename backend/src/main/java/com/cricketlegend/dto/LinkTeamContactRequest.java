package com.cricketlegend.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * POST .../teams/{teamId}/contacts/{contactId}/link payload — {@code role} is free text (e.g.
 * "Coach"), the UI suggests "Manager"/"Coach"/"Assistant Coach" as quick-fill, never a closed set.
 * See docs/specs/027-team-profile.md.
 */
public record LinkTeamContactRequest(@NotBlank String role) {
}
