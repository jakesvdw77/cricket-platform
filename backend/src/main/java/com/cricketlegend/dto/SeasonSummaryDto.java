package com.cricketlegend.dto;

import java.util.UUID;

/**
 * One season's figures in {@code GET /seasons/summary} (docs/specs/094-club-structure-and-seasons.md): the distinct
 * leagues with an affiliation, the distinct own teams entered and the active matches, all zero when nothing is attached.
 */
public record SeasonSummaryDto(UUID seasonId, long leagueCount, long teamsEntered, long matchCount) {
}
