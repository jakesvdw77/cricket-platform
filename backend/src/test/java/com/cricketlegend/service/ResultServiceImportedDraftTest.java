package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchInnings;
import com.cricketlegend.domain.MatchResult;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultDetailLevel;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultStatus;
import com.cricketlegend.dto.ExistingResultDto;
import com.cricketlegend.dto.ImportOrigin;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ScorecardDto;
import com.cricketlegend.exception.ImportExternalIdAlreadyUsedException;
import com.cricketlegend.exception.ResultAlreadyExistsException;
import com.cricketlegend.exception.ResultPublishedException;
import com.cricketlegend.mapper.MatchResultMapper;
import com.cricketlegend.repository.LeaguePlayingConditionsRepository;
import com.cricketlegend.repository.MatchInningsRepository;
import com.cricketlegend.repository.MatchResultRepository;
import com.cricketlegend.repository.PlayingAreaRepository;
import com.cricketlegend.repository.ResultPlayerRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.impl.ResultServiceImpl;
import com.cricketlegend.service.support.PlayingAreaMatchResolver;
import com.cricketlegend.service.support.ResultValidator;
import com.cricketlegend.service.support.ScorecardContext;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/104, {@code ResultService.saveImportedDraft}: sets {@code source} and {@code external_id}, refuses a
 * published result, replaces the draft in place on a re-import, maps the unique-constraint failure to
 * {@code ImportExternalIdAlreadyUsedException} by constraint name, and the normal save never takes source fields. Also
 * the two read-only summaries the import service uses. The real validator and mapper run.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ResultServiceImportedDraftTest {

    private static final String CONSTRAINT = "ux_match_result_source_external";

    @Mock private MatchService matchService;
    @Mock private MatchResultRepository resultRepository;
    @Mock private MatchInningsRepository inningsRepository;
    @Mock private PlayingAreaRepository playingAreaRepository;
    @Mock private PlayingAreaMatchResolver playingAreaMatchResolver;
    @Mock private LeaguePlayingConditionsRepository playingConditionsRepository;
    @Mock private TeamRepository teamRepository;
    @Mock private AccessService accessService;
    @Mock private ScorecardService scorecardService;
    @Mock private ResultPlayerRepository resultPlayerRepository;

    private ResultServiceImpl service;
    private final UUID clubId = UUID.randomUUID();
    private final UUID matchId = UUID.randomUUID();
    private final UUID personId = UUID.randomUUID();
    private final Authentication auth = new TestingAuthenticationToken("manager", "n/a");
    private final ImportOrigin origin = new ImportOrigin("IMPORT:EXAMPLE", "match-1");

    @BeforeEach
    void setUp() {
        service = new ResultServiceImpl(matchService, resultRepository, inningsRepository, playingAreaRepository,
                playingAreaMatchResolver, playingConditionsRepository, teamRepository,
                Mappers.getMapper(MatchResultMapper.class), new ResultValidator(), accessService, scorecardService,
                resultPlayerRepository);
        when(scorecardService.validationContext(any(), any())).thenReturn(ScorecardContext.none());
        when(scorecardService.load(any(), any())).thenReturn(new ScorecardDto(null, null, null, null, null, null, null));
        Match match = Match.builder().id(matchId).clubId(clubId).homeTeamName("Riverside").awayTeamName("Hillside")
                .seasonId(UUID.randomUUID()).matchDate(Instant.now()).active(true).build();
        when(matchService.requireAdministrableMatch(auth, clubId, matchId)).thenReturn(match);
        when(accessService.resolveCurrentPersonId(auth)).thenReturn(personId);
        when(resultRepository.saveAndFlush(any(MatchResult.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
        when(inningsRepository.saveAll(anyCollection())).thenAnswer(inv -> new ArrayList<MatchInnings>(inv.getArgument(0)));
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.empty());
        when(resultRepository.findByClubIdAndSourceAndExternalId(any(), any(), any())).thenReturn(Optional.empty());
    }

    private static MatchResult withId(MatchResult result) {
        if (result.getId() == null) {
            result.setId(UUID.randomUUID());
        }
        return result;
    }

    private static ResultDraft draft() {
        return new ResultDraft(ResultOutcomeType.ABANDONED, null, null, null, null, null, null, null, null, null, null,
                null, "from a file", null);
    }

    private static ResultDraft draftWithScorecard() {
        return draft().copyWithScorecard(new ScorecardDto(null, null, null, null, null, null, null));
    }

    private MatchResult stored(ResultStatus status, String source, String externalId) {
        MatchResult result = MatchResult.builder().id(UUID.randomUUID()).clubId(clubId).matchId(matchId).status(status)
                .detailLevel(ResultDetailLevel.SUMMARY).source(source).externalId(externalId)
                .decidedBy(ResultDecidedBy.REGULAR).ballsPerOver(6).build();
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.of(result));
        when(inningsRepository.findByMatchResultIdOrderBySequence(result.getId())).thenReturn(List.of());
        return result;
    }

    private MatchResult savedResult() {
        ArgumentCaptor<MatchResult> saved = ArgumentCaptor.forClass(MatchResult.class);
        verify(resultRepository).saveAndFlush(saved.capture());
        return saved.getValue();
    }

    // ---- saveImportedDraft ----

    @Test
    void aNewImportedDraftCarriesTheSourceAndExternalIdAndIsADraft() {
        service.saveImportedDraft(auth, clubId, matchId, draft(), origin);

        MatchResult saved = savedResult();
        assertThat(saved.getSource()).isEqualTo("IMPORT:EXAMPLE");
        assertThat(saved.getExternalId()).isEqualTo("match-1");
        assertThat(saved.getSourcePayload()).isNull();
        assertThat(saved.getStatus()).isEqualTo(ResultStatus.DRAFT);
        assertThat(saved.getClubId()).isEqualTo(clubId);
        assertThat(saved.getMatchId()).isEqualTo(matchId);
        assertThat(saved.getUpdatedBy()).isEqualTo(personId);
    }

    @Test
    void anOriginWithNoExternalIdStoresNoneAndSkipsTheCrossMatchCheck() {
        service.saveImportedDraft(auth, clubId, matchId, draft(), new ImportOrigin("IMPORT:EXAMPLE", null));

        assertThat(savedResult().getExternalId()).isNull();
        verify(resultRepository, never()).findByClubIdAndSourceAndExternalId(any(), any(), any());
    }

    @Test
    void aPublishedResultIsRefusedAndNothingIsWritten() {
        stored(ResultStatus.PUBLISHED, "MANUAL", null);

        assertThatThrownBy(() -> service.saveImportedDraft(auth, clubId, matchId, draft(), origin))
                .isInstanceOf(ResultPublishedException.class);

        verify(resultRepository, never()).saveAndFlush(any());
        verify(scorecardService, never()).replaceImported(any(), any(), any(), any(), any());
    }

    @Test
    void aReImportReplacesTheExistingDraftInPlace() {
        MatchResult existing = stored(ResultStatus.DRAFT, "IMPORT:EXAMPLE", "match-1");
        UUID id = existing.getId();

        service.saveImportedDraft(auth, clubId, matchId, draftWithScorecard(), origin);

        MatchResult saved = savedResult();
        assertThat(saved).isSameAs(existing);
        assertThat(saved.getId()).isEqualTo(id);
        assertThat(saved.getOutcomeType()).isEqualTo(ResultOutcomeType.ABANDONED);
        assertThat(saved.getStatus()).isEqualTo(ResultStatus.DRAFT);
        verify(scorecardService).replaceImported(any(), any(), any(), any(), any());
        verify(scorecardService, never()).replace(any(), any(), any(), any(), any());
    }

    @Test
    void anImportOverAManualDraftBecomesAnImportedDraft() {
        MatchResult existing = stored(ResultStatus.DRAFT, "MANUAL", null);

        service.saveImportedDraft(auth, clubId, matchId, draft(), origin);

        assertThat(existing.getSource()).isEqualTo("IMPORT:EXAMPLE");
        assertThat(existing.getExternalId()).isEqualTo("match-1");
    }

    @Test
    void theImportedScorecardGoesThroughTheImportPathNeverTheClientOne() {
        service.saveImportedDraft(auth, clubId, matchId, draftWithScorecard(), origin);

        verify(scorecardService).replaceImported(any(), org.mockito.ArgumentMatchers.eq(clubId), any(), any(), org.mockito.ArgumentMatchers.eq(personId));
        verify(scorecardService, never()).replace(any(), any(), any(), any(), any());
    }

    @Test
    void aReImportWithNoScorecardClearsTheOldOneButANewImportWritesNone() {
        service.saveImportedDraft(auth, clubId, matchId, draft(), origin);
        verify(scorecardService, never()).replaceImported(any(), any(), any(), any(), any());

        stored(ResultStatus.DRAFT, "IMPORT:EXAMPLE", "match-1");
        service.saveImportedDraft(auth, clubId, matchId, draft(), origin);

        ArgumentCaptor<ScorecardDto> cleared = ArgumentCaptor.forClass(ScorecardDto.class);
        verify(scorecardService).replaceImported(any(), any(), any(), cleared.capture(), any());
        assertThat(cleared.getValue().players()).isEmpty();
        assertThat(cleared.getValue().batting()).isEmpty();
    }

    @Test
    void theProviderIdAlreadyOnAnotherMatchIsRefusedNamingThatMatch() {
        UUID otherMatch = UUID.randomUUID();
        MatchResult other = MatchResult.builder().id(UUID.randomUUID()).clubId(clubId).matchId(otherMatch).build();
        when(resultRepository.findByClubIdAndSourceAndExternalId(clubId, "IMPORT:EXAMPLE", "match-1")).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> service.saveImportedDraft(auth, clubId, matchId, draft(), origin))
                .isInstanceOfSatisfying(ImportExternalIdAlreadyUsedException.class,
                        ex -> assertThat(ex.getOtherMatchId()).isEqualTo(otherMatch));

        verify(resultRepository, never()).saveAndFlush(any());
    }

    @Test
    void theProviderIdOnThisSameMatchIsNotAConflict() {
        MatchResult existing = stored(ResultStatus.DRAFT, "IMPORT:EXAMPLE", "match-1");
        when(resultRepository.findByClubIdAndSourceAndExternalId(clubId, "IMPORT:EXAMPLE", "match-1")).thenReturn(Optional.of(existing));

        service.saveImportedDraft(auth, clubId, matchId, draft(), origin);

        assertThat(savedResult()).isSameAs(existing);
    }

    // ---- constraint-name mapping ----

    @Test
    void aRaceOnTheSourceExternalIdIndexIsMappedByConstraintNameToTheImportConflict() {
        when(resultRepository.saveAndFlush(any(MatchResult.class))).thenThrow(new DataIntegrityViolationException("dup",
                new org.hibernate.exception.ConstraintViolationException("dup", new SQLException(), CONSTRAINT)));

        assertThatThrownBy(() -> service.saveImportedDraft(auth, clubId, matchId, draft(), origin))
                .isInstanceOfSatisfying(ImportExternalIdAlreadyUsedException.class,
                        ex -> assertThat(ex.getOtherMatchId()).isNull());
    }

    @Test
    void theConstraintNameIsAlsoFoundInTheDatabasesMessage() {
        when(resultRepository.saveAndFlush(any(MatchResult.class))).thenThrow(new DataIntegrityViolationException(
                "ERROR: duplicate key value violates unique constraint \"" + CONSTRAINT + "\""));

        assertThatThrownBy(() -> service.saveImportedDraft(auth, clubId, matchId, draft(), origin))
                .isInstanceOf(ImportExternalIdAlreadyUsedException.class);
    }

    @Test
    void anyOtherIntegrityFailureIsStillTheOneResultPerMatchConflict() {
        when(resultRepository.saveAndFlush(any(MatchResult.class))).thenThrow(new DataIntegrityViolationException(
                "dup", new org.hibernate.exception.ConstraintViolationException("dup", new SQLException(), "ux_match_result_match")));

        assertThatThrownBy(() -> service.saveImportedDraft(auth, clubId, matchId, draft(), origin))
                .isInstanceOf(ResultAlreadyExistsException.class);
    }

    @Test
    void aManualSaveNeverMapsTheSourceConstraint() {
        when(resultRepository.saveAndFlush(any(MatchResult.class))).thenThrow(new DataIntegrityViolationException(
                "dup", new org.hibernate.exception.ConstraintViolationException("dup", new SQLException(), CONSTRAINT)));

        assertThatThrownBy(() -> service.upsertDraft(auth, clubId, matchId, draft()))
                .isInstanceOf(ResultAlreadyExistsException.class);
    }

    @Test
    void anImportNeedsADraftAndAnOrigin() {
        assertThatThrownBy(() -> service.saveImportedDraft(auth, clubId, matchId, null, origin))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> service.saveImportedDraft(auth, clubId, matchId, draft(), null))
                .isInstanceOf(NullPointerException.class);
    }

    // ---- the normal save never takes source fields ----

    @Test
    void aNormalSaveIsManualWithNoExternalIdAndTheDraftShapeHasNoSourceFields() {
        service.upsertDraft(auth, clubId, matchId, draft());

        MatchResult saved = savedResult();
        assertThat(saved.getSource()).isEqualTo("MANUAL");
        assertThat(saved.getExternalId()).isNull();
        assertThat(java.util.Arrays.stream(ResultDraft.class.getRecordComponents()).map(c -> c.getName()))
                .doesNotContain("source", "externalId", "sourcePayload");
    }

    @Test
    void aNormalSaveOverAnImportedDraftNeverChangesItsSourceOrExternalId() {
        MatchResult existing = stored(ResultStatus.DRAFT, "IMPORT:EXAMPLE", "match-1");

        service.upsertDraft(auth, clubId, matchId, draft());

        assertThat(existing.getSource()).isEqualTo("IMPORT:EXAMPLE");
        assertThat(existing.getExternalId()).isEqualTo("match-1");
    }

    // ---- read-only summaries for the import service ----

    @Test
    void existingResultsSummarisesOnlyThisClubsResults() {
        MatchResult mine = stored(ResultStatus.DRAFT, "IMPORT:EXAMPLE", "match-1");
        MatchResult foreign = MatchResult.builder().id(UUID.randomUUID()).clubId(UUID.randomUUID()).matchId(UUID.randomUUID())
                .status(ResultStatus.PUBLISHED).build();
        when(resultRepository.findAllByMatchIdIn(anyCollection())).thenReturn(List.of(mine, foreign));
        when(resultPlayerRepository.existsByMatchResultId(mine.getId())).thenReturn(true);

        Map<UUID, ExistingResultDto> found = service.existingResults(clubId, List.of(matchId, foreign.getMatchId()));

        assertThat(found).containsOnlyKeys(matchId);
        assertThat(found.get(matchId).status()).isEqualTo(ResultStatus.DRAFT);
        assertThat(found.get(matchId).source()).isEqualTo("IMPORT:EXAMPLE");
        assertThat(found.get(matchId).hasScorecard()).isTrue();
    }

    @Test
    void existingResultsOfNoMatchesIsEmptyWithNoQuery() {
        assertThat(service.existingResults(clubId, List.of())).isEmpty();

        verify(resultRepository, never()).findAllByMatchIdIn(any());
    }

    @Test
    void findImportedReadsByClubSourceAndProviderId() {
        MatchResult mine = stored(ResultStatus.DRAFT, "IMPORT:EXAMPLE", "match-1");
        when(resultRepository.findByClubIdAndSourceAndExternalId(clubId, "IMPORT:EXAMPLE", "match-1")).thenReturn(Optional.of(mine));

        assertThat(service.findImported(clubId, "IMPORT:EXAMPLE", "match-1")).hasValueSatisfying(r -> {
            assertThat(r.matchId()).isEqualTo(matchId);
            assertThat(r.hasScorecard()).isFalse();
        });
        assertThat(service.findImported(clubId, "IMPORT:EXAMPLE", "match-2")).isEmpty();
    }
}
