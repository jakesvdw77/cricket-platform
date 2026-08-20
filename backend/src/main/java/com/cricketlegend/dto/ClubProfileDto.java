package com.cricketlegend.dto;

import com.cricketlegend.domain.ClubProfileType;
import java.time.Instant;
import java.util.UUID;

/**
 * Read shape of a Club's profile, for GET /api/v1/platform/clubs/{id}/profile. When no
 * {@code ClubProfile} row exists yet for a given club, {@link com.cricketlegend.service.ClubProfileService}
 * returns a default-shaped instance of this record — every field {@code null} except
 * {@code clubId} — rather than a 404, per docs/specs/012-club-profile.md.
 */
public record ClubProfileDto(
        UUID clubId,
        ClubProfileType type,
        String logoUrl,
        String bannerUrl,
        AddressDto address,
        String email,
        String phone,
        String website,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy) {
}
