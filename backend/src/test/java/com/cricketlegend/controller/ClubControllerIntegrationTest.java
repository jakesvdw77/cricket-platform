package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static com.cricketlegend.PlatformRoleJwtPostProcessors.withRole;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.service.KeycloakProvisioningService;
import java.util.List;
import java.util.UUID;
import java.util.function.UnaryOperator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * HTTP-layer integration test for ClubController — per docs/specs/010-minimal-club-creation.md's
 * Test Plan and docs/plans/010-minimal-club-creation.md's Test tier list: full CRUD, suspend/
 * reactivate flows end to end, and platform_admin enforcement on every route.
 *
 * <p>Uses {@code @Import(AbstractIntegrationTest.class)} rather than {@code extends}, matching
 * {@code ProductControllerIntegrationTest}'s convention.
 *
 * <p>{@code KeycloakProvisioningService} is {@code @MockitoBean}'d — per
 * docs/specs/016-keycloak-account-provisioning.md's ADR-03 follow-up, {@code ClubServiceImpl}'s
 * create/update now call it, and without a mock this test class would make a real network call
 * to whatever {@code app.keycloak.admin.server-url} resolves to (a local dev Keycloak that isn't
 * running in CI) on every test hitting {@code create()}/{@code update()}. The real HTTP/DB layers
 * under test here don't need Keycloak reachable to be exercised — that behavior is covered by
 * {@code ClubServiceImplTest}'s mocked-service unit coverage and
 * {@code KeycloakProvisioningServiceImplTest}'s own unit coverage, not here.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class ClubControllerIntegrationTest {

    @MockitoBean
    private KeycloakProvisioningService keycloakProvisioningService;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClubRepository clubRepository;

    @Test
    void createValidClubPersistsAsActiveWithStatus201() throws Exception {
        String body = """
                {
                    "name": "Riverside Cricket Club",
                    "slug": "riverside-cc"
                }
                """;

        mockMvc.perform(post("/api/v1/platform/clubs")
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.name").value("Riverside Cricket Club"))
                .andExpect(jsonPath("$.slug").value("riverside-cc"));

        List<Club> clubs = clubRepository.findAll();
        assertThat(clubs).hasSize(1);
        assertThat(clubs.get(0).getStatus()).isEqualTo(ClubStatus.ACTIVE);
    }

    @Test
    void createWithBlankNameReturns400() throws Exception {
        String body = """
                {
                    "name": "",
                    "slug": "riverside-cc"
                }
                """;

        mockMvc.perform(post("/api/v1/platform/clubs")
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());

        assertThat(clubRepository.findAll()).isEmpty();
    }

    @Test
    void createWithMalformedSlugReturns400() throws Exception {
        String body = """
                {
                    "name": "Riverside Cricket Club",
                    "slug": "Riverside CC"
                }
                """;

        mockMvc.perform(post("/api/v1/platform/clubs")
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());

        assertThat(clubRepository.findAll()).isEmpty();
    }

    @Test
    void createWithReservedSlugReturns400() throws Exception {
        String body = """
                {
                    "name": "Admin Club",
                    "slug": "admin"
                }
                """;

        mockMvc.perform(post("/api/v1/platform/clubs")
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());

        assertThat(clubRepository.findAll()).isEmpty();
    }

    @Test
    void createWithDuplicateSlugReturns409() throws Exception {
        // The slug in the request body itself must already be lowercase to pass @Pattern bean
        // validation (see CreateClubRequestValidationTest) — case-insensitive duplicate
        // detection against an existing differently-cased row is exercised at the repository
        // (ClubRepositoryTest#existsBySlugIgnoreCase...) and service (ClubServiceImplTest)
        // tiers instead, where a slug can be supplied directly without going through bean
        // validation.
        clubRepository.save(newClub("Riverside Cricket Club", "riverside-cc", ClubStatus.ACTIVE));

        String body = """
                {
                    "name": "Another Riverside",
                    "slug": "riverside-cc"
                }
                """;

        mockMvc.perform(post("/api/v1/platform/clubs")
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());

        assertThat(clubRepository.findAll()).hasSize(1);
    }

    @Test
    void listWithoutAuthenticationReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/platform/clubs")).andExpect(status().isUnauthorized());
    }

    @Test
    void listWithNonPlatformAdminJwtReturns403() throws Exception {
        mockMvc.perform(get("/api/v1/platform/clubs")
                        .with(withRole("someone_else", UnaryOperator.identity())))
                .andExpect(status().isForbidden());
    }

    @Test
    void listReturnsPaginatedResultsOrderedByNameByDefault() throws Exception {
        clubRepository.save(newClub("Third CC", "third-cc", ClubStatus.ACTIVE));
        clubRepository.save(newClub("First CC", "first-cc", ClubStatus.ACTIVE));
        clubRepository.save(newClub("Second CC", "second-cc", ClubStatus.ACTIVE));

        mockMvc.perform(get("/api/v1/platform/clubs").with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(3)))
                .andExpect(jsonPath("$.content[0].slug").value("first-cc"))
                .andExpect(jsonPath("$.content[1].slug").value("second-cc"))
                .andExpect(jsonPath("$.content[2].slug").value("third-cc"))
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    @Test
    void getByIdReturnsTheClub() throws Exception {
        Club club = clubRepository.save(newClub("Riverside Cricket Club", "riverside-cc", ClubStatus.ACTIVE));

        mockMvc.perform(get("/api/v1/platform/clubs/{id}", club.getId()).with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("riverside-cc"));
    }

    @Test
    void getMissingClubReturns404() throws Exception {
        mockMvc.perform(get("/api/v1/platform/clubs/{id}", UUID.randomUUID()).with(platformAdmin()))
                .andExpect(status().isNotFound());
    }

    @Test
    void updatePersistsEditedNameAndSlug() throws Exception {
        Club club = clubRepository.save(newClub("Riverside Cricket Club", "riverside-cc", ClubStatus.ACTIVE));

        String body = """
                {
                    "name": "Riverside CC (renamed)",
                    "slug": "riverside-cc-2"
                }
                """;

        mockMvc.perform(put("/api/v1/platform/clubs/{id}", club.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Riverside CC (renamed)"))
                .andExpect(jsonPath("$.slug").value("riverside-cc-2"));

        Club reloaded = clubRepository.findById(club.getId()).orElseThrow();
        assertThat(reloaded.getName()).isEqualTo("Riverside CC (renamed)");
        assertThat(reloaded.getSlug()).isEqualTo("riverside-cc-2");
        assertThat(reloaded.getId()).isEqualTo(club.getId());
    }

    @Test
    void updateWithUnchangedOwnSlugSucceeds() throws Exception {
        Club club = clubRepository.save(newClub("Riverside Cricket Club", "riverside-cc", ClubStatus.ACTIVE));

        String body = """
                {
                    "name": "Riverside Cricket Club (renamed)",
                    "slug": "riverside-cc"
                }
                """;

        mockMvc.perform(put("/api/v1/platform/clubs/{id}", club.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Riverside Cricket Club (renamed)"));
    }

    @Test
    void suspendTransitionsActiveClubToSuspendedAndKeepsItFetchable() throws Exception {
        Club club = clubRepository.save(newClub("Riverside Cricket Club", "riverside-cc", ClubStatus.ACTIVE));

        mockMvc.perform(post("/api/v1/platform/clubs/{id}/suspend", club.getId()).with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUSPENDED"));

        mockMvc.perform(get("/api/v1/platform/clubs/{id}", club.getId()).with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUSPENDED"));
    }

    @Test
    void suspendOnAlreadySuspendedClubReturns409() throws Exception {
        Club club = clubRepository.save(newClub("Riverside Cricket Club", "riverside-cc", ClubStatus.SUSPENDED));

        mockMvc.perform(post("/api/v1/platform/clubs/{id}/suspend", club.getId()).with(platformAdmin()))
                .andExpect(status().isConflict());
    }

    @Test
    void reactivateTransitionsSuspendedClubToActive() throws Exception {
        Club club = clubRepository.save(newClub("Riverside Cricket Club", "riverside-cc", ClubStatus.SUSPENDED));

        mockMvc.perform(post("/api/v1/platform/clubs/{id}/reactivate", club.getId()).with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    void reactivateOnAlreadyActiveClubReturns409() throws Exception {
        Club club = clubRepository.save(newClub("Riverside Cricket Club", "riverside-cc", ClubStatus.ACTIVE));

        mockMvc.perform(post("/api/v1/platform/clubs/{id}/reactivate", club.getId()).with(platformAdmin()))
                .andExpect(status().isConflict());
    }

    @Test
    void createUpdateSuspendAndReactivateWithoutAuthenticationAllReturn401() throws Exception {
        Club club = clubRepository.save(newClub("Riverside Cricket Club", "riverside-cc", ClubStatus.ACTIVE));

        mockMvc.perform(post("/api/v1/platform/clubs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"X\", \"slug\": \"x-club\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/platform/clubs/{id}", club.getId()))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(put("/api/v1/platform/clubs/{id}", club.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"X\", \"slug\": \"x-club\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/platform/clubs/{id}/suspend", club.getId()))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/platform/clubs/{id}/reactivate", club.getId()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createUpdateSuspendAndReactivateWithNonPlatformAdminJwtAllReturn403() throws Exception {
        Club club = clubRepository.save(newClub("Riverside Cricket Club", "riverside-cc", ClubStatus.ACTIVE));

        mockMvc.perform(post("/api/v1/platform/clubs")
                        .with(withRole("someone_else", UnaryOperator.identity()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"X\", \"slug\": \"x-club\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/v1/platform/clubs/{id}", club.getId())
                        .with(withRole("someone_else", UnaryOperator.identity()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"X\", \"slug\": \"x-club\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/platform/clubs/{id}/suspend", club.getId())
                        .with(withRole("someone_else", UnaryOperator.identity())))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/platform/clubs/{id}/reactivate", club.getId())
                        .with(withRole("someone_else", UnaryOperator.identity())))
                .andExpect(status().isForbidden());
    }

    private Club newClub(String name, String slug, ClubStatus status) {
        return Club.builder().name(name).slug(slug).status(status).build();
    }
}
