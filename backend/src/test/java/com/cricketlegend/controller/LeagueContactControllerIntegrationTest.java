package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static com.cricketlegend.PlatformRoleJwtPostProcessors.withSubject;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
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
 * HTTP-layer integration test for LeagueContactController — per docs/specs/054-league-contacts.md's
 * Test Plan, following docs/specs/024-sponsor-contacts.md's own {@code
 * SponsorContactControllerIntegrationTest} pattern exactly ({@code withSubject}, a real {@code
 * Person} + {@code RoleAssignment(CLUB_ADMIN, CLUB, clubId)} row): a real {@code CLUB_ADMIN} can
 * reach all five endpoints for their own club+league, gets 404 for a {@code leagueId} that's real
 * but belongs to a different club, a {@code platform_admin} JWT also succeeds (proving {@code
 * AccessService.canAdministerClub}'s superset-access claim end-to-end), and — critically — the
 * create-a-second-primary-succeeds-through-the-HTTP-layer case (no 409), confirming the
 * {@code saveAndFlush} auto-unset works end-to-end, not just at the service-mock level.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class LeagueContactControllerIntegrationTest {

    private static final String CONTACT_BODY = """
            {
                "contact": {
                    "firstName": "Jane",
                    "lastName": "Doe",
                    "email": "jane@example.com",
                    "phone": "0123456789"
                },
                "role": "Umpire Coordinator",
                "isPrimary": false
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private LeagueRepository leagueRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    @Test
    void clubAdminCanListCreateUpdateDeactivateAndReactivateContactsForTheirOwnClubsLeague() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        League league = leagueRepository.save(newLeague(club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts",
                                club.getId(),
                                league.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        String createResponse = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts",
                                club.getId(),
                                league.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("Umpire Coordinator"))
                .andExpect(jsonPath("$.contact.email").value("jane@example.com"))
                .andExpect(jsonPath("$.active").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String contactId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts",
                                club.getId(),
                                league.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        String updateBody = """
                {
                    "contact": {
                        "firstName": "Jane",
                        "lastName": "Smith",
                        "email": "jane.smith@example.com",
                        "phone": "0123456789"
                    },
                    "role": "League Administrator",
                    "isPrimary": false
                }
                """;
        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId}",
                                club.getId(),
                                league.getId(),
                                contactId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("League Administrator"))
                .andExpect(jsonPath("$.contact.lastName").value("Smith"));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId}/deactivate",
                                club.getId(),
                                league.getId(),
                                contactId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId}/reactivate",
                                club.getId(),
                                league.getId(),
                                contactId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void clubAdminGets403OnAllFiveEndpointsForADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        League leagueY = leagueRepository.save(newLeague(clubY.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());
        UUID contactId = UUID.randomUUID();

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts",
                                clubY.getId(),
                                leagueY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts",
                                clubY.getId(),
                                leagueY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId}",
                                clubY.getId(),
                                leagueY.getId(),
                                contactId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId}/deactivate",
                                clubY.getId(),
                                leagueY.getId(),
                                contactId)
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId}/reactivate",
                                clubY.getId(),
                                leagueY.getId(),
                                contactId)
                        .with(admin))
                .andExpect(status().isForbidden());
    }

    @Test
    void clubAdminGets404ForALeagueIdThatIsRealButBelongsToADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        League leagueY = leagueRepository.save(newLeague(clubY.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        // clubX is the caller's own club (so @PreAuthorize passes), but leagueY belongs to clubY —
        // the service's findOrThrowLeagueForClub must 404 this, not the controller's @PreAuthorize.
        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts",
                                clubX.getId(),
                                leagueY.getId())
                        .with(admin))
                .andExpect(status().isNotFound());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts",
                                clubX.getId(),
                                leagueY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isNotFound());
    }

    @Test
    void clubAdminGets404ForAContactIdThatIsRealButBelongsToADifferentLeague() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        League leagueX = leagueRepository.save(newLeague(club.getId()));
        League leagueY = leagueRepository.save(newLeague(club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        String createResponse = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts",
                                club.getId(),
                                leagueY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String contactId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        // The contact genuinely exists, but under leagueY, not leagueX — the two-level isolation
        // (findOrThrowContactForLeague) must 404 this, not silently return a cross-league row.
        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId}",
                                club.getId(),
                                leagueX.getId(),
                                contactId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isNotFound());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId}/deactivate",
                                club.getId(),
                                leagueX.getId(),
                                contactId)
                        .with(admin))
                .andExpect(status().isNotFound());
    }

    @Test
    void platformAdminSucceedsOnAllFiveEndpointsForAnArbitraryClubsLeague() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        League league = leagueRepository.save(newLeague(club.getId()));

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts",
                                club.getId(),
                                league.getId())
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        String createResponse = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts",
                                club.getId(),
                                league.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String contactId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId}",
                                club.getId(),
                                league.getId(),
                                contactId)
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId}/deactivate",
                                club.getId(),
                                league.getId(),
                                contactId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId}/reactivate",
                                club.getId(),
                                league.getId(),
                                contactId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());
    }

    @Test
    void callerWithNoClubAdminGrantAndNoPlatformAdminRoleGets403OnAllFiveEndpoints() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        League league = leagueRepository.save(newLeague(club.getId()));
        UUID contactId = UUID.randomUUID();
        JwtRequestPostProcessor unknown = withSubject("unknown-sub-no-person-or-grant");

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts",
                                club.getId(),
                                league.getId())
                        .with(unknown))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts",
                                club.getId(),
                                league.getId())
                        .with(unknown)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId}",
                                club.getId(),
                                league.getId(),
                                contactId)
                        .with(unknown)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId}/deactivate",
                                club.getId(),
                                league.getId(),
                                contactId)
                        .with(unknown))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId}/reactivate",
                                club.getId(),
                                league.getId(),
                                contactId)
                        .with(unknown))
                .andExpect(status().isForbidden());
    }

    /**
     * The exact scenario that was initially broken in {@code 021} before the {@code saveAndFlush}
     * fix (see {@code SponsorContactServiceImpl.unsetOtherActivePrimaries}'s Javadoc, mirrored by
     * {@code LeagueContactServiceImpl}): creating a second contact with {@code isPrimary: true}
     * while a different active contact already held the primary flag must silently succeed
     * (auto-unsetting the first), not throw a 409 from {@code ux_league_contact_primary}. Proven
     * passing on the first version of this test, per the spec's own Test Plan.
     */
    @Test
    void settingIsPrimaryTrueOnASecondContactUnsetsTheFirstContactsPrimaryFlagThroughTheHttpLayer()
            throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        League league = leagueRepository.save(newLeague(club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        String firstPrimaryBody = """
                {
                    "contact": {
                        "firstName": "Jane",
                        "lastName": "Doe",
                        "email": "jane@example.com",
                        "phone": "0123456789"
                    },
                    "role": "Umpire Coordinator",
                    "isPrimary": true
                }
                """;
        String firstResponse = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts",
                                club.getId(),
                                league.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(firstPrimaryBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.isPrimary").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String firstContactId = com.jayway.jsonpath.JsonPath.read(firstResponse, "$.id");

        String secondPrimaryBody = """
                {
                    "contact": {
                        "firstName": "John",
                        "lastName": "Smith",
                        "email": "john.smith@example.com",
                        "phone": "0123456780"
                    },
                    "role": "League Administrator",
                    "isPrimary": true
                }
                """;
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts",
                                club.getId(),
                                league.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(secondPrimaryBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.isPrimary").value(true));

        String listResponse = mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts",
                                club.getId(),
                                league.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        java.util.List<Boolean> firstContactPrimaryFlags = com.jayway.jsonpath.JsonPath.read(
                listResponse, "$[?(@.id == '" + firstContactId + "')].isPrimary");
        assertThat(firstContactPrimaryFlags).containsExactly(false);
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

    private League newLeague(UUID clubId) {
        return League.builder()
                .clubId(clubId)
                .name("Premier League")
                .source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(11)
                .active(true)
                .build();
    }
}
