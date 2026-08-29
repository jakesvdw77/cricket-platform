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
 * HTTP-layer integration test for SponsorController — per docs/specs/023-sponsors.md's Test Plan,
 * following docs/specs/021-club-contacts.md's own {@code ClubContactControllerIntegrationTest}
 * pattern exactly ({@code withSubject}, a real {@code Person} + {@code
 * RoleAssignment(CLUB_ADMIN, CLUB, clubId)} row): a real {@code CLUB_ADMIN} can reach all five
 * endpoints for their own club (with a {@code socialLinks} entry round-tripping through
 * create/update), gets 403 for a different club or with no matching grant, a {@code
 * platform_admin} JWT also succeeds (proving {@code AccessService.canAdministerClub}'s
 * superset-access claim end-to-end), and a duplicate {@code platform} within {@code socialLinks}
 * on create is rejected with a 400.
 *
 * <p>A green run here does NOT prove {@code SponsorServiceImpl}'s {@code @Transactional}
 * annotations are load-bearing against a real {@code LazyInitializationException} — this test
 * class's own {@code @Transactional} keeps a Hibernate session open across the whole test method
 * regardless of the production code, the same limitation noted on {@code
 * ClubProfileServiceImpl}/{@code SponsorServiceImpl}'s own Javadoc. That was proven separately by
 * a manual smoke test, not by this suite.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class SponsorControllerIntegrationTest {

    private static final String SPONSOR_BODY = """
            {
                "name": "Acme Sponsor",
                "website": "https://acme.example",
                "email": "acme@example.com",
                "phone": "0123456789",
                "logoUrl": "/media/logo.png",
                "bannerUrl": "/media/banner.png",
                "socialLinks": [
                    { "platform": "facebook", "url": "https://facebook.com/acme" }
                ]
            }
            """;

    private static final String DUPLICATE_PLATFORM_BODY = """
            {
                "name": "Acme Sponsor",
                "website": null,
                "email": null,
                "phone": null,
                "logoUrl": null,
                "bannerUrl": null,
                "socialLinks": [
                    { "platform": "facebook", "url": "https://facebook.com/a" },
                    { "platform": "facebook", "url": "https://facebook.com/b" }
                ]
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
    void clubAdminCanListCreateUpdateDeactivateAndReactivateSponsorsForTheirOwnClub() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/sponsors", club.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        String createResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/sponsors", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SPONSOR_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Acme Sponsor"))
                .andExpect(jsonPath("$.email").value("acme@example.com"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.socialLinks.length()").value(1))
                .andExpect(jsonPath("$.socialLinks[0].platform").value("facebook"))
                .andExpect(jsonPath("$.socialLinks[0].url").value("https://facebook.com/acme"))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String sponsorId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/sponsors", club.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        String updateBody = """
                {
                    "name": "Acme Sponsor Renamed",
                    "website": "https://acme.example",
                    "email": "acme@example.com",
                    "phone": "0123456789",
                    "logoUrl": "/media/logo.png",
                    "bannerUrl": "/media/banner.png",
                    "socialLinks": [
                        { "platform": "instagram", "url": "https://instagram.com/acme" }
                    ]
                }
                """;
        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}", club.getId(), sponsorId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Acme Sponsor Renamed"))
                .andExpect(jsonPath("$.socialLinks.length()").value(1))
                .andExpect(jsonPath("$.socialLinks[0].platform").value("instagram"))
                .andExpect(jsonPath("$.socialLinks[0].url").value("https://instagram.com/acme"));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/deactivate",
                                club.getId(),
                                sponsorId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/reactivate",
                                club.getId(),
                                sponsorId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void clubAdminGets403OnAllFiveEndpointsForADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());
        UUID sponsorId = UUID.randomUUID();

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/sponsors", clubY.getId()).with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/sponsors", clubY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SPONSOR_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}", clubY.getId(), sponsorId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SPONSOR_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/deactivate", clubY.getId(), sponsorId)
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/reactivate", clubY.getId(), sponsorId)
                        .with(admin))
                .andExpect(status().isForbidden());
    }

    @Test
    void platformAdminSucceedsOnAllFiveEndpointsForAnArbitraryClub() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/sponsors", club.getId()).with(platformAdmin()))
                .andExpect(status().isOk());

        String createResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/sponsors", club.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SPONSOR_BODY))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String sponsorId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}", club.getId(), sponsorId)
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SPONSOR_BODY))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/deactivate",
                                club.getId(),
                                sponsorId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/reactivate",
                                club.getId(),
                                sponsorId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());
    }

    @Test
    void callerWithNoClubAdminGrantAndNoPlatformAdminRoleGets403OnAllFiveEndpoints() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        UUID sponsorId = UUID.randomUUID();
        JwtRequestPostProcessor unknown = withSubject("unknown-sub-no-person-or-grant");

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/sponsors", club.getId()).with(unknown))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/sponsors", club.getId())
                        .with(unknown)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SPONSOR_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}", club.getId(), sponsorId)
                        .with(unknown)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SPONSOR_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/deactivate", club.getId(), sponsorId)
                        .with(unknown))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/reactivate", club.getId(), sponsorId)
                        .with(unknown))
                .andExpect(status().isForbidden());
    }

    @Test
    void createWithADuplicatePlatformInSocialLinksReturns400() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/sponsors", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(DUPLICATE_PLATFORM_BODY))
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
}
