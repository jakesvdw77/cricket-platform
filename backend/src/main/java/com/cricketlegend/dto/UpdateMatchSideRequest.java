package com.cricketlegend.dto;

import java.util.UUID;

/**
 * PUT .../sides/{sideId} payload — sets (or clears, when null) captain/wicketkeeper/twelfth man.
 * {@code captainPlayerId}/{@code wicketKeeperPlayerId} must already be one of this side's ordered
 * XI; {@code twelfthManPlayerId} must NOT be. Both squad-membership and age-eligibility are
 * re-validated for {@code twelfthManPlayerId} (it doesn't count against the XI cap, but it's still
 * a real player reference on the side — see docs/specs/029-league-management.md's business rules).
 */
public record UpdateMatchSideRequest(
        UUID captainPlayerId, UUID wicketKeeperPlayerId, UUID twelfthManPlayerId) {
}
