package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.MatchPhase;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSelectionState;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.MyMatchDto;
import com.cricketlegend.dto.MyMatchListDto;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.dto.MatchResultDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.MyFieldService;
import com.cricketlegend.service.ResultService;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.MyPlayerAccess;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;

/** docs/specs/135 rules in {@link MyMatchServiceImpl}, plain Mockito (access itself is covered by the integration test). */
class MyMatchServiceImplTest {

    private final UUID clubId = UUID.randomUUID();
    private final UUID profileId = UUID.randomUUID();
    private final UUID seasonId = UUID.randomUUID();
    private final UUID myTeamId = UUID.randomUUID();

    private final MyPlayerAccess access = mock(MyPlayerAccess.class);
    private final SeasonRepository seasonRepository = mock(SeasonRepository.class);
    private final TeamSquadMemberRepository squadRepository = mock(TeamSquadMemberRepository.class);
    private final MatchRepository matchRepository = mock(MatchRepository.class);
    private final TeamRepository teamRepository = mock(TeamRepository.class);
    private final LeagueRepository leagueRepository = mock(LeagueRepository.class);
    private final MatchSideRepository sideRepository = mock(MatchSideRepository.class);
    private final MatchSidePlayerRepository sidePlayerRepository = mock(MatchSidePlayerRepository.class);
    private final MatchAvailabilityPollRepository pollRepository = mock(MatchAvailabilityPollRepository.class);
    private final PlayerAvailabilityRepository availabilityRepository = mock(PlayerAvailabilityRepository.class);
    private final PlayerProfileRepository profileRepository = mock(PlayerProfileRepository.class);
    private final PersonRepository personRepository = mock(PersonRepository.class);
    private final ResultService resultService = mock(ResultService.class);
    private final MyFieldService fieldService = mock(MyFieldService.class);
    private final Authentication authentication = mock(Authentication.class);

    private MyMatchServiceImpl service;
    private Match match;
    private MatchSide mySide;

