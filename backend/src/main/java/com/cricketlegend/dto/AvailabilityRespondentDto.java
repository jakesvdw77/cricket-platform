package com.cricketlegend.dto;

import java.util.UUID;

/**
 * One respondent entry within an {@link OpenAvailabilityPollDto}'s per-status bucket —
 * {@link PlayerAvailabilityRowDto}'s own field set minus {@code status}, which would be redundant
 * noise since it's always the same value for every entry in a given bucket (implied by which of
 * the three lists the entry is in). See docs/specs/034-availability-polls-dashboard.md's API
 * Contract.
 */
public record AvailabilityRespondentDto(
        UUID playerProfileId, String firstName, String lastName, Integer squadJerseyNumber) {
}
