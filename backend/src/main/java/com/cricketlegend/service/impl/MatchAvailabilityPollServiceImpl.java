package com.cricketlegend.service.impl;

import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.dto.CreateMatchAvailabilityPollRequest;
import com.cricketlegend.dto.MatchAvailabilityPollDto;
import com.cricketlegend.dto.MatchAvailabilityPollResponsesDto;
import com.cricketlegend.dto.PlayerAvailabilityRowDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.MatchAvailabilityPollMapper;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.service.AvailabilityPollSquadResolver;
import com.cricketlegend.service.MatchAvailabilityPollService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/032-match-availability-polls.md: {@link #create} validates {@code
 * request.teamId()} equals the match's own {@code homeTeamId}/{@code awayTeamId} ({@link
 * ValidationException}, matching {@code MatchSideServiceImpl.createSide}'s identical check — no
 * new subclass) and rejects a duplicate {@code (matchId, teamId)} poll ({@link ConflictException},
 * matching {@code createSide}'s duplicate-side precedent); {@link #open}/{@link #close} reuse
 * {@link InvalidStatusTransitionException} (matching {@code LeagueServiceImpl.deactivate}/{@code
 * reactivate}'s exact "already X" shape) when the poll is already in that state; {@link
 * #getResponses} resolves the poll's full season-scoped squad via the shared {@link
 * AvailabilityPollSquadResolver} (never {@code TeamSquadService.list}, which would incorrectly
 * 404 a legitimate cross-club-opponent-Team poll — see the resolver's own Javadoc) and overlays
 * each member's current {@link PlayerAvailability} status, {@code null} for no response yet.
 */
@Service
public class MatchAvailabilityPollServiceImpl implements MatchAvailabilityPollService {

    private final MatchRepository matchRepository;
    private final MatchAvailabilityPollRepository matchAvailabilityPollRepository;
    private final PlayerAvailabilityRepository playerAvailabilityRepository;
    private final AvailabilityPollSquadResolver squadResolver;
    private final MatchAvailabilityPollMapper matchAvailabilityPollMapper;

    public MatchAvailabilityPollServiceImpl(
            MatchRepository matchRepository,
            MatchAvailabilityPollRepository matchAvailabilityPollRepository,
            PlayerAvailabilityRepository playerAvailabilityRepository,
            AvailabilityPollSquadResolver squadResolver,
            MatchAvailabilityPollMapper matchAvailabilityPollMapper) {
        this.matchRepository = matchRepository;
        this.matchAvailabilityPollRepository = matchAvailabilityPollRepository;
        this.playerAvailabilityRepository = playerAvailabilityRepository;
        this.squadResolver = squadResolver;
        this.matchAvailabilityPollMapper = matchAvailabilityPollMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MatchAvailabilityPollDto> list(UUID clubId, UUID matchId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        return matchAvailabilityPollRepository.findByMatchId(matchId).stream()
                .map(poll -> toDto(poll, match.getSeasonId()))
                .toList();
    }

    @Override
    @Transactional
    public MatchAvailabilityPollDto create(
            UUID clubId, UUID matchId, CreateMatchAvailabilityPollRequest request) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        UUID teamId = request.teamId();

        boolean isHome = teamId.equals(match.getHomeTeamId());
        boolean isAway = teamId.equals(match.getAwayTeamId());
        if (!isHome && !isAway) {
            throw new ValidationException(
                    "teamId " + teamId + " is not one of this match's own home/away team ids");
        }
        if (matchAvailabilityPollRepository.existsByMatchIdAndTeamId(matchId, teamId)) {
            throw new ConflictException(
                    "A poll for team " + teamId + " already exists on match " + matchId);
        }

        MatchAvailabilityPoll poll =
                MatchAvailabilityPoll.builder().matchId(matchId).teamId(teamId).open(true).build();
        poll = matchAvailabilityPollRepository.save(poll);

        return toDto(poll, match.getSeasonId());
    }

    @Override
    @Transactional
    public MatchAvailabilityPollDto open(UUID clubId, UUID matchId, UUID pollId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        MatchAvailabilityPoll poll = findPollOrThrowForMatch(matchId, pollId);
        if (poll.isOpen()) {
            throw new InvalidStatusTransitionException("Poll is already open: " + pollId);
        }
        poll.setOpen(true);
        poll = matchAvailabilityPollRepository.save(poll);
        return toDto(poll, match.getSeasonId());
    }

    @Override
    @Transactional
    public MatchAvailabilityPollDto close(UUID clubId, UUID matchId, UUID pollId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        MatchAvailabilityPoll poll = findPollOrThrowForMatch(matchId, pollId);
        if (!poll.isOpen()) {
            throw new InvalidStatusTransitionException("Poll is already closed: " + pollId);
        }
        poll.setOpen(false);
        poll = matchAvailabilityPollRepository.save(poll);
        return toDto(poll, match.getSeasonId());
    }

    @Override
    @Transactional(readOnly = true)
    public MatchAvailabilityPollResponsesDto getResponses(UUID clubId, UUID matchId, UUID pollId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        MatchAvailabilityPoll poll = findPollOrThrowForMatch(matchId, pollId);

        List<PlayerAvailabilityRowDto> rows = rowsWithStatuses(poll, match.getSeasonId());

        return new MatchAvailabilityPollResponsesDto(
                poll.getId(),
                poll.getTeamId(),
                poll.isOpen(),
                countStatus(rows, AvailabilityStatus.AVAILABLE),
                countStatus(rows, AvailabilityStatus.UNAVAILABLE),
                countStatus(rows, AvailabilityStatus.UNSURE),
                countNoResponse(rows),
                rows,
                "/poll/" + poll.getId());
    }

    private MatchAvailabilityPollDto toDto(MatchAvailabilityPoll poll, UUID seasonId) {
        List<PlayerAvailabilityRowDto> rows = rowsWithStatuses(poll, seasonId);
        return matchAvailabilityPollMapper.toDto(
                poll,
                countStatus(rows, AvailabilityStatus.AVAILABLE),
                countStatus(rows, AvailabilityStatus.UNAVAILABLE),
                countStatus(rows, AvailabilityStatus.UNSURE),
                countNoResponse(rows));
    }

    private List<PlayerAvailabilityRowDto> rowsWithStatuses(MatchAvailabilityPoll poll, UUID seasonId) {
        List<PlayerAvailabilityRowDto> squadRows = squadResolver.resolveSquadRows(poll.getTeamId(), seasonId);
        Map<UUID, AvailabilityStatus> statusByPlayerId =
                playerAvailabilityRepository.findByPollId(poll.getId()).stream()
                        .collect(Collectors.toMap(
                                PlayerAvailability::getPlayerProfileId, PlayerAvailability::getStatus));
        return squadRows.stream().map(row -> withStatus(row, statusByPlayerId)).toList();
    }

    private PlayerAvailabilityRowDto withStatus(
            PlayerAvailabilityRowDto row, Map<UUID, AvailabilityStatus> statusByPlayerId) {
        return new PlayerAvailabilityRowDto(
                row.playerProfileId(),
                row.firstName(),
                row.lastName(),
                row.squadJerseyNumber(),
                statusByPlayerId.get(row.playerProfileId()));
    }

    private long countStatus(List<PlayerAvailabilityRowDto> rows, AvailabilityStatus status) {
        return rows.stream().filter(row -> row.status() == status).count();
    }

    private long countNoResponse(List<PlayerAvailabilityRowDto> rows) {
        return rows.stream().filter(row -> row.status() == null).count();
    }

    private Match findMatchOrThrowForClub(UUID clubId, UUID matchId) {
        Match match = matchRepository
                .findById(matchId)
                .orElseThrow(() -> new NotFoundException("Match not found: " + matchId));
        if (!match.getClubId().equals(clubId)) {
            throw new NotFoundException("Match not found: " + matchId);
        }
        return match;
    }

    private MatchAvailabilityPoll findPollOrThrowForMatch(UUID matchId, UUID pollId) {
        MatchAvailabilityPoll poll = matchAvailabilityPollRepository
                .findById(pollId)
                .orElseThrow(() -> new NotFoundException("Poll not found: " + pollId));
        if (!poll.getMatchId().equals(matchId)) {
            throw new NotFoundException("Poll not found: " + pollId);
        }
        return poll;
    }
}
