package com.cricketlegend.dto;

import java.util.List;

/**
 * Response of {@code GET /playing-areas/filter-options} (docs/specs/099-fields-directory.md): the distinct country
 * codes, provinces and cities still reachable under the other active filters (each list ignores its own pick), sorted.
 */
public record PlayingAreaFilterOptionsDto(List<String> countries, List<String> provinces, List<String> cities) {
}
