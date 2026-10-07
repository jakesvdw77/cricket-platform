package com.cricketlegend.dto;

import com.cricketlegend.domain.AvailabilityStatus;
import java.util.UUID;

/**
 * One squad member's row in a poll's response list — {@code status} is {@code null} when that
 * squad member hasn't responded yet. {@code squadJerseyNumber} is this squad membership's own
 * jersey number ({@code TeamSquadMember.jerseyNumber}, per docs/specs/031-jersey-numbers.md),
 * shown on both the admin responses list and the public page for free. Shared shape for both the
 * admin {@code GET .../responses} endpoint. {@code viaLink} is true when the player answered through
 * the public link (077), false or null otherwise. See
 * docs/specs/032-match-availability-polls.md.
 */
public record PlayerAvailabilityRowDto(
        UUID playerProfileId,
        String firstName,
        String lastName,
        Integer squadJerseyNumber,
        AvailabilityStatus status,
        Boolean viaLink) {

    /** A row with no "via link" marker (resolver output and manager-side overlays that carry none). */
    public PlayerAvailabilityRowDto(
            UUID playerProfileId,
            String firstName,
            String lastName,
            Integer squadJerseyNumber,
            AvailabilityStatus status) {
        this(playerProfileId, firstName, lastName, squadJerseyNumber, status, null);
    }
}
