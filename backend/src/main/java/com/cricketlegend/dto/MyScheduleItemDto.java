package com.cricketlegend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/**
 * docs/specs/123: one fixture of the whole league schedule, date and time on the server clock. {@code matchId} is opaque
 * (a list key only). The {@code playingArea*} values (docs/specs/133) are the chosen field and its stored coordinates
 * and access point, all null for a match with no (eligible) field, so a row can show weather and Get Directions.
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
        boolean mine,
        UUID playingAreaId,
        String playingAreaName,
        BigDecimal playingAreaLatitude,
        BigDecimal playingAreaLongitude,
        BigDecimal playingAreaAccessLatitude,
        BigDecimal playingAreaAccessLongitude,
        String playingAreaAccessNote) {
}
