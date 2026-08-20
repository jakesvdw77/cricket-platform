package com.cricketlegend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Stamps every request's log lines with a correlation id (and, where available, the
 * authenticated username and a path-derived club id) via SLF4J's MDC — 013-centralized-logging.md.
 *
 * <p><b>Deliberately NOT a {@code @Component}.</b> {@link OncePerRequestFilter} implements {@code
 * jakarta.servlet.Filter}; if this were also a Spring bean, Spring Boot's filter
 * auto-registration would register it a *second* time as a generic servlet-container filter, in
 * addition to the manual {@code http.addFilterAfter(...)} wiring in {@link SecurityConfig}'s
 * {@code filterChain()} — running it twice per request (two different {@code requestId} values,
 * a double-written response header). This class has zero constructor dependencies, so
 * {@link SecurityConfig} constructs it directly with {@code new RequestCorrelationFilter()}.
 */
public class RequestCorrelationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestCorrelationFilter.class);

    private static final String REQUEST_ID_HEADER = "X-Request-Id";
    private static final String MDC_REQUEST_ID = "requestId";
    private static final String MDC_USERNAME = "username";
    private static final String MDC_CLUB_ID = "clubId";

    // Matches the literal "clubs" path segment only — never a bare {id}, which would
    // misidentify e.g. /platform/subscriptions/{id}'s id as a club id. Deliberately a URI
    // regex, not @PathVariable: this filter runs ahead of Spring MVC's handler mapping, before
    // path variables are resolved, so a controller-level annotation isn't reachable here.
    private static final Pattern CLUB_ID_IN_PATH =
            Pattern.compile("/clubs/([0-9a-fA-F]{8}-[0-9a-fA-F-]{27})(?:/|$)");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                     FilterChain chain) throws ServletException, IOException {
        String requestId = StringUtils.hasText(request.getHeader(REQUEST_ID_HEADER))
                ? request.getHeader(REQUEST_ID_HEADER)
                : UUID.randomUUID().toString();
        response.setHeader(REQUEST_ID_HEADER, requestId);
        MDC.put(MDC_REQUEST_ID, requestId);
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof Jwt) {
                MDC.put(MDC_USERNAME, auth.getName());   // JwtAuthenticationToken.getName() = JWT "sub" claim
            }
            Matcher clubIdMatch = CLUB_ID_IN_PATH.matcher(request.getRequestURI());
            if (clubIdMatch.find()) {
                MDC.put(MDC_CLUB_ID, clubIdMatch.group(1));
            }
            // One line per request, with MDC fully populated — the concrete demonstration that
            // every log line for a request shares requestId/username/clubId, not just an
            // assertion about MDC state. Controller/service/repository log lines (once any exist)
            // inherit the same MDC context for free.
            log.info("{} {}", request.getMethod(), request.getRequestURI());
            chain.doFilter(request, response);
        } finally {
            MDC.clear();   // never leak MDC state across pooled server threads
        }
    }
}
