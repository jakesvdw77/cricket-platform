package com.cricketlegend.dto;

import com.cricketlegend.domain.DayPart;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * GET .../matches/{matchId}/teams/{teamId}/squad response — this side's resolved bracket ({@code
 * sectionId}/{@code windowDate}/{@code dayPart}), the resolved window's id/open-state/owning
 * round id if one exists yet ({@code windowId}/{@code roundId} are {@code null} when none does,
 * so the UI can offer a pre-filled "open a round" shortcut), the live "available pool" ({@code
 * candidates}), and the current squad ({@code selected}, in {@link MatchSquadMemberDto} shape).
 * {@code roundId} — added by the round-model revision — is the resolved window's own owning
 * {@code SectionAvailabilityRound}, so the UI can fetch round-level responses for {@code 033}'s
 * tinting without a second lookup. See docs/specs/063-section-availability-and-flexible-squads.md.
 */
public record MatchSquadDto(
        UUID sectionId,
        LocalDate windowDate,
        DayPart dayPart,
        UUID windowId,
        boolean windowOpen,
        UUID roundId,
        List<MatchSquadCandidateDto> candidates,
        List<MatchSquadMemberDto> selected) {
}
