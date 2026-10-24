package com.cricketlegend.exception;

/** Too many failed link confirmations by one account (docs/specs/119). Maps to HTTP 423 with {@code retryAfterSeconds}. */
public class LinkLockedException extends RuntimeException {

    private final long retryAfterSeconds;

    public LinkLockedException(long retryAfterSeconds) {
        super("Too many attempts. Please try again later.");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
