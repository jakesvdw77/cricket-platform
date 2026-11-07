package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.AwardType;
import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultDetailLevel;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultStatus;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.BattingEntryDto;
import com.cricketlegend.dto.BowlingEntryDto;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardPageInfo;
import com.cricketlegend.dto.MatchAwardDto;
import com.cricketlegend.dto.MatchResultDto;
import com.cricketlegend.dto.MyResultDto;
import com.cricketlegend.dto.MyResultFiltersDto;
import com.cricketlegend.dto.MyResultListDto;
import com.cricketlegend.dto.MyResultRowDto;
import com.cricketlegend.dto.MyResultSummaryDto;
import com.cricketlegend.dto.PlayerMatchListDto;
import com.cricketlegend.dto.PlayerMatchRowDto;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchAwards;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchResult;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchTeam;
import com.cricketlegend.dto.PlayerStatsDto;
import com.cricketlegend.dto.PlayerStatsFilterOptionsDto;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ScorecardDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.PlayerMatchListService;
import com.cricketlegend.service.PlayerStatsService;
import com.cricketlegend.service.PlayerStatsService.PlayerStatsCombo;
import com.cricketlegend.service.ResultService;
import com.cricketlegend.service.ScorecardService;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.MyPlayerAccess;
import com.cricketlegend.service.support.StatsScope;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.RecordComponent;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/145 rules in {@link MyResultServiceImpl}, plain Mockito: the club and player come from the held player (never
 * the request), the counting is delegated, a match outside the player's shown rows is a 404, names are in full, and no
 * result id or profile id leaves. Who may call at all is {@code MyPlayerAccess}, covered by the integration tests.
 */
class MyResultServiceImplTest {

    private final UUID clubId = UUID.randomUUID();
    private final UUID profileId = UUID.randomUUID();
    private final UUID resultId = UUID.randomUUID();
    private final UUID matchId = UUID.randomUUID();
    private final UUID teamId = UUID.randomUUID();
    private final UUID leagueId = UUID.randomUUID();

    private final MyPlayerAccess access = mock(MyPlayerAccess.class);
    private final PlayerMatchListService matchListService = mock(PlayerMatchListService.class);
    private final PlayerStatsService statsService = mock(PlayerStatsService.class);
    private final ResultService resultService = mock(ResultService.class);
    private final ScorecardService scorecardService = mock(ScorecardService.class);
    private final SeasonRepository seasonRepository = mock(SeasonRepository.class);
    private final TeamRepository teamRepository = mock(TeamRepository.class);
    private final LeagueRepository leagueRepository = mock(LeagueRepository.class);
    private final Authentication authentication = mock(Authentication.class);

