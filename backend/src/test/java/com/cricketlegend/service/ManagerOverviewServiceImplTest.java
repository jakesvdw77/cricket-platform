package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityPollType;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.ManagerOverviewDto;
import com.cricketlegend.dto.OverviewMatchDto;
import com.cricketlegend.dto.OverviewPollDto;
import com.cricketlegend.dto.SelectionLimitsDto;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.impl.ManagerOverviewServiceImpl;
import com.cricketlegend.service.support.OverviewPolls;
import com.cricketlegend.service.support.SelectionLimitsResolver;
import com.cricketlegend.service.support.ServerClock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.repository.query.FluentQuery.FetchableFluentQuery;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * Unit tests for ManagerOverviewServiceImpl (docs/specs/079-manager-shell-and-overview.md): the week
 * window edges, announced and selected counts, own-club sides, scoping by accessible section, poll
 * ordering and totals, the player figure, empty results and the quick-action flags. The match
 * predicates themselves (club, section, active, dates) run in the database and are covered by
 * ManagerOverviewControllerIntegrationTest.
 */
@ExtendWith(MockitoExtension.class)
class ManagerOverviewServiceImplTest {

    private static final UUID CLUB_ID = UUID.randomUUID();
    private static final UUID OTHER_CLUB_ID = UUID.randomUUID();
    private static final UUID SENIORS = UUID.randomUUID();
    private static final UUID JUNIORS = UUID.randomUUID();
    private static final UUID SEASON = UUID.randomUUID();

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private MatchSideRepository matchSideRepository;

    @Mock
    private MatchSidePlayerRepository matchSidePlayerRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private PlayerProfileRepository playerProfileRepository;

    @Mock
    private PlayerSectionRepository playerSectionRepository;

    @Mock
    private SelectionLimitsResolver selectionLimitsResolver;

    @Mock
    private OverviewPolls overviewPolls;

    @Mock
    private AccessService accessService;

    private ManagerOverviewServiceImpl service;
    private final Authentication caller = new TestingAuthenticationToken("caller", "n/a");
    private Instant today;

    private final Team seniors1 = team("Villagers 1", CLUB_ID, SENIORS);
    private final Team juniors1 = team("U15 A", CLUB_ID, JUNIORS);
    private final Team foreign = team("Strangers", OTHER_CLUB_ID, UUID.randomUUID());

    @BeforeEach
    void setUp() {
        service = new ManagerOverviewServiceImpl(
                matchRepository, matchSideRepository, matchSidePlayerRepository, teamRepository,
                playerProfileRepository, playerSectionRepository, selectionLimitsResolver, overviewPolls,
                accessService);
        today = ServerClock.startOfToday();
    }

    private static Team team(String name, UUID clubId, UUID sectionId) {
        return Team.builder().id(UUID.randomUUID()).clubId(clubId).sectionId(sectionId).name(name).active(true).build();
    }

    private Match match(Team home, Team away, Instant when) {
        return Match.builder().id(UUID.randomUUID()).clubId(CLUB_ID).homeTeamId(home.getId())
                .awayTeamId(away == null ? null : away.getId()).awayTeamName(away == null ? "Occasionals" : null)
                .seasonId(SEASON).matchDate(when).venue("Ground").active(true).build();
    }

    private MatchSide side(Match match, Team team, boolean announced) {
        return MatchSide.builder().id(UUID.randomUUID()).matchId(match.getId()).teamId(team.getId())
                .announced(announced).build();
    }

    private void unrestricted() {
        when(accessService.accessibleSectionIds(caller, CLUB_ID)).thenReturn(Optional.empty());
        when(accessService.canAccessClub(caller, CLUB_ID)).thenReturn(true);
    }

    private void restrictedTo(UUID... sectionIds) {
        when(accessService.accessibleSectionIds(caller, CLUB_ID)).thenReturn(Optional.of(Set.of(sectionIds)));
        when(accessService.canAccessClub(caller, CLUB_ID)).thenReturn(true);
    }

