package com.cricketlegend.domain;

/** docs/specs/100-match-results-core.md: how a match ended. FORFEIT's winning side is the side that received the win. */
public enum ResultOutcomeType {
    WON,
    TIE,
    DRAW,
    NO_RESULT,
    ABANDONED,
    FORFEIT
}
