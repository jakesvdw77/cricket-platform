package com.cricketlegend.dto;

import java.time.LocalDate;
import java.util.UUID;

/** docs/specs/123: the season a Player Hub league page is for. */
public record MyLeagueSeasonDto(UUID id, String name, LocalDate startDate, LocalDate endDate) {
}
