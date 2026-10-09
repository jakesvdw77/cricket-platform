package com.cricketlegend.dto;

/**
 * Response shape of {@code GET /players/summary} — the Players page counters (docs/specs/088-players-polls-alignment.md)
 * for exactly the filters the list uses. {@code playersShown} is the list's own size; {@code inSquad}, {@code selected}
 * and {@code unverified} equal that list's size with the matching {@code focus} (and {@code seasonId}). The two season
 * figures are 0 when no {@code seasonId} is given.
 */
public record PlayersSummaryDto(long playersShown, long inSquad, long selected, long unverified) {
}
