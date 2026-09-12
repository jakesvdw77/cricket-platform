package com.cricketlegend.service.impl;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueAffiliation;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.CreateLeagueAffiliationRequest;
import com.cricketlegend.dto.LeagueAffiliationDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.LeagueAffiliationMapper;
import com.cricketlegend.repository.LeagueAffiliationRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.LeagueAffiliationService;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/029-league-management.md: {@code list}/{@code create}/{@code
 * unaffiliate} all first verify {@code leagueId} belongs to {@code clubId} ({@link
 * #findLeagueOrThrowForClub}); {@code create} additionally verifies {@code teamId}/{@code
 * seasonId} each belong to the SAME {@code clubId} ({@link #findTeamOrThrowForClub}/{@link
 * #findSeasonOrThrowForClub}) — since every {@code League} here is club-owned and every {@code
 * Team} a club affiliates is that same club's own {@code Team} (a mismatch on either FK reads as
 * {@code NotFoundException}, not a {@code 400}/{@code 403} — mirrors {@code
 * TeamSponsorServiceImpl}'s identical isolation posture); a mismatch on either FK reads as {@code
 * NotFoundException}. {@code create} throws {@link ConflictException} if the exact {@code
 * (league, team, season)} triple already exists; {@code unaffiliate} is always a hard delete of
 * the join row.
 */
@Service
public class LeagueAffiliationServiceImpl implements LeagueAffiliationService {

    private final LeagueRepository leagueRepository;
    private final TeamRepository teamRepository;
    private final SeasonRepository seasonRepository;
    private final LeagueAffiliationRepository leagueAffiliationRepository;
    private final LeagueAffiliationMapper leagueAffiliationMapper;

    public LeagueAffiliationServiceImpl(
            LeagueRepository leagueRepository,
            TeamRepository teamRepository,
            SeasonRepository seasonRepository,
            LeagueAffiliationRepository leagueAffiliationRepository,
            LeagueAffiliationMapper leagueAffiliationMapper) {
        this.leagueRepository = leagueRepository;
        this.teamRepository = teamRepository;
        this.seasonRepository = seasonRepository;
        this.leagueAffiliationRepository = leagueAffiliationRepository;
        this.leagueAffiliationMapper = leagueAffiliationMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeagueAffiliationDto> list(UUID clubId, UUID leagueId) {
        findLeagueOrThrowForClub(clubId, leagueId);
        return leagueAffiliationRepository.findByLeagueId(leagueId).stream()
                .map(leagueAffiliationMapper::toDto)
                .toList();
    }

    @Override
    @Transactional
    public LeagueAffiliationDto create(
            UUID clubId, UUID leagueId, CreateLeagueAffiliationRequest request) {
        findLeagueOrThrowForClub(clubId, leagueId);
        findTeamOrThrowForClub(clubId, request.teamId());
        findSeasonOrThrowForClub(clubId, request.seasonId());

        if (leagueAffiliationRepository.existsByLeagueIdAndTeamIdAndSeasonId(
                leagueId, request.teamId(), request.seasonId())) {
            throw new ConflictException(
                    "Team " + request.teamId() + " is already affiliated to league " + leagueId
                            + " for season " + request.seasonId());
        }

        LeagueAffiliation affiliation = LeagueAffiliation.builder()
                .leagueId(leagueId)
                .teamId(request.teamId())
                .seasonId(request.seasonId())
                .build();

        return leagueAffiliationMapper.toDto(leagueAffiliationRepository.save(affiliation));
    }

    @Override
    @Transactional
    public void unaffiliate(UUID clubId, UUID leagueId, UUID affiliationId) {
        findLeagueOrThrowForClub(clubId, leagueId);

        LeagueAffiliation affiliation = leagueAffiliationRepository
                .findById(affiliationId)
                .orElseThrow(
                        () -> new NotFoundException("League affiliation not found: " + affiliationId));
        if (!affiliation.getLeagueId().equals(leagueId)) {
            throw new NotFoundException("League affiliation not found: " + affiliationId);
        }

        leagueAffiliationRepository.delete(affiliation);
    }

    private League findLeagueOrThrowForClub(UUID clubId, UUID leagueId) {
        League league = leagueRepository
                .findById(leagueId)
                .orElseThrow(() -> new NotFoundException("League not found: " + leagueId));
        if (!league.getClubId().equals(clubId)) {
            throw new NotFoundException("League not found: " + leagueId);
        }
        return league;
    }

    private Team findTeamOrThrowForClub(UUID clubId, UUID teamId) {
        Team team = teamRepository
                .findById(teamId)
                .orElseThrow(() -> new NotFoundException("Team not found: " + teamId));
        if (!team.getClubId().equals(clubId)) {
            throw new NotFoundException("Team not found: " + teamId);
        }
        return team;
    }

    private Season findSeasonOrThrowForClub(UUID clubId, UUID seasonId) {
        Season season = seasonRepository
                .findById(seasonId)
                .orElseThrow(() -> new NotFoundException("Season not found: " + seasonId));
        if (!season.getClubId().equals(clubId)) {
            throw new NotFoundException("Season not found: " + seasonId);
        }
        return season;
    }
}
