package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.PlayerMatchListDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerStatsFactsRepository;
import com.cricketlegend.repository.PlayerStatsFactsRepository.MatchHeaderView;
import com.cricketlegend.service.impl.PlayerMatchListServiceImpl;
import com.cricketlegend.service.support.ClubPlayerLookup;
import com.cricketlegend.service.support.StatsScope;
import com.cricketlegend.service.support.StatsScopeResolver;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

/** The paging, direction and competition validation, the player/club check and the page arithmetic of spec 115. */
@ExtendWith(MockitoExtension.class)
class PlayerMatchListServiceImplTest {

    @Mock
    private PlayerStatsFactsRepository factsRepository;

    @Mock
    private PlayerProfileRepository playerProfileRepository;

    @Mock
    private StatsScopeResolver scopeResolver;

    @Mock
    private Authentication authentication;

    private PlayerMatchListServiceImpl service;

    private final UUID clubId = UUID.randomUUID();
    private final UUID playerId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new PlayerMatchListServiceImpl(
                factsRepository, new ClubPlayerLookup(playerProfileRepository), scopeResolver);
    }

    private PlayerMatchListDto list(String competition, String direction, Integer page, Integer size) {
        return service.list(authentication, clubId, playerId, null, null, null, null, competition, direction, page, size);
    }

    private void playerInClub() {
        when(playerProfileRepository.findById(playerId))
                .thenReturn(Optional.of(PlayerProfile.builder().id(playerId).clubId(clubId).build()));
    }

    private void resolverReturns(StatsScope.Competition competition, boolean nothingInReach) {
        when(scopeResolver.resolve(authentication, clubId, null, null, null, null, competition))
                .thenReturn(new StatsScopeResolver.Resolved(
                        new StatsScope(clubId, null, null, null, null, competition), nothingInReach));
    }

    private void total(long total) {
        when(factsRepository.matchCount(any(), any(), any(), any(), any(), any(), anyBoolean(), anyCollection()))
                .thenReturn(total);
    }

    private List<MatchHeaderView> headers(int n) {
        List<MatchHeaderView> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            MatchHeaderView v = mock(MatchHeaderView.class);
            when(v.getResultId()).thenReturn(UUID.randomUUID());
            when(v.getMatchId()).thenReturn(UUID.randomUUID());
            when(v.getMatchEpochMillis()).thenReturn(1_700_000_000_000L + i);
            when(v.getBallsPerOver()).thenReturn(6);
            when(v.getOutcome()).thenReturn("WON");
            when(v.getWinningSide()).thenReturn("HOME");
            when(v.getOnHome()).thenReturn(true);
            out.add(v);
        }
        return out;
    }

    private void pageReturns(int rows, boolean ascending, int size, long offset) {
        List<MatchHeaderView> page = headers(rows);
        when(factsRepository.matchPage(any(), any(), any(), any(), any(), any(), anyBoolean(), anyCollection(),
                        eq(ascending), eq(size), eq(offset)))
                .thenReturn(page);
    }

    // ---- validation ----

    @ParameterizedTest
    @ValueSource(ints = {-1, -20})
    void aNegativePageIsRefusedNotClamped(int page) {
        assertThatThrownBy(() -> list(null, null, page, null)).isInstanceOf(ValidationException.class);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1, 101, 1000})
    void aSizeOutsideOneToOneHundredIsRefusedNotClamped(int size) {
        assertThatThrownBy(() -> list(null, null, null, size)).isInstanceOf(ValidationException.class);
        verifyNoInteractions(factsRepository);
    }

    @Test
    void sizeOneHundredIsAccepted() {
        playerInClub();
        resolverReturns(null, false);
        total(0);
        var dto = list(null, null, 0, 100);
        assertThat(dto.page().size()).isEqualTo(100);
    }

    @Test
    void sizeOneIsAccepted() {
        playerInClub();
        resolverReturns(null, false);
        total(0);
        assertThat(list(null, null, 0, 1).page().size()).isEqualTo(1);
    }

    @Test
    void defaultsArePageZeroSizeTwenty() {
        playerInClub();
        resolverReturns(null, false);
        total(0);
        var dto = list(null, null, null, null);
        assertThat(dto.page().number()).isZero();
        assertThat(dto.page().size()).isEqualTo(20);
    }

    @ParameterizedTest
    @ValueSource(strings = {"up", "ascending", "x", "asc;"})
    void anyOtherDirectionIsRefused(String direction) {
        assertThatThrownBy(() -> list(null, direction, null, null)).isInstanceOf(ValidationException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"asc", "ASC", "Asc", "desc", "DESC", "Desc", "", "  "})
    void directionIsCaseInsensitiveAndBlankMeansNewestFirst(String direction) {
        playerInClub();
        resolverReturns(null, false);
        total(0);
        assertThat(list(null, direction, null, null)).isNotNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"league", "Friendly", "ALL", "x"})
    void aBadCompetitionIsRefused(String competition) {
        assertThatThrownBy(() -> list(competition, null, null, null)).isInstanceOf(ValidationException.class);
    }

    @Test
    void aBlankCompetitionMeansNoFilter() {
        playerInClub();
        resolverReturns(null, false);
        total(0);
        var dto = list("  ", null, null, null);
        assertThat(dto.scope().competition()).isNull();
    }

    @Test
    void aValidCompetitionIsEchoedAndPassedToTheQueries() {
        playerInClub();
        resolverReturns(StatsScope.Competition.LEAGUE, false);
        total(0);
        var dto = list("LEAGUE", null, null, null);
        assertThat(dto.scope().competition()).isEqualTo("LEAGUE");
        verify(factsRepository).matchCount(eq(clubId), eq(playerId), any(), any(), any(), eq("LEAGUE"), anyBoolean(), anyCollection());
    }

    @Test
    void validationHappensBeforeThePlayerLookup() {
        assertThatThrownBy(() -> list(null, null, 0, 101)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> list(null, "sideways", 0, 10)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> list("bogus", null, 0, 10)).isInstanceOf(ValidationException.class);
        verifyNoInteractions(playerProfileRepository, scopeResolver, factsRepository);
    }

    // ---- player check ----

    @Test
    void anUnknownPlayerIsNotFound() {
        when(playerProfileRepository.findById(playerId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> list(null, null, null, null)).isInstanceOf(NotFoundException.class);
        verifyNoInteractions(factsRepository, scopeResolver);
    }

    @Test
    void anotherClubsPlayerIsNotFound() {
        when(playerProfileRepository.findById(playerId))
                .thenReturn(Optional.of(PlayerProfile.builder().id(playerId).clubId(UUID.randomUUID()).build()));
        assertThatThrownBy(() -> list(null, null, null, null)).isInstanceOf(NotFoundException.class);
        verifyNoInteractions(factsRepository, scopeResolver);
    }

    // ---- nothing in reach and paging ----

    @Test
    void nothingInReachIsAnEmptyPageWithoutQueryingTheRepository() {
        playerInClub();
        resolverReturns(null, true);
        var dto = list(null, null, 2, 50);
        assertThat(dto.rows()).isEmpty();
        assertThat(dto.page().totalElements()).isZero();
        assertThat(dto.page().hasMore()).isFalse();
        assertThat(dto.page().number()).isEqualTo(2);
        assertThat(dto.page().size()).isEqualTo(50);
        assertThat(dto.playerId()).isEqualTo(playerId);
        verifyNoInteractions(factsRepository);
    }

    @Test
    void aPlayerWithNoMatchesIsAnEmptyPageAndNoPageQueryRuns() {
        playerInClub();
        resolverReturns(null, false);
        total(0);
        var dto = list(null, null, null, null);
        assertThat(dto.rows()).isEmpty();
        assertThat(dto.page().totalElements()).isZero();
        verify(factsRepository, never()).matchPage(any(), any(), any(), any(), any(), any(), anyBoolean(),
                anyCollection(), anyBoolean(), anyInt(), anyLong());
    }

    @Test
    void aFirstPageWithMoreMatchesHasMore() {
        playerInClub();
        resolverReturns(null, false);
        total(45);
        pageReturns(20, false, 20, 0);
        var dto = list(null, null, 0, 20);
        assertThat(dto.rows()).hasSize(20);
        assertThat(dto.page().totalElements()).isEqualTo(45);
        assertThat(dto.page().hasMore()).isTrue();
        assertThat(dto.page().number()).isZero();
    }

    @Test
    void theLastPartialPageHasNoMore() {
        playerInClub();
        resolverReturns(null, false);
        total(45);
        pageReturns(5, false, 20, 40);
        var dto = list(null, null, 2, 20);
        assertThat(dto.rows()).hasSize(5);
        assertThat(dto.page().hasMore()).isFalse();
        assertThat(dto.page().totalElements()).isEqualTo(45);
    }

    @Test
    void anExactlyFullLastPageHasNoMore() {
        playerInClub();
        resolverReturns(null, false);
        total(40);
        pageReturns(20, false, 20, 20);
        var dto = list(null, null, 1, 20);
        assertThat(dto.rows()).hasSize(20);
        assertThat(dto.page().hasMore()).isFalse();
    }

    @Test
    void aPageForTheOffsetUsesPageTimesSize() {
        playerInClub();
        resolverReturns(null, false);
        total(1000);
        pageReturns(10, false, 10, 30);
        assertThat(list(null, null, 3, 10).rows()).hasSize(10);
    }

    @Test
    void aPagePastTheEndIsEmptyWithTheTrueTotalAndNoPageQuery() {
        playerInClub();
        resolverReturns(null, false);
        total(45);
        var dto = list(null, null, 3, 20);
        assertThat(dto.rows()).isEmpty();
        assertThat(dto.page().totalElements()).isEqualTo(45);
        assertThat(dto.page().hasMore()).isFalse();
        assertThat(dto.page().number()).isEqualTo(3);
        verify(factsRepository, never()).matchPage(any(), any(), any(), any(), any(), any(), anyBoolean(),
                anyCollection(), anyBoolean(), anyInt(), anyLong());
    }

    @Test
    void ascendingFlipsTheRepositoryFlagAndDescendingDoesNot() {
        playerInClub();
        resolverReturns(null, false);
        total(3);
        pageReturns(3, true, 20, 0);
        assertThat(list(null, "ASC", 0, 20).rows()).hasSize(3);
        verify(factsRepository).matchPage(any(), any(), any(), any(), any(), any(), anyBoolean(), anyCollection(),
                eq(true), eq(20), eq(0L));
    }

    @Test
    void defaultDirectionIsNewestFirst() {
        playerInClub();
        resolverReturns(null, false);
        total(2);
        pageReturns(2, false, 20, 0);
        assertThat(list(null, null, null, null).rows()).hasSize(2);
        verify(factsRepository).matchPage(any(), any(), any(), any(), any(), any(), anyBoolean(), anyCollection(),
                eq(false), eq(20), eq(0L));
    }

    @Test
    void theEntryQueriesAreSkippedWhenThePageReturnsNoHeaders() {
        playerInClub();
        resolverReturns(null, false);
        total(5);
        when(factsRepository.matchPage(any(), any(), any(), any(), any(), any(), anyBoolean(), anyCollection(),
                        anyBoolean(), anyInt(), anyLong()))
                .thenReturn(List.of());
        var dto = list(null, null, 0, 20);
        assertThat(dto.rows()).isEmpty();
        verify(factsRepository, never()).matchBatting(any(), any(), any(), any(), any(), any(), anyBoolean(),
                anyCollection(), anyCollection());
    }

    @Test
    void aFilteredScopeIsEchoedBackWithTheVerifiedBasis() {
        UUID season = UUID.randomUUID();
        playerInClub();
        when(scopeResolver.resolve(authentication, clubId, season, null, null, null, null))
                .thenReturn(new StatsScopeResolver.Resolved(
                        new StatsScope(clubId, season, null, null, null, null), false));
        total(0);
        var dto = service.list(authentication, clubId, playerId, season, null, null, null, null, null, null, null);
        assertThat(dto.scope().seasonId()).isEqualTo(season);
        assertThat(dto.scope().kind()).isEqualTo("CLUB_VERIFIED");
    }
}
