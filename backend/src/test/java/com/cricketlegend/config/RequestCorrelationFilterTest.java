package com.cricketlegend.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.servlet.FilterChain;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * Unit coverage for {@link RequestCorrelationFilter} — no Spring context, direct instantiation,
 * per docs/plans/013-centralized-logging.md's Flag #1 correction (not a {@code @Component}).
 */
class RequestCorrelationFilterTest {

    private static final String CLUB_ID = "550e8400-e29b-41d4-a716-446655440000";
    private static final String SUBSCRIPTION_ID = "660e8400-e29b-41d4-a716-446655440000";

    private final RequestCorrelationFilter filter = new RequestCorrelationFilter();

    @AfterEach
    void clearSecurityContextAndMdc() {
        SecurityContextHolder.clearContext();
        MDC.clear();
    }

    @Test
    void reusesInboundRequestIdHeaderVerbatim() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/public/leads");
        request.addHeader("X-Request-Id", "inbound-request-id");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, capturingChain(null));

        assertThat(response.getHeader("X-Request-Id")).isEqualTo("inbound-request-id");
    }

    @Test
    void generatesFreshUuidWhenRequestIdHeaderAbsent() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/public/leads");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, capturingChain(null));

        String generated = response.getHeader("X-Request-Id");
        assertThat(generated).isNotBlank();
        assertThat(UUID.fromString(generated)).isNotNull();
    }

    @Test
    void echoesSameRequestIdOnResponseAsWasStampedIntoMdcDuringTheChain() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/public/leads");
        request.addHeader("X-Request-Id", "abc-123");
        MockHttpServletResponse response = new MockHttpServletResponse();
        Map<String, String>[] mdcDuringChain = new Map[1];

        filter.doFilter(request, response, capturingChain(mdcDuringChain));

        assertThat(mdcDuringChain[0].get("requestId")).isEqualTo("abc-123");
        assertThat(response.getHeader("X-Request-Id")).isEqualTo("abc-123");
    }

    @Test
    void stampsUsernameWhenAuthenticatedJwtPresent() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(jwtAuthentication("jake"));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/public/leads");
        MockHttpServletResponse response = new MockHttpServletResponse();
        Map<String, String>[] mdcDuringChain = new Map[1];

        filter.doFilter(request, response, capturingChain(mdcDuringChain));

        assertThat(mdcDuringChain[0].get("username")).isEqualTo("jake");
    }

    @Test
    void doesNotStampUsernameWhenNoAuthenticationPresent() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/public/leads");
        MockHttpServletResponse response = new MockHttpServletResponse();
        Map<String, String>[] mdcDuringChain = new Map[1];

        filter.doFilter(request, response, capturingChain(mdcDuringChain));

        assertThat(mdcDuringChain[0]).doesNotContainKey("username");
    }

    @Test
    void doesNotStampUsernameWhenAuthenticationIsNotAuthenticated() throws Exception {
        TestingAuthenticationToken unauthenticated =
                new TestingAuthenticationToken("someone", null, List.of());
        unauthenticated.setAuthenticated(false);
        SecurityContextHolder.getContext().setAuthentication(unauthenticated);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/public/leads");
        MockHttpServletResponse response = new MockHttpServletResponse();
        Map<String, String>[] mdcDuringChain = new Map[1];

        filter.doFilter(request, response, capturingChain(mdcDuringChain));

        assertThat(mdcDuringChain[0]).doesNotContainKey("username");
    }

    @Test
    void doesNotStampUsernameWhenAuthenticationPrincipalIsNotAJwt() throws Exception {
        TestingAuthenticationToken nonJwtAuth =
                new TestingAuthenticationToken("someone", null,
                        List.of(new SimpleGrantedAuthority("ROLE_platform_admin")));
        SecurityContextHolder.getContext().setAuthentication(nonJwtAuth);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/public/leads");
        MockHttpServletResponse response = new MockHttpServletResponse();
        Map<String, String>[] mdcDuringChain = new Map[1];

        filter.doFilter(request, response, capturingChain(mdcDuringChain));

        assertThat(mdcDuringChain[0]).doesNotContainKey("username");
    }

    @Test
    void extractsClubIdFromClubDetailRoute() throws Exception {
        assertClubIdExtracted("/api/v1/platform/clubs/" + CLUB_ID, CLUB_ID);
    }

    @Test
    void extractsClubIdFromClubProfileRoute() throws Exception {
        assertClubIdExtracted("/api/v1/platform/clubs/" + CLUB_ID + "/profile", CLUB_ID);
    }

    @Test
    void doesNotStampClubIdForSubscriptionsRoute() throws Exception {
        MockHttpServletRequest request =
                new MockHttpServletRequest("GET", "/api/v1/platform/subscriptions/" + SUBSCRIPTION_ID);
        MockHttpServletResponse response = new MockHttpServletResponse();
        Map<String, String>[] mdcDuringChain = new Map[1];

        filter.doFilter(request, response, capturingChain(mdcDuringChain));

        assertThat(mdcDuringChain[0]).doesNotContainKey("clubId");
    }

    @Test
    void doesNotStampClubIdForPathWithoutClubsSegment() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/public/leads");
        MockHttpServletResponse response = new MockHttpServletResponse();
        Map<String, String>[] mdcDuringChain = new Map[1];

        filter.doFilter(request, response, capturingChain(mdcDuringChain));

        assertThat(mdcDuringChain[0]).doesNotContainKey("clubId");
    }

    @Test
    void mdcIsEmptyAfterFilterReturnsOnTheHappyPath() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/public/leads");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, capturingChain(null));

        assertThat(MDC.getCopyOfContextMap()).isNullOrEmpty();
    }

    @Test
    void mdcIsEmptyAfterFilterReturnsEvenWhenTheDownstreamChainThrows() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/public/leads");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain throwingChain = (req, res) -> {
            throw new RuntimeException("downstream failure");
        };

        assertThatThrownBy(() -> filter.doFilter(request, response, throwingChain))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("downstream failure");

        assertThat(MDC.getCopyOfContextMap()).isNullOrEmpty();
    }

    private void assertClubIdExtracted(String path, String expectedClubId) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        MockHttpServletResponse response = new MockHttpServletResponse();
        Map<String, String>[] mdcDuringChain = new Map[1];

        filter.doFilter(request, response, capturingChain(mdcDuringChain));

        assertThat(mdcDuringChain[0].get("clubId")).isEqualTo(expectedClubId);
    }

    @SuppressWarnings("unchecked")
    private FilterChain capturingChain(Map<String, String>[] mdcDuringChainHolder) {
        return (req, res) -> {
            if (mdcDuringChainHolder != null) {
                Map<String, String> copy = MDC.getCopyOfContextMap();
                mdcDuringChainHolder[0] = copy == null ? Map.of() : copy;
            }
        };
    }

    private JwtAuthenticationToken jwtAuthentication(String subject) {
        Jwt jwt = Jwt.withTokenValue("token-value")
                .header("alg", "none")
                .claim("sub", subject)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();
        return new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_platform_admin")));
    }
}
