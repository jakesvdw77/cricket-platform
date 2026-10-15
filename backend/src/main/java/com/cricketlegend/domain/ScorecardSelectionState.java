package com.cricketlegend.domain;

/**
 * docs/specs/101: how far our team's selection for a match has got, for the scorecard's not-selected notice: {@link
 * #NONE} (no selection found), {@link #NOT_ANNOUNCED} (a selection exists but is not announced) or {@link #ANNOUNCED}.
 */
public enum ScorecardSelectionState {
    NONE,
    NOT_ANNOUNCED,
    ANNOUNCED
}
