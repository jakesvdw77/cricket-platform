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
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Season;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SeasonRepository;
import java.time.LocalDate;
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
 * HTTP-layer integration test for SeasonController — per docs/specs/029-league-management.md's
 * Test Plan, following {@code TeamControllerIntegrationTest}'s pattern exactly: a real {@code
 * CLUB_ADMIN} can reach all five endpoints for their own club, gets {@code 403} for a different
 * club and {@code 404} for a {@code seasonId} that's real but belongs to a different club, a
 * {@code platform_admin} JWT also succeeds, both transition {@code 409}s and the {@code startDate
 * <= endDate} {@code 400} are proven through the real HTTP layer.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class SeasonControllerIntegrationTest {

    private static final String SEASON_BODY = """
            {
                "label": "2026",
                "startDate": "2026-01-01",
                "endDate": "2026-12-31"
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    @Test
    void clubAdminCanReachAllFiveEndpointsForTheirOwnClub() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/seasons", club.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        String createResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/seasons", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SEASON_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.label").value("2026"))
                .andExpect(jsonPath("$.active").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String seasonId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        String updateBody = """
                {
                    "label": "2026 (renamed)",
                    "startDate": "2026-02-01",
                    "endDate": "2026-11-30"
                }
                """;
        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/seasons/{seasonId}", club.getId(), seasonId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value("2026 (renamed)"));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/seasons/{seasonId}/deactivate",
                                club.getId(),
                                seasonId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/seasons/{seasonId}/reactivate",
                                club.getId(),
                                seasonId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void clubAdminGets403OnAllFiveEndpointsForADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Season seasonY = seasonRepository.save(newSeason(clubY.getId(), "2026"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/seasons", clubY.getId()).with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/seasons", clubY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SEASON_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/seasons/{seasonId}",
                                clubY.getId(),
                                seasonY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SEASON_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/seasons/{seasonId}/deactivate",
                                clubY.getId(),
                                seasonY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/seasons/{seasonId}/reactivate",
                                clubY.getId(),
                                seasonY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());
    }

    @Test
    void clubAdminGets404ForASeasonIdThatIsRealButBelongsToADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Season seasonY = seasonRepository.save(newSeason(clubY.getId(), "2026"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/seasons/{seasonId}",
                                clubX.getId(),
                                seasonY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SEASON_BODY))
                .andExpect(status().isNotFound());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/seasons/{seasonId}/deactivate",
                                clubX.getId(),
                                seasonY.getId())
                        .with(admin))
                .andExpect(status().isNotFound());
    }

    @Test
    void platformAdminSucceedsOnAllFiveEndpointsForAnArbitraryClubsSeasons() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/seasons", club.getId()).with(platformAdmin()))
                .andExpect(status().isOk());

        String createResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/seasons", club.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SEASON_BODY))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String seasonId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/seasons/{seasonId}", club.getId(), seasonId)
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SEASON_BODY))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/seasons/{seasonId}/deactivate",
                                club.getId(),
                                seasonId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/seasons/{seasonId}/reactivate",
                                club.getId(),
                                seasonId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());
    }

    @Test
    void callerWithNoClubAdminGrantAndNoPlatformAdminRoleGets403() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        JwtRequestPostProcessor unknown = withSubject("unknown-sub-no-person-or-grant");

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/seasons", club.getId()).with(unknown))
                .andExpect(status().isForbidden());
    }

    /** Both transition {@code 409}s, proven through the real HTTP layer. */
    @Test
    void deactivateAndReactivateReturn409WhenAlreadyInThatState() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/seasons/{seasonId}/reactivate",
                                club.getId(),
                                season.getId())
                        .with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("already active")));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/seasons/{seasonId}/deactivate",
                                club.getId(),
                                season.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/seasons/{seasonId}/deactivate",
                                club.getId(),
                                season.getId())
                        .with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("already inactive")));
    }

    /** The {@code startDate <= endDate} {@code 400}, proven on both create and update through real HTTP. */
    @Test
    void createAndUpdateReturn400WhenStartDateIsAfterEndDate() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        String invalidCreateBody = """
                {
                    "label": "Backwards",
                    "startDate": "2026-12-31",
                    "endDate": "2026-01-01"
                }
                """;
        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/seasons", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidCreateBody))
                .andExpect(status().isBadRequest());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/seasons/{seasonId}",
                                club.getId(),
                                season.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidCreateBody))
                .andExpect(status().isBadRequest());
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

    private Season newSeason(UUID clubId, String label) {
        return Season.builder()
                .clubId(clubId)
                .label(label)
                .startDate(LocalDate.of(2026, 1, 1))
                .endDate(LocalDate.of(2026, 12, 31))
                .active(true)
                .build();
    }
}
