package com.cricketlegend.dto;

import com.cricketlegend.domain.Gender;
import java.time.Instant;
import java.util.UUID;

/**
 * Read shape of a club structure node — flat, carrying its own {@code parentSectionId} (the
 * client builds the tree from the flat list, not a recursively-nested payload — see
 * docs/specs/025-club-structure.md's API Contract Architecture note). {@code minAge}/{@code
 * maxAge}/{@code gender} are all independently optional, unenforced eligibility metadata. See
 * docs/specs/025-club-structure.md.
 */
public record SectionDto(
        UUID id,
        UUID clubId,
        UUID parentSectionId,
        String name,
        Integer minAge,
        Integer maxAge,
        Gender gender,
        boolean active,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy) {
}
