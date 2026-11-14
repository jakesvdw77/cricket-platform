package com.cricketlegend.domain;

/**
 * Where a player usually bats, as a group rather than a number (docs/specs/151-server-test-round-one.md). Optional: unset
 * means not recorded. Used by the squad Analysis page to show the shape of a batting order.
 */
public enum BattingPosition {
    OPENER,
    TOP_ORDER,
    MIDDLE_ORDER,
    LOWER_ORDER
}
