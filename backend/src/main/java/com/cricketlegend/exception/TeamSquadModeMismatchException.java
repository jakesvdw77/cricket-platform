package com.cricketlegend.exception;

/**
 * A requested action doesn't match the target {@code Team}'s configured {@code squadMode} — a
 * {@code 032}-style per-match poll attempted against a {@code FLEXIBLE} team, or a {@code
 * MatchSquadMember} pick attempted against a {@code STATIC} team. One recurring failure mode
 * shared by both call sites, not two different rules. Maps to HTTP 400 via its {@link
 * ValidationException} base — see docs/specs/063-section-availability-and-flexible-squads.md.
 */
public class TeamSquadModeMismatchException extends ValidationException {
    public TeamSquadModeMismatchException(String message) {
        super(message);
    }
}
