package com.cricketlegend.service.support;

import com.cricketlegend.domain.SelectionRejectionReason;
import java.util.UUID;

/**
 * Why one player cannot be selected, as {@link SelectionRules} computes it
 * (docs/specs/076-team-selection.md). {@code taken} is set for TAKEN_FOR_SLOT only.
 */
public record SelectionRejection(
        UUID playerProfileId,
        String playerName,
        SelectionRejectionReason reason,
        String message,
        TakenBy taken) {
}
