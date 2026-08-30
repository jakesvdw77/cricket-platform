package com.cricketlegend.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Read shape of a {@link com.cricketlegend.domain.Team} — flat, carrying its own {@code
 * sectionId} so a caller (e.g. the club-wide directory) can drive the nested
 * create/update/deactivate/reactivate endpoints without a separate lookup. No denormalized
 * section name — the frontend composes that client-side from the existing section list, same
 * pattern {@code ClubStructure.tsx} already uses for sections+contacts. See
 * docs/specs/026-teams.md.
 */
public record TeamDto(
        UUID id,
        UUID clubId,
        UUID sectionId,
        String name,
        String logoUrl,
        boolean active,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy) {
}
