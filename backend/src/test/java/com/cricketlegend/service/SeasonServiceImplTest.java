package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Season;
import com.cricketlegend.dto.CreateSeasonRequest;
import com.cricketlegend.dto.SeasonDto;
import com.cricketlegend.dto.SeasonSummaryDto;
import com.cricketlegend.dto.SeasonsSummaryDto;
import com.cricketlegend.dto.UpdateSeasonRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.SeasonMapper;
import com.cricketlegend.repository.LeagueAffiliationRepository;
import com.cricketlegend.repository.LeagueAffiliationRepository.SeasonCount;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchRepository.SeasonMatchCount;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.service.impl.SeasonServiceImpl;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for SeasonServiceImpl's business rules from docs/specs/029-league-management.md:
 * create/update's {@code startDate <= endDate} validation, deactivate/reactivate's one-way
 * transition guard, and cross-club isolation.
 */
@ExtendWith(MockitoExtension.class)
class SeasonServiceImplTest {

    @Mock
    private SeasonRepository seasonRepository;

    @Mock
    private SeasonMapper seasonMapper;

    @Mock
    private LeagueAffiliationRepository leagueAffiliationRepository;

    @Mock
    private MatchRepository matchRepository;

    private SeasonServiceImpl seasonService;

    @BeforeEach
    void setUp() {
        seasonService = new SeasonServiceImpl(seasonRepository, seasonMapper, leagueAffiliationRepository, matchRepository);
    }

