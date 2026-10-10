package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueContact;
import com.cricketlegend.domain.Contact;
import com.cricketlegend.domain.LeagueFormat;
import com.cricketlegend.domain.LeaguePlayingConditions;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.LeagueTeam;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.SocialLink;
import com.cricketlegend.dto.CreateLeagueRequest;
import com.cricketlegend.dto.DuplicateLeagueRequest;
import com.cricketlegend.dto.DuplicateLeagueResponse;
import com.cricketlegend.dto.LeagueDto;
import com.cricketlegend.dto.LeagueSeasonTeamDto;
import com.cricketlegend.dto.SocialLinkDto;
import com.cricketlegend.dto.UpdateLeagueRequest;
import com.cricketlegend.exception.DuplicateLeagueNameException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LeagueMapper;
import com.cricketlegend.repository.LeagueAffiliationRepository;
import com.cricketlegend.repository.LeagueAffiliationRepository.LeagueTeamCount;
import com.cricketlegend.repository.LeagueContactRepository;
import com.cricketlegend.repository.LeaguePlayingConditionsRepository;
import com.cricketlegend.repository.LeagueAffiliationRepository.LeagueTeamSummary;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.LeagueTeamRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchRepository.LeagueMatchSummary;
import com.cricketlegend.repository.MatchRepository.LeagueWeekMatchCount;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.domain.LeagueListFocus;
import com.cricketlegend.dto.LeaguesSummaryDto;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.service.impl.LeagueServiceImpl;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for LeagueServiceImpl's business rules from docs/specs/029-league-management.md:
 * create/update default {@code source}/{@code maxPlayingXiSize} when left null, the {@code
 * minAge <= maxAge} validation, deactivate/reactivate's one-way transition
 * guard, and cross-club isolation. Per docs/standards/backend.md, every @Service method carrying
 * a business rule ships a unit test in the same change.
 *
 * <p>Per docs/specs/050-league-schedule-and-fixtures.md: {@code list()}'s three computed
 * "current season" fields ({@code currentSeasonTeamCount}/{@code currentSeasonLabel}/{@code
 * currentSeasonPlayingConditionsUrl}) and the current-season resolution rule itself (contains-
 * today vs. most-recently-created fallback, mirroring {@code ui/src/utils/defaultSeason.ts}'s
 * {@code pickDefaultSeasonId}).
 */
@ExtendWith(MockitoExtension.class)
class LeagueServiceImplTest {

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private SeasonRepository seasonRepository;

    @Mock
    private LeagueAffiliationRepository leagueAffiliationRepository;

    @Mock
    private LeaguePlayingConditionsRepository leaguePlayingConditionsRepository;

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private LeagueTeamRepository leagueTeamRepository;

    @Mock
    private TeamSquadMemberRepository teamSquadMemberRepository;

    @Mock
    private LeagueContactRepository leagueContactRepository;

    @Mock
    private LeagueMapper leagueMapper;

    private LeagueServiceImpl leagueService;

    @BeforeEach
    void setUp() {
        leagueService = new LeagueServiceImpl(
                leagueRepository, seasonRepository, leagueAffiliationRepository,
                leaguePlayingConditionsRepository, matchRepository, leagueTeamRepository, teamSquadMemberRepository,
                leagueContactRepository, leagueMapper);
    }

    private LeagueDto dummyDto() {
        return new LeagueDto(
                UUID.randomUUID(), UUID.randomUUID(), "Premier League", LeagueSource.INTERNAL, 11,
                null, null, null, null, null, null, null, null, List.of(), true, null, null, null, 0, null, null,
                null, null, null, null, null, null);
    }

    private League existingLeague(UUID id, UUID clubId, boolean active) {
        return League.builder().id(id).clubId(clubId).name("Premier League").source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(11).active(active).build();
    }

    private Season season(UUID id, UUID clubId, String label, LocalDate startDate, LocalDate endDate, Instant createdAt) {
        return Season.builder().id(id).clubId(clubId).label(label).startDate(startDate).endDate(endDate)
                .active(true).createdAt(createdAt).build();
    }

    /** A MapStruct-shaped base {@link LeagueDto} for {@code league}, the three computed fields left
     * at their zero-value defaults — the same shape {@code leagueMapper.toDto} itself returns before
     * {@code LeagueServiceImpl.withCurrentSeasonFields} reconstructs it. */
    private LeagueDto baseDtoFor(League league) {
        return new LeagueDto(
                league.getId(), league.getClubId(), league.getName(), league.getSource(),
                league.getMaxPlayingXiSize(), league.getMinAge(),
                league.getMaxAge(), league.getAgeCutoffDate(), league.getFormat(), league.getLogoUrl(),
                league.getPhone(), league.getWebsite(), league.getEmail(), List.of(),
                league.isActive(), league.getCreatedAt(),
                league.getUpdatedAt(), league.getUpdatedBy(), 0, null, null, null, null, null, null, null, null);
    }

    @Test
    void createDefaultsSourceAndMaxXiSizeWhenNull() {
        UUID clubId = UUID.randomUUID();
        CreateLeagueRequest request =
                new CreateLeagueRequest(
                        "Vets League", null, null, null, null, null, null, null, null, null, null, null);
        ArgumentCaptor<League> captor = ArgumentCaptor.forClass(League.class);
        when(leagueRepository.save(captor.capture())).thenAnswer(invocation -> captor.getValue());
        when(leagueMapper.toDto(any(League.class))).thenReturn(dummyDto());

        leagueService.create(clubId, request);

        League saved = captor.getValue();
        assertThat(saved.getClubId()).isEqualTo(clubId);
        assertThat(saved.getSource()).isEqualTo(LeagueSource.INTERNAL);
        assertThat(saved.getMaxPlayingXiSize()).isEqualTo(11);
        assertThat(saved.isActive()).isTrue();
        assertThat(saved.getFormat()).isNull();
        assertThat(saved.getLogoUrl()).isNull();
        assertThat(saved.getPhone()).isNull();
        assertThat(saved.getWebsite()).isNull();
        assertThat(saved.getEmail()).isNull();
        assertThat(saved.getSocialLinks()).isEmpty();
    }

    @Test
    void createWithACustomMaxPlayingXiSizeAndVetsFlagsIsPersisted() {
        UUID clubId = UUID.randomUUID();
        CreateLeagueRequest request =
                new CreateLeagueRequest(
                        "Vets League", LeagueSource.INTERNAL, 12, 35, null, null, null, null, null, null, null,
                        null);
        ArgumentCaptor<League> captor = ArgumentCaptor.forClass(League.class);
        when(leagueRepository.save(captor.capture())).thenAnswer(invocation -> captor.getValue());
        when(leagueMapper.toDto(any(League.class))).thenReturn(dummyDto());

        leagueService.create(clubId, request);

        League saved = captor.getValue();
        assertThat(saved.getMaxPlayingXiSize()).isEqualTo(12);
        assertThat(saved.getMinAge()).isEqualTo(35);
    }

