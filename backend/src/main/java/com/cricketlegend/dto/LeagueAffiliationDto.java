package com.cricketlegend.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Read shape of a {@link com.cricketlegend.domain.LeagueAffiliation} — a club's own {@code Team}
 * entered into its own {@code League} for a {@code Season}. See
 * docs/specs/029-league-management.md.
 */
public record LeagueAffiliationDto(
        UUID id, UUID leagueId, UUID teamId, UUID seasonId, Instant createdAt, UUID createdBy) {
}
