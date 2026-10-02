package com.cricketlegend.domain;

/**
 * Which kind of availability poll covers a match (docs/specs/064-unified-availability-polls.md):
 * {@code SQUAD} is the per-match {@link MatchAvailabilityPoll}, {@code GROUP} is the section-level
 * {@link SectionAvailabilityRound}.
 */
public enum AvailabilityPollType {
    SQUAD,
    GROUP
}
