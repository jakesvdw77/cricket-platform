package com.cricketlegend.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** docs/specs/123: one league card in the Player Hub list. {@code nextMatchDate} is null when no match is ahead. */
public record MyLeagueSummaryDto(
        UUID id,
        String name,
        String logoUrl,
        Integer minAge,
        Integer maxAge,
        int teamCount,
        List<MyTeamRefDto> myTeams,
        LocalDate nextMatchDate,
        int matchCount) {
}
