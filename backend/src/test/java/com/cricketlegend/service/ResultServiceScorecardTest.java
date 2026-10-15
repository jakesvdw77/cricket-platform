package com.cricketlegend.service;

import static com.cricketlegend.support.ScorecardDtos.opposition;
import static com.cricketlegend.support.ScorecardDtos.registered;
import static org.assertj.core.api.Assertions.assertThat;
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
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultStatus;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ScorecardDto;
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
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/101 Test Plan, backend unit: the scorecard side of {@link ResultServiceImpl} with mocks: the server-set
 * {@code detail_level} and the standouts frozen at publish and cleared at unpublish. The real validator and mapper run.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ResultServiceScorecardTest {

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
    private final Authentication auth = new TestingAuthenticationToken("manager", "n/a");
    private Match match;

    @BeforeEach
    void setUp() {
        service = new ResultServiceImpl(matchService, resultRepository, inningsRepository, playingAreaRepository,
                playingAreaMatchResolver, playingConditionsRepository, teamRepository,
                Mappers.getMapper(MatchResultMapper.class), new ResultValidator(), accessService, scorecardService,
                resultPlayerRepository);
        when(scorecardService.validationContext(any(), any())).thenReturn(ScorecardContext.none());
        when(scorecardService.load(any(), any())).thenReturn(new ScorecardDto(null, null, null, null, null, null, null));
        match = Match.builder().id(matchId).clubId(clubId).homeTeamName("Riverside").awayTeamName("Hillside")
                .seasonId(UUID.randomUUID()).matchDate(Instant.now()).active(true).build();
        when(matchService.requireAdministrableMatch(auth, clubId, matchId)).thenReturn(match);
        when(accessService.resolveCurrentPersonId(auth)).thenReturn(UUID.randomUUID());
        when(resultRepository.saveAndFlush(any(MatchResult.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
        when(resultRepository.save(any(MatchResult.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
        when(inningsRepository.saveAll(anyCollection())).thenAnswer(inv -> new ArrayList<MatchInnings>(inv.getArgument(0)));
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.empty());
    }

    private static MatchResult withId(MatchResult r) {
        if (r.getId() == null) {
            r.setId(UUID.randomUUID());
        }
        return r;
    }

    private static ResultDraft withScorecard(ResultPlayerDto... players) {
        return new ResultDraft(null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                new ScorecardDto(List.of(players), null, null, null, null, null, null));
    }

    private ResultDetailLevel savedLevel(ResultDraft draft) {
        service.upsertDraft(auth, clubId, matchId, draft);
        ArgumentCaptor<MatchResult> saved = ArgumentCaptor.forClass(MatchResult.class);
        verify(resultRepository).saveAndFlush(saved.capture());
        return saved.getValue().getDetailLevel();
    }

    @Test
    void detailLevelIsSummaryWithNoScorecard() {
        assertThat(savedLevel(new ResultDraft(null, null, null, null, null, null, null, null, null, null, null, null,
                null, null))).isEqualTo(ResultDetailLevel.SUMMARY);
    }

    @Test
    void oursOnlyIsOurSide() {
        assertThat(savedLevel(withScorecard(registered(ResultSide.HOME, "p1")))).isEqualTo(ResultDetailLevel.OUR_SIDE);
    }

    @Test
    void anOppositionPlayerMakesItFull() {
        assertThat(savedLevel(withScorecard(registered(ResultSide.HOME, "p1"), opposition(ResultSide.AWAY, "o1", "Smith"))))
                .isEqualTo(ResultDetailLevel.FULL);
    }

    @Test
    void aSaveThatLeavesTheScorecardUntouchedKeepsTheLevelFromTheStoredPlayers() {
        MatchResult existing = MatchResult.builder().id(UUID.randomUUID()).clubId(clubId).matchId(matchId)
                .status(ResultStatus.DRAFT).detailLevel(ResultDetailLevel.SUMMARY).source("MANUAL")
                .decidedBy(ResultDecidedBy.REGULAR).ballsPerOver(6).build();
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.of(existing));
        when(inningsRepository.findByMatchResultIdOrderBySequence(existing.getId())).thenReturn(List.of());
        when(resultPlayerRepository.existsByMatchResultIdAndOpposition(existing.getId(), false)).thenReturn(true);
        when(resultPlayerRepository.existsByMatchResultIdAndOpposition(existing.getId(), true)).thenReturn(false);

        service.upsertDraft(auth, clubId, matchId, new ResultDraft(ResultOutcomeType.ABANDONED, null, null, null, null,
                null, null, null, null, null, null, null, null, null));

        assertThat(existing.getDetailLevel()).isEqualTo(ResultDetailLevel.OUR_SIDE);
        verify(scorecardService).refreshNonBowlerWickets(existing.getId());
        verify(scorecardService, never()).replace(any(), any(), any(), any(), any());
    }

    @Test
    void publishFreezesTheStandoutsAndUnpublishClearsThem() {
        MatchResult draft = MatchResult.builder().id(UUID.randomUUID()).clubId(clubId).matchId(matchId)
                .status(ResultStatus.DRAFT).detailLevel(ResultDetailLevel.SUMMARY).source("MANUAL")
                .decidedBy(ResultDecidedBy.REGULAR).ballsPerOver(6).outcomeType(ResultOutcomeType.ABANDONED).build();
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.of(draft));
        when(inningsRepository.findByMatchResultIdOrderBySequence(draft.getId())).thenReturn(List.of());

        service.publish(auth, clubId, matchId, false);

        assertThat(draft.getStatus()).isEqualTo(ResultStatus.PUBLISHED);
        verify(scorecardService).freezeFeatured(draft.getId(), match);

        service.unpublish(auth, clubId, matchId);

        assertThat(draft.getStatus()).isEqualTo(ResultStatus.DRAFT);
        verify(scorecardService).clearFeatured(draft.getId());
    }

    @Test
    void aRefusedPublishFreezesNothing() {
        MatchResult draft = MatchResult.builder().id(UUID.randomUUID()).clubId(clubId).matchId(matchId)
                .status(ResultStatus.DRAFT).detailLevel(ResultDetailLevel.SUMMARY).source("MANUAL")
                .decidedBy(ResultDecidedBy.REGULAR).ballsPerOver(6).build();
        when(resultRepository.findByMatchId(matchId)).thenReturn(Optional.of(draft));
        when(inningsRepository.findByMatchResultIdOrderBySequence(draft.getId())).thenReturn(List.of());

        try {
            service.publish(auth, clubId, matchId, true);
        } catch (RuntimeException expected) {
            // no outcome
        }

        verify(scorecardService, never()).freezeFeatured(any(), any());
    }
}