    @BeforeEach
    void setUp() {
        service = new MyMatchServiceImpl(access, seasonRepository, squadRepository, matchRepository, teamRepository,
                leagueRepository, sideRepository, sidePlayerRepository, pollRepository, availabilityRepository,
                profileRepository, personRepository, resultService, fieldService);
        PlayerProfile profile = PlayerProfile.builder().id(profileId).clubId(clubId).active(true).build();
        Person subject = Person.builder().dateOfBirth(LocalDate.of(1990, 1, 1)).build();
        when(access.resolve(authentication, "key")).thenReturn(new HeldPlayer("key", null, subject, profile, null));
        when(squadRepository.findByPlayerProfileId(profileId)).thenReturn(List.of(
                TeamSquadMember.builder().teamId(myTeamId).seasonId(seasonId).playerProfileId(profileId).build()));
        Team team = Team.builder().id(myTeamId).clubId(clubId).name("Colts").active(true).build();
        when(teamRepository.findAllById(any())).thenReturn(List.of(team));
        when(leagueRepository.findAllById(any())).thenReturn(List.of());
        when(resultService.publishedResults(any(), any())).thenReturn(Map.of());
        when(sideRepository.findByMatchIdIn(any())).thenAnswer(i -> mySide == null ? List.of() : List.of(mySide));
        when(sidePlayerRepository.findByMatchSideIdIn(any())).thenReturn(List.of());
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(
                Season.builder().id(seasonId).clubId(clubId).label("2026").build()));
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of(Season.builder().id(seasonId).clubId(clubId)
                .label("2026").startDate(LocalDate.now().minusDays(30)).endDate(LocalDate.now().plusDays(30))
                .createdAt(Instant.now()).build()));
        when(pollRepository.findByMatchIdAndTeamId(any(), any())).thenReturn(Optional.empty());
        when(fieldService.describe(any(), any())).thenReturn(List.of());
        match = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamId(myTeamId).awayTeamName("Visitors")
                .seasonId(seasonId).matchDate(Instant.now().minus(1, ChronoUnit.HOURS)).active(true)
                .scoringUrl("https://scores.example.com/1").streamingUrl("https://youtu.be/dQw4w9WgXcQ").build();
        when(matchRepository.findById(match.getId())).thenAnswer(i -> Optional.of(match));
    }

    @Test
    void aMatchOfAnotherTeamUnknownIdOrAnotherClubIsNotFound() {
        Match other = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamId(UUID.randomUUID())
                .awayTeamName("X").seasonId(seasonId).matchDate(Instant.now()).active(true).build();
        when(matchRepository.findById(other.getId())).thenReturn(Optional.of(other));
        Match foreign = Match.builder().id(UUID.randomUUID()).clubId(UUID.randomUUID()).homeTeamId(myTeamId)
                .awayTeamName("X").seasonId(seasonId).matchDate(Instant.now()).active(true).build();
        when(matchRepository.findById(foreign.getId())).thenReturn(Optional.of(foreign));
        when(matchRepository.findById(any(UUID.class))).thenAnswer(i -> i.getArgument(0).equals(other.getId())
                ? Optional.of(other) : i.getArgument(0).equals(foreign.getId()) ? Optional.of(foreign) : Optional.empty());

        for (UUID id : List.of(other.getId(), foreign.getId(), UUID.randomUUID())) {
            assertThatThrownBy(() -> service.get(authentication, "key", id)).isInstanceOf(NotFoundException.class);
        }
    }

    @Test
    void aMatchInASeasonThePlayerIsNotSquadedForIsNotFound() {
        match.setSeasonId(UUID.randomUUID());

        assertThatThrownBy(() -> service.get(authentication, "key", match.getId())).isInstanceOf(NotFoundException.class);
    }

    @Test
    void anUnannouncedSideListsNoPlayersAndTheSelectionIsNotAnnounced() {
        mySide = MatchSide.builder().id(UUID.randomUUID()).matchId(match.getId()).teamId(myTeamId).announced(false).build();

        MyMatchDto dto = service.get(authentication, "key", match.getId());

        assertThat(dto.selection()).isEqualTo(MatchSelectionState.NOT_ANNOUNCED);
        assertThat(dto.home().announced()).isFalse();
        assertThat(dto.home().players()).isEmpty();
        assertThat(dto.home().mine()).isTrue();
        assertThat(dto.away().mine()).isFalse();
    }

    @Test
    void anAnnouncedSideGivesSelectedNotSelectedAndTheTwelfthManIsSelected() {
        UUID other = UUID.randomUUID();
        UUID twelfth = UUID.randomUUID();
        mySide = MatchSide.builder().id(UUID.randomUUID()).matchId(match.getId()).teamId(myTeamId).announced(true)
                .twelfthManPlayerId(twelfth).build();
        when(sidePlayerRepository.findByMatchSideIdIn(any())).thenReturn(List.of(
                MatchSidePlayer.builder().matchSideId(mySide.getId()).playerProfileId(other).battingOrder(1).build()));

        assertThat(service.get(authentication, "key", match.getId()).selection()).isEqualTo(MatchSelectionState.NOT_SELECTED);

        mySide.setTwelfthManPlayerId(profileId);
        assertThat(service.get(authentication, "key", match.getId()).selection()).isEqualTo(MatchSelectionState.SELECTED);

        mySide.setTwelfthManPlayerId(twelfth);
        when(sidePlayerRepository.findByMatchSideIdIn(any())).thenReturn(List.of(
                MatchSidePlayer.builder().matchSideId(mySide.getId()).playerProfileId(profileId).battingOrder(1).build()));
        assertThat(service.get(authentication, "key", match.getId()).selection()).isEqualTo(MatchSelectionState.SELECTED);
    }

    @Test
    void juniorsAppearAsInitialsAndAdultsInAnAdultMatchByFullName() {
        UUID kid = UUID.randomUUID();
        UUID adult = UUID.randomUUID();
        mySide = MatchSide.builder().id(UUID.randomUUID()).matchId(match.getId()).teamId(myTeamId).announced(true).build();
        when(sidePlayerRepository.findByMatchSideIdIn(any())).thenReturn(List.of(
                MatchSidePlayer.builder().matchSideId(mySide.getId()).playerProfileId(kid).battingOrder(1).build(),
                MatchSidePlayer.builder().matchSideId(mySide.getId()).playerProfileId(adult).battingOrder(2).build()));
        UUID kidPerson = UUID.randomUUID();
        UUID adultPerson = UUID.randomUUID();
        when(profileRepository.findAllById(any())).thenReturn(List.of(
                PlayerProfile.builder().id(kid).personId(kidPerson).build(),
                PlayerProfile.builder().id(adult).personId(adultPerson).build()));
        when(personRepository.findAllById(any())).thenReturn(List.of(
                Person.builder().id(kidPerson).firstName("Mandla").lastName("Naidoo")
                        .dateOfBirth(LocalDate.now().minusYears(12)).build(),
                Person.builder().id(adultPerson).firstName("Pat").lastName("Jones")
                        .dateOfBirth(LocalDate.now().minusYears(30)).build()));

        MyMatchDto dto = service.get(authentication, "key", match.getId());

        assertThat(dto.home().players()).extracting("name").containsExactly("M. Naidoo", "Pat Jones");
    }

    @Test
    void theStreamIsReturnedWhileLiveAndAfterwardsButNotBeforeTheMatch() {
        assertThat(service.get(authentication, "key", match.getId()).stream().embedUrl())
                .isEqualTo("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
        assertThat(service.get(authentication, "key", match.getId()).phase()).isEqualTo(MatchPhase.LIVE);

        match.setMatchDate(Instant.now().plus(2, ChronoUnit.DAYS));
        MyMatchDto upcoming = service.get(authentication, "key", match.getId());
        assertThat(upcoming.phase()).isEqualTo(MatchPhase.UPCOMING);
        assertThat(upcoming.stream()).isNull();
        assertThat(upcoming.startedAt()).isNull();
        assertThat(upcoming.liveScore()).isNotNull();

        match.setMatchDate(Instant.now().minus(30, ChronoUnit.HOURS));
        MyMatchDto old = service.get(authentication, "key", match.getId());
        // A finished match keeps its recording and scoring links (owner, 2026-11-12).
        assertThat(old.phase()).isEqualTo(MatchPhase.RECENT);
        assertThat(old.stream()).isNotNull();
        assertThat(old.liveScore()).isNotNull();
    }

    @Test
    void aNonHttpsStreamOrScoringLinkIsDropped() {
        match.setStreamingUrl("javascript:alert(1)");
        match.setScoringUrl("http://scores.example.com/1");

        MyMatchDto dto = service.get(authentication, "key", match.getId());

        assertThat(dto.stream()).isNull();
        assertThat(dto.liveScore()).isNull();
    }

    @Test
    void aPlayerWithNoSquadHasNoMatches() {
        when(squadRepository.findByPlayerProfileId(profileId)).thenReturn(List.of());

        MyMatchListDto list = service.list(authentication, "key", null);

        assertThat(list.live()).isEmpty();
        assertThat(list.upcoming()).isEmpty();
        assertThat(list.recent()).isEmpty();
    }

    @Test
    void theListSplitsLiveUpcomingAndRecentAndCapsThem() {
        Instant now = Instant.now();
        List<Match> all = new java.util.ArrayList<>();
        all.add(match); // live (started 1h ago)
        for (int i = 1; i <= 25; i++) {
            all.add(matchAt(now.plus(i, ChronoUnit.DAYS)));
        }
        List<Match> past = new java.util.ArrayList<>();
        for (int i = 1; i <= 15; i++) {
            past.add(matchAt(now.minus(10L + i, ChronoUnit.DAYS)));
        }
        when(matchRepository.findActiveForTeamsFrom(any(), any(), any(), any())).thenReturn(all);
        when(matchRepository.findActiveForTeamsBefore(any(), any(), any(), any())).thenReturn(past);

        MyMatchListDto list = service.list(authentication, "key", null);

        assertThat(list.live()).hasSize(1);
        assertThat(list.live().get(0).startedAt()).isNotNull();
        assertThat(list.live().get(0).hasLiveScore()).isTrue();
        assertThat(list.live().get(0).hasStream()).isTrue();
        assertThat(list.upcoming()).hasSize(MyMatchServiceImpl.UPCOMING_CAP);
        assertThat(list.upcoming().get(0).date()).isBefore(list.upcoming().get(1).date());
        assertThat(list.upcoming().get(0).hasStream()).isFalse();
        assertThat(list.recent()).hasSize(MyMatchServiceImpl.RECENT_CAP);
        assertThat(list.recent().get(0).date()).isAfter(list.recent().get(1).date());
        assertThat(list.upcomingTotal()).isEqualTo(25);
        assertThat(list.recentTotal()).isEqualTo(15);
    }

    @Test
    void aLargerRecentLimitReturnsMoreAndTheTotalsAreTheUncappedCounts() {
        Instant now = Instant.now();
        List<Match> past = new java.util.ArrayList<>();
        for (int i = 1; i <= 30; i++) {
            past.add(matchAt(now.minus(10L + i, ChronoUnit.DAYS)));
        }
        when(matchRepository.findActiveForTeamsFrom(any(), any(), any(), any())).thenReturn(List.of());
        when(matchRepository.findActiveForTeamsBefore(any(), any(), any(), any())).thenReturn(past);

        MyMatchListDto def = service.list(authentication, "key", null);
        MyMatchListDto more = service.list(authentication, "key", 25);
        MyMatchListDto all = service.list(authentication, "key", 100);

        assertThat(def.recent()).hasSize(10);
        assertThat(more.recent()).hasSize(25);
        assertThat(all.recent()).hasSize(30);
        assertThat(def.recentTotal()).isEqualTo(30);
        assertThat(more.recentTotal()).isEqualTo(30);
        assertThat(def.upcomingTotal()).isZero();
    }

    @Test
    void aRecentLimitOutsideOneToAHundredIsRefused() {
        assertThatThrownBy(() -> service.list(authentication, "key", 0)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.list(authentication, "key", 101)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.list(authentication, "key", -5)).isInstanceOf(ValidationException.class);
    }

    @Test
    void theOutcomeIsFromTheHeldPlayersSideOrNull() {
        UUID other = UUID.randomUUID();
        Set<UUID> mine = Set.of(myTeamId);
        Match home = matchAt(Instant.now());
        Match away = Match.builder().id(UUID.randomUUID()).homeTeamId(other).awayTeamId(myTeamId).build();
        Match internal = Match.builder().id(UUID.randomUUID()).homeTeamId(myTeamId).awayTeamId(myTeamId).build();
        Match foreign = Match.builder().id(UUID.randomUUID()).homeTeamId(other).awayTeamName("X").build();

        assertThat(MyMatchServiceImpl.outcomeFor(res(ResultOutcomeType.WON, ResultSide.HOME), home, mine)).isEqualTo("WON");
        assertThat(MyMatchServiceImpl.outcomeFor(res(ResultOutcomeType.WON, ResultSide.AWAY), home, mine)).isEqualTo("LOST");
        assertThat(MyMatchServiceImpl.outcomeFor(res(ResultOutcomeType.WON, ResultSide.AWAY), away, mine)).isEqualTo("WON");
        assertThat(MyMatchServiceImpl.outcomeFor(res(ResultOutcomeType.FORFEIT, ResultSide.HOME), away, mine)).isEqualTo("LOST");
        assertThat(MyMatchServiceImpl.outcomeFor(res(ResultOutcomeType.TIE, null), home, mine)).isEqualTo("TIED");
        assertThat(MyMatchServiceImpl.outcomeFor(res(ResultOutcomeType.DRAW, null), home, mine)).isNull();
        assertThat(MyMatchServiceImpl.outcomeFor(res(ResultOutcomeType.NO_RESULT, null), home, mine)).isNull();
        assertThat(MyMatchServiceImpl.outcomeFor(res(ResultOutcomeType.ABANDONED, null), home, mine)).isNull();
        assertThat(MyMatchServiceImpl.outcomeFor(res(ResultOutcomeType.WON, null), home, mine)).isNull();
        assertThat(MyMatchServiceImpl.outcomeFor(res(ResultOutcomeType.WON, ResultSide.HOME), internal, mine)).isNull();
        assertThat(MyMatchServiceImpl.outcomeFor(res(ResultOutcomeType.WON, ResultSide.HOME), foreign, mine)).isNull();
        assertThat(MyMatchServiceImpl.outcomeFor(null, home, mine)).isNull();
    }

    private static MatchResultDto res(ResultOutcomeType type, ResultSide winner) {
        return new MatchResultDto(null, null, null, null, null, type, null, winner, null, null, null, null, null, 6,
                null, null, null, null, null, null, null, null, null, true, null, null, null, List.of(), false, false);
    }

    private Match matchAt(Instant when) {
        return Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamId(myTeamId).awayTeamName("V")
                .seasonId(seasonId).matchDate(when).active(true).build();
    }
}
