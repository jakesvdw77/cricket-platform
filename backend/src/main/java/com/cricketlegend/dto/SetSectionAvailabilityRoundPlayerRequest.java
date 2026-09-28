package com.cricketlegend.dto;

import com.cricketlegend.domain.AvailabilityStatus;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * PUT /api/v1/public/section-availability-rounds/{roundId}/players/{playerProfileId} (and its
 * admin-override mirror at
 * .../manage/clubs/{clubId}/section-availability-rounds/{roundId}/players/{playerProfileId})
 * payload — sets that player's status for one specific bracket, upserting the resolved window's
 * own {@code SectionAvailabilityResponse} row. Identifies the bracket by {@link #windowId}
 * directly rather than {@code dayPart} alone, per the fixture-group-selection revision — a round
 * can now own several windows sharing the same {@code dayPart} across different dates, ambiguous
 * by {@code dayPart} alone, unambiguous by {@code windowId}. See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public record SetSectionAvailabilityRoundPlayerRequest(@NotNull UUID windowId, @NotNull AvailabilityStatus status) {
}
