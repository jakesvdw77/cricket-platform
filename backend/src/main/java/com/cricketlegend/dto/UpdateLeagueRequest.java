package com.cricketlegend.dto;

import com.cricketlegend.domain.LeagueFormat;
import com.cricketlegend.domain.LeagueSource;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;
import java.util.List;

/**
 * PUT /api/v1/manage/clubs/{clubId}/leagues/{leagueId} payload. Same fields, same {@code
 * minAge <= maxAge} validation as {@link CreateLeagueRequest}, including the same five
 * docs/specs/053-league-extended-profile.md profile fields — a full-resource replace, matching
 * {@code CreateLeagueRequest}'s field set exactly, an omitted field clears it. {@code @Valid} on
 * {@code socialLinks} is mandatory (see {@link CreateLeagueRequest}'s Javadoc).
 */
public record UpdateLeagueRequest(
        @NotBlank String name,
        LeagueSource source,
        Integer maxPlayingXiSize,
        Integer minAge,
        Integer maxAge,
        LocalDate ageCutoffDate,
        LeagueFormat format,
        String logoUrl,
        String phone,
        String website,
        String email,
        @Valid List<SocialLinkDto> socialLinks) {
}
