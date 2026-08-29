package com.cricketlegend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

/**
 * POST /api/v1/manage/clubs/{clubId}/sponsors payload. {@code @Valid} on {@code socialLinks} is
 * mandatory here from the start — docs/specs/022-club-social-media.md found a real bug where this
 * annotation was missing on {@code UpdateClubProfileRequest.socialLinks}, silently skipping
 * validation of the nested list. See docs/specs/023-sponsors.md.
 */
public record CreateSponsorRequest(
        @NotBlank String name,
        String website,
        String email,
        String phone,
        String logoUrl,
        String bannerUrl,
        @Valid List<SocialLinkDto> socialLinks) {
}
