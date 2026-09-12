package com.cricketlegend.exception;

/**
 * A {@code playerId} passed to a squad-add is a real, correctly-scoped player of this club, but
 * currently deactivated ({@code PlayerProfile.active = false}) — a distinct failure from "player
 * not found", since the id is real, just currently ineligible. Maps to HTTP 400 via its {@link
 * ValidationException} base — see docs/specs/029-league-management.md's Team Squad API note.
 */
public class PlayerNotActiveClubMemberException extends ValidationException {
    public PlayerNotActiveClubMemberException(String message) {
        super(message);
    }
}
