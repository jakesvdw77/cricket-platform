package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * One section's figures in {@code GET /sections/summary} (docs/specs/094-club-structure-and-seasons.md). {@code teamCount}
 * and {@code playerCount} are the section's own teams and tagged players; {@code activeTeamCount} the own teams that are
 * active; the {@code subtree*} figures include every descendant section (players counted once). {@code leagues} are the
 * distinct leagues in which a team of this section is affiliated in the requested season, own teams only.
 */
public record SectionSummaryDto(
        UUID sectionId,
        long teamCount,
        long activeTeamCount,
        long playerCount,
        long subtreeTeamCount,
        long subtreePlayerCount,
        List<SummaryLeagueRefDto> leagues) {
}
