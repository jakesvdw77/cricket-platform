package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.dto.AvailabilityRespondentDto;
import com.cricketlegend.dto.CreateMatchAvailabilityPollRequest;
import com.cricketlegend.dto.MatchAvailabilityPollDto;
import com.cricketlegend.dto.MatchAvailabilityPollResponsesDto;
import com.cricketlegend.dto.OpenAvailabilityPollDto;
import com.cricketlegend.dto.PlayerAvailabilityRowDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PollClosedException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.MatchAvailabilityPollMapper;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.service.AvailabilityPollSquadResolver;
import com.cricketlegend.service.MatchAvailabilityPollService;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
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
 * {@link #setPlayerStatus} is the admin override added after `032` shipped — same not-in-squad
 * {@link NotFoundException} and closed-poll {@link PollClosedException} rules as the public write
 * path ({@code PublicAvailabilityPollServiceImpl.setAvailability}), just under
 * {@code @access.canAdministerClub} instead of being unauthenticated.
 */
@Service
public class MatchAvailabilityPollServiceImpl implements MatchAvailabilityPollService {

    private final MatchRepository matchRepository;
    private final MatchAvailabilityPollRepository matchAvailabilityPollRepository;
    private final PlayerAvailabilityRepository playerAvailabilityRepository;
    private final AvailabilityPollSquadResolver squadResolver;
    private final MatchAvailabilityPollMapper matchAvailabilityPollMapper;
    private final AccessService accessService;

    public MatchAvailabilityPollServiceImpl(
            MatchRepository matchRepository,
            MatchAvailabilityPollRepository matchAvailabilityPollRepository,
            PlayerAvailabilityRepository playerAvailabilityRepository,
            AvailabilityPollSquadResolver squadResolver,
            MatchAvailabilityPollMapper matchAvailabilityPollMapper,
            AccessService accessService) {
        this.matchRepository = matchRepository;
        this.matchAvailabilityPollRepository = matchAvailabilityPollRepository;
        this.playerAvailabilityRepository = playerAvailabilityRepository;
        this.squadResolver = squadResolver;
        this.matchAvailabilityPollMapper = matchAvailabilityPollMapper;
        this.accessService = accessService;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MatchAvailabilityPollDto> list(Authentication authentication, UUID clubId, UUID matchId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        return matchAvailabilityPollRepository.findByMatchId(matchId).stream()
                .map(poll -> toDto(poll, match.getSeasonId()))
                .toList();
    }

    @Override
    @Transactional
    public MatchAvailabilityPollDto create(
            Authentication authentication,
            UUID clubId,
            UUID matchId,
            CreateMatchAvailabilityPollRequest request) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
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
    public MatchAvailabilityPollDto open(Authentication authentication, UUID clubId, UUID matchId, UUID pollId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
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
    public MatchAvailabilityPollDto close(Authentication authentication, UUID clubId, UUID matchId, UUID pollId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
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
    public MatchAvailabilityPollResponsesDto getResponses(
            Authentication authentication, UUID clubId, UUID matchId, UUID pollId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        MatchAvailabilityPoll poll = findPollOrThrowForMatch(matchId, pollId);
        return buildResponsesDto(poll, match.getSeasonId());
    }

    @Override
    @Transactional
    public MatchAvailabilityPollResponsesDto setPlayerStatus(
            Authentication authentication,
            UUID clubId,
            UUID matchId,
            UUID pollId,
            UUID playerProfileId,
            AvailabilityStatus status) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        MatchAvailabilityPoll poll = findPollOrThrowForMatch(matchId, pollId);

        List<PlayerAvailabilityRowDto> squadRows =
                squadResolver.resolveSquadRows(poll.getTeamId(), match.getSeasonId());
        boolean inSquad = squadRows.stream().anyMatch(row -> row.playerProfileId().equals(playerProfileId));
        if (!inSquad) {
            throw new NotFoundException(
                    "Player " + playerProfileId + " is not part of this poll's own squad");
        }
        if (!poll.isOpen()) {
            throw new PollClosedException("Poll is closed: " + pollId);
        }

        PlayerAvailability availability = playerAvailabilityRepository
                .findByPollIdAndPlayerProfileId(pollId, playerProfileId)
                .orElseGet(() -> PlayerAvailability.builder()
                        .pollId(pollId)
                        .playerProfileId(playerProfileId)
                        .build());
        availability.setStatus(status);
        playerAvailabilityRepository.save(availability);

        return buildResponsesDto(poll, match.getSeasonId());
    }

    @Override
    @Transactional(readOnly = true)
    public List<OpenAvailabilityPollDto> listOpenForClub(
            Authentication authentication, UUID clubId, UUID sectionId) {
        List<MatchAvailabilityPoll> openPolls = matchAvailabilityPollRepository.findOpenByMatchClubId(clubId);
        Set<UUID> matchIds = openPolls.stream().map(MatchAvailabilityPoll::getMatchId).collect(Collectors.toSet());
        Map<UUID, Match> matchesById = matchRepository.findAllById(matchIds).stream()
                .collect(Collectors.toMap(Match::getId, match -> match));

        // Optional.empty() = unrestricted (club-wide/platform_admin) caller — no filtering at all.
        Optional<Set<UUID>> accessibleSectionIds = accessService.accessibleSectionIds(authentication, clubId);
        Set<UUID> narrowTo = null;
        if (sectionId != null) {
            accessService.assertCanAdministerSection(authentication, clubId, sectionId);
            narrowTo = accessService.sectionAndDescendantIds(clubId, sectionId);
        }

        List<OpenAvailabilityPollDto> result = new ArrayList<>();
        for (MatchAvailabilityPoll poll : openPolls) {
            Match match = matchesById.get(poll.getMatchId());
            if (match == null) {
                continue;
            }
            Set<UUID> matchSectionIds =
                    accessService.resolveMatchSectionIds(clubId, match.getHomeTeamId(), match.getAwayTeamId());
            if (accessibleSectionIds.isPresent()
                    && matchSectionIds.stream().noneMatch(accessibleSectionIds.get()::contains)) {
                continue;
            }
            if (narrowTo != null && matchSectionIds.stream().noneMatch(narrowTo::contains)) {
                continue;
            }
            result.add(toOpenPollDto(poll, match));
        }

        result.sort(Comparator.comparing(OpenAvailabilityPollDto::matchDate));
        return result;
    }

    private OpenAvailabilityPollDto toOpenPollDto(MatchAvailabilityPoll poll, Match match) {
        List<PlayerAvailabilityRowDto> rows = rowsWithStatuses(poll, match.getSeasonId());
        List<AvailabilityRespondentDto> available = respondents(rows, AvailabilityStatus.AVAILABLE);
        List<AvailabilityRespondentDto> unavailable = respondents(rows, AvailabilityStatus.UNAVAILABLE);
        List<AvailabilityRespondentDto> unsure = respondents(rows, AvailabilityStatus.UNSURE);

        return new OpenAvailabilityPollDto(
                poll.getId(),
                match.getId(),
                poll.getTeamId(),
                match.getHomeTeamId(),
                match.getHomeTeamName(),
                match.getAwayTeamId(),
                match.getAwayTeamName(),
                match.getMatchDate(),
                match.getVenue(),
                available.size(),
                unavailable.size(),
                unsure.size(),
                countNoResponse(rows),
                available,
                unavailable,
                unsure);
    }

    private List<AvailabilityRespondentDto> respondents(List<PlayerAvailabilityRowDto> rows, AvailabilityStatus status) {
        return rows.stream()
                .filter(row -> row.status() == status)
                .sorted(Comparator.comparing(PlayerAvailabilityRowDto::lastName)
                        .thenComparing(PlayerAvailabilityRowDto::firstName))
                .map(row -> new AvailabilityRespondentDto(
                        row.playerProfileId(), row.firstName(), row.lastName(), row.squadJerseyNumber()))
                .toList();
    }

    /**
     * Per docs/specs/035-section-scoped-access.md: a poll's own section is its parent match's
     * section, resolved via the shared {@link AccessService#resolveMatchSectionIds} helper (a
     * match resolving to zero of this club's own sections — both sides free-text, or both another
     * club's team — is reachable only by a {@code CLUB}-scope admin, the same conservative
     * fallback {@code MatchServiceImpl} applies).
     */
    private void assertCanAdministerMatch(Authentication authentication, UUID clubId, Match match) {
        Set<UUID> matchSectionIds =
                accessService.resolveMatchSectionIds(clubId, match.getHomeTeamId(), match.getAwayTeamId());
        accessService.assertCanAdministerAnySection(authentication, clubId, matchSectionIds);
    }

    private MatchAvailabilityPollResponsesDto buildResponsesDto(MatchAvailabilityPoll poll, UUID seasonId) {
        List<PlayerAvailabilityRowDto> rows = rowsWithStatuses(poll, seasonId);
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
