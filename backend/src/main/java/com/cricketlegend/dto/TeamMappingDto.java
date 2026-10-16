package com.cricketlegend.dto;

import com.cricketlegend.domain.ResultSide;

/**
 * docs/specs/104-match-results-import-adaptors.md: which side of the chosen match a team of the file is. In a preview the
 * server proposes it ({@code side} may be null when the team cannot be placed, {@code exactness} and {@code reason} say
 * how); in a resolve request only {@code fileKey} and {@code side} are read, and the server re-validates that the two
 * teams map to HOME and AWAY once each.
 */
public record TeamMappingDto(String fileKey, String fileName, ResultSide side, ImportExactness exactness, String reason) {
}
