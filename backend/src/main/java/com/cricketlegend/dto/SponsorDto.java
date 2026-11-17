package com.cricketlegend.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Read shape of a club's sponsor — name/website/email/phone, logo/banner branding, and social
 * links (reusing {@link SocialLinkDto} unchanged, per docs/specs/022-club-social-media.md's
 * pattern), plus the active flag. See docs/specs/023-sponsors.md. {@code main} is only ever true in a team's sponsor list (the
 * team's main sponsor, docs/specs/158-main-sponsor.md); everywhere else it is false.
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
        UUID updatedBy,
        boolean main) {
}
