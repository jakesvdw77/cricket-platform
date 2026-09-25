package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueFormat;
import com.cricketlegend.domain.LeaguePlayingConditions;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.SocialLink;
import com.cricketlegend.dto.CreateLeagueRequest;
import com.cricketlegend.dto.LeagueDto;
import com.cricketlegend.dto.SocialLinkDto;
import com.cricketlegend.dto.UpdateLeagueRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LeagueMapper;
import com.cricketlegend.repository.LeagueAffiliationRepository;
import com.cricketlegend.repository.LeagueAffiliationRepository.LeagueTeamCount;
import com.cricketlegend.repository.LeaguePlayingConditionsRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.service.impl.LeagueServiceImpl;
import java.time.Instant;
import java.time.LocalDate;
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
    private LeagueMapper leagueMapper;

    private LeagueServiceImpl leagueService;

    @BeforeEach
    void setUp() {
        leagueService = new LeagueServiceImpl(
                leagueRepository, seasonRepository, leagueAffiliationRepository,
                leaguePlayingConditionsRepository, leagueMapper);
    }

    private LeagueDto dummyDto() {
        return new LeagueDto(
                UUID.randomUUID(), UUID.randomUUID(), "Premier League", LeagueSource.INTERNAL, 11,
                null, null, null, null, null, null, null, null, List.of(), true, null, null, null, 0, null, null);
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
                league.getUpdatedAt(), league.getUpdatedBy(), 0, null, null);
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
}
