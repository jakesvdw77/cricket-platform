package com.cricketlegend.service.support;

import com.cricketlegend.domain.PublicAvailabilityAttempt;
import com.cricketlegend.repository.PublicAvailabilityAttemptRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Counters behind the public verify throttling (docs/specs/077): one atomic upsert per increment,
 * each in its own committed transaction so a failed verification (which throws) still keeps its
 * count. Decisions (lock, 429) are made by the caller from the returned state.
 */
@Component
public class PublicAttemptTracker {

    public static final Duration WINDOW = Duration.ofMinutes(15);
    public static final Duration LOCK = Duration.ofMinutes(15);

    private final PublicAvailabilityAttemptRepository repository;
    private final Clock clock;

    public PublicAttemptTracker(PublicAvailabilityAttemptRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    /**
     * Adds one to {@code key} and returns the new state. A window older than {@link #WINDOW}
     * restarts at one. When the count reaches {@code lockAt} the key is locked for {@link #LOCK}.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AttemptState increment(String key, int lockAt) {
        Instant now = clock.instant();
        repository.increment(
                key,
                now.getEpochSecond(),
                now.minus(WINDOW).getEpochSecond(),
                lockAt,
                now.plus(LOCK).getEpochSecond());
        PublicAvailabilityAttemptRepository.Counter counter = repository.readCounter(key);
        return new AttemptState(counter.getFailedCount(), Instant.ofEpochSecond(counter.getWindowStartedAtEpoch()));
    }

    /** When the key stays locked until, if it is locked right now. */
    @Transactional(readOnly = true)
    public Optional<Instant> lockedUntil(String key) {
        Instant now = clock.instant();
        return repository.findById(key)
                .map(PublicAvailabilityAttempt::getLockedUntil)
                .filter(until -> until != null && until.isAfter(now));
    }

    /** Forgets the key (a successful verification). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void clear(String key) {
        repository.deleteByKey(key);
    }

    /** Whole seconds from now until {@code instant}, at least 1. */
    public long secondsUntil(Instant instant) {
        long seconds = Duration.between(clock.instant(), instant).toSeconds();
        return Math.max(1, seconds + 1);
    }
}