    @Test
    void createWithMinAgeGreaterThanMaxAgeThrowsValidationExceptionAndNeverSaves() {
        UUID clubId = UUID.randomUUID();
        CreateLeagueRequest request =
                new CreateLeagueRequest(
                        "U15s", null, null, 20, 15, null, null, null, null, null, null, null);

        assertThatThrownBy(() -> leagueService.create(clubId, request))
                .isInstanceOf(ValidationException.class);

        org.mockito.Mockito.verify(leagueRepository, never()).save(any());
    }

    // --- 053: format/logoUrl/phone/website/email/socialLinks profile fields ---

    @Test
    void createPersistsTheFiveNewProfileFieldsIncludingSocialLinks() {
        UUID clubId = UUID.randomUUID();
        SocialLinkDto linkDto = new SocialLinkDto("facebook", "https://facebook.com/premier-league");
        SocialLink mappedLink =
                SocialLink.builder().platform("facebook").url("https://facebook.com/premier-league").build();
        when(leagueMapper.toEntity(linkDto)).thenReturn(mappedLink);
        CreateLeagueRequest request = new CreateLeagueRequest(
                "Premier League", null, null, null, null, null, LeagueFormat.T20, "/media/logo.png",
                "0123456789", "https://premierleague.example", "info@premierleague.example",
                List.of(linkDto));
        ArgumentCaptor<League> captor = ArgumentCaptor.forClass(League.class);
        when(leagueRepository.save(captor.capture())).thenAnswer(invocation -> captor.getValue());
        when(leagueMapper.toDto(any(League.class))).thenReturn(dummyDto());

        leagueService.create(clubId, request);

        League saved = captor.getValue();
        assertThat(saved.getFormat()).isEqualTo(LeagueFormat.T20);
        assertThat(saved.getLogoUrl()).isEqualTo("/media/logo.png");
        assertThat(saved.getPhone()).isEqualTo("0123456789");
        assertThat(saved.getWebsite()).isEqualTo("https://premierleague.example");
        assertThat(saved.getEmail()).isEqualTo("info@premierleague.example");
        assertThat(saved.getSocialLinks()).containsExactly(mappedLink);
    }

