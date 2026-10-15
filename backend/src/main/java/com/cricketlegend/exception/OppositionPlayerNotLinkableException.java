package com.cricketlegend.exception;

/**
 * docs/specs/101-match-results-our-side-scorecard.md: an attempt to link an opposition scorecard row to a registered
 * player. An opposition player is a typed name only and is never linked. Maps to 400.
 */
public class OppositionPlayerNotLinkableException extends ValidationException {

    public OppositionPlayerNotLinkableException(String message) {
        super(message);
    }
}
