package com.cricketlegend.service;

import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.dto.PublicSectionAvailabilityRoundDto;
import java.util.UUID;

/**
 * Public, unauthenticated surface for a {@code SectionAvailabilityRound} — mirrors {@code
 * PublicAvailabilityPollService}'s exact shape (no {@code clubId} anywhere, the round's own
 * unguessable UUID is the entire access boundary). Per the fixture-group-selection revision,
 * {@link #setAvailability} is now {@code windowId}-keyed rather than {@code dayPart}-keyed. See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public interface PublicSectionAvailabilityRoundService {

    PublicSectionAvailabilityRoundDto getRound(UUID roundId);

    PublicSectionAvailabilityRoundDto setAvailability(
            UUID roundId, UUID playerProfileId, UUID windowId, AvailabilityStatus status);
}
