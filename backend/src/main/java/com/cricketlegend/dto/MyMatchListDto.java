package com.cricketlegend.dto;

import java.util.List;

/**
 * docs/specs/135: the held player's matches: live, upcoming (soonest first, capped 20), recent (newest first, capped by
 * the request's recentLimit, default 10). {@code upcomingTotal} and {@code recentTotal} count the matches before the display cap but over the rows read
 * (at most 200 ahead; the larger of 50 and twice the limit behind), not over every match the player has.
 */
public record MyMatchListDto(
        List<MyMatchSummaryDto> live,
        List<MyMatchSummaryDto> upcoming,
        List<MyMatchSummaryDto> recent,
        long upcomingTotal,
        long recentTotal) {}
