package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.CreateMatchRequest;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.MatchFilterOptionsDto;
import com.cricketlegend.dto.UpdateMatchRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.MatchMapper;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.impl.MatchServiceImpl;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * Unit tests for MatchServiceImpl's business rules from docs/specs/029-league-management.md: the
 * exactly-one-of-team-id/team-name validation per side, cross-club 404 for {@code leagueId}/
 * {@code seasonId}, the cross-club-allowed {@code Team} reference for {@code homeTeamId}/{@code
 * awayTeamId}, the {@code club_id}-derivation rule (always the acting club, never the home team's
 * own club), and deactivate/reactivate's one-way transition guard.
 */
@ExtendWith(MockitoExtension.class)
class MatchServiceImplTest {

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private com.cricketlegend.repository.MatchSideRepository matchSideRepository;

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private SeasonRepository seasonRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private SectionRepository sectionRepository;

    @Mock
    private MatchMapper matchMapper;

    @Mock
    private AccessService accessService;

    private MatchServiceImpl matchService;
    private final Authentication authentication = new TestingAuthenticationToken(
            "club-admin-subject", null, java.util.List.of(new SimpleGrantedAuthority("ROLE_someone_else")));

    @BeforeEach
    void setUp() {
        matchService = new MatchServiceImpl(
                matchRepository, matchSideRepository, leagueRepository, seasonRepository, teamRepository,
                sectionRepository, matchMapper, accessService);
    }

    private MatchDto dummyDto() {
        return new MatchDto(
                UUID.randomUUID(), UUID.randomUUID(), null, "Home XI", null, "Away XI", null,
                UUID.randomUUID(), Instant.now(), null, true, false, false, null, null, null);
    }

