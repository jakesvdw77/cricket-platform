package com.cricketlegend.exception;

/**
 * New league season dates would leave an active match of the league outside them (docs/specs/111-league-season-dates.md).
 * Maps to HTTP 409 via its {@link ConflictException} base.
 */
public class LeagueDatesExcludeMatchesException extends ConflictException {
    public LeagueDatesExcludeMatchesException(String message) {
        super(message);
    }
}
