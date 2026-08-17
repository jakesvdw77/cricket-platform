package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static com.cricketlegend.PlatformRoleJwtPostProcessors.withRole;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import java.util.function.UnaryOperator;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * HTTP-layer integration test for AdminIdentityController — per
 * docs/specs/005-admin-login.md's Test Plan ("Integration: GET /api/v1/platform/me returns 200
 * with the expected identity for a JWT carrying platform_admin, and 401/403 for a JWT missing
 * it"). Testcontainers Postgres is needed only so the full Spring context boots — this endpoint
 * touches no database itself, same situation as PublicClubControllerIntegrationTest.
 *
 * <p>Uses {@code @Import(AbstractIntegrationTest.class)} rather than {@code extends}, matching
 * this repo's existing repository-tier tests — {@code extends} triggered a Spring Boot
 * @Bean-on-test-class error.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class AdminIdentityControllerIntegrationTest {

    private static final String SUBJECT = "a1b2c3d4-0000-0000-0000-000000000000";
    private static final String USERNAME = "ada.lovelace";
    private static final String EMAIL = "ada@example.com";

    // sub/preferred_username/email are set regardless of role, since AdminIdentityController
    // reads them unconditionally — see PlatformRoleJwtPostProcessors for why the granted
    // authority still has to be set explicitly rather than relying on the realm_access claim
    // alone.
    private static final UnaryOperator<Jwt.Builder> IDENTITY_CLAIMS = builder -> builder
            .subject(SUBJECT)
            .claim("preferred_username", USERNAME)
            .claim("email", EMAIL);

    @org.springframework.beans.factory.annotation.Autowired
    private MockMvc mockMvc;

    @Test
    void meWithoutAuthenticationReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/platform/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void meWithNonAdminJwtReturns403() throws Exception {
        mockMvc.perform(get("/api/v1/platform/me").with(withRole("someone_else", IDENTITY_CLAIMS)))
                .andExpect(status().isForbidden());
    }

    @Test
    void meWithPlatformAdminJwtReturnsIdentity() throws Exception {
        mockMvc.perform(get("/api/v1/platform/me").with(platformAdmin(IDENTITY_CLAIMS)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keycloakUserId").value(SUBJECT))
                .andExpect(jsonPath("$.username").value(USERNAME))
                .andExpect(jsonPath("$.email").value(EMAIL));
    }
}
