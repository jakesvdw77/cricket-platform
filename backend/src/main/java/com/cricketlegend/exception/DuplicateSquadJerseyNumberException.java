package com.cricketlegend.exception;

/**
 * Another player already holds the requested jersey number on this team's squad for this season.
 * Maps to HTTP 409 via its ConflictException base — see docs/standards/backend.md.
 */
public class DuplicateSquadJerseyNumberException extends ConflictException {
    public DuplicateSquadJerseyNumberException(String message) {
        super(message);
    }
}
