package com.cricketlegend.exception;

/**
 * A group poll ({@code SectionAvailabilityRound}) cannot be deleted while any {@code
 * MatchSquadMember} is picked against one of its windows — the manager's picks are real work and
 * must be removed first. Maps to HTTP 409 via its {@link ConflictException} base. See
 * docs/specs/064-unified-availability-polls.md.
 */
public class RoundHasMatchSquadException extends ConflictException {
    public RoundHasMatchSquadException(String message) {
        super(message);
    }
}
