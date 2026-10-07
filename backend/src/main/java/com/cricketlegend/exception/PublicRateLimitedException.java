package com.cricketlegend.exception;

/** Too many verify calls from one client address. Maps to HTTP 429 with {@code retryAfterSeconds}. */
public class PublicRateLimitedException extends RuntimeException {

    private final long retryAfterSeconds;

    public PublicRateLimitedException(long retryAfterSeconds) {
        super("Too many requests. Please try again later.");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
