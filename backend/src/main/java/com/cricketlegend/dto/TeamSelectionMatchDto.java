package com.cricketlegend.dto;

import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.TeamSelectionStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * One match of the team-selection overview. {@code label} is "Home v Away"; {@code upcoming} is
 * true from the start of today; {@code status} aggregates the own {@code sides} (one, or two for a
 * derby between two teams of the club) per docs/specs/093-team-selection-hub.md.
 */
public record TeamSelectionMatchDto(
        UUID matchId,
        Instant matchDate,
        DayPart dayPart,
        String label,
        String venue,
        UUID seasonId,
        UUID leagueId,
        String leagueName,
        boolean upcoming,
        TeamSelectionStatus status,
        List<TeamSelectionSideDto> sides) {
}
