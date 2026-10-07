package com.cricketlegend.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * GET /api/v1/public/section-availability-rounds/{roundId}: the group poll's header only. No
 * players, no responses. See docs/specs/077-public-availability-form-verification.md.
 */
public record PublicRoundHeaderDto(
        UUID roundId,
        String description,
        String sectionName,
        boolean open,
        UUID clubId,
        Instant scheduledCloseAt,
        List<PublicRoundWindowDto> windows) {
}
