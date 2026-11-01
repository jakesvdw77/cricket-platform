package com.cricketlegend.dto;

import java.util.List;

/** docs/specs/135: the held player's matches: live, upcoming (soonest first, capped 20), recent (newest first, capped 10). */
public record MyMatchListDto(List<MyMatchSummaryDto> live, List<MyMatchSummaryDto> upcoming, List<MyMatchSummaryDto> recent) {}
