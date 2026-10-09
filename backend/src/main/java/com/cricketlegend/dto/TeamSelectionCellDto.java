package com.cricketlegend.dto;

import com.cricketlegend.domain.SelectionRejectionReason;
import java.util.UUID;

/**
 * One (player, own side of a match) cell. A picked cell is {@code pickable} (it can always be
 * unpicked) with no reason. An unpicked cell is {@code pickable} exactly when the apply endpoint
 * would accept adding the player ({@code SelectionRules}, plus TEAM_FULL when the side holds
 * {@code limits.maxSelected} already); otherwise {@code reasonCode} says why. {@code sideId} is
 * null while the side does not exist yet.
 */
public record TeamSelectionCellDto(
        UUID matchId, UUID teamId, UUID sideId, boolean picked, boolean pickable, SelectionRejectionReason reasonCode) {
}
