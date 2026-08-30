package com.cricketlegend.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Read shape of a {@link com.cricketlegend.domain.TeamContact} link — the linked {@link
 * ClubContactDto} plus the join's own team-specific {@code role}. Unlike {@code SectionContact}
 * (whose list endpoint returns bare {@code List<ClubContactDto>}, nothing extra to carry), {@code
 * TeamContact} has its own {@code role} to surface, so it needs this small wrapper record. See
 * docs/specs/027-team-profile.md.
 */
public record TeamContactDto(UUID id, ClubContactDto contact, String role, Instant createdAt) {
}
