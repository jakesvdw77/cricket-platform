package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

/**
 * PATCH /api/v1/manage/clubs/{clubId}/matches/{matchId}/date-time payload (docs/specs/118): the match's new date and
 * time. Nothing else about the match can be sent or changed through it. {@code acknowledgedWarnings} (optional,
 * docs/specs/132) are the confirmed scheduling warning codes.
 */
public record UpdateMatchDateTimeRequest(@NotNull Instant matchDate, List<String> acknowledgedWarnings) {

    public UpdateMatchDateTimeRequest(Instant matchDate) {
        this(matchDate, null);
    }
}
