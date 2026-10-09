package com.cricketlegend.dto;

import com.cricketlegend.domain.PlayingRole;
import java.util.UUID;

/** One picked player of a side, with the markers (docs/specs/093-team-selection-hub.md). */
public record TeamSelectionPickDto(
        UUID playerId,
        String firstName,
        String lastName,
        Integer battingOrder,
        PlayingRole role,
        boolean captain,
        boolean wicketKeeper,
        boolean twelfthMan) {
}
