package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class ServerClockTest {

    @Test
    void startOfTodayIsLocalMidnightInTheSystemZoneWithinTheLastDay() {
        Instant start = ServerClock.startOfToday();
        ZoneId zone = ZoneId.systemDefault();

        assertThat(start.atZone(zone).toLocalTime().toSecondOfDay()).isZero();
        assertThat(start.atZone(zone).toLocalDate()).isIn(LocalDate.now(zone), LocalDate.now(zone).minusDays(1));
        assertThat(start).isBeforeOrEqualTo(Instant.now());
        assertThat(start.plusSeconds(25 * 3600)).isAfter(Instant.now());
    }
}
