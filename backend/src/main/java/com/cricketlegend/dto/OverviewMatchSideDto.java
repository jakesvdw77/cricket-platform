package com.cricketlegend.dto;

import java.util.UUID;

/**
 * An own-club side of an {@link OverviewMatchDto}. {@code selectedCount} is the number of selected
 * players (0 when the side row does not exist yet); {@code maxSelected} is the most players the
 * selection may hold (docs/specs/076-team-selection.md, places plus the 12th man), null only when the
 * match's league can no longer be found; {@code announced} is false without a side row.
 */
public record OverviewMatchSideDto(
        UUID teamId, String teamName, int selectedCount, Integer maxSelected, boolean announced) {
}
