package com.cricketlegend.config;

import java.util.Collection;
import java.util.Collections;
import java.util.Map;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Per docs/specs/002-realm-subdomain-auth.md's "Identity vs. Authorization" section: Keycloak
 * keeps exactly one realm-level role worth checking directly — {@code platform_admin} for the
 * vendor's own team. This is a flat role check, deliberately NOT the scope-walk
 * {@code @access.canAdminister(...)} pattern that governs club/section/team-scoped permissions
 * once 001's RoleAssignment model exists — that model isn't built yet, and platform_admin is the
 * one documented exception to it.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/v1/leads").permitAll()
                        .requestMatchers("/api/v1/public/**").permitAll()
                        // Springdoc/OpenAPI docs — not part of the secured API surface itself.
                        .requestMatchers("/v3/api-docs**", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                        .permitAll()
                        .requestMatchers("/api/v1/platform/**").hasRole("platform_admin")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())));
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
