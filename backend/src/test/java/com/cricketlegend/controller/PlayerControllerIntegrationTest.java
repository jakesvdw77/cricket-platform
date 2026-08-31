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
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Section;
import com.cricketlegend.repository.ClubMembershipRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SectionRepository;
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
 * HTTP-layer integration test for PlayerController — per docs/specs/028-players.md's Test Plan,
 * following docs/specs/026-teams.md's own {@code TeamControllerIntegrationTest} pattern exactly
 * ({@code withSubject}, a real {@code Person} + {@code RoleAssignment(CLUB_ADMIN, CLUB, clubId)}
 * row): a real {@code CLUB_ADMIN} can reach all eight endpoints for their own club, gets {@code
 * 403} for a different club and {@code 404} for a {@code playerId}/{@code sectionId} that's real
 * but belongs to a different club, a {@code platform_admin} JWT also succeeds, both transition
 * {@code 409}s (deactivate/reactivate) and the link/unlink {@code 409}/{@code 404} are proven
 * through the real HTTP layer.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class PlayerControllerIntegrationTest {

    private static final String PLAYER_BODY = """
            {
                "firstName": "Jane",
                "lastName": "Doe",
                "dateOfBirth": "2005-03-04",
                "gender": "FEMALE",
                "clubMembershipNumber": "M-123",
                "isWicketKeeper": false
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private PlayerProfileRepository playerProfileRepository;

    @Autowired
    private ClubMembershipRepository clubMembershipRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    @Test
    void clubAdminCanReachAllEightEndpointsForTheirOwnClub() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/players", club.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        String createResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/players", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(PLAYER_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.firstName").value("Jane"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.email").doesNotExist())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String playerId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        String updateBody = """
                {
                    "firstName": "Janet",
                    "lastName": "Doey",
                    "dateOfBirth": "2005-03-04",
                    "gender": "FEMALE",
                    "clubMembershipNumber": "M-999",
                    "isWicketKeeper": true
                }
                """;
        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/players/{playerId}", club.getId(), playerId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("Janet"))
                .andExpect(jsonPath("$.isWicketKeeper").value(true));

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/sections",
                                club.getId(),
                                playerId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/sections/{sectionId}/link",
                                club.getId(),
                                playerId,
                                section.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/sections",
                                club.getId(),
                                playerId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(section.getId().toString()));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/sections/{sectionId}/unlink",
                                club.getId(),
                                playerId,
                                section.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/deactivate",
                                club.getId(),
                                playerId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/reactivate",
                                club.getId(),
                                playerId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void clubAdminGets403OnAllEightEndpointsForADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Section sectionY = sectionRepository.save(newSection(clubY.getId(), "Men"));
        Person personY = personRepository.save(newPlayerPerson());
        PlayerProfile playerY = playerProfileRepository.save(newPlayerProfile(personY.getId(), clubY.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/players", clubY.getId()).with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/players", clubY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(PLAYER_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}",
                                clubY.getId(),
                                playerY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(PLAYER_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/deactivate",
                                clubY.getId(),
                                playerY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/reactivate",
                                clubY.getId(),
                                playerY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/sections",
                                clubY.getId(),
                                playerY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/sections/{sectionId}/link",
                                clubY.getId(),
                                playerY.getId(),
                                sectionY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/sections/{sectionId}/unlink",
                                clubY.getId(),
                                playerY.getId(),
                                sectionY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());
    }

    @Test
    void clubAdminGets404ForAPlayerIdThatIsRealButBelongsToADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Person personY = personRepository.save(newPlayerPerson());
        PlayerProfile playerY = playerProfileRepository.save(newPlayerProfile(personY.getId(), clubY.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        // clubX is the caller's own club (so @PreAuthorize passes), but playerY belongs to
        // clubY — the service's findOrThrowForClub must 404 this, not the controller's
        // @PreAuthorize.
        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}",
                                clubX.getId(),
                                playerY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(PLAYER_BODY))
                .andExpect(status().isNotFound());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/deactivate",
                                clubX.getId(),
                                playerY.getId())
                        .with(admin))
                .andExpect(status().isNotFound());
    }

    @Test
    void platformAdminSucceedsOnAllEightEndpointsForAnArbitraryClubsPlayers() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/players", club.getId()).with(platformAdmin()))
                .andExpect(status().isOk());

        String createResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/players", club.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(PLAYER_BODY))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String playerId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/players/{playerId}", club.getId(), playerId)
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(PLAYER_BODY))
                .andExpect(status().isOk());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/sections",
                                club.getId(),
                                playerId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/sections/{sectionId}/link",
                                club.getId(),
                                playerId,
                                section.getId())
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/sections/{sectionId}/unlink",
                                club.getId(),
                                playerId,
                                section.getId())
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/deactivate",
                                club.getId(),
                                playerId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/reactivate",
                                club.getId(),
                                playerId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());
    }

    @Test
    void callerWithNoClubAdminGrantAndNoPlatformAdminRoleGets403() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        JwtRequestPostProcessor unknown = withSubject("unknown-sub-no-person-or-grant");

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/players", club.getId()).with(unknown))
                .andExpect(status().isForbidden());
    }

    /** Both transition {@code 409}s, proven through the real HTTP layer. */
    @Test
    void deactivateAndReactivateReturn409WhenAlreadyInThatState() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        String createResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/players", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(PLAYER_BODY))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String playerId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        // Already active — reactivate is the invalid transition first.
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/reactivate",
                                club.getId(),
                                playerId)
                        .with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("already active")));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/deactivate",
                                club.getId(),
                                playerId)
                        .with(admin))
                .andExpect(status().isOk());

        // Now already inactive — deactivate is the invalid transition.
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/deactivate",
                                club.getId(),
                                playerId)
                        .with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("already inactive")));
    }

    /** The already-tagged {@code 409} and the not-tagged {@code 404}, through real HTTP. */
    @Test
    void linkingAnAlreadyTaggedSectionReturns409AndUnlinkingAnUntaggedOneReturns404() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        String createResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/players", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(PLAYER_BODY))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String playerId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/sections/{sectionId}/unlink",
                                club.getId(),
                                playerId,
                                section.getId())
                        .with(admin))
                .andExpect(status().isNotFound());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/sections/{sectionId}/link",
                                club.getId(),
                                playerId,
                                section.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/sections/{sectionId}/link",
                                club.getId(),
                                playerId,
                                section.getId())
                        .with(admin))
                .andExpect(status().isConflict());
    }

    /** The reactivate-time "a different active membership already exists" {@code 409}, through real HTTP. */
    @Test
    void reactivateReturns409WhenTheSamePersonHoldsADifferentActiveClubMembership() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club otherClub = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        String createResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/players", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(PLAYER_BODY))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String playerId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");
        String personId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.personId");

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/deactivate",
                                club.getId(),
                                playerId)
                        .with(admin))
                .andExpect(status().isOk());
        // Forces deactivate's own pending club_membership UPDATE (valid_to = today) to actually
        // commit to the DB before the INSERT below — Hibernate's default flush ordering applies
        // every pending INSERT in a transaction before any pending UPDATE regardless of
        // registration order (the same gotcha ClubContactServiceImpl's own Javadoc documents),
        // which would otherwise trip ux_club_membership_active here purely as a same-transaction
        // test artifact, not a real production race (a genuinely separate membership would come
        // from a separate, already-committed transaction in real usage).
        clubMembershipRepository.flush();

        // The same person picks up a brand-new, unrelated active membership at a different club —
        // an edge case this spec's flows don't normally produce (each Player creation always
        // creates a brand-new Person), simulated directly here to prove the service-level guard.
        clubMembershipRepository.saveAndFlush(com.cricketlegend.domain.ClubMembership.builder()
                .personId(UUID.fromString(personId))
                .clubId(otherClub.getId())
                .build());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/players/{playerId}/reactivate",
                                club.getId(),
                                playerId)
                        .with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail")
                        .value(org.hamcrest.Matchers.containsString("different active club membership")));
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

    private Person newPlayerPerson() {
        return Person.builder().firstName("Jane").lastName("Doe").build();
    }

    private PlayerProfile newPlayerProfile(UUID personId, UUID clubId) {
        return PlayerProfile.builder().personId(personId).clubId(clubId).active(true).build();
    }
}
