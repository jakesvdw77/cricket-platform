package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityPollType;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.MatchSquadMember;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerAvailabilityCellStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.PlayerAvailabilityDto;
import com.cricketlegend.dto.PlayerRowDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.MatchSquadMemberRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.impl.PlayerAvailabilityServiceImpl;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

/**
 * Unit tests for PlayerAvailabilityServiceImpl (docs/specs/068-player-availability-grid.md):
 * cell derivation for group-covered, squad-covered and poll-less games, audiences, picked
 * sources, filters, caps, counts, ordering, scope errors and the one-call-per-batch no-N+1 guard.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@SuppressWarnings("unchecked")
class PlayerAvailabilityServiceImplTest {

    @Mock private MatchRepository matchRepository;
    @Mock private TeamRepository teamRepository;
    @Mock private SectionRepository sectionRepository;
    @Mock private LeagueRepository leagueRepository;
    @Mock private SectionAvailabilityWindowMatchRepository windowMatchRepository;
    @Mock private SectionAvailabilityWindowRepository windowRepository;
    @Mock private SectionAvailabilityResponseRepository responseRepository;
    @Mock private MatchAvailabilityPollRepository pollRepository;
    @Mock private PlayerAvailabilityRepository playerAvailabilityRepository;
    @Mock private MatchSquadMemberRepository matchSquadMemberRepository;
    @Mock private MatchSideRepository matchSideRepository;
    @Mock private MatchSidePlayerRepository matchSidePlayerRepository;
    @Mock private TeamSquadMemberRepository teamSquadMemberRepository;
    @Mock private PlayerSectionRepository playerSectionRepository;
    @Mock private PlayerProfileRepository playerProfileRepository;
    @Mock private PersonRepository personRepository;
    @Mock private AccessService accessService;
    @Mock private SectionAvailabilityMatchResolver matchResolver;

    private PlayerAvailabilityServiceImpl service;
    private final Authentication auth = mock(Authentication.class);
    private final UUID clubId = UUID.randomUUID();
    private final UUID sectionId = UUID.randomUUID();
    private final UUID seasonId = UUID.randomUUID();
    private final Team team =
            Team.builder().id(UUID.randomUUID()).clubId(clubId).sectionId(sectionId).name("Villagers 1").build();
    private final List<PlayerProfile> profiles = new ArrayList<>();
    private final List<Person> persons = new ArrayList<>();
    private final List<PlayerSection> playerSections = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new PlayerAvailabilityServiceImpl(
                matchRepository, teamRepository, sectionRepository, leagueRepository, windowMatchRepository,
                windowRepository, responseRepository, pollRepository, playerAvailabilityRepository,
                matchSquadMemberRepository, matchSideRepository, matchSidePlayerRepository,
                teamSquadMemberRepository, playerSectionRepository, playerProfileRepository, personRepository,
                accessService, matchResolver);
        when(accessService.accessibleSectionIds(any(), any())).thenReturn(Optional.of(Set.of(sectionId)));
        when(accessService.sectionAndDescendantIds(clubId, sectionId)).thenReturn(Set.of(sectionId));
        when(teamRepository.findAllById(any())).thenReturn(List.of(team));
        when(matchResolver.dayPartOf(any())).thenReturn(DayPart.AFTERNOON);
        when(playerProfileRepository.findAllById(any())).thenAnswer(i -> profiles);
        when(personRepository.findAllById(any())).thenAnswer(i -> persons);
        when(playerSectionRepository.findBySectionIdIn(any())).thenAnswer(i -> playerSections);
        when(matchRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));
    }

    private Match match() {
        return Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamId(team.getId()).awayTeamName("CBC")
                .seasonId(seasonId).matchDate(Instant.now().plus(1, ChronoUnit.DAYS)).venue("Ground").active(true)
                .build();
    }

    private void games(Match... matches) {
        when(matchRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(matches)));
    }

    private UUID player(String first, String last, boolean active, boolean inSection) {
        UUID id = UUID.randomUUID();
        UUID personId = UUID.randomUUID();
        profiles.add(PlayerProfile.builder().id(id).personId(personId).clubId(clubId).active(active)
                .jerseyNumber(7).build());
        persons.add(Person.builder().id(personId).firstName(first).lastName(last).build());
        if (inSection) {
            playerSections.add(PlayerSection.builder().playerProfileId(id).sectionId(sectionId).build());
        }
        return id;
    }

    private SectionAvailabilityWindow groupWindow(Match... matches) {
        SectionAvailabilityWindow window = SectionAvailabilityWindow.builder().id(UUID.randomUUID())
                .sectionId(sectionId).roundId(UUID.randomUUID()).dayPart(DayPart.MORNING).build();
        List<SectionAvailabilityWindowMatch> links = new ArrayList<>();
        for (Match m : matches) {
            links.add(SectionAvailabilityWindowMatch.builder().windowId(window.getId()).matchId(m.getId()).build());
        }
        when(windowMatchRepository.findByMatchIdIn(any())).thenReturn(links);
        when(windowRepository.findAllById(any())).thenReturn(List.of(window));
        return window;
    }

    private MatchAvailabilityPoll squadPoll(Match match, Team forTeam) {
        return MatchAvailabilityPoll.builder().id(UUID.randomUUID()).matchId(match.getId())
                .teamId(forTeam.getId()).open(true).build();
    }

    private PlayerAvailabilityDto grid() {
        return service.getGrid(auth, clubId, null, null, null, null, false);
    }

    private PlayerRowDto row(PlayerAvailabilityDto dto, UUID playerId) {
        return dto.players().stream().filter(p -> p.playerProfileId().equals(playerId)).findFirst().orElseThrow();
    }

    @Test
    void groupCoveredGameUsesTheWindowAudienceAnswersDayPartAndRound() {
        Match m = match();
        games(m);
        SectionAvailabilityWindow window = groupWindow(m);
        UUID answered = player("Anton", "Aaa", true, true);
        UUID silent = player("Bob", "Bbb", true, true);
        UUID inactive = player("Cal", "Ccc", false, true);
        when(responseRepository.findByWindowIdIn(any())).thenReturn(List.of(SectionAvailabilityResponse.builder()
                .windowId(window.getId()).playerProfileId(answered).status(AvailabilityStatus.UNSURE).build()));

        PlayerAvailabilityDto dto = grid();

        assertThat(dto.games()).hasSize(1);
        assertThat(dto.games().get(0).pollType()).isEqualTo(AvailabilityPollType.GROUP);
        assertThat(dto.games().get(0).pollId()).isEqualTo(window.getRoundId());
        assertThat(dto.games().get(0).roundId()).isEqualTo(window.getRoundId());
        assertThat(dto.games().get(0).dayPart()).isEqualTo(DayPart.MORNING);
        assertThat(dto.games().get(0).label()).isEqualTo("Villagers 1 v CBC");
        assertThat(dto.games().get(0).teamId()).isEqualTo(team.getId());
        assertThat(dto.games().get(0).sectionId()).isEqualTo(sectionId);
        assertThat(row(dto, answered).cells().get(0).status()).isEqualTo(PlayerAvailabilityCellStatus.UNSURE);
        assertThat(row(dto, silent).cells().get(0).status()).isEqualTo(PlayerAvailabilityCellStatus.NO_RESPONSE);
        assertThat(dto.players()).extracting(PlayerRowDto::playerProfileId).doesNotContain(inactive);
    }

    // 070: a league-team side has no teamId, so the label uses its copied name and the club's own
    // team (if any) stays the game's own team.
    @Test
    void aLeagueTeamOpponentIsLabelledByItsCopiedNameAndOwnTeamIsStillTheOtherSide() {
        Match m = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamName("Hillside CC")
                .homeLeagueTeamId(UUID.randomUUID()).awayTeamId(team.getId())
                .seasonId(seasonId).matchDate(Instant.now().plus(1, ChronoUnit.DAYS)).venue("Ground").active(true)
                .build();
        games(m);
        player("Anton", "Aaa", true, true);

        PlayerAvailabilityDto dto = grid();

        assertThat(dto.games()).hasSize(1);
        assertThat(dto.games().get(0).label()).isEqualTo("Hillside CC v Villagers 1");
        assertThat(dto.games().get(0).teamId()).isEqualTo(team.getId());
    }

    @Test
    void aGameBetweenTwoLeagueTeamsIsLabelledFromBothCopiedNamesAndHasNoOwnTeam() {
        Match m = Match.builder().id(UUID.randomUUID()).clubId(clubId)
                .homeTeamName("Hillside CC").homeLeagueTeamId(UUID.randomUUID())
                .awayTeamName("Oakwood CC").awayLeagueTeamId(UUID.randomUUID())
                .seasonId(seasonId).matchDate(Instant.now().plus(1, ChronoUnit.DAYS)).venue("Ground").active(true)
                .build();
        games(m);

        PlayerAvailabilityDto dto = grid();

        assertThat(dto.games()).hasSize(1);
        assertThat(dto.games().get(0).label()).isEqualTo("Hillside CC v Oakwood CC");
        assertThat(dto.games().get(0).teamId()).isNull();
    }

    @Test
    void squadCoveredGameUsesTheTeamSeasonSquadAndNotInPollOutsideIt() {
        Match m = match();
        games(m);
        MatchAvailabilityPoll poll = squadPoll(m, team);
        when(pollRepository.findByMatchIdIn(any())).thenReturn(List.of(poll));
        UUID inSquad = player("Anton", "Aaa", true, true);
        UUID outOfSquad = player("Bob", "Bbb", true, true);
        UUID noAnswer = player("Cal", "Ccc", true, true);
        when(teamSquadMemberRepository.findByTeamIdInAndSeasonIdIn(any(), any())).thenReturn(List.of(
                TeamSquadMember.builder().teamId(team.getId()).seasonId(seasonId).playerProfileId(inSquad).build(),
                TeamSquadMember.builder().teamId(team.getId()).seasonId(seasonId).playerProfileId(noAnswer).build()));
        when(playerAvailabilityRepository.findByPollIdIn(any())).thenReturn(List.of(PlayerAvailability.builder()
                .pollId(poll.getId()).playerProfileId(inSquad).status(AvailabilityStatus.AVAILABLE).build()));

        PlayerAvailabilityDto dto = grid();

        assertThat(dto.games().get(0).pollType()).isEqualTo(AvailabilityPollType.SQUAD);
        assertThat(dto.games().get(0).pollId()).isEqualTo(poll.getId());
        assertThat(dto.games().get(0).roundId()).isNull();
        assertThat(dto.games().get(0).dayPart()).isEqualTo(DayPart.AFTERNOON);
        assertThat(row(dto, inSquad).cells().get(0).status()).isEqualTo(PlayerAvailabilityCellStatus.AVAILABLE);
        assertThat(row(dto, noAnswer).cells().get(0).status()).isEqualTo(PlayerAvailabilityCellStatus.NO_RESPONSE);
        assertThat(row(dto, outOfSquad).cells().get(0).status()).isEqualTo(PlayerAvailabilityCellStatus.NOT_IN_POLL);
    }

    @Test
    void gameWithNoPollIsNotInPollForEveryoneAndHasNullPollFields() {
        Match m = match();
        games(m);
        UUID p = player("Anton", "Aaa", true, true);

        PlayerAvailabilityDto dto = grid();

        assertThat(dto.games().get(0).pollType()).isNull();
        assertThat(dto.games().get(0).pollId()).isNull();
        assertThat(row(dto, p).cells().get(0).status()).isEqualTo(PlayerAvailabilityCellStatus.NOT_IN_POLL);
    }

    @Test
    void aPlayerInTwoTeamsSquadsGetsTwoSeparateCellsForTwoGamesInTheSameSlot() {
        Team other = Team.builder().id(UUID.randomUUID()).clubId(clubId).sectionId(sectionId).name("Villagers 2")
                .build();
        when(teamRepository.findAllById(any())).thenReturn(List.of(team, other));
        Match first = match();
        Match second = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamId(other.getId())
                .awayTeamName("XYZ").seasonId(seasonId).matchDate(first.getMatchDate()).active(true).build();
        games(first, second);
        MatchAvailabilityPoll pollA = squadPoll(first, team);
        MatchAvailabilityPoll pollB = squadPoll(second, other);
        when(pollRepository.findByMatchIdIn(any())).thenReturn(List.of(pollA, pollB));
        UUID p = player("Anton", "Aaa", true, true);
        when(teamSquadMemberRepository.findByTeamIdInAndSeasonIdIn(any(), any())).thenReturn(List.of(
                TeamSquadMember.builder().teamId(team.getId()).seasonId(seasonId).playerProfileId(p).build(),
                TeamSquadMember.builder().teamId(other.getId()).seasonId(seasonId).playerProfileId(p).build()));
        when(playerAvailabilityRepository.findByPollIdIn(any())).thenReturn(List.of(
                PlayerAvailability.builder().pollId(pollA.getId()).playerProfileId(p)
                        .status(AvailabilityStatus.AVAILABLE).build(),
                PlayerAvailability.builder().pollId(pollB.getId()).playerProfileId(p)
                        .status(AvailabilityStatus.UNAVAILABLE).build()));

        PlayerRowDto row = row(grid(), p);

        assertThat(row.cells()).extracting(c -> c.status()).containsExactly(
                PlayerAvailabilityCellStatus.AVAILABLE, PlayerAvailabilityCellStatus.UNAVAILABLE);
        assertThat(row.answeredCount()).isEqualTo(2);
    }

    @Test
    void pickedComesFromMatchSquadMemberAndFromMatchSidePlayerRegardlessOfAnnounced() {
        Match a = match();
        Match b = match();
        games(a, b);
        UUID viaSquad = player("Anton", "Aaa", true, true);
        UUID viaSide = player("Bob", "Bbb", true, true);
        UUID never = player("Cal", "Ccc", true, true);
        when(matchSquadMemberRepository.findByMatchIdIn(any())).thenReturn(List.of(MatchSquadMember.builder()
                .matchId(a.getId()).teamId(team.getId()).playerProfileId(viaSquad).build()));
        UUID sideId = UUID.randomUUID();
        when(matchSideRepository.findByMatchIdIn(any())).thenReturn(List.of(
                MatchSide.builder().id(sideId).matchId(b.getId()).teamId(team.getId()).announced(false).build()));
        when(matchSidePlayerRepository.findByMatchSideIdIn(any())).thenReturn(List.of(
                MatchSidePlayer.builder().matchSideId(sideId).playerProfileId(viaSide).build()));

        PlayerAvailabilityDto dto = grid();

        assertThat(row(dto, viaSquad).cells()).extracting(c -> c.picked()).containsExactly(true, false);
        assertThat(row(dto, viaSide).cells()).extracting(c -> c.picked()).containsExactly(false, true);
        assertThat(row(dto, viaSquad).pickedCount()).isEqualTo(1);
        assertThat(row(dto, never).pickedCount()).isZero();
    }

    @Test
    void rowsAreOrderedByFirstNameThenLastNameCaseInsensitivelyThenId() {
        games(match());
        UUID brian = player("Brian", "Abbott", true, true);
        UUID anton = player("Anton", "Zulu", true, true);
        UUID lowerAmy = player("amy", "Young", true, true);
        UUID amyB = player("Amy", "Xavier", true, true);
        UUID twinOne = player("Cal", "Same", true, true);
        UUID twinTwo = player("cal", "SAME", true, true);
        List<UUID> twins = List.of(twinOne, twinTwo).stream().sorted().toList();

        List<UUID> expected = new ArrayList<>(List.of(amyB, lowerAmy, anton, brian));
        expected.addAll(twins);
        assertThat(grid().players()).extracting(PlayerRowDto::playerProfileId)
                .containsExactlyElementsOf(expected);
    }

    @Test
    void teamFilterShowsThatTeamsSquadRowsAndChecksTheTeam() {
        games(match());
        when(teamRepository.findById(team.getId())).thenReturn(Optional.of(team));
        UUID inSquad = player("Anton", "Aaa", true, false);
        player("Bob", "Bbb", true, true);
        when(teamSquadMemberRepository.findByTeamIdInAndSeasonIdIn(any(), any())).thenReturn(List.of(
                TeamSquadMember.builder().teamId(team.getId()).seasonId(seasonId).playerProfileId(inSquad).build()));

        PlayerAvailabilityDto dto = service.getGrid(auth, clubId, null, null, null, team.getId(), false);

        assertThat(dto.players()).extracting(PlayerRowDto::playerProfileId).containsExactly(inSquad);
        verify(accessService).assertCanAdministerSection(auth, clubId, sectionId);
    }

    @Test
    void teamOfAnotherClubOrUnknownIsNotFoundAndOutOfScopeTeamIsForbidden() {
        Team foreign = Team.builder().id(UUID.randomUUID()).clubId(UUID.randomUUID()).sectionId(sectionId)
                .name("X").build();
        when(teamRepository.findById(foreign.getId())).thenReturn(Optional.of(foreign));
        assertThatThrownBy(() -> service.getGrid(auth, clubId, null, null, null, foreign.getId(), false))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.getGrid(auth, clubId, null, null, null, UUID.randomUUID(), false))
                .isInstanceOf(NotFoundException.class);

        when(teamRepository.findById(team.getId())).thenReturn(Optional.of(team));
        doThrow(new AccessDeniedException("no")).when(accessService)
                .assertCanAdministerSection(auth, clubId, sectionId);
        assertThatThrownBy(() -> service.getGrid(auth, clubId, null, null, null, team.getId(), false))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void sectionParamIsAssertedAndAnOutOfScopeOneIsForbidden() {
        games(match());
        service.getGrid(auth, clubId, null, null, sectionId, null, false);
        verify(accessService).assertCanAdministerSection(auth, clubId, sectionId);

        doThrow(new AccessDeniedException("no")).when(accessService)
                .assertCanAdministerSection(auth, clubId, sectionId);
        assertThatThrownBy(() -> service.getGrid(auth, clubId, null, null, sectionId, null, false))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void unrestrictedCallerWithoutSectionUsesEveryClubSectionForRows() {
        when(accessService.accessibleSectionIds(any(), any())).thenReturn(Optional.empty());
        when(sectionRepository.findByClubId(clubId)).thenReturn(
                List.of(Section.builder().id(sectionId).clubId(clubId).name("Men").build()));
        games(match());
        UUID p = player("Anton", "Aaa", true, true);

        assertThat(grid().players()).extracting(PlayerRowDto::playerProfileId).containsExactly(p);
        verify(sectionRepository).findByClubId(clubId);
    }

    @Test
    void filtersAreAppliedAndLeagueNameIsLoaded() {
        Match m = match();
        UUID leagueId = UUID.randomUUID();
        m.setLeagueId(leagueId);
        games(m);
        when(leagueRepository.findAllById(any()))
                .thenReturn(List.of(League.builder().id(leagueId).name("Premier").build()));

        PlayerAvailabilityDto dto = service.getGrid(auth, clubId, seasonId, leagueId, null, null, true);

        assertThat(dto.games().get(0).leagueName()).isEqualTo("Premier");
        assertThat(dto.games().get(0).leagueId()).isEqualTo(leagueId);
        verify(matchRepository).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void gameCapSetsTruncatedAndKeepsOnlyMaxGames() {
        List<Match> many = new ArrayList<>();
        for (int i = 0; i < PlayerAvailabilityServiceImpl.MAX_GAMES + 1; i++) {
            many.add(match());
        }
        when(matchRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(many));

        PlayerAvailabilityDto dto = grid();

        assertThat(dto.games()).hasSize(PlayerAvailabilityServiceImpl.MAX_GAMES);
        assertThat(dto.truncated()).isTrue();
    }

    @Test
    void playerCapSetsTruncatedAndKeepsTheFirstByName() {
        games(match());
        for (int i = 0; i < PlayerAvailabilityServiceImpl.MAX_PLAYERS + 1; i++) {
            player(String.format("F%04d", i), "L", true, true);
        }

        PlayerAvailabilityDto dto = grid();

        assertThat(dto.players()).hasSize(PlayerAvailabilityServiceImpl.MAX_PLAYERS);
        assertThat(dto.truncated()).isTrue();
        assertThat(dto.players().get(0).firstName()).isEqualTo("F0000");
    }

    @Test
    void noGamesReturnsAnEmptyGridWithoutFurtherQueries() {
        PlayerAvailabilityDto dto = grid();

        assertThat(dto.games()).isEmpty();
        assertThat(dto.players()).isEmpty();
        assertThat(dto.truncated()).isFalse();
        verifyNoInteractions(windowMatchRepository, pollRepository, playerSectionRepository);
    }

    @Test
    void everyBatchRepositoryMethodIsCalledExactlyOnceRegardlessOfGameAndPlayerCount() {
        List<Match> ms = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            ms.add(match());
        }
        games(ms.toArray(new Match[0]));
        groupWindow(ms.get(0), ms.get(1));
        when(pollRepository.findByMatchIdIn(any()))
                .thenReturn(List.of(squadPoll(ms.get(2), team), squadPoll(ms.get(3), team)));
        for (int i = 0; i < 20; i++) {
            player("P", "L" + i, true, true);
        }

        grid();

        verify(windowMatchRepository, times(1)).findByMatchIdIn(any());
        verify(windowRepository, times(1)).findAllById(any());
        verify(pollRepository, times(1)).findByMatchIdIn(any());
        verify(responseRepository, times(1)).findByWindowIdIn(any());
        verify(playerAvailabilityRepository, times(1)).findByPollIdIn(any());
        verify(matchSquadMemberRepository, times(1)).findByMatchIdIn(any());
        verify(matchSideRepository, times(1)).findByMatchIdIn(any());
        verify(matchSidePlayerRepository, times(1)).findByMatchSideIdIn(any());
        verify(teamSquadMemberRepository, times(1)).findByTeamIdInAndSeasonIdIn(any(), any());
        verify(playerSectionRepository, times(1)).findBySectionIdIn(any());
        verify(teamRepository, times(1)).findAllById(any());
        verify(leagueRepository, times(1)).findAllById(any());
        verify(playerProfileRepository, times(1)).findAllById(any());
        verify(personRepository, times(1)).findAllById(any());
        verify(matchRepository, times(1)).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void includePastCapKeepsTheLatestGamesShownAscendingAndNonPastQueriesAscendingWithIdTieBreak() {
        Instant base = Instant.now();
        List<Match> latestFirst = new ArrayList<>();
        for (int i = 0; i < PlayerAvailabilityServiceImpl.MAX_GAMES + 1; i++) {
            Match m = match();
            m.setMatchDate(base.minus(i, ChronoUnit.DAYS));
            latestFirst.add(m);
        }
        when(matchRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(latestFirst));

        PlayerAvailabilityDto dto = service.getGrid(auth, clubId, null, null, null, null, true);

        assertThat(dto.truncated()).isTrue();
        assertThat(dto.games()).hasSize(PlayerAvailabilityServiceImpl.MAX_GAMES);
        // The earliest (last fetched) game was dropped; the rest are ascending.
        assertThat(dto.games()).extracting(g -> g.matchId())
                .doesNotContain(latestFirst.get(PlayerAvailabilityServiceImpl.MAX_GAMES).getId());
        assertThat(dto.games().get(0).matchId())
                .isEqualTo(latestFirst.get(PlayerAvailabilityServiceImpl.MAX_GAMES - 1).getId());
        assertThat(dto.games().get(dto.games().size() - 1).matchId()).isEqualTo(latestFirst.get(0).getId());
        org.mockito.ArgumentCaptor<Pageable> pageable = org.mockito.ArgumentCaptor.forClass(Pageable.class);
        verify(matchRepository).findAll(any(Specification.class), pageable.capture());
        assertThat(pageable.getValue().getSort().toString()).isEqualTo("matchDate: DESC,id: DESC");

        service.getGrid(auth, clubId, null, null, null, null, false);
        verify(matchRepository, times(2)).findAll(any(Specification.class), pageable.capture());
        assertThat(pageable.getValue().getSort().toString()).isEqualTo("matchDate: ASC,id: ASC");
    }

    @Test
    void teamFilterWithASectionThatDoesNotContainTheTeamReturnsAnEmptyGrid() {
        UUID otherSection = UUID.randomUUID();
        when(accessService.accessibleSectionIds(any(), any()))
                .thenReturn(Optional.of(Set.of(sectionId, otherSection)));
        when(accessService.sectionAndDescendantIds(clubId, otherSection)).thenReturn(Set.of(otherSection));
        when(teamRepository.findById(team.getId())).thenReturn(Optional.of(team));
        games(match());

        PlayerAvailabilityDto dto = service.getGrid(auth, clubId, null, null, otherSection, team.getId(), false);

        assertThat(dto.games()).isEmpty();
        assertThat(dto.players()).isEmpty();
        assertThat(dto.truncated()).isFalse();
        verify(matchRepository, org.mockito.Mockito.never()).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void teamFilterDerivesTheScopeFromTheTeamsSectionEvenForAnUnrestrictedCaller() {
        when(accessService.accessibleSectionIds(any(), any())).thenReturn(Optional.empty());
        when(teamRepository.findById(team.getId())).thenReturn(Optional.of(team));
        games(match());

        PlayerAvailabilityDto dto = service.getGrid(auth, clubId, null, null, null, team.getId(), false);

        assertThat(dto.games()).hasSize(1);
        assertThat(dto.games().get(0).teamId()).isEqualTo(team.getId());
        assertThat(dto.games().get(0).sectionId()).isEqualTo(sectionId);
        verify(sectionRepository, org.mockito.Mockito.never()).findByClubId(any());
    }

    @Test
    void teamFilterUsesTheSquadJerseyNumberWithProfileFallbackAndNoFilterUsesTheProfileNumber() {
        games(match());
        when(teamRepository.findById(team.getId())).thenReturn(Optional.of(team));
        UUID withSquadNumber = player("Anton", "Aaa", true, true);
        UUID withoutSquadNumber = player("Bob", "Bbb", true, true);
        when(teamSquadMemberRepository.findByTeamIdInAndSeasonIdIn(any(), any())).thenReturn(List.of(
                TeamSquadMember.builder().teamId(team.getId()).seasonId(seasonId)
                        .playerProfileId(withSquadNumber).jerseyNumber(99).build(),
                TeamSquadMember.builder().teamId(team.getId()).seasonId(seasonId)
                        .playerProfileId(withoutSquadNumber).build()));

        PlayerAvailabilityDto filtered = service.getGrid(auth, clubId, null, null, null, team.getId(), false);
        assertThat(row(filtered, withSquadNumber).jerseyNumber()).isEqualTo(99);
        assertThat(row(filtered, withoutSquadNumber).jerseyNumber()).isEqualTo(7);

        PlayerAvailabilityDto unfiltered = grid();
        assertThat(row(unfiltered, withSquadNumber).jerseyNumber()).isEqualTo(7);
    }

    @Test
    void aGroupWindowWinsOverASquadPollOnTheSameMatch() {
        Match m = match();
        games(m);
        SectionAvailabilityWindow window = groupWindow(m);
        MatchAvailabilityPoll poll = squadPoll(m, team);
        when(pollRepository.findByMatchIdIn(any())).thenReturn(List.of(poll));
        UUID p = player("Anton", "Aaa", true, true);
        when(responseRepository.findByWindowIdIn(any())).thenReturn(List.of(SectionAvailabilityResponse.builder()
                .windowId(window.getId()).playerProfileId(p).status(AvailabilityStatus.AVAILABLE).build()));
        when(playerAvailabilityRepository.findByPollIdIn(any())).thenReturn(List.of(PlayerAvailability.builder()
                .pollId(poll.getId()).playerProfileId(p).status(AvailabilityStatus.UNAVAILABLE).build()));
        when(teamSquadMemberRepository.findByTeamIdInAndSeasonIdIn(any(), any())).thenReturn(List.of(
                TeamSquadMember.builder().teamId(team.getId()).seasonId(seasonId).playerProfileId(p).build()));

        PlayerAvailabilityDto dto = grid();

        assertThat(dto.games().get(0).pollType()).isEqualTo(AvailabilityPollType.GROUP);
        assertThat(row(dto, p).cells().get(0).status()).isEqualTo(PlayerAvailabilityCellStatus.AVAILABLE);
    }

    @Test
    void groupAudienceIncludesPlayersOfDescendantSections() {
        Match m = match();
        games(m);
        groupWindow(m);
        UUID childSection = UUID.randomUUID();
        when(accessService.accessibleSectionIds(any(), any()))
                .thenReturn(Optional.of(Set.of(sectionId, childSection)));
        when(accessService.sectionAndDescendantIds(clubId, sectionId)).thenReturn(Set.of(sectionId, childSection));
        UUID childPlayer = player("Anton", "Aaa", true, false);
        playerSections.add(PlayerSection.builder().playerProfileId(childPlayer).sectionId(childSection).build());

        PlayerAvailabilityDto dto = grid();

        assertThat(row(dto, childPlayer).cells().get(0).status()).isEqualTo(PlayerAvailabilityCellStatus.NO_RESPONSE);
    }
}
