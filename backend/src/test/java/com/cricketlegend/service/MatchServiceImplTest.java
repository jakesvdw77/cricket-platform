package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Season;
import com.cricketlegend.dto.CreateMatchRequest;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.UpdateMatchRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.MatchMapper;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.impl.MatchServiceImpl;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
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
    private LeagueRepository leagueRepository;

    @Mock
    private SeasonRepository seasonRepository;

    @Mock
    private TeamRepository teamRepository;

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
                matchRepository, leagueRepository, seasonRepository, teamRepository, matchMapper, accessService);
    }

    private MatchDto dummyDto() {
        return new MatchDto(
                UUID.randomUUID(), UUID.randomUUID(), null, "Home XI", null, "Away XI", null,
                UUID.randomUUID(), Instant.now(), null, true, null, null, null);
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

    @Test
    void listUsesThePlainClubWideQueryForAnUnrestrictedCallerWithNoExplicitSectionFilter() {
        UUID clubId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);
        when(matchRepository.findByClubId(org.mockito.ArgumentMatchers.eq(clubId), any()))
                .thenReturn(org.springframework.data.domain.Page.empty());

        matchService.list(authentication, clubId, null, false, pageable);

        verify(matchRepository).findByClubId(org.mockito.ArgumentMatchers.eq(clubId), any());
        verify(matchRepository, never()).findByClubIdAndSectionIdIn(any(), any(), any());
    }

    @Test
    void listUsesTheSectionFilteredQueryForARestrictedCaller() {
        UUID clubId = UUID.randomUUID();
        UUID accessibleSectionId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId))
                .thenReturn(Optional.of(java.util.Set.of(accessibleSectionId)));
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);
        when(matchRepository.findByClubIdAndSectionIdIn(
                        org.mockito.ArgumentMatchers.eq(clubId),
                        org.mockito.ArgumentMatchers.eq(java.util.Set.of(accessibleSectionId)),
                        any()))
                .thenReturn(org.springframework.data.domain.Page.empty());

        matchService.list(authentication, clubId, null, false, pageable);

        verify(matchRepository, never()).findByClubId(any(), any());
    }

    @Test
    void listUsesTheSectionFilteredQueryWhenAnExplicitSectionIdIsSuppliedEvenForAnUnrestrictedCaller() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID descendantSectionId = UUID.randomUUID();
        when(accessService.sectionAndDescendantIds(clubId, sectionId))
                .thenReturn(java.util.Set.of(sectionId, descendantSectionId));
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);
        when(matchRepository.findByClubIdAndSectionIdIn(
                        org.mockito.ArgumentMatchers.eq(clubId), any(), any()))
                .thenReturn(org.springframework.data.domain.Page.empty());

        matchService.list(authentication, clubId, sectionId, false, pageable);

        verify(accessService).assertCanAdministerSection(authentication, clubId, sectionId);
        verify(matchRepository, never()).findByClubId(any(), any());
    }

    // --- 037: upcomingOnly ---

    @Test
    void listWithUpcomingOnlyFalseUsesThePlainClubWideQueryUnchangedForAnUnrestrictedCaller() {
        UUID clubId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);
        org.springframework.data.domain.Page<Match> expected = org.springframework.data.domain.Page.empty();
        when(matchRepository.findByClubId(org.mockito.ArgumentMatchers.eq(clubId), any())).thenReturn(expected);

        matchService.list(authentication, clubId, null, false, pageable);

        verify(matchRepository).findByClubId(org.mockito.ArgumentMatchers.eq(clubId), any());
        verify(matchRepository, never())
                .findByClubIdAndMatchDateGreaterThanEqual(any(), any(), any());
        verify(matchRepository, never())
                .findByClubIdAndSectionIdInAndMatchDateGreaterThanEqual(any(), any(), any(), any());
    }

    @Test
    void listWithUpcomingOnlyTrueUsesTheDateFilteredClubWideQueryForAnUnrestrictedCaller() {
        UUID clubId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);
        when(matchRepository.findByClubIdAndMatchDateGreaterThanEqual(
                        org.mockito.ArgumentMatchers.eq(clubId), any(), any()))
                .thenReturn(org.springframework.data.domain.Page.empty());

        matchService.list(authentication, clubId, null, true, pageable);

        verify(matchRepository)
                .findByClubIdAndMatchDateGreaterThanEqual(org.mockito.ArgumentMatchers.eq(clubId), any(), any());
        verify(matchRepository, never()).findByClubId(any(), any());
        verify(matchRepository, never()).findByClubIdAndSectionIdIn(any(), any(), any());
    }

    @Test
    void listWithUpcomingOnlyTrueUsesTheDateFilteredSectionQueryForARestrictedCaller() {
        UUID clubId = UUID.randomUUID();
        UUID accessibleSectionId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId))
                .thenReturn(Optional.of(java.util.Set.of(accessibleSectionId)));
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);
        when(matchRepository.findByClubIdAndSectionIdInAndMatchDateGreaterThanEqual(
                        org.mockito.ArgumentMatchers.eq(clubId),
                        org.mockito.ArgumentMatchers.eq(java.util.Set.of(accessibleSectionId)),
                        any(),
                        any()))
                .thenReturn(org.springframework.data.domain.Page.empty());

        matchService.list(authentication, clubId, null, true, pageable);

        verify(matchRepository)
                .findByClubIdAndSectionIdInAndMatchDateGreaterThanEqual(
                        org.mockito.ArgumentMatchers.eq(clubId),
                        org.mockito.ArgumentMatchers.eq(java.util.Set.of(accessibleSectionId)),
                        any(),
                        any());
        verify(matchRepository, never()).findByClubIdAndSectionIdIn(any(), any(), any());
        verify(matchRepository, never()).findByClubId(any(), any());
    }

    @Test
    void listWithUpcomingOnlyTrueUsesTheDateFilteredSectionQueryWhenAnExplicitSectionIdIsSupplied() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID descendantSectionId = UUID.randomUUID();
        when(accessService.sectionAndDescendantIds(clubId, sectionId))
                .thenReturn(java.util.Set.of(sectionId, descendantSectionId));
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);
        when(matchRepository.findByClubIdAndSectionIdInAndMatchDateGreaterThanEqual(
                        org.mockito.ArgumentMatchers.eq(clubId), any(), any(), any()))
                .thenReturn(org.springframework.data.domain.Page.empty());

        matchService.list(authentication, clubId, sectionId, true, pageable);

        verify(accessService).assertCanAdministerSection(authentication, clubId, sectionId);
        verify(matchRepository)
                .findByClubIdAndSectionIdInAndMatchDateGreaterThanEqual(
                        org.mockito.ArgumentMatchers.eq(clubId), any(), any(), any());
        verify(matchRepository, never()).findByClubIdAndSectionIdIn(any(), any(), any());
        verify(matchRepository, never()).findByClubId(any(), any());
    }
}
