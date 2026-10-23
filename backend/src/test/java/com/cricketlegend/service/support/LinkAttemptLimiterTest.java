package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.LinkAttempt;
import com.cricketlegend.domain.LinkAttemptKind;
import com.cricketlegend.exception.LinkLockedException;
import com.cricketlegend.exception.LinkRateLimitedException;
import com.cricketlegend.repository.LinkAttemptRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * docs/specs/119 rate limits: 10 link requests per account per day (429), 5 invitations per day, and 5 failed
 * confirmations in an hour lock the account for an hour (423). The limiter reads Instant.now(), so every fixture is built
 * relative to now with a margin of minutes, never seconds.
 */
@ExtendWith(MockitoExtension.class)
class LinkAttemptLimiterTest {

    private static final UUID ACCOUNT = UUID.randomUUID();

    @Mock
    private LinkAttemptRepository repository;

    private LinkAttemptLimiter limiter;
    private LinkAttempt stored;

    @BeforeEach
    void setUp() {
        limiter = new LinkAttemptLimiter(repository);
        stored = null;
        org.mockito.Mockito.lenient().when(repository.findByAccountPersonIdAndKind(any(), any())).thenAnswer(i -> Optional.ofNullable(stored));
        // the counting methods create the row with an insert that ignores a concurrent insert, then lock and read it
        org.mockito.Mockito.lenient().when(repository.insertIfAbsent(any(), any(), any())).thenAnswer(i -> {
            if (stored == null) {
                stored = LinkAttempt.builder().accountPersonId(i.getArgument(0))
                        .kind(LinkAttemptKind.valueOf(i.getArgument(1))).count(0).windowStartedAt(i.getArgument(2)).build();
                return 1;
            }
            return 0;
        });
        org.mockito.Mockito.lenient().when(repository.findForUpdate(any(), any())).thenAnswer(i -> Optional.ofNullable(stored));
        org.mockito.Mockito.lenient().when(repository.save(any(LinkAttempt.class))).thenAnswer(i -> {
            stored = i.getArgument(0);
            return stored;
        });
    }

    private void existing(LinkAttemptKind kind, int count, Instant windowStart, Instant lockedUntil) {
        stored = LinkAttempt.builder()
                .accountPersonId(ACCOUNT)
                .kind(kind)
                .count(count)
                .windowStartedAt(windowStart)
                .lockedUntil(lockedUntil)
                .build();
    }

    @Test
    void theTenthRequestInADayIsAllowedAndTheEleventhIsRefusedWithRetryAfter() {
        existing(LinkAttemptKind.REQUEST, 9, Instant.now().minus(Duration.ofHours(1)), null);
        assertThatCode(() -> limiter.countRequest(ACCOUNT)).doesNotThrowAnyException();
        assertThat(stored.getCount()).isEqualTo(10);

        assertThatThrownBy(() -> limiter.countRequest(ACCOUNT))
                .isInstanceOfSatisfying(LinkRateLimitedException.class,
                        e -> assertThat(e.getRetryAfterSeconds()).isBetween(1L, 86_400L));
        assertThat(stored.getCount()).isEqualTo(10);
    }

    @Test
    void theDailyWindowResetsOnceADayHasPassedSinceTheFirstRequest() {
        existing(LinkAttemptKind.REQUEST, 10, Instant.now().minus(Duration.ofHours(25)), null);
        limiter.countRequest(ACCOUNT);
        assertThat(stored.getCount()).isEqualTo(1);
        assertThat(stored.getWindowStartedAt()).isAfter(Instant.now().minus(Duration.ofMinutes(5)));
    }

    @Test
    void aFirstRequestCreatesTheCounter() {
        limiter.countRequest(ACCOUNT);
        assertThat(stored.getKind()).isEqualTo(LinkAttemptKind.REQUEST);
        assertThat(stored.getCount()).isEqualTo(1);
    }

    @Test
    void invitationsAreLimitedToFiveADay() {
        existing(LinkAttemptKind.INVITE, 4, Instant.now().minus(Duration.ofHours(1)), null);
        limiter.countInvite(ACCOUNT);
        assertThatThrownBy(() -> limiter.countInvite(ACCOUNT)).isInstanceOf(LinkRateLimitedException.class);
    }

    @Test
    void theFifthFailedConfirmInAnHourLocksTheAccountAndALockedAccountGets423() {
        existing(LinkAttemptKind.CONFIRM, 4, Instant.now().minus(Duration.ofMinutes(10)), null);
        limiter.recordFailedConfirm(ACCOUNT);
        assertThat(stored.getCount()).isEqualTo(5);
        assertThat(stored.getLockedUntil()).isAfter(Instant.now().plus(Duration.ofMinutes(50)));

        assertThatThrownBy(() -> limiter.assertNotLocked(ACCOUNT, LinkAttemptKind.CONFIRM))
                .isInstanceOfSatisfying(LinkLockedException.class,
                        e -> assertThat(e.getRetryAfterSeconds()).isBetween(1L, 3_600L));
    }

    @Test
    void fewerThanFiveFailuresDoNotLock() {
        existing(LinkAttemptKind.CONFIRM, 3, Instant.now().minus(Duration.ofMinutes(10)), null);
        limiter.recordFailedConfirm(ACCOUNT);
        assertThat(stored.getLockedUntil()).isNull();
        assertThatCode(() -> limiter.assertNotLocked(ACCOUNT, LinkAttemptKind.CONFIRM)).doesNotThrowAnyException();
    }

    @Test
    void anExpiredLockAndWindowStartAgainFromOne() {
        existing(LinkAttemptKind.CONFIRM, 5, Instant.now().minus(Duration.ofHours(3)), Instant.now().minus(Duration.ofHours(2)));
        assertThatCode(() -> limiter.assertNotLocked(ACCOUNT, LinkAttemptKind.CONFIRM)).doesNotThrowAnyException();
        limiter.recordFailedConfirm(ACCOUNT);
        assertThat(stored.getCount()).isEqualTo(1);
        assertThat(stored.getLockedUntil()).isNull();
    }
}
