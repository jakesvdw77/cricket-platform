package com.cricketlegend.dto;

import com.cricketlegend.domain.LeagueSource;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

/**
 * POST /api/v1/manage/clubs/{clubId}/leagues payload. {@code source} defaults to {@code INTERNAL}
 * when null, {@code maxPlayingXiSize} defaults to 11 when null, {@code allowSubstitutions}
 * defaults to false when null — applied in the service, not here, so a partial payload from an
 * older client still works. {@code minAge}/{@code maxAge} are validated {@code minAge <= maxAge}
 * when both are set (400), mirroring {@code CreateSectionRequest}'s identical rule — but unlike
 * {@code Section}'s fields, these are ENFORCED (see docs/specs/029-league-management.md's Problem
 * &amp; Goals divergence note). See docs/specs/029-league-management.md.
 */
public record CreateLeagueRequest(
        @NotBlank String name,
        LeagueSource source,
        Integer maxPlayingXiSize,
        Boolean allowSubstitutions,
        Integer minAge,
        Integer maxAge,
        LocalDate ageCutoffDate) {
}
