package com.cricketlegend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/**
 * POST /api/v1/manage/clubs/{clubId}/seasons payload. {@code startDate <= endDate} is validated
 * at the service layer (400). See docs/specs/029-league-management.md.
 */
public record CreateSeasonRequest(
        @NotBlank String label, @NotNull LocalDate startDate, @NotNull LocalDate endDate) {
}
