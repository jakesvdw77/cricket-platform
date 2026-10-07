package com.cricketlegend.domain;

/**
 * Which kinds of availability poll a view shows (docs/specs/083-availability-filters-and-toolbars.md):
 * {@code ALL} both, {@code GROUP} only section-level {@link SectionAvailabilityRound}s, {@code SQUAD}
 * only per-match {@link MatchAvailabilityPoll}s.
 */
public enum AvailabilityPollTypeFilter {
    ALL,
    GROUP,
    SQUAD
}
