package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityPollType;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.LeagueTeam;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.CreateMatchRequest;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.MatchFilterOptionsDto;
import com.cricketlegend.dto.MatchPollDto;
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
import java.util.Collection;
import java.util.Map;
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
    private com.cricketlegend.repository.MatchSidePlayerRepository matchSidePlayerRepository;

    @Mock
    private MatchPollCoverageService matchPollCoverageService;

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private SeasonRepository seasonRepository;

    @Mock
    private com.cricketlegend.repository.LeagueTeamRepository leagueTeamRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private SectionRepository sectionRepository;

    @Mock
    private MatchMapper matchMapper;

    @Mock
    private AccessService accessService;

    private MatchServiceImpl matchService;
    private final UUID clubIdForLinks = UUID.randomUUID();
    private final Authentication authentication = new TestingAuthenticationToken(
            "club-admin-subject", null, java.util.List.of(new SimpleGrantedAuthority("ROLE_someone_else")));

    @BeforeEach
    void setUp() {
        matchService = new MatchServiceImpl(
                matchRepository, matchSideRepository, matchSidePlayerRepository, matchPollCoverageService,
                leagueRepository, seasonRepository, leagueTeamRepository, teamRepository, sectionRepository, matchMapper,
                accessService);
    }

    private MatchDto dummyDto() {
        return new MatchDto(
                UUID.randomUUID(), UUID.randomUUID(), null, "Home XI", null, "Away XI", null, null, null,
                UUID.randomUUID(), Instant.now(), null, true, false, false, null, null, null, null, null, null, null, null, null, null, null);
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
                UUID.randomUUID(), "Occasionals", null, "Away Team", null, null, null,
                UUID.randomUUID(), Instant.now(), null, null, null, null, null);

        assertThatThrownBy(() -> matchService.create(authentication, clubId, request))
                .isInstanceOf(ValidationException.class);
        verify(matchRepository, never()).save(any());
    }

    @Test
    void createWithNeitherAwayTeamIdNorAwayTeamNameSetThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        CreateMatchRequest request = new CreateMatchRequest(
                UUID.randomUUID(), null, null, null, null, null, null, UUID.randomUUID(), Instant.now(), null, null, null, null, null);

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
                null, "Home Occasionals", null, "Away Occasionals", null, null, null, seasonId, Instant.now(), null, null, null, null, null);

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
                null, "Home Occasionals", null, "Away Occasionals", null, null, leagueId, seasonId,
                Instant.now(), null, null, null, null, null);

        assertThatThrownBy(() -> matchService.create(authentication, clubId, request))
                .isInstanceOf(NotFoundException.class);
        verify(matchRepository, never()).save(any());
    }

    // --- 050: logo only alongside the matching side's own *TeamName ---

    @Test
    void createWithAHomeTeamLogoUrlSetAlongsideAHomeTeamIdThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        CreateMatchRequest request = new CreateMatchRequest(
                UUID.randomUUID(), null, null, "Away Occasionals", "/media/logo.png", null, null,
                UUID.randomUUID(), Instant.now(), null, null, null, null, null);

        assertThatThrownBy(() -> matchService.create(authentication, clubId, request))
                .isInstanceOf(ValidationException.class);
        verify(matchRepository, never()).save(any());
    }

    @Test
    void createWithAnAwayTeamLogoUrlSetAlongsideAnAwayTeamIdThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        CreateMatchRequest request = new CreateMatchRequest(
                null, "Home Occasionals", UUID.randomUUID(), null, null, "/media/logo.png", null,
                UUID.randomUUID(), Instant.now(), null, null, null, null, null);

        assertThatThrownBy(() -> matchService.create(authentication, clubId, request))
                .isInstanceOf(ValidationException.class);
        verify(matchRepository, never()).save(any());
    }

    @Test
    void createWithBothLogosSetAlongsideTheirMatchingFreeTextNamesSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        ArgumentCaptor<Match> captor = ArgumentCaptor.forClass(Match.class);
        when(matchRepository.save(captor.capture())).thenAnswer(invocation -> captor.getValue());
        when(matchMapper.toDto(any(Match.class))).thenReturn(dummyDto());

        CreateMatchRequest request = new CreateMatchRequest(
                null, "Home Occasionals", null, "Away Occasionals", "/media/home-logo.png",
                "/media/away-logo.png", null, seasonId, Instant.now(), null, null, null, null, null);

        matchService.create(authentication, clubId, request);

        Match saved = captor.getValue();
        assertThat(saved.getHomeTeamLogoUrl()).isEqualTo("/media/home-logo.png");
        assertThat(saved.getAwayTeamLogoUrl()).isEqualTo("/media/away-logo.png");
    }

    @Test
    void createWithBothLogosNullSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        ArgumentCaptor<Match> captor = ArgumentCaptor.forClass(Match.class);
        when(matchRepository.save(captor.capture())).thenAnswer(invocation -> captor.getValue());
        when(matchMapper.toDto(any(Match.class))).thenReturn(dummyDto());

        CreateMatchRequest request = new CreateMatchRequest(
                null, "Home Occasionals", null, "Away Occasionals", null, null, null, seasonId,
                Instant.now(), null, null, null, null, null);

        matchService.create(authentication, clubId, request);

        Match saved = captor.getValue();
        assertThat(saved.getHomeTeamLogoUrl()).isNull();
        assertThat(saved.getAwayTeamLogoUrl()).isNull();
    }

    @Test
    void updateWithAHomeTeamLogoUrlSetAlongsideAHomeTeamIdThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existingMatch(matchId, clubId, true)));
        UpdateMatchRequest request = new UpdateMatchRequest(
                UUID.randomUUID(), null, null, "Away Occasionals", "/media/logo.png", null, null,
                UUID.randomUUID(), Instant.now(), null, null, null, null, null);

        assertThatThrownBy(() -> matchService.update(authentication, clubId, matchId, request))
                .isInstanceOf(ValidationException.class);
        verify(matchRepository, never()).save(any());
    }

    @Test
    void updateWithAnAwayTeamLogoUrlSetAlongsideAnAwayTeamIdThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existingMatch(matchId, clubId, true)));
        UpdateMatchRequest request = new UpdateMatchRequest(
                null, "Home Occasionals", UUID.randomUUID(), null, null, "/media/logo.png", null,
                UUID.randomUUID(), Instant.now(), null, null, null, null, null);

        assertThatThrownBy(() -> matchService.update(authentication, clubId, matchId, request))
                .isInstanceOf(ValidationException.class);
        verify(matchRepository, never()).save(any());
    }

    @Test
    void updateWithBothLogosSetAlongsideTheirMatchingFreeTextNamesSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        Match existing = existingMatch(matchId, clubId, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existing));
        when(matchRepository.save(existing)).thenReturn(existing);
        when(matchMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateMatchRequest request = new UpdateMatchRequest(
                null, "Home Occasionals", null, "Away Occasionals", "/media/home-logo.png",
                "/media/away-logo.png", null, seasonId, Instant.now(), null, null, null, null, null);

        matchService.update(authentication, clubId, matchId, request);

        assertThat(existing.getHomeTeamLogoUrl()).isEqualTo("/media/home-logo.png");
        assertThat(existing.getAwayTeamLogoUrl()).isEqualTo("/media/away-logo.png");
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
                otherClubsTeamId, null, null, "Away Occasionals", null, null, null, seasonId, Instant.now(), null, null, null, null, null);

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
                missingTeamId, null, null, "Away Occasionals", null, null, null, seasonId, Instant.now(), null, null, null, null, null);

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
                otherClubsHomeTeamId, null, null, "Away Occasionals", null, null, null, seasonId, Instant.now(), null, null, null, null, null);

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
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existingMatch(matchId, clubId, true)));
        UpdateMatchRequest request = new UpdateMatchRequest(
                null, "Home Occasionals", null, "Away Occasionals", null, null, null, null, Instant.now(), null, null, null, null, null);

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

        MatchDto dtoA = new MatchDto(matchAId, clubId, teamAHome, "Home A", teamAAway, "Away A", null, null, null,
                matchA.getSeasonId(), matchA.getMatchDate(), null, true, false, false, null, null, null, null, null, null, null, null, null, null, null);
        MatchDto dtoB = new MatchDto(matchBId, clubId, teamBHome, "Home B", null, "Occasionals", null, null, null,
                matchB.getSeasonId(), matchB.getMatchDate(), null, true, false, false, null, null, null, null, null, null, null, null, null, null, null);
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

    // --- 069: match card enrichment (picked counts, playing XI size, polls) ---

    private static final org.springframework.data.domain.Pageable PAGE10 =
            org.springframework.data.domain.PageRequest.of(0, 10);

    private final UUID cardClubId = UUID.randomUUID();

    private Match cardMatch(UUID homeTeamId, String homeName, UUID awayTeamId, String awayName, UUID leagueId) {
        return Match.builder().id(UUID.randomUUID()).clubId(cardClubId).homeTeamId(homeTeamId)
                .homeTeamName(homeName).awayTeamId(awayTeamId).awayTeamName(awayName).leagueId(leagueId)
                .seasonId(UUID.randomUUID()).matchDate(Instant.now()).active(true).build();
    }

    private MatchDto cardDto(Match m) {
        return new MatchDto(m.getId(), m.getClubId(), m.getHomeTeamId(), m.getHomeTeamName(), m.getAwayTeamId(),
                m.getAwayTeamName(), null, null, m.getLeagueId(), m.getSeasonId(), m.getMatchDate(), null, true,
                false, false, null, null, null, null, null, null, null, null, null, null, null);
    }

    private List<MatchDto> listCard(Match... matches) {
        when(accessService.accessibleSectionIds(authentication, cardClubId)).thenReturn(Optional.empty());
        when(matchRepository.findAll(any(Specification.class), eq(defaultSortedPageable())))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(matches)));
        for (Match m : matches) {
            when(matchMapper.toDto(m)).thenReturn(cardDto(m));
        }
        return matchService.list(authentication, cardClubId, null, false, null, null, null, PAGE10).getContent();
    }

    private Team clubTeam(UUID id) {
        return Team.builder().id(id).clubId(cardClubId).sectionId(UUID.randomUUID()).name("T").active(true).build();
    }

    private MatchSide side(Match m, UUID teamId) {
        return MatchSide.builder().id(UUID.randomUUID()).matchId(m.getId()).teamId(teamId).build();
    }

    private List<MatchSidePlayer> xi(MatchSide side, int n) {
        return java.util.stream.IntStream.range(0, n)
                .mapToObj(i -> MatchSidePlayer.builder().id(UUID.randomUUID()).matchSideId(side.getId())
                        .playerProfileId(UUID.randomUUID()).battingOrder(i + 1).build())
                .toList();
    }

    private MatchDto byId(List<MatchDto> list, Match m) {
        return list.stream().filter(d -> d.id().equals(m.getId())).findFirst().orElseThrow();
    }

    @Test
    void listCallsEachBatchSourceOnceForTheWholePageRegardlessOfPageSize() {
        UUID leagueId = UUID.randomUUID();
        UUID t1 = UUID.randomUUID();
        UUID t2 = UUID.randomUUID();
        UUID t3 = UUID.randomUUID();
        Match a = cardMatch(t1, null, null, "Opp A", leagueId);
        Match b = cardMatch(t2, null, null, "Opp B", leagueId);
        Match c = cardMatch(t3, null, null, "Opp C", leagueId);
        MatchSide sa = side(a, t1);
        when(matchSideRepository.findByMatchIdIn(any())).thenReturn(List.of(sa));
        when(teamRepository.findAllById(any())).thenReturn(List.of(clubTeam(t1), clubTeam(t2), clubTeam(t3)));
        when(matchSidePlayerRepository.findByMatchSideIdIn(any())).thenReturn(xi(sa, 3));
        when(leagueRepository.findAllById(any())).thenReturn(List.of(league(leagueId, cardClubId)));
        when(matchPollCoverageService.pollsForMatches(any())).thenReturn(Map.of());

        listCard(a, b, c);

        verify(matchSideRepository, times(1)).findByMatchIdIn(any());
        verify(matchSidePlayerRepository, times(1)).findByMatchSideIdIn(any());
        verify(teamRepository, times(1)).findAllById(any());
        verify(leagueRepository, times(1)).findAllById(any());
        verify(matchPollCoverageService, times(1)).pollsForMatches(any());
        verify(teamRepository, never()).findById(any());
        verify(leagueRepository, never()).findById(any());
    }

    @Test
    void listCallsNoBatchSourceForAnEmptyPage() {
        when(accessService.accessibleSectionIds(authentication, cardClubId)).thenReturn(Optional.empty());
        when(matchRepository.findAll(any(Specification.class), eq(defaultSortedPageable())))
                .thenReturn(org.springframework.data.domain.Page.empty());

        matchService.list(authentication, cardClubId, null, false, null, null, null, PAGE10);

        org.mockito.Mockito.verifyNoInteractions(
                matchSideRepository, matchSidePlayerRepository, matchPollCoverageService);
        verify(teamRepository, never()).findAllById(any());
        verify(leagueRepository, never()).findAllById(any());
    }

    @Test
    void listCountsPickedPlayersPerClubSideForNoneSomeAndFullXi() {
        UUID leagueId = UUID.randomUUID();
        UUID home = UUID.randomUUID();
        UUID away = UUID.randomUUID();
        UUID solo = UUID.randomUUID();
        Match derby = cardMatch(home, null, away, null, leagueId);
        Match full = cardMatch(solo, null, null, "Opp", leagueId);
        MatchSide homeSide = side(derby, home);
        MatchSide soloSide = side(full, solo);
        when(matchSideRepository.findByMatchIdIn(any())).thenReturn(List.of(homeSide, soloSide));
        when(teamRepository.findAllById(any())).thenReturn(List.of(clubTeam(home), clubTeam(away), clubTeam(solo)));
        java.util.ArrayList<MatchSidePlayer> players = new java.util.ArrayList<>(xi(homeSide, 7));
        players.addAll(xi(soloSide, 11));
        when(matchSidePlayerRepository.findByMatchSideIdIn(any())).thenReturn(players);
        when(leagueRepository.findAllById(any())).thenReturn(List.of(league(leagueId, cardClubId)));
        when(matchPollCoverageService.pollsForMatches(any())).thenReturn(Map.of());

        List<MatchDto> result = listCard(derby, full);

        assertThat(byId(result, derby).homePickedCount()).isEqualTo(7);
        assertThat(byId(result, derby).awayPickedCount()).isZero();
        assertThat(byId(result, full).homePickedCount()).isEqualTo(11);
        assertThat(byId(result, full).awayPickedCount()).isNull();
    }

    @Test
    void listGivesNullCountForFreeTextAndOtherClubSides() {
        UUID mine = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        Match m = cardMatch(mine, null, other, null, null);
        Team otherClubTeam =
                Team.builder().id(other).clubId(UUID.randomUUID()).sectionId(UUID.randomUUID()).name("X").build();
        MatchSide otherSide = side(m, other);
        when(matchSideRepository.findByMatchIdIn(any())).thenReturn(List.of(otherSide));
        when(teamRepository.findAllById(any())).thenReturn(List.of(clubTeam(mine), otherClubTeam));
        when(matchSidePlayerRepository.findByMatchSideIdIn(any())).thenReturn(xi(otherSide, 5));
        when(matchPollCoverageService.pollsForMatches(any())).thenReturn(Map.of());
        Match freeText = cardMatch(null, "Home FC", null, "Away FC", null);

        List<MatchDto> result = listCard(m, freeText);

        assertThat(byId(result, m).homePickedCount()).isZero();
        assertThat(byId(result, m).awayPickedCount()).isNull();
        assertThat(byId(result, freeText).homePickedCount()).isNull();
        assertThat(byId(result, freeText).awayPickedCount()).isNull();
        assertThat(byId(result, freeText).polls()).isEmpty();
    }

    @Test
    void listSetsPlayingXiSizeFromTheLeagueAndNullWithoutOne() {
        UUID leagueId = UUID.randomUUID();
        UUID t = UUID.randomUUID();
        Match withLeague = cardMatch(t, null, null, "Opp", leagueId);
        Match noLeague = cardMatch(t, null, null, "Opp", null);
        League l = League.builder().id(leagueId).clubId(cardClubId).name("L").source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(9).active(true).build();
        when(matchSideRepository.findByMatchIdIn(any())).thenReturn(List.of());
        when(teamRepository.findAllById(any())).thenReturn(List.of(clubTeam(t)));
        when(leagueRepository.findAllById(any())).thenReturn(List.of(l));
        when(matchPollCoverageService.pollsForMatches(any())).thenReturn(Map.of());

        List<MatchDto> result = listCard(withLeague, noLeague);

        assertThat(byId(result, withLeague).playingXiSize()).isEqualTo(9);
        assertThat(byId(result, noLeague).playingXiSize()).isNull();
        verify(matchSidePlayerRepository, never()).findByMatchSideIdIn(any());
    }

    @Test
    void listMapsSquadGroupDerbyAndUnpolledMatchesToPolls() {
        UUID squadTeam = UUID.randomUUID();
        UUID derbyHome = UUID.randomUUID();
        UUID derbyAway = UUID.randomUUID();
        UUID groupTeam = UUID.randomUUID();
        UUID bareTeam = UUID.randomUUID();
        Match squad = cardMatch(squadTeam, null, null, "Opp", null);
        Match derby = cardMatch(derbyHome, null, derbyAway, null, null);
        Match group = cardMatch(groupTeam, null, null, "Opp", null);
        Match bare = cardMatch(bareTeam, null, null, "Opp", null);
        UUID squadPollId = UUID.randomUUID();
        UUID homePollId = UUID.randomUUID();
        UUID awayPollId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        when(matchSideRepository.findByMatchIdIn(any())).thenReturn(List.of());
        when(teamRepository.findAllById(any())).thenReturn(List.of(
                clubTeam(squadTeam), clubTeam(derbyHome), clubTeam(derbyAway), clubTeam(groupTeam),
                clubTeam(bareTeam)));
        when(matchPollCoverageService.pollsForMatches(any())).thenReturn(Map.of(
                squad.getId(), List.of(new MatchPollCoverageService.PollRef(
                        AvailabilityPollType.SQUAD, squadTeam, squadPollId, null, true)),
                derby.getId(), List.of(
                        new MatchPollCoverageService.PollRef(
                                AvailabilityPollType.SQUAD, derbyHome, homePollId, null, true),
                        new MatchPollCoverageService.PollRef(
                                AvailabilityPollType.SQUAD, derbyAway, awayPollId, null, false)),
                group.getId(), List.of(new MatchPollCoverageService.PollRef(
                        AvailabilityPollType.GROUP, null, roundId, roundId, false)),
                bare.getId(), List.of()));

        List<MatchDto> result = listCard(squad, derby, group, bare);

        assertThat(byId(result, squad).polls())
                .containsExactly(new MatchPollDto(AvailabilityPollType.SQUAD, squadTeam, squadPollId, null, true));
        assertThat(byId(result, derby).polls()).containsExactly(
                new MatchPollDto(AvailabilityPollType.SQUAD, derbyHome, homePollId, null, true),
                new MatchPollDto(AvailabilityPollType.SQUAD, derbyAway, awayPollId, null, false));
        assertThat(byId(result, group).polls())
                .containsExactly(new MatchPollDto(AvailabilityPollType.GROUP, null, roundId, roundId, false));
        assertThat(byId(result, bare).polls()).isEmpty();
    }

    @Test
    void listDropsSquadPollsOfTeamsThatAreNotClubSidesOfTheMatch() {
        UUID mine = UUID.randomUUID();
        UUID stranger = UUID.randomUUID();
        Match m = cardMatch(mine, null, null, "Opp", null);
        when(matchSideRepository.findByMatchIdIn(any())).thenReturn(List.of());
        when(teamRepository.findAllById(any())).thenReturn(List.of(clubTeam(mine)));
        when(matchPollCoverageService.pollsForMatches(any())).thenReturn(Map.of(m.getId(), List.of(
                new MatchPollCoverageService.PollRef(AvailabilityPollType.SQUAD, stranger, UUID.randomUUID(), null, true))));

        assertThat(listCard(m).get(0).polls()).isEmpty();
    }

    @Test
    void listKeepsAnnouncedFlagsTrueOnlyForARealTeamSideWithAnAnnouncedMatchSide() {
        UUID home = UUID.randomUUID();
        UUID away = UUID.randomUUID();
        Match m = cardMatch(home, null, away, null, null);
        MatchSide announced = side(m, home);
        announced.setAnnounced(true);
        MatchSide notAnnounced = side(m, away);
        when(matchSideRepository.findByMatchIdIn(any())).thenReturn(List.of(announced, notAnnounced));
        when(teamRepository.findAllById(any())).thenReturn(List.of(clubTeam(home), clubTeam(away)));
        when(matchPollCoverageService.pollsForMatches(any())).thenReturn(Map.of());
        Match freeText = cardMatch(null, "Home FC", null, "Away FC", null);

        List<MatchDto> result = listCard(m, freeText);

        assertThat(byId(result, m).homeSideAnnounced()).isTrue();
        assertThat(byId(result, m).awaySideAnnounced()).isFalse();
        assertThat(byId(result, freeText).homeSideAnnounced()).isFalse();
        assertThat(byId(result, freeText).awaySideAnnounced()).isFalse();
    }

    @Test
    void nonListPathsReturnNullCountsAndAnEmptyPollsList() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        Match active = existingMatch(matchId, clubId, true);
        Match inactive = existingMatch(matchId, clubId, false);
        MatchDto plain = dummyDto();
        when(matchMapper.toDto(any(Match.class))).thenReturn(plain);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(active));
        when(matchRepository.save(any(Match.class))).thenAnswer(i -> i.getArgument(0));

        assertNoCardValues(matchService.get(authentication, clubId, matchId));
        assertNoCardValues(matchService.deactivate(authentication, clubId, matchId));
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(inactive));
        assertNoCardValues(matchService.reactivate(authentication, clubId, matchId));

        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId, sectionId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(matchRepository.findPreviousForTeamSeasonLeague(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(active));
        List<MatchDto> previous =
                matchService.listPrevious(authentication, clubId, teamId, seasonId, null, null);
        previous.forEach(this::assertNoCardValues);
        assertThat(previous).hasSize(1);

        UUID leagueId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(accessService.resolveMatchSectionIds(any(), any(), any())).thenReturn(Set.of(sectionId));
        assertNoCardValues(matchService.create(authentication, clubId, new CreateMatchRequest(
                null, "Home FC", null, "Away FC", null, null, leagueId, seasonId, Instant.now(), null, null, null, null, null)));
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(active));
        assertNoCardValues(matchService.update(authentication, clubId, matchId, new UpdateMatchRequest(
                null, "Home FC", null, "Away FC", null, null, leagueId, seasonId, Instant.now(), null, null, null, null, null)));

        verify(matchPollCoverageService, never()).pollsForMatches(any());
        verify(matchSidePlayerRepository, never()).findByMatchSideIdIn(any());
    }

    private void assertNoCardValues(MatchDto dto) {
        assertThat(dto.homePickedCount()).isNull();
        assertThat(dto.awayPickedCount()).isNull();
        assertThat(dto.playingXiSize()).isNull();
        assertThat(dto.polls()).isNotNull().isEmpty();
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

    // --- 070: league-team sides ---

    private LeagueTeam leagueTeam(UUID id, UUID leagueId, UUID seasonId, boolean active) {
        return LeagueTeam.builder().id(id).leagueId(leagueId).seasonId(seasonId).name("Riverside CC")
                .logoUrl("/media/riverside.png").active(active).build();
    }

    private CreateMatchRequest createWithLeagueTeams(
            UUID homeTeamId, String homeName, String homeLogo, UUID homeLeagueTeamId, String awayName,
            UUID leagueId, UUID seasonId, UUID awayLeagueTeamId) {
        return new CreateMatchRequest(
                homeTeamId, homeName, null, awayName, homeLogo, null, leagueId, seasonId, Instant.now(), null,
                homeLeagueTeamId, awayLeagueTeamId, null, null);
    }

    @Test
    void createWithAnActiveLeagueTeamAwaySideStoresTheReferenceAndOverwritesNameAndLogoFromTheLeagueTeam() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueTeamId = UUID.randomUUID();
        UUID ownTeamId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(teamRepository.existsById(ownTeamId)).thenReturn(true);
        when(leagueTeamRepository.findById(leagueTeamId))
                .thenReturn(Optional.of(leagueTeam(leagueTeamId, leagueId, seasonId, true)));
        ArgumentCaptor<Match> captor = ArgumentCaptor.forClass(Match.class);
        when(matchRepository.save(captor.capture())).thenAnswer(invocation -> captor.getValue());
        when(matchMapper.toDto(any(Match.class))).thenReturn(dummyDto());

        // client-sent away name and logo for a league-team side are ignored
        CreateMatchRequest request = new CreateMatchRequest(
                ownTeamId, null, null, "Typed Name", null, "/media/typed.png", leagueId, seasonId, Instant.now(),
                null, null, leagueTeamId, null, null);
        matchService.create(authentication, clubId, request);

        Match saved = captor.getValue();
        assertThat(saved.getAwayLeagueTeamId()).isEqualTo(leagueTeamId);
        assertThat(saved.getAwayTeamId()).isNull();
        assertThat(saved.getAwayTeamName()).isEqualTo("Riverside CC");
        assertThat(saved.getAwayTeamLogoUrl()).isEqualTo("/media/riverside.png");
        assertThat(saved.getHomeLeagueTeamId()).isNull();
        assertThat(saved.getHomeTeamId()).isEqualTo(ownTeamId);
    }

    @Test
    void createWithALeagueTeamSideWithNoClientNameAndNoLogoSucceedsAndStoresANullLogoWhenTheLeagueTeamHasNone() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueTeamId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        LeagueTeam noLogo = leagueTeam(leagueTeamId, leagueId, seasonId, true);
        noLogo.setLogoUrl(null);
        when(leagueTeamRepository.findById(leagueTeamId)).thenReturn(Optional.of(noLogo));
        ArgumentCaptor<Match> captor = ArgumentCaptor.forClass(Match.class);
        when(matchRepository.save(captor.capture())).thenAnswer(invocation -> captor.getValue());
        when(matchMapper.toDto(any(Match.class))).thenReturn(dummyDto());

        matchService.create(authentication, clubId, createWithLeagueTeams(
                null, "Home Occasionals", null, null, null, leagueId, seasonId, leagueTeamId));

        assertThat(captor.getValue().getAwayTeamName()).isEqualTo("Riverside CC");
        assertThat(captor.getValue().getAwayTeamLogoUrl()).isNull();
    }

    @Test
    void createWithALeagueTeamIdAlongsideATeamIdOnTheSameSideThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        CreateMatchRequest request = new CreateMatchRequest(
                null, "Home", UUID.randomUUID(), null, null, null, UUID.randomUUID(), UUID.randomUUID(),
                Instant.now(), null, null, UUID.randomUUID(), null, null);

        assertThatThrownBy(() -> matchService.create(authentication, clubId, request))
                .isInstanceOf(ValidationException.class);
        verify(matchRepository, never()).save(any());
    }

    @Test
    void createWithALeagueTeamButNoLeagueOnTheMatchThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueTeamId = UUID.randomUUID();
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(leagueRepository.findById(any())).thenReturn(Optional.of(league(UUID.randomUUID(), clubId)));
        when(leagueTeamRepository.findById(leagueTeamId))
                .thenReturn(Optional.of(leagueTeam(leagueTeamId, UUID.randomUUID(), seasonId, true)));

        assertThatThrownBy(() -> matchService.create(authentication, clubId, createWithLeagueTeams(
                        null, "Home", null, null, null, null, seasonId, leagueTeamId)))
                .isInstanceOf(ValidationException.class);
        verify(matchRepository, never()).save(any());
    }

    @Test
    void createWithALeagueTeamFromAnotherLeagueThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID otherLeagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueTeamId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(leagueRepository.findById(otherLeagueId)).thenReturn(Optional.of(league(otherLeagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(leagueTeamRepository.findById(leagueTeamId))
                .thenReturn(Optional.of(leagueTeam(leagueTeamId, otherLeagueId, seasonId, true)));

        assertThatThrownBy(() -> matchService.create(authentication, clubId, createWithLeagueTeams(
                        null, "Home", null, null, null, leagueId, seasonId, leagueTeamId)))
                .isInstanceOf(ValidationException.class);
        verify(matchRepository, never()).save(any());
    }

    @Test
    void createWithALeagueTeamFromAnotherSeasonThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueTeamId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(leagueTeamRepository.findById(leagueTeamId))
                .thenReturn(Optional.of(leagueTeam(leagueTeamId, leagueId, UUID.randomUUID(), true)));

        assertThatThrownBy(() -> matchService.create(authentication, clubId, createWithLeagueTeams(
                        null, "Home", null, null, null, leagueId, seasonId, leagueTeamId)))
                .isInstanceOf(ValidationException.class);
        verify(matchRepository, never()).save(any());
    }

    @Test
    void createWithALeagueTeamOfAnotherClubsLeagueThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID otherClubsLeagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueTeamId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(leagueRepository.findById(otherClubsLeagueId))
                .thenReturn(Optional.of(league(otherClubsLeagueId, otherClubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(leagueTeamRepository.findById(leagueTeamId))
                .thenReturn(Optional.of(leagueTeam(leagueTeamId, otherClubsLeagueId, seasonId, true)));

        assertThatThrownBy(() -> matchService.create(authentication, clubId, createWithLeagueTeams(
                        null, "Home", null, null, null, leagueId, seasonId, leagueTeamId)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void createWithAnUnknownLeagueTeamThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueTeamId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(leagueTeamRepository.findById(leagueTeamId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> matchService.create(authentication, clubId, createWithLeagueTeams(
                        null, "Home", null, null, null, leagueId, seasonId, leagueTeamId)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void createWithTheSameLeagueTeamOnBothSidesThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueTeamId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));

        assertThatThrownBy(() -> matchService.create(authentication, clubId, createWithLeagueTeams(
                        null, null, null, leagueTeamId, null, leagueId, seasonId, leagueTeamId)))
                .isInstanceOf(ValidationException.class);
        verify(matchRepository, never()).save(any());
    }

    @Test
    void createWithAnInactiveLeagueTeamThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueTeamId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(leagueTeamRepository.findById(leagueTeamId))
                .thenReturn(Optional.of(leagueTeam(leagueTeamId, leagueId, seasonId, false)));

        assertThatThrownBy(() -> matchService.create(authentication, clubId, createWithLeagueTeams(
                        null, "Home", null, null, null, leagueId, seasonId, leagueTeamId)))
                .isInstanceOf(ValidationException.class);
        verify(matchRepository, never()).save(any());
    }

    @Test
    void createWithALogoAlongsideATeamIdStillThrowsWhenTheSideHasNoLeagueTeam() {
        UUID clubId = UUID.randomUUID();
        // the 050 free-text logo rule is untouched for a side without a league team
        CreateMatchRequest logoWithTeamId = new CreateMatchRequest(
                UUID.randomUUID(), null, UUID.randomUUID(), null, null, "/media/x.png", null, UUID.randomUUID(),
                Instant.now(), null, null, null, null, null);

        assertThatThrownBy(() -> matchService.create(authentication, clubId, logoWithTeamId))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void updateAnUnchangedInactiveLeagueTeamReferenceIsKeptAndSavedWithTheLeagueTeamsName() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueTeamId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(leagueTeamRepository.findById(leagueTeamId))
                .thenReturn(Optional.of(leagueTeam(leagueTeamId, leagueId, seasonId, false)));
        Match existing = Match.builder().id(matchId).clubId(clubId).homeTeamName("Home Occasionals")
                .awayTeamName("Riverside CC").awayLeagueTeamId(leagueTeamId).leagueId(leagueId).seasonId(seasonId)
                .matchDate(Instant.now()).active(true).build();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existing));
        when(matchRepository.save(existing)).thenReturn(existing);
        when(matchMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateMatchRequest request = new UpdateMatchRequest(
                null, "Home Occasionals", null, null, null, null, leagueId, seasonId, Instant.now(), "New venue",
                null, leagueTeamId, null, null);
        matchService.update(authentication, clubId, matchId, request);

        assertThat(existing.getAwayLeagueTeamId()).isEqualTo(leagueTeamId);
        assertThat(existing.getAwayTeamName()).isEqualTo("Riverside CC");
        assertThat(existing.getVenue()).isEqualTo("New venue");
    }

    @Test
    void updateSwitchingASideToADifferentInactiveLeagueTeamThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID storedLeagueTeamId = UUID.randomUUID();
        UUID newInactiveId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(leagueTeamRepository.findById(newInactiveId))
                .thenReturn(Optional.of(leagueTeam(newInactiveId, leagueId, seasonId, false)));
        Match existing = Match.builder().id(matchId).clubId(clubId).homeTeamName("Home")
                .awayTeamName("Riverside CC").awayLeagueTeamId(storedLeagueTeamId).leagueId(leagueId)
                .seasonId(seasonId).matchDate(Instant.now()).active(true).build();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existing));

        UpdateMatchRequest request = new UpdateMatchRequest(
                null, "Home", null, null, null, null, leagueId, seasonId, Instant.now(), null, null, newInactiveId, null, null);

        assertThatThrownBy(() -> matchService.update(authentication, clubId, matchId, request))
                .isInstanceOf(ValidationException.class);
        verify(matchRepository, never()).save(any());
    }

    @Test
    void updateAnInactiveStoredLeagueTeamOnTheOtherSideIsNotAllowedToBeMovedToThisSide() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueTeamId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(leagueTeamRepository.findById(leagueTeamId))
                .thenReturn(Optional.of(leagueTeam(leagueTeamId, leagueId, seasonId, false)));
        Match existing = Match.builder().id(matchId).clubId(clubId).homeLeagueTeamId(leagueTeamId)
                .homeTeamName("Riverside CC").awayTeamName("Away").leagueId(leagueId).seasonId(seasonId)
                .matchDate(Instant.now()).active(true).build();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existing));

        // the stored reference is on the HOME side; selecting it for AWAY is a new selection
        UpdateMatchRequest request = new UpdateMatchRequest(
                null, "Home", null, null, null, null, leagueId, seasonId, Instant.now(), null, null, leagueTeamId, null, null);

        assertThatThrownBy(() -> matchService.update(authentication, clubId, matchId, request))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void updateChangingTheMatchsLeagueWhileHoldingALeagueTeamSideThatNoLongerMatchesThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID newLeagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueTeamId = UUID.randomUUID();
        when(leagueRepository.findById(newLeagueId)).thenReturn(Optional.of(league(newLeagueId, clubId)));
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(leagueTeamRepository.findById(leagueTeamId))
                .thenReturn(Optional.of(leagueTeam(leagueTeamId, leagueId, seasonId, true)));
        Match existing = Match.builder().id(matchId).clubId(clubId).homeTeamName("Home")
                .awayTeamName("Riverside CC").awayLeagueTeamId(leagueTeamId).leagueId(leagueId).seasonId(seasonId)
                .matchDate(Instant.now()).active(true).build();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existing));

        UpdateMatchRequest request = new UpdateMatchRequest(
                null, "Home", null, null, null, null, newLeagueId, seasonId, Instant.now(), null, null, leagueTeamId, null, null);

        assertThatThrownBy(() -> matchService.update(authentication, clubId, matchId, request))
                .isInstanceOf(ValidationException.class);
        verify(matchRepository, never()).save(any());
    }

    @Test
    void updateSwitchingALeagueTeamSideToFreeTextClearsTheReference() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueTeamId = UUID.randomUUID();
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        Match existing = Match.builder().id(matchId).clubId(clubId).homeTeamName("Home")
                .awayTeamName("Riverside CC").awayTeamLogoUrl("/media/riverside.png").awayLeagueTeamId(leagueTeamId)
                .seasonId(seasonId).matchDate(Instant.now()).active(true).build();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existing));
        when(matchRepository.save(existing)).thenReturn(existing);
        when(matchMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateMatchRequest request = new UpdateMatchRequest(
                null, "Home", null, "Typed Opponent", null, null, null, seasonId, Instant.now(), null, null, null, null, null);
        matchService.update(authentication, clubId, matchId, request);

        assertThat(existing.getAwayLeagueTeamId()).isNull();
        assertThat(existing.getAwayTeamName()).isEqualTo("Typed Opponent");
        assertThat(existing.getAwayTeamLogoUrl()).isNull();
    }

    // --- 070 regression: a league-team side has no teamId, so it behaves as an external opponent ---

    @Test
    void filterOptionsTeamAndSectionIdsIgnoreLeagueTeamSides() {
        UUID clubId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        Match leagueTeamMatch = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamName("Riverside CC")
                .homeLeagueTeamId(UUID.randomUUID()).awayTeamName("Hillside CC")
                .awayLeagueTeamId(UUID.randomUUID()).leagueId(UUID.randomUUID()).seasonId(UUID.randomUUID())
                .matchDate(Instant.now()).active(true).build();
        when(matchRepository.findAll(any(Specification.class))).thenReturn(List.of(leagueTeamMatch));

        MatchFilterOptionsDto result =
                matchService.filterOptions(authentication, clubId, null, null, null, null, false);

        assertThat(result.teamIds()).isEmpty();
        assertThat(result.sectionIds()).isEmpty();
        verify(teamRepository, never()).findAllById(any());
    }

    @Test
    void listForAMatchWithTwoLeagueTeamSidesCarriesTheIdsAndLooksUpNoTeamsSidesOrPolls() {
        UUID clubId = UUID.randomUUID();
        UUID homeLtId = UUID.randomUUID();
        UUID awayLtId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        Match match = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamName("Riverside CC")
                .homeLeagueTeamId(homeLtId).awayTeamName("Hillside CC").awayLeagueTeamId(awayLtId)
                .seasonId(UUID.randomUUID()).matchDate(Instant.now()).active(true).build();
        when(matchRepository.findAll(any(Specification.class), eq(defaultSortedPageable())))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(match)));
        when(matchMapper.toDto(match)).thenReturn(new MatchDto(
                match.getId(), clubId, null, "Riverside CC", null, "Hillside CC", null, null, null,
                match.getSeasonId(), match.getMatchDate(), null, true, false, false, null, null, null, null, null,
                null, null, homeLtId, awayLtId, null, null));
        when(matchSideRepository.findByMatchIdIn(List.of(match.getId()))).thenReturn(List.of());

        MatchDto result = matchService
                .list(authentication, clubId, null, false, null, null, null, PAGE10)
                .getContent()
                .get(0);

        assertThat(result.homeLeagueTeamId()).isEqualTo(homeLtId);
        assertThat(result.awayLeagueTeamId()).isEqualTo(awayLtId);
        assertThat(result.homeSideAnnounced()).isFalse();
        assertThat(result.awaySideAnnounced()).isFalse();
        assertThat(result.homePickedCount()).isNull();
        assertThat(result.awayPickedCount()).isNull();
        assertThat(result.polls()).isEmpty();
        verify(teamRepository, never()).findAllById(any());
        verify(matchPollCoverageService, never()).pollsForMatches(any());
    }

    // --- 075: optional scoring and streaming links ---

    private CreateMatchRequest createWithLinks(String scoringUrl, String streamingUrl) {
        return new CreateMatchRequest(
                null, "Home", null, "Away", null, null, null, UUID.randomUUID(), Instant.now(), null,
                null, null, scoringUrl, streamingUrl);
    }

    private UpdateMatchRequest updateWithLinks(UUID seasonId, String scoringUrl, String streamingUrl) {
        return new UpdateMatchRequest(
                null, "Home", null, "Away", null, null, null, seasonId, Instant.now(), null,
                null, null, scoringUrl, streamingUrl);
    }

    private void stubCreateSave() {
        ArgumentCaptor<Match> captor = ArgumentCaptor.forClass(Match.class);
        when(matchRepository.save(captor.capture())).thenAnswer(invocation -> captor.getValue());
        when(matchMapper.toDto(any(Match.class))).thenReturn(dummyDto());
    }

    private Match createdMatchWithLinks(String scoringUrl, String streamingUrl) {
        CreateMatchRequest request = createWithLinks(scoringUrl, streamingUrl);
        when(seasonRepository.findById(request.seasonId()))
                .thenReturn(Optional.of(season(request.seasonId(), clubIdForLinks)));
        stubCreateSave();
        matchService.create(authentication, clubIdForLinks, request);
        ArgumentCaptor<Match> captor = ArgumentCaptor.forClass(Match.class);
        verify(matchRepository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void createStoresValidHttpAndHttpsLinksTrimmed() {
        Match saved = createdMatchWithLinks(
                "  https://cricclubs.com/matches/34343  ", "\thttp://pitchvision.example/live\n");

        assertThat(saved.getScoringUrl()).isEqualTo("https://cricclubs.com/matches/34343");
        assertThat(saved.getStreamingUrl()).isEqualTo("http://pitchvision.example/live");
    }

    @Test
    void createAcceptsAnUpperCaseSchemeAndExactly1024Characters() {
        String exact = "https://example.com/" + "a".repeat(1004);
        Match saved = createdMatchWithLinks("HTTPS://Example.com/x", exact);

        assertThat(saved.getScoringUrl()).isEqualTo("HTTPS://Example.com/x");
        assertThat(saved.getStreamingUrl()).hasSize(1024);
    }

    @Test
    void createStoresNullEmptyAndWhitespaceOnlyLinksAsNull() {
        Match saved = createdMatchWithLinks("   ", "");
        assertThat(saved.getScoringUrl()).isNull();
        assertThat(saved.getStreamingUrl()).isNull();
    }

    @Test
    void createStoresOmittedLinksAsNull() {
        Match saved = createdMatchWithLinks(null, null);
        assertThat(saved.getScoringUrl()).isNull();
        assertThat(saved.getStreamingUrl()).isNull();
    }

    private static List<String> invalidLinks() {
        return List.of(
                "cricclubs.com/matches/34343", "javascript:alert(1)", "ftp://example.com/file",
                "https://example.com/has space", "https://", "http:///path-only", "mailto:a@b.c");
    }

    @Test
    void createRejectsEachInvalidScoringUrlNamingTheField() {
        for (String bad : invalidLinks()) {
            assertThatThrownBy(() -> matchService.create(authentication, clubIdForLinks, createWithLinks(bad, null)))
                    .as(bad)
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("scoringUrl must be an http(s) URL");
        }
        verify(matchRepository, never()).save(any());
    }

    @Test
    void createRejectsEachInvalidStreamingUrlNamingTheFieldIndependentlyOfScoring() {
        for (String bad : invalidLinks()) {
            assertThatThrownBy(() -> matchService.create(
                            authentication, clubIdForLinks, createWithLinks("https://ok.example/x", bad)))
                    .as(bad)
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("streamingUrl must be an http(s) URL");
        }
        verify(matchRepository, never()).save(any());
    }

    @Test
    void createRejectsALinkOf1025CharactersWithTheLengthMessage() {
        String tooLong = "https://example.com/" + "a".repeat(1005);
        assertThat(tooLong).hasSize(1025);

        assertThatThrownBy(() -> matchService.create(authentication, clubIdForLinks, createWithLinks(tooLong, null)))
                .isInstanceOf(ValidationException.class)
                .hasMessage("scoringUrl must be at most 1024 characters");
        assertThatThrownBy(() -> matchService.create(authentication, clubIdForLinks, createWithLinks(null, tooLong)))
                .isInstanceOf(ValidationException.class)
                .hasMessage("streamingUrl must be at most 1024 characters");
        verify(matchRepository, never()).save(any());
    }

    @Test
    void updateStoresTrimmedLinksAndReplacesExistingOnes() {
        UUID matchId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match existing = existingMatch(matchId, clubIdForLinks, true);
        existing.setScoringUrl("https://old.example/score");
        existing.setStreamingUrl("https://old.example/stream");
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existing));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubIdForLinks)));
        when(matchRepository.save(existing)).thenReturn(existing);
        when(matchMapper.toDto(existing)).thenReturn(dummyDto());

        matchService.update(authentication, clubIdForLinks, matchId,
                updateWithLinks(seasonId, " https://new.example/score ", "https://new.example/stream"));

        assertThat(existing.getScoringUrl()).isEqualTo("https://new.example/score");
        assertThat(existing.getStreamingUrl()).isEqualTo("https://new.example/stream");
    }

    @Test
    void updateWithNullOrBlankLinksClearsTheStoredLinks() {
        UUID matchId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match existing = existingMatch(matchId, clubIdForLinks, true);
        existing.setScoringUrl("https://old.example/score");
        existing.setStreamingUrl("https://old.example/stream");
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existing));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubIdForLinks)));
        when(matchRepository.save(existing)).thenReturn(existing);
        when(matchMapper.toDto(existing)).thenReturn(dummyDto());

        matchService.update(authentication, clubIdForLinks, matchId, updateWithLinks(seasonId, null, "  "));

        assertThat(existing.getScoringUrl()).isNull();
        assertThat(existing.getStreamingUrl()).isNull();
    }

    @Test
    void updateRejectsAnInvalidLinkNamingTheFieldAndLeavesTheMatchUnchanged() {
        UUID matchId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match existing = existingMatch(matchId, clubIdForLinks, true);
        existing.setScoringUrl("https://old.example/score");
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> matchService.update(
                        authentication, clubIdForLinks, matchId, updateWithLinks(seasonId, "javascript:alert(1)", null)))
                .isInstanceOf(ValidationException.class)
                .hasMessage("scoringUrl must be an http(s) URL");
        assertThatThrownBy(() -> matchService.update(
                        authentication, clubIdForLinks, matchId, updateWithLinks(seasonId, null, "no-scheme.example")))
                .isInstanceOf(ValidationException.class)
                .hasMessage("streamingUrl must be an http(s) URL");
        assertThat(existing.getScoringUrl()).isEqualTo("https://old.example/score");
        verify(matchRepository, never()).save(any());
    }

    @Test
    void updateRejectsALinkOf1025CharactersWithTheLengthMessage() {
        UUID matchId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match existing = existingMatch(matchId, clubIdForLinks, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(existing));
        String tooLong = "https://example.com/" + "a".repeat(1005);

        assertThatThrownBy(() -> matchService.update(
                        authentication, clubIdForLinks, matchId, updateWithLinks(seasonId, tooLong, null)))
                .isInstanceOf(ValidationException.class)
                .hasMessage("scoringUrl must be at most 1024 characters");
        assertThatThrownBy(() -> matchService.update(
                        authentication, clubIdForLinks, matchId, updateWithLinks(seasonId, null, tooLong)))
                .isInstanceOf(ValidationException.class)
                .hasMessage("streamingUrl must be at most 1024 characters");
        verify(matchRepository, never()).save(any());
    }

    @Test
    void listCopiesScoringAndStreamingUrlsOntoEachListDto() {
        UUID clubId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        Match match = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamName("Riverside CC")
                .awayTeamName("Hillside CC").seasonId(UUID.randomUUID()).matchDate(Instant.now()).active(true)
                .scoringUrl("https://cricclubs.com/matches/1").streamingUrl("https://pv.example/live").build();
        when(matchRepository.findAll(any(Specification.class), eq(defaultSortedPageable())))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(match)));
        when(matchMapper.toDto(match)).thenReturn(new MatchDto(
                match.getId(), clubId, null, "Riverside CC", null, "Hillside CC", null, null, null,
                match.getSeasonId(), match.getMatchDate(), null, true, false, false, null, null, null, null, null,
                null, null, null, null, "https://cricclubs.com/matches/1", "https://pv.example/live"));
        when(matchSideRepository.findByMatchIdIn(List.of(match.getId()))).thenReturn(List.of());

        MatchDto result = matchService
                .list(authentication, clubId, null, false, null, null, null, PAGE10)
                .getContent()
                .get(0);

        assertThat(result.scoringUrl()).isEqualTo("https://cricclubs.com/matches/1");
        assertThat(result.streamingUrl()).isEqualTo("https://pv.example/live");
    }
}
