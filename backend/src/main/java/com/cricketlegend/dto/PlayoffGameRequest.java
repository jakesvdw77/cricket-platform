package com.cricketlegend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

/** One game of a playoff round (docs/specs/155): its label, both sides, when and where. */
public record PlayoffGameRequest(
        // A game's own stage overrides the round's (a semi-final pair and a final can be created together).
        @Size(max = 60) String stage,
        @Size(max = 80) String label,
        @NotNull @Valid PlayoffSideRequest home,
        @NotNull @Valid PlayoffSideRequest away,
        @NotNull Instant matchDate,
        String venue,
        UUID playingAreaId) {
}
