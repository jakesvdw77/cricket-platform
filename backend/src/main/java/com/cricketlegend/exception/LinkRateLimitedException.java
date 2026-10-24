package com.cricketlegend.exception;

/** Too many link requests by one account in a day (docs/specs/119). Maps to HTTP 429 with {@code retryAfterSeconds}. */
public class LinkRateLimitedException extends RuntimeException {

    private final long retryAfterSeconds;

    public LinkRateLimitedException(long retryAfterSeconds) {
        super("Too many requests. Please try again later.");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
