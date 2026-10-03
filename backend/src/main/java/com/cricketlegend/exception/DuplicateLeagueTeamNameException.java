package com.cricketlegend.exception;

/**
 * A LeagueTeam name that already exists (case-insensitive, inactive rows included) in the same
 * league and season, on create or update. Maps to HTTP 409 via its ConflictException base — see
 * docs/standards/backend.md.
 */
public class DuplicateLeagueTeamNameException extends ConflictException {
    public DuplicateLeagueTeamNameException(String message) {
        super(message);
    }
}
