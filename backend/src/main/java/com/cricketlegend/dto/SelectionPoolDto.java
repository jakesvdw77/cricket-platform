package com.cricketlegend.dto;

import com.cricketlegend.domain.SelectionPoolBasis;
import java.util.List;
import java.util.UUID;

/**
 * The candidates a manager can pick a team's players from for one match
 * (docs/specs/076-team-selection.md). {@code sideId} is null until the side exists.
 */
public record SelectionPoolDto(
        UUID matchId,
        UUID teamId,
        UUID sideId,
        SelectionPoolBasis basis,
        boolean wholeSection,
        SelectionCoveringPollDto coveringPoll,
        boolean truncated,
        List<SelectionPoolEntryDto> entries) {
}
