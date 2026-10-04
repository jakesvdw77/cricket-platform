package com.cricketlegend.domain;

/**
 * Machine-readable reason a player cannot be selected (docs/specs/076-team-selection.md). The pool
 * uses the first four; the apply endpoint can also report the last three.
 */
public enum SelectionRejectionReason {
    AGE_INELIGIBLE,
    SAID_UNAVAILABLE,
    NOT_CONFIRMED,
    TAKEN_FOR_SLOT,
    NOT_IN_POOL,
    TEAM_FULL,
    POSITION_INVALID
}
