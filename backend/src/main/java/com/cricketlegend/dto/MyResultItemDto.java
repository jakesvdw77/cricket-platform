package com.cricketlegend.dto;

import java.time.LocalDate;
import java.util.UUID;

/** docs/specs/123: one published result: scores as short text and the result line, never a scorecard. */
public record MyResultItemDto(
        UUID matchId,
        LocalDate date,
        String homeName,
        String awayName,
        String homeScore,
        String awayScore,
        String resultLine,
        boolean mine) {
}
