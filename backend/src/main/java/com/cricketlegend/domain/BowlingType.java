package com.cricketlegend.domain;

/**
 * A player's bowling style — optional cricket-specific info on {@link PlayerProfile}, per
 * docs/specs/028-players.md. Fixed list, order matters for the UI dropdown (see the spec's UI
 * Requirements). Arm-independent (see {@link BowlingArm}) — this is style only, not a combined
 * code like "RFM". Unset means not known/not applicable — not every player bowls.
 */
public enum BowlingType {
    FAST,
    FAST_MEDIUM,
    MEDIUM_FAST,
    MEDIUM,
    OFF_BREAK,
    LEG_BREAK,
    ORTHODOX_SPIN,
    WRIST_SPIN,
    GOOGLY
}
