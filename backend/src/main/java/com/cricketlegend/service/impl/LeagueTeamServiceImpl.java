package com.cricketlegend.service.impl;

import com.cricketlegend.domain.LeagueTeam;
import com.cricketlegend.dto.CopyLeagueTeamsRequest;
import com.cricketlegend.dto.CopyLeagueTeamsResponse;
import com.cricketlegend.dto.CreateLeagueTeamRequest;
import com.cricketlegend.dto.LeagueTeamDto;
import com.cricketlegend.dto.LeagueTeamRemoveOutcome;
import com.cricketlegend.dto.RemoveLeagueTeamResponse;
import com.cricketlegend.dto.SkippedLeagueTeamDto;
import com.cricketlegend.dto.UpdateLeagueTeamRequest;
import com.cricketlegend.exception.DuplicateLeagueTeamNameException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LeagueTeamMapper;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.LeagueTeamRepository;
import com.cricketlegend.repository.LeagueTeamRepository.ReferencedMatchCount;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.service.LeagueTeamService;
import com.cricketlegend.service.support.LeagueSeasonAccessValidation;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/070-league-teams.md: {@code leagueId}/{@code seasonId} must each
 * belong to {@code clubId} (shared {@link LeagueSeasonAccessValidation}, 404 on mismatch) and a
 * {@code leagueTeamId} must sit in that exact league and season; names are trimmed, non-blank and
 * unique by {@code lower(name)} within {@code (league, season)} counting inactive rows; an update
 * that changes name or logo rewrites the denormalised copy on every referencing {@code Match} in
 * the same transaction; {@code remove} deletes an unreferenced row and deactivates a referenced
 * one; {@code copy} creates independent rows (name/abbreviation/logo only) from a chosen subset of
 * another league/season of the same club, skipping duplicate names.
 */
@Service
public class LeagueTeamServiceImpl implements LeagueTeamService {

    static final String SKIP_REASON_DUPLICATE_NAME = "DUPLICATE_NAME";

    private final LeagueRepository leagueRepository;
    private final SeasonRepository seasonRepository;
    private final LeagueTeamRepository leagueTeamRepository;
    private final MatchRepository matchRepository;
    private final LeagueTeamMapper leagueTeamMapper;

