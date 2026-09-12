package com.cricketlegend.service.impl;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.dto.CreateLeagueRequest;
import com.cricketlegend.dto.LeagueDto;
import com.cricketlegend.dto.UpdateLeagueRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LeagueMapper;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.service.LeagueService;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/029-league-management.md: {@code list} returns every league for a
 * club (active and inactive, not paginated — a deliberately small bounded collection, mirroring
 * {@code SponsorServiceImpl}); {@code create}/{@code update} default {@code source} to {@code
 * INTERNAL}, {@code maxPlayingXiSize} to 11, {@code allowSubstitutions} to {@code false} when the
 * request leaves them null, and validate {@code minAge <= maxAge} when both are set — ENFORCED
 * (unlike {@code Section.minAge}/{@code maxAge}, see the spec's Problem &amp; Goals divergence
 * note), though the enforcement itself lives in {@code MatchSideServiceImpl}, not here; {@code
 * deactivate}/{@code reactivate} mirror {@code SponsorServiceImpl}'s one-way transition-guard
 * shape; every lookup is scoped to the owning club, not just by id.
 */
@Service
public class LeagueServiceImpl implements LeagueService {

    private final LeagueRepository leagueRepository;
    private final LeagueMapper leagueMapper;

    public LeagueServiceImpl(LeagueRepository leagueRepository, LeagueMapper leagueMapper) {
        this.leagueRepository = leagueRepository;
        this.leagueMapper = leagueMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeagueDto> list(UUID clubId) {
        return leagueRepository.findByClubId(clubId).stream().map(leagueMapper::toDto).toList();
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
                .allowSubstitutions(
                        request.allowSubstitutions() != null && request.allowSubstitutions())
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
        league.setAllowSubstitutions(
                request.allowSubstitutions() != null && request.allowSubstitutions());
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
