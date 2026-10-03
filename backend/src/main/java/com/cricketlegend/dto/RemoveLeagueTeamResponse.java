package com.cricketlegend.dto;

/** Response of POST .../league-teams/{id}/remove; {@code leagueTeam} is null when {@code DELETED}. */
public record RemoveLeagueTeamResponse(LeagueTeamRemoveOutcome outcome, LeagueTeamDto leagueTeam) {
}
