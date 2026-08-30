package com.cricketlegend.dto;

import com.cricketlegend.domain.Gender;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

/**
 * POST /api/v1/manage/clubs/{clubId}/sections payload. {@code parentSectionId} omitted/null
 * creates a root node; when present, the service verifies it belongs to the same {@code clubId}
 * (404 otherwise). {@code minAge}/{@code maxAge} are validated {@code minAge <= maxAge} when both
 * are set (400) — the one consistency rule these fields get. See
 * docs/specs/025-club-structure.md.
 */
public record CreateSectionRequest(
        @NotBlank String name,
        UUID parentSectionId,
        Integer minAge,
        Integer maxAge,
        Gender gender) {
}
