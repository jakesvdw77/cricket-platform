package com.cricketlegend.domain;

/**
 * docs/specs/101-match-results-our-side-scorecard.md: how a batter's innings ended. A <em>wicket</em> counts toward
 * the innings wicket count: everything except {@link #NOT_OUT}, {@link #DID_NOT_BAT} and {@link #RETIRED_NOT_OUT}.
 * {@link #bowlerCredited} dismissals count toward a bowler's wickets; the other wickets (run-out, obstructing the
 * field, handled ball, hit ball twice, timed out, retired out) are non-bowler wickets for bowling reconciliation.
 * Mirrored by the frontend's {@code utils/dismissal.ts}.
 */
public enum DismissalType {
    NOT_OUT(false, false),
    DID_NOT_BAT(false, false),
    BOWLED(true, true),
    CAUGHT(true, true),
    CAUGHT_AND_BOWLED(true, true),
    LBW(true, true),
    STUMPED(true, true),
    RUN_OUT(true, false),
    HIT_WICKET(true, true),
    HANDLED_BALL(true, false),
    OBSTRUCTING_FIELD(true, false),
    HIT_BALL_TWICE(true, false),
    TIMED_OUT(true, false),
    RETIRED_NOT_OUT(false, false),
    RETIRED_OUT(true, false);

    private final boolean wicket;
    private final boolean bowlerCredited;

    DismissalType(boolean wicket, boolean bowlerCredited) {
        this.wicket = wicket;
        this.bowlerCredited = bowlerCredited;
    }

    /** True when this ends the innings of the batter and counts as a wicket. */
    public boolean isWicket() {
        return wicket;
    }

    public boolean isBowlerCredited() {
        return bowlerCredited;
    }

    /** A wicket not credited to a bowler. */
    public boolean isNonBowlerWicket() {
        return wicket && !bowlerCredited;
    }

    /** Whether the row batted at all: everything except {@link #DID_NOT_BAT}. */
    public boolean batted() {
        return this != DID_NOT_BAT;
    }
}
