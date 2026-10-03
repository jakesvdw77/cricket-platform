package com.cricketlegend.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Where a player already is for an overlapping slot (docs/specs/076-team-selection.md). {@code
 * canRelease} is true when the acting caller may administer the other team's section.
 */
public record SelectionTakenDto(
        UUID teamId,
        String teamName,
        UUID matchId,
        Instant matchDate,
        UUID sideId,
        boolean sameMatch,
        boolean announced,
        boolean canRelease) {
}
