package com.cricketlegend.exception;

/**
 * A player referenced anywhere on a {@code MatchSide} (ordered XI, captain, keeper, or twelfth
 * man) isn't a member of that side's {@code team_id}'s squad for the {@code Match}'s own {@code
 * season_id} — including a player who's in that team's squad for a *different* season. Maps to
 * HTTP 400 via its {@link ValidationException} base — see docs/specs/029-league-management.md's
 * MatchSide/MatchSidePlayer business rules.
 */
public class PlayerNotInSquadException extends ValidationException {
    public PlayerNotInSquadException(String message) {
        super(message);
    }
}
