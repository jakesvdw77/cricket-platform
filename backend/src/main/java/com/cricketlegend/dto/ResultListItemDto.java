package com.cricketlegend.dto;

/**
 * docs/specs/100-match-results-core.md: one row of the Results list: the match (names, logos, date, field, as the
 * Matches list shows it) with its result, draft or published.
 */
public record ResultListItemDto(MatchDto match, MatchResultDto result) {
}
