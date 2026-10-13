package com.cricketlegend.dto;

/** Response of {@code GET /api/v1/platform/playing-areas/summary} (docs/specs/099-fields-directory.md). Merged-away rows are not counted. */
public record PlatformPlayingAreaSummaryDto(long unverified, long verified, long rejected) {
}
