package com.cricketlegend.exception;

/**
 * A match cannot be deleted because something is recorded against it (a result, an availability poll, a squad, a team
 * selection or an availability window); the message names what and points to Deactivate. Maps to HTTP 409 via its
 * {@link ConflictException} base. See docs/specs/109-delete-empty-match.md.
 */
public class MatchNotEmptyException extends ConflictException {
    public MatchNotEmptyException(String message) {
        super(message);
    }
}
