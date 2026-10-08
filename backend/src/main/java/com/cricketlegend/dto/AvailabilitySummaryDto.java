package com.cricketlegend.dto;

/**
 * The availability counters of docs/specs/081-plain-page-header-and-counters.md for the caller's
 * scope, narrowed by the filters of docs/specs/083-availability-filters-and-toolbars.md.
 * {@code openPolls} the squad plus group polls shown (closed ones too when asked for);
 * {@code playersInAudience} distinct players asked by any of them; {@code playersResponded} those
 * of them with at least one real answer in at least one; {@code playersStillToAnswer} the distinct
 * players who still owe at least one answer in the polls shown; {@code closingSoon} open polls
 * scheduled to close within the next 48 hours.
 */
public record AvailabilitySummaryDto(
        int openPolls, int playersResponded, int playersInAudience, int playersStillToAnswer, int closingSoon) {
}
