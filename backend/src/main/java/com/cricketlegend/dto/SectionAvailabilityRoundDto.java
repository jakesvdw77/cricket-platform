package com.cricketlegend.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Admin list/create/open/close/description-edit row for a {@code SectionAvailabilityRound} —
 * {@code brackets} is however many windows this round actually owns, one to several, no longer a
 * fixed pair (see Data Model Changes, the fixture-group-selection revision). {@code
 * firstMatchKickoff} is the exact earliest covered match kickoff (docs/specs/066), used by clients
 * for the default close time and its validation. See
 * docs/specs/063-section-availability-and-flexible-squads.md. {@code canReopen} (docs/specs/082)
 * is true when both reopen rules allow a reopen right now.
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
        Instant firstMatchKickoff,
        boolean open,
        List<SectionAvailabilityRoundBracketDto> brackets,
        boolean canReopen) {
}
