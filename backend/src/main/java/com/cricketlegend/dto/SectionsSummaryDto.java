package com.cricketlegend.dto;

import java.util.List;

/**
 * Response shape of {@code GET /sections/summary} (docs/specs/094-club-structure-and-seasons.md): the club-wide
 * {@code totals} and one {@link SectionSummaryDto} per section (active and inactive), in the order the sections are read.
 */
public record SectionsSummaryDto(SectionsSummaryTotalsDto totals, List<SectionSummaryDto> sections) {
}
