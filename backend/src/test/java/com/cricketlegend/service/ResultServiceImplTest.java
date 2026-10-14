package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.LeaguePlayingConditions;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchInnings;
import com.cricketlegend.domain.MatchResult;
import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultDetailLevel;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultStatus;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.MatchResultDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultListCriteria;
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
import com.cricketlegend.repository.PlayingAreaRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.impl.ResultServiceImpl;
import com.cricketlegend.service.support.PlayingAreaMatchResolver;
import com.cricketlegend.service.support.ResultValidator;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * Unit tests for ResultServiceImpl (docs/specs/100-match-results-core.md): draft rules, defaulting of the field and
 * scheduled length, the publish gate and acknowledged warnings, unpublish, delete, validate, and the order of the
 * summary counters. The real {@link ResultValidator} and mapper are used (the rules are tested on their own in
 * ResultValidatorTest); what each counter predicate selects is proved against Postgres in
 * ResultsIntegrationTest.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ResultServiceImplTest {

    @Mock
    private MatchService matchService;

    @Mock
    private MatchResultRepository resultRepository;

    @Mock
    private MatchInningsRepository inningsRepository;

    @Mock
    private PlayingAreaRepository playingAreaRepository;

    @Mock
    private PlayingAreaMatchResolver playingAreaMatchResolver;

    @Mock
    private LeaguePlayingConditionsRepository playingConditionsRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private AccessService accessService;

    private ResultServiceImpl service;

    private final UUID clubId = UUID.randomUUID();
    private final UUID matchId = UUID.randomUUID();
    private final UUID personId = UUID.randomUUID();
    private final Authentication auth = new TestingAuthenticationToken("manager", "n/a");
    private Match match;

    @BeforeEach
    void setUp() {
        service = new ResultServiceImpl(matchService, resultRepository, inningsRepository, playingAreaRepository,
                playingAreaMatchResolver, playingConditionsRepository, teamRepository,
                Mappers.getMapper(MatchResultMapper.class), new ResultValidator(), accessService);
        match = Match.builder().id(matchId).clubId(clubId).homeTeamName("Riverside").awayTeamName("Hillside")
                .seasonId(UUID.randomUUID()).matchDate(Instant.now()).active(true).build();
        when(matchService.requireAdministrableMatch(auth, clubId, matchId)).thenReturn(match);
        when(accessService.resolveCurrentPersonId(auth)).thenReturn(personId);
        when(resultRepository.saveAndFlush(any(MatchResult.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
        when(resultRepository.save(any(MatchResult.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
        when(inningsRepository.saveAll(anyCollection())).thenAnswer(inv -> new ArrayList<MatchInnings>(inv.getArgument(0)));
    }

    private static MatchResult withId(MatchResult result) {
        if (result.getId() == null) {
            result.setId(UUID.randomUUID());
        }
        return result;
    }

    // ---- builders ----

    private static InningsDto inn(ResultSide side, int runs, int wickets) {
        return new InningsDto(null, null, side, runs, wickets, 120, null, null, null);
    }

    private static ResultDraft draft(ResultOutcomeType outcome, ResultSide winner, ResultMarginType type, Integer margin,
            InningsDto... innings) {
        return new ResultDraft(outcome, null, winner, type, margin, null, null, null, null, null, null, null, null,
                List.of(innings));
    }

    private static ResultDraft cleanWin() {
        return draft(ResultOutcomeType.WON, ResultSide.HOME, ResultMarginType.RUNS, 50,
                inn(ResultSide.HOME, 200, 8), inn(ResultSide.AWAY, 150, 10));
    }

    /** A win whose margin contradicts the scores: valid, but with one warning. */
    private static ResultDraft winWithWarning() {
        return draft(ResultOutcomeType.WON, ResultSide.HOME, ResultMarginType.RUNS, 40,
                inn(ResultSide.HOME, 200, 8), inn(ResultSide.AWAY, 150, 10));
    }

    private MatchResult stored(ResultStatus status, ResultDraft contents) {
        UUID id = UUID.randomUUID();
        MatchResult result = MatchResult.builder().id(id).clubId(clubId).matchId(matchId).status(status)
                .detailLevel(ResultDetailLevel.SUMMARY).source("MANUAL").decidedBy(ResultDecidedBy.REGULAR)
                .ballsPerOver(6).outcomeType(contents.outcomeType()).winningSide(contents.winningSide())
                .marginType(contents.marginType()).marginValue(contents.marginValue()).build();
        List<MatchInnings> innings = contents.innings().stream().map(i -> MatchInnings.builder().id(UUID.randomUUID())
                .matchResultId(id).sequence(i.sequence()).kind(i.kind()).battingSide(i.battingSide()).runs(i.runs())
                .wickets(i.wickets()).balls(i.balls()).allOut(Boolean.TRUE.equals(i.allOut())).build()).toList();
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.of(result));
        when(inningsRepository.findByMatchResultIdOrderBySequence(id)).thenReturn(innings);
        return result;
    }

    // ---- upsertDraft ----

    @Test
    void savingANewDraftCreatesAManualDraftAndDoesNotDeleteInnings() {
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.empty());

        MatchResultDto dto = service.upsertDraft(auth, clubId, matchId, cleanWin());

        ArgumentCaptor<MatchResult> saved = ArgumentCaptor.forClass(MatchResult.class);
        verify(resultRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(ResultStatus.DRAFT);
        assertThat(saved.getValue().getSource()).isEqualTo("MANUAL");
        assertThat(saved.getValue().getExternalId()).isNull();
        assertThat(saved.getValue().getClubId()).isEqualTo(clubId);
        assertThat(saved.getValue().getMatchId()).isEqualTo(matchId);
        assertThat(saved.getValue().getDetailLevel()).isEqualTo(ResultDetailLevel.SUMMARY);
        assertThat(saved.getValue().getUpdatedBy()).isEqualTo(personId);
        assertThat(dto.innings()).hasSize(2);
        verify(inningsRepository, never()).deleteByMatchResultId(any());
    }

    @Test
    void savingOverAnExistingDraftReplacesItsInningsAndKeepsTheSameRow() {
        MatchResult existing = stored(ResultStatus.DRAFT, draft(null, null, null, null));

        service.upsertDraft(auth, clubId, matchId, cleanWin());

        verify(inningsRepository).deleteByMatchResultId(existing.getId());
        ArgumentCaptor<MatchResult> saved = ArgumentCaptor.forClass(MatchResult.class);
        verify(resultRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue()).isSameAs(existing);
        assertThat(saved.getValue().getOutcomeType()).isEqualTo(ResultOutcomeType.WON);
    }

    @Test
    void aPartialDraftWithNothingInItIsSaved() {
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.empty());
        MatchResultDto dto = service.upsertDraft(auth, clubId, matchId, draft(null, null, null, null));
        assertThat(dto.outcomeType()).isNull();
        assertThat(dto.status()).isEqualTo(ResultStatus.DRAFT);
    }

    @Test
    void aPublishedResultCannotBeEdited() {
        stored(ResultStatus.PUBLISHED, cleanWin());
        assertThatThrownBy(() -> service.upsertDraft(auth, clubId, matchId, cleanWin()))
                .isInstanceOf(ResultPublishedException.class);
        verify(resultRepository, never()).saveAndFlush(any());
    }

    @Test
    void aStructurallyInvalidDraftIsRefusedAndNothingIsWritten() {
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.empty());
        ResultDraft bad = draft(ResultOutcomeType.WON, ResultSide.HOME, ResultMarginType.WICKETS, 12);

        assertThatThrownBy(() -> service.upsertDraft(auth, clubId, matchId, bad))
                .isInstanceOfSatisfying(InvalidResultException.class, e -> assertThat(e.getErrors())
                        .containsExactly("A win by wickets cannot be by more than 10 wickets."));
        verify(resultRepository, never()).saveAndFlush(any());
    }

    @Test
    void aMatchInTheFutureCanHaveAResultCaptured() {
        // no clock rule: a future-dated match is as capturable as a past one
        match.setMatchDate(Instant.now().plusSeconds(60L * 60 * 24 * 30));
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.empty());
        assertThat(service.upsertDraft(auth, clubId, matchId, cleanWin()).status()).isEqualTo(ResultStatus.DRAFT);
    }

    @Test
    void anInactiveMatchIsRefusedForEverySaveAndPublish() {
        match.setActive(false);
        assertThatThrownBy(() -> service.upsertDraft(auth, clubId, matchId, cleanWin()))
                .isInstanceOf(MatchNotCapturableException.class);
        assertThatThrownBy(() -> service.publish(auth, clubId, matchId, true))
                .isInstanceOf(MatchNotCapturableException.class);
        verify(resultRepository, never()).saveAndFlush(any());
        verify(resultRepository, never()).save(any());
    }

    @Test
    void aRaceOnTheUniqueMatchBecomesAConflict() {
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.empty());
        when(resultRepository.saveAndFlush(any(MatchResult.class))).thenThrow(new DataIntegrityViolationException("dup"));
        assertThatThrownBy(() -> service.upsertDraft(auth, clubId, matchId, cleanWin()))
                .isInstanceOf(ResultAlreadyExistsException.class);
    }

    // ---- defaulting ----

    @Test
    void theFieldDefaultsToTheMatchsFieldAndTheScheduledLengthToTheLeaguesMaxOvers() {
        UUID fieldId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        match.setPlayingAreaId(fieldId);
        match.setLeagueId(leagueId);
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.empty());
        when(playingConditionsRepository.findByLeagueIdAndSeasonId(leagueId, match.getSeasonId()))
                .thenReturn(Optional.of(LeaguePlayingConditions.builder().maxOversPerInnings(40).build()));

        service.upsertDraft(auth, clubId, matchId, cleanWin());

        ArgumentCaptor<MatchResult> saved = ArgumentCaptor.forClass(MatchResult.class);
        verify(resultRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getPlayingAreaId()).isEqualTo(fieldId);
        assertThat(saved.getValue().getScheduledBalls()).isEqualTo(240);
    }

    @Test
    void scheduledLengthUsesTheDraftsBallsPerOver() {
        UUID leagueId = UUID.randomUUID();
        match.setLeagueId(leagueId);
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.empty());
        when(playingConditionsRepository.findByLeagueIdAndSeasonId(leagueId, match.getSeasonId()))
                .thenReturn(Optional.of(LeaguePlayingConditions.builder().maxOversPerInnings(20).build()));
        ResultDraft eightBall = new ResultDraft(null, null, null, null, null, null, null, null, 8, null, null, null,
                null, null);

        service.upsertDraft(auth, clubId, matchId, eightBall);

        ArgumentCaptor<MatchResult> saved = ArgumentCaptor.forClass(MatchResult.class);
        verify(resultRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getScheduledBalls()).isEqualTo(160);
        assertThat(saved.getValue().getBallsPerOver()).isEqualTo(8);
    }

    @Test
    void noLeagueOrNoConditionsLeavesTheScheduledLengthEmpty() {
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.empty());
        service.upsertDraft(auth, clubId, matchId, cleanWin());
        ArgumentCaptor<MatchResult> saved = ArgumentCaptor.forClass(MatchResult.class);
        verify(resultRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getScheduledBalls()).isNull();
        assertThat(saved.getValue().getPlayingAreaId()).isNull();
    }

    @Test
    void aValueTheDraftSuppliesIsNotOverriddenByTheDefaults() {
        UUID matchField = UUID.randomUUID();
        UUID chosenField = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        match.setPlayingAreaId(matchField);
        match.setLeagueId(leagueId);
        PlayingArea chosen = PlayingArea.builder().id(chosenField).build();
        when(playingAreaMatchResolver.resolveForMatch(chosenField)).thenReturn(chosen);
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.empty());
        when(playingConditionsRepository.findByLeagueIdAndSeasonId(leagueId, match.getSeasonId()))
                .thenReturn(Optional.of(LeaguePlayingConditions.builder().maxOversPerInnings(40).build()));
        ResultDraft d = new ResultDraft(null, null, null, null, null, null, null, 100, null, null, null, chosenField,
                null, null);

        service.upsertDraft(auth, clubId, matchId, d);

        ArgumentCaptor<MatchResult> saved = ArgumentCaptor.forClass(MatchResult.class);
        verify(resultRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getPlayingAreaId()).isEqualTo(chosenField);
        assertThat(saved.getValue().getScheduledBalls()).isEqualTo(100);
    }

    // ---- publish ----

    @Test
    void publishingACleanDraftMarksItPublishedWithoutAcknowledgement() {
        MatchResult result = stored(ResultStatus.DRAFT, cleanWin());

        MatchResultDto dto = service.publish(auth, clubId, matchId, false);

        assertThat(dto.status()).isEqualTo(ResultStatus.PUBLISHED);
        assertThat(result.getPublishedAt()).isNotNull();
        assertThat(result.getPublishedBy()).isEqualTo(personId);
        assertThat(result.getUpdatedBy()).isEqualTo(personId);
    }

    @Test
    void publishingAnInvalidDraftIsRefusedWithPlainEnglishErrors() {
        MatchResult result = stored(ResultStatus.DRAFT, draft(ResultOutcomeType.WON, null, null, null));

        assertThatThrownBy(() -> service.publish(auth, clubId, matchId, true))
                .isInstanceOfSatisfying(InvalidResultException.class, e -> assertThat(e.getErrors())
                        .contains("Choose which side won.", "Enter the margin of victory (runs or wickets)."));
        assertThat(result.getStatus()).isEqualTo(ResultStatus.DRAFT);
        verify(resultRepository, never()).save(any());
    }

    @Test
    void publishingADraftWithNoOutcomeIsRefused() {
        stored(ResultStatus.DRAFT, draft(null, null, null, null));
        assertThatThrownBy(() -> service.publish(auth, clubId, matchId, true))
                .isInstanceOfSatisfying(InvalidResultException.class,
                        e -> assertThat(e.getErrors()).containsExactly("Choose how the match ended."));
    }

    @Test
    void warningsNeedAcknowledgementToPublish() {
        MatchResult result = stored(ResultStatus.DRAFT, winWithWarning());

        assertThatThrownBy(() -> service.publish(auth, clubId, matchId, false))
                .isInstanceOfSatisfying(InvalidResultException.class, e -> {
                    assertThat(e.getErrors()).isEmpty();
                    assertThat(e.getWarnings()).containsExactly("The scores differ by 50 runs, but the margin is 40 runs.");
                });
        assertThat(result.getStatus()).isEqualTo(ResultStatus.DRAFT);

        assertThat(service.publish(auth, clubId, matchId, true).status()).isEqualTo(ResultStatus.PUBLISHED);
    }

    @Test
    void errorsStillBlockPublishingEvenWhenWarningsAreAcknowledged() {
        stored(ResultStatus.DRAFT, draft(ResultOutcomeType.TIE, ResultSide.HOME, null, null,
                inn(ResultSide.HOME, 100, 10), inn(ResultSide.AWAY, 90, 10)));
        assertThatThrownBy(() -> service.publish(auth, clubId, matchId, true))
                .isInstanceOfSatisfying(InvalidResultException.class,
                        e -> assertThat(e.getErrors()).containsExactly("A tie has no winning side."));
    }

    @Test
    void publishingAnAlreadyPublishedResultIsAConflict() {
        stored(ResultStatus.PUBLISHED, cleanWin());
        assertThatThrownBy(() -> service.publish(auth, clubId, matchId, true))
                .isInstanceOf(ResultPublishedException.class);
    }

    @Test
    void publishingWhenThereIsNoResultIsNotFound() {
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.publish(auth, clubId, matchId, true)).isInstanceOf(NotFoundException.class);
    }

    // ---- unpublish and delete ----

    @Test
    void unpublishingReturnsTheResultToDraftAndClearsThePublishFields() {
        MatchResult result = stored(ResultStatus.PUBLISHED, cleanWin());
        result.setPublishedAt(Instant.now());
        result.setPublishedBy(UUID.randomUUID());

        MatchResultDto dto = service.unpublish(auth, clubId, matchId);

        assertThat(dto.status()).isEqualTo(ResultStatus.DRAFT);
        assertThat(result.getPublishedAt()).isNull();
        assertThat(result.getPublishedBy()).isNull();
    }

    @Test
    void unpublishingADraftIsAnInvalidTransition() {
        stored(ResultStatus.DRAFT, cleanWin());
        assertThatThrownBy(() -> service.unpublish(auth, clubId, matchId))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void aDraftCanBeDeletedWithItsInnings() {
        MatchResult result = stored(ResultStatus.DRAFT, cleanWin());
        service.deleteDraft(auth, clubId, matchId);
        verify(inningsRepository).deleteByMatchResultId(result.getId());
        verify(resultRepository).delete(result);
    }

    @Test
    void aPublishedResultCannotBeDeleted() {
        stored(ResultStatus.PUBLISHED, cleanWin());
        assertThatThrownBy(() -> service.deleteDraft(auth, clubId, matchId)).isInstanceOf(ResultPublishedException.class);
        verify(resultRepository, never()).delete(org.mockito.ArgumentMatchers.<MatchResult>any());
    }

    @Test
    void deletingWithNoResultIsNotFound() {
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.deleteDraft(auth, clubId, matchId)).isInstanceOf(NotFoundException.class);
    }

    // ---- validate and get ----

    @Test
    void validatingABodyDoesNotTouchTheStoredResult() {
        ResultValidationDto result = service.validate(auth, clubId, matchId, winWithWarning());
        assertThat(result.canPublish()).isTrue();
        assertThat(result.warnings()).hasSize(1);
        verify(resultRepository, never()).findByMatchId(any());
        verify(resultRepository, never()).saveAndFlush(any());
        verify(resultRepository, never()).save(any());
    }

    @Test
    void validatingWithoutABodyChecksTheStoredDraftWithRealSideNames() {
        stored(ResultStatus.DRAFT, draft(ResultOutcomeType.WON, ResultSide.AWAY, ResultMarginType.WICKETS, 3,
                inn(ResultSide.HOME, 200, 8), inn(ResultSide.AWAY, 150, 10)));
        ResultValidationDto result = service.validate(auth, clubId, matchId, null);
        assertThat(result.warnings()).containsExactly("Riverside scored more, but Hillside is marked as the winner.");
    }

    @Test
    void validatingWithoutABodyAndWithoutAStoredResultIsNotFound() {
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.validate(auth, clubId, matchId, null)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void getReturnsTheInningsWithDisplayOvers() {
        stored(ResultStatus.DRAFT, draft(ResultOutcomeType.WON, ResultSide.HOME, ResultMarginType.RUNS, 1,
                new InningsDto(1, InningsKind.REGULAR, ResultSide.HOME, 100, 5, 220, null, false, null)));
        MatchResultDto dto = service.get(auth, clubId, matchId);
        assertThat(dto.innings()).singleElement().satisfies(i -> assertThat(i.oversDisplay()).isEqualTo("36.4"));
    }

    @Test
    void everyEntryPointGoesThroughTheMatchSectionGate() {
        stored(ResultStatus.DRAFT, cleanWin());
        service.get(auth, clubId, matchId);
        service.validate(auth, clubId, matchId, null);
        verify(matchService, org.mockito.Mockito.times(2)).requireAdministrableMatch(auth, clubId, matchId);
    }

    // ---- summary ----

    @Test
    @SuppressWarnings("unchecked")
    void summaryMapsTheSixCountersInTheDocumentedOrder() {
        when(matchService.countMatching(any(), any(), any(), any(), any(), any(), any(), any(Specification.class)))
                .thenReturn(1L, 2L, 3L, 4L, 5L, 6L);

        ResultsSummaryDto dto = service.summary(auth, clubId,
                new ResultListCriteria(null, null, null, null, null, null, null, null, null, null));

        assertThat(dto).isEqualTo(new ResultsSummaryDto(1, 2, 3, 4, 5, 6));
    }

    @Test
    @SuppressWarnings("unchecked")
    void listSkipsTheResultQueriesWhenThereAreNoMatches() {
        when(matchService.listMatching(any(), any(), any(), any(), any(), any(), any(), any(Specification.class), any()))
                .thenReturn(org.springframework.data.domain.Page.empty());

        var page = service.list(auth, clubId,
                new ResultListCriteria(null, null, null, null, null, null, null, null, null, null), PageRequest.of(0, 10));

        assertThat(page.getContent()).isEmpty();
        verify(resultRepository, never()).findAllByMatchIdIn(any());
    }
}
