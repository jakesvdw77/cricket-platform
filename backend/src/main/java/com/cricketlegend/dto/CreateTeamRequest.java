package com.cricketlegend.dto;

import com.cricketlegend.domain.SquadMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * POST /api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams payload. {@code clubId}/{@code
 * sectionId} come from the URL path, not the body — a {@code Team} is always created in the
 * context of a specific section. See docs/specs/026-teams.md.
 *
 * <p>{@code abbreviation}/{@code groundName}/{@code socialLinks} (docs/specs/
 * 057-team-extended-profile.md) give {@code Team} the same club-facing profile shape {@code
 * CreateLeagueRequest} already has — every one optional. {@code @Valid} on {@code socialLinks}
 * is mandatory here from the start — docs/specs/022-club-social-media.md found a real bug where
 * this annotation was missing, silently skipping validation of the nested list.
 *
 * <p>{@code squadMode} (docs/specs/063-section-availability-and-flexible-squads.md) is {@code
 * @NotNull} — the frontend always sends it, defaulting to {@code STATIC}, avoiding a null-default
 * branch in the service.
 */
public record CreateTeamRequest(
        @NotBlank String name,
        String logoUrl,
        String abbreviation,
        String groundName,
        @Valid List<SocialLinkDto> socialLinks,
        @NotNull SquadMode squadMode) {
}
