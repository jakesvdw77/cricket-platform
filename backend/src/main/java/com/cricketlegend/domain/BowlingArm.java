package com.cricketlegend.domain;

/**
 * A player's bowling arm — optional cricket-specific info on {@link PlayerProfile}, per
 * docs/specs/028-players.md. Captured independently of {@link BowlingType} (arm-independent
 * style, e.g. "Fast" rather than combined codes like "RFM"). Unset means not known/not
 * applicable — not every player bowls.
 */
public enum BowlingArm {
    RIGHT_ARM,
    LEFT_ARM
}
