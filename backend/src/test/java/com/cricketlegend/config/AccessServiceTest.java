package com.cricketlegend.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * Direct coverage of {@link AccessService#canAdministerClub}'s own logic — the only place the
 * codebase's first {@code @PreAuthorize("@access.canAdministerClub(...)")} SpEL wiring's actual
 * behaviour lives. {@code ClubProfileControllerIntegrationTest}'s 403 case can't distinguish this
 * method-security layer from the flat {@code /api/v1/platform/**} URL-matcher gate that already
 * rejects a non-platform_admin caller before the controller is reached — this test exercises the
 * method itself, independent of that URL gate.
 */
class AccessServiceTest {

    private final AccessService accessService = new AccessService();
    private final UUID clubId = UUID.randomUUID();

    @Test
    void returnsFalseForNullAuthentication() {
        assertThat(accessService.canAdministerClub(null, clubId)).isFalse();
    }

    @Test
    void returnsFalseWhenAuthorityIsNotPlatformAdmin() {
        var authentication = new TestingAuthenticationToken(
                "someone-else", null, List.of(new SimpleGrantedAuthority("ROLE_someone_else")));

        assertThat(accessService.canAdministerClub(authentication, clubId)).isFalse();
    }

    @Test
    void returnsTrueWhenAuthorityIsPlatformAdmin() {
        var authentication = new TestingAuthenticationToken(
                "platform-admin", null, List.of(new SimpleGrantedAuthority("ROLE_platform_admin")));

        assertThat(accessService.canAdministerClub(authentication, clubId)).isTrue();
    }
}
