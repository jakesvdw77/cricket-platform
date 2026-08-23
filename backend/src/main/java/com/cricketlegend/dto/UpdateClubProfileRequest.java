package com.cricketlegend.dto;

import com.cricketlegend.domain.ClubProfileType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import java.util.List;

/**
 * PUT /api/v1/platform/clubs/{id}/profile payload — a full-resource replace, not a partial
 * patch: every field is optional/nullable, and a field omitted (or explicitly {@code null}) from
 * the request nulls out a previously-saved value, matching how {@code ClubServiceImpl.update()}
 * already treats {@code Club} itself. See docs/specs/012-club-profile.md.
 */
public record UpdateClubProfileRequest(
        ClubProfileType type,
        String logoUrl,
        String bannerUrl,
        AddressDto address,
        @Email String email,
        String phone,
        @Pattern(regexp = "^https?://.+") String website,
        @Valid List<SocialLinkDto> socialLinks) {
}
