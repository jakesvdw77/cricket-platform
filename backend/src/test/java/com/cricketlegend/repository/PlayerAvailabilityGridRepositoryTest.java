package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.MatchSquadMember;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.PlayingRole;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.transaction.annotation.Transactional;

/**
 * Testcontainers tests for the IN-list batch queries and {@code MatchSpecifications.teamIdEquals}
 * added for the player availability grid (docs/specs/068-player-availability-grid.md). Each test
 * saves matching and non-matching rows and proves only the requested ids come back.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class PlayerAvailabilityGridRepositoryTest {

    @Autowired private ClubRepository clubRepository;
    @Autowired private SectionRepository sectionRepository;
    @Autowired private TeamRepository teamRepository;
    @Autowired private SeasonRepository seasonRepository;
    @Autowired private MatchRepository matchRepository;
    @Autowired private MatchSideRepository matchSideRepository;
    @Autowired private MatchSidePlayerRepository matchSidePlayerRepository;
    @Autowired private MatchSquadMemberRepository matchSquadMemberRepository;
    @Autowired private MatchAvailabilityPollRepository pollRepository;
    @Autowired private PlayerAvailabilityRepository playerAvailabilityRepository;
    @Autowired private SectionAvailabilityRoundRepository roundRepository;
    @Autowired private SectionAvailabilityWindowRepository windowRepository;
    @Autowired private SectionAvailabilityWindowMatchRepository windowMatchRepository;
    @Autowired private SectionAvailabilityResponseRepository responseRepository;
    @Autowired private TeamSquadMemberRepository teamSquadMemberRepository;
    @Autowired private PlayerSectionRepository playerSectionRepository;
    @Autowired private PersonRepository personRepository;
    @Autowired private PlayerProfileRepository playerProfileRepository;

    private Club club() {
        return clubRepository.save(Club.builder().name("Riverside CC").slug("riverside-cc").status(ClubStatus.ACTIVE).build());
    }

    private Section section(Club club, String name) {
        return sectionRepository.save(Section.builder().clubId(club.getId()).name(name).active(true).build());
    }

    private Team team(Club club, Section section, String name) {
        return teamRepository.save(Team.builder().clubId(club.getId()).sectionId(section.getId()).name(name).active(true).build());
    }

    private Season season(Club club, String label) {
        return seasonRepository.save(Season.builder().clubId(club.getId()).label(label)
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
    }

    private Match match(Club club, Season season, Team home) {
        return matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(home.getId())
                .awayTeamName("Occasionals").seasonId(season.getId()).matchDate(Instant.now()).active(true).build());
    }

    private PlayerProfile player(Club club) {
        Person person = personRepository.save(Person.builder().firstName("Joe").lastName("Bloggs").build());
        return playerProfileRepository.save(PlayerProfile.builder().personId(person.getId()).clubId(club.getId()).active(true).build());
    }

    private SectionAvailabilityWindow window(Club club, Section section) {
        return window(club, section, DayPart.MORNING);
    }

    private SectionAvailabilityWindow window(Club club, Section section, DayPart dayPart) {
        SectionAvailabilityRound round = roundRepository.save(SectionAvailabilityRound.builder().clubId(club.getId())
                .sectionId(section.getId()).description("Round").firstMatchDate(LocalDate.of(2026, 10, 10))
                .lastMatchDate(LocalDate.of(2026, 10, 11)).autoClose(true).open(true).build());
        return windowRepository.save(SectionAvailabilityWindow.builder().clubId(club.getId()).sectionId(section.getId())
                .roundId(round.getId()).windowDate(LocalDate.of(2026, 10, 10)).dayPart(dayPart).open(true).build());
    }

    @Test
    void windowMatchFindByMatchIdInReturnsOnlyLinksOfTheGivenMatches() {
        Club club = club();
        Section section = section(club, "Men");
        Team team = team(club, section, "1st XI");
        Season season = season(club, "2026");
        Match first = match(club, season, team);
        Match second = match(club, season, team);
        Match other = match(club, season, team);
        SectionAvailabilityWindow window = window(club, section);
        for (Match m : List.of(first, second, other)) {
            windowMatchRepository.save(SectionAvailabilityWindowMatch.builder().windowId(window.getId()).matchId(m.getId()).build());
        }

        assertThat(windowMatchRepository.findByMatchIdIn(Set.of(first.getId(), second.getId())))
                .extracting(SectionAvailabilityWindowMatch::getMatchId)
                .containsExactlyInAnyOrder(first.getId(), second.getId());
    }

    @Test
    void pollFindByMatchIdInReturnsOnlyPollsOfTheGivenMatches() {
        Club club = club();
        Section section = section(club, "Men");
        Team team = team(club, section, "1st XI");
        Season season = season(club, "2026");
        Match first = match(club, season, team);
        Match other = match(club, season, team);
        pollRepository.save(MatchAvailabilityPoll.builder().matchId(first.getId()).teamId(team.getId()).open(true).build());
        pollRepository.save(MatchAvailabilityPoll.builder().matchId(other.getId()).teamId(team.getId()).open(true).build());

        assertThat(pollRepository.findByMatchIdIn(Set.of(first.getId())))
                .extracting(MatchAvailabilityPoll::getMatchId)
                .containsExactly(first.getId());
    }

    @Test
    void playerAvailabilityFindByPollIdInReturnsOnlyAnswersOfTheGivenPolls() {
        Club club = club();
        Section section = section(club, "Men");
        Team team = team(club, section, "1st XI");
        Season season = season(club, "2026");
        MatchAvailabilityPoll pollA = pollRepository.save(MatchAvailabilityPoll.builder()
                .matchId(match(club, season, team).getId()).teamId(team.getId()).open(true).build());
        MatchAvailabilityPoll pollB = pollRepository.save(MatchAvailabilityPoll.builder()
                .matchId(match(club, season, team).getId()).teamId(team.getId()).open(true).build());
        PlayerProfile player = player(club);
        playerAvailabilityRepository.save(PlayerAvailability.builder().pollId(pollA.getId())
                .playerProfileId(player.getId()).status(AvailabilityStatus.AVAILABLE).build());
        playerAvailabilityRepository.save(PlayerAvailability.builder().pollId(pollB.getId())
                .playerProfileId(player.getId()).status(AvailabilityStatus.UNSURE).build());

        assertThat(playerAvailabilityRepository.findByPollIdIn(Set.of(pollA.getId())))
                .extracting(PlayerAvailability::getStatus)
                .containsExactly(AvailabilityStatus.AVAILABLE);
    }

    @Test
    void sectionResponseFindByWindowIdInReturnsOnlyResponsesOfTheGivenWindows() {
        Club club = club();
        Section section = section(club, "Men");
        SectionAvailabilityWindow windowA = window(club, section);
        SectionAvailabilityWindow windowB = window(club, section, DayPart.AFTERNOON);
        PlayerProfile player = player(club);
        responseRepository.save(SectionAvailabilityResponse.builder().windowId(windowA.getId())
                .playerProfileId(player.getId()).status(AvailabilityStatus.UNAVAILABLE).build());
        responseRepository.save(SectionAvailabilityResponse.builder().windowId(windowB.getId())
                .playerProfileId(player.getId()).status(AvailabilityStatus.AVAILABLE).build());

        assertThat(responseRepository.findByWindowIdIn(Set.of(windowA.getId())))
                .extracting(SectionAvailabilityResponse::getStatus)
                .containsExactly(AvailabilityStatus.UNAVAILABLE);
    }

    @Test
    void matchSquadMemberFindByMatchIdInReturnsOnlyMembersOfTheGivenMatches() {
        Club club = club();
        Section section = section(club, "Men");
        Team team = team(club, section, "1st XI");
        Season season = season(club, "2026");
        Match first = match(club, season, team);
        Match other = match(club, season, team);
        SectionAvailabilityWindow window = window(club, section);
        for (Match m : List.of(first, other)) {
            matchSquadMemberRepository.save(MatchSquadMember.builder().matchId(m.getId()).teamId(team.getId())
                    .sectionAvailabilityWindowId(window.getId()).playerProfileId(player(club).getId()).build());
        }

        assertThat(matchSquadMemberRepository.findByMatchIdIn(Set.of(first.getId())))
                .extracting(MatchSquadMember::getMatchId)
                .containsExactly(first.getId());
    }

    @Test
    void matchSidePlayerFindByMatchSideIdInReturnsOnlyPlayersOfTheGivenSides() {
        Club club = club();
        Section section = section(club, "Men");
        Team team = team(club, section, "1st XI");
        Season season = season(club, "2026");
        MatchSide sideA = matchSideRepository.save(MatchSide.builder().matchId(match(club, season, team).getId()).teamId(team.getId()).build());
        MatchSide sideB = matchSideRepository.save(MatchSide.builder().matchId(match(club, season, team).getId()).teamId(team.getId()).build());
        PlayerProfile player = player(club);
        matchSidePlayerRepository.save(MatchSidePlayer.builder().matchSideId(sideA.getId())
                .playerProfileId(player.getId()).battingOrder(1).role(PlayingRole.BATSMAN).build());
        matchSidePlayerRepository.save(MatchSidePlayer.builder().matchSideId(sideB.getId())
                .playerProfileId(player.getId()).battingOrder(1).role(PlayingRole.BATSMAN).build());

        assertThat(matchSidePlayerRepository.findByMatchSideIdIn(Set.of(sideA.getId())))
                .extracting(MatchSidePlayer::getMatchSideId)
                .containsExactly(sideA.getId());
    }

    @Test
    void teamSquadMemberFindByTeamIdInAndSeasonIdInReturnsTheTeamSeasonCrossProduct() {
        Club club = club();
        Section section = section(club, "Men");
        Team teamA = team(club, section, "1st XI");
        Team teamB = team(club, section, "2nd XI");
        Season s2025 = season(club, "2025");
        Season s2026 = season(club, "2026");
        PlayerProfile player = player(club);
        teamSquadMemberRepository.save(TeamSquadMember.builder().teamId(teamA.getId()).seasonId(s2026.getId()).playerProfileId(player.getId()).build());
        teamSquadMemberRepository.save(TeamSquadMember.builder().teamId(teamA.getId()).seasonId(s2025.getId()).playerProfileId(player.getId()).build());
        teamSquadMemberRepository.save(TeamSquadMember.builder().teamId(teamB.getId()).seasonId(s2026.getId()).playerProfileId(player.getId()).build());

        assertThat(teamSquadMemberRepository.findByTeamIdInAndSeasonIdIn(Set.of(teamA.getId()), Set.of(s2026.getId())))
                .extracting(TeamSquadMember::getTeamId, TeamSquadMember::getSeasonId)
                .containsExactly(org.assertj.core.groups.Tuple.tuple(teamA.getId(), s2026.getId()));
        assertThat(teamSquadMemberRepository.findByTeamIdInAndSeasonIdIn(
                        Set.of(teamA.getId(), teamB.getId()), Set.of(s2025.getId(), s2026.getId())))
                .hasSize(3);
    }

    @Test
    void playerSectionFindBySectionIdInReturnsOnlyExactSections() {
        Club club = club();
        Section men = section(club, "Men");
        Section juniors = section(club, "Juniors");
        PlayerProfile playerA = player(club);
        PlayerProfile playerB = player(club);
        playerSectionRepository.save(PlayerSection.builder().playerProfileId(playerA.getId()).sectionId(men.getId()).build());
        playerSectionRepository.save(PlayerSection.builder().playerProfileId(playerB.getId()).sectionId(juniors.getId()).build());

        assertThat(playerSectionRepository.findBySectionIdIn(Set.of(men.getId())))
                .extracting(PlayerSection::getPlayerProfileId)
                .containsExactly(playerA.getId());
        assertThat(playerSectionRepository.findBySectionIdIn(Set.of(men.getId(), juniors.getId()))).hasSize(2);
    }

    @Test
    void teamIdEqualsSpecificationMatchesTheTeamAsHomeOrAwayOnly() {
        Club club = club();
        Section section = section(club, "Men");
        Team team = team(club, section, "1st XI");
        Team otherTeam = team(club, section, "2nd XI");
        Season season = season(club, "2026");
        Match home = match(club, season, team);
        Match away = matchRepository.save(Match.builder().clubId(club.getId()).homeTeamName("Visitors")
                .awayTeamId(team.getId()).seasonId(season.getId()).matchDate(Instant.now()).active(true).build());
        match(club, season, otherTeam);

        Specification<Match> spec = Specification.where(MatchSpecifications.clubId(club.getId()))
                .and(MatchSpecifications.teamIdEquals(team.getId()));

        assertThat(matchRepository.findAll(spec)).extracting(Match::getId)
                .containsExactlyInAnyOrder(home.getId(), away.getId());
    }
}
