package com.cricketlegend.domain;

/** Which route created a {@link Person} row (docs/specs/119). Support and duplicate hints only. */
public enum PersonOrigin {
    CLUB_CREATED,
    INVITED,
    SELF_REGISTERED
}
