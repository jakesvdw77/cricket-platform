package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueAffiliation;
import com.cricketlegend.domain.LeagueSeason;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.LeagueTeam;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.MatchResultDto;
import com.cricketlegend.dto.MyLeagueDto;
import com.cricketlegend.dto.MyLeagueSummaryDto;
import com.cricketlegend.dto.MyLeaguesDto;
import com.cricketlegend.dto.MyFieldDto;
import com.cricketlegend.dto.ShareSettingsDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.MyLeagueMapper;
import com.cricketlegend.repository.LeagueAffiliationRepository;
import com.cricketlegend.repository.LeaguePlayingConditionsRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.LeagueSeasonRepository;
import com.cricketlegend.repository.LeagueTeamRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.ClubShareSettingsService;
import com.cricketlegend.service.MyFieldService;
import com.cricketlegend.service.ResultService;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.MyPlayerAccess;
import java.lang.reflect.RecordComponent;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.springframework.security.core.Authentication;

/**
 * Unit tests for docs/specs/123-player-hub-leagues.md's rules in {@link MyLeagueServiceImpl}: leagues derived from the
 * held player's squad rows plus affiliations for the season, the {@code mine} flag, published-only results, inactive
 * leagues and teams hidden, no contacts, the seasons list and fields from the match's {@code playingAreaId} only.
 * Plain Mockito with in-memory stand-ins for the repositories (no Spring); access itself ({@code MyPlayerAccess}) is
 * covered by the integration test.
 */
class MyLeagueServiceImplTest {

    private final UUID clubId = UUID.randomUUID();
    private final UUID profileId = UUID.randomUUID();

    private final List<Season> seasons = new ArrayList<>();
    private final List<TeamSquadMember> squad = new ArrayList<>();
    private final List<Team> teams = new ArrayList<>();
    private final List<League> leagues = new ArrayList<>();
    private final List<LeagueAffiliation> affiliations = new ArrayList<>();
    private final List<LeagueTeam> leagueTeams = new ArrayList<>();
    private final List<Match> matches = new ArrayList<>();
    private final List<LeagueSeason> leagueSeasons = new ArrayList<>();
    private Map<UUID, MatchResultDto> published = Map.of();

    private final MyPlayerAccess access = mock(MyPlayerAccess.class);
    private final SeasonRepository seasonRepository = mock(SeasonRepository.class);
    private final TeamSquadMemberRepository squadRepository = mock(TeamSquadMemberRepository.class);
    private final TeamRepository teamRepository = mock(TeamRepository.class);
    private final LeagueRepository leagueRepository = mock(LeagueRepository.class);
    private final LeagueAffiliationRepository affiliationRepository = mock(LeagueAffiliationRepository.class);
    private final LeagueTeamRepository leagueTeamRepository = mock(LeagueTeamRepository.class);
    private final LeaguePlayingConditionsRepository conditionsRepository = mock(LeaguePlayingConditionsRepository.class);
    private final LeagueSeasonRepository leagueSeasonRepository = mock(LeagueSeasonRepository.class);
    private final MatchRepository matchRepository = mock(MatchRepository.class);
    private final ResultService resultService = mock(ResultService.class);
    private final ClubShareSettingsService shareSettings = mock(ClubShareSettingsService.class);
    private final MyFieldService fieldService = mock(MyFieldService.class);
    private final Authentication authentication = mock(Authentication.class);

    private MyLeagueServiceImpl service;
    private Season current;
    private Team myTeam;
    private League league;

