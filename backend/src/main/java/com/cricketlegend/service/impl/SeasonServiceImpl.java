package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Season;
import com.cricketlegend.dto.CreateSeasonRequest;
import com.cricketlegend.dto.SeasonDto;
import com.cricketlegend.dto.SeasonSummaryDto;
import com.cricketlegend.dto.SeasonsSummaryDto;
import com.cricketlegend.dto.UpdateSeasonRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.SeasonMapper;
import com.cricketlegend.repository.LeagueAffiliationRepository;
import com.cricketlegend.repository.LeagueAffiliationRepository.SeasonCount;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchRepository.SeasonMatchCount;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.service.SeasonService;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/029-league-management.md: {@code list} returns every season for a
 * club (not paginated, a deliberately small bounded collection); {@code create}/{@code update}
 * validate {@code startDate <= endDate}; {@code deactivate}/{@code reactivate} mirror {@code
 * SponsorServiceImpl}'s one-way transition-guard shape; every lookup is scoped to the owning club.
 * Per docs/specs/094-club-structure-and-seasons.md: {@code summary} reads the club's seasons plus three grouped
 * queries (leagues, distinct own teams, active matches), so the statement count never depends on the season count.
 */
@Service
public class SeasonServiceImpl implements SeasonService {

    private final SeasonRepository seasonRepository;
    private final SeasonMapper seasonMapper;
    private final LeagueAffiliationRepository leagueAffiliationRepository;
    private final MatchRepository matchRepository;

    public SeasonServiceImpl(
            SeasonRepository seasonRepository,
            SeasonMapper seasonMapper,
            LeagueAffiliationRepository leagueAffiliationRepository,
            MatchRepository matchRepository) {
        this.seasonRepository = seasonRepository;
        this.seasonMapper = seasonMapper;
        this.leagueAffiliationRepository = leagueAffiliationRepository;
        this.matchRepository = matchRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<SeasonDto> list(UUID clubId) {
        return seasonRepository.findByClubId(clubId).stream().map(seasonMapper::toDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public SeasonsSummaryDto summary(Authentication authentication, UUID clubId) {
        List<UUID> seasonIds = seasonRepository.findByClubId(clubId).stream().map(Season::getId).toList();
        if (seasonIds.isEmpty()) {
            return new SeasonsSummaryDto(List.of());
        }
        // Every query is bounded by the club's own season ids and, for affiliations and matches, by the club id too.
        Map<UUID, Long> leagues = totals(leagueAffiliationRepository.countDistinctLeaguesBySeasonIds(clubId, seasonIds));
        Map<UUID, Long> teams = totals(leagueAffiliationRepository.countDistinctTeamsBySeasonIds(clubId, seasonIds));
        Map<UUID, Long> matches = new HashMap<>();
        for (SeasonMatchCount row : matchRepository.countActiveBySeasonIds(clubId, seasonIds)) {
            matches.put(row.getSeasonId(), row.getTotal());
        }
        List<SeasonSummaryDto> rows = seasonIds.stream()
                .map(id -> new SeasonSummaryDto(
                        id, leagues.getOrDefault(id, 0L), teams.getOrDefault(id, 0L), matches.getOrDefault(id, 0L)))
                .toList();
        return new SeasonsSummaryDto(rows);
    }

    private Map<UUID, Long> totals(List<SeasonCount> rows) {
        Map<UUID, Long> totals = new HashMap<>();
        for (SeasonCount row : rows) {
            totals.put(row.getSeasonId(), row.getTotal());
        }
        return totals;
    }

    @Override
    @Transactional
    public SeasonDto create(UUID clubId, CreateSeasonRequest request) {
        validateDateRange(request.startDate(), request.endDate());

        Season season = Season.builder()
                .clubId(clubId)
                .label(request.label())
                .startDate(request.startDate())
                .endDate(request.endDate())
                .active(true)
                .build();

        return seasonMapper.toDto(seasonRepository.save(season));
    }

    @Override
    @Transactional
    public SeasonDto update(UUID clubId, UUID seasonId, UpdateSeasonRequest request) {
        validateDateRange(request.startDate(), request.endDate());
        Season season = findOrThrowForClub(clubId, seasonId);

        season.setLabel(request.label());
        season.setStartDate(request.startDate());
        season.setEndDate(request.endDate());

        return seasonMapper.toDto(seasonRepository.save(season));
    }

    @Override
    @Transactional
    public SeasonDto deactivate(UUID clubId, UUID seasonId) {
        Season season = findOrThrowForClub(clubId, seasonId);
        if (!season.isActive()) {
            throw new InvalidStatusTransitionException("Season is already inactive: " + seasonId);
        }
        season.setActive(false);
        return seasonMapper.toDto(seasonRepository.save(season));
    }

    @Override
    @Transactional
    public SeasonDto reactivate(UUID clubId, UUID seasonId) {
        Season season = findOrThrowForClub(clubId, seasonId);
        if (season.isActive()) {
            throw new InvalidStatusTransitionException("Season is already active: " + seasonId);
        }
        season.setActive(true);
        return seasonMapper.toDto(seasonRepository.save(season));
    }

    private void validateDateRange(LocalDate startDate, LocalDate endDate) {
        if (startDate != null && endDate != null && startDate.isAfter(endDate)) {
            throw new ValidationException("startDate must be <= endDate");
        }
    }

    /**
     * 404s when {@code seasonId} doesn't exist at all, or exists but belongs to a different
     * club — real cross-club isolation at the data layer.
     */
    private Season findOrThrowForClub(UUID clubId, UUID seasonId) {
        Season season = seasonRepository
                .findById(seasonId)
                .orElseThrow(() -> new NotFoundException("Season not found: " + seasonId));
        if (!season.getClubId().equals(clubId)) {
            throw new NotFoundException("Season not found: " + seasonId);
        }
        return season;
    }
}
