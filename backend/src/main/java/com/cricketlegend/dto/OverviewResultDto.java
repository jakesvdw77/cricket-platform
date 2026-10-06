package com.cricketlegend.dto;

import java.util.UUID;

/**
 * Placeholder for a recent match result on the manager overview. Results do not exist yet, so
 * {@code ManagerOverviewDto.recentResults} is always empty; the shape is fixed now so the frontend
 * card can be built, and gains fields when results are specified.
 */
public record OverviewResultDto(UUID matchId, String summary) {
}
