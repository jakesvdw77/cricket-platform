package com.cricketlegend.dto;

import com.cricketlegend.domain.LeagueSource;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

/**
 * PUT /api/v1/manage/clubs/{clubId}/leagues/{leagueId} payload. Same fields, same {@code
 * minAge <= maxAge} validation as {@link CreateLeagueRequest}. See
 * docs/specs/029-league-management.md.
 */
public record UpdateLeagueRequest(
        @NotBlank String name,
        LeagueSource source,
        Integer maxPlayingXiSize,
        Boolean allowSubstitutions,
        Integer minAge,
        Integer maxAge,
        LocalDate ageCutoffDate) {
}
