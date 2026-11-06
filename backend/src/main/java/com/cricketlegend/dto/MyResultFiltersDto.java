package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * docs/specs/145: the Season, Team and League values the held player has results shown in the Player Hub for (a filter
 * offers only values with data). {@code currentSeasonId} is the club's current season when it is among {@code seasons},
 * else the newest listed season, else null.
 */
public record MyResultFiltersDto(
        UUID currentSeasonId, List<Option> seasons, List<Option> teams, List<Option> leagues) {

    /** An id and display name. */
    public record Option(UUID id, String name) {}
}
