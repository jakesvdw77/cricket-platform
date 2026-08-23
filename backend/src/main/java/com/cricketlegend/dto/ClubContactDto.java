package com.cricketlegend.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Read shape of a club's named contact — name/email/phone nested via the reusable {@link
 * ContactDto} (mirrors {@link ClubProfileDto}'s own precedent of nesting {@link AddressDto}), plus
 * role, primary flag, active flag, and an optional photo. See docs/specs/021-club-contacts.md.
 */
public record ClubContactDto(
        UUID id,
        UUID clubId,
        ContactDto contact,
        String role,
        boolean isPrimary,
        boolean active,
        String photoUrl,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy) {
}
