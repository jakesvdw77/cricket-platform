package com.cricketlegend.dto;

import java.time.LocalDate;

/**
 * The date ages are judged on for a league in a season (docs/specs/110-league-age-cutoff-day-and-month.md). {@code
 * source} is {@code CUTOFF} or {@code LEAGUE_START}; {@code leagueStartSource} is {@code
 * LEAGUE_SEASON_DATES} (spec 111), {@code FIRST_MATCH} or {@code SEASON_START}.
 */
public record AgeReferenceDto(
        LocalDate referenceDate, String source, LocalDate leagueStart, String leagueStartSource) {
}
