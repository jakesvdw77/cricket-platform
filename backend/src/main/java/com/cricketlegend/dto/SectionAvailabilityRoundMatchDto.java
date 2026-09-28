package com.cricketlegend.dto;

import com.cricketlegend.domain.DayPart;
import java.time.Instant;
import java.util.UUID;

/**
 * GET .../section-availability-rounds/{roundId}/matches row — one per {@code (match, team)} pair
 * explicitly linked to one of this round's windows via {@code SectionAvailabilityWindowMatch} (a
 * plain join, no longer live-resolved, per the fixture-group-selection revision), tagged with
 * which bracket it belongs to. {@link #windowId} lets the caller disambiguate rows across several
 * same-{@code dayPart} windows. See docs/specs/063-section-availability-and-flexible-squads.md.
 */
public record SectionAvailabilityRoundMatchDto(
        UUID matchId,
        UUID teamId,
        String teamName,
        String opponentLabel,
        Instant matchDate,
        String venue,
        String leagueName,
        DayPart dayPart,
        UUID windowId) {
}
