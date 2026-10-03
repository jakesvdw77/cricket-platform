package com.cricketlegend.exception;

/**
 * Adding another {@code match_side_player} row would exceed the most players a selection may hold
 * (docs/specs/076-team-selection.md: batting places plus the 12th man place, at most 12). Maps to HTTP 400 via its {@link ValidationException} base — see
 * docs/specs/029-league-management.md's MatchSide/MatchSidePlayer business rules.
 */
public class PlayingXiCapExceededException extends ValidationException {
    public PlayingXiCapExceededException(String message) {
        super(message);
    }
}
