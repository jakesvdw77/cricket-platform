package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.TeamDashboardDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.TeamStatsMapperImpl;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamStatsAggregateRepository;
import com.cricketlegend.repository.TeamStatsAggregateRepository.TeamStatsAggregateView;
import com.cricketlegend.repository.TeamStatsAggregateRepository.TeamStatsBasisView;
import com.cricketlegend.repository.TeamStatsFactsRepository;
import com.cricketlegend.repository.TeamStatsFactsRepository.TeamDashboardResultView;
import com.cricketlegend.service.impl.TeamDashboardServiceImpl;
import com.cricketlegend.service.support.StatsScope;
import com.cricketlegend.service.support.StatsScopeResolver;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/117-stats-dashboard.md, "Team series": scope resolution is the one access check (404 / 403), an empty reach or
 * a team with nothing counted is an empty 200, and the history read is capped at 300 with one extra row proving truncation.
 */
@ExtendWith(MockitoExtension.class)
class TeamDashboardServiceImplTest {

    private static final Instant NEWEST = Instant.parse("2026-06-01T09:00:00Z");

    @Mock
    private TeamStatsAggregateRepository aggregateRepository;

    @Mock
    private TeamStatsFactsRepository factsRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private StatsScopeResolver scopeResolver;

    @Mock
    private Authentication authentication;

    private TeamDashboardServiceImpl service;

