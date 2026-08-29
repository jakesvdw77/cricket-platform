package com.cricketlegend.service;

import com.cricketlegend.dto.CreateSponsorRequest;
import com.cricketlegend.dto.SponsorDto;
import com.cricketlegend.dto.UpdateSponsorRequest;
import java.util.List;
import java.util.UUID;

/**
 * A club's sponsors (name, website, email, phone, logo, banner, social links) — reachable by a
 * club's own {@code CLUB_ADMIN} or a {@code platform_admin} via {@code
 * /api/v1/manage/clubs/{clubId}/sponsors}, no dedicated {@code /platform} mirror. "Disable, never
 * delete" — see {@link #deactivate(UUID, UUID)}/{@link #reactivate(UUID, UUID)}. See
 * docs/specs/023-sponsors.md.
 */
public interface SponsorService {

    /**
     * All sponsors for {@code clubId}, active and inactive — not paginated, a deliberately small
     * bounded collection (matching {@code ClubContactService.list}'s existing precedent).
     */
    List<SponsorDto> list(UUID clubId);

    /** Creates a sponsor for {@code clubId}. Rejects a duplicate {@code platform} within {@code request.socialLinks()}. */
    SponsorDto create(UUID clubId, CreateSponsorRequest request);

    /**
     * Full-resource update of an existing sponsor belonging to {@code clubId}. Throws {@link
     * com.cricketlegend.exception.NotFoundException} if {@code sponsorId} doesn't exist or belongs
     * to a different club. Same duplicate-platform rejection as {@link #create}.
     */
    SponsorDto update(UUID clubId, UUID sponsorId, UpdateSponsorRequest request);

    /**
     * {@code active: true -> false}. Throws {@link
     * com.cricketlegend.exception.InvalidStatusTransitionException} if already inactive.
     */
    SponsorDto deactivate(UUID clubId, UUID sponsorId);

    /**
     * {@code active: false -> true}. Throws {@link
     * com.cricketlegend.exception.InvalidStatusTransitionException} if already active.
     */
    SponsorDto reactivate(UUID clubId, UUID sponsorId);
}
