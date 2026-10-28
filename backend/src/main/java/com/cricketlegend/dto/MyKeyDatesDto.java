package com.cricketlegend.dto;

import java.time.LocalDate;

/** docs/specs/123: the league season's key dates, each nullable. */
public record MyKeyDatesDto(
        LocalDate seasonStart,
        LocalDate seasonEnd,
        LocalDate firstMatchDate,
        LocalDate lastMatchDate,
        LocalDate nextMatchDate) {
}
