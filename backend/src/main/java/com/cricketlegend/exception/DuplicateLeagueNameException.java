package com.cricketlegend.exception;

/**
 * A league name that already exists (case-insensitive, trimmed, inactive leagues included) in the same club, when
 * duplicating a league. Maps to HTTP 409 via its ConflictException base - see docs/standards/backend.md and
 * docs/specs/096-duplicate-league.md.
 */
public class DuplicateLeagueNameException extends ConflictException {
    public DuplicateLeagueNameException(String message) {
        super(message);
    }
}
