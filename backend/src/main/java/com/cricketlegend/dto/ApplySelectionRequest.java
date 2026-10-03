package com.cricketlegend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * PUT .../sides/{sideId}/selection payload: the complete desired set of selected players. An empty
 * list clears the side. See docs/specs/076-team-selection.md.
 */
public record ApplySelectionRequest(@NotNull @Valid List<SelectionEntryRequest> players) {
}