    @BeforeEach
    void setUp() {
        service = new MyLeagueServiceImpl(access, seasonRepository, squadRepository, teamRepository, leagueRepository,
                affiliationRepository, leagueTeamRepository, conditionsRepository, leagueSeasonRepository, matchRepository,
                resultService, Mappers.getMapper(MyLeagueMapper.class), shareSettings, fieldService);

        PlayerProfile profile = PlayerProfile.builder().id(profileId).clubId(clubId).active(true).build();
        when(access.resolve(authentication, "key")).thenReturn(new HeldPlayer("key", null, null, profile, null));
        when(seasonRepository.findByClubId(clubId)).thenAnswer(i -> List.copyOf(seasons));
        when(squadRepository.findByPlayerProfileId(profileId)).thenAnswer(i -> List.copyOf(squad));
        when(teamRepository.findAllById(any())).thenAnswer(i -> byIds(teams, i.getArgument(0), Team::getId));
        when(leagueRepository.findAllById(any())).thenAnswer(i -> byIds(leagues, i.getArgument(0), League::getId));
        when(affiliationRepository.findByTeamIdIn(any())).thenAnswer(i -> {
            Collection<UUID> ids = i.getArgument(0);
            return affiliations.stream().filter(a -> ids.contains(a.getTeamId())).toList();
        });
        when(affiliationRepository.findByLeagueIdInAndSeasonId(any(), any())).thenAnswer(i -> {
            Collection<UUID> ids = i.getArgument(0);
            UUID seasonId = i.getArgument(1);
            return affiliations.stream()
                    .filter(a -> ids.contains(a.getLeagueId()) && a.getSeasonId().equals(seasonId)).toList();
        });
        when(leagueTeamRepository.findByLeagueIdInAndSeasonIdAndActiveTrue(any(), any())).thenAnswer(i -> {
            Collection<UUID> ids = i.getArgument(0);
            UUID seasonId = i.getArgument(1);
            return leagueTeams.stream()
                    .filter(t -> ids.contains(t.getLeagueId()) && t.getSeasonId().equals(seasonId) && t.isActive()).toList();
        });
        when(matchRepository.summariseByLeagueForSeason(any(), any(), any())).thenReturn(List.of());
        when(matchRepository.findByClubIdAndLeagueIdAndSeasonIdAndActiveTrueOrderByMatchDateAscIdAsc(any(), any(), any()))
                .thenAnswer(i -> matches.stream()
                        .filter(m -> m.getLeagueId().equals(i.getArgument(1)) && m.getSeasonId().equals(i.getArgument(2)))
                        .toList());
        when(conditionsRepository.findByLeagueIdAndSeasonId(any(), any())).thenReturn(Optional.empty());
        when(leagueSeasonRepository.findByLeagueIdAndSeasonId(any(), any())).thenAnswer(i -> leagueSeasons.stream()
                .filter(d -> d.getLeagueId().equals(i.getArgument(0)) && d.getSeasonId().equals(i.getArgument(1)))
                .findFirst());
        when(resultService.publishedResults(eq(clubId), any())).thenAnswer(i -> {
            Collection<UUID> ids = i.getArgument(1);
            return published.entrySet().stream().filter(e -> ids.contains(e.getKey()))
                    .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        });
        when(shareSettings.get(clubId)).thenReturn(new ShareSettingsDto(false, Map.of("LEAGUE", List.of("FACEBOOK"))));
        when(fieldService.describe(eq(clubId), any())).thenReturn(List.of());

        current = season("2026", LocalDate.now().minusDays(30), LocalDate.now().plusDays(30));
        myTeam = team("Colts", clubId, true);
        league = league("Division 1", clubId, true);
        squad(myTeam, current);
        affiliate(league, myTeam, current);
    }

    // --- list ---

    @Test
    void listReturnsTheLeagueOfASquadTeamAffiliatedForTheSeasonWithTheOwnTeamRefs() {
        MyLeaguesDto result = service.list(authentication, "key", null);

        assertThat(result.seasonId()).isEqualTo(current.getId());
        assertThat(result.leagues()).hasSize(1);
        MyLeagueSummaryDto card = result.leagues().get(0);
        assertThat(card.id()).isEqualTo(league.getId());
        assertThat(card.myTeams()).extracting("name").containsExactly("Colts");
    }

    @Test
    void listSortsLeaguesByNameAndCountsActiveOwnTeamsPlusActiveRegisteredOpponents() {
        League alpha = league("alpha League", clubId, true);
        affiliate(alpha, myTeam, current);
        Team sibling = team("Sixes", clubId, true);
        affiliate(league, sibling, current);
        Team inactiveSibling = team("Gone", clubId, false);
        affiliate(league, inactiveSibling, current);
        leagueTeam(league, current, "Visitors", true);
        leagueTeam(league, current, "Retired", false);

        List<MyLeagueSummaryDto> cards = service.list(authentication, "key", null).leagues();

        assertThat(cards).extracting(MyLeagueSummaryDto::name).containsExactly("alpha League", "Division 1");
        // Colts + Sixes (own, active) + Visitors (registered, active); inactive ones do not count
        assertThat(cards.get(1).teamCount()).isEqualTo(3);
    }

    @Test
    void anInactiveLeagueIsHidden() {
        league.setActive(false);

        assertThat(service.list(authentication, "key", null).leagues()).isEmpty();
    }

    @Test
    void aLeagueOfAnotherClubIsHidden() {
        league.setClubId(UUID.randomUUID());

        assertThat(service.list(authentication, "key", null).leagues()).isEmpty();
    }

