package com.cricketlegend.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

/** docs/specs/135: the one live rule. */
class MatchPhaseTest {

    private static final Instant START = Instant.parse("2026-11-07T08:00:00Z");

    @Test
    void justBeforeTheStartIsUpcoming() {
        assertThat(MatchPhase.of(true, false, START, START.minusSeconds(1))).isEqualTo(MatchPhase.UPCOMING);
    }

    @Test
    void atTheStartIsLive() {
        assertThat(MatchPhase.of(true, false, START, START)).isEqualTo(MatchPhase.LIVE);
    }

    @Test
    void oneMinuteBeforeTheWindowEndsIsStillLive() {
        Instant now = START.plusSeconds(MatchPhase.LIVE_WINDOW_HOURS * 3600L - 60);
        assertThat(MatchPhase.of(true, false, START, now)).isEqualTo(MatchPhase.LIVE);
    }

    @Test
    void atTheEndOfTheWindowIsRecent() {
        Instant now = START.plusSeconds(MatchPhase.LIVE_WINDOW_HOURS * 3600L);
        assertThat(MatchPhase.of(true, false, START, now)).isEqualTo(MatchPhase.RECENT);
    }

    @Test
    void theWindowIsEightHours() {
        assertThat(MatchPhase.LIVE_WINDOW_HOURS).isEqualTo(8);
    }

    @Test
    void aPublishedResultEndsLiveEarly() {
        assertThat(MatchPhase.of(true, true, START, START.plusSeconds(3600))).isEqualTo(MatchPhase.RECENT);
    }

    @Test
    void anInactiveMatchIsNeverLive() {
        assertThat(MatchPhase.of(false, false, START, START.plusSeconds(60))).isEqualTo(MatchPhase.RECENT);
        assertThat(MatchPhase.of(false, false, START, START.minusSeconds(60))).isEqualTo(MatchPhase.UPCOMING);
    }

    @Test
    void aMatchWithNoTimeStartsAtNine() {
        LocalDate day = LocalDate.of(2026, 11, 7);
        Instant nine = day.atTime(9, 0).atZone(ZoneId.systemDefault()).toInstant();
        assertThat(MatchPhase.startOf(day, null)).isEqualTo(nine);
        assertThat(MatchPhase.startOf(day, LocalTime.of(14, 30))).isEqualTo(day.atTime(14, 30).atZone(ZoneId.systemDefault()).toInstant());
        assertThat(MatchPhase.of(true, false, MatchPhase.startOf(day, null), nine.minusSeconds(60))).isEqualTo(MatchPhase.UPCOMING);
        assertThat(MatchPhase.of(true, false, MatchPhase.startOf(day, null), nine)).isEqualTo(MatchPhase.LIVE);
    }
}
