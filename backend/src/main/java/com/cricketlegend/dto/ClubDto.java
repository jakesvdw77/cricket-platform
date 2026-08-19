package com.cricketlegend.dto;

import com.cricketlegend.domain.ClubStatus;
import java.time.Instant;
import java.util.UUID;

/**
 * Full read shape of a Club, for the platform_admin onboarding screen. Distinct from
 * {@link ClubSummaryDto}, which stays the public-facing shape consumed by
 * docs/specs/004-landing-page.md's search and docs/specs/009-subscriptions.md's Subscription
 * form. See docs/specs/010-minimal-club-creation.md.
 */
public record ClubDto(
        UUID id,
        String name,
        String slug,
        ClubStatus status,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy) {
}
