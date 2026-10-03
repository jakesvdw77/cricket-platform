package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.DayPart;
import com.cricketlegend.service.impl.SectionAvailabilityMatchResolverImpl;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

/** The one day-part rule (docs/specs/068-player-availability-grid.md exposes it): before noon local is MORNING. */
class SectionAvailabilityMatchResolverDayPartTest {

    private final SectionAvailabilityMatchResolverImpl resolver = new SectionAvailabilityMatchResolverImpl();

    private static java.time.Instant at(LocalTime time) {
        return LocalDate.of(2026, 10, 10).atTime(time).atZone(ZoneId.systemDefault()).toInstant();
    }

    @Test
    void elevenFiftyNineIsMorningAndNoonIsAfternoon() {
        assertThat(resolver.dayPartOf(at(LocalTime.of(11, 59)))).isEqualTo(DayPart.MORNING);
        assertThat(resolver.dayPartOf(at(LocalTime.of(12, 0)))).isEqualTo(DayPart.AFTERNOON);
        assertThat(resolver.dayPartOf(at(LocalTime.of(0, 0)))).isEqualTo(DayPart.MORNING);
    }
}
