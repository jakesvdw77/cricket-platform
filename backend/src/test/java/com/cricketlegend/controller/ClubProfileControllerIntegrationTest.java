package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static com.cricketlegend.PlatformRoleJwtPostProcessors.withRole;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.repository.ClubProfileRepository;
import com.cricketlegend.repository.ClubRepository;
import java.util.UUID;
import java.util.function.UnaryOperator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * HTTP-layer integration test for ClubProfileController — per docs/specs/012-club-profile.md's
 * Test Plan and docs/plans/012-club-profile.md's Test tier list: full get/upsert flow, 401
 * unauthenticated, 403 non-admin, and specifically confirms the {@code @PreAuthorize} on
 * {@code PUT /profile} is actually wired (not just the URL matcher) — the first
 * {@code @PreAuthorize}/{@code @EnableMethodSecurity} usage in this codebase.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class ClubProfileControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private ClubProfileRepository clubProfileRepository;

    @Test
    void getOnClubWithNoProfileRowReturnsDefaultShapedDtoWith200() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));

        mockMvc.perform(get("/api/v1/platform/clubs/{id}/profile", club.getId()).with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clubId").value(club.getId().toString()))
                .andExpect(jsonPath("$.type").doesNotExist())
                .andExpect(jsonPath("$.email").doesNotExist());
    }

    @Test
    void getOnNonexistentClubReturns404() throws Exception {
        mockMvc.perform(get("/api/v1/platform/clubs/{id}/profile", UUID.randomUUID()).with(platformAdmin()))
                .andExpect(status().isNotFound());
    }

    @Test
    void putCreatesAProfileOnFirstSaveAndItIsReadableAfterward() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));

        String body = """
                {
                    "type": "CLUB",
                    "logoUrl": "/media/logo.png",
                    "bannerUrl": "/media/banner.png",
                    "address": {
                        "number": "12",
                        "street": "Main Street",
                        "city": "Riverside",
                        "provinceState": "Gauteng",
                        "country": "South Africa",
                        "postalCode": "0001"
                    },
                    "email": "club@example.com",
                    "phone": "0123456789",
                    "website": "https://example.com"
                }
                """;

        mockMvc.perform(put("/api/v1/platform/clubs/{id}/profile", club.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("CLUB"))
                .andExpect(jsonPath("$.email").value("club@example.com"))
                .andExpect(jsonPath("$.address.city").value("Riverside"));

        mockMvc.perform(get("/api/v1/platform/clubs/{id}/profile", club.getId()).with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("club@example.com"))
                .andExpect(jsonPath("$.website").value("https://example.com"));

        assertThat(clubProfileRepository.findById(club.getId())).isPresent();
    }

    @Test
    void putASecondTimeUpdatesInPlaceRatherThanCreatingASecondRow() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        clubProfileRepository.saveAndFlush(ClubProfile.builder().clubId(club.getId()).email("old@example.com").build());

        String body = """
                {
                    "email": "new@example.com"
                }
                """;

        mockMvc.perform(put("/api/v1/platform/clubs/{id}/profile", club.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("new@example.com"));

        assertThat(clubProfileRepository.count()).isEqualTo(1);
    }

    @Test
    void putWithMalformedEmailReturns400() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));

        String body = """
                {
                    "email": "not-an-email"
                }
                """;

        mockMvc.perform(put("/api/v1/platform/clubs/{id}/profile", club.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getWithoutAuthenticationReturns401() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));

        mockMvc.perform(get("/api/v1/platform/clubs/{id}/profile", club.getId()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getWithNonPlatformAdminJwtReturns403() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));

        mockMvc.perform(get("/api/v1/platform/clubs/{id}/profile", club.getId())
                        .with(withRole("someone_else", UnaryOperator.identity())))
                .andExpect(status().isForbidden());
    }

    @Test
    void putWithoutAuthenticationReturns401() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));

        mockMvc.perform(put("/api/v1/platform/clubs/{id}/profile", club.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    /**
     * A non-platform_admin JWT is rejected (403). Note this does NOT by itself distinguish the
     * method-level {@code @PreAuthorize("@access.canAdministerClub(...)")} from the flat
     * {@code /api/v1/platform/**} URL-matcher gate {@link com.cricketlegend.config.SecurityConfig}
     * already applies to every {@code platform} endpoint — a "someone_else" role never gets past
     * that URL gate either, so this test would pass identically even if
     * {@code @EnableMethodSecurity}/{@link com.cricketlegend.config.AccessService} were deleted.
     * It exists to catch a regression in the URL gate itself, not to prove the method-security
     * layer works — see {@code AccessServiceTest} for direct coverage of
     * {@code canAdministerClub}'s own logic, which is the only place this SpEL wiring's actual
     * behaviour lives.
     */
    @Test
    void putWithNonPlatformAdminJwtReturns403() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));

        mockMvc.perform(put("/api/v1/platform/clubs/{id}/profile", club.getId())
                        .with(withRole("someone_else", UnaryOperator.identity()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    private Club newClub(String name, String slug) {
        return Club.builder().name(name).slug(slug).status(ClubStatus.ACTIVE).build();
    }
}
