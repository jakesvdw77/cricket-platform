package com.cricketlegend.dto;

import com.cricketlegend.domain.LeagueFormat;
import com.cricketlegend.domain.LeagueSource;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Read shape of a club's own {@link com.cricketlegend.domain.League}. {@code
 * currentSeasonTeamCount}/{@code currentSeasonLabel}/{@code currentSeasonPlayingConditionsUrl}
 * (docs/specs/050-league-schedule-and-fixtures.md) are read-time computed fields with no matching
 * {@code League} column — resolved together, once per {@code LeagueServiceImpl.list()} call, not
 * per league. See docs/specs/029-league-management.md.
 *
 * <p>{@code format}/{@code logoUrl}/{@code phone}/{@code website}/{@code email}/{@code
 * socialLinks} (docs/specs/053-league-extended-profile.md) give {@code League} the same
 * club-facing profile shape {@code SponsorDto}/{@code ClubProfileDto} already have — every one
 * nullable/optional, reusing {@link SocialLinkDto} unchanged, same pattern as {@code
 * SponsorDto.socialLinks}.
 */
public record LeagueDto(
        UUID id,
        UUID clubId,
        String name,
        LeagueSource source,
        int maxPlayingXiSize,
        Integer minAge,
        Integer maxAge,
        LocalDate ageCutoffDate,
        LeagueFormat format,
        String logoUrl,
        String phone,
        String website,
        String email,
        List<SocialLinkDto> socialLinks,
        boolean active,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy,
        int currentSeasonTeamCount,
        String currentSeasonLabel,
        String currentSeasonPlayingConditionsUrl) {
}
