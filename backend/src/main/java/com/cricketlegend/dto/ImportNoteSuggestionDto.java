package com.cricketlegend.dto;

import java.util.UUID;

/** docs/specs/104-match-results-import-adaptors.md: a ranked fuzzy suggestion for a name that could not be placed. Never linked automatically. */
public record ImportNoteSuggestionDto(UUID playerProfileId, String displayName, double score) {
}
