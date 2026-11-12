package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * The held player's availability answers across one season's polls, answered or not (docs/specs/119, Hub My Responses).
 * {@code seasons} are the seasons in which the player has any poll, newest first; {@code summary} counts every row of the
 * season before the status filter, {@code rows} are after it.
 */
public record MyPollResponsesDto(
        Scope scope,
        List<SeasonOption> seasons,
        UUID currentSeasonId,
        Summary summary,
        List<MyPollHistoryRowDto> rows) {

    public record Scope(UUID seasonId) {}

    public record SeasonOption(UUID id, String label) {}

    public record Summary(long polls, long answered, long available, long unavailable, long notSure, long notAnswered) {}
}
