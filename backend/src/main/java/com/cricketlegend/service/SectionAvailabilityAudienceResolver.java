package com.cricketlegend.service;

import com.cricketlegend.dto.SectionAvailabilityResponseRowDto;
import java.util.List;
import java.util.UUID;

/**
 * A {@code SectionAvailabilityWindow}'s audience is resolved live, not stored: every {@code
 * PlayerProfile} currently tagged (via {@code PlayerSection}, docs/specs/028-players.md) to the
 * window's own {@code sectionId}, filtered to {@code PlayerProfile.active == true} — the exact
 * "eligible for section" concept {@code 028} already built, reused unmodified rather than
 * reinvented. Mirrors {@link AvailabilityPollSquadResolver}'s own shape (a small, dedicated
 * resolver, not inline query logic scattered across the service). See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public interface SectionAvailabilityAudienceResolver {

    /**
     * Every eligible player for {@code sectionId}, each mapped to a {@link
     * SectionAvailabilityResponseRowDto} with {@code status} always {@code null} — callers overlay
     * the actual {@code SectionAvailabilityResponse} status for their own window on top of this
     * shared shape.
     */
    List<SectionAvailabilityResponseRowDto> resolveAudience(UUID sectionId);
}
