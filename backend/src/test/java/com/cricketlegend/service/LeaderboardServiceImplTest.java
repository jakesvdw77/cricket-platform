package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.cricketlegend.dto.LeaderboardCatalogueDto;
import com.cricketlegend.dto.LeaderboardTableDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LeaderboardMapper;
import com.cricketlegend.repository.PlayerStatsAggregateRepository;
import com.cricketlegend.repository.PlayerStatsAggregateRepository.PlayerStatsAggregateView;
import com.cricketlegend.repository.PlayerStatsFactsRepository;
import com.cricketlegend.service.impl.LeaderboardServiceImpl;
import com.cricketlegend.service.support.StatsScope;
import com.cricketlegend.service.support.StatsScopeResolver;
import java.util.Collections;
import java.util.List;
import java.util.Set;
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
import org.springframework.security.core.Authentication;

/** Parameter rules and guards of docs/specs/103-player-stats.md "Leaderboards"; ranking itself is tested in LeaderboardRankerTest. */
@ExtendWith(MockitoExtension.class)
class LeaderboardServiceImplTest {

    @Mock
    private PlayerStatsAggregateRepository aggregateRepository;

    @Mock
    private PlayerStatsFactsRepository factsRepository;

    @Mock
    private StatsScopeResolver scopeResolver;

    @Mock
    private ClubLeaderboardSettingsService settingsService;

    @Mock
    private LeaderboardMapper mapper;

    @Mock
    private Authentication authentication;

    private LeaderboardServiceImpl service;
    private ListAppender<ILoggingEvent> logs;
    private Logger serviceLogger;

