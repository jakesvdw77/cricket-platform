package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.TeamStatsDto;
import com.cricketlegend.dto.TeamStatsTableDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.TeamStatsMapperImpl;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamStatsAggregateRepository;
import com.cricketlegend.repository.TeamStatsAggregateRepository.TeamStatsAggregateView;
import com.cricketlegend.repository.TeamStatsAggregateRepository.TeamStatsBasisView;
import com.cricketlegend.repository.TeamStatsFactsRepository;
import com.cricketlegend.service.impl.TeamStatsServiceImpl;
import com.cricketlegend.service.support.StatsScope;
import com.cricketlegend.service.support.StatsScopeResolver;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

/** Parameter rules, guards and wiring of docs/specs/116-team-stats.md "API Contract"; ranking is TeamTableRankerTest's. */
@ExtendWith(MockitoExtension.class)
class TeamStatsServiceImplTest {

    @Mock
    private TeamStatsAggregateRepository aggregateRepository;

    @Mock
    private TeamStatsFactsRepository factsRepository;

    @Mock
    private SectionRepository sectionRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private StatsScopeResolver scopeResolver;

    @Mock
    private Authentication authentication;

    private TeamStatsServiceImpl service;
    private ListAppender<ILoggingEvent> logs;
    private Logger serviceLogger;

