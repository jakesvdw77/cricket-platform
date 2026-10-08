package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityPollTypeFilter;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.domain.Team;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.TeamRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/** Unit tests for AvailabilityPollFilters (docs/specs/083): id validation, section scoping, slot-match batching. */
@ExtendWith(MockitoExtension.class)
class AvailabilityPollFiltersTest {

    private static final UUID CLUB_ID = UUID.randomUUID();
    private static final UUID SECTION = UUID.randomUUID();
    private static final UUID CHILD = UUID.randomUUID();
    private static final UUID OTHER = UUID.randomUUID();

    @Mock
    private AccessService accessService;

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private SectionAvailabilityWindowRepository windowRepository;

    @Mock
    private SectionAvailabilityWindowMatchRepository windowMatchRepository;

    private AvailabilityPollFilters filters;
    private final Authentication caller = new TestingAuthenticationToken("someone", "n/a");

    @BeforeEach
    void setUp() {
        filters = new AvailabilityPollFilters(
                accessService, leagueRepository, teamRepository, matchRepository, windowRepository,
                windowMatchRepository);
    }

    private AvailabilityPollFilter resolve(
            Optional<Set<UUID>> accessible, UUID leagueId, UUID sectionId, UUID teamId) {
        return filters.resolve(caller, CLUB_ID, accessible, leagueId, sectionId, teamId, null, false);
    }

    @Test
    void noIdsGivesAnUnnarrowedFilterWithoutAnyLookup() {
        AvailabilityPollFilter filter = resolve(Optional.empty(), null, null, null);

        assertThat(filter.sectionIds()).isNull();
        assertThat(filter.leagueId()).isNull();
        assertThat(filter.type()).isEqualTo(AvailabilityPollTypeFilter.ALL);
        verifyNoInteractions(leagueRepository, teamRepository, accessService);
    }

