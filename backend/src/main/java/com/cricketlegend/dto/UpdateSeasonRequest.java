package com.cricketlegend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/**
 * PUT /api/v1/manage/clubs/{clubId}/seasons/{seasonId} payload. Same {@code startDate <=
 * endDate} validation as {@link CreateSeasonRequest}. See docs/specs/029-league-management.md.
 */
public record UpdateSeasonRequest(
        @NotBlank String label, @NotNull LocalDate startDate, @NotNull LocalDate endDate) {
}
