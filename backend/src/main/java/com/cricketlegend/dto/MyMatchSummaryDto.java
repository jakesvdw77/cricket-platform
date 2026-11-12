package com.cricketlegend.dto;

import com.cricketlegend.domain.MatchPhase;
import com.cricketlegend.domain.MatchSelectionState;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/** docs/specs/135: one row of the Player Hub matches list. {@code startedAt} is live only, {@code result} recent only.
 * {@code outcome} (WON, LOST, TIED or null) is the result from the held player's side, recent rows with a result only. */
public record MyMatchSummaryDto(
        UUID matchId,
        MatchPhase phase,
        LocalDate date,
        LocalTime time,
        Instant startedAt,
        MyMatchTeamDto home,
        MyMatchTeamDto away,
        String league,
        String venue,
        boolean mine,
        MatchSelectionState selection,
        boolean hasLiveScore,
        boolean hasStream,
        MyMatchResultDto result,
        String outcome) {}
