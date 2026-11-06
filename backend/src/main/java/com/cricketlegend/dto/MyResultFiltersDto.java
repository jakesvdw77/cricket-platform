package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * docs/specs/145: the Season, Team and League values the held player has results shown in the Player Hub for (a filter
 * offers only values with data). {@code currentSeasonId} is the club's current season when it is among {@code seasons},
 * else the newest listed season, else null. {@code combos} are the distinct season,
 * league and team combinations of those results.
 */
public record MyResultFiltersDto(
        UUID currentSeasonId, List<Option> seasons, List<Option> teams, List<Option> leagues, List<Combo> combos) {

    /** One season, league ({@code null} for a friendly) and team that has shown results, for the League then Team cascade. */
    public record Combo(UUID seasonId, UUID leagueId, UUID teamId) {}

    /** An id and display name. */
    public record Option(UUID id, String name) {}
}
