package com.cricketlegend.config;

import java.util.Collection;
import java.util.Collections;
import java.util.Map;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Per docs/specs/002-realm-subdomain-auth.md's "Identity vs. Authorization" section: Keycloak
 * keeps exactly one realm-level role worth checking directly — {@code platform_admin} for the
 * vendor's own team. This is a flat role check, deliberately NOT the scope-walk
 * {@code @access.canAdminister(...)} pattern that governs club/section/team-scoped permissions
 * once 001's RoleAssignment model exists — that model isn't built yet, and platform_admin is the
 * one documented exception to it.
 *
 * <p>{@code @EnableMethodSecurity} is on since docs/specs/012-club-profile.md's {@code PUT
 * /profile} endpoint — the first {@code @PreAuthorize} usage in the codebase, evaluated against
 * {@link com.cricketlegend.config.AccessService} (bean name {@code "access"}).
 *
 * <p>Since docs/specs/013-centralized-logging.md, {@code filterChain(HttpSecurity)} also wires in
 * {@link RequestCorrelationFilter} via {@code addFilterAfter(...,
 * BearerTokenAuthenticationFilter.class)} — placed after Spring Security's own resource-server
 * filter so {@code Authentication} is already resolved when it runs, stamping
 * {@code requestId}/{@code username}/{@code clubId} into MDC for every downstream log line.
 * Constructed with plain {@code new}, deliberately not a {@code @Component} — see that class's
 * Javadoc for why registering it as a Spring bean would double-run it per request.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/v1/leads").permitAll()
                        .requestMatchers("/api/v1/public/**").permitAll()
                        // Uploaded media (logos, banners) — public, club-facing assets meant to
                        // be visible pre-login, per docs/specs/012-club-profile.md. Serving is
                        // gated by WebConfig's resource handler location, not by URL role check.
                        .requestMatchers("/media/**").permitAll()
                        // Springdoc/OpenAPI docs — not part of the secured API surface itself.
                        .requestMatchers("/v3/api-docs**", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                        .permitAll()
                        .requestMatchers("/api/v1/platform/**").hasRole("platform_admin")
                        .requestMatchers("/api/v1/manage/**").authenticated()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())))
                // 013-centralized-logging.md — must run after BearerTokenAuthenticationFilter so
                // Authentication is already populated; plain `new`, not an injected bean, see
                // RequestCorrelationFilter's Javadoc.
                .addFilterAfter(new RequestCorrelationFilter(), BearerTokenAuthenticationFilter.class);
        return http.build();
    }

    /**
     * Maps the JWT's {@code realm_access.roles} claim to {@code ROLE_}-prefixed granted
     * authorities — the only authorization logic this config adds. Deliberately does not resolve
     * the JWT subject to a {@link com.cricketlegend.domain.Person} or walk any scoped
     * RoleAssignment rows.
     */
    JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(realmRoleConverter());
        return converter;
    }

    private Converter<Jwt, Collection<GrantedAuthority>> realmRoleConverter() {
        return jwt -> {
            Map<String, Object> realmAccess = jwt.getClaimAsMap("realm_access");
            if (realmAccess == null || !(realmAccess.get("roles") instanceof Collection<?> roles)) {
                return Collections.emptyList();
            }
            return roles.stream()
                    .map(Object::toString)
                    .map(role -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + role))
                    .toList();
        };
    }
}
