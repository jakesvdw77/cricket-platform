package com.cricketlegend.exception;

/**
 * Adding another {@code match_side_player} row would exceed the applicable playing-XI cap —
 * {@code league.maxPlayingXiSize} when the match has a league, else 11. The twelfth man doesn't
 * count against this cap. Maps to HTTP 400 via its {@link ValidationException} base — see
 * docs/specs/029-league-management.md's MatchSide/MatchSidePlayer business rules.
 */
public class PlayingXiCapExceededException extends ValidationException {
    public PlayingXiCapExceededException(String message) {
        super(message);
    }
}
