package com.cricketlegend.service;

import com.cricketlegend.dto.LeaguePlayingConditionsDto;
import com.cricketlegend.dto.UpdateLeaguePlayingConditionsRequest;
import java.util.UUID;
import org.springframework.web.multipart.MultipartFile;

/**
 * A club's own Playing Conditions record for a {@code (league, season)} pair — the uploaded PDF
 * document (docs/specs/050-league-schedule-and-fixtures.md) and the structured match-format/
 * points/bonus-points fields (docs/specs/052-league-playing-conditions.md).
 */
public interface LeaguePlayingConditionsService {

    /**
     * The current Playing Conditions document for {@code (leagueId, seasonId)}. {@code leagueId}/
     * {@code seasonId} must each belong to {@code clubId} (404 otherwise); throws {@link
     * com.cricketlegend.exception.NotFoundException} when nothing has been uploaded yet for this
     * pair.
     */
    LeaguePlayingConditionsDto get(UUID clubId, UUID leagueId, UUID seasonId);

    /**
     * Uploads {@code file} (PDF-only) as the current Playing Conditions document for {@code
     * (leagueId, seasonId)} — creates the row on first upload, replaces {@code documentUrl}/{@code
     * uploadedAt}/{@code uploadedBy} in place (same row, same {@code id}) on every subsequent one.
     * {@code leagueId}/{@code seasonId} must each belong to {@code clubId} (404 otherwise). Throws
     * {@link com.cricketlegend.exception.UnsupportedMediaTypeException} if {@code file} isn't
     * {@code application/pdf}.
     */
    LeaguePlayingConditionsDto upload(
            UUID clubId, UUID leagueId, UUID seasonId, MultipartFile file, UUID uploadedBy);

    /**
     * Creates or updates the structured Match Format / Points System / Bonus Points / Additional
     * Notes fields for {@code (leagueId, seasonId)} — creates the row on first save if none
     * exists yet (an upsert, same posture as {@link #upload}), otherwise updates the structured
     * fields on the existing row in place, leaving {@code documentUrl}/{@code uploadedAt}/{@code
     * uploadedBy} untouched. {@code leagueId}/{@code seasonId} must each belong to {@code clubId}
     * (404 otherwise). Throws {@link com.cricketlegend.exception.ValidationException} when {@code
     * request.powerplayOvers() > request.maxOversPerInnings()}, {@code
     * request.maxOversPerBowler() > request.maxOversPerInnings()} when set, {@code
     * request.bonusPointsEnabled()} is {@code true} with either threshold field null, or {@code
     * request.bonusBattingOversThreshold() > request.maxOversPerInnings()} when set. When {@code
     * request.bonusPointsEnabled()} is {@code false}, both bonus threshold fields are persisted as
     * {@code null} regardless of what the request sent.
     */
    LeaguePlayingConditionsDto update(
            UUID clubId, UUID leagueId, UUID seasonId, UpdateLeaguePlayingConditionsRequest request);
}