    /** Default stubs, lenient because which of them a test reaches depends on what it seeds. */
    @SuppressWarnings("unchecked")
    private void matches(List<Match> week, List<Match> upcoming) {
        lenient().when(matchRepository.findAll(anySpec())).thenReturn(week);
        FetchableFluentQuery<Match> fluent = mock(FetchableFluentQuery.class);
        lenient().when(fluent.sortBy(any(Sort.class))).thenReturn(fluent);
        lenient().when(fluent.limit(anyInt())).thenReturn(fluent);
        lenient().when(fluent.all()).thenReturn(upcoming);
        lenient().when(matchRepository.findBy(anySpec(), any())).thenAnswer(invocation -> {
            Function<FetchableFluentQuery<Match>, ?> query = invocation.getArgument(1);
            return query.apply(fluent);
        });
        lenient().when(teamRepository.findAllById(anyCollection())).thenReturn(List.of(seniors1, juniors1, foreign));
        lenient().when(overviewPolls.openPolls(eq(CLUB_ID), any())).thenReturn(List.of());
        lenient().when(playerProfileRepository.countByClubIdAndActiveTrue(CLUB_ID)).thenReturn(0L);
        lenient().when(selectionLimitsResolver.limits(any(Match.class))).thenReturn(new SelectionLimitsDto(11, true, 12));
    }

    @SuppressWarnings("unchecked")
    private static Specification<Match> anySpec() {
        return any(Specification.class);
    }

    // --- week window ---

    @Test
    void weekIsHalfOpenFromStartOfTodayToStartOfTodayPlusSevenDays() {
        unrestricted();
        Match atStart = match(seniors1, null, today);
        Match justBeforeEnd = match(seniors1, null, ServerClock.startOfDayFromToday(7).minusMillis(1));
        Match atEnd = match(seniors1, null, ServerClock.startOfDayFromToday(7));
        Match yesterday = match(seniors1, null, today.minusMillis(1));
        matches(List.of(atStart, justBeforeEnd, atEnd, yesterday), List.of(atStart));

        ManagerOverviewDto dto = service.overview(caller, CLUB_ID);

        assertThat(dto.matchesThisWeek()).isEqualTo(2);
    }

    @Test
    void teamsNotAnnouncedCountsOwnSidesInTheWeekOnlyIncludingMatchesWithoutASideRow() {
        unrestricted();
        Match announced = match(seniors1, null, today.plus(Duration.ofHours(3)));
        Match derbyNoRows = match(seniors1, juniors1, today.plus(Duration.ofDays(1)));
        Match foreignAway = match(seniors1, foreign, today.plus(Duration.ofDays(2)));
        Match nextWeek = match(seniors1, null, ServerClock.startOfDayFromToday(8));
        matches(List.of(announced, derbyNoRows, foreignAway), List.of(announced, derbyNoRows, foreignAway, nextWeek));
        when(matchSideRepository.findByMatchIdIn(anyCollection())).thenReturn(List.of(
                side(announced, seniors1, true), side(foreignAway, seniors1, true)));
        when(selectionLimitsResolver.limits(any(Match.class))).thenReturn(new SelectionLimitsDto(11, true, 12));

        ManagerOverviewDto dto = service.overview(caller, CLUB_ID);

        // announced (0) + derby with no rows (2) + foreign away (home own side announced, foreign not own) (0)
        assertThat(dto.teamsNotAnnounced()).isEqualTo(2);
    }

    // --- upcoming items ---

