package com.cricketlegend.domain;

/**
 * docs/specs/101: whether a bowling row's wickets or a fielding row's credits are derived from the dismissals
 * ({@link #DERIVED}: recomputed by the server on every scorecard save) or typed by the manager ({@link #MANUAL}: never
 * touched by the server). Existing rows are MANUAL.
 */
public enum CreditSource {
    MANUAL,
    DERIVED
}
