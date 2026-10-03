package com.cricketlegend.dto;

import com.cricketlegend.domain.PlayingRole;
import java.util.UUID;

/**
 * One selected player of a {@link MatchSideDto}. {@code battingOrder} is null while the player is
 * selected but has no batting position (or is the 12th man). {@code firstName}/{@code lastName}
 * come from the player's profile so a selected player off the team's roster still has a name. See
 * docs/specs/029-league-management.md and docs/specs/076-team-selection.md.
 */
public record MatchSidePlayerDto(UUID playerProfileId, Integer battingOrder, PlayingRole role, String firstName, String lastName) {
}
