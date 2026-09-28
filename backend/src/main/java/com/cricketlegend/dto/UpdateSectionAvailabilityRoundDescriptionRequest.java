package com.cricketlegend.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * PUT /api/v1/manage/clubs/{clubId}/section-availability-rounds/{roundId} payload — edits {@code
 * description} only, {@code 400} if blank. See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public record UpdateSectionAvailabilityRoundDescriptionRequest(@NotBlank String description) {
}
