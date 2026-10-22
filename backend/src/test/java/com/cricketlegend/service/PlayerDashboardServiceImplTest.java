package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.dto.PlayerDashboardDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.PlayerStatsAggregateRepository;
import com.cricketlegend.repository.PlayerStatsAggregateRepository.PlayerStatsAggregateView;
import com.cricketlegend.repository.PlayerStatsFactsRepository;
import com.cricketlegend.repository.PlayerStatsFactsRepository.MatchHeaderView;
import com.cricketlegend.service.impl.PlayerDashboardServiceImpl;
import com.cricketlegend.service.support.ClubPlayerLookup;
import com.cricketlegend.service.support.StatsScope;
import com.cricketlegend.service.support.StatsScopeResolver;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/117-stats-dashboard.md, "Player series" and the services' rules: scope resolution is the one access check,
 * a player of another club is a 404, an empty reach reads nothing, and the history read is capped at 300 with one extra row
 * proving truncation. Figures are the builder's and the parity integration tests'.
 */
@ExtendWith(MockitoExtension.class)
class PlayerDashboardServiceImplTest {

    private static final Instant NEWEST = Instant.parse("2026-06-01T09:00:00Z");

    @Mock
    private PlayerStatsAggregateRepository aggregateRepository;

    @Mock
    private PlayerStatsFactsRepository factsRepository;

    @Mock
    private ClubPlayerLookup playerLookup;

    @Mock
    private StatsScopeResolver scopeResolver;

    @Mock
    private Authentication authentication;

    private PlayerDashboardServiceImpl service;

