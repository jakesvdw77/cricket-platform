package com.cricketlegend.dto;

import com.cricketlegend.domain.Gender;
import jakarta.validation.constraints.NotBlank;

/**
 * PUT /api/v1/manage/clubs/{clubId}/sections/{sectionId} payload. Deliberately has no {@code
 * parentSectionId} field — re-parenting is out of scope (see docs/specs/025-club-structure.md's
 * Non-goals). Same {@code minAge <= maxAge} validation as {@link CreateSectionRequest}. See
 * docs/specs/025-club-structure.md.
 */
public record UpdateSectionRequest(
        @NotBlank String name, Integer minAge, Integer maxAge, Gender gender) {
}
