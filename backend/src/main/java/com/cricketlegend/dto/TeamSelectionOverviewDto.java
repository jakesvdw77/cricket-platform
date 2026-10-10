package com.cricketlegend.dto;

import java.util.List;

/**
 * The team-selection hub's one read (docs/specs/093-team-selection-hub.md): matches (columns, with
 * the picks of the club's own side or sides), players (rows, one cell per own side per match) and the
 * counters. {@code truncated} is true when the hard caps ({@code TeamSelectionServiceImpl.MAX_MATCHES}
 * / {@code MAX_PLAYERS}) cut anything.
 */
public record TeamSelectionOverviewDto(
        List<TeamSelectionMatchDto> matches,
        List<TeamSelectionPlayerDto> players,
        TeamSelectionCountsDto counts,
        boolean truncated) {
}