    @Test
    void anInactiveSquadTeamOrATeamOfAnotherClubGivesNoLeague() {
        myTeam.setActive(false);
        assertThat(service.list(authentication, "key", null).leagues()).isEmpty();

        myTeam.setActive(true);
        myTeam.setClubId(UUID.randomUUID());
        assertThat(service.list(authentication, "key", null).leagues()).isEmpty();
    }

    @Test
    void aTeamAffiliatedToALeagueButNotInThePlayersSquadThatSeasonGivesNothing() {
        Team other = team("Other XI", clubId, true);
        League otherLeague = league("Other League", clubId, true);
        affiliate(otherLeague, other, current);
        // the player is in myTeam's squad for a different season only
        Season past = season("2025", LocalDate.now().minusDays(500), LocalDate.now().minusDays(400));
        squad(other, past);

        assertThat(service.list(authentication, "key", null).leagues()).extracting(MyLeagueSummaryDto::name)
                .containsExactly("Division 1");
    }

    @Test
    void aSeasonSwitchReturnsThatSeasonsLeaguesAndTheSeasonsListIsNewestFirstLimitedToSeasonsWithLeaguesPlusCurrent() {
        Season past = season("2025", LocalDate.now().minusDays(500), LocalDate.now().minusDays(400));
        Season empty = season("2024", LocalDate.now().minusDays(900), LocalDate.now().minusDays(800));
        League pastLeague = league("Old League", clubId, true);
        squad(myTeam, past);
        affiliate(pastLeague, myTeam, past);

        MyLeaguesDto result = service.list(authentication, "key", past.getId());

        assertThat(result.seasonId()).isEqualTo(past.getId());
        assertThat(result.leagues()).extracting(MyLeagueSummaryDto::name).containsExactly("Old League");
        assertThat(result.seasons()).extracting("name").containsExactly("2026", "2025");
        assertThat(result.seasons()).extracting("current").containsExactly(true, false);
        assertThat(result.seasons()).extracting("id").doesNotContain(empty.getId());
    }

