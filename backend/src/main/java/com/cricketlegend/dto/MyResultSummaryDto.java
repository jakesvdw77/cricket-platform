package com.cricketlegend.dto;

import com.cricketlegend.dto.PlayerStatsDto.PlayerBestBowling;
import com.cricketlegend.dto.PlayerStatsDto.PlayerHighestScore;
import java.util.List;

/**
 * docs/specs/145: the Results hero for a scope, over only the results shown in the Player Hub, so it adds up with the
 * list: {@code matches} equals the list's {@code page.totalElements}. Every figure is the 103 figure for the same scope
 * ({@code PlayerStatsService}); {@code lastFive} is the newest five rows (the streak). {@code highestScore} and
 * {@code bestBowling} are null when the player has none.
 */
public record MyResultSummaryDto(
        MyResultScopeDto scope,
        long matches,
        long won,
        long lost,
        long tied,
        long drawn,
        long internal,
        long runs,
        long wickets,
        long catches,
        long playerOfTheMatch,
        PlayerHighestScore highestScore,
        PlayerBestBowling bestBowling,
        List<MyResultRowDto> lastFive) {}