    @Test
    void upcomingItemCarriesOwnSidesWithSelectedMaxAndAnnouncedAndResolvedNames() {
        unrestricted();
        Match m = match(seniors1, foreign, today.plus(Duration.ofDays(1)));
        matches(List.of(m), List.of(m));
        MatchSide mine = side(m, seniors1, true);
        when(matchSideRepository.findByMatchIdIn(anyCollection())).thenReturn(List.of(mine));
        when(matchSidePlayerRepository.findByMatchSideIdIn(anyCollection())).thenReturn(List.of(
                MatchSidePlayer.builder().matchSideId(mine.getId()).playerProfileId(UUID.randomUUID()).build(),
                MatchSidePlayer.builder().matchSideId(mine.getId()).playerProfileId(UUID.randomUUID()).build(),
                MatchSidePlayer.builder().matchSideId(mine.getId()).playerProfileId(UUID.randomUUID()).build()));
        when(selectionLimitsResolver.limits(m)).thenReturn(new SelectionLimitsDto(11, true, 12));

        OverviewMatchDto item = service.overview(caller, CLUB_ID).upcomingMatches().get(0);

        assertThat(item.matchId()).isEqualTo(m.getId());
        assertThat(item.homeTeamId()).isEqualTo(seniors1.getId());
        assertThat(item.homeTeamName()).isEqualTo("Villagers 1");
        assertThat(item.awayTeamId()).isEqualTo(foreign.getId());
        assertThat(item.awayTeamName()).isEqualTo("Strangers");
        assertThat(item.sectionId()).isEqualTo(SENIORS);
        assertThat(item.venue()).isEqualTo("Ground");
        assertThat(item.ownSides()).hasSize(1);
        assertThat(item.ownSides().get(0).teamId()).isEqualTo(seniors1.getId());
        assertThat(item.ownSides().get(0).selectedCount()).isEqualTo(3);
        assertThat(item.ownSides().get(0).maxSelected()).isEqualTo(12);
        assertThat(item.ownSides().get(0).announced()).isTrue();
    }

    @Test
    void sideWithoutARowIsZeroSelectedAndNotAnnounced() {
        unrestricted();
        Match m = match(seniors1, null, today.plus(Duration.ofDays(1)));
        matches(List.of(), List.of(m));
        when(selectionLimitsResolver.limits(m)).thenReturn(new SelectionLimitsDto(11, true, 12));

        OverviewMatchDto item = service.overview(caller, CLUB_ID).upcomingMatches().get(0);

        assertThat(item.awayTeamId()).isNull();
        assertThat(item.awayTeamName()).isEqualTo("Occasionals");
        assertThat(item.ownSides()).singleElement().satisfies(side -> {
            assertThat(side.selectedCount()).isZero();
            assertThat(side.announced()).isFalse();
        });
        verify(matchSidePlayerRepository, never()).findByMatchSideIdIn(anyCollection());
    }

    @Test
    void leagueMatchReadsItsMaxSelectedFromTheBatchedLimits() {
        unrestricted();
        UUID leagueId = UUID.randomUUID();
        Match m = match(seniors1, null, today.plus(Duration.ofDays(1)));
        m.setLeagueId(leagueId);
        matches(List.of(m), List.of(m));
        when(selectionLimitsResolver.limitsFor(any())).thenReturn(Map.of(
                new SelectionLimitsResolver.LeagueSeason(leagueId, SEASON), new SelectionLimitsDto(9, false, 9)));

        assertThat(service.overview(caller, CLUB_ID).upcomingMatches().get(0).ownSides().get(0).maxSelected())
                .isEqualTo(9);
    }

    @Test
    void leagueThatCanNoLongerBeFoundLeavesMaxSelectedNull() {
        unrestricted();
        Match m = match(seniors1, null, today.plus(Duration.ofDays(1)));
        m.setLeagueId(UUID.randomUUID());
        matches(List.of(), List.of(m));
        when(selectionLimitsResolver.limitsFor(any())).thenReturn(Map.of());

        assertThat(service.overview(caller, CLUB_ID).upcomingMatches().get(0).ownSides().get(0).maxSelected())
                .isNull();
    }

    // --- scoping ---

    @Test
    void sectionManagerSeesOnlySidesOfTheirOwnSectionsInADerby() {
        restrictedTo(JUNIORS);
        Match derby = match(seniors1, juniors1, today.plus(Duration.ofDays(1)));
        matches(List.of(derby), List.of(derby));
        when(selectionLimitsResolver.limits(derby)).thenReturn(new SelectionLimitsDto(11, true, 12));

        ManagerOverviewDto dto = service.overview(caller, CLUB_ID);

        assertThat(dto.teamsNotAnnounced()).isEqualTo(1);
        OverviewMatchDto item = dto.upcomingMatches().get(0);
        assertThat(item.ownSides()).singleElement().satisfies(side -> assertThat(side.teamId()).isEqualTo(juniors1.getId()));
        assertThat(item.sectionId()).isEqualTo(JUNIORS);
    }

