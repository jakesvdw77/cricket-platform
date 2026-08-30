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
import com.cricketlegend.domain.Sponsor;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SponsorRepository;
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
 * HTTP-layer integration test for SponsorContactController — per docs/specs/024-sponsor-contacts.md's
 * Test Plan, following docs/specs/021-club-contacts.md's own {@code
 * ClubContactControllerIntegrationTest} pattern exactly ({@code withSubject}, a real {@code
 * Person} + {@code RoleAssignment(CLUB_ADMIN, CLUB, clubId)} row): a real {@code CLUB_ADMIN} can
 * reach all five endpoints for their own club+sponsor, gets 403 for a different club and 404 for a
 * {@code sponsorId} that's real but belongs to a different club, a {@code platform_admin} JWT also
 * succeeds (proving {@code AccessService.canAdministerClub}'s superset-access claim end-to-end),
 * and — critically — the create-a-second-primary-succeeds-through-the-HTTP-layer case (no 409),
 * the exact scenario that was initially broken in {@code 021} before the {@code saveAndFlush} fix.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class SponsorContactControllerIntegrationTest {

    private static final String CONTACT_BODY = """
            {
                "contact": {
                    "firstName": "Jane",
                    "lastName": "Doe",
                    "email": "jane@example.com",
                    "phone": "0123456789"
                },
                "role": "Marketing Lead",
                "isPrimary": false
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SponsorRepository sponsorRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    @Test
    void clubAdminCanListCreateUpdateDeactivateAndReactivateContactsForTheirOwnClubsSponsor() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Sponsor sponsor = sponsorRepository.save(newSponsor(club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts",
                                club.getId(),
                                sponsor.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        String createResponse = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts",
                                club.getId(),
                                sponsor.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("Marketing Lead"))
                .andExpect(jsonPath("$.contact.email").value("jane@example.com"))
                .andExpect(jsonPath("$.active").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String contactId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts",
                                club.getId(),
                                sponsor.getId())
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
                    "role": "Treasurer",
                    "isPrimary": false
                }
                """;
        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}",
                                club.getId(),
                                sponsor.getId(),
                                contactId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("Treasurer"))
                .andExpect(jsonPath("$.contact.lastName").value("Smith"));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}/deactivate",
                                club.getId(),
                                sponsor.getId(),
                                contactId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}/reactivate",
                                club.getId(),
                                sponsor.getId(),
                                contactId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void clubAdminGets403OnAllFiveEndpointsForADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Sponsor sponsorY = sponsorRepository.save(newSponsor(clubY.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());
        UUID contactId = UUID.randomUUID();

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts",
                                clubY.getId(),
                                sponsorY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts",
                                clubY.getId(),
                                sponsorY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}",
                                clubY.getId(),
                                sponsorY.getId(),
                                contactId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}/deactivate",
                                clubY.getId(),
                                sponsorY.getId(),
                                contactId)
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}/reactivate",
                                clubY.getId(),
                                sponsorY.getId(),
                                contactId)
                        .with(admin))
                .andExpect(status().isForbidden());
    }

    @Test
    void clubAdminGets404ForASponsorIdThatIsRealButBelongsToADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Sponsor sponsorY = sponsorRepository.save(newSponsor(clubY.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        // clubX is the caller's own club (so @PreAuthorize passes), but sponsorY belongs to clubY —
        // the service's findOrThrowSponsorForClub must 404 this, not the controller's @PreAuthorize.
        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts",
                                clubX.getId(),
                                sponsorY.getId())
                        .with(admin))
                .andExpect(status().isNotFound());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts",
                                clubX.getId(),
                                sponsorY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isNotFound());
    }

    @Test
    void platformAdminSucceedsOnAllFiveEndpointsForAnArbitraryClubsSponsor() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Sponsor sponsor = sponsorRepository.save(newSponsor(club.getId()));

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts",
                                club.getId(),
                                sponsor.getId())
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        String createResponse = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts",
                                club.getId(),
                                sponsor.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String contactId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}",
                                club.getId(),
                                sponsor.getId(),
                                contactId)
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}/deactivate",
                                club.getId(),
                                sponsor.getId(),
                                contactId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}/reactivate",
                                club.getId(),
                                sponsor.getId(),
                                contactId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());
    }

    @Test
    void callerWithNoClubAdminGrantAndNoPlatformAdminRoleGets403OnAllFiveEndpoints() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Sponsor sponsor = sponsorRepository.save(newSponsor(club.getId()));
        UUID contactId = UUID.randomUUID();
        JwtRequestPostProcessor unknown = withSubject("unknown-sub-no-person-or-grant");

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts",
                                club.getId(),
                                sponsor.getId())
                        .with(unknown))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts",
                                club.getId(),
                                sponsor.getId())
                        .with(unknown)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}",
                                club.getId(),
                                sponsor.getId(),
                                contactId)
                        .with(unknown)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}/deactivate",
                                club.getId(),
                                sponsor.getId(),
                                contactId)
                        .with(unknown))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}/reactivate",
                                club.getId(),
                                sponsor.getId(),
                                contactId)
                        .with(unknown))
                .andExpect(status().isForbidden());
    }

    /**
     * The exact scenario that was initially broken in {@code 021} before the {@code saveAndFlush}
     * fix (see {@code SponsorContactServiceImpl.unsetOtherActivePrimaries}'s Javadoc): creating a
     * second contact with {@code isPrimary: true} while a different active contact already held
     * the primary flag must silently succeed (auto-unsetting the first), not throw a 409 from
     * {@code ux_sponsor_contact_primary}. Proven passing on the first version of this test, per
     * the spec's own Test Plan — not added after finding a bug, unlike {@code 021}'s history.
     */
    @Test
    void settingIsPrimaryTrueOnASecondContactUnsetsTheFirstContactsPrimaryFlagThroughTheHttpLayer()
            throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Sponsor sponsor = sponsorRepository.save(newSponsor(club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        String firstPrimaryBody = """
                {
                    "contact": {
                        "firstName": "Jane",
                        "lastName": "Doe",
                        "email": "jane@example.com",
                        "phone": "0123456789"
                    },
                    "role": "Marketing Lead",
                    "isPrimary": true
                }
                """;
        String firstResponse = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts",
                                club.getId(),
                                sponsor.getId())
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
                    "isPrimary": true
                }
                """;
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts",
                                club.getId(),
                                sponsor.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(secondPrimaryBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.isPrimary").value(true));

        String listResponse = mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts",
                                club.getId(),
                                sponsor.getId())
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

    private Sponsor newSponsor(UUID clubId) {
        return Sponsor.builder().clubId(clubId).name("Acme Sponsor").active(true).build();
    }
}
