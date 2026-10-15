package com.cricketlegend.dto;

import com.cricketlegend.domain.ResultStatus;
import java.time.Instant;
import java.util.UUID;

/**
 * docs/specs/104-match-results-import-adaptors.md: what an import needs to know about a result that already exists for a
 * match: its status and origin, whether it holds a scorecard and when it last changed. Read through {@code ResultService}
 * so nothing outside the result services touches a result entity.
 */
public record ExistingResultDto(UUID matchId, ResultStatus status, String source, boolean hasScorecard, Instant updatedAt) {
}