    @Test
    void anotherClubsTeamIsNeverAnOwnSideEvenWhenUnrestricted() {
        unrestricted();
        Match m = match(foreign, null, today.plus(Duration.ofDays(1)));
        matches(List.of(m), List.of(m));

        ManagerOverviewDto dto = service.overview(caller, CLUB_ID);

        assertThat(dto.teamsNotAnnounced()).isZero();
        assertThat(dto.upcomingMatches().get(0).ownSides()).isEmpty();
    }

    @Test
    void callerWithNoAccessibleSectionGetsAnEmptyOverviewWithoutAnyQuery() {
        when(accessService.accessibleSectionIds(caller, CLUB_ID)).thenReturn(Optional.of(Set.of()));
        when(accessService.canAccessClub(caller, CLUB_ID)).thenReturn(false);

        ManagerOverviewDto dto = service.overview(caller, CLUB_ID);

        assertThat(dto.matchesThisWeek()).isZero();
        assertThat(dto.teamsNotAnnounced()).isZero();
        assertThat(dto.pollAnswersAwaited()).isZero();
        assertThat(dto.activePlayers()).isZero();
        assertThat(dto.upcomingMatches()).isEmpty();
        assertThat(dto.openPolls()).isEmpty();
        assertThat(dto.recentResults()).isEmpty();
        assertThat(dto.quickActions().createMatch()).isFalse();
        verifyNoInteractions(matchRepository, overviewPolls, playerProfileRepository, playerSectionRepository);
    }

    @Test
    void emptyClubGivesZerosAndEmptyLists() {
        unrestricted();
        matches(List.of(), List.of());

        ManagerOverviewDto dto = service.overview(caller, CLUB_ID);

        assertThat(dto.matchesThisWeek()).isZero();
        assertThat(dto.teamsNotAnnounced()).isZero();
        assertThat(dto.pollAnswersAwaited()).isZero();
        assertThat(dto.activePlayers()).isZero();
        assertThat(dto.upcomingMatches()).isEmpty();
        assertThat(dto.openPolls()).isEmpty();
        assertThat(dto.recentResults()).isEmpty();
        verify(selectionLimitsResolver, never()).limits(any(Match.class));
    }

    @Test
    void scopeIsHandedToThePollsSoTheyAreScopedTheSameWay() {
        restrictedTo(JUNIORS);
        matches(List.of(), List.of());

        service.overview(caller, CLUB_ID);

        verify(overviewPolls).openPolls(CLUB_ID, Optional.of(Set.of(JUNIORS)));
    }

    // --- players ---

    @Test
    void unrestrictedCallerCountsAllActivePlayersOfTheClub() {
        unrestricted();
        matches(List.of(), List.of());
        when(playerProfileRepository.countByClubIdAndActiveTrue(CLUB_ID)).thenReturn(42L);

        assertThat(service.overview(caller, CLUB_ID).activePlayers()).isEqualTo(42L);
    }

    @Test
    void sectionManagerCountsActivePlayersTaggedToTheirSectionsOnlyOncePerPlayer() {
        restrictedTo(SENIORS, JUNIORS);
        matches(List.of(), List.of());
        UUID both = UUID.randomUUID();
        UUID one = UUID.randomUUID();
        when(playerSectionRepository.findBySectionIdIn(Set.of(SENIORS, JUNIORS))).thenReturn(List.of(
                PlayerSection.builder().playerProfileId(both).sectionId(SENIORS).build(),
                PlayerSection.builder().playerProfileId(both).sectionId(JUNIORS).build(),
                PlayerSection.builder().playerProfileId(one).sectionId(JUNIORS).build()));
        when(playerProfileRepository.countByClubIdAndActiveTrueAndIdIn(CLUB_ID, Set.of(both, one))).thenReturn(2L);

        assertThat(service.overview(caller, CLUB_ID).activePlayers()).isEqualTo(2L);
        verify(playerProfileRepository, never()).countByClubIdAndActiveTrue(any());
    }

    @Test
    void sectionManagerWithNoTaggedPlayersCountsZeroWithoutACountQuery() {
        restrictedTo(SENIORS);
        matches(List.of(), List.of());
        when(playerSectionRepository.findBySectionIdIn(Set.of(SENIORS))).thenReturn(List.of());

        assertThat(service.overview(caller, CLUB_ID).activePlayers()).isZero();
        verify(playerProfileRepository, never()).countByClubIdAndActiveTrueAndIdIn(any(), any());
    }

