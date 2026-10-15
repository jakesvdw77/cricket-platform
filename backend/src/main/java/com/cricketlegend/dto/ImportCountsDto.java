package com.cricketlegend.dto;

/** docs/specs/104-match-results-import-adaptors.md: how many of our players' names were placed at each level. */
public record ImportCountsDto(int exact, int normalised, int aiSuggested, int unresolved) {
}
