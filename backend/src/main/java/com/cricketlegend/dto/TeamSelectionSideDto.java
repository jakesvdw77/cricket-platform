package com.cricketlegend.dto;

import com.cricketlegend.domain.TeamSelectionStatus;
import java.util.List;
import java.util.UUID;

/**
 * The club's own side of a match. {@code sideId} is null until the side exists (the first pick
 * creates it). {@code pickedCount} counts every selection row (the 12th man included) against {@code
 * limits.maxSelected}; {@code picks} are in batting order, then positionless picks by name, the 12th
 * man last. {@code placesFilled} is true when every pick but the 12th man has a batting position and
 * {@code limits.battingPlaces} of them are filled.
 */
public record TeamSelectionSideDto(
        UUID sideId,
        UUID teamId,
        String teamName,
        UUID sectionId,
        boolean home,
        String opponentName,
        boolean announced,
        TeamSelectionStatus status,
        SelectionLimitsDto limits,
        int pickedCount,
        boolean placesFilled,
        UUID captainPlayerId,
        UUID wicketKeeperPlayerId,
        UUID twelfthManPlayerId,
        List<TeamSelectionPickDto> picks) {
}
