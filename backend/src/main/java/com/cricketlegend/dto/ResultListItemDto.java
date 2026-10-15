package com.cricketlegend.dto;

/**
 * docs/specs/100-match-results-core.md: one row of the Results list: the match (names, logos, date, field, as the
 * Matches list shows it) with its result, draft or published. {@code playerOfTheMatch} (docs/specs/101) is the
 * official player of the match's name, or null when none was recorded.
 */
public record ResultListItemDto(MatchDto match, MatchResultDto result, String playerOfTheMatch) {
}
