package com.cricketlegend.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Read shape of a league's named contact — name/email/phone nested via the reusable {@link
 * ContactDto} (mirrors {@link SponsorContactDto}'s own precedent), plus role, primary flag, and
 * active flag. Deliberately no {@code photoUrl}, same as {@link SponsorContactDto} — see
 * docs/specs/054-league-contacts.md's Non-goals. See docs/specs/054-league-contacts.md.
 */
public record LeagueContactDto(
        UUID id,
        UUID leagueId,
        ContactDto contact,
        String role,
        boolean isPrimary,
        boolean active,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy) {
}
