package com.cricketlegend.dto;

import com.cricketlegend.domain.MatchResultStatus;
import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import java.math.BigDecimal;
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
 * ({@code null} for a free-text or other-club side), {@code playingXiSize} is the most players a
 * side's selection may hold (docs/specs/076-team-selection.md {@code maxSelected}, the 12th man
 * counted; {@code null} with no league). Every other path leaves the counts and size
 * {@code null}, and {@code polls} is normalised here, in the one place, to an empty list.
 *
 * <p>{@code homeLeagueTeamId}/{@code awayLeagueTeamId} (docs/specs/070-league-teams.md) are the
 * nullable {@code LeagueTeam} references; for such a side the name/logo are the league team's
 * copied values.
 *
 * <p>{@code scoringUrl}/{@code streamingUrl} (docs/specs/075-match-view-and-edit.md) are optional
 * external http(s) links, plain stored fields returned on every path.
 *
 * <p>{@code playingAreaId}/{@code playingAreaName}/{@code playingAreaVerificationStatus}
 * (docs/specs/099-fields-directory.md) describe the chosen field; the name equals {@code venue} when linked, and all
 * three are {@code null} for a match with no field. The five {@code playingAreaLatitude}..{@code playingAreaAccessNote}
 * values (docs/specs/133) are the field's stored position and access point, {@code null} with no field or none set.
 *
 * <p>{@code resultStatus} (docs/specs/100-match-results-core.md) is {@code NONE}, {@code DRAFT} or {@code PUBLISHED}:
 * a match is completed when its result is published. Computed in batch on the list and single-match paths; normalised
 * here to {@code NONE} when not set.
 *
 * <p>{@code deletable} (docs/specs/109-delete-empty-match.md) is true when nothing is recorded against the match (no
 * result, poll, squad, team selection or availability window), so the screens can offer Delete. Batched like the result
 * status; false where not computed.
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
        List<MatchPollDto> polls,
        UUID homeLeagueTeamId,
        UUID awayLeagueTeamId,
        String scoringUrl,
        String streamingUrl,
        UUID playingAreaId,
        String playingAreaName,
        PlayingAreaVerificationStatus playingAreaVerificationStatus,
        BigDecimal playingAreaLatitude,
        BigDecimal playingAreaLongitude,
        BigDecimal playingAreaAccessLatitude,
        BigDecimal playingAreaAccessLongitude,
        String playingAreaAccessNote,
        MatchResultStatus resultStatus,
        boolean deletable) {

    public MatchDto {
        polls = polls == null ? List.of() : polls;
        resultStatus = resultStatus == null ? MatchResultStatus.NONE : resultStatus;
    }

    /**
     * A copy carrying the chosen field's name, verification status and coordinates (docs/specs/099-fields-directory.md,
     * 133); a null {@code area} leaves the field values {@code null}.
     */
    public MatchDto withPlayingArea(PlayingArea area) {
        return withPlayingArea(
                area == null ? null : area.getName(),
                area == null ? null : area.getVerificationStatus(),
                area == null ? null : area.getLatitude(),
                area == null ? null : area.getLongitude(),
                area == null ? null : area.getAccessLatitude(),
                area == null ? null : area.getAccessLongitude(),
                area == null ? null : area.getAccessNote());
    }

    private MatchDto withPlayingArea(
            String name, PlayingAreaVerificationStatus status, BigDecimal latitude, BigDecimal longitude,
            BigDecimal accessLatitude, BigDecimal accessLongitude, String accessNote) {
        return new MatchDto(
                id, clubId, homeTeamId, homeTeamName, awayTeamId, awayTeamName, homeTeamLogoUrl, awayTeamLogoUrl,
                leagueId, seasonId, matchDate, venue, active, homeSideAnnounced, awaySideAnnounced, createdAt,
                updatedAt, updatedBy, homePickedCount, awayPickedCount, playingXiSize, polls, homeLeagueTeamId,
                awayLeagueTeamId, scoringUrl, streamingUrl, playingAreaId, name, status, latitude, longitude,
                accessLatitude, accessLongitude, accessNote, resultStatus, deletable);
    }

    /** A copy carrying the match's result status (docs/specs/100-match-results-core.md). */
    public MatchDto withResultStatus(MatchResultStatus status) {
        return new MatchDto(
                id, clubId, homeTeamId, homeTeamName, awayTeamId, awayTeamName, homeTeamLogoUrl, awayTeamLogoUrl,
                leagueId, seasonId, matchDate, venue, active, homeSideAnnounced, awaySideAnnounced, createdAt,
                updatedAt, updatedBy, homePickedCount, awayPickedCount, playingXiSize, polls, homeLeagueTeamId,
                awayLeagueTeamId, scoringUrl, streamingUrl, playingAreaId, playingAreaName,
                playingAreaVerificationStatus, playingAreaLatitude, playingAreaLongitude, playingAreaAccessLatitude,
                playingAreaAccessLongitude, playingAreaAccessNote, status, deletable);
    }

    /** A copy carrying whether the match is deletable (docs/specs/109-delete-empty-match.md). */
    public MatchDto withDeletable(boolean deletable) {
        return new MatchDto(
                id, clubId, homeTeamId, homeTeamName, awayTeamId, awayTeamName, homeTeamLogoUrl, awayTeamLogoUrl,
                leagueId, seasonId, matchDate, venue, active, homeSideAnnounced, awaySideAnnounced, createdAt,
                updatedAt, updatedBy, homePickedCount, awayPickedCount, playingXiSize, polls, homeLeagueTeamId,
                awayLeagueTeamId, scoringUrl, streamingUrl, playingAreaId, playingAreaName,
                playingAreaVerificationStatus, playingAreaLatitude, playingAreaLongitude, playingAreaAccessLatitude,
                playingAreaAccessLongitude, playingAreaAccessNote, resultStatus, deletable);
    }
}
