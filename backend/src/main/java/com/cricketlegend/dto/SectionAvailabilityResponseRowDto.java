package com.cricketlegend.dto;

import com.cricketlegend.domain.AvailabilityStatus;
import java.util.UUID;

/**
 * One eligible player's row in a {@code SectionAvailabilityWindow}'s response list — {@code
 * status} is {@code null} when that player hasn't responded yet. Deliberately a fresh shape, not a
 * reuse of {@link PlayerAvailabilityRowDto}: this spec's response rows carry the player's
 * *standing* {@code PlayerProfile.jerseyNumber} (docs/specs/031-jersey-numbers.md), not a squad
 * membership's own number — reusing {@code squadJerseyNumber}'s field name here would be actively
 * misleading. Shared shape for both the admin {@code GET .../responses} endpoint and the public
 * window endpoints. See docs/specs/063-section-availability-and-flexible-squads.md.
 */
public record SectionAvailabilityResponseRowDto(
        UUID playerProfileId,
        String firstName,
        String lastName,
        Integer jerseyNumber,
        AvailabilityStatus status) {
}
