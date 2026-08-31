package com.cricketlegend.domain;

/**
 * A player's batting stance — optional cricket-specific info on {@link PlayerProfile}, per
 * docs/specs/028-players.md. Unset means not known/not applicable.
 */
public enum BattingStance {
    RIGHT_HANDED,
    LEFT_HANDED
}
