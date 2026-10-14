package com.cricketlegend.dto;

import java.util.UUID;

/**
 * Placeholder for a recent match result on the manager overview. Results now exist (spec 100) but
 * {@code ManagerOverviewDto.recentResults} is still always empty; the shape is fixed now so the frontend
 * card can be built, and gains fields when results are specified.
 */
public record OverviewResultDto(UUID matchId, String summary) {
}
