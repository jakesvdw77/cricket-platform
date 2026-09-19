package com.cricketlegend.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * One currently-open {@link com.cricketlegend.domain.MatchAvailabilityPoll}, aggregated with its
 * match context and a per-status respondent summary — the {@code GET .../availability-polls/open}
 * dashboard response shape. Exactly one of {@code homeTeamId}/{@code homeTeamName} is non-null,
 * per {@code Match}'s own invariant, same for {@code awayTeamId}/{@code awayTeamName} — the
 * frontend resolves the null one the same way {@code MatchList.tsx}/{@code MatchFormPage.tsx}
 * already do, not re-solved server-side. See docs/specs/034-availability-polls-dashboard.md's API
 * Contract.
 */
public record OpenAvailabilityPollDto(
        UUID pollId,
        UUID matchId,
        UUID teamId,
        UUID homeTeamId,
        String homeTeamName,
        UUID awayTeamId,
        String awayTeamName,
        Instant matchDate,
        String venue,
        long availableCount,
        long unavailableCount,
        long unsureCount,
        long noResponseCount,
        List<AvailabilityRespondentDto> availableRespondents,
        List<AvailabilityRespondentDto> unavailableRespondents,
        List<AvailabilityRespondentDto> unsureRespondents) {
}
