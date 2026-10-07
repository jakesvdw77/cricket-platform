package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.PublicAvailabilityAttempt;
import com.cricketlegend.repository.PublicAvailabilityAttemptRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** The counter arithmetic lives in one SQL upsert (integration-tested); this checks what is asked of it. */
@ExtendWith(MockitoExtension.class)
class PublicAttemptTrackerTest {

    private static final Instant NOW = Instant.parse("2026-10-07T10:00:00Z");

    @Mock
    private PublicAvailabilityAttemptRepository repository;

    private PublicAttemptTracker tracker() {
        return new PublicAttemptTracker(repository, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static PublicAvailabilityAttemptRepository.Counter counter(int count, Instant windowStart) {
        return new PublicAvailabilityAttemptRepository.Counter() {
            @Override
            public int getFailedCount() {
                return count;
            }

            @Override
            public long getWindowStartedAtEpoch() {
                return windowStart.getEpochSecond();
            }
        };
    }

    @Test
    void incrementAsksForAFifteenMinuteWindowAndLockAndReturnsTheNewState() {
        when(repository.readCounter("name:k")).thenReturn(counter(3, NOW.minusSeconds(60)));

        AttemptState state = tracker().increment("name:k", 5);

        verify(repository).increment(
                "name:k",
                NOW.getEpochSecond(),
                NOW.minus(Duration.ofMinutes(15)).getEpochSecond(),
                5,
                NOW.plus(Duration.ofMinutes(15)).getEpochSecond());
        assertThat(state.count()).isEqualTo(3);
        assertThat(state.windowStartedAt()).isEqualTo(NOW.minusSeconds(60));
    }

    @Test
    void lockedUntilIsPresentOnlyWhileInTheFuture() {
        when(repository.findById("future")).thenReturn(Optional.of(PublicAvailabilityAttempt.builder()
                .scopeKey("future").failedCount(5).windowStartedAt(NOW).lockedUntil(NOW.plusSeconds(30)).build()));
        when(repository.findById("past")).thenReturn(Optional.of(PublicAvailabilityAttempt.builder()
                .scopeKey("past").failedCount(5).windowStartedAt(NOW).lockedUntil(NOW.minusSeconds(1)).build()));
        when(repository.findById("none")).thenReturn(Optional.of(PublicAvailabilityAttempt.builder()
                .scopeKey("none").failedCount(2).windowStartedAt(NOW).build()));
        when(repository.findById("missing")).thenReturn(Optional.empty());

        assertThat(tracker().lockedUntil("future")).contains(NOW.plusSeconds(30));
        assertThat(tracker().lockedUntil("past")).isEmpty();
        assertThat(tracker().lockedUntil("none")).isEmpty();
        assertThat(tracker().lockedUntil("missing")).isEmpty();
    }

    @Test
    void clearDeletesTheKey() {
        tracker().clear("name:k");

        verify(repository).deleteByKey("name:k");
    }

    @Test
    void secondsUntilIsAtLeastOneAndRoundsUp() {
        assertThat(tracker().secondsUntil(NOW.plusSeconds(90))).isEqualTo(91);
        assertThat(tracker().secondsUntil(NOW.minusSeconds(5))).isEqualTo(1);
    }
}
