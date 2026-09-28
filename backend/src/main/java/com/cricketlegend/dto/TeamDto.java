package com.cricketlegend.dto;

import com.cricketlegend.domain.SquadMode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Read shape of a {@link com.cricketlegend.domain.Team} — flat, carrying its own {@code
 * sectionId} so a caller (e.g. the club-wide directory) can drive the nested
 * create/update/deactivate/reactivate endpoints without a separate lookup. No denormalized
 * section name — the frontend composes that client-side from the existing section list, same
 * pattern {@code ClubStructure.tsx} already uses for sections+contacts. See
 * docs/specs/026-teams.md.
 *
 * <p>{@code abbreviation}/{@code groundName}/{@code socialLinks} (docs/specs/
 * 057-team-extended-profile.md) give {@code Team} the same club-facing profile shape {@code
 * LeagueDto} already has — every one nullable/optional, reusing {@link SocialLinkDto} unchanged.
 *
 * <p>{@code squadMode} (docs/specs/063-section-availability-and-flexible-squads.md) is the single
 * switch between {@code 029}'s season-long roster and this spec's per-fixture squad pool.
 */
public record TeamDto(
        UUID id,
        UUID clubId,
        UUID sectionId,
        String name,
        String logoUrl,
        String abbreviation,
        String groundName,
        List<SocialLinkDto> socialLinks,
        boolean active,
        SquadMode squadMode,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy) {
}
