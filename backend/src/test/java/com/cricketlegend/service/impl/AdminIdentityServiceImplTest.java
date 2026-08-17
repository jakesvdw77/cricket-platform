package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.dto.AdminIdentityDto;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Plain JUnit 5, no Spring context — per docs/specs/005-admin-login.md's Test Plan ("Unit:
 * AdminIdentityServiceImpl maps a Jwt's claims to AdminIdentityDto correctly (subject/username/email
 * extraction)").
 */
class AdminIdentityServiceImplTest {

    private final AdminIdentityServiceImpl service = new AdminIdentityServiceImpl();

    @Test
    void getCurrentAdminMapsSubjectPreferredUsernameAndEmailClaims() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .claim("sub", "a1b2c3d4-0000-0000-0000-000000000000")
                .claim("preferred_username", "ada.lovelace")
                .claim("email", "ada@example.com")
                .build();

        AdminIdentityDto result = service.getCurrentAdmin(jwt);

        assertThat(result.keycloakUserId()).isEqualTo("a1b2c3d4-0000-0000-0000-000000000000");
        assertThat(result.username()).isEqualTo("ada.lovelace");
        assertThat(result.email()).isEqualTo("ada@example.com");
    }
}