    @Test
    void updatePersistsTheFiveNewProfileFieldsIncludingSocialLinks() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        League existing = existingLeague(leagueId, clubId, true);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(existing));
        when(leagueRepository.save(existing)).thenReturn(existing);
        when(leagueMapper.toDto(existing)).thenReturn(dummyDto());
        SocialLinkDto linkDto = new SocialLinkDto("instagram", "https://instagram.com/premier-league");
        SocialLink mappedLink =
                SocialLink.builder().platform("instagram").url("https://instagram.com/premier-league").build();
        when(leagueMapper.toEntity(linkDto)).thenReturn(mappedLink);

        UpdateLeagueRequest request = new UpdateLeagueRequest(
                "Premier League", LeagueSource.INTERNAL, 11, null, null, null, LeagueFormat.ONE_DAY,
                "/media/logo.png", "0123456789", "https://premierleague.example",
                "info@premierleague.example", List.of(linkDto));

        leagueService.update(clubId, leagueId, request);

        assertThat(existing.getFormat()).isEqualTo(LeagueFormat.ONE_DAY);
        assertThat(existing.getLogoUrl()).isEqualTo("/media/logo.png");
        assertThat(existing.getPhone()).isEqualTo("0123456789");
        assertThat(existing.getWebsite()).isEqualTo("https://premierleague.example");
        assertThat(existing.getEmail()).isEqualTo("info@premierleague.example");
        assertThat(existing.getSocialLinks()).containsExactly(mappedLink);
    }

    @Test
    void createWithADuplicateSocialLinkPlatformThrowsValidationExceptionAndNeverSaves() {
        UUID clubId = UUID.randomUUID();
        CreateLeagueRequest request = new CreateLeagueRequest(
                "Premier League", null, null, null, null, null, null, null, null, null, null,
                List.of(
                        new SocialLinkDto("facebook", "https://facebook.com/a"),
                        new SocialLinkDto("facebook", "https://facebook.com/b")));

        assertThatThrownBy(() -> leagueService.create(clubId, request))
                .isInstanceOf(ValidationException.class);

        org.mockito.Mockito.verify(leagueRepository, never()).save(any());
    }

    @Test
    void updateWithADuplicateSocialLinkPlatformThrowsValidationExceptionAndNeverSaves() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UpdateLeagueRequest request = new UpdateLeagueRequest(
                "Premier League", null, null, null, null, null, null, null, null, null, null,
                List.of(
                        new SocialLinkDto("facebook", "https://facebook.com/a"),
                        new SocialLinkDto("facebook", "https://facebook.com/b")));

        assertThatThrownBy(() -> leagueService.update(clubId, leagueId, request))
                .isInstanceOf(ValidationException.class);

        org.mockito.Mockito.verify(leagueRepository, never()).findById(any());
        org.mockito.Mockito.verify(leagueRepository, never()).save(any());
    }

    @Test
    void updateWithAllFiveNewProfileFieldsOmittedRoundTripsAsNullAndEmpty() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        League existing = existingLeague(leagueId, clubId, true);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(existing));
        when(leagueRepository.save(existing)).thenReturn(existing);
        when(leagueMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateLeagueRequest request = new UpdateLeagueRequest(
                "Premier League", LeagueSource.INTERNAL, 11, null, null, null, null, null, null, null, null,
                null);

        leagueService.update(clubId, leagueId, request);

        assertThat(existing.getFormat()).isNull();
        assertThat(existing.getLogoUrl()).isNull();
        assertThat(existing.getPhone()).isNull();
        assertThat(existing.getWebsite()).isNull();
        assertThat(existing.getEmail()).isNull();
        assertThat(existing.getSocialLinks()).isEmpty();
    }

    @Test
    void updateAppliesRequestFieldsOntoTheExistingEntity() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        League existing = existingLeague(leagueId, clubId, true);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(existing));
        when(leagueRepository.save(existing)).thenReturn(existing);
        when(leagueMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateLeagueRequest request = new UpdateLeagueRequest(
                "Renamed League", LeagueSource.INTERNAL, 12, 10, 20, null, null, null, null, null, null, null);

        leagueService.update(clubId, leagueId, request);

        assertThat(existing.getName()).isEqualTo("Renamed League");
        assertThat(existing.getMaxPlayingXiSize()).isEqualTo(12);
        assertThat(existing.getMinAge()).isEqualTo(10);
        assertThat(existing.getMaxAge()).isEqualTo(20);
    }

    @Test
    void updateOnALeagueBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        League existing = existingLeague(leagueId, otherClubId, true);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(existing));

        UpdateLeagueRequest request = new UpdateLeagueRequest(
                "Renamed League", null, null, null, null, null, null, null, null, null, null, null);

        assertThatThrownBy(() -> leagueService.update(clubId, leagueId, request))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void deactivateOnActiveLeagueTransitionsToInactive() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        League existing = existingLeague(leagueId, clubId, true);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(existing));
        when(leagueRepository.save(existing)).thenReturn(existing);
        when(leagueMapper.toDto(existing)).thenReturn(dummyDto());

        leagueService.deactivate(clubId, leagueId);

        assertThat(existing.isActive()).isFalse();
    }

    @Test
    void deactivateOnAlreadyInactiveLeagueThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        League existing = existingLeague(leagueId, clubId, false);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> leagueService.deactivate(clubId, leagueId))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void reactivateOnInactiveLeagueTransitionsToActive() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        League existing = existingLeague(leagueId, clubId, false);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(existing));
        when(leagueRepository.save(existing)).thenReturn(existing);
        when(leagueMapper.toDto(existing)).thenReturn(dummyDto());

        leagueService.reactivate(clubId, leagueId);

        assertThat(existing.isActive()).isTrue();
    }

    @Test
    void reactivateOnAlreadyActiveLeagueThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        League existing = existingLeague(leagueId, clubId, true);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> leagueService.reactivate(clubId, leagueId))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    // --- 050: list()'s computed "current season" fields ---

    @Test
    void listWithZeroSeasonsReturnsAllDefaultsForEveryLeague() {
        UUID clubId = UUID.randomUUID();
        League league = existingLeague(UUID.randomUUID(), clubId, true);
        when(leagueRepository.findByClubId(clubId)).thenReturn(List.of(league));
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of());
        when(leagueMapper.toDto(league)).thenReturn(baseDtoFor(league));

        List<LeagueDto> result = leagueService.list(clubId);

        assertThat(result).hasSize(1);
        LeagueDto dto = result.get(0);
        assertThat(dto.currentSeasonTeamCount()).isZero();
        assertThat(dto.currentSeasonLabel()).isNull();
        assertThat(dto.currentSeasonPlayingConditionsUrl()).isNull();
        org.mockito.Mockito.verify(leagueAffiliationRepository, never()).countDistinctTeamsBySeasonId(any());
        org.mockito.Mockito.verify(leaguePlayingConditionsRepository, never()).findBySeasonId(any());
    }

    // --- 071: match aggregates and season teams ---

    @Test
    void listWithNoCurrentSeasonGivesZerosNullsAndEmptyTeamsAndRunsNoneOfTheNewBatches() {
        UUID clubId = UUID.randomUUID();
        League league = existingLeague(UUID.randomUUID(), clubId, true);
        when(leagueRepository.findByClubId(clubId)).thenReturn(List.of(league));
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of());
        when(leagueMapper.toDto(league)).thenReturn(baseDtoFor(league));

        LeagueDto dto = leagueService.list(clubId).get(0);

        assertThat(dto.matchCount()).isZero();
        assertThat(dto.playedCount()).isZero();
        assertThat(dto.firstMatchDate()).isNull();
        assertThat(dto.lastMatchDate()).isNull();
        assertThat(dto.nextMatchDate()).isNull();
        assertThat(dto.teams()).isEmpty();
        verify(matchRepository, never()).summariseByLeagueForSeason(any(), any(), any());
        verify(leagueAffiliationRepository, never()).findTeamSummariesBySeasonId(any());
        verify(leagueTeamRepository, never()).findActiveBySeasonId(any());
    }

    @Test
    void listPopulatesMatchAggregatesAndTeamsPerLeagueAndDefaultsALeagueWithNoMatches() {
        UUID clubId = UUID.randomUUID();
        League leagueA = existingLeague(UUID.randomUUID(), clubId, true);
        League leagueB = existingLeague(UUID.randomUUID(), clubId, true);
        LocalDate today = LocalDate.now();
        Season currentSeason = season(
                UUID.randomUUID(), clubId, "2026/2027", today.minusMonths(1), today.plusMonths(1), Instant.now());
        Instant first = Instant.parse("2026-04-01T10:00:00Z");
        Instant next = Instant.parse("2026-10-17T10:00:00Z");
        Instant last = Instant.parse("2026-12-01T10:00:00Z");
        when(leagueRepository.findByClubId(clubId)).thenReturn(List.of(leagueA, leagueB));
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of(currentSeason));
        when(matchRepository.summariseByLeagueForSeason(eq(clubId), eq(currentSeason.getId()), any(Instant.class)))
                .thenReturn(List.of(matchSummary(leagueA.getId(), 10, 4, first, last, next)));
        when(leagueAffiliationRepository.findTeamSummariesBySeasonId(currentSeason.getId()))
                .thenReturn(List.of(
                        teamSummary(leagueA.getId(), "Alpha XI", "ALP", "/a.png"),
                        teamSummary(leagueA.getId(), "Zulu XI", null, null)));
        when(leagueTeamRepository.findActiveBySeasonId(currentSeason.getId()))
                .thenReturn(List.of(
                        leagueTeam(leagueA.getId(), currentSeason.getId(), "Aardvarks", "AAR", null),
                        leagueTeam(leagueA.getId(), currentSeason.getId(), "Bears", null, "/b.png")));
        when(leagueMapper.toDto(leagueA)).thenReturn(baseDtoFor(leagueA));
        when(leagueMapper.toDto(leagueB)).thenReturn(baseDtoFor(leagueB));

        List<LeagueDto> result = leagueService.list(clubId);

        LeagueDto dtoA = result.stream().filter(d -> d.id().equals(leagueA.getId())).findFirst().orElseThrow();
        LeagueDto dtoB = result.stream().filter(d -> d.id().equals(leagueB.getId())).findFirst().orElseThrow();
        assertThat(dtoA.matchCount()).isEqualTo(10);
        assertThat(dtoA.playedCount()).isEqualTo(4);
        assertThat(dtoA.firstMatchDate()).isEqualTo(first);
        assertThat(dtoA.lastMatchDate()).isEqualTo(last);
        assertThat(dtoA.nextMatchDate()).isEqualTo(next);
        assertThat(dtoA.teams()).containsExactly(
                new LeagueSeasonTeamDto("Alpha XI", "ALP", "/a.png", true),
                new LeagueSeasonTeamDto("Zulu XI", null, null, true),
                new LeagueSeasonTeamDto("Aardvarks", "AAR", null, false),
                new LeagueSeasonTeamDto("Bears", null, "/b.png", false));
        assertThat(dtoB.matchCount()).isZero();
        assertThat(dtoB.playedCount()).isZero();
        assertThat(dtoB.firstMatchDate()).isNull();
        assertThat(dtoB.lastMatchDate()).isNull();
        assertThat(dtoB.nextMatchDate()).isNull();
        assertThat(dtoB.teams()).isEmpty();
    }

    @Test
    void listRunsEachNewBatchExactlyOnceWithSeveralLeaguesAndPassesOneNowWithinTheCall() {
        UUID clubId = UUID.randomUUID();
        List<League> leagues = List.of(
                existingLeague(UUID.randomUUID(), clubId, true),
                existingLeague(UUID.randomUUID(), clubId, true),
                existingLeague(UUID.randomUUID(), clubId, true));
        LocalDate today = LocalDate.now();
        Season currentSeason = season(
                UUID.randomUUID(), clubId, "2026/2027", today.minusMonths(1), today.plusMonths(1), Instant.now());
        when(leagueRepository.findByClubId(clubId)).thenReturn(leagues);
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of(currentSeason));
        for (League league : leagues) {
            when(leagueMapper.toDto(league)).thenReturn(baseDtoFor(league));
        }
        ArgumentCaptor<Instant> nowCaptor = ArgumentCaptor.forClass(Instant.class);
        Instant before = Instant.now();

        leagueService.list(clubId);

        Instant after = Instant.now();
        verify(matchRepository, times(1))
                .summariseByLeagueForSeason(eq(clubId), eq(currentSeason.getId()), nowCaptor.capture());
        verify(leagueAffiliationRepository, times(1)).findTeamSummariesBySeasonId(currentSeason.getId());
        verify(leagueTeamRepository, times(1)).findActiveBySeasonId(currentSeason.getId());
        verify(leagueAffiliationRepository, times(1)).countDistinctTeamsBySeasonId(currentSeason.getId());
        verify(leaguePlayingConditionsRepository, times(1)).findBySeasonId(currentSeason.getId());
        verifyNoMoreInteractions(matchRepository, leagueTeamRepository, leagueAffiliationRepository,
                leaguePlayingConditionsRepository);
        assertThat(nowCaptor.getValue()).isBetween(before, after);
    }

    @Test
    void createUpdateDeactivateAndReactivateLeaveTheSixNewFieldsNull() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        League active = existingLeague(leagueId, clubId, true);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(active));
        when(leagueRepository.save(any(League.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(leagueMapper.toDto(any(League.class))).thenAnswer(invocation -> baseDtoFor(invocation.getArgument(0)));

        List<LeagueDto> results = new java.util.ArrayList<>();
        results.add(leagueService.create(clubId, new CreateLeagueRequest(
                "New League", null, null, null, null, null, null, null, null, null, null, null)));
        results.add(leagueService.update(clubId, leagueId, new UpdateLeagueRequest(
                "Renamed", null, null, null, null, null, null, null, null, null, null, null)));
        results.add(leagueService.deactivate(clubId, leagueId));
        results.add(leagueService.reactivate(clubId, leagueId));

        for (LeagueDto dto : results) {
            assertThat(dto.matchCount()).isNull();
            assertThat(dto.playedCount()).isNull();
            assertThat(dto.firstMatchDate()).isNull();
            assertThat(dto.lastMatchDate()).isNull();
            assertThat(dto.nextMatchDate()).isNull();
            assertThat(dto.teams()).isNull();
        }
    }

    @Test
    void listOnlyCountsDistinctTeamsAffiliatedForTheCurrentSeasonNotOtherSeasons() {
        UUID clubId = UUID.randomUUID();
        League leagueA = existingLeague(UUID.randomUUID(), clubId, true);
        League leagueB = existingLeague(UUID.randomUUID(), clubId, true);
        LocalDate today = LocalDate.now();
        Season currentSeason = season(
                UUID.randomUUID(), clubId, "2026/2027", today.minusMonths(1), today.plusMonths(1), Instant.now());
        Season otherSeason = season(
                UUID.randomUUID(), clubId, "2025/2026", today.minusYears(1).minusMonths(2),
                today.minusYears(1).plusMonths(2), Instant.now().minusSeconds(60));
        when(leagueRepository.findByClubId(clubId)).thenReturn(List.of(leagueA, leagueB));
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of(currentSeason, otherSeason));
        when(leagueAffiliationRepository.countDistinctTeamsBySeasonId(currentSeason.getId()))
                .thenReturn(List.of(teamCount(leagueA.getId(), 3)));
        when(leaguePlayingConditionsRepository.findBySeasonId(currentSeason.getId())).thenReturn(List.of());
        when(leagueMapper.toDto(leagueA)).thenReturn(baseDtoFor(leagueA));
        when(leagueMapper.toDto(leagueB)).thenReturn(baseDtoFor(leagueB));

        List<LeagueDto> result = leagueService.list(clubId);

        LeagueDto dtoA = result.stream().filter(d -> d.id().equals(leagueA.getId())).findFirst().orElseThrow();
        LeagueDto dtoB = result.stream().filter(d -> d.id().equals(leagueB.getId())).findFirst().orElseThrow();
        assertThat(dtoA.currentSeasonTeamCount()).isEqualTo(3);
        assertThat(dtoA.currentSeasonLabel()).isEqualTo("2026/2027");
        assertThat(dtoB.currentSeasonTeamCount()).isZero();
        org.mockito.Mockito.verify(leagueAffiliationRepository).countDistinctTeamsBySeasonId(currentSeason.getId());
        org.mockito.Mockito.verify(leagueAffiliationRepository, never()).countDistinctTeamsBySeasonId(otherSeason.getId());
    }

    @Test
    void listWithACurrentSeasonAndNoUploadedDocumentLeavesPlayingConditionsUrlNullButStillPopulatesLabel() {
        UUID clubId = UUID.randomUUID();
        League league = existingLeague(UUID.randomUUID(), clubId, true);
        LocalDate today = LocalDate.now();
        Season currentSeason = season(
                UUID.randomUUID(), clubId, "2026/2027", today.minusMonths(1), today.plusMonths(1), Instant.now());
        when(leagueRepository.findByClubId(clubId)).thenReturn(List.of(league));
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of(currentSeason));
        when(leagueAffiliationRepository.countDistinctTeamsBySeasonId(currentSeason.getId())).thenReturn(List.of());
        when(leaguePlayingConditionsRepository.findBySeasonId(currentSeason.getId())).thenReturn(List.of());
        when(leagueMapper.toDto(league)).thenReturn(baseDtoFor(league));

        List<LeagueDto> result = leagueService.list(clubId);

        LeagueDto dto = result.get(0);
        assertThat(dto.currentSeasonPlayingConditionsUrl()).isNull();
        assertThat(dto.currentSeasonLabel()).isEqualTo("2026/2027");
    }

    @Test
    void listResolvesThePlayingConditionsUrlWhenOneHasBeenUploadedForTheCurrentSeason() {
        UUID clubId = UUID.randomUUID();
        League league = existingLeague(UUID.randomUUID(), clubId, true);
        LocalDate today = LocalDate.now();
        Season currentSeason = season(
                UUID.randomUUID(), clubId, "2026/2027", today.minusMonths(1), today.plusMonths(1), Instant.now());
        LeaguePlayingConditions playingConditions = LeaguePlayingConditions.builder()
                .id(UUID.randomUUID()).leagueId(league.getId()).seasonId(currentSeason.getId())
                .documentUrl("/media/rules.pdf").uploadedAt(Instant.now()).build();
        when(leagueRepository.findByClubId(clubId)).thenReturn(List.of(league));
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of(currentSeason));
        when(leagueAffiliationRepository.countDistinctTeamsBySeasonId(currentSeason.getId())).thenReturn(List.of());
        when(leaguePlayingConditionsRepository.findBySeasonId(currentSeason.getId()))
                .thenReturn(List.of(playingConditions));
        when(leagueMapper.toDto(league)).thenReturn(baseDtoFor(league));

        List<LeagueDto> result = leagueService.list(clubId);

        assertThat(result.get(0).currentSeasonPlayingConditionsUrl()).isEqualTo("/media/rules.pdf");
    }

    @Test
    void listResolvesTheCurrentSeasonAsTheOneWhoseDateRangeContainsTodayOverAMoreRecentlyCreatedOne() {
        UUID clubId = UUID.randomUUID();
        League league = existingLeague(UUID.randomUUID(), clubId, true);
        LocalDate today = LocalDate.now();
        Season containingToday = season(
                UUID.randomUUID(), clubId, "Contains Today", today.minusMonths(1), today.plusMonths(1),
                Instant.now().minusSeconds(3600));
        Season mostRecentlyCreatedButNotContainingToday = season(
                UUID.randomUUID(), clubId, "Most Recently Created", today.plusYears(1), today.plusYears(2),
                Instant.now());
        when(leagueRepository.findByClubId(clubId)).thenReturn(List.of(league));
        when(seasonRepository.findByClubId(clubId))
                .thenReturn(List.of(containingToday, mostRecentlyCreatedButNotContainingToday));
        when(leagueAffiliationRepository.countDistinctTeamsBySeasonId(containingToday.getId()))
                .thenReturn(List.of());
        when(leaguePlayingConditionsRepository.findBySeasonId(containingToday.getId())).thenReturn(List.of());
        when(leagueMapper.toDto(league)).thenReturn(baseDtoFor(league));

        List<LeagueDto> result = leagueService.list(clubId);

        assertThat(result.get(0).currentSeasonLabel()).isEqualTo("Contains Today");
    }

    @Test
    void listFallsBackToTheMostRecentlyCreatedSeasonWhenNoneContainsToday() {
        UUID clubId = UUID.randomUUID();
        League league = existingLeague(UUID.randomUUID(), clubId, true);
        LocalDate today = LocalDate.now();
        Season olderSeason = season(
                UUID.randomUUID(), clubId, "Older", today.minusYears(2), today.minusYears(1).minusMonths(6),
                Instant.now().minusSeconds(3600));
        Season mostRecentlyCreated = season(
                UUID.randomUUID(), clubId, "Most Recently Created", today.plusYears(1), today.plusYears(2),
                Instant.now());
        when(leagueRepository.findByClubId(clubId)).thenReturn(List.of(league));
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of(olderSeason, mostRecentlyCreated));
        when(leagueAffiliationRepository.countDistinctTeamsBySeasonId(mostRecentlyCreated.getId()))
                .thenReturn(List.of());
        when(leaguePlayingConditionsRepository.findBySeasonId(mostRecentlyCreated.getId())).thenReturn(List.of());
        when(leagueMapper.toDto(league)).thenReturn(baseDtoFor(league));

        List<LeagueDto> result = leagueService.list(clubId);

        assertThat(result.get(0).currentSeasonLabel()).isEqualTo("Most Recently Created");
    }

    private static LeagueTeamCount teamCount(UUID leagueId, long teamCount) {
        return new LeagueTeamCount() {
            @Override
            public UUID getLeagueId() {
                return leagueId;
            }

            @Override
            public long getTeamCount() {
                return teamCount;
            }
        };
    }

    // --- 091: season, includeInactive, focus and the summary ---

    private static LeagueWeekMatchCount weekCount(UUID leagueId, long count) {
        return new LeagueWeekMatchCount() {
            @Override
            public UUID getLeagueId() {
                return leagueId;
            }

            @Override
            public long getMatchCount() {
                return count;
            }
        };
    }

    /** Three leagues for one club in one current season: A (2 teams, 10 matches, 3 this week), B (inactive, 1 team, no
     * matches) and C (active, no teams, no matches). */
    private record Fixture(UUID clubId, Season season, League a, League b, League c) {}

    private Fixture arrangeThreeLeagues() {
        UUID clubId = UUID.randomUUID();
        League a = existingLeague(UUID.randomUUID(), clubId, true);
        League b = existingLeague(UUID.randomUUID(), clubId, false);
        League c = existingLeague(UUID.randomUUID(), clubId, true);
        LocalDate today = LocalDate.now();
        Season current = season(UUID.randomUUID(), clubId, "2026/2027", today.minusMonths(1), today.plusMonths(1), Instant.now());
        when(leagueRepository.findByClubId(clubId)).thenReturn(List.of(a, b, c));
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of(current));
        when(matchRepository.summariseByLeagueForSeason(eq(clubId), eq(current.getId()), any(Instant.class)))
                .thenReturn(List.of(matchSummary(a.getId(), 10, 4, null, null, null)));
        // only the this-week focus and the summary read it
        org.mockito.Mockito.lenient()
                .when(matchRepository.countMatchesInWindowByLeague(eq(clubId), eq(current.getId()), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of(weekCount(a.getId(), 3)));
        when(leagueAffiliationRepository.findTeamSummariesBySeasonId(current.getId()))
                .thenReturn(List.of(
                        teamSummary(a.getId(), "Alpha XI", null, null),
                        teamSummary(b.getId(), "Bravo XI", null, null)));
        when(leagueTeamRepository.findActiveBySeasonId(current.getId()))
                .thenReturn(List.of(leagueTeam(a.getId(), current.getId(), "Aardvarks", null, null)));
        for (League league : List.of(a, b, c)) {
            when(leagueMapper.toDto(league)).thenReturn(baseDtoFor(league));
        }
        return new Fixture(clubId, current, a, b, c);
    }

    @Test
    void listUsesTheRequestedSeasonAndRejectsOneThatIsNotTheClubs() {
        UUID clubId = UUID.randomUUID();
        LocalDate today = LocalDate.now();
        Season current = season(UUID.randomUUID(), clubId, "2026/2027", today.minusMonths(1), today.plusMonths(1), Instant.now());
        Season older = season(UUID.randomUUID(), clubId, "2025/2026", today.minusYears(1).minusMonths(1), today.minusYears(1).plusMonths(1),
                Instant.now().minusSeconds(100_000));
        League league = existingLeague(UUID.randomUUID(), clubId, true);
        when(leagueRepository.findByClubId(clubId)).thenReturn(List.of(league));
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of(current, older));
        when(leagueMapper.toDto(league)).thenReturn(baseDtoFor(league));

        LeagueDto dto = leagueService.list(clubId, older.getId(), true, null).get(0);

        assertThat(dto.currentSeasonLabel()).isEqualTo("2025/2026");
        verify(leagueAffiliationRepository).countDistinctTeamsBySeasonId(older.getId());
        verify(leagueAffiliationRepository, never()).countDistinctTeamsBySeasonId(current.getId());
        assertThatThrownBy(() -> leagueService.list(clubId, UUID.randomUUID(), true, null))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void listWithIncludeInactiveFalseHidesInactiveLeaguesAndTheDefaultKeepsThem() {
        Fixture f = arrangeThreeLeagues();

        assertThat(leagueService.list(f.clubId(), null, false, null)).extracting(LeagueDto::id)
                .containsExactly(f.a().getId(), f.c().getId());
        assertThat(leagueService.list(f.clubId(), null, true, null)).hasSize(3);
        assertThat(leagueService.list(f.clubId())).hasSize(3);
    }

    @Test
    void listNarrowsByEachFocusAndTheWeekQueryOnlyRunsForThisWeek() {
        Fixture f = arrangeThreeLeagues();

        assertThat(leagueService.list(f.clubId(), null, true, LeagueListFocus.ACTIVE)).extracting(LeagueDto::id)
                .containsExactly(f.a().getId(), f.c().getId());
        verify(matchRepository, never()).countMatchesInWindowByLeague(any(), any(), any(), any());

        assertThat(leagueService.list(f.clubId(), null, true, LeagueListFocus.THIS_WEEK)).extracting(LeagueDto::id)
                .containsExactly(f.a().getId());
        // an active league with no teams or no matches needs attention; the inactive one never does
        assertThat(leagueService.list(f.clubId(), null, true, LeagueListFocus.ATTENTION)).extracting(LeagueDto::id)
                .containsExactly(f.c().getId());
    }

    @Test
    void summaryCountsExactlyTheListsItFilters() {
        Fixture f = arrangeThreeLeagues();
        when(teamSquadMemberRepository.countDistinctPlayersInLeagues(eq(f.season().getId()), any()))
                .thenReturn(17L);

        LeaguesSummaryDto all = leagueService.summary(f.clubId(), null, true);

        assertThat(all.leaguesShown()).isEqualTo(3);
        assertThat(all.active()).isEqualTo(leagueService.list(f.clubId(), null, true, LeagueListFocus.ACTIVE).size());
        assertThat(all.needAttention())
                .isEqualTo(leagueService.list(f.clubId(), null, true, LeagueListFocus.ATTENTION).size());
        assertThat(all.teamsEntered()).isEqualTo(3);
        assertThat(all.players()).isEqualTo(17);
        assertThat(all.seasons()).isEqualTo(1);
        // a match count, not a league count
        assertThat(all.matchesThisWeek()).isEqualTo(3);

        LeaguesSummaryDto withoutInactive = leagueService.summary(f.clubId(), null, false);
        assertThat(withoutInactive.leaguesShown()).isEqualTo(2);
        assertThat(withoutInactive.teamsEntered()).isEqualTo(2);
    }

    @Test
    void summaryWithNoSeasonIsAllZerosExceptTheLeagueFigures() {
        UUID clubId = UUID.randomUUID();
        League league = existingLeague(UUID.randomUUID(), clubId, true);
        when(leagueRepository.findByClubId(clubId)).thenReturn(List.of(league));
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of());
        when(leagueMapper.toDto(league)).thenReturn(baseDtoFor(league));

        LeaguesSummaryDto summary = leagueService.summary(clubId, null, true);

        assertThat(summary).isEqualTo(new LeaguesSummaryDto(1, 1, 0, 0, 0, 0, 1));
        verify(teamSquadMemberRepository, never()).countDistinctPlayersInLeagues(any(), any());
    }

    private static LeagueMatchSummary matchSummary(
            UUID leagueId, long matchCount, long playedCount, Instant first, Instant last, Instant next) {
        return new LeagueMatchSummary() {
            @Override
            public UUID getLeagueId() {
                return leagueId;
            }

            @Override
            public long getMatchCount() {
                return matchCount;
            }

            @Override
            public long getPlayedCount() {
                return playedCount;
            }

            @Override
            public Instant getFirstMatchDate() {
                return first;
            }

            @Override
            public Instant getLastMatchDate() {
                return last;
            }

            @Override
            public Instant getNextMatchDate() {
                return next;
            }
        };
    }

    private static LeagueTeamSummary teamSummary(UUID leagueId, String name, String abbreviation, String logoUrl) {
        return new LeagueTeamSummary() {
            @Override
            public UUID getLeagueId() {
                return leagueId;
            }

            @Override
            public String getName() {
                return name;
            }

            @Override
            public String getAbbreviation() {
                return abbreviation;
            }

            @Override
            public String getLogoUrl() {
                return logoUrl;
            }
        };
    }

    private static LeagueTeam leagueTeam(UUID leagueId, UUID seasonId, String name, String abbreviation, String logoUrl) {
        return LeagueTeam.builder().id(UUID.randomUUID()).leagueId(leagueId).seasonId(seasonId).name(name)
                .abbreviation(abbreviation).logoUrl(logoUrl).active(true).build();
    }

    // ---- docs/specs/096-duplicate-league.md ----

    private static final UUID CLUB_ID = UUID.randomUUID();
    private static final UUID SOURCE_ID = UUID.randomUUID();
    private static final UUID NEW_ID = UUID.randomUUID();

    private League richSource(boolean active) {
        return League.builder().id(SOURCE_ID).clubId(CLUB_ID).name("Division 1").source(LeagueSource.EXTERNAL)
                .maxPlayingXiSize(9).minAge(12).maxAge(15).ageCutoffDate(LocalDate.of(2031, 9, 1))
                .format(LeagueFormat.T20).logoUrl("/media/l.png").phone("0123").website("https://l.example")
                .email("a@l.example")
                .socialLinks(new ArrayList<>(List.of(SocialLink.builder().platform("facebook").url("https://fb").build())))
                .active(active).updatedBy(UUID.randomUUID()).build();
    }

    private Season clubSeason(UUID id) {
        return season(id, CLUB_ID, "S" + id.toString().substring(0, 4), LocalDate.of(2031, 1, 1),
                LocalDate.of(2031, 12, 31), Instant.parse("2031-01-01T00:00:00Z"));
    }

    private LeaguePlayingConditions conditionsRow(UUID seasonId, boolean bonus) {
        return LeaguePlayingConditions.builder().id(UUID.randomUUID()).leagueId(SOURCE_ID).seasonId(seasonId)
                .documentUrl("/media/pc.pdf").uploadedAt(Instant.parse("2031-02-01T10:00:00Z"))
                .uploadedBy(UUID.randomUUID()).maxOversPerInnings(40).allowSubstitutions(true).pointsForWin(4)
                .bonusPointsEnabled(bonus).bonusBattingOversThreshold(30).bonusBowlingRestrictionPercentage(50).build();
    }

    private LeagueContact contactRow(String first, boolean primary) {
        return LeagueContact.builder().id(UUID.randomUUID()).leagueId(SOURCE_ID)
                .contact(Contact.builder().firstName(first).lastName("L").email(first + "@x.example").build())
                .role("Secretary").isPrimary(primary).active(true).build();
    }

    private void stubSourceAndSave(League source) {
        when(leagueRepository.findById(SOURCE_ID)).thenReturn(Optional.of(source));
        when(leagueRepository.existsByClubIdAndNameIgnoreCase(any(), any())).thenReturn(false);
        when(leagueRepository.save(any(League.class))).thenAnswer(invocation -> {
            League saved = invocation.getArgument(0);
            saved.setId(NEW_ID);
            return saved;
        });
    }

    private DuplicateLeagueRequest request(String name, List<UUID> seasonIds, Boolean conditions, Boolean contacts) {
        return new DuplicateLeagueRequest(name, seasonIds, conditions, contacts);
    }

    @SuppressWarnings("unchecked")
    private List<Object> savedAll(org.springframework.data.jpa.repository.JpaRepository<?, UUID> repository) {
        ArgumentCaptor<Iterable<Object>> captor = ArgumentCaptor.forClass(Iterable.class);
        verify(((org.springframework.data.jpa.repository.JpaRepository<Object, UUID>) repository)).saveAll(captor.capture());
        List<Object> rows = new ArrayList<>();
        captor.getValue().forEach(rows::add);
        return rows;
    }

    @Test
    void duplicateCopiesTheProfileAsANewActiveInternalLeagueWithTheTrimmedNameAndNoUpdatedBy() {
        stubSourceAndSave(richSource(false));

        DuplicateLeagueResponse response =
                leagueService.duplicate(CLUB_ID, SOURCE_ID, request("  Division 2  ", null, false, false));

        ArgumentCaptor<League> captor = ArgumentCaptor.forClass(League.class);
        verify(leagueRepository).save(captor.capture());
        League copy = captor.getValue();
        assertThat(copy.getName()).isEqualTo("Division 2");
        assertThat(copy.getName()).isNotEqualTo("Division 1");
        assertThat(copy.getClubId()).isEqualTo(CLUB_ID);
        assertThat(copy.isActive()).isTrue();
        assertThat(copy.getSource()).isEqualTo(LeagueSource.INTERNAL);
        assertThat(copy.getUpdatedBy()).isNull();
        assertThat(copy.getMaxPlayingXiSize()).isEqualTo(9);
        assertThat(copy.getMinAge()).isEqualTo(12);
        assertThat(copy.getMaxAge()).isEqualTo(15);
        assertThat(copy.getAgeCutoffDate()).isEqualTo(LocalDate.of(2031, 9, 1));
        assertThat(copy.getFormat()).isEqualTo(LeagueFormat.T20);
        assertThat(copy.getLogoUrl()).isEqualTo("/media/l.png");
        assertThat(copy.getPhone()).isEqualTo("0123");
        assertThat(copy.getWebsite()).isEqualTo("https://l.example");
        assertThat(copy.getEmail()).isEqualTo("a@l.example");
        assertThat(copy.getSocialLinks()).extracting(SocialLink::getPlatform, SocialLink::getUrl)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("facebook", "https://fb"));
        assertThat(response).isEqualTo(new DuplicateLeagueResponse(NEW_ID, "Division 2", 0, 0, 0));
    }

    @Test
    void duplicateWithBothFlagsOffCopiesNothingOfEitherGroupAndNeverReadsThem() {
        stubSourceAndSave(richSource(true));

        leagueService.duplicate(CLUB_ID, SOURCE_ID, request("Division 2", List.of(UUID.randomUUID()), false, false));

        verifyNoInteractions(leaguePlayingConditionsRepository, leagueContactRepository, seasonRepository);
    }

    @Test
    void duplicateIgnoresSeasonIdsWhenPlayingConditionsAreOffEvenIfEmpty() {
        stubSourceAndSave(richSource(true));
        when(leagueContactRepository.findByLeagueIdAndActiveTrue(SOURCE_ID)).thenReturn(List.of());

        DuplicateLeagueResponse response =
                leagueService.duplicate(CLUB_ID, SOURCE_ID, request("Division 2", List.of(), false, true));

        assertThat(response.seasonsCopied()).isZero();
        verifyNoInteractions(leaguePlayingConditionsRepository, seasonRepository);
    }

    @Test
    void duplicateFlagsDefaultToTrueWhenNull() {
        UUID seasonId = UUID.randomUUID();
        stubSourceAndSave(richSource(true));
        when(seasonRepository.findByClubId(CLUB_ID)).thenReturn(List.of(clubSeason(seasonId)));
        when(leaguePlayingConditionsRepository.findByLeagueIdAndSeasonIdIn(eq(SOURCE_ID), any()))
                .thenReturn(List.of(conditionsRow(seasonId, true)));
        when(leagueContactRepository.findByLeagueIdAndActiveTrue(SOURCE_ID)).thenReturn(List.of(contactRow("Sam", true)));

        DuplicateLeagueResponse response =
                leagueService.duplicate(CLUB_ID, SOURCE_ID, request("Division 2", List.of(seasonId), null, null));

        assertThat(response).isEqualTo(new DuplicateLeagueResponse(NEW_ID, "Division 2", 1, 1, 1));
    }

    @Test
    void duplicateCopiesPlayingConditionsWithThePdfReferenceAndNullsBonusThresholdsWhenBonusIsOff() {
        UUID withBonus = UUID.randomUUID();
        UUID withoutBonus = UUID.randomUUID();
        stubSourceAndSave(richSource(true));
        when(seasonRepository.findByClubId(CLUB_ID)).thenReturn(List.of(clubSeason(withBonus), clubSeason(withoutBonus)));
        LeaguePlayingConditions bonusRow = conditionsRow(withBonus, true);
        LeaguePlayingConditions noBonusRow = conditionsRow(withoutBonus, false);
        when(leaguePlayingConditionsRepository.findByLeagueIdAndSeasonIdIn(eq(SOURCE_ID), any()))
                .thenReturn(List.of(bonusRow, noBonusRow));

        DuplicateLeagueResponse response = leagueService.duplicate(
                CLUB_ID, SOURCE_ID, request("Division 2", List.of(withBonus, withoutBonus), true, false));

        List<Object> rows = savedAll(leaguePlayingConditionsRepository);
        assertThat(rows).hasSize(2).allSatisfy(row -> {
            LeaguePlayingConditions copy = (LeaguePlayingConditions) row;
            assertThat(copy.getId()).isNull();
            assertThat(copy.getLeagueId()).isEqualTo(NEW_ID);
            assertThat(copy.getDocumentUrl()).isEqualTo("/media/pc.pdf");
            assertThat(copy.getUploadedBy()).isNotNull();
            assertThat(copy.getMaxOversPerInnings()).isEqualTo(40);
        });
        LeaguePlayingConditions copyWithBonus = (LeaguePlayingConditions) rows.get(0);
        LeaguePlayingConditions copyWithoutBonus = (LeaguePlayingConditions) rows.get(1);
        assertThat(copyWithBonus.getBonusBattingOversThreshold()).isEqualTo(30);
        assertThat(copyWithoutBonus.getBonusBattingOversThreshold()).isNull();
        assertThat(copyWithoutBonus.getBonusBowlingRestrictionPercentage()).isNull();
        assertThat(response.playingConditionsCopied()).isEqualTo(2);
        verifyNoInteractions(leagueContactRepository);
    }

    @Test
    void duplicateOfAChosenSeasonWithoutASourceRowCopiesNothingForIt() {
        UUID seasonId = UUID.randomUUID();
        stubSourceAndSave(richSource(true));
        when(seasonRepository.findByClubId(CLUB_ID)).thenReturn(List.of(clubSeason(seasonId)));
        when(leaguePlayingConditionsRepository.findByLeagueIdAndSeasonIdIn(eq(SOURCE_ID), any())).thenReturn(List.of());

        DuplicateLeagueResponse response =
                leagueService.duplicate(CLUB_ID, SOURCE_ID, request("Division 2", List.of(seasonId), true, false));

        assertThat(response.seasonsCopied()).isEqualTo(1);
        assertThat(response.playingConditionsCopied()).isZero();
        assertThat(savedAll(leaguePlayingConditionsRepository)).isEmpty();
    }

    @Test
    void duplicateDeduplicatesSeasonIdsBeforeQueryingAndCounting() {
        UUID seasonId = UUID.randomUUID();
        stubSourceAndSave(richSource(true));
        when(seasonRepository.findByClubId(CLUB_ID)).thenReturn(List.of(clubSeason(seasonId)));
        when(leaguePlayingConditionsRepository.findByLeagueIdAndSeasonIdIn(eq(SOURCE_ID), any()))
                .thenReturn(List.of(conditionsRow(seasonId, true)));

        DuplicateLeagueResponse response = leagueService.duplicate(
                CLUB_ID, SOURCE_ID, request("Division 2", List.of(seasonId, seasonId, seasonId), true, false));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<UUID>> ids = ArgumentCaptor.forClass(Collection.class);
        verify(leaguePlayingConditionsRepository).findByLeagueIdAndSeasonIdIn(eq(SOURCE_ID), ids.capture());
        assertThat(ids.getValue()).containsExactly(seasonId);
        assertThat(response.seasonsCopied()).isEqualTo(1);
        assertThat(response.playingConditionsCopied()).isEqualTo(1);
    }

    @Test
    void duplicateCopiesOnlyTheActiveContactsKeepingThePrimaryFlag() {
        stubSourceAndSave(richSource(true));
        LeagueContact primary = contactRow("Sam", true);
        LeagueContact other = contactRow("Alex", false);
        when(leagueContactRepository.findByLeagueIdAndActiveTrue(SOURCE_ID)).thenReturn(List.of(primary, other));

        DuplicateLeagueResponse response =
                leagueService.duplicate(CLUB_ID, SOURCE_ID, request("Division 2", null, false, true));

        List<Object> rows = savedAll(leagueContactRepository);
        assertThat(rows).hasSize(2).allSatisfy(row -> {
            LeagueContact copy = (LeagueContact) row;
            assertThat(copy.getId()).isNull();
            assertThat(copy.getLeagueId()).isEqualTo(NEW_ID);
            assertThat(copy.isActive()).isTrue();
            assertThat(copy.getContact()).isNotNull();
        });
        assertThat(((LeagueContact) rows.get(0)).isPrimary()).isTrue();
        assertThat(((LeagueContact) rows.get(1)).isPrimary()).isFalse();
        assertThat(((LeagueContact) rows.get(0)).getContact()).isNotSameAs(primary.getContact());
        assertThat(response.contactsCopied()).isEqualTo(2);
        verify(leagueContactRepository, never()).findByLeagueId(any());
    }

    @Test
    void duplicateNeverTouchesAffiliationsLeagueTeamsOrMatches() {
        UUID seasonId = UUID.randomUUID();
        stubSourceAndSave(richSource(true));
        when(seasonRepository.findByClubId(CLUB_ID)).thenReturn(List.of(clubSeason(seasonId)));
        when(leaguePlayingConditionsRepository.findByLeagueIdAndSeasonIdIn(eq(SOURCE_ID), any())).thenReturn(List.of());
        when(leagueContactRepository.findByLeagueIdAndActiveTrue(SOURCE_ID)).thenReturn(List.of());

        leagueService.duplicate(CLUB_ID, SOURCE_ID, request("Division 2", List.of(seasonId), true, true));

        verifyNoInteractions(leagueAffiliationRepository, leagueTeamRepository, matchRepository);
    }

    @Test
    void duplicateRejectsABlankNameWith400() {
        when(leagueRepository.findById(SOURCE_ID)).thenReturn(Optional.of(richSource(true)));

        assertThatThrownBy(() -> leagueService.duplicate(CLUB_ID, SOURCE_ID, request("   ", null, false, false)))
                .isInstanceOf(ValidationException.class);
        verify(leagueRepository, never()).save(any());
    }

    @Test
    void duplicateRejectsANameOver255CharactersWith400() {
        when(leagueRepository.findById(SOURCE_ID)).thenReturn(Optional.of(richSource(true)));

        assertThatThrownBy(() -> leagueService.duplicate(
                        CLUB_ID, SOURCE_ID, request("x".repeat(256), null, false, false)))
                .isInstanceOf(ValidationException.class);
        verify(leagueRepository, never()).save(any());
    }

    @Test
    void duplicateRejectsEmptyOrMissingSeasonIdsWith400WhenPlayingConditionsAreOn() {
        when(leagueRepository.findById(SOURCE_ID)).thenReturn(Optional.of(richSource(true)));

        assertThatThrownBy(() -> leagueService.duplicate(CLUB_ID, SOURCE_ID, request("Division 2", List.of(), true, true)))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> leagueService.duplicate(CLUB_ID, SOURCE_ID, request("Division 2", null, null, true)))
                .isInstanceOf(ValidationException.class);
        verify(leagueRepository, never()).save(any());
    }

    @Test
    void duplicateRejectsANullSeasonIdWith400() {
        when(leagueRepository.findById(SOURCE_ID)).thenReturn(Optional.of(richSource(true)));
        List<UUID> withNull = new ArrayList<>();
        withNull.add(null);

        assertThatThrownBy(() -> leagueService.duplicate(CLUB_ID, SOURCE_ID, request("Division 2", withNull, true, true)))
                .isInstanceOf(ValidationException.class);
        verify(leagueRepository, never()).save(any());
    }

    @Test
    void duplicateRejectsANameClashWith409CarryingTheTrimmedName() {
        when(leagueRepository.findById(SOURCE_ID)).thenReturn(Optional.of(richSource(true)));
        when(leagueRepository.existsByClubIdAndNameIgnoreCase(CLUB_ID, "division 1")).thenReturn(true);

        assertThatThrownBy(() -> leagueService.duplicate(
                        CLUB_ID, SOURCE_ID, request("  division 1 ", null, false, false)))
                .isInstanceOf(DuplicateLeagueNameException.class)
                .hasMessage("A league named division 1 already exists");
        verify(leagueRepository, never()).save(any());
    }

    @Test
    void duplicateOfAnotherClubsLeagueIs404() {
        when(leagueRepository.findById(SOURCE_ID)).thenReturn(Optional.of(richSource(true)));

        assertThatThrownBy(() -> leagueService.duplicate(
                        UUID.randomUUID(), SOURCE_ID, request("Division 2", null, false, false)))
                .isInstanceOf(NotFoundException.class);
        verify(leagueRepository, never()).save(any());
    }

    @Test
    void duplicateOfAnUnknownLeagueIs404() {
        when(leagueRepository.findById(SOURCE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> leagueService.duplicate(CLUB_ID, SOURCE_ID, request("Division 2", null, false, false)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void duplicateWithAnUnknownOrOtherClubsSeasonIs404AndSavesNothing() {
        UUID mine = UUID.randomUUID();
        UUID foreign = UUID.randomUUID();
        when(leagueRepository.findById(SOURCE_ID)).thenReturn(Optional.of(richSource(true)));
        when(seasonRepository.findByClubId(CLUB_ID)).thenReturn(List.of(clubSeason(mine)));

        assertThatThrownBy(() -> leagueService.duplicate(
                        CLUB_ID, SOURCE_ID, request("Division 2", List.of(mine, foreign), true, true)))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining(foreign.toString());
        verify(leagueRepository, never()).save(any());
        verifyNoInteractions(leaguePlayingConditionsRepository, leagueContactRepository);
    }
}
