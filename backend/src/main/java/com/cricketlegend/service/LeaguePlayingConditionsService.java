package com.cricketlegend.service;

import com.cricketlegend.dto.LeaguePlayingConditionsDto;
import java.util.UUID;
import org.springframework.web.multipart.MultipartFile;

/**
 * A club's own Playing Conditions PDF document for a {@code (league, season)} pair — see
 * docs/specs/050-league-schedule-and-fixtures.md.
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
}
