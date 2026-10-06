package com.cricketlegend.exception;

/**
 * A player is already in another team's selection for an overlapping slot of the same club (or the other side of the same match). Maps to HTTP 409 via its {@link ConflictException} base — see docs/specs/076-team-selection.md.
 */
public class PlayerTakenForSlotException extends ConflictException {
    public PlayerTakenForSlotException(String message) {
        super(message);
    }
}
