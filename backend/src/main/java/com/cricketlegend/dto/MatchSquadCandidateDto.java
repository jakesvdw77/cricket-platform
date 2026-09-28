package com.cricketlegend.dto;

import java.util.UUID;

/**
 * One player with an {@code AVAILABLE} {@code SectionAvailabilityResponse} for a match+team's
 * resolved window — the "available pool" pane of the two-pane picker. {@code pickedElsewhere} is
 * non-null when this candidate already holds a {@code MatchSquadMember} row for this same window,
 * via a different match/team (Part C's UI indicator, not a silent disable). See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public record MatchSquadCandidateDto(
        UUID playerProfileId,
        String firstName,
        String lastName,
        Integer jerseyNumber,
        MatchSquadPickedElsewhereDto pickedElsewhere) {
}
