package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * Read shape of a {@link com.cricketlegend.domain.Match}'s side — a real {@code Team}'s ordered
 * selection plus captain/wicketkeeper/twelfth man. {@code limits} (docs/specs/076-team-selection.md)
 * says how many players the selection may hold. See docs/specs/029-league-management.md.
 */
public record MatchSideDto(
        UUID id,
        UUID matchId,
        UUID teamId,
        UUID captainPlayerId,
        UUID wicketKeeperPlayerId,
        UUID twelfthManPlayerId,
        List<MatchSidePlayerDto> players,
        boolean announced,
        SelectionLimitsDto limits) {
}
