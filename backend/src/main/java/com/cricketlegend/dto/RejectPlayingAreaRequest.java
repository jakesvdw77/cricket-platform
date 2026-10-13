package com.cricketlegend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of {@code POST /api/v1/platform/playing-areas/{id}/reject}: the reason is required (docs/specs/099-fields-directory.md). */
public record RejectPlayingAreaRequest(@NotBlank @Size(max = 500) String reason) {
}
