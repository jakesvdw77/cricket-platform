package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * GET .../section-availability-rounds/{roundId}/responses response — every eligible player
 * (live-resolved via {@code SectionAvailabilityAudienceResolver}, resolved once against the
 * round's own section) with a status per bracket, each bracket's own count summary, and the
 * round's public path ({@code "/section-availability/" + roundId}) for the admin to build a
 * share link from. See docs/specs/063-section-availability-and-flexible-squads.md.
 */
public record SectionAvailabilityRoundResponsesDto(
        UUID roundId,
        UUID sectionId,
        String sectionName,
        String description,
        boolean open,
        List<SectionAvailabilityRoundBracketDto> brackets,
        List<SectionAvailabilityRoundResponseRowDto> responses,
        String publicPath) {
}
