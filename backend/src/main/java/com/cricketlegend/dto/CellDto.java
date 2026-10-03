package com.cricketlegend.dto;

import com.cricketlegend.domain.PlayerAvailabilityCellStatus;
import java.util.UUID;

/**
 * One (player, game) cell of the player availability grid; {@code picked} is independent of
 * {@code status} (a player can be picked for a game whose poll they are not in). See
 * docs/specs/068-player-availability-grid.md.
 */
public record CellDto(UUID matchId, PlayerAvailabilityCellStatus status, boolean picked) {
}
