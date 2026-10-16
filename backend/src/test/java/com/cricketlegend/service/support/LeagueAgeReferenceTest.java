package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Season;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchRepository.LeagueSeasonFirstMatch;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.service.support.LeagueAgeReference.Key;
import com.cricketlegend.service.support.LeagueAgeReference.Reference;
import com.cricketlegend.service.support.LeagueAgeReference.Source;
import com.cricketlegend.service.support.LeagueAgeReference.StartSource;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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

/**
 * docs/specs/110-league-age-cutoff-day-and-month.md: the one rule for the date ages are judged on. The earliest active
 * match comes from {@code MatchRepository.findFirstMatchDates} (which only counts active matches; that is covered by
 * {@code LeagueAgeReferenceIntegrationTest}).
 */
@ExtendWith(MockitoExtension.class)
class LeagueAgeReferenceTest {

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private SeasonRepository seasonRepository;

    private LeagueAgeReference reference;
    private final UUID seasonId = UUID.randomUUID();
    private final Season season = Season.builder().id(seasonId).clubId(UUID.randomUUID()).label("2026/27")
            .startDate(LocalDate.of(2026, 9, 1)).endDate(LocalDate.of(2027, 8, 31)).build();

    @BeforeEach
    void setUp() {
        reference = new LeagueAgeReference(matchRepository, seasonRepository);
    }

    private static League league(Integer month, Integer day) {
        return League.builder().id(UUID.randomUUID()).clubId(UUID.randomUUID()).name("L").ageCutoffMonth(month)
                .ageCutoffDay(day).build();
    }

    private static Instant on(int year, int month, int day) {
        return LocalDate.of(year, month, day).atTime(10, 0).atZone(ZoneId.systemDefault()).toInstant();
    }

    private static LeagueSeasonFirstMatch first(League league, UUID seasonId, Instant at) {
        return new LeagueSeasonFirstMatch() {
            public UUID getLeagueId() { return league.getId(); }
            public UUID getSeasonId() { return seasonId; }
            public Instant getFirstMatchDate() { return at; }
        };
    }

    private void firstMatchAt(League league, Instant at) {
        when(matchRepository.findFirstMatchDates(any(), any())).thenReturn(List.of(first(league, seasonId, at)));
    }

    @Test
    void aCutoffIsTakenInTheCalendarYearOfTheLeagueStart() {
        League club = league(12, 31);
        firstMatchAt(club, on(2026, 9, 5));

        Reference result = reference.of(club, season);

        assertThat(result).isEqualTo(new Reference(
                LocalDate.of(2026, 12, 31), Source.CUTOFF, LocalDate.of(2026, 9, 5), StartSource.FIRST_MATCH));
    }

    @Test
    void aCupStartingInTheNextYearIsJudgedOnThatYearsCutoff() {
        League cup = league(12, 31);
        firstMatchAt(cup, on(2027, 3, 1));

        assertThat(reference.of(cup, season).referenceDate()).isEqualTo(LocalDate.of(2027, 12, 31));
    }

    @Test
    void aWinterLeagueWithNoCutoffIsJudgedOnItsFirstMatchDay() {
        League winter = league(null, null);
        firstMatchAt(winter, on(2027, 7, 10));

        Reference result = reference.of(winter, season);

        assertThat(result).isEqualTo(new Reference(
                LocalDate.of(2027, 7, 10), Source.LEAGUE_START, LocalDate.of(2027, 7, 10), StartSource.FIRST_MATCH));
    }

    @Test
    void withNoMatchesTheSeasonStartIsTheLeagueStart() {
        League none = league(null, null);
        League withCutoff = league(12, 31);

        assertThat(reference.of(none, season)).isEqualTo(new Reference(
                LocalDate.of(2026, 9, 1), Source.LEAGUE_START, LocalDate.of(2026, 9, 1), StartSource.SEASON_START));
        assertThat(reference.of(withCutoff, season)).isEqualTo(new Reference(
                LocalDate.of(2026, 12, 31), Source.CUTOFF, LocalDate.of(2026, 9, 1), StartSource.SEASON_START));
    }

    @Test
    void the29thOfFebruaryBecomesThe28thInAYearWithoutOne() {
        League leap = league(2, 29);
        firstMatchAt(leap, on(2027, 5, 1));
        assertThat(reference.of(leap, season).referenceDate()).isEqualTo(LocalDate.of(2027, 2, 28));
    }

    @Test
    void the29thOfFebruaryIsKeptInALeapYear() {
        League leap = league(2, 29);
        firstMatchAt(leap, on(2028, 5, 1));
        assertThat(reference.of(leap, season).referenceDate()).isEqualTo(LocalDate.of(2028, 2, 29));
    }

    @Test
    void aMatchOfAnotherLeagueOrSeasonInTheResultIsIgnored() {
        League mine = league(null, null);
        League other = league(null, null);
        when(matchRepository.findFirstMatchDates(any(), any()))
                .thenReturn(List.of(first(other, seasonId, on(2026, 11, 1)), first(mine, UUID.randomUUID(), on(2026, 12, 1))));

        assertThat(reference.of(mine, season).leagueStartSource()).isEqualTo(StartSource.SEASON_START);
    }

    @Test
    void ofSeasonIdThrowsNotFoundForAnUnknownSeason() {
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reference.of(league(null, null), seasonId)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void theBatchComputesEveryPairWithOneMatchQueryAndOneSeasonQuery() {
        Season next = Season.builder().id(UUID.randomUUID()).clubId(season.getClubId()).label("2027/28")
                .startDate(LocalDate.of(2027, 9, 1)).endDate(LocalDate.of(2028, 8, 31)).build();
        League club = league(12, 31);
        League winter = league(null, null);
        when(seasonRepository.findAllById(any())).thenReturn(List.of(season, next));
        when(matchRepository.findFirstMatchDates(any(), any())).thenReturn(List.of(
                first(club, seasonId, on(2026, 9, 5)), first(winter, seasonId, on(2027, 7, 10))));

        Map<Key, Reference> result = reference.ofAll(
                Map.of(club.getId(), club, winter.getId(), winter),
                Set.of(new Key(club.getId(), seasonId), new Key(winter.getId(), seasonId), new Key(club.getId(), next.getId())));

        assertThat(result.get(new Key(club.getId(), seasonId)).referenceDate()).isEqualTo(LocalDate.of(2026, 12, 31));
        assertThat(result.get(new Key(winter.getId(), seasonId)).referenceDate()).isEqualTo(LocalDate.of(2027, 7, 10));
        Reference noMatches = result.get(new Key(club.getId(), next.getId()));
        assertThat(noMatches.referenceDate()).isEqualTo(LocalDate.of(2027, 12, 31));
        assertThat(noMatches.leagueStartSource()).isEqualTo(StartSource.SEASON_START);
        verify(matchRepository, times(1)).findFirstMatchDates(any(), any());
        verify(seasonRepository, times(1)).findAllById(any());
    }

    @Test
    void theBatchOfNothingMakesNoQueries() {
        assertThat(reference.ofAll(Map.of(), Set.of())).isEmpty();
        org.mockito.Mockito.verifyNoInteractions(matchRepository, seasonRepository);
    }
}
