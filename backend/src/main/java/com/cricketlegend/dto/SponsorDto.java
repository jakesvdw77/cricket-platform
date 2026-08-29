package com.cricketlegend.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Read shape of a club's sponsor — name/website/email/phone, logo/banner branding, and social
 * links (reusing {@link SocialLinkDto} unchanged, per docs/specs/022-club-social-media.md's
 * pattern), plus the active flag. See docs/specs/023-sponsors.md.
 */
public record SponsorDto(
        UUID id,
        UUID clubId,
        String name,
        String website,
        String email,
        String phone,
        String logoUrl,
        String bannerUrl,
        List<SocialLinkDto> socialLinks,
        boolean active,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy) {
}