    @Test
    void aSeasonOfAnotherClubIsNotFound() {
        assertThatThrownBy(() -> service.list(authentication, "key", UUID.randomUUID()))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void aPlayerWithNoSquadRowsGetsAnEmptyListButStillTheCurrentSeason() {
        squad.clear();

        MyLeaguesDto result = service.list(authentication, "key", null);

        assertThat(result.leagues()).isEmpty();
        assertThat(result.seasons()).extracting("name").containsExactly("2026");
    }

    @Test
    void theCardCarriesNoContactFields() {
        assertThat(componentNames(MyLeagueSummaryDto.class))
                .containsExactlyInAnyOrder("id", "name", "logoUrl", "minAge", "maxAge", "teamCount", "myTeams",
                        "nextMatchDate", "matchCount");
    }

    // --- get ---

    @Test
    void getOfALeagueThePlayersTeamsAreNotInIsNotFound() {
        League foreign = league("Foreign", clubId, true);
        Team other = team("Other XI", clubId, true);
        affiliate(foreign, other, current);

        assertThatThrownBy(() -> service.get(authentication, "key", foreign.getId(), null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.get(authentication, "key", UUID.randomUUID(), null))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void getOfAnInactiveLeagueIsNotFound() {
        league.setActive(false);

        assertThatThrownBy(() -> service.get(authentication, "key", league.getId(), null))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void getWithAnotherSeasonTheTeamIsNotAffiliatedInIsNotFound() {
        Season past = season("2025", LocalDate.now().minusDays(500), LocalDate.now().minusDays(400));

        assertThatThrownBy(() -> service.get(authentication, "key", league.getId(), past.getId()))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void theScheduleHasEveryActiveMatchAndMineIsSetForHomeAndAwayButNotForOthers() {
        Team rival = team("Rivals", clubId, true);
        affiliate(league, rival, current);
        Team third = team("Third XI", clubId, true);
        affiliate(league, third, current);
        match(myTeam.getId(), null, "Visitors", 1, null);
        match(null, myTeam.getId(), null, 2, null);
        match(rival.getId(), third.getId(), null, 3, null);

        MyLeagueDto dto = service.get(authentication, "key", league.getId(), null);

        assertThat(dto.schedule()).hasSize(3);
        assertThat(dto.schedule()).extracting("mine").containsExactly(true, true, false);
        assertThat(dto.schedule().get(0).awayName()).isEqualTo("Visitors");
        assertThat(dto.schedule().get(1).homeName()).isEqualTo("TBC");
        assertThat(dto.schedule().get(1).awayName()).isEqualTo("Colts");
    }

    @Test
    void theTeamsListMarksOnlyThePlayersOwnTeamsAndListsOwnThenRegisteredOpponentsAndNoInactiveTeams() {
        Team sibling = team("Sixes", clubId, true);
        affiliate(league, sibling, current);
        affiliate(league, team("Gone", clubId, false), current);
        leagueTeam(league, current, "Visitors", true);
        leagueTeam(league, current, "Retired", false);

        MyLeagueDto dto = service.get(authentication, "key", league.getId(), null);

        assertThat(dto.teams()).extracting("name").containsExactly("Colts", "Sixes", "Visitors");
        assertThat(dto.teams()).extracting("mine").containsExactly(true, false, false);
    }

    @Test
    void onlyPublishedResultsAreListedNewestFirstWithScoresAndAResultLine() {
        Team rival = team("Rivals", clubId, true);
        affiliate(league, rival, current);
        Match played = match(myTeam.getId(), rival.getId(), null, 1, null);
        Match draftOnly = match(myTeam.getId(), rival.getId(), null, 2, null);
        Match later = match(rival.getId(), myTeam.getId(), null, 3, null);
        published = Map.of(
                played.getId(), result(played, ResultSide.HOME, 150, 6, 140, 9),
                later.getId(), result(later, ResultSide.AWAY, 100, 10, 101, 2));
        // draftOnly has no entry: publishedResults() returns only PUBLISHED, so a draft never reaches this service

        MyLeagueDto dto = service.get(authentication, "key", league.getId(), null);

        assertThat(dto.results()).extracting("matchId").containsExactly(later.getId(), played.getId());
        assertThat(dto.results()).extracting("matchId").doesNotContain(draftOnly.getId());
        assertThat(dto.results().get(1).homeScore()).isEqualTo("150/6");
        assertThat(dto.results().get(1).awayScore()).isEqualTo("140/9");
        assertThat(dto.results().get(1).resultLine()).isEqualTo("Colts won by 10 runs");
        assertThat(dto.results()).extracting("mine").containsExactly(true, true);
    }

    @Test
    void fieldsComeFromThePlayingAreaIdOnlyAndAFreeTextVenueAddsNothing() {
        UUID field = UUID.randomUUID();
        match(myTeam.getId(), null, "Visitors", 1, field);
        match(myTeam.getId(), null, "Visitors", 2, field);
        match(myTeam.getId(), null, "Visitors", 3, null); // free-text venue "Some ground", no field
        MyFieldDto described = new MyFieldDto(field, "Oval", null, null, null, null, null, null, null, true, false);
        when(fieldService.describe(eq(clubId), any())).thenReturn(List.of(described));

        MyLeagueDto dto = service.get(authentication, "key", league.getId(), null);

        verify(fieldService).describe(eq(clubId), eq(Set.of(field)));
        assertThat(dto.fields()).containsExactly(described);
    }

    @Test
    void shareDisabledFormatsCarryTheClubsLeagueListAndDefaultToEmpty() {
        assertThat(service.get(authentication, "key", league.getId(), null).shareDisabledFormats())
                .containsExactly("FACEBOOK");

        when(shareSettings.get(clubId)).thenReturn(new ShareSettingsDto(false, Map.of("RESULT", List.of("TV"))));
        assertThat(service.get(authentication, "key", league.getId(), null).shareDisabledFormats()).isEmpty();
    }

    @Test
    void keyDatesAndConditionsAreNullWhenNotSetAndKeyDatesComeFromTheScheduleAndSeasonDates() {
        MyLeagueDto bare = service.get(authentication, "key", league.getId(), null);
        assertThat(bare.playingConditions()).isNull();
        assertThat(bare.keyDates().seasonStart()).isNull();
        assertThat(bare.keyDates().firstMatchDate()).isNull();
        assertThat(bare.keyDates().nextMatchDate()).isNull();

        leagueSeasons.add(LeagueSeason.builder().leagueId(league.getId()).seasonId(current.getId())
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).build());
        match(myTeam.getId(), null, "Visitors", -5, null);
        match(myTeam.getId(), null, "Visitors", 5, null);
        match(myTeam.getId(), null, "Visitors", 9, null);

        MyLeagueDto dto = service.get(authentication, "key", league.getId(), null);

        assertThat(dto.keyDates().seasonStart()).isEqualTo(LocalDate.of(2026, 1, 1));
        assertThat(dto.keyDates().seasonEnd()).isEqualTo(LocalDate.of(2026, 12, 31));
        assertThat(dto.keyDates().firstMatchDate()).isBefore(dto.keyDates().nextMatchDate());
        assertThat(dto.keyDates().lastMatchDate()).isAfter(dto.keyDates().nextMatchDate());
    }

    @Test
    void noDtoOfALeaguePageCarriesContactsPhoneEmailOrManagerOnlyFields() {
        List<String> banned = List.of("contact", "contacts", "phone", "email", "active", "clubId", "createdAt",
                "updatedAt", "updatedBy", "uploadedBy", "uploadedAt", "affiliations", "affiliationId");
        for (Class<?> type : List.of(MyLeagueDto.class, com.cricketlegend.dto.MyLeagueInfoDto.class,
                com.cricketlegend.dto.MyLeagueTeamDto.class, com.cricketlegend.dto.MyScheduleItemDto.class,
                com.cricketlegend.dto.MyResultItemDto.class, com.cricketlegend.dto.MyPlayingConditionsDto.class,
                com.cricketlegend.dto.MyTeamRefDto.class, com.cricketlegend.dto.MyKeyDatesDto.class,
                com.cricketlegend.dto.MyLeagueSeasonDto.class, MyLeagueSummaryDto.class)) {
            assertThat(componentNames(type)).as(type.getSimpleName()).doesNotContainAnyElementsOf(banned);
        }
    }

    // --- fixtures ---

    private static List<String> componentNames(Class<?> record) {
        return Arrays.stream(record.getRecordComponents()).map(RecordComponent::getName).toList();
    }

    private static <T> List<T> byIds(List<T> all, Collection<UUID> ids, java.util.function.Function<T, UUID> id) {
        return all.stream().filter(t -> ids.contains(id.apply(t))).toList();
    }

    private Season season(String label, LocalDate start, LocalDate end) {
        Season s = Season.builder().id(UUID.randomUUID()).clubId(clubId).label(label).startDate(start).endDate(end)
                .active(true).createdAt(Instant.now()).build();
        seasons.add(s);
        return s;
    }

    private Team team(String name, UUID club, boolean active) {
        Team t = Team.builder().id(UUID.randomUUID()).clubId(club).name(name).active(active).build();
        teams.add(t);
        return t;
    }

    private League league(String name, UUID club, boolean active) {
        League l = League.builder().id(UUID.randomUUID()).clubId(club).name(name).source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(11).active(active).build();
        leagues.add(l);
        return l;
    }

    private void squad(Team team, Season season) {
        squad.add(TeamSquadMember.builder().teamId(team.getId()).seasonId(season.getId()).playerProfileId(profileId).build());
    }

    private void affiliate(League league, Team team, Season season) {
        affiliations.add(LeagueAffiliation.builder().leagueId(league.getId()).teamId(team.getId())
                .seasonId(season.getId()).build());
    }

    private void leagueTeam(League league, Season season, String name, boolean active) {
        leagueTeams.add(LeagueTeam.builder().id(UUID.randomUUID()).leagueId(league.getId()).seasonId(season.getId())
                .name(name).active(active).build());
    }

    /** A match of {@code league} in the current season, {@code daysAhead} from now (the list is kept in date order). */
    private Match match(UUID homeTeamId, UUID awayTeamId, String awayName, int daysAhead, UUID playingAreaId) {
        Match m = Match.builder().id(UUID.randomUUID()).clubId(clubId).leagueId(league.getId()).seasonId(current.getId())
                .homeTeamId(homeTeamId).awayTeamId(awayTeamId).awayTeamName(awayName).venue("Some ground")
                .matchDate(Instant.now().plus(daysAhead, ChronoUnit.DAYS)).playingAreaId(playingAreaId).active(true).build();
        matches.add(m);
        matches.sort(java.util.Comparator.comparing(Match::getMatchDate));
        return m;
    }

    private MatchResultDto result(Match m, ResultSide winner, int homeRuns, int homeWickets, int awayRuns, int awayWickets) {
        return new MatchResultDto(UUID.randomUUID(), clubId, m.getId(), com.cricketlegend.domain.ResultStatus.PUBLISHED,
                null, ResultOutcomeType.WON, ResultDecidedBy.REGULAR, winner, ResultMarginType.RUNS, 10, null, null, null,
                6, null, null, null, null, null, "MANUAL", null, Instant.now(), null, Instant.now(), Instant.now(), null,
                List.of(new com.cricketlegend.dto.InningsDto(1, com.cricketlegend.domain.InningsKind.REGULAR,
                                ResultSide.HOME, homeRuns, homeWickets, null, null, null, null),
                        new com.cricketlegend.dto.InningsDto(2, com.cricketlegend.domain.InningsKind.REGULAR,
                                ResultSide.AWAY, awayRuns, awayWickets, null, null, null, null)),
                false, false);
    }
}
