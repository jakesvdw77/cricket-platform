package com.cricketlegend.dto;

import java.util.List;

/** Result of a league-team copy: the new rows and the skipped duplicates. See docs/specs/070-league-teams.md. */
public record CopyLeagueTeamsResponse(List<LeagueTeamDto> created, List<SkippedLeagueTeamDto> skipped) {
}
