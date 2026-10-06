package com.cricketlegend.dto;

import com.cricketlegend.domain.PlayingRole;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * One desired player of an {@link ApplySelectionRequest}. {@code role} null keeps the existing role
 * (BATSMAN for a new player); {@code battingOrder} null keeps the existing position (none for a new
 * player). See docs/specs/076-team-selection.md.
 */
public record SelectionEntryRequest(@NotNull UUID playerProfileId, PlayingRole role, Integer battingOrder) {
}
