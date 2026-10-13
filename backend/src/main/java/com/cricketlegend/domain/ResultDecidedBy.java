package com.cricketlegend.domain;

/** docs/specs/100-match-results-core.md: what settled a WON result; REGULAR unless DLS or a super over decided it. */
public enum ResultDecidedBy {
    REGULAR,
    DLS,
    SUPER_OVER
}
