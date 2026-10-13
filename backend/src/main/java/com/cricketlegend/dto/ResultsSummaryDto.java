package com.cricketlegend.dto;

/**
 * docs/specs/100-match-results-core.md: the Results page counters for the same filters the list uses. {@code played}
 * counts matches with a published result; {@code won}/{@code lost} count published results won/lost by one of the
 * club's own sides (a match between two own teams is one of each); {@code tiedOrNone} is a published tie, draw, no
 * result or abandonment; {@code drafts} are unpublished results; {@code awaiting} are active matches up to the end
 * of today with no result. Each figure equals the list's total for the same filters with that {@code focus}
 * ({@code awaiting}: the awaiting endpoint's total).
 */
public record ResultsSummaryDto(long played, long won, long lost, long tiedOrNone, long drafts, long awaiting) {
}