    private final UUID clubId = UUID.randomUUID();
    private final UUID teamId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new TeamStatsServiceImpl(
                aggregateRepository, factsRepository, sectionRepository, teamRepository, scopeResolver,
                new TeamStatsMapperImpl());
        serviceLogger = (Logger) LoggerFactory.getLogger(TeamStatsServiceImpl.class);
        logs = new ListAppender<>();
        logs.start();
        serviceLogger.addAppender(logs);
    }

    @AfterEach
    void tearDown() {
        serviceLogger.detachAppender(logs);
    }

    /** The resolver echoes the filters into a scope, so the competition rule can be observed downstream. */
    private void inReach() {
        when(scopeResolver.resolve(any(), any(), any(), any(), any(), any(), any()))
                .thenAnswer(inv -> new StatsScopeResolver.Resolved(
                        new StatsScope(clubId, inv.getArgument(2), inv.getArgument(3), inv.getArgument(4), null,
                                inv.getArgument(6)),
                        false));
    }

    private void noAggregate() {
        when(aggregateRepository.aggregate(any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(List.of());
        TeamStatsBasisView empty = basisView(0, 0, 0, 0);
        lenient().when(aggregateRepository.basis(any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(empty);
    }

    private static TeamStatsBasisView basisView(long counted, long internal, long noBall, long forfeits) {
        TeamStatsBasisView v = mock(TeamStatsBasisView.class);
        lenient().when(v.getResultsCounted()).thenReturn(counted);
        lenient().when(v.getInternalResults()).thenReturn(internal);
        lenient().when(v.getResultsNoBallBowled()).thenReturn(noBall);
        lenient().when(v.getForfeits()).thenReturn(forfeits);
        return v;
    }

    private static TeamStatsAggregateView row(UUID id, String name, long won, long lost) {
        TeamStatsAggregateView v = mock(TeamStatsAggregateView.class);
        lenient().when(v.getTeamId()).thenReturn(id);
        lenient().when(v.getTeamName()).thenReturn(name);
        lenient().when(v.getActive()).thenReturn(true);
        lenient().when(v.getResults()).thenReturn(won + lost);
        lenient().when(v.getRecWon()).thenReturn(won);
        lenient().when(v.getRecLost()).thenReturn(lost);
        return v;
    }

    private TeamStatsTableDto table(String sort, String direction, String minimum, Integer page, Integer size) {
        return service.table(authentication, clubId, sort, direction, null, null, null, null, minimum, page, size);
    }

    private void refused(String sort, String direction, String minimum, Integer page, Integer size) {
        assertThatThrownBy(() -> table(sort, direction, minimum, page, size)).isInstanceOf(ValidationException.class);
        verifyNoInteractions(scopeResolver, aggregateRepository, factsRepository);
    }

    // ---- parameter rules, all refused before the scope lookup ----

    @ParameterizedTest
    @ValueSource(strings = {"nope", "WON", "noresult", "runsPerInnings"})
    void anUnknownSortIsRefused(String sort) {
        refused(sort, null, null, 0, 10);
    }

    @Test
    void theDefaultSortIsWonInItsNaturalDirection() {
        inReach();
        noAggregate();

        assertThat(table(null, null, null, null, null).sort().code()).isEqualTo("won");
        assertThat(table("", null, null, null, null).sort().code()).isEqualTo("won");
        assertThat(table(null, null, null, null, null).sort().direction()).isEqualTo("HIGHEST");
        assertThat(table("lost", null, null, null, null).sort().direction()).isEqualTo("LOWEST");
    }

    @Test
    void directionIsAscOrDescInAnyCaseElseRefused() {
        inReach();
        noAggregate();

        assertThat(table("won", "asc", null, 0, 10).sort().direction()).isEqualTo("LOWEST");
        assertThat(table("won", "ASC", null, 0, 10).sort().direction()).isEqualTo("LOWEST");
        assertThat(table("lost", "Desc", null, 0, 10).sort().direction()).isEqualTo("HIGHEST");
        assertThat(table("won", " ", null, 0, 10).sort().direction()).isEqualTo("HIGHEST");
    }

    @Test
    void aBadDirectionIsRefused() {
        refused("won", "sideways", null, 0, 10);
    }

    @ParameterizedTest
    @ValueSource(strings = {"-1", "abc", "1.5"})
    void aNegativeOrNonNumericMinimumIsRefusedOnARateAndOnACountSort(String minimum) {
        refused("winPercent", null, minimum, 0, 10);
        refused("won", null, minimum, 0, 10);
    }

    @Test
    void aBlankMinimumIsNone() {
        inReach();
        noAggregate();

        var dto = table("winPercent", null, "  ", 0, 10);

        assertThat(dto.minimum().applies()).isTrue();
        assertThat(dto.minimum().value()).isNull();
        assertThat(dto.minimum().unit()).isEqualTo("MATCHES");
    }

    @Test
    void theMinimumIsKeptOnARateSortAndIgnoredOnACountSort() {
        inReach();
        noAggregate();

        assertThat(table("economy", null, " 7 ", 0, 10).minimum().value()).isEqualTo(7);
        var count = table("played", null, "7", 0, 10);
        assertThat(count.minimum().applies()).isFalse();
        assertThat(count.minimum().value()).isNull();
    }

    @Test
    void aNegativePageIsRefused() {
        refused("won", null, null, -1, 10);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -5, 101, 1000})
    void aSizeBelowOneOrAboveOneHundredIsRefusedNotClamped(int size) {
        refused("won", null, null, 0, size);
    }

    @Test
    void sizeOneHundredIsAllowedAndTheDefaultIsTwentyFive() {
        inReach();
        noAggregate();

        assertThat(table("won", null, null, 0, 100).page().size()).isEqualTo(100);
        assertThat(table("won", null, null, null, null).page().size()).isEqualTo(25);
        assertThat(table("won", null, null, null, null).page().number()).isZero();
    }

    @Test
    void aBadCompetitionIsRefusedBeforeAnyLookup() {
        assertThatThrownBy(() -> service.table(
                        authentication, clubId, null, null, null, null, null, "SOMETIMES", null, 0, 10))
                .isInstanceOf(ValidationException.class);
        verifyNoInteractions(scopeResolver, aggregateRepository);
    }

    // ---- reach and the cap ----

    @Test
    void anEmptyReachGivesAnEmptyTableWithoutQueryingAnything() {
        when(scopeResolver.resolve(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new StatsScopeResolver.Resolved(new StatsScope(clubId, null, null, null, null, null), true));

        var dto = table("won", null, null, 0, 10);

        assertThat(dto.rows()).isEmpty();
        assertThat(dto.columns()).hasSize(15);
        assertThat(dto.basis().resultsCounted()).isZero();
        assertThat(dto.basis().teamsListed()).isZero();
        assertThat(dto.page().totalElements()).isZero();
        assertThat(dto.page().hasMore()).isFalse();
        verifyNoInteractions(aggregateRepository, factsRepository);
    }

    @Test
    void moreThanOneThousandTeamsIsRefusedAndLoggedWithoutNames() {
        inReach();
        TeamStatsAggregateView secret = row(UUID.randomUUID(), "Secret Eagles", 1, 0);
        when(aggregateRepository.aggregate(any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(Collections.nCopies(1_001, secret));

        assertThatThrownBy(() -> table("won", null, null, 0, 10))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("Narrow the filters");
        assertThat(logs.list).anyMatch(e -> e.getLevel() == Level.WARN);
        assertThat(logs.list).noneMatch(e -> e.getFormattedMessage().contains("Secret Eagles"));
        verify(aggregateRepository, org.mockito.Mockito.never())
                .basis(any(), any(), any(), any(), any(), anyBoolean(), any());
    }

    @Test
    void exactlyOneThousandTeamsIsAllowed() {
        inReach();
        TeamStatsAggregateView only = row(UUID.randomUUID(), "T", 1, 0);
        when(aggregateRepository.aggregate(any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(Collections.nCopies(1_000, only));
        TeamStatsBasisView bv3126 = basisView(1, 0, 0, 0);
        when(aggregateRepository.basis(any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(bv3126);

        assertThat(table("won", null, null, 0, 10).page().totalElements()).isEqualTo(1_000);
    }

    // ---- reading ----

    @Test
    void theTableQueriesWithoutATeamIdAndPassesTheCompetition() {
        inReach();
        noAggregate();
        UUID season = UUID.randomUUID();

        service.table(authentication, clubId, "won", null, season, null, null, "LEAGUE", null, 0, 10);

        verify(aggregateRepository).aggregate(eq(clubId), eq(season), any(), eq(null), eq("LEAGUE"), eq(false), any());
    }

    @Test
    void pagingReportsTotalAndHasMore() {
        inReach();
        List<TeamStatsAggregateView> rows =
                List.of(row(UUID.randomUUID(), "A", 3, 0), row(UUID.randomUUID(), "B", 2, 0), row(UUID.randomUUID(), "C", 1, 0));
        when(aggregateRepository.aggregate(any(), any(), any(), any(), any(), anyBoolean(), any())).thenReturn(rows);
        TeamStatsBasisView bv2108 = basisView(6, 1, 2, 0);
        when(aggregateRepository.basis(any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(bv2108);

        var first = table("won", null, null, 0, 2);
        var second = table("won", null, null, 1, 2);
        var past = table("won", null, null, 5, 2);

        assertThat(first.rows()).extracting(r -> r.teamName()).containsExactly("A", "B");
        assertThat(first.page().totalElements()).isEqualTo(3);
        assertThat(first.page().hasMore()).isTrue();
        assertThat(second.rows()).extracting(r -> r.teamName()).containsExactly("C");
        assertThat(second.page().hasMore()).isFalse();
        assertThat(past.rows()).isEmpty();
        assertThat(first.basis().resultsCounted()).isEqualTo(6);
        assertThat(first.basis().internalResults()).isEqualTo(1);
        assertThat(first.basis().resultsNoBallBowled()).isEqualTo(2);
        assertThat(first.basis().teamsListed()).isEqualTo(3);
        assertThat(first.basis().teamsRanked()).isEqualTo(3);
    }

    @Test
    void theMinimumRemovesTeamsAndReportsThemInTheBasis() {
        inReach();
        List<TeamStatsAggregateView> two =
                List.of(row(UUID.randomUUID(), "Big", 4, 1), row(UUID.randomUUID(), "Small", 1, 0));
        when(aggregateRepository.aggregate(any(), any(), any(), any(), any(), anyBoolean(), any())).thenReturn(two);
        TeamStatsBasisView bv3318 = basisView(6, 0, 0, 0);
        when(aggregateRepository.basis(any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(bv3318);

        var dto = table("winPercent", null, "3", 0, 10);

        assertThat(dto.rows()).extracting(r -> r.teamName()).containsExactly("Big");
        assertThat(dto.basis().belowMinimum()).isEqualTo(1);
    }

    // ---- one team ----

    private Team clubTeam(UUID club) {
        Team t = new Team();
        t.setId(teamId);
        t.setClubId(club);
        t.setSectionId(UUID.randomUUID());
        t.setName("Eagles");
        t.setActive(true);
        return t;
    }

    @Test
    void anUnknownTeamIsNotFound() {
        inReach();
        when(teamRepository.findById(teamId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.team(authentication, clubId, teamId, null, null, null))
                .isInstanceOf(NotFoundException.class);
        verifyNoInteractions(aggregateRepository, factsRepository);
    }

    @Test
    void anotherClubsTeamIsNotFound() {
        inReach();
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(clubTeam(UUID.randomUUID())));

        assertThatThrownBy(() -> service.team(authentication, clubId, teamId, null, null, null))
                .isInstanceOf(NotFoundException.class);
        verifyNoInteractions(aggregateRepository, factsRepository);
    }

    @Test
    void aTeamOutsideTheCallersReachIsRefusedByTheResolverAndPassesThrough() {
        when(scopeResolver.resolve(any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new AccessDeniedException("outside your sections"));

        assertThatThrownBy(() -> service.team(authentication, clubId, teamId, null, null, null))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(aggregateRepository, factsRepository);
    }

    @Test
    void thePageResolvesTheScopeWithATeamAndNeverASectionFilter() {
        inReach();
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(clubTeam(clubId)));
        noAggregate();
        UUID season = UUID.randomUUID();
        UUID league = UUID.randomUUID();

        service.team(authentication, clubId, teamId, season, league, "FRIENDLY");

        verify(scopeResolver)
                .resolve(authentication, clubId, season, league, teamId, null, StatsScope.Competition.FRIENDLY);
        verify(aggregateRepository).aggregate(eq(clubId), eq(season), eq(league), eq(teamId), eq("FRIENDLY"), eq(false), any());
    }

    @Test
    void aBadCompetitionOnThePageIsRefusedBeforeAnyLookup() {
        assertThatThrownBy(() -> service.team(authentication, clubId, teamId, null, null, "x"))
                .isInstanceOf(ValidationException.class);
        verifyNoInteractions(scopeResolver, aggregateRepository);
    }

    @Test
    void aTeamWithNoCountedResultIsAZeroCountersReadNotA404() {
        inReach();
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(clubTeam(clubId)));
        when(aggregateRepository.aggregate(any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(List.of());
        TeamStatsBasisView bv701 = basisView(0, 0, 2, 0);
        when(aggregateRepository.basis(any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(bv701);

        TeamStatsDto dto = service.team(authentication, clubId, teamId, null, null, null);

        assertThat(dto.teamName()).isEqualTo("Eagles");
        assertThat(dto.basis().resultsCounted()).isZero();
        assertThat(dto.basis().resultsNoBallBowled()).isEqualTo(2);
        assertThat(dto.record().played()).isZero();
        assertThat(dto.record().winPercent()).isNull();
        assertThat(dto.form()).isEmpty();
        assertThat(dto.notCaptured()).hasSize(1);
        verifyNoInteractions(factsRepository);
    }

    @Test
    void aTeamWithNothingInReachIsAZeroReadWithoutQueries() {
        when(scopeResolver.resolve(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new StatsScopeResolver.Resolved(new StatsScope(clubId, null, null, teamId, null, null), true));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(clubTeam(clubId)));

        TeamStatsDto dto = service.team(authentication, clubId, teamId, null, null, null);

        assertThat(dto.basis().resultsCounted()).isZero();
        verifyNoInteractions(aggregateRepository, factsRepository);
    }

    @Test
    void theFactsAreReadOnlyWhenThereAreResultsAndReferencesOnlyWhenAKeyExists() {
        inReach();
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(clubTeam(clubId)));
        List<TeamStatsAggregateView> one = List.of(row(teamId, "Eagles", 2, 1));
        when(aggregateRepository.aggregate(any(), any(), any(), any(), any(), anyBoolean(), any())).thenReturn(one);
        when(factsRepository.form(any(), any(), any(), any(), any(), anyBoolean(), any())).thenReturn(List.of());

        TeamStatsDto dto = service.team(authentication, clubId, teamId, null, null, null);

        assertThat(dto.record().won()).isEqualTo(2);
        assertThat(dto.record().lost()).isEqualTo(1);
        verify(factsRepository).form(any(), any(), any(), any(), any(), anyBoolean(), any());
        verify(factsRepository, org.mockito.Mockito.never())
                .matchReferences(any(), any(), any(), any(), any(), anyBoolean(), any(), any(), any(), any(), any(), any());
    }

    // ---- filter options ----

    @Test
    void anEmptyReachGivesEmptyFilterOptions() {
        when(scopeResolver.resolve(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new StatsScopeResolver.Resolved(new StatsScope(clubId, null, null, null, null, null), true));

        var options = service.filterOptions(authentication, clubId, null);

        assertThat(options.seasonIds()).isEmpty();
        assertThat(options.leagueIds()).isEmpty();
        assertThat(options.sectionIds()).isEmpty();
        assertThat(options.competitions()).isEmpty();
        verifyNoInteractions(factsRepository);
    }

    @Test
    void aTeamNarrowsTheFilterOptionsQueryToThatTeam() {
        inReach();
        when(factsRepository.filterOptions(any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(List.of());

        var options = service.filterOptions(authentication, clubId, teamId);

        assertThat(options.seasonIds()).isEmpty();
        assertThat(options.competitions()).isEmpty();
        verify(scopeResolver).resolve(authentication, clubId, null, null, teamId, null, null);
        verify(factsRepository).filterOptions(eq(clubId), eq(null), eq(null), eq(teamId), eq(null), anyBoolean(), any());
    }

    @Test
    void aTeamOutsideTheReachIsRefusedForFilterOptionsAndNothingIsQueried() {
        when(scopeResolver.resolve(any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new AccessDeniedException("outside your sections"));

        assertThatThrownBy(() -> service.filterOptions(authentication, clubId, teamId))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(factsRepository);
    }

    @Test
    void anUnknownTeamIsNotFoundForFilterOptions() {
        when(scopeResolver.resolve(any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new NotFoundException("Team not found"));

        assertThatThrownBy(() -> service.filterOptions(authentication, clubId, teamId))
                .isInstanceOf(NotFoundException.class);
        verifyNoInteractions(factsRepository);
    }
}
