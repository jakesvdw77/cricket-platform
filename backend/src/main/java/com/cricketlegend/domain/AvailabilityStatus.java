package com.cricketlegend.domain;

/**
 * A squad member's self-reported status against a {@link MatchAvailabilityPoll} — fresh, clearer
 * names than the legacy Cricket Legend app's own {@code YES}/{@code NO}/{@code UNSURE}, since this
 * is a new entity in this codebase, not a literal port. See
 * docs/specs/032-match-availability-polls.md.
 */
public enum AvailabilityStatus {
    AVAILABLE,
    UNAVAILABLE,
    UNSURE
}
