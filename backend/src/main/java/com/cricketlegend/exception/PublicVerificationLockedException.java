package com.cricketlegend.exception;

/** Too many failed verifies for one (poll, name) key. Maps to HTTP 423 with {@code retryAfterSeconds}. */
public class PublicVerificationLockedException extends RuntimeException {

    private final long retryAfterSeconds;

    public PublicVerificationLockedException(long retryAfterSeconds) {
        super("Too many attempts. Please try again later.");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
