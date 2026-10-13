package com.cricketlegend.dto;

/**
 * Response of {@code GET /playing-areas/summary} (docs/specs/099-fields-directory.md): the directory counters for the
 * list's filters other than {@code mine} and {@code verification}. Each figure equals the list's {@code totalElements}
 * with {@code mine=true}, no extra filter, and {@code verification=UNVERIFIED} respectively.
 */
public record PlayingAreaSummaryDto(long ourFields, long inDirectory, long unverified) {
}