    private MyResultServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new MyResultServiceImpl(access, matchListService, statsService, resultService, scorecardService,
                seasonRepository, teamRepository, leagueRepository);
        PlayerProfile profile = PlayerProfile.builder().id(profileId).clubId(clubId).active(true).build();
        when(access.resolve(authentication, "key")).thenReturn(new HeldPlayer("key", null, null, profile, null));
    }

    // ---- fixtures ----

    private PlayerMatchRowDto row(UUID match) {
        return new PlayerMatchRowDto(match, resultId, Instant.parse("2026-03-01T10:00:00Z"),
                List.of(new PlayerMatchTeam("HOME", teamId, "Riverside 1st XI")), "Hilltop CC", false, leagueId, "Premier",
                "LEAGUE", PlayerMatchResult.WON, 6, true, false, null, null, null, new PlayerMatchAwards(1, 0));
    }

    private static PlayerMatchListDto page(List<PlayerMatchRowDto> rows) {
        return new PlayerMatchListDto(null, null, new LeaderboardPageInfo(0, 20, rows.size(), false), rows);
    }

    private MatchResultDto header() {
        return new MatchResultDto(resultId, clubId, matchId, ResultStatus.PUBLISHED, ResultDetailLevel.FULL,
                ResultOutcomeType.WON, ResultDecidedBy.REGULAR, ResultSide.HOME, ResultMarginType.RUNS, 24, null, null,
                null, 6, null, null, null, "Main Oval", null, "MANUAL", null, Instant.now(), UUID.randomUUID(), true,
                Instant.now(), Instant.now(), null,
                List.of(new InningsDto(1, InningsKind.REGULAR, ResultSide.HOME, 212, 6, 240, 10, false, "40.0"),
                        new InningsDto(2, InningsKind.REGULAR, ResultSide.AWAY, 188, 10, 230, 8, true, "38.2")),
                true, true);
    }

    // ---- ownership and scope ----

    @Test
    void theClubAndThePlayerComeFromTheHeldPlayerAndTheScopeIsPassedThrough() {
        UUID season = UUID.randomUUID();
        when(matchListService.listForHeldPlayer(clubId, profileId, season, leagueId, teamId, null,
                StatsScope.Competition.LEAGUE, 2, 10)).thenReturn(page(List.of()));

        MyResultListDto out = service.list(authentication, "key", season, teamId, leagueId, "LEAGUE", 2, 10);

        assertThat(out.rows()).isEmpty();
        assertThat(out.scope().seasonId()).isEqualTo(season);
        assertThat(out.scope().teamId()).isEqualTo(teamId);
        assertThat(out.scope().leagueId()).isEqualTo(leagueId);
        verify(access).resolve(authentication, "key");
        verifyNoInteractions(resultService); // an empty page needs no result headers
    }

    @Test
    void aRefusedCallerReadsNothing() {
        when(access.resolve(authentication, "nope")).thenThrow(new NotFoundException("Player not found"));
        when(access.resolve(authentication, "suspended")).thenThrow(new AccessDeniedException("suspended"));
        UUID any = UUID.randomUUID();

        for (String key : List.of("nope", "suspended")) {
            Class<? extends Throwable> expected = key.equals("nope") ? NotFoundException.class : AccessDeniedException.class;
            assertThatThrownBy(() -> service.list(authentication, key, null, null, null, null, null, null)).isInstanceOf(expected);
            assertThatThrownBy(() -> service.summary(authentication, key, null, null, null, null)).isInstanceOf(expected);
            assertThatThrownBy(() -> service.filters(authentication, key)).isInstanceOf(expected);
            assertThatThrownBy(() -> service.get(authentication, key, any)).isInstanceOf(expected);
        }
        verifyNoInteractions(matchListService, statsService, resultService, scorecardService);
    }

    @Test
    void aBadCompetitionIsAValidationErrorBeforeAnyRead() {
        assertThatThrownBy(() -> service.list(authentication, "key", null, null, null, "CUP", null, null))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.summary(authentication, "key", null, null, null, "CUP"))
                .isInstanceOf(ValidationException.class);
        verifyNoInteractions(matchListService, statsService, resultService);
    }

    // ---- list mapping ----

    @Test
    void aRowCarriesTheCountedFiguresAndTheMatchHeaderWordsAndNoResultId() {
        PlayerMatchRowDto counted = row(matchId);
        when(matchListService.listForHeldPlayer(any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(page(List.of(counted)));
        when(resultService.publishedResults(eq(clubId), eq(List.of(matchId)))).thenReturn(Map.of(matchId, header()));

        MyResultRowDto mapped = service.list(authentication, "key", null, null, null, null, null, null).rows().get(0);

        assertThat(mapped.matchId()).isEqualTo(matchId);
        assertThat(mapped.homeName()).isEqualTo("Riverside 1st XI"); // our team on the home side
        assertThat(mapped.awayName()).isEqualTo("Hilltop CC"); // the opposition on the other
        assertThat(mapped.homeScore()).isEqualTo("212/6 (40.0)");
        assertThat(mapped.awayScore()).isEqualTo("188/10 (38.2)");
        assertThat(mapped.resultLine()).isEqualTo("Riverside 1st XI won by 24 runs");
        assertThat(mapped.result()).isEqualTo(PlayerMatchResult.WON);
        assertThat(mapped.awards()).isEqualTo(counted.awards());
        assertThat(mapped.batting()).isSameAs(counted.batting());
        assertThat(mapped.leagueName()).isEqualTo("Premier");
        assertThat(mapped.competition()).isEqualTo("LEAGUE");
        assertThat(componentNames(MyResultRowDto.class)).doesNotContain("resultId", "id", "playerId", "profileId", "clubId");
    }

    @Test
    void aRowWhoseHeaderCannotBeReadHasEmptyScoresAndNoResultLine() {
        when(matchListService.listForHeldPlayer(any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(page(List.of(row(matchId))));
        when(resultService.publishedResults(any(), any())).thenReturn(Map.of());

        MyResultRowDto mapped = service.list(authentication, "key", null, null, null, null, null, null).rows().get(0);

        assertThat(mapped.homeScore()).isEmpty();
        assertThat(mapped.awayScore()).isEmpty();
        assertThat(mapped.resultLine()).isNull();
    }

    // ---- summary ----

    @Test
    void theSummaryTilesAreThe103FiguresAndTheStreakIsTheNewestFiveRows() {
        PlayerStatsDto stats = mock(PlayerStatsDto.class, Answers.RETURNS_DEEP_STUBS);
        when(stats.basis().matchesCounted()).thenReturn(7L);
        when(stats.record().won()).thenReturn(4L);
        when(stats.record().lost()).thenReturn(2L);
        when(stats.record().tied()).thenReturn(1L);
        when(stats.batting().runs()).thenReturn(321L);
        when(stats.bowling().wickets()).thenReturn(9L);
        when(stats.fielding().catches()).thenReturn(3L);
        when(stats.awards().playerOfTheMatch()).thenReturn(2L);
        when(statsService.getForHeldPlayer(clubId, profileId, null, null, null, null)).thenReturn(stats);
        when(matchListService.listForHeldPlayer(clubId, profileId, null, null, null, null, null, 0, 5))
                .thenReturn(page(List.of(row(matchId))));
        when(resultService.publishedResults(any(), any())).thenReturn(Map.of(matchId, header()));

        MyResultSummaryDto out = service.summary(authentication, "key", null, null, null, null);

        assertThat(out.matches()).isEqualTo(7);
        assertThat(out.won()).isEqualTo(4);
        assertThat(out.lost()).isEqualTo(2);
        assertThat(out.tied()).isEqualTo(1);
        assertThat(out.runs()).isEqualTo(321);
        assertThat(out.wickets()).isEqualTo(9);
        assertThat(out.catches()).isEqualTo(3);
        assertThat(out.playerOfTheMatch()).isEqualTo(2);
        assertThat(out.lastFive()).hasSize(1);
        verify(matchListService).listForHeldPlayer(clubId, profileId, null, null, null, null, null, 0, 5);
    }

    // ---- one result ----

    @Test
    void aMatchOutsideThePlayersCountedRowsIsNotFoundAndNothingElseIsRead() {
        UUID other = UUID.randomUUID();
        when(matchListService.listForHeldPlayer(clubId, profileId, null, null, null, other, null, 0, 1))
                .thenReturn(page(List.of()));

        assertThatThrownBy(() -> service.get(authentication, "key", other)).isInstanceOf(NotFoundException.class);

        verify(resultService, never()).visibleResult(any(), any());
        verifyNoInteractions(scorecardService);
    }

    @Test
    void theScorecardShowsEveryNameInFullMarksTheHeldPlayerAndLeaksNoId() throws Exception {
        UUID aliceRp = UUID.randomUUID();
        UUID juniorRp = UUID.randomUUID();
        UUID oppRp = UUID.randomUUID();
        UUID juniorProfile = UUID.randomUUID();
        when(matchListService.listForHeldPlayer(clubId, profileId, null, null, null, matchId, null, 0, 1))
                .thenReturn(page(List.of(row(matchId))));
        when(resultService.visibleResult(clubId, matchId)).thenReturn(header());
        when(resultService.publishedResults(any(), any())).thenReturn(Map.of(matchId, header()));
        List<ResultPlayerDto> players = List.of(
                new ResultPlayerDto(aliceRp, "a", ResultSide.HOME, profileId, null, null, null, false, false, "Alice", "Adams", false, null, null),
                new ResultPlayerDto(juniorRp, "j", ResultSide.HOME, juniorProfile, null, null, null, false, false, "Jamie", "Junior", false, null, null),
                new ResultPlayerDto(oppRp, "o", ResultSide.AWAY, null, "Olly Opponent", null, null, false, true, null, null, false, null, null));
        List<BattingEntryDto> batting = List.of(
                new BattingEntryDto(UUID.randomUUID(), ResultSide.HOME, InningsKind.REGULAR, aliceRp, null, 1,
                        DismissalType.BOWLED, 50, 40, 5, 1, oppRp.toString(), null, null, null, null),
                new BattingEntryDto(UUID.randomUUID(), ResultSide.HOME, InningsKind.REGULAR, juniorRp, null, 11,
                        DismissalType.DID_NOT_BAT, null, null, null, null, null, null, null, null, null));
        List<BowlingEntryDto> bowling = List.of(
                new BowlingEntryDto(UUID.randomUUID(), ResultSide.AWAY, InningsKind.REGULAR, aliceRp, null, 1, 24, 1, 20, 3,
                        2, 0, 10, null, null, null, null, null));
        List<MatchAwardDto> awards = List.of(
                new MatchAwardDto(UUID.randomUUID(), AwardType.PLAYER_OF_MATCH, ResultSide.HOME, aliceRp, null, null, "Alice Adams"),
                new MatchAwardDto(UUID.randomUUID(), AwardType.TEAM_PLAYER_OF_MATCH, ResultSide.AWAY, null, null, " ", null));
        when(scorecardService.readForPlayers(clubId, matchId))
                .thenReturn(new ScorecardDto(players, batting, bowling, List.of(), awards, List.of(), List.of()));

        MyResultDto out = service.get(authentication, "key", matchId);

        assertThat(out.venue()).isEqualTo("Main Oval");
        assertThat(out.mine().matchId()).isEqualTo(matchId);
        assertThat(out.innings()).hasSize(2);
        MyResultDto.Innings home = out.innings().get(0);
        assertThat(home.battingTeamName()).isEqualTo("Riverside 1st XI");
        assertThat(home.batting()).hasSize(1);
        assertThat(home.batting().get(0).name()).isEqualTo("Alice Adams");
        assertThat(home.batting().get(0).mine()).isTrue();
        assertThat(home.batting().get(0).bowler()).isEqualTo("Olly Opponent");
        assertThat(home.didNotBat()).containsExactly("Jamie Junior"); // a junior in full, Decision 7
        MyResultDto.Innings away = out.innings().get(1);
        assertThat(away.battingTeamName()).isEqualTo("Hilltop CC");
        assertThat(home.bowling()).isEmpty(); // Alice bowled in the AWAY innings, not the home one
        assertThat(away.bowling()).hasSize(1);
        assertThat(away.bowling().get(0).name()).isEqualTo("Alice Adams");
        assertThat(away.bowling().get(0).mine()).isTrue();
        assertThat(away.bowling().get(0).overs()).isEqualTo("4.0");
        assertThat(awards(out)).containsExactly("Alice Adams"); // an award without a name is dropped

        String json = new ObjectMapper().findAndRegisterModules().writeValueAsString(out);
        for (UUID id : List.of(aliceRp, juniorRp, oppRp, juniorProfile, profileId, resultId, clubId)) {
            assertThat(json).doesNotContain(id.toString());
        }
        assertThat(json).doesNotContain("resultId").doesNotContain("playerProfileId");
    }

    private static List<String> awards(MyResultDto dto) {
        return dto.awards().stream().map(MyResultDto.Award::playerName).toList();
    }

    // ---- filters ----

    @Test
    void filtersOfferOnlyValuesWithDataSortedWithTheCurrentSeasonAndTheCombos() {
        UUID current = UUID.randomUUID();
        UUID old = UUID.randomUUID();
        UUID empty = UUID.randomUUID();
        LocalDate today = LocalDate.now();
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of(
                Season.builder().id(old).clubId(clubId).label("2024").startDate(today.minusYears(2)).endDate(today.minusYears(2).plusDays(200)).createdAt(Instant.now()).build(),
                Season.builder().id(current).clubId(clubId).label("2026").startDate(today.minusDays(30)).endDate(today.plusDays(30)).createdAt(Instant.now()).build(),
                Season.builder().id(empty).clubId(clubId).label("2030").startDate(today.plusYears(4)).endDate(today.plusYears(4).plusDays(10)).createdAt(Instant.now()).build()));
        UUID teamB = UUID.randomUUID();
        UUID unused = UUID.randomUUID();
        when(teamRepository.findByClubId(clubId)).thenReturn(List.of(
                Team.builder().id(teamId).clubId(clubId).name("zebras").build(),
                Team.builder().id(teamB).clubId(clubId).name("Alphas").build(),
                Team.builder().id(unused).clubId(clubId).name("No Data").build()));
        when(leagueRepository.findByClubId(clubId)).thenReturn(List.of(
                League.builder().id(leagueId).clubId(clubId).name("Premier").build(),
                League.builder().id(UUID.randomUUID()).clubId(clubId).name("Unused").build()));
        when(statsService.filterOptionsForHeldPlayer(clubId, profileId)).thenReturn(new PlayerStatsFilterOptionsDto(
                List.of(old, current), List.of(leagueId), List.of(teamId, teamB), List.of(), List.of("LEAGUE")));
        when(statsService.comboOptionsForHeldPlayer(clubId, profileId)).thenReturn(List.of(
                new PlayerStatsCombo(current, leagueId, teamId), new PlayerStatsCombo(old, null, teamB)));

        MyResultFiltersDto out = service.filters(authentication, "key");

        assertThat(out.currentSeasonId()).isEqualTo(current);
        assertThat(out.seasons()).extracting(MyResultFiltersDto.Option::name).containsExactly("2026", "2024");
        assertThat(out.teams()).extracting(MyResultFiltersDto.Option::name).containsExactly("Alphas", "zebras");
        assertThat(out.leagues()).extracting(MyResultFiltersDto.Option::name).containsExactly("Premier");
        assertThat(out.combos()).containsExactly(
                new MyResultFiltersDto.Combo(current, leagueId, teamId), new MyResultFiltersDto.Combo(old, null, teamB));
    }

    @Test
    void whenTheCurrentSeasonHasNoDataTheNewestSeasonWithDataIsTheDefaultAndNoDataIsNull() {
        UUID current = UUID.randomUUID();
        UUID old = UUID.randomUUID();
        LocalDate today = LocalDate.now();
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of(
                Season.builder().id(old).clubId(clubId).label("2024").startDate(today.minusYears(2)).endDate(today.minusYears(2).plusDays(200)).createdAt(Instant.now()).build(),
                Season.builder().id(current).clubId(clubId).label("2026").startDate(today.minusDays(30)).endDate(today.plusDays(30)).createdAt(Instant.now()).build()));
        when(teamRepository.findByClubId(clubId)).thenReturn(List.of());
        when(leagueRepository.findByClubId(clubId)).thenReturn(List.of());
        when(statsService.comboOptionsForHeldPlayer(clubId, profileId)).thenReturn(List.of());
        when(statsService.filterOptionsForHeldPlayer(clubId, profileId)).thenReturn(
                new PlayerStatsFilterOptionsDto(List.of(old), List.of(), List.of(), List.of(), List.of()));

        assertThat(service.filters(authentication, "key").currentSeasonId()).isEqualTo(old);

        when(statsService.filterOptionsForHeldPlayer(clubId, profileId)).thenReturn(
                new PlayerStatsFilterOptionsDto(List.of(), List.of(), List.of(), List.of(), List.of()));
        MyResultFiltersDto none = service.filters(authentication, "key");
        assertThat(none.currentSeasonId()).isNull();
        assertThat(none.seasons()).isEmpty();
    }

    private static List<String> componentNames(Class<? extends Record> type) {
        return Arrays.stream(type.getRecordComponents()).map(RecordComponent::getName).toList();
    }
}
