package com.cricketlegend.dto;

import com.cricketlegend.domain.LeadStatus;
import java.time.Instant;
import java.util.UUID;

/**
 * Full read shape of a Lead, for the platform_admin follow-up queue.
 * See docs/specs/004-landing-page.md.
 */
public record LeadDto(
        UUID id,
        String name,
        String email,
        String clubName,
        String phone,
        String message,
        LeadStatus status,
        UUID convertedClubId,
        UUID contactedByPersonId,
        Instant contactedAt,
        Instant createdAt) {
}
