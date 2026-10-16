package com.cricketlegend.exception;

/**
 * A match's date is outside the dates of its league season (docs/specs/111-league-season-dates.md). Maps to HTTP 400 via
 * its {@link ValidationException} base, with the problem property {@code code} set to {@link #CODE} by {@code
 * GlobalExceptionHandler} so a client can tell this refusal from other validation errors.
 */
public class MatchOutsideLeagueDatesException extends ValidationException {

    public static final String CODE = "MATCH_OUTSIDE_LEAGUE_DATES";

    public MatchOutsideLeagueDatesException(String message) {
        super(message);
    }
}
