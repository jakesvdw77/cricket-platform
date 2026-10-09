package com.cricketlegend.dto;

/**
 * Response shape of {@code GET /matches/summary} — the Matches page counters (docs/specs/087-matches-polls-alignment.md),
 * for exactly the filters the list uses. {@code matchesShown} is the list's own total; the other three are the
 * active, upcoming matches behind each quick filter ({@code focus=this-week|not-announced|no-poll}) and equal that
 * list's {@code totalElements} for the same filters.
 */
public record MatchesSummaryDto(long matchesShown, long thisWeek, long teamsNotAnnounced, long withoutPoll) {
}
