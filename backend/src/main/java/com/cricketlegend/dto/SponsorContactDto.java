package com.cricketlegend.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Read shape of a sponsor's named contact — name/email/phone nested via the reusable {@link
 * ContactDto} (mirrors {@link ClubContactDto}'s own precedent), plus role, primary flag, and
 * active flag. Deliberately no {@code photoUrl}, unlike {@link ClubContactDto} — see
 * docs/specs/024-sponsor-contacts.md's Non-goals. See docs/specs/024-sponsor-contacts.md.
 */
public record SponsorContactDto(
        UUID id,
        UUID sponsorId,
        ContactDto contact,
        String role,
        boolean isPrimary,
        boolean active,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy) {
}