    private final UUID clubId = UUID.randomUUID();
    private final UUID playerId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new PlayerDashboardServiceImpl(aggregateRepository, factsRepository, playerLookup, scopeResolver);
    }

    private PlayerDashboardDto get(String competition) {
        return service.get(authentication, clubId, playerId, null, null, null, null, competition);
    }

    private void resolverReturns(StatsScope scope, boolean nothingInReach) {
        when(scopeResolver.resolve(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new StatsScopeResolver.Resolved(scope, nothingInReach));
    }

    private void inReach() {
        resolverReturns(new StatsScope(clubId, null, null, null, null, null), false);
    }

    private static PlayerStatsAggregateView emptyAggregateRow() {
        return mock(PlayerStatsAggregateView.class);
    }

    private static MatchHeaderView header(int newestFirstIndex) {
        MatchHeaderView v = mock(MatchHeaderView.class);
        lenient().when(v.getResultId()).thenReturn(UUID.randomUUID());
        lenient().when(v.getMatchId()).thenReturn(UUID.randomUUID());
        lenient().when(v.getMatchEpochMillis()).thenReturn(NEWEST.minusSeconds(86_400L * newestFirstIndex).toEpochMilli());
        lenient().when(v.getBallsPerOver()).thenReturn(6);
        lenient().when(v.getOutcome()).thenReturn("WON");
        lenient().when(v.getWinningSide()).thenReturn("HOME");
        lenient().when(v.getOnHome()).thenReturn(true);
        lenient().when(v.getHasBattingCard()).thenReturn(true);
        lenient().when(v.getHasBowlingCard()).thenReturn(true);
        return v;
    }

    private void headersReturned(List<MatchHeaderView> newestFirst) {
        when(factsRepository.matchPage(
                        any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyBoolean(), anyInt(), anyLong()))
                .thenReturn(newestFirst);
    }

    // ---- refusals, all before any statistics query ----

    @ParameterizedTest
    @ValueSource(strings = {"league", "ALL", "x"})
    void aBadCompetitionIsRefusedBeforeAnyLookup(String competition) {
        assertThatThrownBy(() -> get(competition)).isInstanceOf(ValidationException.class);

        verifyNoInteractions(playerLookup, scopeResolver, aggregateRepository, factsRepository);
    }

    @Test
    void aPlayerOfAnotherClubIsNotFoundAndNothingElseRuns() {
        when(playerLookup.require(clubId, playerId)).thenThrow(new NotFoundException("Player not found"));

        assertThatThrownBy(() -> get(null)).isInstanceOf(NotFoundException.class);

        verifyNoInteractions(scopeResolver, aggregateRepository, factsRepository);
    }

    @Test
    void aRefusalFromTheScopeResolverIsNotSwallowedAndNothingIsRead() {
        when(scopeResolver.resolve(any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new AccessDeniedException("outside your sections"));

        assertThatThrownBy(() -> get(null)).isInstanceOf(AccessDeniedException.class);

        verifyNoInteractions(aggregateRepository, factsRepository);
    }

    // ---- scope resolution and echo ----

    @Test
    void theScopeResolverIsCalledWithEveryFilterAndTheParsedCompetition() {
        UUID season = UUID.randomUUID();
        UUID league = UUID.randomUUID();
        UUID team = UUID.randomUUID();
        UUID section = UUID.randomUUID();
        when(scopeResolver.resolve(authentication, clubId, season, league, team, section, StatsScope.Competition.LEAGUE))
                .thenReturn(new StatsScopeResolver.Resolved(
                        new StatsScope(clubId, season, league, team, null, StatsScope.Competition.LEAGUE), true));

        PlayerDashboardDto dto =
                service.get(authentication, clubId, playerId, season, league, team, section, "LEAGUE");

        verify(playerLookup).require(clubId, playerId);
        assertThat(dto.scope().seasonId()).isEqualTo(season);
        assertThat(dto.scope().leagueId()).isEqualTo(league);
        assertThat(dto.scope().teamId()).isEqualTo(team);
        assertThat(dto.scope().sectionId()).isEqualTo(section);
        assertThat(dto.scope().competition()).isEqualTo("LEAGUE");
        assertThat(dto.scope().kind()).isEqualTo("CLUB_VERIFIED");
    }

    @Test
    void nothingInReachIsAnEmptyOkResponseWithoutAQuery() {
        resolverReturns(new StatsScope(clubId, null, null, null, Set.of(), null), true);

        PlayerDashboardDto dto = get(null);

        verifyNoInteractions(aggregateRepository, factsRepository);
        assertThat(dto.playerId()).isEqualTo(playerId);
        assertThat(dto.battingInnings()).isEmpty();
        assertThat(dto.bowlingMatches()).isEmpty();
        assertThat(dto.wicketTypes().total()).isZero();
        assertThat(dto.basis().matchesCounted()).isZero();
        assertThat(dto.truncated()).isFalse();
    }

    @Test
    void aPlayerWithNothingCountedIsAnEmptyOkResponseAndTheHistoryIsNotRead() {
        inReach();
        when(aggregateRepository.aggregate(any(), any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(List.of());

        PlayerDashboardDto dto = get(null);

        verify(factsRepository, never()).matchPage(
                any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyBoolean(), anyInt(), anyLong());
        assertThat(dto.battingInnings()).isEmpty();
        assertThat(dto.notCaptured()).isNotEmpty();
    }

    // ---- the history read ----

    @Test
    void theHistoryIsReadNewestFirstWithOneRowBeyondTheCapAndOnlyForTheCoveredResults() {
        UUID season = UUID.randomUUID();
        Set<UUID> sectionTeams = Set.of(UUID.randomUUID());
        resolverReturns(new StatsScope(clubId, season, null, null, sectionTeams, StatsScope.Competition.FRIENDLY), false);
        PlayerStatsAggregateView row = emptyAggregateRow();
        when(aggregateRepository.aggregate(
                        eq(clubId), eq(playerId), eq(season), any(), any(), eq("FRIENDLY"), eq(true), eq(List.copyOf(sectionTeams))))
                .thenReturn(List.of(row));
        MatchHeaderView only = header(0);
        headersReturned(List.of(only));
        when(factsRepository.matchBatting(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyList()))
                .thenReturn(List.of());
        when(factsRepository.matchBowling(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyList()))
                .thenReturn(List.of());
        when(factsRepository.bowlingCredits(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyList()))
                .thenReturn(List.of());

        UUID onlyResult = only.getResultId();
        service.get(authentication, clubId, playerId, season, null, null, null, "FRIENDLY");

        verify(factsRepository).matchPage(
                eq(clubId), eq(playerId), eq(season), any(), any(), eq("FRIENDLY"), eq(true),
                eq(List.copyOf(sectionTeams)), eq(false), eq(301), eq(0L));
        verify(factsRepository).matchBatting(
                eq(clubId), eq(playerId), eq(season), any(), any(), eq("FRIENDLY"), eq(true), any(),
                eq(List.of(onlyResult)));
        verify(factsRepository).bowlingCredits(
                eq(clubId), eq(playerId), eq(season), any(), any(), eq("FRIENDLY"), eq(true), any(),
                eq(List.of(onlyResult)));
    }

    @Test
    void exactlyThreeHundredCountedMatchesIsNotTruncated() {
        List<MatchHeaderView> headers = headers(300);
        stubReads(headers);

        PlayerDashboardDto dto = get(null);

        assertThat(dto.truncated()).isFalse();
        assertThat(dto.truncatedSince()).isNull();
        assertThat(capturedResultIds()).hasSize(300);
    }

    @Test
    void theThreeHundredAndFirstRowProvesTruncationAndIsNotCovered() {
        List<MatchHeaderView> headers = headers(301);
        stubReads(headers);

        PlayerDashboardDto dto = get(null);

        assertThat(dto.truncated()).isTrue();
        List<UUID> covered = capturedResultIds();
        assertThat(covered).hasSize(300);
        assertThat(covered).doesNotContain(headers.get(300).getResultId());
        // oldest first: the 300th newest comes first, the newest last
        assertThat(covered.get(0)).isEqualTo(headers.get(299).getResultId());
        assertThat(covered.get(299)).isEqualTo(headers.get(0).getResultId());
        assertThat(dto.truncatedSince()).isEqualTo(NEWEST.minusSeconds(86_400L * 299).truncatedTo(java.time.temporal.ChronoUnit.MILLIS));
    }

    private static List<MatchHeaderView> headers(int count) {
        List<MatchHeaderView> headers = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            headers.add(header(i));
        }
        return headers;
    }

    private void stubReads(List<MatchHeaderView> newestFirst) {
        inReach();
        PlayerStatsAggregateView row = emptyAggregateRow();
        when(aggregateRepository.aggregate(any(), any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(List.of(row));
        headersReturned(newestFirst);
        lenient().when(factsRepository.matchBatting(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyList()))
                .thenReturn(List.of());
        lenient().when(factsRepository.matchBowling(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyList()))
                .thenReturn(List.of());
        lenient().when(factsRepository.bowlingCredits(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), anyList()))
                .thenReturn(List.of());
    }

    @SuppressWarnings("unchecked")
    private List<UUID> capturedResultIds() {
        ArgumentCaptor<List<UUID>> captor = ArgumentCaptor.forClass(List.class);
        verify(factsRepository).matchBatting(any(), any(), any(), any(), any(), any(), anyBoolean(), any(), captor.capture());
        return captor.getValue();
    }
}
