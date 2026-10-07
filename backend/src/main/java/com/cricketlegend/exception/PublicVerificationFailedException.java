package com.cricketlegend.exception;

/**
 * The one generic failure of the public availability verify call (unknown name, wrong date of
 * birth, player outside the poll all look identical). Maps to HTTP 403 with a {@code triesLeft}
 * property. Not one of the three base types of docs/standards/backend.md's table: a new status
 * category for the public form (403/423/429/401), see docs/specs/077.
 */
public class PublicVerificationFailedException extends RuntimeException {

    public static final String MESSAGE = "We could not find a player with those details in this poll.";

    private final int triesLeft;

    public PublicVerificationFailedException(int triesLeft) {
        super(MESSAGE);
        this.triesLeft = triesLeft;
    }

    public int getTriesLeft() {
        return triesLeft;
    }
}
