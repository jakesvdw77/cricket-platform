package com.cricketlegend.service;

import com.cricketlegend.dto.SponsorDto;
import java.util.List;
import java.util.UUID;

/**
 * A many-to-many, bare link between a {@link com.cricketlegend.domain.Team} and
 * docs/specs/023-sponsors.md's existing {@link com.cricketlegend.domain.Sponsor} — no extra
 * column beyond the join itself. A separate service from {@link TeamService} (per
 * docs/plans/027-team-profile.md's Flag #2) rather than folded into it. Reachable only via {@code
 * TeamController} on {@code /api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors},
 * no dedicated {@code /platform} mirror. See docs/specs/027-team-profile.md.
 */
public interface TeamSponsorService {

    /**
     * Every {@link SponsorDto} currently linked to {@code teamId}. 404s if {@code sectionId}
     * doesn't belong to {@code clubId}, or {@code teamId} doesn't belong to {@code sectionId}.
     */
    List<SponsorDto> list(UUID clubId, UUID sectionId, UUID teamId);

    /**
     * Links an existing {@link com.cricketlegend.domain.Sponsor} (must belong to {@code clubId},
     * 404 otherwise) to {@code teamId}. 404s if {@code sectionId} doesn't belong to {@code
     * clubId}, or {@code teamId} doesn't belong to {@code sectionId} — checked before the sponsor
     * lookup ever runs. Throws {@link com.cricketlegend.exception.ConflictException} if already
     * linked.
     */
    void link(UUID clubId, UUID sectionId, UUID teamId, UUID sponsorId);

    /**
     * Removes the link between {@code teamId} and {@code sponsorId}. Throws {@link
     * com.cricketlegend.exception.NotFoundException} if no such link exists. Never touches the
     * underlying {@link com.cricketlegend.domain.Sponsor} or {@link com.cricketlegend.domain.Team}
     * rows.
     */
    void unlink(UUID clubId, UUID sectionId, UUID teamId, UUID sponsorId);
}
