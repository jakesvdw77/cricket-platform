package com.cricketlegend.service.impl;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeaguePlayingConditions;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Season;
import com.cricketlegend.dto.CreateLeagueRequest;
import com.cricketlegend.dto.LeagueDto;
import com.cricketlegend.dto.UpdateLeagueRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LeagueMapper;
import com.cricketlegend.repository.LeagueAffiliationRepository;
import com.cricketlegend.repository.LeagueAffiliationRepository.LeagueTeamCount;
import com.cricketlegend.repository.LeaguePlayingConditionsRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.service.LeagueService;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/029-league-management.md: {@code list} returns every league for a
 * club (active and inactive, not paginated — a deliberately small bounded collection, mirroring
 * {@code SponsorServiceImpl}); {@code create}/{@code update} default {@code source} to {@code
 * INTERNAL}, {@code maxPlayingXiSize} to 11 when the request leaves them null, and validate {@code
 * minAge <= maxAge} when both are set — ENFORCED
 * (unlike {@code Section.minAge}/{@code maxAge}, see the spec's Problem &amp; Goals divergence
 * note), though the enforcement itself lives in {@code MatchSideServiceImpl}, not here; {@code
 * deactivate}/{@code reactivate} mirror {@code SponsorServiceImpl}'s one-way transition-guard
 * shape; every lookup is scoped to the owning club, not just by id. Per
 * docs/specs/050-league-schedule-and-fixtures.md: {@code list} also resolves the club's own
 * "current" {@link Season} once ({@link #resolveCurrentSeasonId}) and batch-computes each league's
 * {@code currentSeasonTeamCount}/{@code currentSeasonLabel}/{@code
 * currentSeasonPlayingConditionsUrl} in one round trip each (never per-league), reconstructing
 * each {@link LeagueDto} via {@link #withCurrentSeasonFields}.
 */
@Service
public class LeagueServiceImpl implements LeagueService {

    private final LeagueRepository leagueRepository;
    private final SeasonRepository seasonRepository;
    private final LeagueAffiliationRepository leagueAffiliationRepository;
    private final LeaguePlayingConditionsRepository leaguePlayingConditionsRepository;
    private final LeagueMapper leagueMapper;

    public LeagueServiceImpl(
            LeagueRepository leagueRepository,
            SeasonRepository seasonRepository,
            LeagueAffiliationRepository leagueAffiliationRepository,
            LeaguePlayingConditionsRepository leaguePlayingConditionsRepository,
            LeagueMapper leagueMapper) {
        this.leagueRepository = leagueRepository;
        this.seasonRepository = seasonRepository;
        this.leagueAffiliationRepository = leagueAffiliationRepository;
        this.leaguePlayingConditionsRepository = leaguePlayingConditionsRepository;
        this.leagueMapper = leagueMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeagueDto> list(UUID clubId) {
        List<League> leagues = leagueRepository.findByClubId(clubId);
        List<Season> seasons = seasonRepository.findByClubId(clubId);
        UUID currentSeasonId = resolveCurrentSeasonId(seasons);

        if (currentSeasonId == null) {
            return leagues.stream()
                    .map(league -> withCurrentSeasonFields(league, 0, null, null))
                    .toList();
        }

        Map<UUID, Long> teamCountByLeagueId = new HashMap<>();
        for (LeagueTeamCount row : leagueAffiliationRepository.countDistinctTeamsBySeasonId(currentSeasonId)) {
            teamCountByLeagueId.put(row.getLeagueId(), row.getTeamCount());
        }
        Map<UUID, String> documentUrlByLeagueId = new HashMap<>();
        for (LeaguePlayingConditions playingConditions :
                leaguePlayingConditionsRepository.findBySeasonId(currentSeasonId)) {
            documentUrlByLeagueId.put(playingConditions.getLeagueId(), playingConditions.getDocumentUrl());
        }
        String currentSeasonLabel = seasons.stream()
                .filter(season -> season.getId().equals(currentSeasonId))
                .findFirst()
                .map(Season::getLabel)
                .orElse(null);

        return leagues.stream()
                .map(league -> withCurrentSeasonFields(
                        league,
                        teamCountByLeagueId.getOrDefault(league.getId(), 0L).intValue(),
                        currentSeasonLabel,
                        documentUrlByLeagueId.get(league.getId())))
                .toList();
    }

    /**
     * Maps {@code league} via MapStruct, then reconstructs the record adding the three computed
     * "current season" fields — the same pattern {@code MatchServiceImpl.enrichAnnounced} uses for
     * {@code homeSideAnnounced}/{@code awaySideAnnounced}.
     */
    private LeagueDto withCurrentSeasonFields(
            League league, int currentSeasonTeamCount, String currentSeasonLabel, String currentSeasonPlayingConditionsUrl) {
        LeagueDto dto = leagueMapper.toDto(league);
        return new LeagueDto(
                dto.id(), dto.clubId(), dto.name(), dto.source(), dto.maxPlayingXiSize(),
                dto.minAge(), dto.maxAge(), dto.ageCutoffDate(), dto.active(), dto.createdAt(), dto.updatedAt(),
                dto.updatedBy(), currentSeasonTeamCount, currentSeasonLabel, currentSeasonPlayingConditionsUrl);
    }

    /**
     * The club's own "current" {@link Season} — the season whose {@code [startDate, endDate]}
     * range contains today, else the most-recently-created season, else {@code null} when the club
     * has zero seasons. Ported from {@code ui/src/utils/defaultSeason.ts}'s {@code
     * pickDefaultSeasonId} — keep the two definitions in lockstep; a change to one rule is a change
     * to both. See docs/specs/050-league-schedule-and-fixtures.md.
     */
    private UUID resolveCurrentSeasonId(List<Season> seasons) {
        if (seasons.isEmpty()) {
            return null;
        }
        LocalDate today = LocalDate.now();
        return seasons.stream()
                .filter(season -> !season.getStartDate().isAfter(today) && !season.getEndDate().isBefore(today))
                .findFirst()
                .map(Season::getId)
                .orElseGet(() -> seasons.stream()
                        .max(Comparator.comparing(Season::getCreatedAt))
                        .map(Season::getId)
                        .orElse(null));
    }

    @Override
    @Transactional
    public LeagueDto create(UUID clubId, CreateLeagueRequest request) {
        validateAgeRange(request.minAge(), request.maxAge());

        League league = League.builder()
                .clubId(clubId)
                .name(request.name())
                .source(request.source() != null ? request.source() : LeagueSource.INTERNAL)
                .maxPlayingXiSize(request.maxPlayingXiSize() != null ? request.maxPlayingXiSize() : 11)
                .minAge(request.minAge())
                .maxAge(request.maxAge())
                .ageCutoffDate(request.ageCutoffDate())
                .active(true)
                .build();

        return leagueMapper.toDto(leagueRepository.save(league));
    }

    @Override
    @Transactional
    public LeagueDto update(UUID clubId, UUID leagueId, UpdateLeagueRequest request) {
        validateAgeRange(request.minAge(), request.maxAge());
        League league = findOrThrowForClub(clubId, leagueId);

        league.setName(request.name());
        league.setSource(request.source() != null ? request.source() : LeagueSource.INTERNAL);
        league.setMaxPlayingXiSize(
                request.maxPlayingXiSize() != null ? request.maxPlayingXiSize() : 11);
        league.setMinAge(request.minAge());
        league.setMaxAge(request.maxAge());
        league.setAgeCutoffDate(request.ageCutoffDate());

        return leagueMapper.toDto(leagueRepository.save(league));
    }

    @Override
    @Transactional
    public LeagueDto deactivate(UUID clubId, UUID leagueId) {
        League league = findOrThrowForClub(clubId, leagueId);
        if (!league.isActive()) {
            throw new InvalidStatusTransitionException("League is already inactive: " + leagueId);
        }
        league.setActive(false);
        return leagueMapper.toDto(leagueRepository.save(league));
    }

    @Override
    @Transactional
    public LeagueDto reactivate(UUID clubId, UUID leagueId) {
        League league = findOrThrowForClub(clubId, leagueId);
        if (league.isActive()) {
            throw new InvalidStatusTransitionException("League is already active: " + leagueId);
        }
        league.setActive(true);
        return leagueMapper.toDto(leagueRepository.save(league));
    }

    private void validateAgeRange(Integer minAge, Integer maxAge) {
        if (minAge != null && maxAge != null && minAge > maxAge) {
            throw new ValidationException("minAge must be <= maxAge");
        }
    }

    /**
     * 404s when {@code leagueId} doesn't exist at all, or exists but belongs to a different
     * club — real cross-club isolation at the data layer, not only relying on the controller's
     * {@code @PreAuthorize}.
     */
    private League findOrThrowForClub(UUID clubId, UUID leagueId) {
        League league = leagueRepository
                .findById(leagueId)
                .orElseThrow(() -> new NotFoundException("League not found: " + leagueId));
        if (!league.getClubId().equals(clubId)) {
            throw new NotFoundException("League not found: " + leagueId);
        }
        return league;
    }
}
