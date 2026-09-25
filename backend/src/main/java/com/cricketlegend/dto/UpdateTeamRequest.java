package com.cricketlegend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

/**
 * PUT /api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId} payload. Deliberately
 * has no {@code sectionId} field — re-parenting a {@code Team} to a different {@code Section} is
 * out of scope (see docs/specs/026-teams.md's Non-goals). See docs/specs/026-teams.md.
 *
 * <p>Same {@code abbreviation}/{@code groundName}/{@code socialLinks} fields as {@link
 * CreateTeamRequest} (docs/specs/057-team-extended-profile.md) — a full-resource replace, an
 * omitted field clears it. {@code @Valid} on {@code socialLinks} is mandatory (see {@link
 * CreateTeamRequest}'s Javadoc).
 */
public record UpdateTeamRequest(
        @NotBlank String name,
        String logoUrl,
        String abbreviation,
        String groundName,
        @Valid List<SocialLinkDto> socialLinks) {
}
