package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSeason;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Season;
import com.cricketlegend.dto.LeagueSeasonDatesDto;
import com.cricketlegend.dto.UpdateLeagueSeasonDatesRequest;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.LeagueDatesExcludeMatchesException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LeagueSeasonMapper;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.LeagueSeasonRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchRepository.OutsideDatesSummary;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.service.impl.LeagueSeasonDatesServiceImpl;
import com.cricketlegend.service.support.ServerClock;
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
import org.mapstruct.factory.Mappers;

/** docs/specs/111-league-season-dates.md: the upsert, its validation, the 409 and the cross-club 404. */
@ExtendWith(MockitoExtension.class)
class LeagueSeasonDatesServiceImplTest {

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private SeasonRepository seasonRepository;

    @Mock
    private LeagueSeasonRepository leagueSeasonRepository;

    @Mock
    private MatchRepository matchRepository;

    private LeagueSeasonDatesServiceImpl service;
    private final UUID clubId = UUID.randomUUID();
    private final UUID leagueId = UUID.randomUUID();
    private final UUID seasonId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new LeagueSeasonDatesServiceImpl(
                leagueRepository, seasonRepository, leagueSeasonRepository, matchRepository,
                Mappers.getMapper(LeagueSeasonMapper.class));
    }

    private void ownLeagueAndSeason() {
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(League.builder().id(leagueId).clubId(clubId)
                .name("L").source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build()));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(Season.builder().id(seasonId).clubId(clubId)
                .label("2026/27").startDate(LocalDate.of(2026, 9, 1)).endDate(LocalDate.of(2027, 8, 31)).build()));
    }

    private static OutsideDatesSummary outside(long count, Instant earliest, Instant latest) {
        return new OutsideDatesSummary() {
            public long getMatchCount() { return count; }
            public Instant getEarliest() { return earliest; }
            public Instant getLatest() { return latest; }
        };
    }

    private static Instant at(int year, int month, int day) {
        return LocalDate.of(year, month, day).atTime(10, 0).atZone(java.time.ZoneId.systemDefault()).toInstant();
    }

    private static UpdateLeagueSeasonDatesRequest request(LocalDate start, LocalDate end) {
        return new UpdateLeagueSeasonDatesRequest(start, end);
    }

    @Test
    void getReturnsTheDatesAnd404WhenNoneAreSet() {
        ownLeagueAndSeason();
        when(leagueSeasonRepository.findByLeagueIdAndSeasonId(leagueId, seasonId)).thenReturn(Optional.of(
                LeagueSeason.builder().leagueId(leagueId).seasonId(seasonId).startDate(LocalDate.of(2026, 9, 1))
                        .endDate(LocalDate.of(2027, 7, 31)).build()));
        assertThat(service.get(clubId, leagueId, seasonId))
                .isEqualTo(new LeagueSeasonDatesDto(LocalDate.of(2026, 9, 1), LocalDate.of(2027, 7, 31)));

        when(leagueSeasonRepository.findByLeagueIdAndSeasonId(leagueId, seasonId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.get(clubId, leagueId, seasonId)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void updateCreatesTheRowWhenNoneExistsAndChecksTheMatchesAgainstTheDayBounds() {
        ownLeagueAndSeason();
        when(matchRepository.summariseOutsideDates(any(), any(), any(), any())).thenReturn(outside(0, null, null));
        when(leagueSeasonRepository.findByLeagueIdAndSeasonId(leagueId, seasonId)).thenReturn(Optional.empty());
        ArgumentCaptor<LeagueSeason> saved = ArgumentCaptor.forClass(LeagueSeason.class);
        when(leagueSeasonRepository.save(saved.capture())).thenAnswer(invocation -> saved.getValue());
        UUID person = UUID.randomUUID();

        LeagueSeasonDatesDto dto = service.update(
                clubId, leagueId, seasonId, request(LocalDate.of(2026, 9, 1), LocalDate.of(2027, 7, 31)), person);

        assertThat(dto.startDate()).isEqualTo(LocalDate.of(2026, 9, 1));
        assertThat(saved.getValue().getLeagueId()).isEqualTo(leagueId);
        assertThat(saved.getValue().getSeasonId()).isEqualTo(seasonId);
        assertThat(saved.getValue().getUpdatedBy()).isEqualTo(person);
        verify(matchRepository).summariseOutsideDates(
                leagueId, seasonId, ServerClock.startOfDay(LocalDate.of(2026, 9, 1)),
                ServerClock.startOfDay(LocalDate.of(2027, 8, 1)));
    }

    @Test
    void updateReplacesTheExistingRowInPlace() {
        ownLeagueAndSeason();
        LeagueSeason existing = LeagueSeason.builder().id(UUID.randomUUID()).leagueId(leagueId).seasonId(seasonId)
                .startDate(LocalDate.of(2026, 9, 1)).endDate(LocalDate.of(2027, 7, 31)).build();
        when(matchRepository.summariseOutsideDates(any(), any(), any(), any())).thenReturn(outside(0, null, null));
        when(leagueSeasonRepository.findByLeagueIdAndSeasonId(leagueId, seasonId)).thenReturn(Optional.of(existing));
        when(leagueSeasonRepository.save(existing)).thenReturn(existing);

        service.update(clubId, leagueId, seasonId, request(LocalDate.of(2026, 8, 1), LocalDate.of(2027, 8, 31)), null);

        assertThat(existing.getStartDate()).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(existing.getEndDate()).isEqualTo(LocalDate.of(2027, 8, 31));
    }

    @Test
    void updateRefusesDatesThatExcludeActiveMatchesNamingTheCountAndTheEarliestAndLatestDates() {
        ownLeagueAndSeason();
        when(matchRepository.summariseOutsideDates(any(), any(), any(), any()))
                .thenReturn(outside(3, at(2026, 9, 12), at(2027, 8, 4)));

        assertThatThrownBy(() -> service.update(
                        clubId, leagueId, seasonId, request(LocalDate.of(2026, 10, 1), LocalDate.of(2027, 7, 31)), null))
                .isInstanceOf(LeagueDatesExcludeMatchesException.class)
                .isInstanceOf(ConflictException.class)
                .hasMessage("3 matches of this league fall outside these dates (the earliest on 12 Sep 2026, the latest on 4 Aug 2027).");
        verify(leagueSeasonRepository, never()).save(any());
    }

    @Test
    void updateNamesASingleExcludedMatchInTheSingular() {
        ownLeagueAndSeason();
        when(matchRepository.summariseOutsideDates(any(), any(), any(), any()))
                .thenReturn(outside(1, at(2026, 9, 12), at(2026, 9, 12)));

        assertThatThrownBy(() -> service.update(
                        clubId, leagueId, seasonId, request(LocalDate.of(2026, 10, 1), LocalDate.of(2027, 7, 31)), null))
                .hasMessage("1 match of this league falls outside these dates (on 12 Sep 2026).");
    }

    @Test
    void updateRefusesAStartAfterTheEndAndMissingDates() {
        ownLeagueAndSeason();

        assertThatThrownBy(() -> service.update(
                        clubId, leagueId, seasonId, request(LocalDate.of(2027, 8, 1), LocalDate.of(2027, 7, 31)), null))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.update(clubId, leagueId, seasonId, request(null, LocalDate.of(2027, 7, 31)), null))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.update(clubId, leagueId, seasonId, request(LocalDate.of(2027, 7, 31), null), null))
                .isInstanceOf(ValidationException.class);
        verify(matchRepository, never()).summariseOutsideDates(any(), any(), any(), any());
    }

    @Test
    void aStartEqualToTheEndIsAllowed() {
        ownLeagueAndSeason();
        when(matchRepository.summariseOutsideDates(any(), any(), any(), any())).thenReturn(outside(0, null, null));
        when(leagueSeasonRepository.findByLeagueIdAndSeasonId(leagueId, seasonId)).thenReturn(Optional.empty());
        when(leagueSeasonRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        LeagueSeasonDatesDto dto = service.update(
                clubId, leagueId, seasonId, request(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 1)), null);

        assertThat(dto.endDate()).isEqualTo(LocalDate.of(2026, 9, 1));
    }

    @Test
    void anotherClubsLeagueOrSeasonIs404ForBothMethods() {
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(League.builder().id(leagueId)
                .clubId(UUID.randomUUID()).name("L").source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build()));

        assertThatThrownBy(() -> service.get(clubId, leagueId, seasonId)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.update(
                        clubId, leagueId, seasonId, request(LocalDate.of(2026, 9, 1), LocalDate.of(2027, 7, 31)), null))
                .isInstanceOf(NotFoundException.class);

        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(League.builder().id(leagueId).clubId(clubId)
                .name("L").source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build()));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(Season.builder().id(seasonId)
                .clubId(UUID.randomUUID()).label("x").startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).build()));
        assertThatThrownBy(() -> service.get(clubId, leagueId, seasonId)).isInstanceOf(NotFoundException.class);
    }
}
