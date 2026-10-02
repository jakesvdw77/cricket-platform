package com.cricketlegend.controller;

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
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
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
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * HTTP-layer smoke test for SectionAvailabilityRoundController/PublicSectionAvailabilityRoundController
 * — the fixture-group-selection revision's own admin+public surface. Comprehensive coverage
 * matching docs/specs/063-section-availability-and-flexible-squads.md's full Test Plan table is a
 * separate {@code test-writer} dispatch; this proves the real HTTP layer round-trips end to end: a
 * real {@code CLUB_ADMIN} can review a section's fixture groups, open a round from a selected
 * match, see it in the responses view, see the same match flagged {@code alreadyPolled} on a
 * second fixture-groups call, set a player's status as an admin override (now {@code
 * windowId}-keyed), close it, and a public caller (no {@code Authorization} header) can read and
 * write against the same round, respecting a closed bracket and an unknown id.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class SectionAvailabilityRoundControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private PlayerProfileRepository playerProfileRepository;

    @Autowired
    private PlayerSectionRepository playerSectionRepository;

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private MatchRepository matchRepository;

    @Test
    void clubAdminCanSeeFixtureGroupsThenAnAlreadyPolledMatchOnASecondCall() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Juniors"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        Match match = saveFutureFlexibleMatch(club, section, "U15 Colts");

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/section-availability-fixture-groups",
                                club.getId(),
                                section.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].matches.length()").value(1))
                .andExpect(jsonPath("$[0].matches[0].matchId").value(match.getId().toString()))
                .andExpect(jsonPath("$[0].matches[0].alreadyPolled").value(false));

        createRound(admin, club.getId(), section.getId(), match.getId());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/section-availability-fixture-groups",
                                club.getId(),
                                section.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].matches[0].alreadyPolled").value(true))
                .andExpect(jsonPath("$[0].matches[0].existingPollType").value("GROUP"))
                .andExpect(jsonPath("$[0].matches[0].existingPollId").exists());
    }

    @Test
    void clubAdminCanOpenARoundAndOverrideAPlayersStatusThenCloseIt() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Juniors"));
        UUID playerId = addPlayerTaggedToSection(club.getId(), section.getId(), "Alice");
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        Match match = saveFutureFlexibleMatch(club, section, "U15 Colts");

        String createResponse = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/section-availability-rounds", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sectionId\": \"" + section.getId() + "\", \"description\": \"Saturday fixtures\", "
                                + "\"matchIds\": [\"" + match.getId() + "\"], \"autoClose\": true}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sectionId").value(section.getId().toString()))
                .andExpect(jsonPath("$.description").value("Saturday fixtures"))
                .andExpect(jsonPath("$.open").value(true))
                .andExpect(jsonPath("$.brackets.length()").value(1))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String roundId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");
        String windowId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.brackets[0].windowId");

        // Re-selecting the same, already-polled match into a new round is rejected.
        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/section-availability-rounds", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sectionId\": \"" + section.getId() + "\", \"description\": \"Duplicate\", "
                                + "\"matchIds\": [\"" + match.getId() + "\"], \"autoClose\": true}"))
                .andExpect(status().isConflict());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/section-availability-rounds/{roundId}",
                                club.getId(),
                                roundId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"description\": \"Renamed fixtures\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Renamed fixtures"));

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/section-availability-rounds", club.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/section-availability-rounds/{roundId}/responses",
                                club.getId(),
                                roundId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.responses.length()").value(1))
                .andExpect(jsonPath("$.publicPath").value("/section-availability/" + roundId));

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/section-availability-rounds/{roundId}/matches",
                                club.getId(),
                                roundId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].windowId").value(windowId));

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/section-availability-rounds/{roundId}/players/{playerId}",
                                club.getId(),
                                roundId,
                                playerId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"windowId\": \"" + windowId + "\", \"status\": \"AVAILABLE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.responses[0].playerProfileId").value(playerId.toString()))
                .andExpect(jsonPath("$.responses[0].statuses[0].status").value("AVAILABLE"));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/section-availability-rounds/{roundId}/close",
                                club.getId(),
                                roundId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.open").value(false));

        // A repeat close is rejected.
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/section-availability-rounds/{roundId}/close",
                                club.getId(),
                                roundId)
                        .with(admin))
                .andExpect(status().isConflict());

        // Public read still works, and reflects the closed state, the renamed description, and the override above.
        mockMvc.perform(get("/api/v1/public/section-availability-rounds/{roundId}", roundId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Renamed fixtures"))
                .andExpect(jsonPath("$.open").value(false))
                .andExpect(jsonPath("$.responses[0].statuses[0].status").value("AVAILABLE"));

        // The admin override is accepted on a closed round (066, a manager correction).
        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/section-availability-rounds/{roundId}/players/{playerId}",
                                club.getId(),
                                roundId,
                                playerId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"windowId\": \"" + windowId + "\", \"status\": \"UNSURE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.responses[0].statuses[0].status").value("UNSURE"));

        // A public write against a closed round is still rejected.
        mockMvc.perform(put(
                                "/api/v1/public/section-availability-rounds/{roundId}/players/{playerId}",
                                roundId,
                                playerId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"windowId\": \"" + windowId + "\", \"status\": \"UNAVAILABLE\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void publicCallerCanSelfReportAvailabilityWithNoAuthorizationHeader() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Juniors"));
        UUID playerId = addPlayerTaggedToSection(club.getId(), section.getId(), "Bob");
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        Match match = saveFutureFlexibleMatch(club, section, "U15 Colts");
        String createResponse = createRound(admin, club.getId(), section.getId(), match.getId());
        String roundId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");
        String windowId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.brackets[0].windowId");

        mockMvc.perform(put(
                                "/api/v1/public/section-availability-rounds/{roundId}/players/{playerId}",
                                roundId,
                                playerId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"windowId\": \"" + windowId + "\", \"status\": \"UNSURE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.responses[0].statuses[0].status").value("UNSURE"));
    }

    @Test
    void publicGetReturns404ForAnUnknownRoundId() throws Exception {
        mockMvc.perform(get("/api/v1/public/section-availability-rounds/{roundId}", UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    @Test
    void createReturns400WhenMatchIdsIsEmpty() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Juniors"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/section-availability-rounds", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sectionId\": \"" + section.getId() + "\", \"description\": \"Fixtures\", "
                                + "\"matchIds\": [], \"autoClose\": true}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void clubAdminGets403ForADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/section-availability-rounds", clubY.getId()).with(admin))
                .andExpect(status().isForbidden());
    }

    private Match saveFutureFlexibleMatch(Club club, Section section, String teamName) {
        Season season = seasonRepository.save(Season.builder()
                .clubId(club.getId())
                .label("2026")
                .startDate(LocalDate.of(2026, 1, 1))
                .endDate(LocalDate.of(2026, 12, 31))
                .active(true)
                .build());
        Team team = teamRepository.save(Team.builder()
                .clubId(club.getId())
                .sectionId(section.getId())
                .name(teamName)
                .active(true)
                .build());
        Instant matchDate = LocalDate.now(ZoneId.systemDefault())
                .plus(2, ChronoUnit.DAYS)
                .atTime(9, 0)
                .atZone(ZoneId.systemDefault())
                .toInstant();
        return matchRepository.save(Match.builder()
                .clubId(club.getId())
                .homeTeamId(team.getId())
                .awayTeamName("Occasionals")
                .seasonId(season.getId())
                .matchDate(matchDate)
                .active(true)
                .build());
    }

    private String createRound(JwtRequestPostProcessor admin, UUID clubId, UUID sectionId, UUID matchId)
            throws Exception {
        String response = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/section-availability-rounds", clubId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sectionId\": \"" + sectionId + "\", \"description\": \"Saturday fixtures\", "
                                + "\"matchIds\": [\"" + matchId + "\"], \"autoClose\": true}"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return response;
    }

    private UUID addPlayerTaggedToSection(UUID clubId, UUID sectionId, String firstName) {
        Person person = personRepository.save(
                Person.builder().firstName(firstName).lastName("Player").dateOfBirth(LocalDate.of(2013, 1, 1)).build());
        PlayerProfile profile = playerProfileRepository.save(
                PlayerProfile.builder().personId(person.getId()).clubId(clubId).active(true).build());
        playerSectionRepository.save(
                PlayerSection.builder().playerProfileId(profile.getId()).sectionId(sectionId).build());
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
}
