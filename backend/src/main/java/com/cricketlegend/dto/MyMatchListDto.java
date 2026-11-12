package com.cricketlegend.dto;

import java.util.List;

/**
 * docs/specs/135: the held player's matches: live, upcoming (soonest first, capped 20), recent (newest first, capped by
 * the request's recentLimit, default 10). {@code upcomingTotal} and {@code recentTotal} count the matches before the cap.
 */
public record MyMatchListDto(
        List<MyMatchSummaryDto> live,
        List<MyMatchSummaryDto> upcoming,
        List<MyMatchSummaryDto> recent,
        long upcomingTotal,
        long recentTotal) {}
