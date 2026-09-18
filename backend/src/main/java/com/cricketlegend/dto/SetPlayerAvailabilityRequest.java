package com.cricketlegend.dto;

import com.cricketlegend.domain.AvailabilityStatus;
import jakarta.validation.constraints.NotNull;

/**
 * PUT /api/v1/public/polls/{pollId}/players/{playerProfileId} payload — upserts the caller's own
 * {@link com.cricketlegend.domain.PlayerAvailability} row. See
 * docs/specs/032-match-availability-polls.md.
 */
public record SetPlayerAvailabilityRequest(@NotNull AvailabilityStatus status) {
}
