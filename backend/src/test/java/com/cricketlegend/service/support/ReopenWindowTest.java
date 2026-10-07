package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The 24 hour reopen rule of docs/specs/082-poll-card-improvements.md, with a fixed clock. */
class ReopenWindowTest {

    private static final Instant NOW = Instant.parse("2026-10-07T12:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    private static Instant latest(Instant... starts) {
        return ReopenWindow.latestStart(List.of(starts), List.of());
    }

    @Test
    void aMatchInsideTheGraceAllowsAReopen() {
        assertThat(ReopenWindow.allows(latest(NOW.minus(Duration.ofHours(23))), CLOCK)).isTrue();
    }

    @Test
    void exactlyAtTheTwentyFourHourEdgeIsStillAllowed() {
        assertThat(ReopenWindow.allows(latest(NOW.minus(Duration.ofHours(24))), CLOCK)).isTrue();
    }

    @Test
    void justPastTheEdgeIsRefused() {
        assertThat(ReopenWindow.allows(latest(NOW.minus(Duration.ofHours(24)).minusSeconds(1)), CLOCK)).isFalse();
    }

    @Test
    void aFutureMatchAllowsAReopen() {
        assertThat(ReopenWindow.allows(latest(NOW.plus(Duration.ofDays(3))), CLOCK)).isTrue();
    }

    @Test
    void aRoundWithSeveralMatchesUsesTheLatestOne() {
        Instant old = NOW.minus(Duration.ofDays(10));
        Instant recent = NOW.minus(Duration.ofHours(2));
        assertThat(latest(old, recent, old)).isEqualTo(recent);
        assertThat(ReopenWindow.allows(latest(old, recent), CLOCK)).isTrue();
        assertThat(ReopenWindow.allows(latest(old, NOW.minus(Duration.ofDays(2))), CLOCK)).isFalse();
    }

    @Test
    void aWindowWithoutAMatchFallsBackToTheEndOfItsDateInTheServerZone() {
        ZoneId zone = ZoneId.of("Africa/Johannesburg");
        LocalDate date = LocalDate.of(2026, 10, 6);
        Instant endOfDay = ReopenWindow.latestStart(List.of(), List.of(date), zone);
        assertThat(endOfDay).isEqualTo(Instant.parse("2026-10-06T22:00:00Z"));
        // 2026-10-06T22:00Z + 24h = 2026-10-07T22:00Z, still ahead of NOW.
        assertThat(ReopenWindow.allows(endOfDay, CLOCK)).isTrue();
        Instant older = ReopenWindow.latestStart(List.of(), List.of(LocalDate.of(2026, 10, 5)), zone);
        assertThat(ReopenWindow.allows(older, CLOCK)).isFalse();
    }

    @Test
    void theMatchlessFallbackOnlyCountsWhenItIsLaterThanTheMatches() {
        Instant match = Instant.parse("2026-10-01T10:00:00Z");
        ZoneId zone = ZoneOffset.UTC;
        assertThat(ReopenWindow.latestStart(List.of(match), List.of(LocalDate.of(2026, 9, 1)), zone))
                .isEqualTo(match);
        assertThat(ReopenWindow.latestStart(List.of(match), List.of(LocalDate.of(2026, 10, 5)), zone))
                .isEqualTo(Instant.parse("2026-10-06T00:00:00Z"));
    }

    @Test
    void nothingToAnchorOnNeverBlocksAReopen() {
        assertThat(ReopenWindow.latestStart(List.of(), List.of())).isNull();
        assertThat(ReopenWindow.allows(null, CLOCK)).isTrue();
    }
}
