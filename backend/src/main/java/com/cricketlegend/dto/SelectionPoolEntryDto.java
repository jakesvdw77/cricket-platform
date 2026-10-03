package com.cricketlegend.dto;

import com.cricketlegend.domain.SelectionAvailability;
import com.cricketlegend.domain.SelectionRejectionReason;
import java.util.UUID;

/** One candidate in a {@link SelectionPoolDto} (docs/specs/076-team-selection.md). */
public record SelectionPoolEntryDto(
        UUID playerProfileId,
        String firstName,
        String lastName,
        Integer jerseyNumber,
        SelectionAvailability availability,
        boolean selected,
        boolean selectable,
        SelectionRejectionReason reason,
        String reasonText,
        SelectionTakenDto taken) {
}
