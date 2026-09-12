package com.cricketlegend.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Read shape of a club's own {@link com.cricketlegend.domain.Season}. See
 * docs/specs/029-league-management.md.
 */
public record SeasonDto(
        UUID id,
        UUID clubId,
        String label,
        LocalDate startDate,
        LocalDate endDate,
        boolean active,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy) {
}
