package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.withSubject;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.MatchSquadMember;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSquadMemberRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration tests for docs/specs/068-player-availability-grid.md's endpoint: response shape,
 * section scope (403/404), team filter (404/403), and agreement with the poll endpoints for a
 * group-covered and a squad-covered game.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class PlayerAvailabilityControllerIntegrationTest {

    private static final String URL = "/api/v1/manage/clubs/{c}/player-availability";

    @Autowired private MockMvc mockMvc;
    @Autowired private ClubRepository clubRepository;
    @Autowired private SectionRepository sectionRepository;
    @Autowired private SeasonRepository seasonRepository;
    @Autowired private TeamRepository teamRepository;
    @Autowired private MatchRepository matchRepository;
    @Autowired private PersonRepository personRepository;
    @Autowired private PlayerProfileRepository playerProfileRepository;
    @Autowired private PlayerSectionRepository playerSectionRepository;
    @Autowired private TeamSquadMemberRepository teamSquadMemberRepository;
    @Autowired private RoleAssignmentRepository roleAssignmentRepository;
    @Autowired private MatchAvailabilityPollRepository pollRepository;
    @Autowired private PlayerAvailabilityRepository playerAvailabilityRepository;
    @Autowired private SectionAvailabilityRoundRepository roundRepository;
    @Autowired private SectionAvailabilityWindowRepository windowRepository;
    @Autowired private SectionAvailabilityWindowMatchRepository windowMatchRepository;
    @Autowired private SectionAvailabilityResponseRepository responseRepository;
    @Autowired private MatchSquadMemberRepository matchSquadMemberRepository;

    private record Fixture(Club club, Section section, Season season, Team team) {}

    private Fixture fixture() {
        Club club = clubRepository.save(
                Club.builder().name("Riverside CC").slug("riverside-cc").status(ClubStatus.ACTIVE).build());
        Section section = sectionRepository.save(
                Section.builder().clubId(club.getId()).name("Juniors").active(true).build());
        Season season = seasonRepository.save(Season.builder().clubId(club.getId()).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
        Team team = teamRepository.save(Team.builder().clubId(club.getId()).sectionId(section.getId())
                .name("U15 Colts").active(true).build());
        return new Fixture(club, section, season, team);
    }

    private Match newMatch(Fixture f, int daysAhead, int hourOfDay) {
        Instant date = LocalDate.now(ZoneId.systemDefault()).plus(daysAhead, ChronoUnit.DAYS)
                .atTime(hourOfDay, 0).atZone(ZoneId.systemDefault()).toInstant();
        return matchRepository.save(Match.builder().clubId(f.club.getId()).homeTeamId(f.team.getId())
                .awayTeamName("Occasionals").seasonId(f.season.getId()).matchDate(date).active(true).build());
    }

    private UUID addPlayer(Fixture f, String firstName, String lastName) {
        Person person = personRepository.save(Person.builder().firstName(firstName).lastName(lastName)
                .dateOfBirth(LocalDate.of(2010, 1, 1)).build());
        UUID id = playerProfileRepository.save(PlayerProfile.builder().personId(person.getId())
                .clubId(f.club.getId()).active(true).build()).getId();
        playerSectionRepository.save(PlayerSection.builder().playerProfileId(id).sectionId(f.section.getId()).build());
        return id;
    }

    private void addToSquad(Fixture f, UUID playerId) {
        teamSquadMemberRepository.save(TeamSquadMember.builder().teamId(f.team.getId())
                .seasonId(f.season.getId()).playerProfileId(playerId).build());
    }

    private MatchAvailabilityPoll savePoll(Match match, Team team) {
        return pollRepository.save(MatchAvailabilityPoll.builder().matchId(match.getId()).teamId(team.getId())
                .open(true).autoClose(false).build());
    }

    private SectionAvailabilityRound saveRound(Fixture f) {
        return roundRepository.save(SectionAvailabilityRound.builder().clubId(f.club.getId())
                .sectionId(f.section.getId()).description("Round").firstMatchDate(LocalDate.of(2026, 10, 10))
                .lastMatchDate(LocalDate.of(2026, 10, 11)).autoClose(false).open(true).build());
    }

    private SectionAvailabilityWindow saveWindow(Fixture f, SectionAvailabilityRound round, DayPart dayPart) {
        return windowRepository.save(SectionAvailabilityWindow.builder().clubId(f.club.getId())
                .sectionId(f.section.getId()).roundId(round.getId()).windowDate(LocalDate.of(2026, 10, 10))
                .dayPart(dayPart).open(true).build());
    }

    private JwtRequestPostProcessor grantClubAdmin(String sub, UUID clubId) {
        return grant(sub, ScopeType.CLUB, clubId);
    }

    private JwtRequestPostProcessor grantSectionAdmin(String sub, UUID sectionId) {
        return grant(sub, ScopeType.SECTION, sectionId);
    }

    private JwtRequestPostProcessor grant(String sub, ScopeType scopeType, UUID scopeId) {
        Person person = personRepository.save(Person.builder().firstName("Casey").lastName("Manager")
                .email(sub + "@example.com").keycloakUserId(sub).build());
        roleAssignmentRepository.save(RoleAssignment.builder().personId(person.getId())
                .role(RoleAssignmentRole.CLUB_ADMIN).scopeType(scopeType).scopeId(scopeId).build());
        return withSubject(sub);
    }

    @Test
    void returnsGridShapeForAGroupCoveredAndASquadCoveredGameAndAgreesWithThePollEndpoints() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin", f.club.getId());
        Match groupGame = newMatch(f, 2, 9);
        Match squadGame = newMatch(f, 3, 14);
        UUID anton = addPlayer(f, "Anton", "Adams");
        UUID bea = addPlayer(f, "Bea", "Brown");
        addToSquad(f, anton);
        addToSquad(f, bea);

        SectionAvailabilityRound round = saveRound(f);
        SectionAvailabilityWindow window = saveWindow(f, round, DayPart.MORNING);
        windowMatchRepository.save(SectionAvailabilityWindowMatch.builder()
                .windowId(window.getId()).matchId(groupGame.getId()).build());
        responseRepository.save(SectionAvailabilityResponse.builder().windowId(window.getId())
                .playerProfileId(anton).status(AvailabilityStatus.AVAILABLE).build());
        matchSquadMemberRepository.save(MatchSquadMember.builder().matchId(groupGame.getId())
                .teamId(f.team.getId()).sectionAvailabilityWindowId(window.getId()).playerProfileId(anton).build());

        MatchAvailabilityPoll poll = savePoll(squadGame, f.team);
        playerAvailabilityRepository.save(PlayerAvailability.builder().pollId(poll.getId())
                .playerProfileId(bea).status(AvailabilityStatus.UNSURE).build());

        mockMvc.perform(get(URL, f.club.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.truncated").value(false))
                .andExpect(jsonPath("$.games", hasSize(2)))
                .andExpect(jsonPath("$.games[0].matchId").value(groupGame.getId().toString()))
                .andExpect(jsonPath("$.games[0].pollType").value("GROUP"))
                .andExpect(jsonPath("$.games[0].pollId").value(round.getId().toString()))
                .andExpect(jsonPath("$.games[0].roundId").value(round.getId().toString()))
                .andExpect(jsonPath("$.games[0].dayPart").value("MORNING"))
                .andExpect(jsonPath("$.games[0].label").value("U15 Colts v Occasionals"))
                .andExpect(jsonPath("$.games[0].teamId").value(f.team.getId().toString()))
                .andExpect(jsonPath("$.games[0].sectionId").value(f.section.getId().toString()))
                .andExpect(jsonPath("$.games[1].pollType").value("SQUAD"))
                .andExpect(jsonPath("$.games[1].pollId").value(poll.getId().toString()))
                .andExpect(jsonPath("$.games[1].roundId").value(nullValue()))
                .andExpect(jsonPath("$.games[1].dayPart").value("AFTERNOON"))
                .andExpect(jsonPath("$.players", hasSize(2)))
                .andExpect(jsonPath("$.players[0].lastName").value("Adams"))
                .andExpect(jsonPath("$.players[0].cells[0].status").value("AVAILABLE"))
                .andExpect(jsonPath("$.players[0].cells[0].picked").value(true))
                .andExpect(jsonPath("$.players[0].cells[1].status").value("NO_RESPONSE"))
                .andExpect(jsonPath("$.players[0].answeredCount").value(1))
                .andExpect(jsonPath("$.players[0].pickedCount").value(1))
                .andExpect(jsonPath("$.players[1].lastName").value("Brown"))
                .andExpect(jsonPath("$.players[1].cells[0].status").value("NO_RESPONSE"))
                .andExpect(jsonPath("$.players[1].cells[1].status").value("UNSURE"));

        // Agreement with the poll endpoints for the same games.
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/section-availability-rounds/{r}/responses",
                                f.club.getId(), round.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.responses[?(@.playerProfileId=='" + anton + "')].statuses[0].status")
                        .value("AVAILABLE"))
                .andExpect(jsonPath("$.responses[?(@.playerProfileId=='" + bea + "')].statuses[0].status")
                        .value(contains(nullValue())));
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/matches/{m}/polls/{p}/responses",
                                f.club.getId(), squadGame.getId(), poll.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.responses[?(@.playerProfileId=='" + bea + "')].status").value("UNSURE"))
                .andExpect(jsonPath("$.responses[?(@.playerProfileId=='" + anton + "')].status")
                        .value(contains(nullValue())));
    }

    @Test
    void gameWithoutAPollIsNotInPollAndPastGamesNeedIncludePast() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin", f.club.getId());
        newMatch(f, 2, 9);
        newMatch(f, -3, 9);
        addPlayer(f, "Anton", "Adams");

        mockMvc.perform(get(URL, f.club.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.games", hasSize(1)))
                .andExpect(jsonPath("$.games[0].pollType").value(nullValue()))
                .andExpect(jsonPath("$.players[0].cells[0].status").value("NOT_IN_POLL"));
        mockMvc.perform(get(URL, f.club.getId()).param("includePast", "true").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.games", hasSize(2)));
    }

    @Test
    void sectionScopeIsEnforcedForSectionIdAndForTheCallersOwnReach() throws Exception {
        Fixture f = fixture();
        Section other = sectionRepository.save(
                Section.builder().clubId(f.club.getId()).name("Open").active(true).build());
        JwtRequestPostProcessor otherSectionAdmin = grantSectionAdmin("open-admin", other.getId());
        newMatch(f, 2, 9);

        mockMvc.perform(get(URL, f.club.getId()).param("sectionId", f.section.getId().toString())
                        .with(otherSectionAdmin))
                .andExpect(status().isForbidden());
        // No sectionId narrows to the caller's own sections: the juniors game is not visible.
        mockMvc.perform(get(URL, f.club.getId()).with(otherSectionAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.games", hasSize(0)));

        Club otherClub = clubRepository.save(
                Club.builder().name("Lakeside CC").slug("lakeside-cc").status(ClubStatus.ACTIVE).build());
        JwtRequestPostProcessor otherClubAdmin = grantClubAdmin("other-club-admin", otherClub.getId());
        mockMvc.perform(get(URL, otherClub.getId()).param("sectionId", f.section.getId().toString())
                        .with(otherClubAdmin))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(URL, f.club.getId()).with(otherClubAdmin)).andExpect(status().isForbidden());
    }

    @Test
    void teamFilterNarrowsToThatTeamsGamesAndSquadAndUnknownOrOutOfScopeTeamsAreRejected() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin", f.club.getId());
        Team secondTeam = teamRepository.save(Team.builder().clubId(f.club.getId())
                .sectionId(f.section.getId()).name("U13 Cubs").active(true).build());
        Match colts = newMatch(f, 2, 9);
        matchRepository.save(Match.builder().clubId(f.club.getId()).homeTeamId(secondTeam.getId())
                .awayTeamName("Others").seasonId(f.season.getId()).matchDate(colts.getMatchDate()).active(true)
                .build());
        UUID inSquad = addPlayer(f, "Anton", "Adams");
        addPlayer(f, "Bea", "Brown");
        addToSquad(f, inSquad);

        mockMvc.perform(get(URL, f.club.getId()).param("teamId", f.team.getId().toString()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.games", hasSize(1)))
                .andExpect(jsonPath("$.games[0].teamId").value(f.team.getId().toString()))
                .andExpect(jsonPath("$.players", hasSize(1)))
                .andExpect(jsonPath("$.players[0].playerProfileId").value(inSquad.toString()));

        mockMvc.perform(get(URL, f.club.getId()).param("teamId", UUID.randomUUID().toString()).with(admin))
                .andExpect(status().isNotFound());

        Section other = sectionRepository.save(
                Section.builder().clubId(f.club.getId()).name("Open").active(true).build());
        JwtRequestPostProcessor otherSectionAdmin = grantSectionAdmin("open-admin", other.getId());
        mockMvc.perform(get(URL, f.club.getId()).param("teamId", f.team.getId().toString())
                        .with(otherSectionAdmin))
                .andExpect(status().isForbidden());

        Club otherClub = clubRepository.save(
                Club.builder().name("Lakeside CC").slug("lakeside-cc").status(ClubStatus.ACTIVE).build());
        JwtRequestPostProcessor otherClubAdmin = grantClubAdmin("other-club-admin", otherClub.getId());
        mockMvc.perform(get(URL, otherClub.getId()).param("teamId", f.team.getId().toString())
                        .with(otherClubAdmin))
                .andExpect(status().isNotFound());
    }

    @Test
    void includePastBoundaryIsExactlyStartOfToday() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin", f.club.getId());
        Instant startOfToday = com.cricketlegend.service.support.ServerClock.startOfToday();
        Match atStart = matchRepository.save(Match.builder().clubId(f.club.getId()).homeTeamId(f.team.getId())
                .awayTeamName("A").seasonId(f.season.getId()).matchDate(startOfToday).active(true).build());
        matchRepository.save(Match.builder().clubId(f.club.getId()).homeTeamId(f.team.getId())
                .awayTeamName("B").seasonId(f.season.getId()).matchDate(startOfToday.minusSeconds(1)).active(true)
                .build());

        mockMvc.perform(get(URL, f.club.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.games", hasSize(1)))
                .andExpect(jsonPath("$.games[0].matchId").value(atStart.getId().toString()));
        mockMvc.perform(get(URL, f.club.getId()).param("includePast", "true").with(admin))
                .andExpect(jsonPath("$.games", hasSize(2)));
    }

    @Test
    void teamFilterWithASectionNotContainingTheTeamReturnsAnEmptyGrid() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin", f.club.getId());
        Section other = sectionRepository.save(
                Section.builder().clubId(f.club.getId()).name("Open").active(true).build());
        newMatch(f, 2, 9);

        mockMvc.perform(get(URL, f.club.getId()).param("teamId", f.team.getId().toString())
                        .param("sectionId", other.getId().toString()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.games", hasSize(0)))
                .andExpect(jsonPath("$.players", hasSize(0)))
                .andExpect(jsonPath("$.truncated").value(false));
    }
}
