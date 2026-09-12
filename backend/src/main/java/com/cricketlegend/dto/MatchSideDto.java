package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * Read shape of a {@link com.cricketlegend.domain.Match}'s side — a real {@code Team}'s ordered
 * playing XI plus captain/wicketkeeper/twelfth man. See docs/specs/029-league-management.md.
 */
public record MatchSideDto(
        UUID id,
        UUID matchId,
        UUID teamId,
        UUID captainPlayerId,
        UUID wicketKeeperPlayerId,
        UUID twelfthManPlayerId,
        List<MatchSidePlayerDto> players) {
}
