package com.cricketlegend.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * GET/PUT /api/v1/public/polls/{pollId} response — the poll's match context (home/away names,
 * date, venue, league/season name if set — the same fields {@code MatchList}'s cards already
 * surface), {@code open}/closed state, the responding side's own {@code teamName}, and the full
 * squad list with each member's current status or {@code null}. No {@code clubId} anywhere in
 * this shape — resolved entirely from the poll's own id, per this spec's public-surface posture.
 * See docs/specs/032-match-availability-polls.md.
 */
public record PublicAvailabilityPollDto(
        UUID pollId,
        boolean open,
        String homeTeamName,
        String awayTeamName,
        Instant matchDate,
        String venue,
        String leagueName,
        String seasonLabel,
        String teamName,
        List<PlayerAvailabilityRowDto> responses) {
}
