package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;

/**
 * PATCH /api/v1/manage/clubs/{clubId}/matches/{matchId}/date-time payload (docs/specs/118): the match's new date and
 * time. Nothing else about the match can be sent or changed through it.
 */
public record UpdateMatchDateTimeRequest(@NotNull Instant matchDate) {
}
