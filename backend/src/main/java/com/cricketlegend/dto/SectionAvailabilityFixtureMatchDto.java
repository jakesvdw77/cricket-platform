package com.cricketlegend.dto;

import com.cricketlegend.domain.AvailabilityPollType;
import com.cricketlegend.domain.DayPart;
import java.time.Instant;
import java.util.UUID;

/**
 * One candidate match row within a proposed {@link SectionAvailabilityFixtureGroupDto} — {@link
 * #alreadyPolled} is true when the match is covered by a poll of EITHER kind (or its resolved
 * bracket already has a group window); only then are {@link #existingPollType} ({@code
 * SQUAD}|{@code GROUP}), {@link #existingPollId} (the squad poll id, or the group round id) and
 * {@link #existingPollLabel} (a group poll's description, or a squad poll's "Team v Opponent")
 * populated, so the UI can render the row disabled with a link to the covering poll. See
 * docs/specs/064-unified-availability-polls.md (generalising 063's existingRound* fields).
 */
public record SectionAvailabilityFixtureMatchDto(
        UUID matchId,
        UUID teamId,
        String teamName,
        String opponentLabel,
        Instant matchDate,
        DayPart dayPart,
        String leagueName,
        boolean alreadyPolled,
        AvailabilityPollType existingPollType,
        UUID existingPollId,
        String existingPollLabel) {
}
