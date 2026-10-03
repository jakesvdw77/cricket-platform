package com.cricketlegend.domain;

/**
 * One cell of the player availability grid (docs/specs/068-player-availability-grid.md): the
 * three real answers, {@code NO_RESPONSE} (in the game's poll audience but not answered yet) and
 * {@code NOT_IN_POLL} (no poll covers the game for this player, or the player is outside its
 * audience).
 */
public enum PlayerAvailabilityCellStatus {
    AVAILABLE,
    UNSURE,
    UNAVAILABLE,
    NO_RESPONSE,
    NOT_IN_POLL
}
