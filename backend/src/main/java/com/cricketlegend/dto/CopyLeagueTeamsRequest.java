package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

/**
 * POST .../league-teams/copy payload: the ticked rows of the source league and season to copy into
 * the target league and season. An empty {@code leagueTeamIds} is a 400 (service layer). See
 * docs/specs/070-league-teams.md.
 */
public record CopyLeagueTeamsRequest(
        @NotNull UUID sourceLeagueId, @NotNull UUID sourceSeasonId, @NotNull List<UUID> leagueTeamIds) {
}
