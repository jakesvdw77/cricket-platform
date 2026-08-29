package com.cricketlegend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

/**
 * PUT /api/v1/manage/clubs/{clubId}/sponsors/{sponsorId} payload — a full-resource replace, same
 * field set as {@link CreateSponsorRequest}. See docs/specs/023-sponsors.md.
 */
public record UpdateSponsorRequest(
        @NotBlank String name,
        String website,
        String email,
        String phone,
        String logoUrl,
        String bannerUrl,
        @Valid List<SocialLinkDto> socialLinks) {
}
