package com.cricketlegend.dto;

/**
 * The Matches view counters of docs/specs/093-team-selection-hub.md, over the matches of the same
 * response: {@code upcoming} counts matches with {@code upcoming} true; the other four count the
 * matches whose {@code status} is NOT_STARTED, IN_PROGRESS, READY_TO_ANNOUNCE and ANNOUNCED, so each
 * counter equals the number of rows its filter shows.
 */
public record TeamSelectionCountsDto(int upcoming, int notStarted, int inProgress, int readyToAnnounce, int announced) {
}