    private final UUID clubId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new LeaderboardServiceImpl(aggregateRepository, factsRepository, scopeResolver, settingsService, mapper);
        serviceLogger = (Logger) LoggerFactory.getLogger(LeaderboardServiceImpl.class);
        logs = new ListAppender<>();
        logs.start();
        serviceLogger.addAppender(logs);
    }

    @AfterEach
    void tearDown() {
        serviceLogger.detachAppender(logs);
    }

    private void inReach() {
        when(scopeResolver.resolve(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new StatsScopeResolver.Resolved(new StatsScope(clubId, null, null, null, null, null), false));
    }

    private LeaderboardTableDto table(String group, String sort, String direction, String minimum, Integer page, Integer size) {
        return service.table(authentication, clubId, group, sort, direction, null, null, null, null, minimum, page, size);
    }

    // ---- parameter rules (all refused before anything is read) ----

    @Test
    void aNegativePageIsRefused() {
        assertThatThrownBy(() -> table("batting", null, null, null, -1, null)).isInstanceOf(ValidationException.class);
        verifyNoInteractions(scopeResolver, aggregateRepository);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -5})
    void aSizeBelowOneIsRefused(int size) {
        assertThatThrownBy(() -> table("batting", null, null, null, 0, size)).isInstanceOf(ValidationException.class);
        verifyNoInteractions(scopeResolver, aggregateRepository);
    }

    @Test
    void aBadDirectionIsRefused() {
        assertThatThrownBy(() -> table("batting", "runs", "sideways", null, 0, 10))
                .isInstanceOf(ValidationException.class);
        verifyNoInteractions(scopeResolver, aggregateRepository);
    }

    @Test
    void anUnknownSortIsRefusedAndASortOfAnotherGroupToo() {
        assertThatThrownBy(() -> table("batting", "nope", null, null, 0, 10)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> table("batting", "wickets", null, null, 0, 10)).isInstanceOf(ValidationException.class);
        verifyNoInteractions(scopeResolver, aggregateRepository);
    }

    @ParameterizedTest
    @ValueSource(strings = {"awards", "nope", "BATTING", ""})
    void anUnknownGroupIsNotFound(String group) {
        assertThatThrownBy(() -> table(group, null, null, null, 0, 10)).isInstanceOf(NotFoundException.class);
        verifyNoInteractions(scopeResolver, aggregateRepository);
    }

    @ParameterizedTest
    @ValueSource(strings = {"-1", "abc", "1.5"})
    void aBadOrNegativeMinimumIsRefusedEvenWhenTheSortIsNotARate(String minimum) {
        assertThatThrownBy(() -> table("batting", "average", null, minimum, 0, 10)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> table("batting", "runs", null, minimum, 0, 10)).isInstanceOf(ValidationException.class);
        verifyNoInteractions(scopeResolver, aggregateRepository);
    }

    @Test
    void theAwardsViewRefusesABadMinimum() {
        assertThatThrownBy(() -> service.awards(authentication, clubId, null, null, null, null, "-1", null))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.awards(authentication, clubId, null, null, null, null, null, "x"))
                .isInstanceOf(ValidationException.class);
        verifyNoInteractions(scopeResolver, aggregateRepository);
    }

    // ---- paging and minimum on a read ----

    @Test
    void theDefaultPageIsZeroOfTen() {
        inReach();
        when(aggregateRepository.aggregate(any(), any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(List.of());

        LeaderboardTableDto dto = table("batting", null, null, null, null, null);

        assertThat(dto.page().number()).isZero();
        assertThat(dto.page().size()).isEqualTo(10);
        assertThat(dto.sort().code()).isEqualTo("runs");
    }

    @Test
    void aSizeAboveOneHundredIsCappedAtOneHundred() {
        inReach();
        when(aggregateRepository.aggregate(any(), any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(List.of());

        assertThat(table("batting", null, null, null, 0, 1000).page().size()).isEqualTo(100);
        assertThat(table("batting", null, null, null, 0, 100).page().size()).isEqualTo(100);
    }

    @Test
    void theMinimumIsIgnoredOnASortThatIsNotARate() {
        inReach();
        when(aggregateRepository.aggregate(any(), any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(List.of());

        LeaderboardTableDto dto = table("batting", "runs", null, "7", 0, 10);

        assertThat(dto.minimum().applies()).isFalse();
        assertThat(dto.minimum().value()).isNull();
        assertThat(dto.minimum().suggestedDefault()).isNull();
    }

    @Test
    void theMinimumIsKeptOnARateSort() {
        inReach();
        when(aggregateRepository.aggregate(any(), any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(List.of());

        LeaderboardTableDto dto = table("batting", "average", null, "7", 0, 10);

        assertThat(dto.minimum().applies()).isTrue();
        assertThat(dto.minimum().value()).isEqualTo(7);
    }

    // ---- the 5,000-player cap ----

    @Test
    void moreThanFiveThousandPlayersIsRefusedAndLogged() {
        inReach();
        PlayerStatsAggregateView row = mock(PlayerStatsAggregateView.class);
        when(aggregateRepository.aggregate(any(), any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(Collections.nCopies(5_001, row));

        assertThatThrownBy(() -> table("batting", null, null, null, 0, 10))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("Narrow the filters");
        assertThat(logs.list)
                .anyMatch(event -> event.getLevel() == Level.WARN && event.getFormattedMessage().contains("refused"));
        verifyNoInteractions(factsRepository);
    }

    @Test
    void theAwardsViewAppliesTheSameCap() {
        inReach();
        PlayerStatsAggregateView row = mock(PlayerStatsAggregateView.class);
        when(settingsService.awardBoards(clubId)).thenReturn(List.of());
        when(aggregateRepository.aggregate(any(), any(), any(), any(), any(), any(), anyBoolean(), any()))
                .thenReturn(Collections.nCopies(5_001, row));

        assertThatThrownBy(() -> service.awards(authentication, clubId, null, null, null, null, null, null))
                .isInstanceOf(ValidationException.class);
    }

    // ---- reach ----

    @Test
    void anEmptyReachGivesAnEmptyTableWithoutReadingAnything() {
        when(scopeResolver.resolve(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new StatsScopeResolver.Resolved(
                        new StatsScope(clubId, null, null, null, Set.of(), null), true));

        LeaderboardTableDto dto = table("bowling", null, null, null, 0, 10);

        assertThat(dto.rows()).isEmpty();
        assertThat(dto.basis().resultsCounted()).isZero();
        assertThat(dto.basis().playersListed()).isZero();
        assertThat(dto.page().totalElements()).isZero();
        assertThat(dto.page().hasMore()).isFalse();
        verifyNoInteractions(aggregateRepository, factsRepository);
    }

    @Test
    void anEmptyReachGivesEmptyFilterOptions() {
        when(scopeResolver.resolve(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new StatsScopeResolver.Resolved(
                        new StatsScope(clubId, null, null, null, Set.of(), null), true));

        assertThat(service.filterOptions(authentication, clubId).seasonIds()).isEmpty();
        verifyNoInteractions(factsRepository);
    }

    @Test
    void theCatalogueHasEveryGroupAndAwardsHasNoStandings() {
        LeaderboardCatalogueDto catalogue = service.catalogue();

        assertThat(catalogue.groups()).hasSize(4);
        assertThat(catalogue.groups().get(3).code()).isNull();
        assertThat(catalogue.groups().get(0).code()).isEqualTo("batting");
        verify(mapper, org.mockito.Mockito.atLeastOnce()).toInfo(any());
    }

    private static boolean anyBoolean() {
        return org.mockito.ArgumentMatchers.anyBoolean();
    }
}