    // --- polls ---

    private OverviewPollDto poll(AvailabilityPollType kind, String title, long replied, long total, Instant closeAt) {
        return new OverviewPollDto(kind, UUID.randomUUID(), kind == AvailabilityPollType.SQUAD ? UUID.randomUUID() : null,
                title, replied, total, closeAt);
    }

    @Test
    void pollsAreSortedBySoonestCloseCappedAtFiveAndTheAwaitedTotalCoversEveryPoll() {
        unrestricted();
        matches(List.of(), List.of());
        List<OverviewPollDto> polls = new ArrayList<>();
        polls.add(poll(AvailabilityPollType.GROUP, "no close time", 0, 4, null));
        for (int i = 6; i >= 1; i--) {
            polls.add(poll(AvailabilityPollType.SQUAD, "p" + i, 1, 3, today.plus(Duration.ofDays(i))));
        }
        when(overviewPolls.openPolls(eq(CLUB_ID), any())).thenReturn(polls);

        ManagerOverviewDto dto = service.overview(caller, CLUB_ID);

        assertThat(dto.openPolls()).extracting(OverviewPollDto::title).containsExactly("p1", "p2", "p3", "p4", "p5");
        // 6 squad polls x (3 - 1) + the group poll with 4 outstanding: the sixth and the undated one count too
        assertThat(dto.pollAnswersAwaited()).isEqualTo(16L);
    }

    @Test
    void pollWithNoCloseTimeSortsAfterDatedOnes() {
        unrestricted();
        matches(List.of(), List.of());
        when(overviewPolls.openPolls(eq(CLUB_ID), any())).thenReturn(List.of(
                poll(AvailabilityPollType.GROUP, "undated", 0, 1, null),
                poll(AvailabilityPollType.SQUAD, "dated", 0, 1, today)));

        assertThat(service.overview(caller, CLUB_ID).openPolls()).extracting(OverviewPollDto::title)
                .containsExactly("dated", "undated");
    }

    @Test
    void anOverRepliedPollNeverMakesTheAwaitedTotalNegative() {
        unrestricted();
        matches(List.of(), List.of());
        when(overviewPolls.openPolls(eq(CLUB_ID), any())).thenReturn(List.of(
                poll(AvailabilityPollType.SQUAD, "over", 5, 3, today)));

        assertThat(service.overview(caller, CLUB_ID).pollAnswersAwaited()).isZero();
    }

    // --- results and quick actions ---

    @Test
    void recentResultsIsAlwaysEmpty() {
        unrestricted();
        Match m = match(seniors1, null, today.plus(Duration.ofDays(1)));
        matches(List.of(m), List.of(m));
        when(selectionLimitsResolver.limits(any(Match.class))).thenReturn(new SelectionLimitsDto(11, true, 12));

        assertThat(service.overview(caller, CLUB_ID).recentResults()).isEmpty();
    }

    @Test
    void quickActionsAllFollowCanAccessClub() {
        unrestricted();
        matches(List.of(), List.of());

        assertThat(service.overview(caller, CLUB_ID).quickActions()).satisfies(actions -> {
            assertThat(actions.createMatch()).isTrue();
            assertThat(actions.createPoll()).isTrue();
            assertThat(actions.addPlayer()).isTrue();
            assertThat(actions.messageSquad()).isTrue();
        });
    }

    @Test
    void quickActionsAreAllFalseWhenTheCallerCannotAccessTheClub() {
        when(accessService.accessibleSectionIds(caller, CLUB_ID)).thenReturn(Optional.empty());
        when(accessService.canAccessClub(caller, CLUB_ID)).thenReturn(false);
        matches(List.of(), List.of());

        assertThat(service.overview(caller, CLUB_ID).quickActions()).satisfies(actions -> {
            assertThat(actions.createMatch()).isFalse();
            assertThat(actions.createPoll()).isFalse();
            assertThat(actions.addPlayer()).isFalse();
            assertThat(actions.messageSquad()).isFalse();
        });
    }
}
