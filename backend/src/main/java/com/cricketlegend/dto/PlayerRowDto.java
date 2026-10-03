package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * One player row of the player availability grid; {@code cells} are in the same order as {@link
 * PlayerAvailabilityDto#games()}. {@code answeredCount} counts AVAILABLE/UNSURE/UNAVAILABLE
 * cells, {@code pickedCount} the picked ones; {@code jerseyNumber} is {@code
 * PlayerProfile.jerseyNumber}. See docs/specs/068-player-availability-grid.md.
 */
public record PlayerRowDto(
        UUID playerProfileId,
        String firstName,
        String lastName,
        Integer jerseyNumber,
        int answeredCount,
        int pickedCount,
        List<CellDto> cells) {
}
