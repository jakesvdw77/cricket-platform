package com.cricketlegend.dto;

import java.util.List;

/** Response shape of {@code GET /seasons/summary} (docs/specs/094-club-structure-and-seasons.md): one row per season of the club. */
public record SeasonsSummaryDto(List<SeasonSummaryDto> seasons) {
}
