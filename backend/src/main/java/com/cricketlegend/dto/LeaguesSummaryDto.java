package com.cricketlegend.dto;

/**
 * Response shape of {@code GET /leagues/summary} - the Leagues page counters (docs/specs/091-leagues-gold-standard.md)
 * for exactly the filters the list uses. {@code leaguesShown} is the list's own size; {@code active} and {@code
 * needAttention} equal that list's size with the matching {@code focus}. {@code teamsEntered} is the teams (the club's
 * own and the leagues' other teams) of the shown leagues in the season, {@code players} the distinct players in the
 * squads of the club's own entered teams that season, {@code seasons} the club's seasons and {@code matchesThisWeek}
 * the matches in the coming week across the shown leagues (a match count: its quick filter keeps the leagues that have
 * one).
 */
public record LeaguesSummaryDto(
        long leaguesShown, long active, long teamsEntered, long players, long seasons, long matchesThisWeek, long needAttention) {
}
