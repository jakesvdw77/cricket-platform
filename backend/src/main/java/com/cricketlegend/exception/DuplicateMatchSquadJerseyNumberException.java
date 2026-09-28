package com.cricketlegend.exception;

/**
 * Another player already holds the requested jersey number on this match+team's squad. Mirrors
 * {@link DuplicateSquadJerseyNumberException} exactly, for {@code MatchSquadMember} instead of
 * {@code TeamSquadMember}. Maps to HTTP 409 via its {@link ConflictException} base — see
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public class DuplicateMatchSquadJerseyNumberException extends ConflictException {
    public DuplicateMatchSquadJerseyNumberException(String message) {
        super(message);
    }
}
