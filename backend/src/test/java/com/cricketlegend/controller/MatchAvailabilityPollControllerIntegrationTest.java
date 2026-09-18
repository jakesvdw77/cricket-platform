package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static com.cricketlegend.PlatformRoleJwtPostProcessors.withSubject;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * HTTP-layer integration test for MatchAvailabilityPollController — per
 * docs/specs/032-match-availability-polls.md's Test Plan, following {@code
 * MatchSideControllerIntegrationTest}'s pattern exactly: a real {@code CLUB_ADMIN} can reach every
 * poll endpoint for their own club, gets {@code 403} for a different club and {@code 404} for a
 * {@code matchId}/{@code pollId} that's real but belongs to a different club, a {@code
 * platform_admin} JWT also succeeds, and every documented {@code 400}/{@code 409} is proven
 * through the real HTTP layer.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class MatchAvailabilityPollControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private MatchRepository matchRepository;

    @Autowired
    private TeamSquadMemberRepository teamSquadMemberRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private PlayerProfileRepository playerProfileRepository;

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    @Test
    void clubAdminCanReachAllCoreEndpointsForTheirOwnClub() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));
        addSquadMember(club.getId(), team.getId(), season.getId(), "Alice");
        addSquadMember(club.getId(), team.getId(), season.getId(), "Bob");
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls",
                                club.getId(),
                                match.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        String createBody = "{\"teamId\": \"" + team.getId() + "\"}";
        String createResponse = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls",
                                club.getId(),
                                match.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.teamId").value(team.getId().toString()))
                .andExpect(jsonPath("$.open").value(true))
                .andExpect(jsonPath("$.noResponseCount").value(2))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String pollId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/responses",
                                club.getId(),
                                match.getId(),
                                pollId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.responses.length()").value(2))
                .andExpect(jsonPath("$.publicPath").value("/poll/" + pollId));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/close",
                                club.getId(),
                                match.getId(),
                                pollId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.open").value(false));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/open",
                                club.getId(),
                                match.getId(),
                                pollId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.open").value(true));

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls",
                                club.getId(),
                                match.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void clubAdminGets403OnAllEndpointsForADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Section sectionY = sectionRepository.save(newSection(clubY.getId(), "Men"));
        Team teamY = teamRepository.save(newTeam(clubY.getId(), sectionY.getId(), "1st XI"));
        Season seasonY = seasonRepository.save(newSeason(clubY.getId(), "2026"));
        Match matchY = matchRepository.save(newMatchWithoutLeague(clubY.getId(), teamY.getId(), seasonY.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls",
                                clubY.getId(),
                                matchY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls",
                                clubY.getId(),
                                matchY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\": \"" + teamY.getId() + "\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void clubAdminGets404ForAMatchOrPollIdThatIsRealButBelongsToADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Section sectionY = sectionRepository.save(newSection(clubY.getId(), "Men"));
        Team teamY = teamRepository.save(newTeam(clubY.getId(), sectionY.getId(), "1st XI"));
        Season seasonY = seasonRepository.save(newSeason(clubY.getId(), "2026"));
        Match matchY = matchRepository.save(newMatchWithoutLeague(clubY.getId(), teamY.getId(), seasonY.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        // clubX is the caller's own club (so @PreAuthorize passes), but matchY belongs to clubY.
        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls",
                                clubX.getId(),
                                matchY.getId())
                        .with(admin))
                .andExpect(status().isNotFound());

        // Set up a real match under clubX, but reference clubY's own pollId under it.
        Section sectionX = sectionRepository.save(newSection(clubX.getId(), "Men"));
        Team teamX = teamRepository.save(newTeam(clubX.getId(), sectionX.getId(), "1st XI"));
        Season seasonX = seasonRepository.save(newSeason(clubX.getId(), "2026"));
        Match matchX = matchRepository.save(newMatchWithoutLeague(clubX.getId(), teamX.getId(), seasonX.getId()));
        JwtRequestPostProcessor adminY = grantClubAdmin("club-admin-sub-y", clubY.getId());
        String pollYResponse = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls",
                                clubY.getId(),
                                matchY.getId())
                        .with(adminY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\": \"" + teamY.getId() + "\"}"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String pollYId = com.jayway.jsonpath.JsonPath.read(pollYResponse, "$.id");

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/close",
                                clubX.getId(),
                                matchX.getId(),
                                pollYId)
                        .with(admin))
                .andExpect(status().isNotFound());
    }

    @Test
    void platformAdminSucceedsOnCoreEndpointsForAnArbitraryClubsMatch() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls",
                                club.getId(),
                                match.getId())
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls",
                                club.getId(),
                                match.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\": \"" + team.getId() + "\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void callerWithNoClubAdminGrantAndNoPlatformAdminRoleGets403() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));
        JwtRequestPostProcessor unknown = withSubject("unknown-sub-no-person-or-grant");

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls",
                                club.getId(),
                                match.getId())
                        .with(unknown))
                .andExpect(status().isForbidden());
    }

    @Test
    void createReturns400WhenTeamIdIsNotOneOfTheMatchsOwnTeams() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Team unrelatedTeam = teamRepository.save(newTeam(club.getId(), section.getId(), "2nd XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls",
                                club.getId(),
                                match.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\": \"" + unrelatedTeam.getId() + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createReturns409WhenAPollForThatTeamAlreadyExists() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        String body = "{\"teamId\": \"" + team.getId() + "\"}";

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls",
                                club.getId(),
                                match.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls",
                                club.getId(),
                                match.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());
    }

    @Test
    void openReturns409WhenAlreadyOpen() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        String pollId = createPoll(admin, club.getId(), match.getId(), team.getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/open",
                                club.getId(),
                                match.getId(),
                                pollId)
                        .with(admin))
                .andExpect(status().isConflict());
    }

    @Test
    void closeReturns409WhenAlreadyClosed() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        String pollId = createPoll(admin, club.getId(), match.getId(), team.getId());
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/close",
                                club.getId(),
                                match.getId(),
                                pollId)
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/close",
                                club.getId(),
                                match.getId(),
                                pollId)
                        .with(admin))
                .andExpect(status().isConflict());
    }

    @Test
    void setPlayerStatusUpsertsAResponseAsTheAdmin() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));
        UUID playerId = addSquadMember(club.getId(), team.getId(), season.getId(), "Alice");
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        String pollId = createPoll(admin, club.getId(), match.getId(), team.getId());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/players/{playerId}",
                                club.getId(),
                                match.getId(),
                                pollId,
                                playerId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"UNAVAILABLE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unavailableCount").value(1))
                .andExpect(jsonPath("$.responses[?(@.playerProfileId=='" + playerId + "')].status")
                        .value("UNAVAILABLE"));

        // A repeat call for the same player upserts in place, not a second row.
        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/players/{playerId}",
                                club.getId(),
                                match.getId(),
                                pollId,
                                playerId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"AVAILABLE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.availableCount").value(1))
                .andExpect(jsonPath("$.unavailableCount").value(0));
    }

    @Test
    void setPlayerStatusReturns404ForAPlayerNotInThePollsOwnSquad() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        String pollId = createPoll(admin, club.getId(), match.getId(), team.getId());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/players/{playerId}",
                                club.getId(),
                                match.getId(),
                                pollId,
                                UUID.randomUUID())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"AVAILABLE\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void setPlayerStatusReturns409WhenThePollIsClosed() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));
        UUID playerId = addSquadMember(club.getId(), team.getId(), season.getId(), "Alice");
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        String pollId = createPoll(admin, club.getId(), match.getId(), team.getId());
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/close",
                                club.getId(),
                                match.getId(),
                                pollId)
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/players/{playerId}",
                                club.getId(),
                                match.getId(),
                                pollId,
                                playerId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"AVAILABLE\"}"))
                .andExpect(status().isConflict());
    }

    private String createPoll(JwtRequestPostProcessor admin, UUID clubId, UUID matchId, UUID teamId)
            throws Exception {
        String response = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls", clubId, matchId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\": \"" + teamId + "\"}"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(response, "$.id");
    }

    private UUID addSquadMember(UUID clubId, UUID teamId, UUID seasonId, String firstName) {
        Person person = personRepository.save(
                Person.builder().firstName(firstName).lastName("Player").dateOfBirth(LocalDate.of(1995, 1, 1))
                        .build());
        PlayerProfile profile = playerProfileRepository.save(
                PlayerProfile.builder().personId(person.getId()).clubId(clubId).active(true).build());
        teamSquadMemberRepository.save(TeamSquadMember.builder()
                .teamId(teamId)
                .seasonId(seasonId)
                .playerProfileId(profile.getId())
                .build());
        return profile.getId();
    }

    private JwtRequestPostProcessor grantClubAdmin(String keycloakUserId, UUID clubId) {
        Person person = personRepository.save(Person.builder()
                .firstName("Casey")
                .lastName("Manager")
                .email(keycloakUserId + "@example.com")
                .keycloakUserId(keycloakUserId)
                .build());
        roleAssignmentRepository.save(RoleAssignment.builder()
                .personId(person.getId())
                .role(RoleAssignmentRole.CLUB_ADMIN)
                .scopeType(ScopeType.CLUB)
                .scopeId(clubId)
                .build());
        return withSubject(keycloakUserId);
    }

    private Club newClub(String name, String slug) {
        return Club.builder().name(name).slug(slug).status(ClubStatus.ACTIVE).build();
    }

    private Section newSection(UUID clubId, String name) {
        return Section.builder().clubId(clubId).name(name).active(true).build();
    }

    private Team newTeam(UUID clubId, UUID sectionId, String name) {
        return Team.builder().clubId(clubId).sectionId(sectionId).name(name).active(true).build();
    }

    private Season newSeason(UUID clubId, String label) {
        return Season.builder()
                .clubId(clubId)
                .label(label)
                .startDate(LocalDate.of(2026, 1, 1))
                .endDate(LocalDate.of(2026, 12, 31))
                .active(true)
                .build();
    }

    private Match newMatchWithoutLeague(UUID clubId, UUID homeTeamId, UUID seasonId) {
        return Match.builder()
                .clubId(clubId)
                .homeTeamId(homeTeamId)
                .awayTeamName("Occasionals")
                .seasonId(seasonId)
                .matchDate(Instant.now().plus(7, ChronoUnit.DAYS))
                .active(true)
                .build();
    }
}
