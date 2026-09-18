package com.cricketlegend.dto;

import com.cricketlegend.domain.AvailabilityStatus;
import java.util.UUID;

/**
 * One squad member's row in a poll's response list — {@code status} is {@code null} when that
 * squad member hasn't responded yet. {@code squadJerseyNumber} is this squad membership's own
 * jersey number ({@code TeamSquadMember.jerseyNumber}, per docs/specs/031-jersey-numbers.md),
 * shown on both the admin responses list and the public page for free. Shared shape for both the
 * admin {@code GET .../responses} endpoint and the public poll endpoints. See
 * docs/specs/032-match-availability-polls.md.
 */
public record PlayerAvailabilityRowDto(
        UUID playerProfileId,
        String firstName,
        String lastName,
        Integer squadJerseyNumber,
        AvailabilityStatus status) {
}
