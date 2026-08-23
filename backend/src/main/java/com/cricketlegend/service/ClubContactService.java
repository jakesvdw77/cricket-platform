package com.cricketlegend.service;

import com.cricketlegend.dto.ClubContactDto;
import com.cricketlegend.dto.CreateClubContactRequest;
import com.cricketlegend.dto.UpdateClubContactRequest;
import java.util.List;
import java.util.UUID;

/**
 * Named contact people for a club (name, role, email, phone, optional photo, one flaggable
 * primary) — reachable by a club's own {@code CLUB_ADMIN} or a {@code platform_admin} via {@code
 * /api/v1/manage/clubs/{clubId}/contacts}, no dedicated {@code /platform} mirror. "Disable, never
 * delete" — see {@link #deactivate(UUID, UUID)}/{@link #reactivate(UUID, UUID)}. See
 * docs/specs/021-club-contacts.md.
 */
public interface ClubContactService {

    /**
     * All contacts for {@code clubId}, active and inactive — not paginated, a deliberately small
     * bounded collection (see docs/plans/021-club-contacts.md's Context).
     */
    List<ClubContactDto> list(UUID clubId);

    /**
     * Creates a contact for {@code clubId}. When {@code request.isPrimary()} is {@code true},
     * silently unsets {@code isPrimary} on any other active contact for the same club in the same
     * transaction — auto-unset, not a {@link com.cricketlegend.exception.ConflictException}.
     */
    ClubContactDto create(UUID clubId, CreateClubContactRequest request);

    /**
     * Full-resource update of an existing contact belonging to {@code clubId}. Throws {@link
     * com.cricketlegend.exception.NotFoundException} if {@code contactId} doesn't exist or belongs
     * to a different club. Same primary auto-unset behavior as {@link #create}.
     */
    ClubContactDto update(UUID clubId, UUID contactId, UpdateClubContactRequest request);

    /**
     * {@code active: true -> false}. Throws {@link
     * com.cricketlegend.exception.InvalidStatusTransitionException} if already inactive.
     */
    ClubContactDto deactivate(UUID clubId, UUID contactId);

    /**
     * {@code active: false -> true}. Throws {@link
     * com.cricketlegend.exception.InvalidStatusTransitionException} if already active.
     */
    ClubContactDto reactivate(UUID clubId, UUID contactId);
}
