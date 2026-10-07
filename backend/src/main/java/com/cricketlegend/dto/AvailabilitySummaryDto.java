package com.cricketlegend.dto;

/**
 * The availability counters of docs/specs/081-plain-page-header-and-counters.md for the caller's
 * scope. {@code openPolls} squad plus group polls; {@code playersInAudience} distinct players asked
 * by any of them; {@code playersResponded} those of them with at least one real answer in at least
 * one; {@code answersAwaited} the summed unanswered places (same figure as the overview's);
 * {@code closingSoon} open polls scheduled to close within the next 48 hours.
 */
public record AvailabilitySummaryDto(
        int openPolls, int playersResponded, int playersInAudience, long answersAwaited, int closingSoon) {
}
