package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.support.SelectionEligibility.PlayerInfo;
import java.time.Instant;
import java.time.LocalDate;
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
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * Unit tests for {@link SelectionEligibility} per docs/specs/076-team-selection.md section 6 and its
 * Test Plan: the pool membership rule (roster, section-tagged, descendant section; not another
 * section's, an inactive or another club's player; a cross-club team side is roster only) and the
 * 029 age rule with its messages unchanged.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SelectionEligibilityTest {

    @Mock
    private PlayerProfileRepository playerProfileRepository;

    @Mock
    private PersonRepository personRepository;

    @Mock
    private TeamSquadMemberRepository teamSquadMemberRepository;

    @Mock
    private PlayerSectionRepository playerSectionRepository;

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private SeasonRepository seasonRepository;

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private AccessService accessService;

    private SelectionEligibility eligibility;
    private final UUID clubId = UUID.randomUUID();
    private final UUID seasonId = UUID.randomUUID();
    private final UUID sectionId = UUID.randomUUID();
    private final UUID childSectionId = UUID.randomUUID();
    private final Team team = Team.builder().id(UUID.randomUUID()).clubId(clubId).sectionId(sectionId).name("1st XI")
            .active(true).build();
    private final Match match = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamId(team.getId())
            .seasonId(seasonId).matchDate(Instant.now()).active(true).build();

    @BeforeEach
    void setUp() {
        eligibility = new SelectionEligibility(playerProfileRepository, personRepository, teamSquadMemberRepository,
                playerSectionRepository, leagueRepository, new LeagueAgeReference(matchRepository, seasonRepository, org.mockito.Mockito.mock(com.cricketlegend.repository.LeagueSeasonRepository.class)),
                accessService);
        when(accessService.sectionAndDescendantIds(clubId, sectionId)).thenReturn(Set.of(sectionId, childSectionId));
    }

    private PlayerInfo info(UUID id, UUID playerClubId, boolean active, LocalDate dob) {
        return new PlayerInfo(id, playerClubId, active, "First" + id.toString().substring(0, 4), "Last", null, dob);
    }

    private PlayerInfo activePlayer() {
        return info(UUID.randomUUID(), clubId, true, LocalDate.of(2010, 1, 1));
    }

    private final java.util.List<UUID> roster = new java.util.ArrayList<>();
    private final java.util.List<UUID> tagged = new java.util.ArrayList<>();

    private List<TeamSquadMember> rosterOf(UUID ignored) {
        return roster.stream().map(id -> TeamSquadMember.builder().teamId(team.getId()).seasonId(seasonId)
                .playerProfileId(id).build()).toList();
    }

    private void stubMembership() {
        when(teamSquadMemberRepository.findByTeamIdAndSeasonId(team.getId(), seasonId)).thenAnswer(i -> rosterOf(null));
        when(playerSectionRepository.findBySectionIdIn(any())).thenAnswer(i -> tagged.stream()
                .map(id -> PlayerSection.builder().playerProfileId(id).sectionId(sectionId).build()).toList());
    }

    private Set<UUID> notInPool(Team forTeam, PlayerInfo... players) {
        stubMembership();
        Map<UUID, PlayerInfo> byId = new java.util.HashMap<>();
        for (PlayerInfo player : players) {
            byId.put(player.playerProfileId(), player);
        }
        return eligibility.notInPool(match, forTeam, byId.keySet(), byId);
    }

    // --- loadPlayers ---

    @Test
    void loadPlayersReturnsNamesClubDobAndJerseyInOneBatchAndOmitsUnknownIds() {
        UUID personId = UUID.randomUUID();
        UUID profileId = UUID.randomUUID();
        UUID unknown = UUID.randomUUID();
        when(playerProfileRepository.findAllById(any())).thenReturn(List.of(PlayerProfile.builder().id(profileId)
                .personId(personId).clubId(clubId).active(true).jerseyNumber(7).build()));
        when(personRepository.findAllById(any())).thenReturn(List.of(Person.builder().id(personId).firstName("Jaden")
                .lastName("Smith").dateOfBirth(LocalDate.of(2012, 5, 5)).build()));

        Map<UUID, PlayerInfo> result = eligibility.loadPlayers(Set.of(profileId, unknown));

        assertThat(result).containsOnlyKeys(profileId);
        PlayerInfo info = result.get(profileId);
        assertThat(info.fullName()).isEqualTo("Jaden Smith");
        assertThat(info.clubId()).isEqualTo(clubId);
        assertThat(info.active()).isTrue();
        assertThat(info.profileJerseyNumber()).isEqualTo(7);
        assertThat(info.dateOfBirth()).isEqualTo(LocalDate.of(2012, 5, 5));
    }

    @Test
    void loadPlayersWithNoIdsMakesNoQueries() {
        assertThat(eligibility.loadPlayers(Set.of())).isEmpty();
        verifyNoInteractions(playerProfileRepository, personRepository);
    }

    // --- pool membership ---

    @Test
    void aRosterMemberIsSelectable() {
        PlayerInfo player = activePlayer();
        roster.add(player.playerProfileId());

        assertThat(notInPool(team, player)).isEmpty();
    }

    @Test
    void aSectionTaggedNonRosterMemberIsSelectable() {
        PlayerInfo player = activePlayer();
        tagged.add(player.playerProfileId());

        assertThat(notInPool(team, player)).isEmpty();
    }

    @Test
    void aMemberTaggedToADescendantSectionIsSelectable() {
        PlayerInfo player = activePlayer();
        tagged.add(player.playerProfileId());
        when(playerSectionRepository.findBySectionIdIn(Set.of(sectionId, childSectionId)))
                .thenReturn(List.of(PlayerSection.builder().playerProfileId(player.playerProfileId())
                        .sectionId(childSectionId).build()));

        assertThat(eligibility.sectionTaggedIds(match, team)).containsExactly(player.playerProfileId());
    }

    @Test
    void aPlayerOnNeitherTheRosterNorInTheSectionTreeIsNotInThePool() {
        PlayerInfo other = activePlayer();

        assertThat(notInPool(team, other)).containsExactly(other.playerProfileId());
    }

    @Test
    void anInactivePlayerIsNotInThePoolEvenOnTheRoster() {
        PlayerInfo inactive = info(UUID.randomUUID(), clubId, false, LocalDate.of(2010, 1, 1));
        roster.add(inactive.playerProfileId());

        assertThat(notInPool(team, inactive)).containsExactly(inactive.playerProfileId());
    }

    @Test
    void anotherClubsPlayerIsNotInThePoolEvenOnTheRoster() {
        PlayerInfo foreign = info(UUID.randomUUID(), UUID.randomUUID(), true, LocalDate.of(2010, 1, 1));
        roster.add(foreign.playerProfileId());

        assertThat(notInPool(team, foreign)).containsExactly(foreign.playerProfileId());
    }

    @Test
    void anUnknownPlayerIsNotInThePool() {
        UUID unknown = UUID.randomUUID();
        roster.add(unknown);
        stubMembership();

        assertThat(eligibility.notInPool(match, team, List.of(unknown), Map.of())).containsExactly(unknown);
    }

    @Test
    void aCrossClubTeamSideIsRosterOnlyWithNoSectionTree() {
        Team otherClubTeam = Team.builder().id(team.getId()).clubId(UUID.randomUUID()).sectionId(sectionId)
                .name("Visitors").active(true).build();
        PlayerInfo onRoster = activePlayer();
        PlayerInfo taggedOnly = activePlayer();
        roster.add(onRoster.playerProfileId());
        tagged.add(taggedOnly.playerProfileId());

        assertThat(notInPool(otherClubTeam, onRoster, taggedOnly)).containsExactly(taggedOnly.playerProfileId());
        assertThat(eligibility.sectionTaggedIds(match, otherClubTeam)).isEmpty();
    }

    @Test
    void noPlayersMeansNobodyOutsideThePoolAndNoLookups() {
        assertThat(eligibility.notInPool(match, team, List.of(), Map.of())).isEmpty();
        verifyNoInteractions(teamSquadMemberRepository, playerSectionRepository);
    }

    // --- age rule ---

    private League league(Integer minAge, Integer maxAge, LocalDate cutoff) {
        return league(minAge, maxAge, cutoff == null ? null : cutoff.getMonthValue(),
                cutoff == null ? null : cutoff.getDayOfMonth(), LocalDate.of(cutoff == null ? 2026 : cutoff.getYear(), 9, 1));
    }

    /** Spec 110: the cut-off is a day and month; the season (and so the league start) begins on {@code seasonStart}. */
    private League league(Integer minAge, Integer maxAge, Integer cutoffMonth, Integer cutoffDay, LocalDate seasonStart) {
        org.mockito.Mockito.lenient().when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(Season.builder()
                .id(seasonId).clubId(clubId).label("S").startDate(seasonStart).endDate(seasonStart.plusYears(1)).build()));
        League league = League.builder().id(UUID.randomUUID()).clubId(clubId).name("U15s")
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).minAge(minAge).maxAge(maxAge)
                .ageCutoffMonth(cutoffMonth).ageCutoffDay(cutoffDay).active(true).build();
        when(leagueRepository.findById(league.getId())).thenReturn(Optional.of(league));
        match.setLeagueId(league.getId());
        return league;
    }

    private Map<UUID, String> ageProblems(PlayerInfo... players) {
        Map<UUID, PlayerInfo> byId = new java.util.HashMap<>();
        for (PlayerInfo player : players) {
            byId.put(player.playerProfileId(), player);
        }
        return eligibility.ageProblems(match, byId.keySet(), byId);
    }

    private PlayerInfo namedAged(String first, LocalDate dob) {
        return new PlayerInfo(UUID.randomUUID(), clubId, true, first, "Kid", null, dob);
    }

    @Test
    void aMatchWithNoLeagueHasNoAgeRule() {
        match.setLeagueId(null);

        assertThat(ageProblems(namedAged("Old", null))).isEmpty();
        verifyNoInteractions(leagueRepository);
    }

    @Test
    void aLeagueWithoutAMinOrMaxAgeHasNoAgeRule() {
        league(null, null, null);

        assertThat(ageProblems(namedAged("Old", null))).isEmpty();
    }

    @Test
    void belowMinAgeAndAboveMaxAgeAreRejectedWithTheUnchangedMessages() {
        league(13, 15, LocalDate.of(2026, 9, 1));
        PlayerInfo tooYoung = namedAged("Tim", LocalDate.of(2015, 1, 1));
        PlayerInfo tooOld = namedAged("Tom", LocalDate.of(2009, 1, 1));
        PlayerInfo justRight = namedAged("Jay", LocalDate.of(2012, 1, 1));

        Map<UUID, String> problems = ageProblems(tooYoung, tooOld, justRight);

        assertThat(problems).containsOnlyKeys(tooYoung.playerProfileId(), tooOld.playerProfileId());
        assertThat(problems.get(tooYoung.playerProfileId())).isEqualTo("Tim Kid is 11, below this league's minAge of 13 as at 1 Sep 2026");
        assertThat(problems.get(tooOld.playerProfileId())).isEqualTo("Tom Kid is 17, above this league's maxAge of 15 as at 1 Sep 2026");
    }

    @Test
    void theAgeIsTakenAtTheCutoffDateNotToday() {
        league(13, 15, LocalDate.of(2026, 9, 1));
        PlayerInfo turnsThirteenTheDayAfter = namedAged("Ben", LocalDate.of(2013, 9, 2));
        PlayerInfo turnedThirteenOnTheDay = namedAged("Sam", LocalDate.of(2013, 9, 1));

        assertThat(ageProblems(turnsThirteenTheDayAfter, turnedThirteenOnTheDay))
                .containsOnlyKeys(turnsThirteenTheDayAfter.playerProfileId());
    }

    @Test
    void withoutACutoffAndWithoutMatchesTheSeasonsStartDateIsUsed() {
        league(13, null, null, null, LocalDate.of(2026, 1, 1));
        PlayerInfo player = namedAged("Ann", LocalDate.of(2013, 6, 1));

        assertThat(ageProblems(player).get(player.playerProfileId()))
                .isEqualTo("Ann Kid is 12, below this league's minAge of 13 as at 1 Jan 2026");
    }

    @Test
    void withoutACutoffTheLeaguesFirstActiveMatchDayIsUsed() {
        // Spec 110 rule 2: a winter league judges age on the day it starts (here 10 July), not the season start.
        league(null, 13, null, null, LocalDate.of(2026, 1, 1));
        org.mockito.Mockito.when(matchRepository.findFirstMatchDates(any(), any())).thenReturn(List.of(
                firstMatch(match.getLeagueId(), seasonId, java.time.ZonedDateTime
                        .of(2026, 7, 10, 9, 0, 0, 0, java.time.ZoneId.systemDefault()).toInstant())));
        PlayerInfo turnedFourteenTheDayBefore = namedAged("Old", LocalDate.of(2012, 7, 9));
        PlayerInfo turnsFourteenOnTheDay = namedAged("Edge", LocalDate.of(2012, 7, 10));
        PlayerInfo stillThirteen = namedAged("Ok", LocalDate.of(2012, 7, 11));

        assertThat(ageProblems(turnedFourteenTheDayBefore, turnsFourteenOnTheDay, stillThirteen))
                .containsOnlyKeys(turnedFourteenTheDayBefore.playerProfileId(), turnsFourteenOnTheDay.playerProfileId());
    }

    @Test
    void aSeptemberLeagueWithA31DecemberCutoffKeepsAPlayerEligibleAllSeason() {
        // Spec 110 rule 1: judged on 31 December of the year the league starts, not when the match is played.
        league(null, 13, 12, 31, LocalDate.of(2026, 9, 1));
        org.mockito.Mockito.when(matchRepository.findFirstMatchDates(any(), any())).thenReturn(List.of(
                firstMatch(match.getLeagueId(), seasonId, java.time.ZonedDateTime
                        .of(2026, 9, 5, 9, 0, 0, 0, java.time.ZoneId.systemDefault()).toInstant())));
        PlayerInfo thirteenOnTheCutoff = namedAged("In", LocalDate.of(2013, 1, 1));
        PlayerInfo fourteenOnTheCutoff = namedAged("Out", LocalDate.of(2012, 12, 31));

        assertThat(ageProblems(thirteenOnTheCutoff, fourteenOnTheCutoff))
                .containsOnlyKeys(fourteenOnTheCutoff.playerProfileId());
    }

    private static MatchRepository.LeagueSeasonFirstMatch firstMatch(UUID leagueId, UUID seasonId, Instant at) {
        return new MatchRepository.LeagueSeasonFirstMatch() {
            public UUID getLeagueId() { return leagueId; }
            public UUID getSeasonId() { return seasonId; }
            public Instant getFirstMatchDate() { return at; }
        };
    }

    @Test
    void aMissingDateOfBirthFailsWhereThereIsAnAgeRule() {
        league(13, 15, LocalDate.of(2026, 9, 1));
        PlayerInfo unknownDob = namedAged("Nodob", null);

        assertThat(ageProblems(unknownDob).get(unknownDob.playerProfileId()))
                .isEqualTo("Nodob Kid has no recorded date of birth; required for this league's age rule");
    }

    @Test
    void aLeagueThatCannotBeFoundThrowsNotFoundException() {
        match.setLeagueId(UUID.randomUUID());

        assertThatThrownBy(() -> ageProblems(namedAged("A", LocalDate.of(2012, 1, 1))))
                .isInstanceOf(NotFoundException.class);
    }
}
