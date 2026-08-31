package com.cricketlegend.service;

import com.cricketlegend.dto.SectionDto;
import java.util.List;
import java.util.UUID;

/**
 * A many-to-many, bare link between a {@link com.cricketlegend.domain.PlayerProfile} and
 * docs/specs/025-club-structure.md's existing {@link com.cricketlegend.domain.Section} — no extra
 * column beyond the join itself, an eligibility/interest tag, not a squad assignment. A separate
 * service from {@link PlayerService}, matching {@code TeamSponsorService}'s precedent of being a
 * separate service class from {@code TeamService} whose endpoints still live on the same
 * controller. Reachable only via {@code PlayerController} on {@code
 * /api/v1/manage/clubs/{clubId}/players/{playerId}/sections}, no dedicated {@code /platform}
 * mirror. See docs/specs/028-players.md.
 */
public interface PlayerSectionService {

    /**
     * Every {@link SectionDto} currently tagged to {@code playerId}. 404s if {@code playerId}
     * doesn't belong to {@code clubId}.
     */
    List<SectionDto> list(UUID clubId, UUID playerId);

    /**
     * Tags an existing {@link com.cricketlegend.domain.Section} (must belong to {@code clubId},
     * 404 otherwise) to {@code playerId}. 404s if {@code playerId} doesn't belong to {@code
     * clubId} — checked before the section lookup ever runs. Throws {@link
     * com.cricketlegend.exception.ConflictException} if already tagged.
     */
    void link(UUID clubId, UUID playerId, UUID sectionId);

    /**
     * Removes the tag between {@code playerId} and {@code sectionId}. Throws {@link
     * com.cricketlegend.exception.NotFoundException} if no such tag exists. Never touches the
     * underlying {@code PlayerProfile} or {@code Section} rows.
     */
    void unlink(UUID clubId, UUID playerId, UUID sectionId);
}
