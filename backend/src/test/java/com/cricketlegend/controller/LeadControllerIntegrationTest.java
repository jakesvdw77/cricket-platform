package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Lead;
import com.cricketlegend.domain.LeadStatus;
import com.cricketlegend.repository.LeadRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * HTTP-layer integration test for LeadController — per docs/specs/004-landing-page.md's Test Plan
 * ("Integration: POST /api/v1/leads persists correctly against Testcontainers Postgres; GET
 * /api/v1/platform/leads filters by status"), plus SecurityConfig's platform_admin enforcement,
 * which nothing else exercises yet.
 *
 * <p>Uses {@code @Import(AbstractIntegrationTest.class)} rather than {@code extends}, matching
 * this repo's existing repository-tier tests — {@code extends} triggered a Spring Boot
 * @Bean-on-test-class error.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class LeadControllerIntegrationTest {

    private static final String PLATFORM_ADMIN_ROLE = "platform_admin";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private LeadRepository leadRepository;

    @Test
    void createValidLeadPersistsWithNewStatusAndIsPublic() throws Exception {
        String body = """
                {
                    "name": "Ada Lovelace",
                    "email": "ada@example.com",
                    "clubName": "Riverside CC",
                    "phone": "0400 000 000",
                    "message": "Interested in onboarding."
                }
                """;

        mockMvc.perform(post("/api/v1/leads").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("NEW"))
                .andExpect(jsonPath("$.name").value("Ada Lovelace"))
                .andExpect(jsonPath("$.email").value("ada@example.com"));

        List<Lead> leads = leadRepository.findAll();
        assertThat(leads).hasSize(1);
        assertThat(leads.get(0).getStatus()).isEqualTo(LeadStatus.NEW);
        assertThat(leads.get(0).getClubName()).isEqualTo("Riverside CC");
    }

    @Test
    void createWithInvalidEmailReturns400() throws Exception {
        String body = """
                {
                    "name": "Ada Lovelace",
                    "email": "not-an-email",
                    "clubName": "Riverside CC"
                }
                """;

        mockMvc.perform(post("/api/v1/leads").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());

        assertThat(leadRepository.findAll()).isEmpty();
    }

    @Test
    void listWithoutAuthenticationReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/platform/leads")).andExpect(status().isUnauthorized());
    }

    @Test
    void listWithPlatformAdminJwtFiltersByStatusAndPaginates() throws Exception {
        Instant now = Instant.now();
        leadRepository.save(newLead("Older New", LeadStatus.NEW, now.minus(3, ChronoUnit.DAYS)));
        leadRepository.save(newLead("Newer New", LeadStatus.NEW, now.minus(2, ChronoUnit.DAYS)));
        leadRepository.save(newLead("Newest New", LeadStatus.NEW, now.minus(1, ChronoUnit.DAYS)));
        leadRepository.save(newLead("Contacted", LeadStatus.CONTACTED, now));

        mockMvc.perform(get("/api/v1/platform/leads").with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(4)));

        mockMvc.perform(get("/api/v1/platform/leads").queryParam("status", "NEW").with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(3)))
                .andExpect(jsonPath("$.content[0].name").value("Newest New"));

        mockMvc.perform(get("/api/v1/platform/leads")
                        .queryParam("status", "NEW")
                        .queryParam("page", "0")
                        .queryParam("size", "2")
                        .with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
    }

    @Test
    void transitionStatusWithPlatformAdminJwtTransitionsCorrectly() throws Exception {
        Lead lead = leadRepository.save(newLead("Ada Lovelace", LeadStatus.NEW, Instant.now()));

        mockMvc.perform(post("/api/v1/platform/leads/{id}/status", lead.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"CONTACTED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONTACTED"));

        Lead reloaded = leadRepository.findById(lead.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(LeadStatus.CONTACTED);
        assertThat(reloaded.getContactedAt()).isNotNull();
    }

    @Test
    void transitionStatusWithIllegalTransitionReturns409() throws Exception {
        Lead lead = leadRepository.save(newLead("Ada Lovelace", LeadStatus.NEW, Instant.now()));

        // NEW -> CONVERTED is not in the allowed-transition table.
        mockMvc.perform(post("/api/v1/platform/leads/{id}/status", lead.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"CONVERTED\"}"))
                .andExpect(status().isConflict());

        Lead reloaded = leadRepository.findById(lead.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(LeadStatus.NEW);
    }

    @Test
    void transitionStatusWithoutAuthenticationReturns401() throws Exception {
        Lead lead = leadRepository.save(newLead("Ada Lovelace", LeadStatus.NEW, Instant.now()));

        mockMvc.perform(post("/api/v1/platform/leads/{id}/status", lead.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"CONTACTED\"}"))
                .andExpect(status().isUnauthorized());
    }

    /**
     * The {@code jwt()} post-processor doesn't invoke SecurityConfig's custom
     * jwtAuthenticationConverter() (it isn't exposed as a bean), so the realm_access claim alone
     * isn't enough to satisfy hasRole("platform_admin") here — the granted authority has to be
     * set explicitly to match what that converter would have produced at runtime
     * (ROLE_platform_admin). The realm_access claim is still set too, so the mock JWT's shape
     * matches what SecurityConfig actually reads.
     */
    private JwtRequestPostProcessor platformAdmin() {
        return jwt()
                .jwt((Jwt.Builder builder) -> builder
                        .claim("realm_access", java.util.Map.of("roles", List.of(PLATFORM_ADMIN_ROLE))))
                .authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority(
                        "ROLE_" + PLATFORM_ADMIN_ROLE));
    }

    private Lead newLead(String name, LeadStatus status, Instant createdAt) {
        Lead lead = new Lead();
        lead.setName(name);
        lead.setEmail(name.toLowerCase().replace(" ", ".") + "@example.com");
        lead.setClubName("Some CC");
        lead.setStatus(status);
        lead.setCreatedAt(createdAt);
        return lead;
    }
}
