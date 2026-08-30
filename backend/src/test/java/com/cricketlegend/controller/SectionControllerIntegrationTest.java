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
import com.cricketlegend.domain.ClubContact;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Contact;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Section;
import com.cricketlegend.repository.ClubContactRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonRepository;
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
 * HTTP-layer integration test for SectionController — per docs/specs/025-club-structure.md's Test
 * Plan, following docs/specs/024-sponsor-contacts.md's own {@code
 * SponsorContactControllerIntegrationTest} pattern exactly ({@code withSubject}, a real {@code
 * Person} + {@code RoleAssignment(CLUB_ADMIN, CLUB, clubId)} row): a real {@code CLUB_ADMIN} can
 * reach all eight endpoints for their own club, gets {@code 403} for a different club and {@code
 * 404} for a {@code sectionId}/{@code contactId} that's real but belongs to a different club, a
 * {@code platform_admin} JWT also succeeds (proving {@code AccessService.canAdministerClub}'s
 * superset-access claim end-to-end), and the active-child deactivate-block is proven through the
 * real HTTP layer with the distinct "active child section(s)" message.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class SectionControllerIntegrationTest {

    private static final String SECTION_BODY = """
            {
                "name": "Juniors",
                "minAge": null,
                "maxAge": null,
                "gender": null
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private ClubContactRepository clubContactRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    @Test
    void clubAdminCanReachAllEightEndpointsForTheirOwnClub() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(
                        get("/api/v1/manage/clubs/{clubId}/sections", club.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        String createResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/sections", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SECTION_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Juniors"))
                .andExpect(jsonPath("$.active").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String sectionId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        String updateBody = """
                {
                    "name": "Juniors (renamed)",
                    "minAge": 6,
                    "maxAge": 18,
                    "gender": null
                }
                """;
        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/sections/{sectionId}", club.getId(), sectionId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Juniors (renamed)"))
                .andExpect(jsonPath("$.minAge").value(6))
                .andExpect(jsonPath("$.maxAge").value(18));

        ClubContact contact = clubContactRepository.save(newClubContact(club.getId()));

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts",
                                club.getId(),
                                sectionId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts/{contactId}/link",
                                club.getId(),
                                sectionId,
                                contact.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts",
                                club.getId(),
                                sectionId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(contact.getId().toString()));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts/{contactId}/unlink",
                                club.getId(),
                                sectionId,
                                contact.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts",
                                club.getId(),
                                sectionId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/deactivate",
                                club.getId(),
                                sectionId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/reactivate",
                                club.getId(),
                                sectionId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void clubAdminGets403OnAllEndpointsForADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Section sectionY = sectionRepository.save(newSection(clubY.getId(), null));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());
        UUID contactId = UUID.randomUUID();

        mockMvc.perform(
                        get("/api/v1/manage/clubs/{clubId}/sections", clubY.getId()).with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/sections", clubY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SECTION_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}",
                                clubY.getId(),
                                sectionY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SECTION_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/deactivate",
                                clubY.getId(),
                                sectionY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/reactivate",
                                clubY.getId(),
                                sectionY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts",
                                clubY.getId(),
                                sectionY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts/{contactId}/link",
                                clubY.getId(),
                                sectionY.getId(),
                                contactId)
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts/{contactId}/unlink",
                                clubY.getId(),
                                sectionY.getId(),
                                contactId)
                        .with(admin))
                .andExpect(status().isForbidden());
    }

    @Test
    void clubAdminGets404ForASectionIdThatIsRealButBelongsToADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Section sectionY = sectionRepository.save(newSection(clubY.getId(), null));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        // clubX is the caller's own club (so @PreAuthorize passes), but sectionY belongs to
        // clubY — the service's findOrThrowForClub must 404 this, not the controller's
        // @PreAuthorize.
        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}",
                                clubX.getId(),
                                sectionY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SECTION_BODY))
                .andExpect(status().isNotFound());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts",
                                clubX.getId(),
                                sectionY.getId())
                        .with(admin))
                .andExpect(status().isNotFound());
    }

    @Test
    void clubAdminGets404ForAContactIdThatIsRealButBelongsToADifferentClubWhenLinking() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Section sectionX = sectionRepository.save(newSection(clubX.getId(), null));
        ClubContact contactY = clubContactRepository.save(newClubContact(clubY.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts/{contactId}/link",
                                clubX.getId(),
                                sectionX.getId(),
                                contactY.getId())
                        .with(admin))
                .andExpect(status().isNotFound());
    }

    @Test
    void platformAdminSucceedsOnAllEightEndpointsForAnArbitraryClubsSections() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        ClubContact contact = clubContactRepository.save(newClubContact(club.getId()));

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/sections", club.getId()).with(platformAdmin()))
                .andExpect(status().isOk());

        String createResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/sections", club.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SECTION_BODY))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String sectionId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/sections/{sectionId}", club.getId(), sectionId)
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SECTION_BODY))
                .andExpect(status().isOk());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts",
                                club.getId(),
                                sectionId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts/{contactId}/link",
                                club.getId(),
                                sectionId,
                                contact.getId())
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts/{contactId}/unlink",
                                club.getId(),
                                sectionId,
                                contact.getId())
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/deactivate",
                                club.getId(),
                                sectionId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/reactivate",
                                club.getId(),
                                sectionId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());
    }

    @Test
    void callerWithNoClubAdminGrantAndNoPlatformAdminRoleGets403() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        JwtRequestPostProcessor unknown = withSubject("unknown-sub-no-person-or-grant");

        mockMvc.perform(
                        get("/api/v1/manage/clubs/{clubId}/sections", club.getId()).with(unknown))
                .andExpect(status().isForbidden());
    }

    /**
     * The active-child deactivate-block, proven through the real HTTP layer with the correct
     * distinct error message — a node with an active child can't be deactivated, but once the
     * child is deactivated first, the parent's own deactivate succeeds.
     */
    @Test
    void deactivateOnASectionWithAnActiveChildIsBlockedWithADistinctMessageThenSucceedsOnceTheChildIsInactive()
            throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section parent = sectionRepository.save(newSection(club.getId(), null));
        Section child = sectionRepository.save(newSection(club.getId(), parent.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/deactivate",
                                club.getId(),
                                parent.getId())
                        .with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("active child")));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/deactivate",
                                club.getId(),
                                child.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/deactivate",
                                club.getId(),
                                parent.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
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

    private Section newSection(UUID clubId, UUID parentSectionId) {
        return Section.builder()
                .clubId(clubId)
                .parentSectionId(parentSectionId)
                .name("Juniors")
                .active(true)
                .build();
    }

    private ClubContact newClubContact(UUID clubId) {
        return ClubContact.builder()
                .clubId(clubId)
                .contact(Contact.builder()
                        .firstName("Jane")
                        .lastName("Doe")
                        .email("jane@example.com")
                        .phone("0123456789")
                        .build())
                .role("Treasurer")
                .active(true)
                .build();
    }
}
