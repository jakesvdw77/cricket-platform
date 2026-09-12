package com.cricketlegend.dto;

import com.cricketlegend.domain.PlayingRole;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * POST .../sides/{sideId}/players payload — appended at the end of the batting order. Validated:
 * squad membership (for the match's own season), the applicable XI cap, age eligibility; 409 if
 * already added to this side. See docs/specs/029-league-management.md.
 */
public record AddMatchSidePlayerRequest(@NotNull UUID playerProfileId, @NotNull PlayingRole role) {
}
