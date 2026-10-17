package com.cricketlegend.dto;

import java.time.LocalDate;

/** The start and end date of a league in a season (docs/specs/111-league-season-dates.md). */
public record LeagueSeasonDatesDto(LocalDate startDate, LocalDate endDate) {
}
