package com.cricketlegend.domain;

/**
 * A {@link MatchSidePlayer}'s tagged role in the batting order — batsman/bowler/all-rounder, per
 * docs/specs/029-league-management.md's playing-XI requirement. Purely descriptive; not used for
 * any eligibility/cap enforcement.
 */
public enum PlayingRole {
    BATSMAN,
    BOWLER,
    ALL_ROUNDER
}