    private Season season(UUID id, UUID clubId) {
        return Season.builder().id(id).clubId(clubId).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true)
                .build();
    }

    private League league(UUID id, UUID clubId) {
        return League.builder().id(id).clubId(clubId).name("Premier League").source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(11).active(true).build();
    }

    private Match existingMatch(UUID id, UUID clubId, boolean active) {
        return Match.builder().id(id).clubId(clubId).homeTeamId(UUID.randomUUID())
                .awayTeamName("Occasionals").seasonId(UUID.randomUUID()).matchDate(Instant.now())
                .active(active).build();
    }

    private Team team(UUID id, UUID clubId, UUID sectionId) {
        return Team.builder().id(id).clubId(clubId).sectionId(sectionId).name("1st XI").active(true).build();
    }

    @Test
    void createWithBothHomeTeamIdAndHomeTeamNameSetThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        CreateMatchRequest request = new CreateMatchRequest(
                UUID.randomUUID(), "Occasionals", null, "Away Team", null, UUID.randomUUID(),
                Instant.now(), null);

        assertThatThrownBy(() -> matchService.create(authentication, clubId, request))
                .isInstanceOf(ValidationException.class);
        verify(matchRepository, never()).save(any());
    }

    @Test
    void createWithNeitherAwayTeamIdNorAwayTeamNameSetThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        CreateMatchRequest request = new CreateMatchRequest(
                UUID.randomUUID(), null, null, null, null, UUID.randomUUID(), Instant.now(), null);

        assertThatThrownBy(() -> matchService.create(authentication, clubId, request))
                .isInstanceOf(ValidationException.class);
        verify(matchRepository, never()).save(any());
    }

    @Test
    void createWithASeasonBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, otherClubId)));

        CreateMatchRequest request = new CreateMatchRequest(
                null, "Home Occasionals", null, "Away Occasionals", null, seasonId, Instant.now(), null);

        assertThatThrownBy(() -> matchService.create(authentication, clubId, request))
                .isInstanceOf(NotFoundException.class);
        verify(matchRepository, never()).save(any());
    }

    @Test
    void createWithALeagueBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, otherClubId)));

        CreateMatchRequest request = new CreateMatchRequest(
                null, "Home Occasionals", null, "Away Occasionals", leagueId, seasonId, Instant.now(),
                null);

        assertThatThrownBy(() -> matchService.create(authentication, clubId, request))
                .isInstanceOf(NotFoundException.class);
        verify(matchRepository, never()).save(any());
    }

    @Test
    void createWithAHomeTeamIdReferencingARealTeamOfAnotherClubSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID otherClubsTeamId = UUID.randomUUID();
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(teamRepository.existsById(otherClubsTeamId)).thenReturn(true);
        ArgumentCaptor<Match> captor = ArgumentCaptor.forClass(Match.class);
        when(matchRepository.save(captor.capture())).thenAnswer(invocation -> captor.getValue());
        when(matchMapper.toDto(any(Match.class))).thenReturn(dummyDto());

        CreateMatchRequest request = new CreateMatchRequest(
                otherClubsTeamId, null, null, "Away Occasionals", null, seasonId, Instant.now(), null);

        matchService.create(authentication, clubId, request);

        Match saved = captor.getValue();
        assertThat(saved.getClubId()).isEqualTo(clubId);
        assertThat(saved.getHomeTeamId()).isEqualTo(otherClubsTeamId);
    }

    @Test
    void createWithANonexistentHomeTeamIdThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID missingTeamId = UUID.randomUUID();
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(teamRepository.existsById(missingTeamId)).thenReturn(false);

        CreateMatchRequest request = new CreateMatchRequest(
                missingTeamId, null, null, "Away Occasionals", null, seasonId, Instant.now(), null);

        assertThatThrownBy(() -> matchService.create(authentication, clubId, request))
                .isInstanceOf(NotFoundException.class);
        verify(matchRepository, never()).save(any());
    }

    @Test
    void clubIdSavedIsAlwaysTheActingClubNeverDerivedFromTheHomeTeamsOwnClub() {
        UUID actingClubId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID otherClubsHomeTeamId = UUID.randomUUID();
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, actingClubId)));
        when(teamRepository.existsById(otherClubsHomeTeamId)).thenReturn(true);
        ArgumentCaptor<Match> captor = ArgumentCaptor.forClass(Match.class);
        when(matchRepository.save(captor.capture())).thenAnswer(invocation -> captor.getValue());
        when(matchMapper.toDto(any(Match.class))).thenReturn(dummyDto());

        CreateMatchRequest request = new CreateMatchRequest(
                otherClubsHomeTeamId, null, null, "Away Occasionals", null, seasonId, Instant.now(), null);

        matchService.create(authentication, actingClubId, request);

        assertThat(captor.getValue().getClubId()).isEqualTo(actingClubId);
    }

    @Test
    void deactivateOnActiveMatchTransitionsToInactive() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        Match existing = existingMatch(matchId, clubId, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existing));
        when(matchRepository.save(existing)).thenReturn(existing);
        when(matchMapper.toDto(existing)).thenReturn(dummyDto());

        matchService.deactivate(authentication, clubId, matchId);

        assertThat(existing.isActive()).isFalse();
    }

    @Test
    void deactivateOnAlreadyInactiveMatchThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        Match existing = existingMatch(matchId, clubId, false);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> matchService.deactivate(authentication, clubId, matchId))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void reactivateOnInactiveMatchTransitionsToActive() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        Match existing = existingMatch(matchId, clubId, false);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existing));
        when(matchRepository.save(existing)).thenReturn(existing);
        when(matchMapper.toDto(existing)).thenReturn(dummyDto());

        matchService.reactivate(authentication, clubId, matchId);

        assertThat(existing.isActive()).isTrue();
    }

    @Test
    void reactivateOnAlreadyActiveMatchThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        Match existing = existingMatch(matchId, clubId, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> matchService.reactivate(authentication, clubId, matchId))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void getOnAMatchBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        Match existing = existingMatch(matchId, otherClubId, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> matchService.get(authentication, clubId, matchId)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void updateWithMissingSeasonIdThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UpdateMatchRequest request = new UpdateMatchRequest(
                null, "Home Occasionals", null, "Away Occasionals", null, null, Instant.now(), null);

        assertThatThrownBy(() -> matchService.update(authentication, clubId, matchId, request))
                .isInstanceOf(ValidationException.class);
        verify(matchRepository, never()).save(any());
    }

    // --- 035: section-scoped access ---

    @Test
    void getThrowsAccessDeniedWhenCallerCannotAdministerAnyOfTheMatchsResolvedSections() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        Match existing = existingMatch(matchId, clubId, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existing));
        java.util.Set<UUID> resolvedSections = java.util.Set.of(UUID.randomUUID());
        when(accessService.resolveMatchSectionIds(clubId, existing.getHomeTeamId(), existing.getAwayTeamId()))
                .thenReturn(resolvedSections);
        org.mockito.Mockito.doThrow(new org.springframework.security.access.AccessDeniedException("denied"))
                .when(accessService)
                .assertCanAdministerAnySection(authentication, clubId, resolvedSections);

        assertThatThrownBy(() -> matchService.get(authentication, clubId, matchId))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    /**
     * Per docs/plans/042-match-list-filters-and-search.md's own note: once every branch collapses
     * to one {@code matchRepository.findAll(Specification, Pageable)} call, the old "assert exactly
     * one of four distinct repository methods was called" style stops being meaningful — a
     * {@code Specification}'s actual predicate logic can't be inspected through a Mockito mock at
     * all. These tests instead assert what IS observable through the mock: which {@code
     * AccessService} calls happened (the real authorization/section-scoping behaviour, unchanged),
     * and that the single {@code findAll} entry point was invoked with the expected sorted {@code
     * Pageable}. Real filter-predicate correctness is proven in {@code MatchRepositoryTest}
     * instead, against a real database.
     */
    private static org.springframework.data.domain.Pageable defaultSortedPageable() {
        return org.springframework.data.domain.PageRequest.of(
                0, 10, org.springframework.data.domain.Sort.by("matchDate").descending());
    }

    @Test
    void listUsesThePlainClubWideQueryForAnUnrestrictedCallerWithNoExplicitSectionFilter() {
        UUID clubId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);
        when(matchRepository.findAll(any(Specification.class), eq(defaultSortedPageable())))
                .thenReturn(org.springframework.data.domain.Page.empty());

        matchService.list(authentication, clubId, null, false, null, null, null, pageable);

        verify(matchRepository).findAll(any(Specification.class), eq(defaultSortedPageable()));
        verify(accessService, never()).assertCanAdministerSection(any(), any(), any());
        verify(accessService, never()).sectionAndDescendantIds(any(), any());
    }

    @Test
    void listAppliesTheCallersOwnAccessibleSectionsForARestrictedCallerWithNoExplicitSectionFilter() {
        UUID clubId = UUID.randomUUID();
        UUID accessibleSectionId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId))
                .thenReturn(Optional.of(java.util.Set.of(accessibleSectionId)));
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);
        when(matchRepository.findAll(any(Specification.class), eq(defaultSortedPageable())))
                .thenReturn(org.springframework.data.domain.Page.empty());

        matchService.list(authentication, clubId, null, false, null, null, null, pageable);

        verify(matchRepository).findAll(any(Specification.class), eq(defaultSortedPageable()));
        verify(accessService, never()).assertCanAdministerSection(any(), any(), any());
        verify(accessService, never()).sectionAndDescendantIds(any(), any());
    }

    @Test
    void listValidatesAndNarrowsToTheDescendantClosureWhenAnExplicitSectionIdIsSupplied() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID descendantSectionId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(accessService.sectionAndDescendantIds(clubId, sectionId))
                .thenReturn(java.util.Set.of(sectionId, descendantSectionId));
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);
        when(matchRepository.findAll(any(Specification.class), eq(defaultSortedPageable())))
                .thenReturn(org.springframework.data.domain.Page.empty());

        matchService.list(authentication, clubId, sectionId, false, null, null, null, pageable);

        verify(accessService).assertCanAdministerSection(authentication, clubId, sectionId);
        verify(accessService).sectionAndDescendantIds(clubId, sectionId);
        verify(matchRepository).findAll(any(Specification.class), eq(defaultSortedPageable()));
    }

    // --- 040: announced enrichment ---

    @Test
    void listResolvesHomeAndAwaySideAnnouncedViaOneBatchedQueryForTheWholePage() {
        UUID clubId = UUID.randomUUID();
        UUID matchAId = UUID.randomUUID();
        UUID matchBId = UUID.randomUUID();
        UUID teamAHome = UUID.randomUUID();
        UUID teamAAway = UUID.randomUUID();
        UUID teamBHome = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);

        Match matchA = Match.builder().id(matchAId).clubId(clubId).homeTeamId(teamAHome).awayTeamId(teamAAway)
                .seasonId(UUID.randomUUID()).matchDate(Instant.now()).active(true).build();
        Match matchB = Match.builder().id(matchBId).clubId(clubId).homeTeamId(teamBHome)
                .awayTeamName("Occasionals").seasonId(UUID.randomUUID()).matchDate(Instant.now()).active(true)
                .build();
        when(matchRepository.findAll(any(Specification.class), eq(defaultSortedPageable())))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(matchA, matchB)));

        MatchDto dtoA = new MatchDto(matchAId, clubId, teamAHome, "Home A", teamAAway, "Away A", null,
                matchA.getSeasonId(), matchA.getMatchDate(), null, true, false, false, null, null, null);
        MatchDto dtoB = new MatchDto(matchBId, clubId, teamBHome, "Home B", null, "Occasionals", null,
                matchB.getSeasonId(), matchB.getMatchDate(), null, true, false, false, null, null, null);
        when(matchMapper.toDto(matchA)).thenReturn(dtoA);
        when(matchMapper.toDto(matchB)).thenReturn(dtoB);

        MatchSide announcedHomeSideOfA =
                MatchSide.builder().id(UUID.randomUUID()).matchId(matchAId).teamId(teamAHome).announced(true).build();
        MatchSide notAnnouncedHomeSideOfB =
                MatchSide.builder().id(UUID.randomUUID()).matchId(matchBId).teamId(teamBHome).announced(false)
                        .build();
        when(matchSideRepository.findByMatchIdIn(List.of(matchAId, matchBId)))
                .thenReturn(List.of(announcedHomeSideOfA, notAnnouncedHomeSideOfB));

        org.springframework.data.domain.Page<MatchDto> result =
                matchService.list(authentication, clubId, null, false, null, null, null, pageable);

        List<MatchDto> content = result.getContent();
        MatchDto resultA = content.stream().filter(d -> d.id().equals(matchAId)).findFirst().orElseThrow();
        MatchDto resultB = content.stream().filter(d -> d.id().equals(matchBId)).findFirst().orElseThrow();
        assertThat(resultA.homeSideAnnounced()).isTrue();
        assertThat(resultA.awaySideAnnounced()).isFalse();
        assertThat(resultB.homeSideAnnounced()).isFalse();
        assertThat(resultB.awaySideAnnounced()).isFalse();
        verify(matchSideRepository).findByMatchIdIn(List.of(matchAId, matchBId));
    }

    // --- 037: upcomingOnly ---

    @Test
    void listWithUpcomingOnlyFalseCallsFindAllOnceForAnUnrestrictedCaller() {
        UUID clubId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);
        when(matchRepository.findAll(any(Specification.class), eq(defaultSortedPageable())))
                .thenReturn(org.springframework.data.domain.Page.empty());

        matchService.list(authentication, clubId, null, false, null, null, null, pageable);

        verify(matchRepository).findAll(any(Specification.class), eq(defaultSortedPageable()));
    }

    @Test
    void listWithUpcomingOnlyTrueCallsFindAllOnceForAnUnrestrictedCaller() {
        UUID clubId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);
        when(matchRepository.findAll(any(Specification.class), eq(defaultSortedPageable())))
                .thenReturn(org.springframework.data.domain.Page.empty());

        matchService.list(authentication, clubId, null, true, null, null, null, pageable);

        verify(matchRepository).findAll(any(Specification.class), eq(defaultSortedPageable()));
    }

    @Test
    void listWithUpcomingOnlyTrueCallsFindAllOnceForARestrictedCaller() {
        UUID clubId = UUID.randomUUID();
        UUID accessibleSectionId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId))
                .thenReturn(Optional.of(java.util.Set.of(accessibleSectionId)));
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);
        when(matchRepository.findAll(any(Specification.class), eq(defaultSortedPageable())))
                .thenReturn(org.springframework.data.domain.Page.empty());

        matchService.list(authentication, clubId, null, true, null, null, null, pageable);

        verify(matchRepository).findAll(any(Specification.class), eq(defaultSortedPageable()));
    }

    @Test
    void listWithUpcomingOnlyTrueValidatesAccessWhenAnExplicitSectionIdIsSupplied() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID descendantSectionId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(accessService.sectionAndDescendantIds(clubId, sectionId))
                .thenReturn(java.util.Set.of(sectionId, descendantSectionId));
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);
        when(matchRepository.findAll(any(Specification.class), eq(defaultSortedPageable())))
                .thenReturn(org.springframework.data.domain.Page.empty());

        matchService.list(authentication, clubId, sectionId, true, null, null, null, pageable);

        verify(accessService).assertCanAdministerSection(authentication, clubId, sectionId);
        verify(matchRepository).findAll(any(Specification.class), eq(defaultSortedPageable()));
    }

    // --- 042: search/leagueId/seasonId filters ---

    @Test
    void listWithSearchLeagueIdAndSeasonIdAllSetCallsFindAllOnce() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);
        when(matchRepository.findAll(any(Specification.class), eq(defaultSortedPageable())))
                .thenReturn(org.springframework.data.domain.Page.empty());

        matchService.list(authentication, clubId, null, true, "riverside", leagueId, seasonId, pageable);

        verify(matchRepository).findAll(any(Specification.class), eq(defaultSortedPageable()));
    }

    @Test
    void listWithABlankSearchStringDoesNotThrowAndStillCallsFindAllOnce() {
        UUID clubId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);
        when(matchRepository.findAll(any(Specification.class), eq(defaultSortedPageable())))
                .thenReturn(org.springframework.data.domain.Page.empty());

        matchService.list(authentication, clubId, null, false, "   ", null, null, pageable);

        verify(matchRepository).findAll(any(Specification.class), eq(defaultSortedPageable()));
    }

    // --- 042: filterOptions() ---

    @Test
    void filterOptionsForAnUnrestrictedCallerWithNoExplicitSectionIdNeverValidatesSectionAccess() {
        UUID clubId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(matchRepository.findAll(any(Specification.class))).thenReturn(List.of());

        MatchFilterOptionsDto result =
                matchService.filterOptions(authentication, clubId, null, null, null, null, false);

        assertThat(result.sectionIds()).isEmpty();
        assertThat(result.leagueIds()).isEmpty();
        assertThat(result.seasonIds()).isEmpty();
        verify(accessService, never()).assertCanAdministerSection(any(), any(), any());
    }

    @Test
    void filterOptionsValidatesAnExplicitSectionIdAgainstTheCallersOwnAccess() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(accessService.sectionAndDescendantIds(clubId, sectionId)).thenReturn(java.util.Set.of(sectionId));
        when(matchRepository.findAll(any(Specification.class))).thenReturn(List.of());

        matchService.filterOptions(authentication, clubId, sectionId, null, null, null, false);

        verify(accessService).assertCanAdministerSection(authentication, clubId, sectionId);
    }

    @Test
    void filterOptionsReturnsDistinctNonNullLeagueIdsAndDistinctSeasonIds() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());

        Match withLeague = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamName("Home")
                .awayTeamName("Away").leagueId(leagueId).seasonId(seasonId).matchDate(Instant.now())
                .active(true).build();
        Match withoutLeague = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamName("Home2")
                .awayTeamName("Away2").leagueId(null).seasonId(seasonId).matchDate(Instant.now())
                .active(true).build();
        when(matchRepository.findAll(any(Specification.class))).thenReturn(List.of(withLeague, withoutLeague));

        MatchFilterOptionsDto result =
                matchService.filterOptions(authentication, clubId, null, null, null, null, false);

        assertThat(result.leagueIds()).containsExactly(leagueId);
        assertThat(result.seasonIds()).containsExactly(seasonId);
    }

    /**
     * Per docs/specs/042-match-list-filters-and-search.md's Search-autocomplete narrowing fix:
     * {@code teamIds} is the distinct non-null {@code homeTeamId}/{@code awayTeamId} values across
     * the matching matches — a duplicate team across two matches collapses to one entry, and a
     * side with no real {@code Team} (a free-text opponent) contributes nothing.
     */
    @Test
    void filterOptionsReturnsDistinctNonNullHomeAndAwayTeamIds() {
        UUID clubId = UUID.randomUUID();
        UUID teamA = UUID.randomUUID();
        UUID teamB = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());

        Match teamAHomeVsFreeText = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamId(teamA)
                .awayTeamName("Occasionals").seasonId(UUID.randomUUID()).matchDate(Instant.now())
                .active(true).build();
        Match teamAAwayVsTeamB = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamId(teamB)
                .awayTeamId(teamA).seasonId(UUID.randomUUID()).matchDate(Instant.now()).active(true).build();
        when(matchRepository.findAll(any(Specification.class)))
                .thenReturn(List.of(teamAHomeVsFreeText, teamAAwayVsTeamB));

        MatchFilterOptionsDto result =
                matchService.filterOptions(authentication, clubId, null, null, null, null, false);

        assertThat(result.teamIds()).containsExactlyInAnyOrder(teamA, teamB);
    }

    /**
     * Per docs/specs/042-match-list-filters-and-search.md's ancestor-closure design decision: a
     * grandchild section's own match must make its grandparent (and every section in between)
     * appear in the returned {@code sectionIds} array too, mirroring — upward — {@code
     * AccessService.sectionAndDescendantIds}'s existing downward descendant closure.
     */
    @Test
    void filterOptionsSectionIdsIncludeEveryAncestorOfADirectlyReachableSection() {
        UUID clubId = UUID.randomUUID();
        UUID grandparentId = UUID.randomUUID();
        UUID parentId = UUID.randomUUID();
        UUID grandchildSectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());

        Match match = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamId(teamId)
                .awayTeamName("Occasionals").seasonId(UUID.randomUUID()).matchDate(Instant.now())
                .active(true).build();
        when(matchRepository.findAll(any(Specification.class))).thenReturn(List.of(match));
        when(teamRepository.findAllById(java.util.Set.of(teamId)))
                .thenReturn(List.of(team(teamId, clubId, grandchildSectionId)));

        Section grandparent =
                Section.builder().id(grandparentId).clubId(clubId).name("Club").active(true).build();
        Section parent = Section.builder().id(parentId).clubId(clubId).parentSectionId(grandparentId)
                .name("Seniors").active(true).build();
        Section grandchild = Section.builder().id(grandchildSectionId).clubId(clubId)
                .parentSectionId(parentId).name("1st XI").active(true).build();
        when(sectionRepository.findByClubId(clubId)).thenReturn(List.of(grandparent, parent, grandchild));

        MatchFilterOptionsDto result =
                matchService.filterOptions(authentication, clubId, null, null, null, null, false);

        assertThat(result.sectionIds()).containsExactlyInAnyOrder(grandchildSectionId, parentId, grandparentId);
    }

    /**
     * Regression for a standards-reviewer finding on docs/specs/042-match-list-filters-and-
     * search.md's own ancestor-closure walk: a SECTION-scoped restricted caller's {@code
     * sectionIds} must stop climbing at their own accessible-section boundary — {@code
     * childToParent} is built from the club's entire section tree (unrestricted), so without
     * capping the walk at {@code sectionRestrictionForOwnArray}, a restricted caller would receive
     * ancestor section ids above their own grant root. Here the caller's own access is {@code
     * {parentId, grandchildSectionId}} (their grant root is {@code parent}, self+descendants) —
     * {@code grandparentId} must never appear in the result.
     */
    @Test
    void filterOptionsSectionIdsForARestrictedCallerNeverClimbAboveTheCallersOwnAccessBoundary() {
        UUID clubId = UUID.randomUUID();
        UUID grandparentId = UUID.randomUUID();
        UUID parentId = UUID.randomUUID();
        UUID grandchildSectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId))
                .thenReturn(Optional.of(java.util.Set.of(parentId, grandchildSectionId)));

        Match match = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamId(teamId)
                .awayTeamName("Occasionals").seasonId(UUID.randomUUID()).matchDate(Instant.now())
                .active(true).build();
        when(matchRepository.findAll(any(Specification.class))).thenReturn(List.of(match));
        when(teamRepository.findAllById(java.util.Set.of(teamId)))
                .thenReturn(List.of(team(teamId, clubId, grandchildSectionId)));

        Section grandparent =
                Section.builder().id(grandparentId).clubId(clubId).name("Club").active(true).build();
        Section parent = Section.builder().id(parentId).clubId(clubId).parentSectionId(grandparentId)
                .name("Seniors").active(true).build();
        Section grandchild = Section.builder().id(grandchildSectionId).clubId(clubId)
                .parentSectionId(parentId).name("1st XI").active(true).build();
        when(sectionRepository.findByClubId(clubId)).thenReturn(List.of(grandparent, parent, grandchild));

        MatchFilterOptionsDto result =
                matchService.filterOptions(authentication, clubId, null, null, null, null, false);

        assertThat(result.sectionIds()).containsExactlyInAnyOrder(grandchildSectionId, parentId);
    }

    // --- 037 item 9: listPrevious ---

    @Test
    void listPreviousCallsTheRepositoryWithTheRightParamsAndMapsEachResult() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID excludeMatchId = UUID.randomUUID();
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId, sectionId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        Match previous = existingMatch(UUID.randomUUID(), clubId, true);
        when(matchRepository.findPreviousForTeamSeasonLeague(
                        org.mockito.ArgumentMatchers.eq(clubId),
                        org.mockito.ArgumentMatchers.eq(teamId),
                        org.mockito.ArgumentMatchers.eq(seasonId),
                        org.mockito.ArgumentMatchers.eq(leagueId),
                        any(),
                        org.mockito.ArgumentMatchers.eq(excludeMatchId)))
                .thenReturn(List.of(previous));
        when(matchMapper.toDto(previous)).thenReturn(dummyDto());

        List<MatchDto> result =
                matchService.listPrevious(authentication, clubId, teamId, seasonId, leagueId, excludeMatchId);

        assertThat(result).hasSize(1);
        verify(accessService).assertCanAdministerSection(authentication, clubId, sectionId);
        verify(matchRepository)
                .findPreviousForTeamSeasonLeague(
                        org.mockito.ArgumentMatchers.eq(clubId),
                        org.mockito.ArgumentMatchers.eq(teamId),
                        org.mockito.ArgumentMatchers.eq(seasonId),
                        org.mockito.ArgumentMatchers.eq(leagueId),
                        any(),
                        org.mockito.ArgumentMatchers.eq(excludeMatchId));
    }

    @Test
    void listPreviousThrowsNotFoundWhenTeamDoesNotBelongToClub() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, otherClubId, sectionId)));

        assertThatThrownBy(() -> matchService.listPrevious(authentication, clubId, teamId, seasonId, null, null))
                .isInstanceOf(NotFoundException.class);
        verify(matchRepository, never()).findPreviousForTeamSeasonLeague(any(), any(), any(), any(), any(), any());
    }

    @Test
    void listPreviousThrowsNotFoundWhenSeasonDoesNotBelongToClub() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId, sectionId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, otherClubId)));

        assertThatThrownBy(() -> matchService.listPrevious(authentication, clubId, teamId, seasonId, null, null))
                .isInstanceOf(NotFoundException.class);
        verify(accessService).assertCanAdministerSection(authentication, clubId, sectionId);
        verify(matchRepository, never()).findPreviousForTeamSeasonLeague(any(), any(), any(), any(), any(), any());
    }
}
