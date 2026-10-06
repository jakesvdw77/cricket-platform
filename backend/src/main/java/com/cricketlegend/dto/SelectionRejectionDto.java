package com.cricketlegend.dto;

import com.cricketlegend.domain.SelectionRejectionReason;
import java.util.UUID;

/**
 * One refused player of an apply-selection request (docs/specs/076-team-selection.md).
 * {@code playerProfileId}/{@code playerName} are null for a whole-request reason (TEAM_FULL).
 */
public record SelectionRejectionDto(
        UUID playerProfileId,
        String playerName,
        SelectionRejectionReason reason,
        String message,
        SelectionTakenDto taken) {
}
