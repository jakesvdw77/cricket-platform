package com.cricketlegend.dto;

import com.cricketlegend.domain.LeagueSource;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Read shape of a club's own {@link com.cricketlegend.domain.League}. See
 * docs/specs/029-league-management.md.
 */
public record LeagueDto(
        UUID id,
        UUID clubId,
        String name,
        LeagueSource source,
        int maxPlayingXiSize,
        boolean allowSubstitutions,
        Integer minAge,
        Integer maxAge,
        LocalDate ageCutoffDate,
        boolean active,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy) {
}
