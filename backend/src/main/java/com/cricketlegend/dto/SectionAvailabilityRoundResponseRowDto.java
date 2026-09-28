package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * One eligible player's row in a {@code SectionAvailabilityRound}'s response list — one status
 * entry per bracket the round owns ({@link #statuses}, replacing the pre-fixture-group-selection
 * fixed {@code morningStatus}/{@code afternoonStatus} pair), since a round's audience is resolved
 * once against its own section (eligibility is a section property, not a per-bracket one) but a
 * player answers each bracket independently. Shared shape for the admin {@code GET .../responses}
 * endpoint and the public round endpoints. See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public record SectionAvailabilityRoundResponseRowDto(
        UUID playerProfileId,
        String firstName,
        String lastName,
        Integer jerseyNumber,
        List<SectionAvailabilityRoundStatusDto> statuses) {
}
