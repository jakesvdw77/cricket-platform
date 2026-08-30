package com.cricketlegend.service;

import com.cricketlegend.dto.CreateSponsorContactRequest;
import com.cricketlegend.dto.SponsorContactDto;
import com.cricketlegend.dto.UpdateSponsorContactRequest;
import java.util.List;
import java.util.UUID;

/**
 * Named contact people for a sponsor (name, role, email, phone, one flaggable primary) —
 * reachable by a club's own {@code CLUB_ADMIN} or a {@code platform_admin} via {@code
 * /api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts}, no dedicated {@code /platform}
 * mirror. "Disable, never delete" — see {@link #deactivate(UUID, UUID, UUID)}/{@link
 * #reactivate(UUID, UUID, UUID)}. Every lookup is scoped two levels deep — the sponsor must
 * belong to the club, and the contact must belong to the sponsor — mirroring {@code
 * ClubContactService}'s single-level isolation, one level deeper. See
 * docs/specs/024-sponsor-contacts.md.
 */
public interface SponsorContactService {

    /**
     * All contacts for {@code sponsorId} (which must belong to {@code clubId}), active and
     * inactive — not paginated, a deliberately small bounded collection (see {@code
     * ClubContactService.list}'s equivalent precedent).
     */
    List<SponsorContactDto> list(UUID clubId, UUID sponsorId);

    /**
     * Creates a contact for {@code sponsorId} (which must belong to {@code clubId}). When {@code
     * request.isPrimary()} is {@code true}, silently unsets {@code isPrimary} on any other active
     * contact for the same sponsor in the same transaction — auto-unset, not a {@link
     * com.cricketlegend.exception.ConflictException}.
     */
    SponsorContactDto create(UUID clubId, UUID sponsorId, CreateSponsorContactRequest request);

    /**
     * Full-resource update of an existing contact belonging to {@code sponsorId} (which must
     * belong to {@code clubId}). Throws {@link com.cricketlegend.exception.NotFoundException} if
     * {@code sponsorId} doesn't exist/belong to {@code clubId}, or {@code contactId} doesn't
     * exist/belong to {@code sponsorId}. Same primary auto-unset behavior as {@link #create}.
     */
    SponsorContactDto update(
            UUID clubId, UUID sponsorId, UUID contactId, UpdateSponsorContactRequest request);

    /**
     * {@code active: true -> false}. Throws {@link
     * com.cricketlegend.exception.InvalidStatusTransitionException} if already inactive.
     */
    SponsorContactDto deactivate(UUID clubId, UUID sponsorId, UUID contactId);

    /**
     * {@code active: false -> true}. Throws {@link
     * com.cricketlegend.exception.InvalidStatusTransitionException} if already active.
     */
    SponsorContactDto reactivate(UUID clubId, UUID sponsorId, UUID contactId);
}
