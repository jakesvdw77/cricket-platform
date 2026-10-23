package com.cricketlegend.service.support;

import com.cricketlegend.domain.LinkAttempt;
import com.cricketlegend.domain.LinkAttemptKind;
import com.cricketlegend.exception.LinkLockedException;
import com.cricketlegend.exception.LinkRateLimitedException;
import com.cricketlegend.repository.LinkAttemptRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The per-account counters behind docs/specs/119's rate limits, the 077 pattern on the {@code link_attempt} table:
 * 10 link requests per account per day (a window from the first request) and, for the confirm step, 5 failed
 * confirmations per hour and then a one hour lock. Failures are recorded in their own transaction so the rollback of
 * the refused call does not erase the count.
 */
@Component
public class LinkAttemptLimiter {

    public static final int REQUESTS_PER_DAY = 10;
    public static final int CONFIRM_FAILURES_PER_HOUR = 5;
    private static final Duration REQUEST_WINDOW = Duration.ofDays(1);
    private static final Duration CONFIRM_WINDOW = Duration.ofHours(1);
    private static final Duration CONFIRM_LOCK = Duration.ofHours(1);

    private final LinkAttemptRepository repository;

    public LinkAttemptLimiter(LinkAttemptRepository repository) {
        this.repository = repository;
    }

    /** Refuses (423) while the account is locked for this kind. */
    @Transactional(readOnly = true)
    public void assertNotLocked(UUID accountPersonId, LinkAttemptKind kind) {
        Instant now = Instant.now();
        repository.findByAccountPersonIdAndKind(accountPersonId, kind)
                .filter(a -> a.getLockedUntil() != null && a.getLockedUntil().isAfter(now))
                .ifPresent(a -> {
                    throw new LinkLockedException(secondsUntil(a.getLockedUntil(), now));
                });
    }

    /** Counts one link request, or refuses (429) when the account has used its daily allowance. Joins the caller's transaction. */
    @Transactional
    public void countRequest(UUID accountPersonId) {
        Instant now = Instant.now();
        LinkAttempt attempt = repository.findByAccountPersonIdAndKind(accountPersonId, LinkAttemptKind.REQUEST)
                .orElseGet(() -> fresh(accountPersonId, LinkAttemptKind.REQUEST, now));
        if (!attempt.getWindowStartedAt().plus(REQUEST_WINDOW).isAfter(now)) {
            attempt.setCount(0);
            attempt.setWindowStartedAt(now);
        }
        if (attempt.getCount() >= REQUESTS_PER_DAY) {
            throw new LinkRateLimitedException(secondsUntil(attempt.getWindowStartedAt().plus(REQUEST_WINDOW), now));
        }
        attempt.setCount(attempt.getCount() + 1);
        repository.save(attempt);
    }

    /** Records one failed confirmation; the fifth inside an hour locks the account for an hour. Always its own transaction. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailedConfirm(UUID accountPersonId) {
        Instant now = Instant.now();
        LinkAttempt attempt = repository.findByAccountPersonIdAndKind(accountPersonId, LinkAttemptKind.CONFIRM)
                .orElseGet(() -> fresh(accountPersonId, LinkAttemptKind.CONFIRM, now));
        if (!attempt.getWindowStartedAt().plus(CONFIRM_WINDOW).isAfter(now)) {
            attempt.setCount(0);
            attempt.setWindowStartedAt(now);
            attempt.setLockedUntil(null);
        }
        attempt.setCount(attempt.getCount() + 1);
        if (attempt.getCount() >= CONFIRM_FAILURES_PER_HOUR) {
            attempt.setLockedUntil(now.plus(CONFIRM_LOCK));
        }
        repository.save(attempt);
    }

    private static LinkAttempt fresh(UUID accountPersonId, LinkAttemptKind kind, Instant now) {
        return LinkAttempt.builder()
                .accountPersonId(accountPersonId)
                .kind(kind)
                .count(0)
                .windowStartedAt(now)
                .build();
    }

    private static long secondsUntil(Instant end, Instant now) {
        return Math.max(1L, Duration.between(now, end).toSeconds());
    }
}
