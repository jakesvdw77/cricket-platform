package com.cricketlegend.dto;

import com.cricketlegend.domain.DayPart;
import java.time.Instant;
import java.util.UUID;

/**
 * One candidate match row within a proposed {@link SectionAvailabilityFixtureGroupDto} — {@link
 * #alreadyPolled}/{@link #existingRoundId}/{@link #existingRoundDescription} are only populated
 * when a {@code SectionAvailabilityWindow} already exists for this match's own resolved bracket
 * (from any round, open or closed), so the UI can render it disabled with a link to the poll that
 * already covers it. See docs/specs/063-section-availability-and-flexible-squads.md.
 */
public record SectionAvailabilityFixtureMatchDto(
        UUID matchId,
        UUID teamId,
        String teamName,
        String opponentLabel,
        Instant matchDate,
        DayPart dayPart,
        String leagueName,
        boolean alreadyPolled,
        UUID existingRoundId,
        String existingRoundDescription) {
}
