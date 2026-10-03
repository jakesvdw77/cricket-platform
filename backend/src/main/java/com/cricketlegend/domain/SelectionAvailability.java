package com.cricketlegend.domain;

/**
 * A player's answer on the availability poll covering a match, as the team selection sees it
 * (docs/specs/076-team-selection.md section 7). Only {@link #UNAVAILABLE} blocks a selection.
 */
public enum SelectionAvailability {
    AVAILABLE,
    UNSURE,
    UNAVAILABLE,
    NO_RESPONSE,
    NOT_POLLED
}
