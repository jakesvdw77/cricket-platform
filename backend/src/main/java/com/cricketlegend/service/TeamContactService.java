package com.cricketlegend.service;

import com.cricketlegend.dto.TeamContactDto;
import java.util.List;
import java.util.UUID;

/**
 * A many-to-many link between a {@link com.cricketlegend.domain.Team} and
 * docs/specs/021-club-contacts.md's existing {@link com.cricketlegend.domain.ClubContact}, with a
 * team-specific free-text {@code role}. A separate service from {@link TeamService} (per
 * docs/plans/027-team-profile.md's Flag #2) rather than folded into it. Reachable only via {@code
 * TeamController} on {@code /api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts},
 * no dedicated {@code /platform} mirror. See docs/specs/027-team-profile.md.
 */
public interface TeamContactService {

    /**
     * Every {@link TeamContactDto} currently linked to {@code teamId}. 404s if {@code sectionId}
     * doesn't belong to {@code clubId}, or {@code teamId} doesn't belong to {@code sectionId}.
     */
    List<TeamContactDto> list(UUID clubId, UUID sectionId, UUID teamId);

    /**
     * Links an existing {@link com.cricketlegend.domain.ClubContact} (must belong to {@code
     * clubId}, 404 otherwise) to {@code teamId} with the given {@code role}. 404s if {@code
     * sectionId} doesn't belong to {@code clubId}, or {@code teamId} doesn't belong to {@code
     * sectionId} — checked before the contact lookup ever runs. Throws {@link
     * com.cricketlegend.exception.ConflictException} if already linked.
     */
    void link(UUID clubId, UUID sectionId, UUID teamId, UUID contactId, String role);

    /**
     * Removes the link between {@code teamId} and {@code contactId}. Throws {@link
     * com.cricketlegend.exception.NotFoundException} if no such link exists. Never touches the
     * underlying {@link com.cricketlegend.domain.ClubContact} or {@link
     * com.cricketlegend.domain.Team} rows.
     */
    void unlink(UUID clubId, UUID sectionId, UUID teamId, UUID contactId);
}
