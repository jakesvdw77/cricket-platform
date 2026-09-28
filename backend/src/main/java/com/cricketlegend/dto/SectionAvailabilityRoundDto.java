package com.cricketlegend.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Admin list/create/open/close/description-edit row for a {@code SectionAvailabilityRound} —
 * {@code brackets} is however many windows this round actually owns, one to several, no longer a
 * fixed pair (see Data Model Changes, the fixture-group-selection revision). See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public record SectionAvailabilityRoundDto(
        UUID id,
        UUID sectionId,
        String sectionName,
        String description,
        LocalDate firstMatchDate,
        LocalDate lastMatchDate,
        boolean autoClose,
        Instant scheduledCloseAt,
        boolean open,
        List<SectionAvailabilityRoundBracketDto> brackets) {
}
