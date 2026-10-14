package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.LeaguePlayingConditions;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchInnings;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.MatchResult;
import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.ResultDetailLevel;
import com.cricketlegend.domain.ResultListFocus;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultStatus;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.MatchFilterOptionsDto;
import com.cricketlegend.dto.MatchResultDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultIssueDto;
import com.cricketlegend.dto.ResultListCriteria;
import com.cricketlegend.dto.ResultListItemDto;
import com.cricketlegend.dto.ResultValidationDto;
import com.cricketlegend.dto.ResultsSummaryDto;
import com.cricketlegend.exception.InvalidResultException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.MatchNotCapturableException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ResultAlreadyExistsException;
import com.cricketlegend.exception.ResultPublishedException;
import com.cricketlegend.mapper.MatchResultMapper;
import com.cricketlegend.repository.LeaguePlayingConditionsRepository;
import com.cricketlegend.repository.MatchInningsRepository;
import com.cricketlegend.repository.MatchResultRepository;
import com.cricketlegend.repository.MatchSpecifications;
import com.cricketlegend.repository.PlayingAreaRepository;
import com.cricketlegend.repository.ResultPlayerRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.MatchService;
import com.cricketlegend.service.ResultService;
import com.cricketlegend.service.ScorecardService;
import com.cricketlegend.service.support.MatchSideNames;
import com.cricketlegend.service.support.PlayingAreaMatchResolver;
import com.cricketlegend.service.support.ResultValidator;
import com.cricketlegend.service.support.ServerClock;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/100-match-results-core.md. The list is a Matches page (the shared filter, section and sort pipeline in
 * {@link MatchService#listMatching}) narrowed to matches with a result, with the results batch-loaded afterwards, so
 * there is no second query stack. Writes reuse {@link MatchService#requireAdministrableMatch}, the Matches per-match
 * section gate. Saving enforces structural validity only; the outcome rules run on validate and publish
 * ({@link ResultValidator}, the one place they live).
 */
@Service
public class ResultServiceImpl implements ResultService {

    private static final String SOURCE_MANUAL = "MANUAL";
    private static final List<ResultOutcomeType> TIED_OR_NONE = List.of(
            ResultOutcomeType.TIE, ResultOutcomeType.DRAW, ResultOutcomeType.NO_RESULT, ResultOutcomeType.ABANDONED);

    private final MatchService matchService;
    private final MatchResultRepository resultRepository;
    private final MatchInningsRepository inningsRepository;
    private final PlayingAreaRepository playingAreaRepository;
    private final PlayingAreaMatchResolver playingAreaMatchResolver;
    private final LeaguePlayingConditionsRepository playingConditionsRepository;
    private final TeamRepository teamRepository;
    private final MatchResultMapper mapper;
    private final ResultValidator validator;
    private final AccessService accessService;
    private final ScorecardService scorecardService;
    private final ResultPlayerRepository resultPlayerRepository;

    public ResultServiceImpl(
            MatchService matchService,
            MatchResultRepository resultRepository,
            MatchInningsRepository inningsRepository,
            PlayingAreaRepository playingAreaRepository,
            PlayingAreaMatchResolver playingAreaMatchResolver,
            LeaguePlayingConditionsRepository playingConditionsRepository,
            TeamRepository teamRepository,
            MatchResultMapper mapper,
            ResultValidator validator,
            AccessService accessService,
            ScorecardService scorecardService,
            ResultPlayerRepository resultPlayerRepository) {
        this.matchService = matchService;
        this.resultRepository = resultRepository;
        this.inningsRepository = inningsRepository;
        this.playingAreaRepository = playingAreaRepository;
        this.playingAreaMatchResolver = playingAreaMatchResolver;
        this.playingConditionsRepository = playingConditionsRepository;
        this.teamRepository = teamRepository;
        this.mapper = mapper;
        this.validator = validator;
        this.accessService = accessService;
        this.scorecardService = scorecardService;
        this.resultPlayerRepository = resultPlayerRepository;
    }

    // ---- lists ----

    @Override
    @Transactional(readOnly = true)
    public Page<ResultListItemDto> list(
            Authentication authentication, UUID clubId, ResultListCriteria criteria, Pageable pageable) {
        Specification<Match> extra = dateRange(criteria).and(MatchSpecifications.hasResult(criteria.status()));
        if (criteria.outcomes() != null && !criteria.outcomes().isEmpty()) {
            extra = extra.and(MatchSpecifications.resultOutcomeIn(criteria.outcomes(), criteria.status()));
        }
        if (criteria.focus() != null) {
            extra = extra.and(focus(criteria.focus(), clubId, criteria.teamId()));
        }
        Page<MatchDto> matches = matchService.listMatching(
                authentication, clubId, criteria.sectionId(), criteria.search(), criteria.leagueId(),
                criteria.seasonId(), criteria.teamId(), extra, pageable);
        Map<UUID, MatchResultDto> resultsByMatchId = resultsFor(matches.getContent());
        Map<UUID, String> playersOfTheMatch = scorecardService.playersOfTheMatch(
                resultsByMatchId.values().stream().map(MatchResultDto::id).toList());
        return matches.map(match -> {
            MatchResultDto result = resultsByMatchId.get(match.id());
            return new ResultListItemDto(match, result, result == null ? null : playersOfTheMatch.get(result.id()));
        });
    }

    @Override
    @Transactional(readOnly = true)
    public Page<MatchDto> awaiting(
            Authentication authentication, UUID clubId, ResultListCriteria criteria, boolean includeUpcoming,
            Pageable pageable) {
        return matchService.listMatching(
                authentication, clubId, criteria.sectionId(), criteria.search(), criteria.leagueId(),
                criteria.seasonId(), criteria.teamId(), awaitingSpecification(criteria, includeUpcoming), pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public ResultsSummaryDto summary(Authentication authentication, UUID clubId, ResultListCriteria criteria) {
        Specification<Match> range = dateRange(criteria);
        return new ResultsSummaryDto(
                count(authentication, clubId, criteria, range.and(focus(ResultListFocus.PLAYED, clubId, criteria.teamId()))),
                count(authentication, clubId, criteria, range.and(focus(ResultListFocus.WON, clubId, criteria.teamId()))),
                count(authentication, clubId, criteria, range.and(focus(ResultListFocus.LOST, clubId, criteria.teamId()))),
                count(authentication, clubId, criteria,
                        range.and(focus(ResultListFocus.TIED_OR_NONE, clubId, criteria.teamId()))),
                count(authentication, clubId, criteria, range.and(focus(ResultListFocus.DRAFTS, clubId, criteria.teamId()))),
                count(authentication, clubId, criteria, awaitingSpecification(criteria, false)));
    }

    @Override
    @Transactional(readOnly = true)
    public MatchFilterOptionsDto filterOptions(Authentication authentication, UUID clubId, ResultListCriteria criteria) {
        return matchService.filterOptions(
                authentication, clubId, criteria.sectionId(), criteria.leagueId(), criteria.seasonId(), criteria.teamId(),
                criteria.search(), false);
    }

    private long count(Authentication authentication, UUID clubId, ResultListCriteria criteria, Specification<Match> extra) {
        return matchService.countMatching(
                authentication, clubId, criteria.sectionId(), criteria.search(), criteria.leagueId(), criteria.seasonId(),
                criteria.teamId(), extra);
    }

    /** The one definition of each Results quick filter, shared by the list and the counters. */
    private Specification<Match> focus(ResultListFocus focus, UUID clubId, UUID teamId) {
        // An if-chain, not a switch: an enum switch compiles to a synthetic class that the service.impl naming rule rejects.
        if (focus == ResultListFocus.WON) {
            return MatchSpecifications.wonByOwnSide(clubId, teamId);
        }
        if (focus == ResultListFocus.LOST) {
            return MatchSpecifications.lostByOwnSide(clubId, teamId);
        }
        if (focus == ResultListFocus.TIED_OR_NONE) {
            return MatchSpecifications.resultOutcomeIn(TIED_OR_NONE, ResultStatus.PUBLISHED);
        }
        if (focus == ResultListFocus.DRAFTS) {
            return MatchSpecifications.hasResult(ResultStatus.DRAFT);
        }
        return MatchSpecifications.hasResult(ResultStatus.PUBLISHED);
    }

    /** Active matches with no result; up to the end of today unless upcoming ones are included. */
    private Specification<Match> awaitingSpecification(ResultListCriteria criteria, boolean includeUpcoming) {
        Specification<Match> spec = dateRange(criteria).and(MatchSpecifications.noResult()).and(MatchSpecifications.active());
        return includeUpcoming ? spec : spec.and(MatchSpecifications.matchDateBefore(ServerClock.startOfDayFromToday(1)));
    }

    /** Inclusive {@code from}/{@code to} server-local days as a half-open instant range. */
    private Specification<Match> dateRange(ResultListCriteria criteria) {
        Instant from = criteria.from() == null ? null : ServerClock.startOfDay(criteria.from());
        Instant to = criteria.to() == null ? null : ServerClock.startOfDay(criteria.to().plusDays(1));
        return MatchSpecifications.matchDateBetween(from, to);
    }

    // ---- reads ----

    @Override
    @Transactional(readOnly = true)
    public MatchResultDto get(Authentication authentication, UUID clubId, UUID matchId) {
        matchService.requireAdministrableMatch(authentication, clubId, matchId);
        return toDto(findResultOrThrow(matchId));
    }

    // ---- writes ----

    @Override
    @Transactional
    public MatchResultDto upsertDraft(Authentication authentication, UUID clubId, UUID matchId, ResultDraft draft) {
        Match match = matchService.requireAdministrableMatch(authentication, clubId, matchId);
        assertCapturable(match);
        List<ResultIssueDto> structural = validator.structuralIssueList(draft);
        if (!structural.isEmpty()) {
            throw new InvalidResultException(
                    "The result cannot be saved as entered.", structural.stream().map(ResultIssueDto::message).toList(),
                    List.of(), structural);
        }
        MatchResult existing = resultRepository.findByMatchId(matchId).orElse(null);
        if (existing != null && existing.getStatus() == ResultStatus.PUBLISHED) {
            throw new ResultPublishedException("This result is published: unpublish it before changing it.");
        }

        PlayingArea chosenField =
                draft.playingAreaId() == null ? null : playingAreaMatchResolver.resolveForMatch(draft.playingAreaId());
        ResultDraft withDefaults = draft.withDefaults(
                match.getPlayingAreaId(), defaultScheduledBalls(match, draft.ballsPerOver()));

        MatchResult result = existing != null
                ? existing
                : MatchResult.builder()
                        .clubId(clubId)
                        .matchId(matchId)
                        .status(ResultStatus.DRAFT)
                        .detailLevel(ResultDetailLevel.SUMMARY)
                        .source(SOURCE_MANUAL)
                        .build();
        mapper.applyDraft(withDefaults, result);
        result.setDetailLevel(detailLevelFor(existing, draft));
        if (chosenField != null) {
            result.setPlayingAreaId(chosenField.getId());
        }
        UUID person = accessService.resolveCurrentPersonId(authentication);
        result.setUpdatedBy(person);

        MatchResult saved;
        try {
            saved = resultRepository.saveAndFlush(result);
        } catch (DataIntegrityViolationException e) {
            throw new ResultAlreadyExistsException("This match already has a result.");
        }
        List<MatchInnings> innings = reconcileInnings(saved.getId(), withDefaults.innings(), existing != null);
        if (draft.scorecard() != null) {
            scorecardService.replace(saved.getId(), clubId, match, draft.scorecard(), person);
        }
        return toDto(saved, innings);
    }

    /**
     * Brings the stored innings in line with the draft in place (docs/specs/101): an innings is matched on its kind and
     * batting side (in sequence order when a side has several), keeps its id and so its scorecard rows, and takes the new
     * sequence and figures; innings no longer in the draft are deleted with their entries. The sequence uniqueness is
     * deferred, so a toss-driven resequence needs no ordering.
     */
    private List<MatchInnings> reconcileInnings(UUID resultId, List<InningsDto> wanted, boolean hasStored) {
        Map<String, Deque<MatchInnings>> pool = new HashMap<>();
        if (hasStored) {
            for (MatchInnings stored : inningsRepository.findByMatchResultIdOrderBySequence(resultId)) {
                pool.computeIfAbsent(inningsKey(stored.getKind(), stored.getBattingSide()), k -> new ArrayDeque<>())
                        .add(stored);
            }
        }
        List<MatchInnings> kept = new ArrayList<>();
        for (InningsDto dto : wanted) {
            Deque<MatchInnings> candidates = pool.get(inningsKey(dto.kind(), dto.battingSide()));
            MatchInnings entity = candidates == null ? null : candidates.poll();
            if (entity == null) {
                entity = mapper.toInningsEntity(dto);
                entity.setMatchResultId(resultId);
            } else {
                mapper.updateInnings(dto, entity);
            }
            kept.add(entity);
        }
        List<MatchInnings> removed = pool.values().stream().flatMap(Deque::stream).toList();
        if (!removed.isEmpty()) {
            inningsRepository.deleteAll(removed);
        }
        List<MatchInnings> saved = inningsRepository.saveAll(kept);
        inningsRepository.flush();
        return saved.stream().sorted(Comparator.comparingInt(MatchInnings::getSequence)).toList();
    }

    private static String inningsKey(InningsKind kind, ResultSide side) {
        return kind + ":" + side;
    }

    /** OUR_SIDE once there is a scorecard, else SUMMARY; FULL (slice 102) is never lowered. */
    private ResultDetailLevel detailLevelFor(MatchResult existing, ResultDraft draft) {
        if (existing != null && existing.getDetailLevel() == ResultDetailLevel.FULL) {
            return ResultDetailLevel.FULL;
        }
        boolean hasScorecard = draft.scorecard() != null
                ? !draft.scorecard().isEmpty()
                : existing != null && resultPlayerRepository.existsByMatchResultId(existing.getId());
        return hasScorecard ? ResultDetailLevel.OUR_SIDE : ResultDetailLevel.SUMMARY;
    }

    @Override
    @Transactional(readOnly = true)
    public ResultValidationDto validate(Authentication authentication, UUID clubId, UUID matchId, ResultDraft draft) {
        Match match = matchService.requireAdministrableMatch(authentication, clubId, matchId);
        ResultDraft subject = draft != null ? draft : storedDraft(findResultOrThrow(matchId), match);
        return validateAgainst(match, subject);
    }

    @Override
    @Transactional
    public MatchResultDto publish(Authentication authentication, UUID clubId, UUID matchId, boolean acknowledgedWarnings) {
        Match match = matchService.requireAdministrableMatch(authentication, clubId, matchId);
        assertCapturable(match);
        MatchResult result = findResultOrThrow(matchId);
        if (result.getStatus() == ResultStatus.PUBLISHED) {
            throw new ResultPublishedException("This result is already published.");
        }
        ResultValidationDto validation = validateAgainst(match, storedDraft(result, match));
        if (!validation.canPublish()) {
            throw new InvalidResultException(
                    "This result cannot be published yet.", validation.errors(), validation.warnings(),
                    validation.issues());
        }
        if (!validation.warnings().isEmpty() && !acknowledgedWarnings) {
            throw new InvalidResultException(
                    "Acknowledge the warnings to publish this result.", List.of(), validation.warnings(),
                    validation.issues());
        }
        UUID person = accessService.resolveCurrentPersonId(authentication);
        result.setStatus(ResultStatus.PUBLISHED);
        result.setPublishedAt(ServerClock.now());
        result.setPublishedBy(person);
        result.setUpdatedBy(person);
        scorecardService.freezeFeatured(result.getId(), match);
        return toDto(resultRepository.save(result));
    }

    @Override
    @Transactional
    public MatchResultDto unpublish(Authentication authentication, UUID clubId, UUID matchId) {
        matchService.requireAdministrableMatch(authentication, clubId, matchId);
        MatchResult result = findResultOrThrow(matchId);
        if (result.getStatus() != ResultStatus.PUBLISHED) {
            throw new InvalidStatusTransitionException("Result is not published: " + matchId);
        }
        result.setStatus(ResultStatus.DRAFT);
        result.setPublishedAt(null);
        result.setPublishedBy(null);
        result.setUpdatedBy(accessService.resolveCurrentPersonId(authentication));
        scorecardService.clearFeatured(result.getId());
        return toDto(resultRepository.save(result));
    }

    @Override
    @Transactional
    public void deleteDraft(Authentication authentication, UUID clubId, UUID matchId) {
        matchService.requireAdministrableMatch(authentication, clubId, matchId);
        MatchResult result = findResultOrThrow(matchId);
        if (result.getStatus() == ResultStatus.PUBLISHED) {
            throw new ResultPublishedException("This result is published: unpublish it before deleting it.");
        }
        inningsRepository.deleteByMatchResultId(result.getId());
        resultRepository.delete(result);
    }

    // ---- helpers ----

    private void assertCapturable(Match match) {
        if (!match.isActive()) {
            throw new MatchNotCapturableException("This match is inactive: reactivate it before capturing a result.");
        }
    }

    private MatchResult findResultOrThrow(UUID matchId) {
        return resultRepository
                .findByMatchId(matchId)
                .orElseThrow(() -> new NotFoundException("No result for match: " + matchId));
    }

    private ResultValidationDto validateAgainst(Match match, ResultDraft draft) {
        Set<UUID> teamIds = new HashSet<>();
        if (match.getHomeTeamId() != null) {
            teamIds.add(match.getHomeTeamId());
        }
        if (match.getAwayTeamId() != null) {
            teamIds.add(match.getAwayTeamId());
        }
        Map<UUID, Team> teamsById = teamIds.isEmpty()
                ? Map.of()
                : teamRepository.findAllById(teamIds).stream().collect(Collectors.toMap(Team::getId, t -> t));
        return validator.validate(
                draft, MatchSideNames.home(match, teamsById), MatchSideNames.away(match, teamsById),
                scorecardService.validationContext(match, draft));
    }

    private ResultDraft storedDraft(MatchResult result, Match match) {
        return mapper.toDraft(result, inningsRepository.findByMatchResultIdOrderBySequence(result.getId()))
                .copyWithScorecard(scorecardService.load(result.getId(), match));
    }

    /** The league's maximum overs per innings in balls, when the match has a league with that figure on file. */
    private Integer defaultScheduledBalls(Match match, int ballsPerOver) {
        if (match.getLeagueId() == null) {
            return null;
        }
        return playingConditionsRepository
                .findByLeagueIdAndSeasonId(match.getLeagueId(), match.getSeasonId())
                .map(LeaguePlayingConditions::getMaxOversPerInnings)
                .filter(Objects::nonNull)
                .map(overs -> overs * ballsPerOver)
                .orElse(null);
    }

    private MatchResultDto toDto(MatchResult result) {
        return toDto(result, inningsRepository.findByMatchResultIdOrderBySequence(result.getId()));
    }

    private MatchResultDto toDto(MatchResult result, List<MatchInnings> innings) {
        MatchResultDto dto = mapper.toDto(result, innings)
                .copyWithHasScorecard(resultPlayerRepository.existsByMatchResultId(result.getId()));
        if (result.getPlayingAreaId() == null) {
            return dto;
        }
        return dto.withPlayingAreaName(playingAreaRepository.findById(result.getPlayingAreaId())
                .map(PlayingArea::getName)
                .orElse(null));
    }

    /** The results of a page of matches in three batched queries (results, innings, field names). */
    private Map<UUID, MatchResultDto> resultsFor(List<MatchDto> matches) {
        Map<UUID, MatchResultDto> byMatchId = new HashMap<>();
        if (matches.isEmpty()) {
            return byMatchId;
        }
        List<MatchResult> results = resultRepository.findAllByMatchIdIn(matches.stream().map(MatchDto::id).toList());
        Map<UUID, List<MatchInnings>> inningsByResultId = results.isEmpty()
                ? Map.of()
                : inningsRepository
                        .findByMatchResultIdInOrderBySequence(results.stream().map(MatchResult::getId).toList())
                        .stream()
                        .collect(Collectors.groupingBy(MatchInnings::getMatchResultId));
        Set<UUID> areaIds = results.stream()
                .map(MatchResult::getPlayingAreaId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, String> areaNames = areaIds.isEmpty()
                ? Map.of()
                : playingAreaRepository.findAllById(areaIds).stream()
                        .collect(Collectors.toMap(PlayingArea::getId, PlayingArea::getName));
        Set<UUID> withScorecard = results.isEmpty()
                ? Set.of()
                : resultPlayerRepository.findByMatchResultIdIn(results.stream().map(MatchResult::getId).toList())
                        .stream()
                        .map(p -> p.getMatchResultId())
                        .collect(Collectors.toSet());
        for (MatchResult result : results) {
            MatchResultDto dto = mapper.toDto(result, inningsByResultId.getOrDefault(result.getId(), List.of()))
                    .copyWithHasScorecard(withScorecard.contains(result.getId()));
            byMatchId.put(result.getMatchId(), dto.withPlayingAreaName(
                    result.getPlayingAreaId() == null ? null : areaNames.get(result.getPlayingAreaId())));
        }
        return byMatchId;
    }
}