    public LeagueTeamServiceImpl(
            LeagueRepository leagueRepository,
            SeasonRepository seasonRepository,
            LeagueTeamRepository leagueTeamRepository,
            MatchRepository matchRepository,
            LeagueTeamMapper leagueTeamMapper) {
        this.leagueRepository = leagueRepository;
        this.seasonRepository = seasonRepository;
        this.leagueTeamRepository = leagueTeamRepository;
        this.matchRepository = matchRepository;
        this.leagueTeamMapper = leagueTeamMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeagueTeamDto> list(UUID clubId, UUID leagueId, UUID seasonId, boolean activeOnly) {
        validateLeagueAndSeason(clubId, leagueId, seasonId);
        List<LeagueTeam> teams = activeOnly
                ? leagueTeamRepository.findActiveByLeagueAndSeason(leagueId, seasonId)
                : leagueTeamRepository.findByLeagueAndSeason(leagueId, seasonId);
        if (teams.isEmpty()) {
            return List.of();
        }
        Map<UUID, Long> counts = new HashMap<>();
        for (ReferencedMatchCount row : leagueTeamRepository.countReferencingMatches(
                teams.stream().map(LeagueTeam::getId).toList())) {
            counts.put(row.getLeagueTeamId(), row.getMatchCount());
        }
        return teams.stream().map(t -> toDto(t, counts.getOrDefault(t.getId(), 0L))).toList();
    }

    @Override
    @Transactional
    public LeagueTeamDto create(UUID clubId, UUID leagueId, UUID seasonId, CreateLeagueTeamRequest request) {
        validateLeagueAndSeason(clubId, leagueId, seasonId);
        String name = requireName(request.name());
        if (leagueTeamRepository.existsByLeagueIdAndSeasonIdAndNameIgnoreCase(leagueId, seasonId, name)) {
            throw duplicateName(name);
        }
        LeagueTeam saved = leagueTeamRepository.save(LeagueTeam.builder()
                .leagueId(leagueId)
                .seasonId(seasonId)
                .name(name)
                .abbreviation(blankToNull(request.abbreviation()))
                .logoUrl(blankToNull(request.logoUrl()))
                .active(true)
                .build());
        return toDto(saved, 0L);
    }

    @Override
    @Transactional
    public LeagueTeamDto update(
            UUID clubId, UUID leagueId, UUID seasonId, UUID leagueTeamId, UpdateLeagueTeamRequest request) {
        validateLeagueAndSeason(clubId, leagueId, seasonId);
        LeagueTeam team = findInLeagueSeason(leagueId, seasonId, leagueTeamId);
        String name = requireName(request.name());
        if (leagueTeamRepository.existsByLeagueIdAndSeasonIdAndNameIgnoreCaseAndIdNot(
                leagueId, seasonId, name, leagueTeamId)) {
            throw duplicateName(name);
        }
        String logoUrl = blankToNull(request.logoUrl());
        boolean nameOrLogoChanged = !Objects.equals(team.getName(), name) || !Objects.equals(team.getLogoUrl(), logoUrl);

        team.setName(name);
        team.setAbbreviation(blankToNull(request.abbreviation()));
        team.setLogoUrl(logoUrl);
        LeagueTeam saved = leagueTeamRepository.save(team);

        if (nameOrLogoChanged) {
            // Both queries flush pending changes first and clear the persistence context after,
            // so `saved` is already written when the matches are rewritten.
            Instant now = Instant.now();
            matchRepository.propagateLeagueTeamToHomeSide(leagueTeamId, name, logoUrl, now);
            matchRepository.propagateLeagueTeamToAwaySide(leagueTeamId, name, logoUrl, now);
        }
        return toDto(saved, referencedCount(leagueTeamId));
    }

    @Override
    @Transactional
    public LeagueTeamDto deactivate(UUID clubId, UUID leagueId, UUID seasonId, UUID leagueTeamId) {
        validateLeagueAndSeason(clubId, leagueId, seasonId);
        LeagueTeam team = findInLeagueSeason(leagueId, seasonId, leagueTeamId);
        if (!team.isActive()) {
            throw new InvalidStatusTransitionException("League team is already inactive: " + leagueTeamId);
        }
        team.setActive(false);
        return toDto(leagueTeamRepository.save(team), referencedCount(leagueTeamId));
    }

    @Override
    @Transactional
    public LeagueTeamDto reactivate(UUID clubId, UUID leagueId, UUID seasonId, UUID leagueTeamId) {
        validateLeagueAndSeason(clubId, leagueId, seasonId);
        LeagueTeam team = findInLeagueSeason(leagueId, seasonId, leagueTeamId);
        if (team.isActive()) {
            throw new InvalidStatusTransitionException("League team is already active: " + leagueTeamId);
        }
        team.setActive(true);
        return toDto(leagueTeamRepository.save(team), referencedCount(leagueTeamId));
    }

    @Override
    @Transactional
    public RemoveLeagueTeamResponse remove(UUID clubId, UUID leagueId, UUID seasonId, UUID leagueTeamId) {
        validateLeagueAndSeason(clubId, leagueId, seasonId);
        LeagueTeam team = findInLeagueSeason(leagueId, seasonId, leagueTeamId);
        if (!leagueTeamRepository.existsReference(leagueTeamId)) {
            leagueTeamRepository.delete(team);
            return new RemoveLeagueTeamResponse(LeagueTeamRemoveOutcome.DELETED, null);
        }
        team.setActive(false);
        LeagueTeam saved = leagueTeamRepository.save(team);
        return new RemoveLeagueTeamResponse(
                LeagueTeamRemoveOutcome.DEACTIVATED, toDto(saved, referencedCount(leagueTeamId)));
    }

    @Override
    @Transactional
    public CopyLeagueTeamsResponse copy(UUID clubId, UUID leagueId, UUID seasonId, CopyLeagueTeamsRequest request) {
        validateLeagueAndSeason(clubId, leagueId, seasonId);
        LeagueSeasonAccessValidation.assertLeagueBelongsToClub(leagueRepository, request.sourceLeagueId(), clubId);
        LeagueSeasonAccessValidation.assertSeasonBelongsToClub(seasonRepository, request.sourceSeasonId(), clubId);
        if (request.leagueTeamIds() == null || request.leagueTeamIds().isEmpty()) {
            throw new ValidationException("leagueTeamIds must not be empty");
        }

        Set<UUID> requestedIds = new LinkedHashSet<>(request.leagueTeamIds());
        Map<UUID, LeagueTeam> sourceById = new HashMap<>();
        leagueTeamRepository.findAllById(requestedIds).forEach(t -> sourceById.put(t.getId(), t));
        List<LeagueTeam> sources = new ArrayList<>();
        for (UUID id : requestedIds) {
            LeagueTeam source = sourceById.get(id);
            if (source == null
                    || !source.getLeagueId().equals(request.sourceLeagueId())
                    || !source.getSeasonId().equals(request.sourceSeasonId())) {
                throw new ValidationException("League team " + id + " is not in the source league and season");
            }
            sources.add(source);
        }

        Set<String> takenNames = new HashSet<>();
        for (LeagueTeam existing : leagueTeamRepository.findByLeagueAndSeason(leagueId, seasonId)) {
            takenNames.add(nameKey(existing.getName()));
        }

        List<LeagueTeam> toCreate = new ArrayList<>();
        List<SkippedLeagueTeamDto> skipped = new ArrayList<>();
        for (LeagueTeam source : sources) {
            if (!takenNames.add(nameKey(source.getName()))) {
                skipped.add(new SkippedLeagueTeamDto(source.getName(), SKIP_REASON_DUPLICATE_NAME));
                continue;
            }
            toCreate.add(LeagueTeam.builder()
                    .leagueId(leagueId)
                    .seasonId(seasonId)
                    .name(source.getName())
                    .abbreviation(source.getAbbreviation())
                    .logoUrl(source.getLogoUrl())
                    .active(true)
                    .build());
        }
        List<LeagueTeamDto> created = leagueTeamRepository.saveAll(toCreate).stream()
                .map(t -> toDto(t, 0L))
                .toList();
        return new CopyLeagueTeamsResponse(created, skipped);
    }

    private LeagueTeamDto toDto(LeagueTeam team, long referencedByMatchCount) {
        return leagueTeamMapper.toDto(team, referencedByMatchCount);
    }

    private long referencedCount(UUID leagueTeamId) {
        return leagueTeamRepository.countReferencingMatches(List.of(leagueTeamId)).stream()
                .mapToLong(ReferencedMatchCount::getMatchCount)
                .sum();
    }

    /** 404 when absent or not in this exact league and season (club already validated). */
    private LeagueTeam findInLeagueSeason(UUID leagueId, UUID seasonId, UUID leagueTeamId) {
        LeagueTeam team = leagueTeamRepository
                .findById(leagueTeamId)
                .orElseThrow(() -> new NotFoundException("League team not found: " + leagueTeamId));
        if (!team.getLeagueId().equals(leagueId) || !team.getSeasonId().equals(seasonId)) {
            throw new NotFoundException("League team not found: " + leagueTeamId);
        }
        return team;
    }

    private void validateLeagueAndSeason(UUID clubId, UUID leagueId, UUID seasonId) {
        LeagueSeasonAccessValidation.assertLeagueBelongsToClub(leagueRepository, leagueId, clubId);
        LeagueSeasonAccessValidation.assertSeasonBelongsToClub(seasonRepository, seasonId, clubId);
    }

    private String requireName(String rawName) {
        String name = rawName == null ? "" : rawName.trim();
        if (name.isEmpty()) {
            throw new ValidationException("name must not be blank");
        }
        return name;
    }

    private DuplicateLeagueTeamNameException duplicateName(String name) {
        return new DuplicateLeagueTeamNameException(
                "A league team named '" + name + "' already exists in this league and season "
                        + "(reactivate it if it was deactivated)");
    }

    private String nameKey(String name) {
        return name.toLowerCase(Locale.ROOT);
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
