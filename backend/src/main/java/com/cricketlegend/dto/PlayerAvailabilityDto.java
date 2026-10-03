package com.cricketlegend.dto;

import java.util.List;

/**
 * The player availability grid (docs/specs/068-player-availability-grid.md): games as columns,
 * players as rows, one cell per (player, game). {@code truncated} is true when the service's
 * hard caps ({@code PlayerAvailabilityServiceImpl.MAX_GAMES}/{@code MAX_PLAYERS}) cut anything.
 */
public record PlayerAvailabilityDto(List<GameColumnDto> games, List<PlayerRowDto> players, boolean truncated) {
}
