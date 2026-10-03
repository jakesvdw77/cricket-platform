package com.cricketlegend.dto;

import java.util.UUID;

/**
 * Read shape of a {@link com.cricketlegend.domain.LeagueTeam}. {@code referencedByMatchCount} is
 * the number of matches using it on either side so the UI can predict delete versus deactivate:
 * computed in one batched query by {@code LeagueTeamServiceImpl.list}, per row by update/
 * deactivate/reactivate/remove, and 0 for a newly created or copied row. See
 * docs/specs/070-league-teams.md.
 */
public record LeagueTeamDto(
        UUID id,
        UUID leagueId,
        UUID seasonId,
        String name,
        String abbreviation,
        String logoUrl,
        boolean active,
        long referencedByMatchCount) {
}
