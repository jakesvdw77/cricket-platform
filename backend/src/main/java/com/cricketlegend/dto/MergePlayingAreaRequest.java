package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/** Body of {@code POST /api/v1/platform/playing-areas/{id}/merge}: the surviving field (docs/specs/099-fields-directory.md). */
public record MergePlayingAreaRequest(@NotNull UUID targetPlayingAreaId) {
}
