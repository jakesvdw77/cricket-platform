package com.cricketlegend.service.support.schedule;

import java.time.LocalDate;
import java.time.LocalTime;

/** A fully parsed and resolved schedule row, as the identity rules see it (local date and time, minute precision). */
public record ScheduleFixture(
        int rowNumber, ResolvedSide home, ResolvedSide away, LocalDate date, LocalTime time, String venue) {}
