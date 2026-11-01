package com.cricketlegend.domain;

/**
 * docs/specs/135: the match status shown to a player. Only what the data holds: a deactivated match reads CANCELLED
 * and POSTPONED is reserved (the model has no postponed state yet).
 */
public enum MyMatchStatus {
    UPCOMING,
    PLAYED,
    CANCELLED,
    POSTPONED
}
