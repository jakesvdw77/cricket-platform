package com.cricketlegend.dto;

/**
 * Club-wide figures of {@code GET /sections/summary} (docs/specs/094-club-structure-and-seasons.md): {@code sections}
 * the active sections, {@code teams} the active teams (the Teams page's "Active" counter), {@code players} every club
 * player profile that is active and not rejected, tagged to a section or not (the Players page's default count).
 */
public record SectionsSummaryTotalsDto(long sections, long teams, long players) {
}
