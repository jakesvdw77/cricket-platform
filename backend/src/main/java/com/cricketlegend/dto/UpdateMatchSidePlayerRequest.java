package com.cricketlegend.dto;

import com.cricketlegend.domain.PlayingRole;
import jakarta.validation.constraints.NotNull;

/**
 * PUT .../sides/{sideId}/players/{playerProfileId} payload — updates that player's {@code role}
 * only; batting order/eligibility are unaffected. See docs/specs/029-league-management.md.
 */
public record UpdateMatchSidePlayerRequest(@NotNull PlayingRole role) {
}
