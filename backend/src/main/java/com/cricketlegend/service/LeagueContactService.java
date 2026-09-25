package com.cricketlegend.service;

import com.cricketlegend.dto.CreateLeagueContactRequest;
import com.cricketlegend.dto.LeagueContactDto;
import com.cricketlegend.dto.UpdateLeagueContactRequest;
import java.util.List;
import java.util.UUID;

/**
 * Named contact people for a league (name, role, email, phone, one flaggable primary) —
 * reachable by a club's own {@code CLUB_ADMIN} or a {@code platform_admin} via {@code
 * /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts}, no dedicated {@code /platform}
 * mirror. "Disable, never delete" — see {@link #deactivate(UUID, UUID, UUID)}/{@link
 * #reactivate(UUID, UUID, UUID)}. Every lookup is scoped two levels deep — the league must
 * belong to the club, and the contact must belong to the league — mirroring {@code
 * SponsorContactService}'s identical two-level isolation shape. See
 * docs/specs/054-league-contacts.md.
 */
public interface LeagueContactService {

    /**
     * All contacts for {@code leagueId} (which must belong to {@code clubId}), active and
     * inactive — not paginated, a deliberately small bounded collection (see {@code
     * SponsorContactService.list}'s equivalent precedent).
     */
    List<LeagueContactDto> list(UUID clubId, UUID leagueId);

    /**
     * Creates a contact for {@code leagueId} (which must belong to {@code clubId}). When {@code
     * request.isPrimary()} is {@code true}, silently unsets {@code isPrimary} on any other active
     * contact for the same league in the same transaction — auto-unset, not a {@link
     * com.cricketlegend.exception.ConflictException}.
     */
    LeagueContactDto create(UUID clubId, UUID leagueId, CreateLeagueContactRequest request);

    /**
     * Full-resource update of an existing contact belonging to {@code leagueId} (which must
     * belong to {@code clubId}). Throws {@link com.cricketlegend.exception.NotFoundException} if
     * {@code leagueId} doesn't exist/belong to {@code clubId}, or {@code contactId} doesn't
     * exist/belong to {@code leagueId}. Same primary auto-unset behavior as {@link #create}.
     */
    LeagueContactDto update(
            UUID clubId, UUID leagueId, UUID contactId, UpdateLeagueContactRequest request);

    /**
     * {@code active: true -> false}. Throws {@link
     * com.cricketlegend.exception.InvalidStatusTransitionException} if already inactive.
     */
    LeagueContactDto deactivate(UUID clubId, UUID leagueId, UUID contactId);

    /**
     * {@code active: false -> true}. Throws {@link
     * com.cricketlegend.exception.InvalidStatusTransitionException} if already active.
     */
    LeagueContactDto reactivate(UUID clubId, UUID leagueId, UUID contactId);
}
