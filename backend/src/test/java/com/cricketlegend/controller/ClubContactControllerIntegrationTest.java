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
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.repository.ClubRepository;
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
 * HTTP-layer integration test for ClubContactController — per docs/specs/021-club-contacts.md's
 * Test Plan, following docs/specs/020-club-manager-access.md's own established pattern exactly
 * ({@code withSubject}, a real {@code Person} + {@code RoleAssignment(CLUB_ADMIN, CLUB, clubId)}
 * row): a real {@code CLUB_ADMIN} can reach all five endpoints for their own club, gets 403 for a
 * different club or with no matching grant, a {@code platform_admin} JWT also succeeds (proving
 * {@code AccessService.canAdministerClub}'s superset-access claim end-to-end), and the auto-unset
 * primary-contact behavior round-trips through the real HTTP layer.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class ClubContactControllerIntegrationTest {

    private static final String CONTACT_BODY = """
            {
                "contact": {
                    "firstName": "Jane",
                    "lastName": "Doe",
                    "email": "jane@example.com",
                    "phone": "0123456789"
                },
                "role": "Chairman",
                "isPrimary": false,
                "photoUrl": null
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    @Test
    void clubAdminCanListCreateUpdateDeactivateAndReactivateContactsForTheirOwnClub() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/contacts", club.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        String createResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/contacts", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("Chairman"))
                .andExpect(jsonPath("$.contact.email").value("jane@example.com"))
                .andExpect(jsonPath("$.active").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String contactId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/contacts", club.getId()).with(admin))
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
                    "role": "Treasurer",
                    "isPrimary": false,
                    "photoUrl": "/media/photo.png"
                }
                """;
        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/contacts/{contactId}", club.getId(), contactId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("Treasurer"))
                .andExpect(jsonPath("$.contact.lastName").value("Smith"))
                .andExpect(jsonPath("$.photoUrl").value("/media/photo.png"));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/contacts/{contactId}/deactivate",
                                club.getId(),
                                contactId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/contacts/{contactId}/reactivate",
                                club.getId(),
                                contactId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void clubAdminGets403OnAllFiveEndpointsForADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());
        UUID contactId = UUID.randomUUID();

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/contacts", clubY.getId()).with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/contacts", clubY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/contacts/{contactId}", clubY.getId(), contactId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/contacts/{contactId}/deactivate", clubY.getId(), contactId)
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/contacts/{contactId}/reactivate", clubY.getId(), contactId)
                        .with(admin))
                .andExpect(status().isForbidden());
    }

    @Test
    void platformAdminSucceedsOnAllFiveEndpointsForAnArbitraryClub() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/contacts", club.getId()).with(platformAdmin()))
                .andExpect(status().isOk());

        String createResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/contacts", club.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String contactId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/contacts/{contactId}", club.getId(), contactId)
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/contacts/{contactId}/deactivate",
                                club.getId(),
                                contactId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/contacts/{contactId}/reactivate",
                                club.getId(),
                                contactId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());
    }

    @Test
    void callerWithNoClubAdminGrantAndNoPlatformAdminRoleGets403OnAllFiveEndpoints() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        UUID contactId = UUID.randomUUID();
        JwtRequestPostProcessor unknown = withSubject("unknown-sub-no-person-or-grant");

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/contacts", club.getId()).with(unknown))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/contacts", club.getId())
                        .with(unknown)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/contacts/{contactId}", club.getId(), contactId)
                        .with(unknown)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/contacts/{contactId}/deactivate", club.getId(), contactId)
                        .with(unknown))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/contacts/{contactId}/reactivate", club.getId(), contactId)
                        .with(unknown))
                .andExpect(status().isForbidden());
    }

    /**
     * Regression test for a real bug found while writing this test (and fixed alongside it, not
     * left disabled): creating a second contact with {@code isPrimary: true} while a different
     * active contact already held the primary flag used to throw a 409 ({@code
     * DataIntegrityViolationException} from {@code ux_club_contact_primary}) instead of silently
     * succeeding with the old primary unset, on the CREATE path specifically (the UPDATE path was
     * unaffected). Root cause: {@code ClubContactServiceImpl.unsetOtherActivePrimaries} registered
     * the old contact's UPDATE before the new contact's INSERT was registered, but Hibernate's
     * default flush action ordering processes ALL pending INSERTs before ALL pending UPDATEs for a
     * transaction, regardless of registration order — so the new row's {@code isPrimary=true}
     * INSERT was sent to Postgres while the old row was still {@code isPrimary=true, active=true},
     * tripping the partial unique index. Fixed by {@code saveAndFlush}ing the unset before the
     * caller's own save proceeds — see that method's Javadoc.
     */
    @Test
    void settingIsPrimaryTrueOnASecondContactUnsetsTheFirstContactsPrimaryFlagThroughTheHttpLayer()
            throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        String firstPrimaryBody = """
                {
                    "contact": {
                        "firstName": "Jane",
                        "lastName": "Doe",
                        "email": "jane@example.com",
                        "phone": "0123456789"
                    },
                    "role": "Chairman",
                    "isPrimary": true,
                    "photoUrl": null
                }
                """;
        String firstResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/contacts", club.getId())
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
                    "role": "Treasurer",
                    "isPrimary": true,
                    "photoUrl": null
                }
                """;
        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/contacts", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(secondPrimaryBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.isPrimary").value(true));

        String listResponse = mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/contacts", club.getId()).with(admin))
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
}
