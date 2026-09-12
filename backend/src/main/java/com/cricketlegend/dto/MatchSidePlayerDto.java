package com.cricketlegend.dto;

import com.cricketlegend.domain.PlayingRole;
import java.util.UUID;

/**
 * One player in a {@link MatchSideDto}'s ordered batting line-up. See
 * docs/specs/029-league-management.md.
 */
public record MatchSidePlayerDto(UUID playerProfileId, int battingOrder, PlayingRole role) {
}
