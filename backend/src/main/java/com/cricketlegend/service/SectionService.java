package com.cricketlegend.service;

import com.cricketlegend.dto.ClubContactDto;
import com.cricketlegend.dto.CreateSectionRequest;
import com.cricketlegend.dto.SectionDto;
import com.cricketlegend.dto.UpdateSectionRequest;
import java.util.List;
import java.util.UUID;

/**
 * The club structure tree — {@link com.cricketlegend.domain.Section} nodes, self-referential via
 * {@code parentSectionId}, plus a many-to-many link to docs/specs/021-club-contacts.md's existing
 * {@link com.cricketlegend.domain.ClubContact}. Reachable by a club's own {@code CLUB_ADMIN} or a
 * {@code platform_admin} via {@code /api/v1/manage/clubs/{clubId}/sections}, no dedicated {@code
 * /platform} mirror. "Disable, never delete" — see {@link #deactivate(UUID, UUID)}/{@link
 * #reactivate(UUID, UUID)}. See docs/specs/025-club-structure.md.
 */
public interface SectionService {

    /**
     * All sections for {@code clubId}, flat, active and inactive — not paginated, a deliberately
     * small bounded collection (mirrors {@code ClubContactService.list}).
     */
    List<SectionDto> list(UUID clubId);

    /**
     * Creates a node for {@code clubId}. Validates {@code minAge <= maxAge} when both are set
     * ({@link com.cricketlegend.exception.ValidationException}, 400). When {@code
     * request.parentSectionId()} is non-null, verifies it exists and belongs to the same {@code
     * clubId} ({@link com.cricketlegend.exception.NotFoundException} otherwise — a parent from a
     * different club can't be referenced).
     */
    SectionDto create(UUID clubId, CreateSectionRequest request);

    /**
     * Full-resource update of an existing node belonging to {@code clubId}. Same {@code minAge <=
     * maxAge} validation as {@link #create}. Does not allow changing the parent — re-parenting is
     * out of scope (see docs/specs/025-club-structure.md's Non-goals).
     */
    SectionDto update(UUID clubId, UUID sectionId, UpdateSectionRequest request);

    /**
     * {@code active: true -> false}. Throws {@link
     * com.cricketlegend.exception.InvalidStatusTransitionException} if already inactive, or if
     * any direct child section is still active.
     */
    SectionDto deactivate(UUID clubId, UUID sectionId);

    /**
     * {@code active: false -> true}. Throws {@link
     * com.cricketlegend.exception.InvalidStatusTransitionException} if already active.
     */
    SectionDto reactivate(UUID clubId, UUID sectionId);

    /** Every {@link ClubContactDto} currently linked to {@code sectionId}. */
    List<ClubContactDto> listContacts(UUID clubId, UUID sectionId);

    /**
     * Links an existing {@link com.cricketlegend.domain.ClubContact} (must belong to {@code
     * clubId}, 404 otherwise) to {@code sectionId}. Throws {@link
     * com.cricketlegend.exception.ConflictException} if already linked.
     */
    void link(UUID clubId, UUID sectionId, UUID contactId);

    /**
     * Removes the link between {@code sectionId} and {@code contactId}. Throws {@link
     * com.cricketlegend.exception.NotFoundException} if no such link exists. Never touches the
     * underlying {@link com.cricketlegend.domain.ClubContact} or {@link
     * com.cricketlegend.domain.Section} rows.
     */
    void unlink(UUID clubId, UUID sectionId, UUID contactId);
}
