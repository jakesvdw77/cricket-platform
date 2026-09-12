package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

/**
 * PUT .../sides/{sideId}/players/reorder payload — the full new batting order for every player
 * currently on this side; 400 if the set doesn't exactly match the side's current players. See
 * docs/specs/029-league-management.md.
 */
public record ReorderMatchSidePlayersRequest(@NotNull List<UUID> playerProfileIds) {
}
