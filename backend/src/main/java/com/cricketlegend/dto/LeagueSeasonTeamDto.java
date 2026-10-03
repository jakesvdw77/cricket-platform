package com.cricketlegend.dto;

/**
 * One team in a league's current season on the leagues list card: the club's own affiliated team
 * ({@code own = true}) or a registered league team. See docs/specs/071-league-card-redesign.md.
 */
public record LeagueSeasonTeamDto(String name, String abbreviation, String logoUrl, boolean own) {
}