    private SeasonDto dummyDto() {
        return new SeasonDto(
                UUID.randomUUID(), UUID.randomUUID(), "2026", LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 12, 31), true, null, null, null);
    }

    private Season existingSeason(UUID id, UUID clubId, boolean active) {
        return Season.builder().id(id).clubId(clubId).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31))
                .active(active).build();
    }

    @Test
    void createWithStartDateBeforeEndDateSucceeds() {
        UUID clubId = UUID.randomUUID();
        CreateSeasonRequest request =
                new CreateSeasonRequest("2026", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31));
        when(seasonRepository.save(any(Season.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(seasonMapper.toDto(any(Season.class))).thenReturn(dummyDto());

        seasonService.create(clubId, request);

        verify(seasonRepository).save(any(Season.class));
    }

    @Test
    void createWithStartDateAfterEndDateThrowsValidationExceptionAndNeverSaves() {
        UUID clubId = UUID.randomUUID();
        CreateSeasonRequest request =
                new CreateSeasonRequest("2026", LocalDate.of(2026, 12, 31), LocalDate.of(2026, 1, 1));

        assertThatThrownBy(() -> seasonService.create(clubId, request))
                .isInstanceOf(ValidationException.class);

        verify(seasonRepository, never()).save(any());
    }

    @Test
    void updateAppliesRequestFieldsOntoTheExistingEntity() {
        UUID clubId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Season existing = existingSeason(seasonId, clubId, true);
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(existing));
        when(seasonRepository.save(existing)).thenReturn(existing);
        when(seasonMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateSeasonRequest request =
                new UpdateSeasonRequest("2026-27", LocalDate.of(2026, 9, 1), LocalDate.of(2027, 4, 30));

        seasonService.update(clubId, seasonId, request);

        assertThat(existing.getLabel()).isEqualTo("2026-27");
        assertThat(existing.getStartDate()).isEqualTo(LocalDate.of(2026, 9, 1));
        assertThat(existing.getEndDate()).isEqualTo(LocalDate.of(2027, 4, 30));
    }

    @Test
    void updateOnASeasonBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Season existing = existingSeason(seasonId, otherClubId, true);
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(existing));

        UpdateSeasonRequest request =
                new UpdateSeasonRequest("2026", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31));

        assertThatThrownBy(() -> seasonService.update(clubId, seasonId, request))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void deactivateOnActiveSeasonTransitionsToInactive() {
        UUID clubId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Season existing = existingSeason(seasonId, clubId, true);
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(existing));
        when(seasonRepository.save(existing)).thenReturn(existing);
        when(seasonMapper.toDto(existing)).thenReturn(dummyDto());

        seasonService.deactivate(clubId, seasonId);

        assertThat(existing.isActive()).isFalse();
    }

    @Test
    void deactivateOnAlreadyInactiveSeasonThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Season existing = existingSeason(seasonId, clubId, false);
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> seasonService.deactivate(clubId, seasonId))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void reactivateOnInactiveSeasonTransitionsToActive() {
        UUID clubId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Season existing = existingSeason(seasonId, clubId, false);
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(existing));
        when(seasonRepository.save(existing)).thenReturn(existing);
        when(seasonMapper.toDto(existing)).thenReturn(dummyDto());

        seasonService.reactivate(clubId, seasonId);

        assertThat(existing.isActive()).isTrue();
    }

    @Test
    void reactivateOnAlreadyActiveSeasonThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Season existing = existingSeason(seasonId, clubId, true);
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> seasonService.reactivate(clubId, seasonId))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void listMapsEverySeasonForTheClub() {
        UUID clubId = UUID.randomUUID();
        Season season = existingSeason(UUID.randomUUID(), clubId, true);
        SeasonDto dto = dummyDto();
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of(season));
        when(seasonMapper.toDto(season)).thenReturn(dto);

        List<SeasonDto> result = seasonService.list(clubId);

        assertThat(result).containsExactly(dto);
    }

    private SeasonCount count(UUID seasonId, long total) {
        return new SeasonCount() {
            @Override
            public UUID getSeasonId() {
                return seasonId;
            }

            @Override
            public long getTotal() {
                return total;
            }
        };
    }

    private SeasonMatchCount matches(UUID seasonId, long total) {
        return new SeasonMatchCount() {
            @Override
            public UUID getSeasonId() {
                return seasonId;
            }

            @Override
            public long getTotal() {
                return total;
            }
        };
    }

    @Test
    void summaryReportsCountsPerSeasonAndZerosForASeasonWithNothingAttached() {
        UUID clubId = UUID.randomUUID();
        UUID busy = UUID.randomUUID();
        UUID idle = UUID.randomUUID();
        UUID inactive = UUID.randomUUID();
        when(seasonRepository.findByClubId(clubId))
                .thenReturn(List.of(existingSeason(busy, clubId, true), existingSeason(idle, clubId, true),
                        existingSeason(inactive, clubId, false)));
        List<UUID> ids = List.of(busy, idle, inactive);
        when(leagueAffiliationRepository.countDistinctLeaguesBySeasonIds(clubId, ids))
                .thenReturn(List.of(count(busy, 2), count(inactive, 1)));
        when(leagueAffiliationRepository.countDistinctTeamsBySeasonIds(clubId, ids))
                .thenReturn(List.of(count(busy, 3), count(inactive, 1)));
        when(matchRepository.countActiveBySeasonIds(clubId, ids)).thenReturn(List.of(matches(busy, 7)));

        SeasonsSummaryDto result = seasonService.summary(null, clubId);

        assertThat(result.seasons()).containsExactly(
                new SeasonSummaryDto(busy, 2, 3, 7),
                new SeasonSummaryDto(idle, 0, 0, 0),
                new SeasonSummaryDto(inactive, 1, 1, 0));
    }

    @Test
    void summaryTakesTheTeamsAndMatchesFromTheGroupedQueriesAsGiven() {
        // distinct teams across several leagues are counted once by the query; the service must not add them up again
        UUID clubId = UUID.randomUUID();
        UUID season = UUID.randomUUID();
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of(existingSeason(season, clubId, true)));
        List<UUID> ids = List.of(season);
        when(leagueAffiliationRepository.countDistinctLeaguesBySeasonIds(clubId, ids)).thenReturn(List.of(count(season, 3)));
        when(leagueAffiliationRepository.countDistinctTeamsBySeasonIds(clubId, ids)).thenReturn(List.of(count(season, 1)));
        when(matchRepository.countActiveBySeasonIds(clubId, ids)).thenReturn(List.of());

        assertThat(seasonService.summary(null, clubId).seasons())
                .containsExactly(new SeasonSummaryDto(season, 3, 1, 0));
    }

    @Test
    void summaryOfAClubWithoutSeasonsIsEmptyAndRunsNoGroupedQuery() {
        UUID clubId = UUID.randomUUID();
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of());

        assertThat(seasonService.summary(null, clubId).seasons()).isEmpty();
        verifyNoInteractions(leagueAffiliationRepository, matchRepository);
    }
}
