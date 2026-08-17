package com.cricketlegend;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;

import java.util.List;
import java.util.Map;
import java.util.function.UnaryOperator;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;

/**
 * Shared MockMvc {@code jwt()} builders for controller integration tests gated on a realm role.
 * Extracted after {@code LeadControllerIntegrationTest} and {@code AdminIdentityControllerIntegrationTest}
 * independently declared near-identical {@code platformAdmin()} helpers.
 *
 * <p>The {@code jwt()} post-processor doesn't invoke {@code SecurityConfig}'s custom
 * {@code jwtAuthenticationConverter()} (it isn't exposed as a bean), so the {@code realm_access}
 * claim alone isn't enough to satisfy {@code hasRole(...)} in a test — the granted authority has
 * to be set explicitly to match what that converter would have produced at runtime. The
 * {@code realm_access} claim is still set too, so the mock JWT's shape matches what
 * {@code SecurityConfig} actually reads.
 */
public final class PlatformRoleJwtPostProcessors {

    public static final String PLATFORM_ADMIN_ROLE = "platform_admin";

    private PlatformRoleJwtPostProcessors() {
    }

    public static JwtRequestPostProcessor platformAdmin() {
        return platformAdmin(UnaryOperator.identity());
    }

    public static JwtRequestPostProcessor platformAdmin(UnaryOperator<Jwt.Builder> claims) {
        return withRole(PLATFORM_ADMIN_ROLE, claims);
    }

    public static JwtRequestPostProcessor withRole(String role, UnaryOperator<Jwt.Builder> claims) {
        return jwt()
                .jwt(builder -> claims.apply(builder).claim("realm_access", Map.of("roles", List.of(role))))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }
}
