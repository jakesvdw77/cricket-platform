package com.cricketlegend.dto;

import java.util.UUID;

/**
 * Read shape of a {@link com.cricketlegend.domain.MatchAvailabilityPoll}, one per real-{@code
 * Team} side of a {@link com.cricketlegend.domain.Match} — the admin list/create/open/close
 * response, carrying a response-count summary alongside the poll's own fields. See
 * docs/specs/032-match-availability-polls.md.
 */
public record MatchAvailabilityPollDto(
        UUID id,
        UUID teamId,
        boolean open,
        long availableCount,
        long unavailableCount,
        long unsureCount,
        long noResponseCount) {
}
