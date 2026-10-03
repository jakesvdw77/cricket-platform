package com.cricketlegend.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Read shape of a club's own {@link com.cricketlegend.domain.Match} — a scheduled fixture, home
 * and away sides each either a real {@code Team} id or a free-text opponent name.
 * {@code homeTeamLogoUrl}/{@code awayTeamLogoUrl} (docs/specs/050-league-schedule-and-fixtures.md)
 * are populated only alongside a free-text opponent name, null for a real {@code Team} side (whose
 * logo is resolved separately via {@code Team.logoUrl}). See docs/specs/029-league-management.md.
 *
 * <p>{@code homePickedCount}/{@code awayPickedCount}/{@code playingXiSize}/{@code polls}
 * (docs/specs/069-match-card-redesign.md) are read-time values computed only by {@code
 * MatchServiceImpl.list}: a picked count is the playing XI size selected for a club-team side
 * ({@code null} for a free-text or other-club side), {@code playingXiSize} is the league's {@code
 * maxPlayingXiSize} ({@code null} with no league). Every other path leaves the counts and size
 * {@code null}, and {@code polls} is normalised here, in the one place, to an empty list.
 */
public record MatchDto(
        UUID id,
        UUID clubId,
        UUID homeTeamId,
        String homeTeamName,
        UUID awayTeamId,
        String awayTeamName,
        String homeTeamLogoUrl,
        String awayTeamLogoUrl,
        UUID leagueId,
        UUID seasonId,
        Instant matchDate,
        String venue,
        boolean active,
        boolean homeSideAnnounced,
        boolean awaySideAnnounced,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy,
        Integer homePickedCount,
        Integer awayPickedCount,
        Integer playingXiSize,
        List<MatchPollDto> polls) {

    public MatchDto {
        polls = polls == null ? List.of() : polls;
    }
}
