package com.cricketlegend.domain;

/**
 * The bracket a {@link SectionAvailabilityWindow} covers — a fixed, deliberately minimal two-value
 * split of a match's own local time-of-day ({@code MORNING} strictly before noon, {@code
 * AFTERNOON} noon or later). A club running evening fixtures, or wanting a genuinely custom
 * time-range bracket, isn't served by this pass — a real, explicitly deferred future item, not a
 * closed decision (see the spec's Non-goals/Rollout Notes). See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public enum DayPart {
    MORNING,
    AFTERNOON
}
