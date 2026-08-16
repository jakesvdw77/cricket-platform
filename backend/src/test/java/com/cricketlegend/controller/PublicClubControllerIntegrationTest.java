package com.cricketlegend.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.repository.ClubRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * HTTP-layer integration test for PublicClubController — per docs/specs/004-landing-page.md's
 * Test Plan ("Integration: GET /api/v1/public/clubs excludes non-ACTIVE clubs") and Acceptance
 * Criteria ("ONBOARDING and SUSPENDED clubs never appear in the 'find your club' search
 * results"). Public/unauthenticated per SecurityConfig.
 *
 * <p>Uses {@code @Import(AbstractIntegrationTest.class)} rather than {@code extends}, matching
 * this repo's existing repository-tier tests.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class PublicClubControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClubRepository clubRepository;

    @Test
    void searchReturnsOnlyActiveClubsWithoutAuthentication() throws Exception {
        clubRepository.save(Club.builder().name("Riverside CC").slug("riverside").status(ClubStatus.ACTIVE).build());
        clubRepository.save(Club.builder().name("Riverdale Onboarding").slug("riverdale").status(ClubStatus.ONBOARDING).build());
        clubRepository.save(Club.builder().name("Riverbank Suspended").slug("riverbank").status(ClubStatus.SUSPENDED).build());

        mockMvc.perform(get("/api/v1/public/clubs").queryParam("query", "river"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].slug").value("riverside"))
                .andExpect(jsonPath("$[0].name").value("Riverside CC"));
    }

    @Test
    void searchWithNoMatchesReturnsEmptyList() throws Exception {
        clubRepository.save(Club.builder().name("Onboarding Oaks").slug("onboarding-oaks").status(ClubStatus.ONBOARDING).build());

        mockMvc.perform(get("/api/v1/public/clubs").queryParam("query", "nomatch"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }
}
