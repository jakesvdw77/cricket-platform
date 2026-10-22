package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.PlayerStatsDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerStatsAggregateRepository;
import com.cricketlegend.repository.PlayerStatsFactsRepository;
import com.cricketlegend.service.impl.PlayerStatsServiceImpl;
import com.cricketlegend.service.support.ClubPlayerLookup;
import com.cricketlegend.service.support.StatsScope;
import com.cricketlegend.service.support.StatsScopeResolver;
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
import org.springframework.security.core.Authentication;

/** The competition filter rule of docs/specs/103-player-stats.md, and the player/club check, at the service. */
@ExtendWith(MockitoExtension.class)
class PlayerStatsServiceImplTest {

    @Mock
    private PlayerStatsAggregateRepository aggregateRepository;

    @Mock
    private PlayerStatsFactsRepository factsRepository;

    @Mock
    private PlayerProfileRepository playerProfileRepository;

    @Mock
    private StatsScopeResolver scopeResolver;

    @Mock
    private Authentication authentication;

    private PlayerStatsServiceImpl service;

    private final UUID clubId = UUID.randomUUID();
    private final UUID playerId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new PlayerStatsServiceImpl(
                aggregateRepository, factsRepository, new ClubPlayerLookup(playerProfileRepository), scopeResolver);
    }

    private PlayerStatsDto get(String competition) {
        return service.get(authentication, clubId, playerId, null, null, null, null, competition);
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

    @ParameterizedTest
    @ValueSource(strings = {"league", "Friendly", "ALL", "LEAGUE ", "x"})
    void anythingElseIsRefusedAndCaseMatters(String competition) {
        assertThatThrownBy(() -> get(competition)).isInstanceOf(ValidationException.class);
        verifyNoInteractions(playerProfileRepository, scopeResolver, aggregateRepository);
    }

    @ParameterizedTest
    @ValueSource(strings = {"LEAGUE", "FRIENDLY"})
    void leagueAndFriendlyAreAcceptedAndPassedToTheResolver(String competition) {
        StatsScope.Competition expected = StatsScope.Competition.valueOf(competition);
        playerInClub();
        resolverReturns(expected, false);
        when(aggregateRepository.aggregate(eq(clubId), eq(playerId), any(), any(), any(), eq(competition), eq(false), any()))
                .thenReturn(List.of());

        PlayerStatsDto dto = get(competition);

        assertThat(dto.scope().competition()).isEqualTo(competition);
        verify(scopeResolver).resolve(authentication, clubId, null, null, null, null, expected);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    void blankMeansNoFilter(String competition) {
        playerInClub();
        resolverReturns(null, false);
        when(aggregateRepository.aggregate(eq(clubId), eq(playerId), any(), any(), any(), eq(null), eq(false), any()))
                .thenReturn(List.of());

        assertThat(get(competition).scope().competition()).isNull();
    }

    @Test
    void nullMeansNoFilter() {
        playerInClub();
        resolverReturns(null, false);
        when(aggregateRepository.aggregate(eq(clubId), eq(playerId), any(), any(), any(), eq(null), eq(false), any()))
                .thenReturn(List.of());

        assertThat(get(null).scope().competition()).isNull();
    }

    @Test
    void nothingInReachReadsNothingAndReturnsEmptyFigures() {
        playerInClub();
        when(scopeResolver.resolve(authentication, clubId, null, null, null, null, null))
                .thenReturn(new StatsScopeResolver.Resolved(
                        new StatsScope(clubId, null, null, null, Set.of(), null), true));

        PlayerStatsDto dto = get(null);

        assertThat(dto.playerId()).isEqualTo(playerId);
        verifyNoInteractions(aggregateRepository, factsRepository);
    }

    @Test
    void anotherClubsPlayerIsNotFound() {
        when(playerProfileRepository.findById(playerId))
                .thenReturn(Optional.of(PlayerProfile.builder().id(playerId).clubId(UUID.randomUUID()).build()));

        assertThatThrownBy(() -> get(null)).isInstanceOf(NotFoundException.class);
        verifyNoInteractions(scopeResolver);
    }
}
