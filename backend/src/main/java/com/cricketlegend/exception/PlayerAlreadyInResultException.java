package com.cricketlegend.exception;

/**
 * docs/specs/101-match-results-our-side-scorecard.md: linking a scorecard guest to a registered player who is already
 * on that side's list in the same result. Maps to 409.
 */
public class PlayerAlreadyInResultException extends ConflictException {

    public PlayerAlreadyInResultException(String message) {
        super(message);
    }
}
