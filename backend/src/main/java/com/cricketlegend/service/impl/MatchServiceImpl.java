package com.cricketlegend.service.impl;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Season;
import com.cricketlegend.dto.CreateMatchRequest;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.UpdateMatchRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.MatchMapper;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.MatchService;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/029-league-management.md: {@code list} is the first paginated
 * endpoint in this feature area (default sort {@code matchDate} descending when the caller
 * specifies none, mirroring {@code LeadServiceImpl.withDefaultSort}); {@code create}/{@code
 * update} validate exactly-one-of-team-id/team-name per side ({@link
 * #validateExactlyOneOfIdOrName}) ahead of the DB {@code CHECK} constraints, that {@code leagueId}
 * (when set)/{@code seasonId} each belong to {@code clubId}, and that {@code homeTeamId}/{@code
 * awayTeamId} (when set) reference a real {@code Team} of ANY club (cross-club references are
 * allowed for a real inter-club fixture); {@code club_id} saved on the {@link Match} is ALWAYS
 * {@code clubId} — the acting/creating club from the URL — NEVER derived from {@code
 * homeTeamId}'s own club, a deliberate conservative call (see the spec's dedicated Data Model
 * Changes note); {@code deactivate}/{@code reactivate} mirror every other entity's one-way
 * transition-guard shape.
 */
@Service
public class MatchServiceImpl implements MatchService {

    private final MatchRepository matchRepository;
    private final LeagueRepository leagueRepository;
    private final SeasonRepository seasonRepository;
    private final TeamRepository teamRepository;
    private final MatchMapper matchMapper;

    public MatchServiceImpl(
            MatchRepository matchRepository,
            LeagueRepository leagueRepository,
            SeasonRepository seasonRepository,
            TeamRepository teamRepository,
            MatchMapper matchMapper) {
        this.matchRepository = matchRepository;
        this.leagueRepository = leagueRepository;
        this.seasonRepository = seasonRepository;
        this.teamRepository = teamRepository;
        this.matchMapper = matchMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<MatchDto> list(UUID clubId, Pageable pageable) {
        return matchRepository.findByClubId(clubId, withDefaultSort(pageable)).map(matchMapper::toDto);
    }

    @Override
    @Transactional(readOnly = true)
    public MatchDto get(UUID clubId, UUID matchId) {
        return matchMapper.toDto(findOrThrowForClub(clubId, matchId));
    }

    @Override
    @Transactional
    public MatchDto create(UUID clubId, CreateMatchRequest request) {
        validateSides(request.homeTeamId(), request.homeTeamName(), request.awayTeamId(), request.awayTeamName());
        validateLeagueAndSeason(clubId, request.leagueId(), request.seasonId());
        validateTeamReferences(request.homeTeamId(), request.awayTeamId());

        Match match = Match.builder()
                .clubId(clubId)
                .homeTeamId(request.homeTeamId())
                .homeTeamName(request.homeTeamName())
                .awayTeamId(request.awayTeamId())
                .awayTeamName(request.awayTeamName())
                .leagueId(request.leagueId())
                .seasonId(request.seasonId())
                .matchDate(request.matchDate())
                .venue(request.venue())
                .active(true)
                .build();

        return matchMapper.toDto(matchRepository.save(match));
    }

    @Override
    @Transactional
    public MatchDto update(UUID clubId, UUID matchId, UpdateMatchRequest request) {
        validateSides(request.homeTeamId(), request.homeTeamName(), request.awayTeamId(), request.awayTeamName());
        validateLeagueAndSeason(clubId, request.leagueId(), request.seasonId());
        validateTeamReferences(request.homeTeamId(), request.awayTeamId());

        Match match = findOrThrowForClub(clubId, matchId);
        match.setHomeTeamId(request.homeTeamId());
        match.setHomeTeamName(request.homeTeamName());
        match.setAwayTeamId(request.awayTeamId());
        match.setAwayTeamName(request.awayTeamName());
        match.setLeagueId(request.leagueId());
        match.setSeasonId(request.seasonId());
        match.setMatchDate(request.matchDate());
        match.setVenue(request.venue());

        return matchMapper.toDto(matchRepository.save(match));
    }

    @Override
    @Transactional
    public MatchDto deactivate(UUID clubId, UUID matchId) {
        Match match = findOrThrowForClub(clubId, matchId);
        if (!match.isActive()) {
            throw new InvalidStatusTransitionException("Match is already inactive: " + matchId);
        }
        match.setActive(false);
        return matchMapper.toDto(matchRepository.save(match));
    }

    @Override
    @Transactional
    public MatchDto reactivate(UUID clubId, UUID matchId) {
        Match match = findOrThrowForClub(clubId, matchId);
        if (match.isActive()) {
            throw new InvalidStatusTransitionException("Match is already active: " + matchId);
        }
        match.setActive(true);
        return matchMapper.toDto(matchRepository.save(match));
    }

    private Pageable withDefaultSort(Pageable pageable) {
        if (pageable.getSort().isSorted()) {
            return pageable;
        }
        return PageRequest.of(
                pageable.getPageNumber(), pageable.getPageSize(), Sort.by("matchDate").descending());
    }

    private void validateSides(UUID homeTeamId, String homeTeamName, UUID awayTeamId, String awayTeamName) {
        validateExactlyOneOfIdOrName(homeTeamId, homeTeamName, "home");
        validateExactlyOneOfIdOrName(awayTeamId, awayTeamName, "away");
    }

    private void validateExactlyOneOfIdOrName(UUID teamId, String teamName, String side) {
        boolean hasId = teamId != null;
        boolean hasName = teamName != null && !teamName.isBlank();
        if (hasId == hasName) {
            throw new ValidationException(
                    "Exactly one of " + side + "TeamId/" + side + "TeamName must be set");
        }
    }

    private void validateLeagueAndSeason(UUID clubId, UUID leagueId, UUID seasonId) {
        if (leagueId != null) {
            League league = leagueRepository
                    .findById(leagueId)
                    .orElseThrow(() -> new NotFoundException("League not found: " + leagueId));
            if (!league.getClubId().equals(clubId)) {
                throw new NotFoundException("League not found: " + leagueId);
            }
        }
        if (seasonId == null) {
            throw new ValidationException("seasonId is required");
        }
        Season season = seasonRepository
                .findById(seasonId)
                .orElseThrow(() -> new NotFoundException("Season not found: " + seasonId));
        if (!season.getClubId().equals(clubId)) {
            throw new NotFoundException("Season not found: " + seasonId);
        }
    }

    private void validateTeamReferences(UUID homeTeamId, UUID awayTeamId) {
        if (homeTeamId != null) {
            requireTeamExists(homeTeamId);
        }
        if (awayTeamId != null) {
            requireTeamExists(awayTeamId);
        }
    }

    private void requireTeamExists(UUID teamId) {
        if (!teamRepository.existsById(teamId)) {
            throw new NotFoundException("Team not found: " + teamId);
        }
    }

    /**
     * 404s when {@code matchId} doesn't exist at all, or exists but belongs to a different
     * club — real cross-club isolation at the data layer.
     */
    private Match findOrThrowForClub(UUID clubId, UUID matchId) {
        Match match = matchRepository
                .findById(matchId)
                .orElseThrow(() -> new NotFoundException("Match not found: " + matchId));
        if (!match.getClubId().equals(clubId)) {
            throw new NotFoundException("Match not found: " + matchId);
        }
        return match;
    }
}
