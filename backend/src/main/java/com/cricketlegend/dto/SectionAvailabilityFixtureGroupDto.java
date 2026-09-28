package com.cricketlegend.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * GET .../section-availability-fixture-groups response row — one proposed group per {@code
 * SectionAvailabilityFixtureGroupResolver}'s own distinct-calendar-date-adjacency clustering (a
 * weekend groups, a two-day-gap date starts its own group). {@link #suggestedDescription} is
 * built from the group's own date range and section name, pre-filling {@code
 * CreateSectionAvailabilityRoundRequest.description} before the admin edits it. Every match in
 * {@link #matches} is pre-selected by the UI; an {@code alreadyPolled} one renders disabled. See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public record SectionAvailabilityFixtureGroupDto(
        String suggestedDescription,
        LocalDate startDate,
        LocalDate endDate,
        List<SectionAvailabilityFixtureMatchDto> matches) {
}
