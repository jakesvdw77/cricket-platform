package com.cricketlegend.exception;

/**
 * A player referenced anywhere on a {@code MatchSide} fails the {@code Match}'s {@code League}
 * age eligibility rule — either their {@code Player.dateOfBirth} isn't recorded at all, or their
 * age as of the cutoff date ({@code league.ageCutoffDate}, else {@code season.startDate}) falls
 * outside {@code league.minAge}/{@code league.maxAge}. Two distinct messages, one exception type.
 * Maps to HTTP 400 via its {@link ValidationException} base — see
 * docs/specs/029-league-management.md's MatchSide/MatchSidePlayer business rules.
 */
public class PlayerAgeIneligibleException extends ValidationException {
    public PlayerAgeIneligibleException(String message) {
        super(message);
    }
}
