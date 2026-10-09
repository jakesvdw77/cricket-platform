package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * One player row of the team-selection overview: {@code pickedCount} is the number of cells picked,
 * {@code cells} has one cell per own side per match, in match order.
 */
public record TeamSelectionPlayerDto(
        UUID playerId, String firstName, String lastName, int pickedCount, List<TeamSelectionCellDto> cells) {
}
