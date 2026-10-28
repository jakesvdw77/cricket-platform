package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * docs/specs/123: the leagues the held player's teams play in for one season (response only). {@code seasonId} is null
 * only for a club with no seasons.
 */
public record MyLeaguesDto(List<MySeasonOptionDto> seasons, UUID seasonId, List<MyLeagueSummaryDto> leagues) {
}