    @Test
    void aLeagueOfAnotherClubIsNotFound() {
        UUID leagueId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId))
                .thenReturn(Optional.of(League.builder().id(leagueId).clubId(UUID.randomUUID()).build()));

        assertThatThrownBy(() -> resolve(Optional.empty(), leagueId, null, null)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void anUnknownLeagueIsNotFound() {
        UUID leagueId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resolve(Optional.empty(), leagueId, null, null)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void theClubsOwnLeagueIsAccepted() {
        UUID leagueId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId))
                .thenReturn(Optional.of(League.builder().id(leagueId).clubId(CLUB_ID).build()));

        assertThat(resolve(Optional.empty(), leagueId, null, null).leagueId()).isEqualTo(leagueId);
    }

    @Test
    void aTeamOfAnotherClubIsNotFound() {
        UUID teamId = UUID.randomUUID();
        when(teamRepository.findById(teamId))
                .thenReturn(Optional.of(Team.builder().id(teamId).clubId(UUID.randomUUID()).sectionId(SECTION).build()));

        assertThatThrownBy(() -> resolve(Optional.empty(), null, null, teamId)).isInstanceOf(NotFoundException.class);
        verifyNoInteractions(accessService);
    }

    @Test
    void aTeamWhoseSectionTheCallerCannotAdministerIsForbidden() {
        UUID teamId = UUID.randomUUID();
        when(teamRepository.findById(teamId))
                .thenReturn(Optional.of(Team.builder().id(teamId).clubId(CLUB_ID).sectionId(SECTION).build()));
        doThrow(new AccessDeniedException("no")).when(accessService).assertCanAdministerSection(caller, CLUB_ID, SECTION);

        assertThatThrownBy(() -> resolve(Optional.empty(), null, null, teamId)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void aSectionIsValidatedAndExpandedToItsDescendants() {
        when(accessService.sectionAndDescendantIds(CLUB_ID, SECTION)).thenReturn(Set.of(SECTION, CHILD));

        AvailabilityPollFilter filter = resolve(Optional.empty(), null, SECTION, null);

        assertThat(filter.sectionIds()).containsExactlyInAnyOrder(SECTION, CHILD);
        org.mockito.Mockito.verify(accessService).assertCanAdministerSection(caller, CLUB_ID, SECTION);
    }

    @Test
    void theSectionSetIsIntersectedWithTheCallersAccessibleSections() {
        when(accessService.sectionAndDescendantIds(CLUB_ID, SECTION)).thenReturn(Set.of(SECTION, CHILD, OTHER));

        AvailabilityPollFilter filter = resolve(Optional.of(Set.of(CHILD, UUID.randomUUID())), null, SECTION, null);

        assertThat(filter.sectionIds()).containsExactly(CHILD);
    }

    @Test
    void aSectionOutsideTheCallersAccessIsForbidden() {
        doThrow(new AccessDeniedException("no")).when(accessService).assertCanAdministerSection(caller, CLUB_ID, SECTION);

        assertThatThrownBy(() -> resolve(Optional.of(Set.of(CHILD)), null, SECTION, null))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void slotMatchesAreGroupedByRoundFromBatchedLookups() {
        UUID round1 = UUID.randomUUID();
        UUID round2 = UUID.randomUUID();
        UUID w1 = UUID.randomUUID();
        UUID w2 = UUID.randomUUID();
        UUID w3 = UUID.randomUUID();
        Match m1 = Match.builder().id(UUID.randomUUID()).active(true).build();
        Match m2 = Match.builder().id(UUID.randomUUID()).active(true).build();
        when(windowRepository.findByRoundIdIn(anyCollection())).thenReturn(List.of(
                SectionAvailabilityWindow.builder().id(w1).roundId(round1).build(),
                SectionAvailabilityWindow.builder().id(w2).roundId(round1).build(),
                SectionAvailabilityWindow.builder().id(w3).roundId(round2).build()));
        when(windowMatchRepository.findByWindowIdIn(anyCollection())).thenReturn(List.of(
                SectionAvailabilityWindowMatch.builder().windowId(w1).matchId(m1.getId()).build(),
                SectionAvailabilityWindowMatch.builder().windowId(w2).matchId(m2.getId()).build()));
        when(matchRepository.findAllById(anyCollection())).thenReturn(List.of(m1, m2));

        Map<UUID, List<Match>> result = filters.slotMatchesByRoundId(List.of(round1, round2));

        assertThat(result).containsOnlyKeys(round1);
        assertThat(result.get(round1)).containsExactlyInAnyOrder(m1, m2);
    }

    @Test
    void aDeactivatedSlotMatchIsLeftOut() {
        UUID round = UUID.randomUUID();
        UUID window = UUID.randomUUID();
        Match active = Match.builder().id(UUID.randomUUID()).active(true).build();
        Match inactive = Match.builder().id(UUID.randomUUID()).active(false).build();
        when(windowRepository.findByRoundIdIn(anyCollection()))
                .thenReturn(List.of(SectionAvailabilityWindow.builder().id(window).roundId(round).build()));
        when(windowMatchRepository.findByWindowIdIn(anyCollection())).thenReturn(List.of(
                SectionAvailabilityWindowMatch.builder().windowId(window).matchId(active.getId()).build(),
                SectionAvailabilityWindowMatch.builder().windowId(window).matchId(inactive.getId()).build()));
        when(matchRepository.findAllById(anyCollection())).thenReturn(List.of(active, inactive));

        assertThat(filters.slotMatchesByRoundId(List.of(round)).get(round)).containsExactly(active);
    }

    @Test
    void noRoundsOrNoWindowsLoadsNoMatches() {
        assertThat(filters.slotMatchesByRoundId(List.of())).isEmpty();
        when(windowRepository.findByRoundIdIn(anyCollection())).thenReturn(List.of());

        assertThat(filters.slotMatchesByRoundId(List.of(UUID.randomUUID()))).isEmpty();
        verifyNoInteractions(windowMatchRepository, matchRepository);
    }
}
