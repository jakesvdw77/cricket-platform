package com.cricketlegend.dto;

import com.cricketlegend.domain.AvailabilityPollType;
import com.cricketlegend.domain.DayPart;
import java.time.Instant;
import java.util.UUID;

/**
 * One game column of the player availability grid. {@code label} is "Home v Away" (team names,
 * or the free-text opponent name where a side has no team id); {@code teamId}/{@code sectionId}
 * are this club's team in the game that lies in the caller's scope and that team's section;
 * {@code pollType} is {@code null} when no poll covers the game, {@code pollId} is the squad poll
 * id or the group round id, and {@code roundId} is set for group polls only. See
 * docs/specs/068-player-availability-grid.md.
 */
public record GameColumnDto(
        UUID matchId,
        Instant matchDate,
        DayPart dayPart,
        String label,
        String venue,
        UUID leagueId,
        String leagueName,
        UUID teamId,
        UUID sectionId,
        AvailabilityPollType pollType,
        UUID pollId,
        UUID roundId) {
}
