package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * GET/PUT /api/v1/public/section-availability-rounds/{roundId} response — the round's own {@code
 * description} (the title everywhere now, no bare date range, per the fixture-group-selection
 * revision), section name, open/closed state, and every eligible player's name/standing jersey
 * number and current status per bracket ({@link SectionAvailabilityRoundResponseRowDto#statuses()}
 * — every bracket the round owns is always rendered now, no more hiding a zero-match bracket, since
 * a bracket only exists at all if a real, admin-selected match put it there). No {@code clubId}
 * anywhere in this shape — resolved entirely from the round's own id, mirroring {@code
 * PublicAvailabilityPollDto}'s public-surface posture exactly. See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public record PublicSectionAvailabilityRoundDto(
        UUID roundId,
        String description,
        String sectionName,
        boolean open,
        List<SectionAvailabilityRoundResponseRowDto> responses) {
}
