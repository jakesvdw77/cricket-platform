package com.cricketlegend.service.support;

import com.cricketlegend.exception.PublicRateLimitedException;
import org.springframework.stereotype.Component;

/**
 * The 077 per-address limit applied to the public club by-slug lookup (docs/specs/149). Deliberately not
 * transactional: the counter commits on its own, like the verify throttling.
 */
@Component
public class PublicClubLookupLimiter {

    public static final int MAX_LOOKUPS_PER_ADDRESS = 60;

    private final PublicAttemptTracker attemptTracker;

    public PublicClubLookupLimiter(PublicAttemptTracker attemptTracker) {
        this.attemptTracker = attemptTracker;
    }

    /** Counts one lookup from this address; over the limit throws {@link PublicRateLimitedException}. */
    public void checkAllowed(String clientAddress) {
        AttemptState address =
                attemptTracker.increment("club-slug:" + clientAddress, MAX_LOOKUPS_PER_ADDRESS + 1);
        if (address.count() > MAX_LOOKUPS_PER_ADDRESS) {
            throw new PublicRateLimitedException(
                    attemptTracker.secondsUntil(address.windowStartedAt().plus(PublicAttemptTracker.WINDOW)));
        }
    }
}
