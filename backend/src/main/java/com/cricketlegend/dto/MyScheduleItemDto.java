package com.cricketlegend.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/**
 * docs/specs/123: one fixture of the whole league schedule, date and time on the server clock. {@code matchId} is opaque
 * (a list key only).
 */
public record MyScheduleItemDto(
        UUID matchId,
        LocalDate date,
        LocalTime time,
        String homeName,
        String homeLogoUrl,
        String awayName,
        String awayLogoUrl,
        String venue,
        boolean mine) {
}
