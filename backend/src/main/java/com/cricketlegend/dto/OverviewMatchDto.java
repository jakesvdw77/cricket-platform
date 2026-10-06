package com.cricketlegend.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * One upcoming match on the manager overview. Per {@code MatchDto}'s convention a side carries
 * either a team id or a free-text name; here the name is additionally resolved from the team when a
 * team id is set, so both name fields are always filled. {@code sectionId} is the section of the
 * first own-club side the caller can reach, or null when none resolves. {@code ownSides} holds one
 * entry per side whose team belongs to the club (home first), none for a pure opposition fixture.
 */
public record OverviewMatchDto(
        UUID matchId,
        Instant matchDate,
        String venue,
        UUID homeTeamId,
        String homeTeamName,
        UUID awayTeamId,
        String awayTeamName,
        UUID sectionId,
        List<OverviewMatchSideDto> ownSides) {
}
