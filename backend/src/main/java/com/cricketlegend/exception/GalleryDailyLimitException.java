package com.cricketlegend.exception;

/**
 * A person has added the daily maximum of gallery photos (docs/specs/157-photo-gallery.md rule 5). Maps to HTTP 429 with
 * {@code retryAfterSeconds}; its own type, like the link limit, because no base exception carries 429.
 */
public class GalleryDailyLimitException extends RuntimeException {

    private final long retryAfterSeconds;

    public GalleryDailyLimitException(long retryAfterSeconds) {
        super("You have added the most photos allowed in a day. Please try again later.");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
