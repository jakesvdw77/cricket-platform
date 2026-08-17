package com.cricketlegend.controller;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
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

    private static final String PLATFORM_ADMIN_ROLE = "platform_admin";

    private static final String SUBJECT = "a1b2c3d4-0000-0000-0000-000000000000";
    private static final String USERNAME = "ada.lovelace";
    private static final String EMAIL = "ada@example.com";

    @org.springframework.beans.factory.annotation.Autowired
    private MockMvc mockMvc;

    @Test
    void meWithoutAuthenticationReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/platform/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void meWithNonAdminJwtReturns403() throws Exception {
        mockMvc.perform(get("/api/v1/platform/me").with(nonAdmin())).andExpect(status().isForbidden());
    }

    @Test
    void meWithPlatformAdminJwtReturnsIdentity() throws Exception {
        mockMvc.perform(get("/api/v1/platform/me").with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keycloakUserId").value(SUBJECT))
                .andExpect(jsonPath("$.username").value(USERNAME))
                .andExpect(jsonPath("$.email").value(EMAIL));
    }

    /**
     * The {@code jwt()} post-processor doesn't invoke SecurityConfig's custom
     * jwtAuthenticationConverter() (it isn't exposed as a bean), so the realm_access claim alone
     * isn't enough to satisfy hasRole("platform_admin") here — the granted authority has to be
     * set explicitly to match what that converter would have produced at runtime
     * (ROLE_platform_admin). The realm_access claim is still set too, so the mock JWT's shape
     * matches what SecurityConfig actually reads. sub/preferred_username/email are set since
     * AdminIdentityController reads them.
     */
    private JwtRequestPostProcessor platformAdmin() {
        return jwt()
                .jwt((Jwt.Builder builder) -> builder
                        .subject(SUBJECT)
                        .claim("preferred_username", USERNAME)
                        .claim("email", EMAIL)
                        .claim("realm_access", java.util.Map.of("roles", List.of(PLATFORM_ADMIN_ROLE))))
                .authorities(new SimpleGrantedAuthority("ROLE_" + PLATFORM_ADMIN_ROLE));
    }

    /** Authenticated, but missing the platform_admin role — exercises SecurityConfig's 403 path. */
    private JwtRequestPostProcessor nonAdmin() {
        return jwt()
                .jwt((Jwt.Builder builder) -> builder
                        .subject(SUBJECT)
                        .claim("preferred_username", USERNAME)
                        .claim("email", EMAIL)
                        .claim("realm_access", java.util.Map.of("roles", List.of("someone_else"))))
                .authorities(new SimpleGrantedAuthority("ROLE_someone_else"));
    }
}
