package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * GET .../polls/{pollId}/responses response — the poll's full season-scoped squad, each with
 * their current status or {@code null} for no response yet, the response-count summary, and the
 * poll's public path ({@code "/poll/" + pollId}) for the admin to build a share link from. See
 * docs/specs/032-match-availability-polls.md.
 */
public record MatchAvailabilityPollResponsesDto(
        UUID pollId,
        UUID teamId,
        boolean open,
        long availableCount,
        long unavailableCount,
        long unsureCount,
        long noResponseCount,
        List<PlayerAvailabilityRowDto> responses,
        String publicPath) {
}