    private final UUID clubId = UUID.randomUUID();
    private final UUID teamId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new TeamDashboardServiceImpl(
                aggregateRepository, factsRepository, teamRepository, scopeResolver, new TeamStatsMapperImpl());
    }

    private TeamDashboardDto get(String competition) {
        return service.get(authentication, clubId, teamId, null, null, competition);
    }

    private void resolverReturns(StatsScope scope, boolean nothingInReach) {
        when(scopeResolver.resolve(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new StatsScopeResolver.Resolved(scope, nothingInReach));
    }

    private void inReach() {
        resolverReturns(new StatsScope(clubId, null, null, teamId, null, null), false);
    }

    private void teamInClub() {
        when(teamRepository.findById(teamId))
                .thenReturn(Optional.of(Team.builder().id(teamId).clubId(clubId).name("First XI").build()));
    }

    private static TeamDashboardResultView result(int newestFirstIndex) {
        TeamDashboardResultView v = mock(TeamDashboardResultView.class);
        lenient().when(v.getResultId()).thenReturn(UUID.randomUUID());
        lenient().when(v.getMatchId()).thenReturn(UUID.randomUUID());
        lenient().when(v.getMatchEpochMillis()).thenReturn(NEWEST.minusSeconds(86_400L * newestFirstIndex).toEpochMilli());
        lenient().when(v.getOutcome()).thenReturn("WON");
        lenient().when(v.getWinningSide()).thenReturn("HOME");
        lenient().when(v.getSide()).thenReturn("HOME");
        return v;
    }

    // ---- refusals ----

    @ParameterizedTest
    @ValueSource(strings = {"league", "ALL", "x"})
    void aBadCompetitionIsRefusedBeforeAnyLookup(String competition) {
        assertThatThrownBy(() -> get(competition)).isInstanceOf(ValidationException.class);

        verifyNoInteractions(scopeResolver, teamRepository, aggregateRepository, factsRepository);
    }

    @Test
    void aTeamOrFilterOfAnotherClubIsNotFoundFromTheResolverAndNothingIsRead() {
        when(scopeResolver.resolve(any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new NotFoundException("Team not found"));

        assertThatThrownBy(() -> get(null)).isInstanceOf(NotFoundException.class);

        verifyNoInteractions(aggregateRepository, factsRepository);
    }

    @Test
    void aTeamOutsideTheCallersReachIsRefusedAndNothingIsRead() {
        when(scopeResolver.resolve(any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new AccessDeniedException("outside your sections"));

        assertThatThrownBy(() -> get(null)).isInstanceOf(AccessDeniedException.class);

        verifyNoInteractions(aggregateRepository, factsRepository);
    }

    @Test
    void anUnknownOrOtherClubTeamRowIsNotFound() {
        inReach();
        when(teamRepository.findById(teamId))
                .thenReturn(Optional.of(Team.builder().id(teamId).clubId(UUID.randomUUID()).name("Other").build()));

        assertThatThrownBy(() -> get(null)).isInstanceOf(NotFoundException.class);

        verifyNoInteractions(aggregateRepository, factsRepository);
    }

    // ---- scope resolution and echo ----

    @Test
    void theScopeResolverIsCalledWithTheFiltersAndNoSection() {
        UUID season = UUID.randomUUID();
        UUID league = UUID.randomUUID();
        when(scopeResolver.resolve(authentication, clubId, season, league, teamId, null, StatsScope.Competition.LEAGUE))
                .thenReturn(new StatsScopeResolver.Resolved(
                        new StatsScope(clubId, season, league, teamId, null, StatsScope.Competition.LEAGUE), true));
        teamInClub();

        TeamDashboardDto dto = service.get(authentication, clubId, teamId, season, league, "LEAGUE");

        assertThat(dto.scope().seasonId()).isEqualTo(season);
        assertThat(dto.scope().leagueId()).isEqualTo(league);
        assertThat(dto.scope().competition()).isEqualTo("LEAGUE");
        assertThat(dto.teamId()).isEqualTo(teamId);
        assertThat(dto.teamName()).isEqualTo("First XI");
    }

    @Test
    void nothingInReachIsAnEmptyOkResponseWithoutAQuery() {
        resolverReturns(new StatsScope(clubId, null, null, teamId, Set.of(), null), true);
        teamInClub();

        TeamDashboardDto dto = get(null);

        verifyNoInteractions(aggregateRepository, factsRepository);
        assertThat(dto.results()).isEmpty();
        assertThat(dto.resultsSummary().played()).isZero();
        assertThat(dto.basis().resultsCounted()).isZero();
        assertThat(dto.truncated()).isFalse();
    }

    @Test
    void aTeamWithNothingCountedIsAnEmptyOkResponseThatStillDisclosesLeftOutResults() {
        inReach();
        teamInClub();
        when(aggregateRepository.aggregate(any(), any(), any(), any(), any(), anyBoolean(), any())).thenReturn(List.of());
        TeamStatsBasisView basis = mock(TeamStatsBasisView.class);
        when(basis.getResultsNoBallBowled()).thenReturn(2L);
        when(aggregateRepository.basis(any(), any(), any(), any(), any(), anyBoolean(), any())).thenReturn(basis);

        TeamDashboardDto dto = get(null);

        verify(factsRepository, never()).dashboardResults(any(), any(), any(), any(), any(), anyBoolean(), any(), anyInt());
        assertThat(dto.results()).isEmpty();
        assertThat(dto.basis().resultsNoBallBowled()).isEqualTo(2);
    }

    // ---- the history read ----

    @Test
    void theHistoryIsReadWithOneRowBeyondTheCapAndTheSectionRestriction() {
        UUID sectionTeam = UUID.randomUUID();
        resolverReturns(new StatsScope(clubId, null, null, teamId, Set.of(sectionTeam), StatsScope.Competition.FRIENDLY), false);
        teamInClub();
        when(aggregateRepository.aggregate(any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(List.of(mock(TeamStatsAggregateView.class)));
        when(factsRepository.dashboardResults(any(), any(), any(), any(), any(), anyBoolean(), any(), anyInt()))
                .thenReturn(List.of());

        get("FRIENDLY");

        verify(factsRepository).dashboardResults(
                eq(clubId), any(), any(), eq(teamId), eq("FRIENDLY"), eq(true), eq(List.of(sectionTeam)), eq(301));
    }

    @Test
    void exactlyThreeHundredResultsIsNotTruncated() {
        stubResults(300);

        TeamDashboardDto dto = get(null);

        assertThat(dto.truncated()).isFalse();
        assertThat(dto.truncatedSince()).isNull();
        assertThat(dto.runRateTrend()).isEmpty(); // no overs in the mocked rows: nothing to chart
        assertThat(dto.resultsSummary().played()).isEqualTo(300);
        assertThat(dto.results()).hasSize(30);
    }

    @Test
    void theThreeHundredAndFirstRowProvesTruncationAndIsDropped() {
        stubResults(301);

        TeamDashboardDto dto = get(null);

        assertThat(dto.truncated()).isTrue();
        assertThat(dto.resultsSummary().played()).isEqualTo(300);
        assertThat(dto.truncatedSince()).isEqualTo(NEWEST.minusSeconds(86_400L * 299));
        // chronological: the newest covered result is last
        assertThat(dto.results().get(29).matchDate()).isEqualTo(NEWEST);
        assertThat(dto.results().get(0).matchDate()).isEqualTo(NEWEST.minusSeconds(86_400L * 29));
    }

    private void stubResults(int count) {
        inReach();
        teamInClub();
        when(aggregateRepository.aggregate(any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(List.of(mock(TeamStatsAggregateView.class)));
        List<TeamDashboardResultView> newestFirst = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            newestFirst.add(result(i));
        }
        when(factsRepository.dashboardResults(any(), any(), any(), any(), any(), anyBoolean(), any(), anyInt()))
                .thenReturn(newestFirst);
    }
}
