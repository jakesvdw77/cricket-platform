package com.cricketlegend.service.impl;

import com.cricketlegend.domain.LeaguePlayingConditions;
import com.cricketlegend.dto.LeaguePlayingConditionsDto;
import com.cricketlegend.dto.MediaUploadResponse;
import com.cricketlegend.dto.UpdateLeaguePlayingConditionsRequest;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LeaguePlayingConditionsMapper;
import com.cricketlegend.repository.LeaguePlayingConditionsRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.service.LeaguePlayingConditionsService;
import com.cricketlegend.service.MediaService;
import com.cricketlegend.service.support.LeagueSeasonAccessValidation;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Business rules per docs/specs/050-league-schedule-and-fixtures.md and
 * docs/specs/052-league-playing-conditions.md: {@code leagueId}/{@code seasonId} must each belong
 * to {@code clubId} — enforced via the shared {@link LeagueSeasonAccessValidation} helper also
 * used by {@code MatchServiceImpl.validateLeagueAndSeason} (extracted per
 * docs/standards/backend.md's "shared logic lives in one place" rule, found in standards review),
 * except {@code leagueId} is always required here (unlike {@code Match}'s optional one). {@link
 * #upload} and {@link #update} are both upserts against the row's own unique {@code (league_id,
 * season_id)} key, sharing the lookup-or-build logic in {@link #findOrCreate} — a re-upload
 * replaces {@code documentUrl}/{@code uploadedAt}/{@code uploadedBy} on the existing row (same
 * {@code id}) rather than creating a second one, deliberately no version history (see 050's
 * Non-goals); an {@link #update} leaves those same PDF fields untouched on the existing row.
 * PDF-only allowlist ({@code application/pdf}) enforced via {@link MediaService#upload(
 * MultipartFile, Map)}'s 2-arg overload, reusing the same storage plumbing every image-upload
 * caller already uses.
 */
@Service
public class LeaguePlayingConditionsServiceImpl implements LeaguePlayingConditionsService {

    private static final Map<String, String> ALLOWED_CONTENT_TYPES = Map.of("application/pdf", ".pdf");

    private final LeagueRepository leagueRepository;
    private final SeasonRepository seasonRepository;
    private final LeaguePlayingConditionsRepository leaguePlayingConditionsRepository;
    private final MediaService mediaService;
    private final LeaguePlayingConditionsMapper leaguePlayingConditionsMapper;

    public LeaguePlayingConditionsServiceImpl(
            LeagueRepository leagueRepository,
            SeasonRepository seasonRepository,
            LeaguePlayingConditionsRepository leaguePlayingConditionsRepository,
            MediaService mediaService,
            LeaguePlayingConditionsMapper leaguePlayingConditionsMapper) {
        this.leagueRepository = leagueRepository;
        this.seasonRepository = seasonRepository;
        this.leaguePlayingConditionsRepository = leaguePlayingConditionsRepository;
        this.mediaService = mediaService;
        this.leaguePlayingConditionsMapper = leaguePlayingConditionsMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public LeaguePlayingConditionsDto get(UUID clubId, UUID leagueId, UUID seasonId) {
        validateLeagueAndSeason(clubId, leagueId, seasonId);
        return leaguePlayingConditionsRepository
                .findByLeagueIdAndSeasonId(leagueId, seasonId)
                .map(leaguePlayingConditionsMapper::toDto)
                .orElseThrow(() -> new NotFoundException("Playing conditions not found"));
    }

    @Override
    @Transactional
    public LeaguePlayingConditionsDto upload(
            UUID clubId, UUID leagueId, UUID seasonId, MultipartFile file, UUID uploadedBy) {
        validateLeagueAndSeason(clubId, leagueId, seasonId);

        MediaUploadResponse uploadResponse = mediaService.upload(file, ALLOWED_CONTENT_TYPES);

        LeaguePlayingConditions playingConditions = findOrCreate(leagueId, seasonId);
        playingConditions.setDocumentUrl(uploadResponse.url());
        playingConditions.setUploadedAt(Instant.now());
        playingConditions.setUploadedBy(uploadedBy);

        return leaguePlayingConditionsMapper.toDto(leaguePlayingConditionsRepository.save(playingConditions));
    }

    @Override
    @Transactional
    public LeaguePlayingConditionsDto update(
            UUID clubId, UUID leagueId, UUID seasonId, UpdateLeaguePlayingConditionsRequest request) {
        validateLeagueAndSeason(clubId, leagueId, seasonId);
        validateStructuredFields(request);

        LeaguePlayingConditions playingConditions = findOrCreate(leagueId, seasonId);
        playingConditions.setMaxOversPerInnings(request.maxOversPerInnings());
        playingConditions.setPowerplayOvers(request.powerplayOvers());
        playingConditions.setMaxOversPerBowler(request.maxOversPerBowler());
        playingConditions.setFieldingRestrictionsNotes(request.fieldingRestrictionsNotes());
        playingConditions.setAllowSubstitutions(request.allowSubstitutions());
        playingConditions.setPointsForWin(request.pointsForWin());
        playingConditions.setPointsForLoss(request.pointsForLoss());
        playingConditions.setPointsForDraw(request.pointsForDraw());
        playingConditions.setPointsForNoResult(request.pointsForNoResult());
        playingConditions.setPointsForForfeitWin(request.pointsForForfeitWin());
        playingConditions.setBonusPointsEnabled(request.bonusPointsEnabled());
        if (request.bonusPointsEnabled()) {
            playingConditions.setBonusBattingOversThreshold(request.bonusBattingOversThreshold());
            playingConditions.setBonusBowlingRestrictionPercentage(request.bonusBowlingRestrictionPercentage());
        } else {
            // Deliberate: never carry stale threshold values from a since-disabled bonus rule —
            // see docs/specs/052-league-playing-conditions.md's Data Model Changes.
            playingConditions.setBonusBattingOversThreshold(null);
            playingConditions.setBonusBowlingRestrictionPercentage(null);
        }
        playingConditions.setAdditionalNotes(request.additionalNotes());

        return leaguePlayingConditionsMapper.toDto(leaguePlayingConditionsRepository.save(playingConditions));
    }

    /**
     * Cross-field rules that aren't expressible as bean validation on {@link
     * UpdateLeaguePlayingConditionsRequest} — see docs/specs/052-league-playing-conditions.md's
     * Data Model Changes / API Contract.
     */
    private void validateStructuredFields(UpdateLeaguePlayingConditionsRequest request) {
        if (request.powerplayOvers() > request.maxOversPerInnings()) {
            throw new ValidationException("Powerplay overs cannot exceed max overs per innings");
        }
        if (request.maxOversPerBowler() != null
                && request.maxOversPerBowler() > request.maxOversPerInnings()) {
            throw new ValidationException("Max overs per bowler cannot exceed max overs per innings");
        }
        if (request.bonusPointsEnabled()
                && (request.bonusBattingOversThreshold() == null
                        || request.bonusBowlingRestrictionPercentage() == null)) {
            throw new ValidationException(
                    "Both bonus threshold fields are required when bonus points are enabled");
        }
        if (request.bonusBattingOversThreshold() != null
                && request.bonusBattingOversThreshold() > request.maxOversPerInnings()) {
            throw new ValidationException(
                    "Bonus batting overs threshold cannot exceed max overs per innings");
        }
    }

    /**
     * Shared lookup-or-build helper for the row's unique {@code (league_id, season_id)} key, used
     * by both {@link #upload} and {@link #update} per docs/standards/backend.md's "shared logic
     * lives in one place" rule.
     */
    private LeaguePlayingConditions findOrCreate(UUID leagueId, UUID seasonId) {
        return leaguePlayingConditionsRepository
                .findByLeagueIdAndSeasonId(leagueId, seasonId)
                .orElseGet(() -> LeaguePlayingConditions.builder()
                        .leagueId(leagueId)
                        .seasonId(seasonId)
                        .build());
    }

    /**
     * Same shared {@link LeagueSeasonAccessValidation} cross-club check {@code
     * MatchServiceImpl.validateLeagueAndSeason} also calls, except {@code leagueId} is always
     * required here (unlike {@code Match}'s optional one) — a mismatch on either FK reads as
     * {@link NotFoundException}, not a {@code 400}/{@code 403}.
     */
    private void validateLeagueAndSeason(UUID clubId, UUID leagueId, UUID seasonId) {
        LeagueSeasonAccessValidation.assertLeagueBelongsToClub(leagueRepository, leagueId, clubId);
        LeagueSeasonAccessValidation.assertSeasonBelongsToClub(seasonRepository, seasonId, clubId);
    }
}
