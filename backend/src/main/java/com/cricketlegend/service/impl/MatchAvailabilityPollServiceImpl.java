package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AnswerSource;
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
import com.cricketlegend.dto.UpdatePollCloseTimeRequest;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.MatchAlreadyPolledException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ReopenWindowPassedException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.MatchAvailabilityPollMapper;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.service.AvailabilityPollSquadResolver;
import com.cricketlegend.service.MatchAvailabilityPollService;
import com.cricketlegend.service.MatchPollCoverageService;
import com.cricketlegend.service.support.AutoCloseSchedule;
import com.cricketlegend.service.support.AvailabilityPollFilter;
import com.cricketlegend.service.support.ReopenWindow;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 * {@link NotFoundException} rule as the public write path ({@code
 * PublicAvailabilityPollServiceImpl.setAvailability}), just under {@code @access.canAdministerClub}
 * instead of being unauthenticated; unlike the public path it is accepted on a closed poll
 * (docs/specs/066-poll-close-time-and-unified-cards.md, a manager correction).
 *
 * <p>Per docs/specs/064-unified-availability-polls.md: {@link #create} 409s ({@link
 * MatchAlreadyPolledException}) if a group poll already covers the match (via the shared {@link
 * MatchPollCoverageService}), stores {@code autoClose} (default true) and computes {@code
 * scheduledCloseAt} via the shared {@link AutoCloseSchedule}; {@link #delete} removes a poll and
 * its responses; {@link #closeDueAutoClosePolls} is the internal, auth-free entry point of the
 * scheduled auto-close job.
 *
 * <p>Per docs/specs/066: {@link #updateCloseTime} edits a poll's close time (open or closed, never
 * changing {@code open}) through {@link AutoCloseSchedule#validateCloseTime}, which {@link
 * #create} also uses when the request carries an explicit {@code scheduledCloseAt}.
 */
@Service
public class MatchAvailabilityPollServiceImpl implements MatchAvailabilityPollService {

    private static final Logger log = LoggerFactory.getLogger(MatchAvailabilityPollServiceImpl.class);

    private final MatchRepository matchRepository;
    private final MatchAvailabilityPollRepository matchAvailabilityPollRepository;
    private final PlayerAvailabilityRepository playerAvailabilityRepository;
    private final MatchPollCoverageService coverageService;
    private final AvailabilityPollSquadResolver squadResolver;
    private final MatchAvailabilityPollMapper matchAvailabilityPollMapper;
    private final AccessService accessService;
    private final Clock clock;

    public MatchAvailabilityPollServiceImpl(
            MatchRepository matchRepository,
            MatchAvailabilityPollRepository matchAvailabilityPollRepository,
            PlayerAvailabilityRepository playerAvailabilityRepository,
            MatchPollCoverageService coverageService,
            AvailabilityPollSquadResolver squadResolver,
            MatchAvailabilityPollMapper matchAvailabilityPollMapper,
            AccessService accessService,
            Clock clock) {
        this.matchRepository = matchRepository;
        this.matchAvailabilityPollRepository = matchAvailabilityPollRepository;
        this.playerAvailabilityRepository = playerAvailabilityRepository;
        this.coverageService = coverageService;
        this.squadResolver = squadResolver;
        this.matchAvailabilityPollMapper = matchAvailabilityPollMapper;
        this.accessService = accessService;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MatchAvailabilityPollDto> list(Authentication authentication, UUID clubId, UUID matchId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        return matchAvailabilityPollRepository.findByMatchId(matchId).stream()
                .map(poll -> toDto(poll, match))
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
        MatchPollCoverageService.Coverage coverage = coverageService.resolve(matchId, teamId);
        if (coverage.kind() == MatchPollCoverageService.Kind.GROUP) {
            throw new MatchAlreadyPolledException("Match " + matchId + " is already covered by group poll '"
                    + coverage.label() + "' (" + coverage.roundId() + ")");
        }
        if (matchAvailabilityPollRepository.existsByMatchIdAndTeamId(matchId, teamId)) {
            throw new ConflictException(
                    "A poll for team " + teamId + " already exists on match " + matchId);
        }

        boolean autoClose = request.autoClose() == null || request.autoClose();
        MatchAvailabilityPoll poll = MatchAvailabilityPoll.builder()
                .matchId(matchId)
                .teamId(teamId)
                .open(true)
                .autoClose(autoClose)
                .scheduledCloseAt(AutoCloseSchedule.resolveCreateCloseTime(
                        autoClose, request.scheduledCloseAt(), match.getMatchDate(), Instant.now()))
                .build();
        poll = matchAvailabilityPollRepository.save(poll);

        return toDto(poll, match);
    }

    @Override
    @Transactional
    public MatchAvailabilityPollDto updateCloseTime(
            Authentication authentication,
            UUID clubId,
            UUID matchId,
            UUID pollId,
            UpdatePollCloseTimeRequest request) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        MatchAvailabilityPoll poll = findPollOrThrowForMatch(matchId, pollId);
        Instant validated = AutoCloseSchedule.validateCloseTime(
                request.autoClose(), request.scheduledCloseAt(), match.getMatchDate(), Instant.now());
        // Only the close time changes; open/closed state is a separate action (open/close).
        poll.setAutoClose(request.autoClose());
        poll.setScheduledCloseAt(validated);
        poll = matchAvailabilityPollRepository.save(poll);
        return toDto(poll, match);
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
        // Reopening is only allowed until the automatic close time, else the auto-close job would
        // undo it within minutes.
        Instant now = clock.instant();
        if (!AutoCloseSchedule.canReopen(poll.isAutoClose(), poll.getScheduledCloseAt(), now)) {
            throw new ReopenWindowPassedException("This poll can no longer be reopened because its automatic close time has passed.");
        }
        // docs/specs/082: and not once its match started more than 24 hours ago.
        if (!matchWithinReopenGrace(match, now)) {
            throw new ReopenWindowPassedException(ReopenWindow.REFUSED_MESSAGE);
        }
        poll.setOpen(true);
        poll = matchAvailabilityPollRepository.save(poll);
        return toDto(poll, match);
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
        return toDto(poll, match);
    }

    @Override
    @Transactional
    public void delete(Authentication authentication, UUID clubId, UUID matchId, UUID pollId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        MatchAvailabilityPoll poll = findPollOrThrowForMatch(matchId, pollId);
        // No ON DELETE CASCADE on these tables: responses first, then the poll.
        playerAvailabilityRepository.deleteByPollId(poll.getId());
        matchAvailabilityPollRepository.delete(poll);
    }

    @Override
    @Transactional
    public int closeDueAutoClosePolls(Instant now) {
        List<MatchAvailabilityPoll> due = matchAvailabilityPollRepository.findDueForAutoClose(now);
        for (MatchAvailabilityPoll poll : due) {
            poll.setOpen(false);
            matchAvailabilityPollRepository.save(poll);
        }
        if (due.isEmpty()) {
            log.debug("Auto-closed 0 squad availability poll(s)");
        } else {
            log.info("Auto-closed {} squad availability poll(s)", due.size());
        }
        return due.size();
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
        // Admin override is accepted on a closed poll too (docs/specs/066): a manager correction.
        // The public endpoint keeps refusing closed-poll writes.

        PlayerAvailability availability = playerAvailabilityRepository
                .findByPollIdAndPlayerProfileId(pollId, playerProfileId)
                .orElseGet(() -> PlayerAvailability.builder()
                        .pollId(pollId)
                        .playerProfileId(playerProfileId)
                        .build());
        availability.setStatus(status);
        // A manager override clears the "via link" marker (077).
        availability.setSource(AnswerSource.MANAGER);
        playerAvailabilityRepository.save(availability);

        return buildResponsesDto(poll, match.getSeasonId());
    }

    @Override
    @Transactional(readOnly = true)
    public List<OpenAvailabilityPollDto> listOpenForClub(
            Authentication authentication, UUID clubId, UUID sectionId) {
        List<OpenAvailabilityPollDto> result = listScopedPolls(
                authentication,
                clubId,
                sectionId,
                matchAvailabilityPollRepository.findOpenByMatchClubId(clubId),
                Integer.MAX_VALUE);
        result.sort(Comparator.comparing(OpenAvailabilityPollDto::matchDate));
        return result;
    }

    /**
     * Closed squad polls, most recent match first, capped at {@link AvailabilityPollFilter#CLOSED_POLLS_LIMIT} (the 50
     * most recent that the caller can reach — closed history is otherwise unbounded). Same
     * section-scope narrowing and response shape as {@link #listOpenForClub}.
     */
    @Override
    @Transactional(readOnly = true)
    public List<OpenAvailabilityPollDto> listClosedForClub(
            Authentication authentication, UUID clubId, UUID sectionId) {
        // The repository query is already ordered by match date descending; the scoped filter and
        // the cap both preserve that order.
        return listScopedPolls(
                authentication,
                clubId,
                sectionId,
                matchAvailabilityPollRepository.findClosedByMatchClubId(clubId),
                AvailabilityPollFilter.CLOSED_POLLS_LIMIT);
    }

    /**
     * Shared by the open and closed listings: resolves each poll's match, applies the caller's
     * accessible-section scope and the optional explicit {@code sectionId} narrowing (validated
     * first), keeps at most {@code limit} polls in input order, then builds their DTOs — the
     * expensive squad/response resolution only runs for the polls that survive the cap.
     */
    private List<OpenAvailabilityPollDto> listScopedPolls(
            Authentication authentication, UUID clubId, UUID sectionId, List<MatchAvailabilityPoll> polls, int limit) {
        Set<UUID> matchIds = polls.stream().map(MatchAvailabilityPoll::getMatchId).collect(Collectors.toSet());
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
        for (MatchAvailabilityPoll poll : polls) {
            if (result.size() >= limit) {
                break;
            }
            Match match = matchesById.get(poll.getMatchId());
            if (match == null || !match.isActive()) {
                continue; // polls of deactivated matches are hidden everywhere (docs/specs/083)
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
                unsure,
                poll.isAutoClose(),
                poll.getScheduledCloseAt(),
                canReopen(poll, match));
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

    private MatchAvailabilityPollDto toDto(MatchAvailabilityPoll poll, Match match) {
        List<PlayerAvailabilityRowDto> rows = rowsWithStatuses(poll, match.getSeasonId());
        return matchAvailabilityPollMapper.toDto(
                poll,
                countStatus(rows, AvailabilityStatus.AVAILABLE),
                countStatus(rows, AvailabilityStatus.UNAVAILABLE),
                countStatus(rows, AvailabilityStatus.UNSURE),
                countNoResponse(rows),
                canReopen(poll, match));
    }

    /** Both reopen rules (automatic close time, docs/specs/082 matches-in-the-past) allow it now. */
    private boolean canReopen(MatchAvailabilityPoll poll, Match match) {
        Instant now = clock.instant();
        return AutoCloseSchedule.canReopen(poll.isAutoClose(), poll.getScheduledCloseAt(), now)
                && matchWithinReopenGrace(match, now);
    }

    private static boolean matchWithinReopenGrace(Match match, Instant now) {
        return ReopenWindow.allows(
                ReopenWindow.latestStart(java.util.Collections.singletonList(match.getMatchDate()), List.of()), now);
    }

    private List<PlayerAvailabilityRowDto> rowsWithStatuses(MatchAvailabilityPoll poll, UUID seasonId) {
        List<PlayerAvailabilityRowDto> squadRows = squadResolver.resolveSquadRows(poll.getTeamId(), seasonId);
        Map<UUID, PlayerAvailability> answerByPlayerId =
                playerAvailabilityRepository.findByPollId(poll.getId()).stream()
                        .collect(Collectors.toMap(PlayerAvailability::getPlayerProfileId, answer -> answer));
        return squadRows.stream().map(row -> withStatus(row, answerByPlayerId.get(row.playerProfileId()))).toList();
    }

    private PlayerAvailabilityRowDto withStatus(PlayerAvailabilityRowDto row, PlayerAvailability answer) {
        return new PlayerAvailabilityRowDto(
                row.playerProfileId(),
                row.firstName(),
                row.lastName(),
                row.squadJerseyNumber(),
                answer == null ? null : answer.getStatus(),
                answer != null && answer.getSource() == AnswerSource.PUBLIC_LINK);
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
