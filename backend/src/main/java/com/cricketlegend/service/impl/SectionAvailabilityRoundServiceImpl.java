package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AnswerSource;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.CreateSectionAvailabilityRoundRequest;
import com.cricketlegend.dto.SectionAvailabilityResponseRowDto;
import com.cricketlegend.dto.SectionAvailabilityRoundBracketDto;
import com.cricketlegend.dto.SectionAvailabilityRoundDto;
import com.cricketlegend.dto.SectionAvailabilityRoundMatchDto;
import com.cricketlegend.dto.SectionAvailabilityRoundResponseRowDto;
import com.cricketlegend.dto.SectionAvailabilityRoundResponsesDto;
import com.cricketlegend.dto.SectionAvailabilityRoundStatusDto;
import com.cricketlegend.dto.UpdatePollCloseTimeRequest;
import com.cricketlegend.dto.UpdateSectionAvailabilityRoundDescriptionRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.MatchAlreadyPolledException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ReopenWindowPassedException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.SectionAvailabilityRoundMapper;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSquadMemberRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.MatchPollCoverageService;
import com.cricketlegend.service.SectionAvailabilityAudienceResolver;
import com.cricketlegend.service.SectionAvailabilityMatchResolver;
import com.cricketlegend.service.SectionAvailabilityRoundService;
import com.cricketlegend.service.support.AutoCloseSchedule;
import com.cricketlegend.service.support.AvailabilityPollFilter;
import com.cricketlegend.service.support.AvailabilityPollFilters;
import com.cricketlegend.service.support.ReopenWindow;
import com.cricketlegend.service.support.RoundSpan;
import com.cricketlegend.service.support.RoundWindows;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
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
 * Business rules per docs/specs/063-section-availability-and-flexible-squads.md's Data Model
 * Changes/API Contract (Part A, the fixture-group-selection revision): {@link #list} narrows to
 * the caller's own accessible section set, additionally asserting {@link
 * AccessService#assertCanAdministerSection} only when the {@code sectionId} filter is itself
 * supplied; {@link #create} asserts directly against the request body's {@code sectionId}, 404s if
 * that section belongs to a different club, validates every {@code matchId} resolves to a team in
 * this section (400, {@link ValidationException}), 409s ({@link MatchAlreadyPolledException})
 * naming the conflicting match(es) if any selected match is already covered by a poll of either
 * kind (docs/specs/064-unified-availability-polls.md, via {@link MatchPollCoverageService}) or its
 * own bracket already has a window, then atomically creates exactly the windows those matches need
 * (one per distinct bracket) plus one {@link SectionAvailabilityWindowMatch} row per match, and
 * computes {@code firstMatchDate}/{@code lastMatchDate}/{@code scheduledCloseAt}; {@link
 * #updateDescription}/{@link #open}/{@link #close}/{@link #getResponses}/{@link #getMatches}/
 * {@link #setPlayerStatus} each load the round first, then assert against its own {@code
 * sectionId} before their own business logic, mirroring {@code TeamSquadServiceImpl}'s own call
 * shape (load the resource, assert on its section, then validate). {@link #open}/{@link #close}
 * cascade to every owned window's own {@code open} flag, kept in lockstep. {@link
 * #setPlayerStatus} is the admin override, now {@code windowId}-keyed rather than {@code
 * dayPart}-keyed (a round can own several windows sharing the same {@code dayPart} across
 * different dates) — mirrors {@code MatchAvailabilityPollServiceImpl.setPlayerStatus}'s
 * not-in-audience ({@link NotFoundException}, 404) rule; unlike the public path it is accepted on
 * a closed round (docs/specs/066, a manager correction).
 *
 * <p>Per docs/specs/064-unified-availability-polls.md: {@link #delete} removes a round child-first
 * (docs/specs/076-team-selection.md: it also clears the round's now-dormant match-squad rows
 * instead of refusing, so a stale row can never make a poll undeletable)
 * and {@link #closeDueAutoClosePolls} is the scheduled auto-close job's internal entry point,
 * cascading through {@code setWindowsOpen} like a manual close.
 *
 * <p>Per docs/specs/066: {@link #updateCloseTime} edits the close time (open or closed, never
 * changing {@code open}) via {@link AutoCloseSchedule#validateCloseTime} against the earliest
 * covered kickoff; {@link #create} uses the same rule for an explicit {@code scheduledCloseAt};
 * every DTO carries {@code firstMatchKickoff}.
 */
@Service
public class SectionAvailabilityRoundServiceImpl implements SectionAvailabilityRoundService {

    private static final Logger log = LoggerFactory.getLogger(SectionAvailabilityRoundServiceImpl.class);

    private final SectionAvailabilityRoundRepository sectionAvailabilityRoundRepository;
    private final SectionAvailabilityWindowRepository sectionAvailabilityWindowRepository;
    private final SectionAvailabilityWindowMatchRepository sectionAvailabilityWindowMatchRepository;
    private final SectionAvailabilityResponseRepository sectionAvailabilityResponseRepository;
    private final SectionRepository sectionRepository;
    private final TeamRepository teamRepository;
    private final MatchRepository matchRepository;
    private final LeagueRepository leagueRepository;
    private final SectionAvailabilityAudienceResolver audienceResolver;
    private final SectionAvailabilityMatchResolver matchResolver;
    private final SectionAvailabilityRoundMapper sectionAvailabilityRoundMapper;
    private final MatchSquadMemberRepository matchSquadMemberRepository;
    private final MatchPollCoverageService coverageService;
    private final AccessService accessService;
    private final AvailabilityPollFilters pollFilters;
    private final Clock clock;

    public SectionAvailabilityRoundServiceImpl(
            SectionAvailabilityRoundRepository sectionAvailabilityRoundRepository,
            SectionAvailabilityWindowRepository sectionAvailabilityWindowRepository,
            SectionAvailabilityWindowMatchRepository sectionAvailabilityWindowMatchRepository,
            SectionAvailabilityResponseRepository sectionAvailabilityResponseRepository,
            SectionRepository sectionRepository,
            TeamRepository teamRepository,
            MatchRepository matchRepository,
            LeagueRepository leagueRepository,
            SectionAvailabilityAudienceResolver audienceResolver,
            SectionAvailabilityMatchResolver matchResolver,
            SectionAvailabilityRoundMapper sectionAvailabilityRoundMapper,
            MatchSquadMemberRepository matchSquadMemberRepository,
            MatchPollCoverageService coverageService,
            AccessService accessService,
            AvailabilityPollFilters pollFilters,
            Clock clock) {
        this.sectionAvailabilityRoundRepository = sectionAvailabilityRoundRepository;
        this.sectionAvailabilityWindowRepository = sectionAvailabilityWindowRepository;
        this.sectionAvailabilityWindowMatchRepository = sectionAvailabilityWindowMatchRepository;
        this.sectionAvailabilityResponseRepository = sectionAvailabilityResponseRepository;
        this.sectionRepository = sectionRepository;
        this.teamRepository = teamRepository;
        this.matchRepository = matchRepository;
        this.leagueRepository = leagueRepository;
        this.audienceResolver = audienceResolver;
        this.matchResolver = matchResolver;
        this.sectionAvailabilityRoundMapper = sectionAvailabilityRoundMapper;
        this.matchSquadMemberRepository = matchSquadMemberRepository;
        this.coverageService = coverageService;
        this.accessService = accessService;
        this.pollFilters = pollFilters;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public List<SectionAvailabilityRoundDto> list(
            Authentication authentication,
            UUID clubId,
            UUID sectionId,
            UUID leagueId,
            UUID teamId,
            UUID seasonId,
            Boolean open) {
        Optional<Set<UUID>> accessibleSectionIds = accessService.accessibleSectionIds(authentication, clubId);
        // Validates section/league/team (403/404) and builds the shared narrowing (docs/specs/083).
        AvailabilityPollFilter filter = pollFilters.resolve(
                authentication, clubId, accessibleSectionIds, leagueId, sectionId, teamId, null, false, seasonId);

        List<SectionAvailabilityRound> candidates = sectionAvailabilityRoundRepository.findByClubId(clubId).stream()
                .filter(round ->
                        accessibleSectionIds.isEmpty() || accessibleSectionIds.get().contains(round.getSectionId()))
                .filter(round -> open == null || round.isOpen() == open)
                .toList();
        // League/team need each round's active slot matches: one batched load, before the closed cap.
        Map<UUID, List<Match>> slotMatches = filter.needsGroupMatches() && !candidates.isEmpty()
                ? pollFilters.slotMatchesByRoundId(
                        candidates.stream().map(SectionAvailabilityRound::getId).toList())
                : Map.of();
        var rounds = candidates.stream()
                .filter(round -> filter.matchesGroup(round, slotMatches.getOrDefault(round.getId(), List.of())));
        if (Boolean.FALSE.equals(open)) {
            // Closed history is unbounded: most recent first, capped at the 50 most recent.
            rounds = rounds.sorted(Comparator.comparing(
                            SectionAvailabilityRound::getLastMatchDate, Comparator.nullsLast(Comparator.reverseOrder())))
                    .limit(AvailabilityPollFilter.CLOSED_POLLS_LIMIT);
        }
        List<SectionAvailabilityRound> visible = rounds.toList();
        // One batched walk for every returned round instead of three queries per round.
        Map<UUID, RoundSpan> spanByRoundId = roundSpans(
                visible.stream().map(SectionAvailabilityRound::getId).toList());
        return visible.stream()
                .map(round -> toDto(round, spanByRoundId.getOrDefault(round.getId(), RoundSpan.NONE)))
                .toList();
    }

    @Override
    @Transactional
    public SectionAvailabilityRoundDto create(
            Authentication authentication, UUID clubId, CreateSectionAvailabilityRoundRequest request) {
        accessService.assertCanAdministerSection(authentication, clubId, request.sectionId());
        Section section = findSectionOrThrowForClub(clubId, request.sectionId());

        Map<UUID, Match> matchesById = new LinkedHashMap<>();
        Map<UUID, SectionAvailabilityMatchResolver.WindowKey> keyByMatchId = new LinkedHashMap<>();
        for (UUID matchId : request.matchIds()) {
            Match match = findMatchForCreateOrThrow(clubId, matchId, section.getId());
            Team team = resolveSectionTeam(match, section.getId());
            matchesById.put(matchId, match);
            keyByMatchId.put(matchId, matchResolver.resolveWindowKey(team, match));
        }

        List<String> alreadyCovered = new ArrayList<>();
        for (UUID matchId : matchesById.keySet()) {
            MatchPollCoverageService.Coverage coverage = coverageService.resolveAny(matchId);
            if (coverage.covered()) {
                alreadyCovered.add(matchId + " (" + coverage.kind() + " poll: " + coverage.label() + ")");
            }
        }
        if (!alreadyCovered.isEmpty()) {
            throw new MatchAlreadyPolledException(
                    "The following matches are already covered by another poll: " + alreadyCovered);
        }

        List<UUID> conflicting = keyByMatchId.entrySet().stream()
                .filter(entry -> sectionAvailabilityWindowRepository.existsBySectionIdAndWindowDateAndDayPart(
                        entry.getValue().sectionId(), entry.getValue().windowDate(), entry.getValue().dayPart()))
                .map(Map.Entry::getKey)
                .toList();
        if (!conflicting.isEmpty()) {
            throw new MatchAlreadyPolledException(
                    "The following matches are already covered by another poll: " + conflicting);
        }

        ZoneId zone = ZoneId.systemDefault();
        Instant earliest = matchesById.values().stream()
                .map(Match::getMatchDate)
                .min(Comparator.naturalOrder())
                .orElseThrow();
        Instant latest = matchesById.values().stream()
                .map(Match::getMatchDate)
                .max(Comparator.naturalOrder())
                .orElseThrow();

        SectionAvailabilityRound round = SectionAvailabilityRound.builder()
                .clubId(section.getClubId())
                .sectionId(section.getId())
                .description(request.description())
                .firstMatchDate(earliest.atZone(zone).toLocalDate())
                .lastMatchDate(latest.atZone(zone).toLocalDate())
                .autoClose(request.autoClose())
                .scheduledCloseAt(AutoCloseSchedule.resolveCreateCloseTime(
                        request.autoClose(), request.scheduledCloseAt(), earliest, Instant.now()))
                .open(true)
                .build();
        round = sectionAvailabilityRoundRepository.save(round);

        Map<SectionAvailabilityMatchResolver.WindowKey, SectionAvailabilityWindow> windowsByKey =
                new LinkedHashMap<>();
        for (SectionAvailabilityMatchResolver.WindowKey key : new LinkedHashSet<>(keyByMatchId.values())) {
            SectionAvailabilityWindow window = SectionAvailabilityWindow.builder()
                    .clubId(section.getClubId())
                    .sectionId(key.sectionId())
                    .roundId(round.getId())
                    .windowDate(key.windowDate())
                    .dayPart(key.dayPart())
                    .open(true)
                    .build();
            windowsByKey.put(key, sectionAvailabilityWindowRepository.save(window));
        }

        for (Map.Entry<UUID, SectionAvailabilityMatchResolver.WindowKey> entry : keyByMatchId.entrySet()) {
            SectionAvailabilityWindow window = windowsByKey.get(entry.getValue());
            sectionAvailabilityWindowMatchRepository.save(SectionAvailabilityWindowMatch.builder()
                    .windowId(window.getId())
                    .matchId(entry.getKey())
                    .build());
        }

        return toDto(round, new RoundSpan(earliest, latest));
    }

    @Override
    @Transactional
    public SectionAvailabilityRoundDto updateCloseTime(
            Authentication authentication, UUID clubId, UUID roundId, UpdatePollCloseTimeRequest request) {
        SectionAvailabilityRound round = findRoundOrThrowForClub(clubId, roundId);
        accessService.assertCanAdministerSection(authentication, clubId, round.getSectionId());
        RoundSpan span = roundSpan(round.getId());
        Instant validated = AutoCloseSchedule.validateCloseTime(
                request.autoClose(), request.scheduledCloseAt(), span.earliestKickoff(), Instant.now());
        // Only the close time changes; open/closed state is a separate action (open/close).
        round.setAutoClose(request.autoClose());
        round.setScheduledCloseAt(validated);
        round = sectionAvailabilityRoundRepository.save(round);
        return toDto(round, span);
    }

    @Override
    @Transactional
    public SectionAvailabilityRoundDto updateDescription(
            Authentication authentication,
            UUID clubId,
            UUID roundId,
            UpdateSectionAvailabilityRoundDescriptionRequest request) {
        SectionAvailabilityRound round = findRoundOrThrowForClub(clubId, roundId);
        accessService.assertCanAdministerSection(authentication, clubId, round.getSectionId());
        round.setDescription(request.description());
        round = sectionAvailabilityRoundRepository.save(round);
        return toDto(round);
    }

    @Override
    @Transactional
    public SectionAvailabilityRoundDto open(Authentication authentication, UUID clubId, UUID roundId) {
        SectionAvailabilityRound round = findRoundOrThrowForClub(clubId, roundId);
        accessService.assertCanAdministerSection(authentication, clubId, round.getSectionId());
        if (round.isOpen()) {
            throw new InvalidStatusTransitionException("Section availability round is already open: " + roundId);
        }
        // Reopening is only allowed until the automatic close time, else the auto-close job would
        // undo it within minutes.
        Instant now = clock.instant();
        if (!AutoCloseSchedule.canReopen(round.isAutoClose(), round.getScheduledCloseAt(), now)) {
            throw new ReopenWindowPassedException("This poll can no longer be reopened because its automatic close time has passed.");
        }
        // docs/specs/082: and not once its latest match started more than 24 hours ago.
        RoundSpan span = roundSpan(round.getId());
        if (!ReopenWindow.allows(span.latestStart(), now)) {
            throw new ReopenWindowPassedException(ReopenWindow.REFUSED_MESSAGE);
        }
        round.setOpen(true);
        round = sectionAvailabilityRoundRepository.save(round);
        setWindowsOpen(round.getId(), true);
        return toDto(round, span);
    }

    @Override
    @Transactional
    public SectionAvailabilityRoundDto close(Authentication authentication, UUID clubId, UUID roundId) {
        SectionAvailabilityRound round = findRoundOrThrowForClub(clubId, roundId);
        accessService.assertCanAdministerSection(authentication, clubId, round.getSectionId());
        if (!round.isOpen()) {
            throw new InvalidStatusTransitionException("Section availability round is already closed: " + roundId);
        }
        round.setOpen(false);
        round = sectionAvailabilityRoundRepository.save(round);
        setWindowsOpen(round.getId(), false);
        return toDto(round);
    }

    @Override
    @Transactional
    public void delete(Authentication authentication, UUID clubId, UUID roundId) {
        SectionAvailabilityRound round = findRoundOrThrowForClub(clubId, roundId);
        accessService.assertCanAdministerSection(authentication, clubId, round.getSectionId());

        List<UUID> windowIds = sectionAvailabilityWindowRepository.findByRoundId(roundId).stream()
                .map(SectionAvailabilityWindow::getId)
                .toList();
        // No ON DELETE CASCADE on these tables: children first.
        // docs/specs/076-team-selection.md: stale match-squad rows no longer block the delete (no
        // screen can remove them any more), they go with the other children, first.
        if (!windowIds.isEmpty()) {
            matchSquadMemberRepository.deleteBySectionAvailabilityWindowIdIn(windowIds);
            sectionAvailabilityResponseRepository.deleteByWindowIdIn(windowIds);
            sectionAvailabilityWindowMatchRepository.deleteByWindowIdIn(windowIds);
        }
        sectionAvailabilityWindowRepository.deleteByRoundId(roundId);
        sectionAvailabilityRoundRepository.delete(round);
    }

    @Override
    @Transactional
    public int closeDueAutoClosePolls(Instant now) {
        List<SectionAvailabilityRound> due = sectionAvailabilityRoundRepository.findDueForAutoClose(now);
        for (SectionAvailabilityRound round : due) {
            round.setOpen(false);
            sectionAvailabilityRoundRepository.save(round);
            setWindowsOpen(round.getId(), false);
        }
        if (due.isEmpty()) {
            log.debug("Auto-closed 0 group availability poll(s)");
        } else {
            log.info("Auto-closed {} group availability poll(s)", due.size());
        }
        return due.size();
    }

    @Override
    @Transactional(readOnly = true)
    public SectionAvailabilityRoundResponsesDto getResponses(Authentication authentication, UUID clubId, UUID roundId) {
        SectionAvailabilityRound round = findRoundOrThrowForClub(clubId, roundId);
        accessService.assertCanAdministerSection(authentication, clubId, round.getSectionId());
        return buildResponsesDto(round);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SectionAvailabilityRoundMatchDto> getMatches(Authentication authentication, UUID clubId, UUID roundId) {
        SectionAvailabilityRound round = findRoundOrThrowForClub(clubId, roundId);
        accessService.assertCanAdministerSection(authentication, clubId, round.getSectionId());

        List<SectionAvailabilityRoundMatchDto> result = new ArrayList<>();
        for (Map.Entry<SectionAvailabilityWindow, Match> windowed : loadWindowedMatches(List.of(round.getId()))) {
            SectionAvailabilityWindow window = windowed.getKey();
            Match match = windowed.getValue();
            addMatchRowIfQualifies(
                    window, match, match.getHomeTeamId(), match.getAwayTeamId(), match.getAwayTeamName(), result);
            addMatchRowIfQualifies(
                    window, match, match.getAwayTeamId(), match.getHomeTeamId(), match.getHomeTeamName(), result);
        }
        return result;
    }

    /**
     * The one walk windows -> {@code section_availability_window_match} -> {@link Match} for any
     * number of rounds (three batched queries regardless of count), returned as (window, match)
     * pairs; shared by {@link #getMatches} and {@link #roundSpans}.
     */
    private List<Map.Entry<SectionAvailabilityWindow, Match>> loadWindowedMatches(List<UUID> roundIds) {
        return loadWindows(roundIds).pairs();
    }

    /** The windows of the given rounds plus each (window, match) pair; same three batched queries. */
    private RoundWindows loadWindows(List<UUID> roundIds) {
        if (roundIds.isEmpty()) {
            return new RoundWindows(List.of(), List.of());
        }
        List<SectionAvailabilityWindow> windows = sectionAvailabilityWindowRepository.findByRoundIdIn(roundIds);
        Map<UUID, SectionAvailabilityWindow> windowById = windows.stream()
                .collect(Collectors.toMap(SectionAvailabilityWindow::getId, window -> window));
        if (windowById.isEmpty()) {
            return new RoundWindows(List.of(), List.of());
        }
        List<SectionAvailabilityWindowMatch> windowMatches =
                sectionAvailabilityWindowMatchRepository.findByWindowIdIn(windowById.keySet());
        Map<UUID, Match> matchById = matchRepository
                .findAllById(windowMatches.stream()
                        .map(SectionAvailabilityWindowMatch::getMatchId)
                        .collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Match::getId, match -> match));

        List<Map.Entry<SectionAvailabilityWindow, Match>> result = new ArrayList<>();
        for (SectionAvailabilityWindowMatch windowMatch : windowMatches) {
            SectionAvailabilityWindow window = windowById.get(windowMatch.getWindowId());
            Match match = matchById.get(windowMatch.getMatchId());
            if (window != null && match != null) {
                result.add(Map.entry(window, match));
            }
        }
        return new RoundWindows(windows, result);
    }

    /** One batched walk giving every given round's {@link RoundSpan}; rounds with no windows are absent. */
    private Map<UUID, RoundSpan> roundSpans(List<UUID> roundIds) {
        RoundWindows loaded = loadWindows(roundIds);
        Map<UUID, List<Instant>> startsByRound = new LinkedHashMap<>();
        Set<UUID> windowsWithMatch = new LinkedHashSet<>();
        for (Map.Entry<SectionAvailabilityWindow, Match> pair : loaded.pairs()) {
            startsByRound
                    .computeIfAbsent(pair.getKey().getRoundId(), id -> new ArrayList<>())
                    .add(pair.getValue().getMatchDate());
            windowsWithMatch.add(pair.getKey().getId());
        }
        Map<UUID, List<LocalDate>> matchlessDatesByRound = new LinkedHashMap<>();
        for (SectionAvailabilityWindow window : loaded.windows()) {
            if (!windowsWithMatch.contains(window.getId())) {
                matchlessDatesByRound
                        .computeIfAbsent(window.getRoundId(), id -> new ArrayList<>())
                        .add(window.getWindowDate());
            }
        }
        Map<UUID, RoundSpan> result = new LinkedHashMap<>();
        Set<UUID> ids = new LinkedHashSet<>(startsByRound.keySet());
        ids.addAll(matchlessDatesByRound.keySet());
        for (UUID roundId : ids) {
            List<Instant> starts = startsByRound.getOrDefault(roundId, List.of());
            result.put(roundId, new RoundSpan(
                    starts.stream().filter(java.util.Objects::nonNull).min(Comparator.naturalOrder()).orElse(null),
                    ReopenWindow.latestStart(starts, matchlessDatesByRound.getOrDefault(roundId, List.of()))));
        }
        return result;
    }

    private RoundSpan roundSpan(UUID roundId) {
        return roundSpans(List.of(roundId)).getOrDefault(roundId, RoundSpan.NONE);
    }

    @Override
    @Transactional
    public SectionAvailabilityRoundResponsesDto setPlayerStatus(
            Authentication authentication,
            UUID clubId,
            UUID roundId,
            UUID playerProfileId,
            UUID windowId,
            AvailabilityStatus status) {
        SectionAvailabilityRound round = findRoundOrThrowForClub(clubId, roundId);
        accessService.assertCanAdministerSection(authentication, clubId, round.getSectionId());

        List<SectionAvailabilityResponseRowDto> audience = audienceResolver.resolveAudience(round.getSectionId());
        boolean inAudience = audience.stream().anyMatch(row -> row.playerProfileId().equals(playerProfileId));
        if (!inAudience) {
            throw new NotFoundException(
                    "Player " + playerProfileId + " is not part of this round's own audience");
        }

        SectionAvailabilityWindow window = sectionAvailabilityWindowRepository
                .findById(windowId)
                .filter(candidate -> candidate.getRoundId().equals(roundId))
                .orElseThrow(() -> new NotFoundException(
                        "Window " + windowId + " does not belong to round " + roundId));

        // Admin override is accepted on a closed round too (docs/specs/066): a manager correction.
        // The public endpoint keeps refusing closed-window writes.

        SectionAvailabilityResponse response = sectionAvailabilityResponseRepository
                .findByWindowIdAndPlayerProfileId(window.getId(), playerProfileId)
                .orElseGet(() -> SectionAvailabilityResponse.builder()
                        .windowId(window.getId())
                        .playerProfileId(playerProfileId)
                        .build());
        response.setStatus(status);
        // A manager override clears the "via link" marker (077).
        response.setSource(AnswerSource.MANAGER);
        sectionAvailabilityResponseRepository.save(response);

        return buildResponsesDto(round);
    }

    private void setWindowsOpen(UUID roundId, boolean open) {
        for (SectionAvailabilityWindow window : sectionAvailabilityWindowRepository.findByRoundId(roundId)) {
            window.setOpen(open);
            sectionAvailabilityWindowRepository.save(window);
        }
    }

    private List<SectionAvailabilityWindow> sortedWindowsByRoundId(UUID roundId) {
        return sectionAvailabilityWindowRepository.findByRoundId(roundId).stream()
                .sorted(Comparator.comparing(SectionAvailabilityWindow::getWindowDate)
                        .thenComparing(SectionAvailabilityWindow::getDayPart))
                .toList();
    }

    private void addMatchRowIfQualifies(
            SectionAvailabilityWindow window,
            Match match,
            UUID teamId,
            UUID opponentTeamId,
            String opponentFallbackName,
            List<SectionAvailabilityRoundMatchDto> result) {
        if (teamId == null) {
            return;
        }
        Team team = teamRepository.findById(teamId).orElse(null);
        if (team == null || !team.getSectionId().equals(window.getSectionId())) {
            return;
        }
        String opponentLabel = opponentTeamId != null
                ? teamRepository.findById(opponentTeamId).map(Team::getName).orElse(opponentFallbackName)
                : opponentFallbackName;
        String leagueName = match.getLeagueId() == null ? null : findLeagueName(match.getLeagueId());
        result.add(new SectionAvailabilityRoundMatchDto(
                match.getId(),
                teamId,
                team.getName(),
                opponentLabel,
                match.getMatchDate(),
                match.getVenue(),
                leagueName,
                window.getDayPart(),
                window.getId()));
    }

    private String findLeagueName(UUID leagueId) {
        return leagueRepository.findById(leagueId).map(League::getName).orElse(null);
    }

    private SectionAvailabilityRoundResponsesDto buildResponsesDto(SectionAvailabilityRound round) {
        List<SectionAvailabilityResponseRowDto> audience = audienceResolver.resolveAudience(round.getSectionId());
        List<SectionAvailabilityWindow> windows = sortedWindowsByRoundId(round.getId());

        Map<UUID, Map<UUID, AvailabilityStatus>> statusByWindowThenPlayer = new LinkedHashMap<>();
        Map<UUID, Set<UUID>> viaLinkByWindow = new LinkedHashMap<>();
        List<SectionAvailabilityRoundBracketDto> brackets = new ArrayList<>();
        Map<UUID, List<SectionAvailabilityResponse>> responsesByWindow = new LinkedHashMap<>();
        for (SectionAvailabilityWindow window : windows) {
            responsesByWindow.put(window.getId(), sectionAvailabilityResponseRepository.findByWindowId(window.getId()));
        }
        for (SectionAvailabilityWindow window : windows) {
            Map<UUID, AvailabilityStatus> statusByPlayerId =
                    responsesByWindow.get(window.getId()).stream()
                            .collect(Collectors.toMap(
                                    SectionAvailabilityResponse::getPlayerProfileId,
                                    SectionAvailabilityResponse::getStatus));
            statusByWindowThenPlayer.put(window.getId(), statusByPlayerId);
            viaLinkByWindow.put(window.getId(), responsesByWindow.get(window.getId()).stream()
                    .filter(response -> response.getSource() == AnswerSource.PUBLIC_LINK)
                    .map(SectionAvailabilityResponse::getPlayerProfileId)
                    .collect(Collectors.toSet()));
            long coveredMatchCount =
                    sectionAvailabilityWindowMatchRepository.findByWindowId(window.getId()).size();
            brackets.add(new SectionAvailabilityRoundBracketDto(
                    window.getDayPart(),
                    window.getWindowDate(),
                    window.getId(),
                    countStatus(statusByPlayerId, AvailabilityStatus.AVAILABLE),
                    countStatus(statusByPlayerId, AvailabilityStatus.UNAVAILABLE),
                    countStatus(statusByPlayerId, AvailabilityStatus.UNSURE),
                    audience.size() - statusByPlayerId.size(),
                    coveredMatchCount));
        }

        List<SectionAvailabilityRoundResponseRowDto> rows = audience.stream()
                .map(row -> new SectionAvailabilityRoundResponseRowDto(
                        row.playerProfileId(),
                        row.firstName(),
                        row.lastName(),
                        row.jerseyNumber(),
                        windows.stream()
                                .map(window -> new SectionAvailabilityRoundStatusDto(
                                        window.getId(),
                                        window.getDayPart(),
                                        window.getWindowDate(),
                                        statusByWindowThenPlayer.get(window.getId()).get(row.playerProfileId()),
                                        viaLinkByWindow.get(window.getId()).contains(row.playerProfileId())))
                                .toList()))
                .toList();

        return new SectionAvailabilityRoundResponsesDto(
                round.getId(),
                round.getSectionId(),
                sectionName(round.getSectionId()),
                round.getDescription(),
                round.isOpen(),
                brackets,
                rows,
                "/section-availability/" + round.getId());
    }

    private long countStatus(Map<UUID, AvailabilityStatus> statusByPlayerId, AvailabilityStatus status) {
        return statusByPlayerId.values().stream().filter(value -> value == status).count();
    }

    private SectionAvailabilityRoundDto toDto(SectionAvailabilityRound round) {
        return toDto(round, roundSpan(round.getId()));
    }

    private SectionAvailabilityRoundDto toDto(SectionAvailabilityRound round, RoundSpan span) {
        SectionAvailabilityRoundResponsesDto responses = buildResponsesDto(round);
        Instant now = clock.instant();
        boolean canReopen = AutoCloseSchedule.canReopen(round.isAutoClose(), round.getScheduledCloseAt(), now)
                && ReopenWindow.allows(span.latestStart(), now);
        return sectionAvailabilityRoundMapper.toDto(
                round, responses.sectionName(), span.earliestKickoff(), responses.brackets(), canReopen);
    }

    private String sectionName(UUID sectionId) {
        return sectionRepository.findById(sectionId).map(Section::getName).orElse(null);
    }

    private Section findSectionOrThrowForClub(UUID clubId, UUID sectionId) {
        Section section = sectionRepository
                .findById(sectionId)
                .orElseThrow(() -> new NotFoundException("Section not found: " + sectionId));
        if (!section.getClubId().equals(clubId)) {
            throw new NotFoundException("Section not found: " + sectionId);
        }
        return section;
    }

    private SectionAvailabilityRound findRoundOrThrowForClub(UUID clubId, UUID roundId) {
        SectionAvailabilityRound round = sectionAvailabilityRoundRepository
                .findById(roundId)
                .orElseThrow(() -> new NotFoundException("Section availability round not found: " + roundId));
        if (!round.getClubId().equals(clubId)) {
            throw new NotFoundException("Section availability round not found: " + roundId);
        }
        return round;
    }

    private Match findMatchForCreateOrThrow(UUID clubId, UUID matchId, UUID sectionId) {
        Match match = matchRepository.findById(matchId).orElse(null);
        if (match == null || !match.getClubId().equals(clubId)) {
            throw new ValidationException(
                    "matchId " + matchId + " is not a real match of a team in section " + sectionId);
        }
        return match;
    }

    private Team resolveSectionTeam(Match match, UUID sectionId) {
        Team homeTeam = match.getHomeTeamId() == null
                ? null
                : teamRepository.findById(match.getHomeTeamId()).orElse(null);
        if (homeTeam != null && homeTeam.getSectionId().equals(sectionId)) {
            return homeTeam;
        }
        Team awayTeam = match.getAwayTeamId() == null
                ? null
                : teamRepository.findById(match.getAwayTeamId()).orElse(null);
        if (awayTeam != null && awayTeam.getSectionId().equals(sectionId)) {
            return awayTeam;
        }
        throw new ValidationException("Match " + match.getId() + " does not resolve to a team in section " + sectionId);
    }
}
