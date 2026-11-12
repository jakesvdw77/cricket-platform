package com.cricketlegend.dto;

import com.cricketlegend.dto.MyResultFiltersDto.Combo;
import com.cricketlegend.dto.MyResultFiltersDto.Option;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/147: the Season, League and Team values inside the held player's leaderboard reach (a filter offers only
 * values with data, as {@link MyResultFiltersDto}, but over the players of the reach rather than the player's own
 * results). {@code currentSeasonId} is the club's current season when it is among {@code seasons}, else the newest listed
 * season, else null. {@code combos} are the distinct (season, league, team) combinations of the reach, for the League
 * then Team cascade; {@code leagues} are the reach leagues only (no friendlies).
 */
public record MyLeaderboardFiltersDto(
        UUID currentSeasonId, List<Option> seasons, List<Option> teams, List<Option> leagues, List<Combo> combos) {
}
