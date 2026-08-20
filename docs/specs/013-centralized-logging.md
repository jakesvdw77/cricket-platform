# 013 — Centralized Logging

**Depends on:** `docs/standards/backend.md` (this spec amends its Non-negotiables list — see Configuration & Infrastructure Changes and Rollout Notes), `002-realm-subdomain-auth.md` (the `TenantResolutionFilter`/JWT precedent this spec's MDC filter builds on, and the reason `club_id` is deferred — see Non-goals), `012-club-profile.md` (the `${ENV_VAR:default}` config-property convention and Rollout Notes "roadmap follow-up, not actioned here" pattern this spec follows).
**Status:** draft.

## Problem & Goals

The backend has zero structured logging setup today. No `logback-spring.xml` exists; SLF4J+Logback arrives transitively via `spring-boot-starter-web` and is entirely unconfigured beyond one line — `logging.level.com.cricketlegend=DEBUG` in `application-dev.properties`. There's no way to correlate the log lines produced by a single HTTP request, and nothing ships logs anywhere beyond whatever console is tailing `mvn spring-boot:run` — no way to search or browse logs centrally once this runs anywhere but a developer's own terminal. This spec closes both gaps: real Logback configuration with per-request correlation, and a lightweight way to browse those logs centrally without standing up a heavyweight log-search cluster.

**Goals**
- Every backend log line renders human-readably in the local console (unchanged developer experience) and additionally ships to a centralized Loki instance, queryable in Grafana.
- Every log line emitted while handling one HTTP request carries the same request-id via MDC, and — when the request is authenticated — the same username, so a request's full log trail is one query away instead of a manual timestamp-correlation exercise.
- Where a request's URL already names the club it concerns (`/api/v1/platform/clubs/{id}/...` — today's `ClubController`/`ClubProfileController`), that club's id is stamped into MDC too, at zero extra cost (the id is already in the path, no lookup needed) — a narrower, honest stand-in for real subdomain-based tenant resolution, not a claim of full multi-tenant log correlation (see Non-goals).
- Log level is adjustable in a running deployment via environment variable alone, no code change and no redeploy — this is Spring Boot's own existing `LOGGING_LEVEL_<PACKAGE>` convention already available today; this spec's job is to confirm it, document it as the actual answer to "easy to set up when deployed," and not invent a second, redundant mechanism.
- Writing directly to `System.out`/`System.err` becomes an enforced, CI-checked violation via ArchUnit, not just an unwritten convention — even though a grep of `backend/src/main/java` today finds zero such calls, so this is pure prevention, not a cleanup task.
- A first, minimal, `docker-compose.logging.yml` stands up Loki + Grafana locally for any developer, with Grafana already pointed at Loki on boot.

## Non-goals

- **Log4j2.** Considered and rejected. Logback is already the Spring Boot default, needs no dependency swap, and nothing about this project's needs (structured request correlation, a Loki sink) requires Log4j2's feature set over Logback's. This spec's job is writing the `logback-spring.xml` that has never existed, not replacing the logging framework.
- **Graylog.** Considered and rejected in favor of Loki + Grafana. Graylog needs three containers (Graylog + MongoDB + OpenSearch), with OpenSearch alone typically wanting 1-2GB+ of heap — heavy for a project this size to self-host. Grafana is wanted anyway for a future metrics/dashboards story; once that's a given, Loki is the natural logs pairing (renders inside the same Grafana UI, no second dashboard tool to run or learn) and is far lighter to self-host — it indexes labels, not full log text, so no big search-index cluster is required.
- **Subdomain-based `club_id` resolution.** `002-realm-subdomain-auth.md`'s `TenantResolutionFilter` — the component that would resolve "which club does this request belong to" from the `Host` header, the way `001`'s White-Labelling model describes — does not exist in code yet (confirmed by grep: only a comment in `ClubServiceImpl` references it as not-yet-built, alongside `SecurityConfig`'s own comment that `002`'s full `RoleAssignment`/`Person` resolution isn't implemented either, still a flat `platform_admin` role check). This spec does NOT build that. What it does build instead — a narrower, path-derived `club_id` for the subset of endpoints that already name a club in their URL — is scoped separately below, in Configuration & Infrastructure Changes and the Goals above; don't conflate the two. Many endpoints (`/platform/products`, `/platform/subscriptions` list views) also aren't club-scoped at all, so "the club for this request" isn't even a well-defined concept everywhere yet — subdomain resolution is what would eventually make it one. See Rollout Notes for the upgrade path once `002` ships.
- **Prometheus (metrics) and Tempo (tracing)** — the "M" and "T" of the LGTM stack. Not this pass. The Loki + Grafana choice deliberately leaves this door open cheaply later (same Grafana instance, same docker-compose file could grow two more services), but nothing beyond that observation is designed here — no metrics endpoint, no tracing instrumentation, no plan for either.
- **Production deployment.** `docker-compose.logging.yml` stands up Loki + Grafana for local development only. It does not attempt production deployment — that needs a backend Dockerfile that doesn't exist yet, a frontend-serving story, TLS for the per-club-subdomain model (`001`/`002`), Keycloak running with real secrets, and Postgres persistence/backup, none of which this spec touches. The compose file is written so its two service definitions (pinned image tags, env-var-parameterized where sensible, no throwaway dev-only hacks) are cleanly liftable into a future deployment compose later — not solving deployment now, but not writing something that has to be thrown away either.
- **Folding Postgres/Keycloak into a docker-compose file.** Both currently run as standalone containers managed by hand outside this repo — there is no existing compose file to extend, so `docker-compose.logging.yml` is genuinely the first one in this repo. Bringing Postgres/Keycloak under compose too is a bigger, separate local dev-experience change, considered and deliberately deferred rather than folded in here.
- **Any frontend change.** This spec is entirely backend + local infrastructure tooling. No UI surface, no new endpoint the frontend calls, nothing in `ui/`.

## User Stories

- As a developer running the backend locally (`mvn spring-boot:run`), I can read human-readable log output in my console exactly as before, with no Loki/Grafana setup required — the Loki appender is additive, not a replacement for console logging.
- As a developer or operator with Loki + Grafana running locally (`docker compose -f docker-compose.logging.yml up`), I can open Grafana and see every log line from a single HTTP request by filtering on its request-id, without grepping log files or correlating timestamps by hand.
- As a developer investigating an authenticated user's report, I can filter logs by username in Grafana, once that user's requests were authenticated.
- As a developer debugging one club's Club/Club Profile admin activity, I can filter logs by that club's id in Grafana, without it being confused with any other resource's id in the URL.
- As an operator deploying to a new environment, I can raise or lower `com.cricketlegend`'s (or any package's) log level by setting an environment variable, with no code change and no redeploy.
- As a developer (or an agent) who tries to add a `System.out.println`/`System.err.println` call anywhere in `backend/src/main/java`, my build fails at a named ArchUnit rule, not silently at review time.
- As a developer standing up this repo's logging stack for the first time, I get a Grafana instance already pointed at the local Loki datasource on first boot, without a manual "add data source" step in the UI.

## Configuration & Infrastructure Changes

### 1. New Maven dependency

`backend/pom.xml` gains one new dependency, alongside the existing logging-adjacent entries:

```xml
<!-- Ships logs to Grafana Loki — 013-centralized-logging.md -->
<dependency>
    <groupId>com.github.loki4j</groupId>
    <artifactId>loki-logback-appender</artifactId>
    <version>1.5.2</version> <!-- confirm at implementation time against the Logback version
                                    spring-boot-starter-parent 3.4.3 resolves -->
</dependency>
```

`loki4j` (`com.github.loki4j:loki-logback-appender`) is an actively maintained community Logback appender that pushes batches to Loki's HTTP push API (`/loki/api/v1/push`) — no Spring Boot starter exists for this, so it's added directly, same pattern as `springdoc-openapi-starter-webmvc-ui`'s explicit version pin above it in `pom.xml`.

### 2. `logback-spring.xml`

New file, `backend/src/main/resources/logback-spring.xml` — doesn't exist today. Two appenders: the existing implicit console behaviour, made explicit, plus the new Loki sink. Both render the same pattern, including the two new MDC keys from the filter below:

```xml
<configuration>

    <springProperty name="lokiUrl" source="app.logging.loki-url" defaultValue="http://localhost:3100"/>
    <springProperty name="activeProfile" source="spring.profiles.active" defaultValue="default"/>

    <property name="LOG_PATTERN"
        value="%d{ISO8601} %-5level [reqId=%X{requestId:-none}] [user=%X{username:-anonymous}] [club=%X{clubId:-none}] %logger{36} - %msg%n"/>

    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>${LOG_PATTERN}</pattern>
        </encoder>
    </appender>

    <appender name="LOKI" class="com.github.loki4j.logback.Loki4jAppender">
        <http>
            <url>${lokiUrl}/loki/api/v1/push</url>
        </http>
        <format>
            <!-- Loki indexes labels — keep these low-cardinality (app/environment/level/logger).
                 requestId, username, and clubId all go in the rendered message line instead,
                 queried via LogQL line filters, never as labels — high-cardinality labels are a
                 known Loki anti-pattern that degrades query performance badly at scale. -->
            <label>
                <pattern>app=cricketlegend,environment=${activeProfile},level=%level,logger=%logger{20}</pattern>
            </label>
            <message>
                <pattern>${LOG_PATTERN}</pattern>
            </message>
        </format>
    </appender>

    <root level="INFO">
        <appender-ref ref="CONSOLE"/>
        <appender-ref ref="LOKI"/>
    </root>

</configuration>
```

No `<logger>` elements are hardcoded for `com.cricketlegend` here — Spring Boot applies `logging.level.*` properties (and their `LOGGING_LEVEL_*` environment-variable overrides) to whatever `logback-spring.xml` defines, exactly as it did before this spec, as long as the file keeps the `-spring` suffix. `application-dev.properties`'s existing `logging.level.com.cricketlegend=DEBUG` is unchanged; default/prod profile gets `com.cricketlegend` at Spring Boot's own default `INFO` with no per-package tuning invented beyond that — bumping any package's level in a running deployment is exactly the existing `LOGGING_LEVEL_COM_CRICKETLEGEND=DEBUG`-style env var, requiring no code change and no redeploy. That existing, already-available mechanism is the actual answer to "easy to set up when we deploy" — this spec confirms and documents it rather than building something new.

### 3. Request correlation filter (MDC)

New file, `backend/src/main/java/com/cricketlegend/config/RequestCorrelationFilter.java` — a standard `OncePerRequestFilter`, alongside `SecurityConfig`/`WebConfig` in the same package:

```java
@Component
public class RequestCorrelationFilter extends OncePerRequestFilter {

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
            chain.doFilter(request, response);
        } finally {
            MDC.clear();   // never leak MDC state across pooled server threads
        }
    }
}
```

Reuses the exact JWT precedent `002-realm-subdomain-auth.md` and the already-implemented `SecurityConfig` establish: a `JwtAuthenticationToken`'s `Authentication.getName()` already returns the JWT's `sub` claim with no `SecurityConfig` change needed — `SecurityConfig`'s `jwtAuthenticationConverter()` only customizes granted authorities, not the principal name. This is the interim, flat-role identity `002` and `SecurityConfig` currently use, not `002`'s fuller `Person`/`RoleAssignment` resolution (still not built — see Non-goals).

**`clubId` is deliberately the same MDC key a future, real tenant-resolution mechanism would populate.** Today it's filled in by this regex — a "the id is already sitting in the URL, no lookup needed" shortcut that only fires for `ClubController`/`ClubProfileController`'s own `/clubs/{id}/...` routes. Once `002-realm-subdomain-auth.md`'s `TenantResolutionFilter` exists, it becomes the authoritative source for the same key — Loki labels, Grafana dashboards, and every LogQL query written against `clubId` in the meantime keep working unchanged, because nothing downstream cares which mechanism populated it. This filter should be revisited (not necessarily rewritten) once that lands — see Rollout Notes.

**Filter ordering matters and is the one real wrinkle.** `Authentication` is only populated once Spring Security's own resource-server filter has run, so `RequestCorrelationFilter` must execute *after* that point in the chain to see it — registering it as a plain servlet filter ahead of Spring Security (the default ordering) would mean the username is never available. It's registered inside `SecurityConfig`'s existing `filterChain(HttpSecurity http)` bean instead, via `http.addFilterAfter(requestCorrelationFilter, BearerTokenAuthenticationFilter.class)`, so it wraps the controller invocation with `Authentication` already resolved, MDC set for every downstream log line, and cleared in the `finally` block regardless of outcome (including exceptions handled by `GlobalExceptionHandler`).

For an unauthenticated request (`/api/v1/public/**`, `/media/**`), `requestId` is still stamped; `username` is simply absent from that request's log lines, not stamped as a literal `"anonymous"` string in MDC — the log pattern's `%X{username:-anonymous}` fallback renders that at output time instead. `clubId` behaves the same way: absent (rendering as `none`) for any request whose path doesn't match `/clubs/{id}`, which today is most of the API — this is expected, not a bug, given the narrow scope described above.

### 4. New config property

Following `012-club-profile.md`'s `app.media.storage-path=${MEDIA_STORAGE_PATH:./data/media}` precedent (itself following `KEYCLOAK_ISSUER_URI` in `application.properties`) — a new `app.*`-namespaced property, `${ENV_VAR:default}`-shaped, added to `backend/src/main/resources/application.properties`:

```properties
# Grafana Loki push endpoint — 013-centralized-logging.md. Local dev default assumes
# docker-compose.logging.yml's loki service is running on its default port.
app.logging.loki-url=${LOKI_URL:http://localhost:3100}
```

Read into `logback-spring.xml` via `<springProperty source="app.logging.loki-url" .../>` (see above) rather than a Java `@Value` — there's no service class that needs this value at runtime, only the logging configuration itself.

### 5. `docker-compose.logging.yml`

New file at the repo root, `docker-compose.logging.yml` — the first docker-compose file in this repo. Scope is deliberately just the two services (see Non-goals for why Postgres/Keycloak and production deployment are excluded):

```yaml
services:
  loki:
    image: grafana/loki:3.2.1
    container_name: cricketlegend-loki
    ports:
      - "${LOKI_PORT:-3100}:3100"
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - loki-data:/loki
    restart: unless-stopped

  grafana:
    image: grafana/grafana:11.3.1
    container_name: cricketlegend-grafana
    ports:
      - "${GRAFANA_PORT:-3000}:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=${GRAFANA_ADMIN_USER:-admin}
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-admin}
      - GF_AUTH_ANONYMOUS_ENABLED=false
    volumes:
      - grafana-data:/var/lib/grafana
      - ./ops/grafana/provisioning:/etc/grafana/provisioning:ro
    depends_on:
      - loki
    restart: unless-stopped

volumes:
  loki-data:
  grafana-data:
```

Plus one small provisioning file, `ops/grafana/provisioning/datasources/loki.yml`, so Grafana already has Loki wired up as a datasource on first boot rather than requiring a manual "Add data source" click-through:

```yaml
apiVersion: 1
datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: true
```

Both image tags are pinned (no `:latest`), both ports and Grafana's admin credentials are env-var-overridable with sensible local defaults, and neither service does anything dev-only-hacky (no bind-mounted source code, no debug flags) — so lifting these two service blocks into a future production/deployment compose file later is a copy, not a rewrite. That future file is explicitly not written by this spec (see Non-goals).

### 6. ArchUnit rule — no `System.out`/`System.err`

`backend/src/test/java/com/cricketlegend/architecture/LayeringRulesTest.java` (the existing ArchUnit suite enforcing `docs/standards/backend.md`) gains one more rule, referencing ArchUnit's own built-in rule rather than hand-written logic:

```java
import static com.tngtech.archunit.library.GeneralCodingRules.NO_CLASSES_SHOULD_ACCESS_STANDARD_STREAMS;

@Test
void noClassesAccessStandardStreams() {
    NO_CLASSES_SHOULD_ACCESS_STANDARD_STREAMS.check(CLASSES);
}
```

A grep of `backend/src/main/java` today finds zero `System.out`/`System.err` calls, so this rule passes immediately on merge — it is pure prevention from day one, not a cleanup task riding along with this spec.

This also requires a `docs/standards/backend.md` edit as part of implementation, not just a test-suite change: its "Non-negotiables" list gains a new line, e.g. "No `System.out`/`System.err` — use the injected SLF4J `Logger`; enforced by ArchUnit's `NO_CLASSES_SHOULD_ACCESS_STANDARD_STREAMS`," alongside the existing DTO-boundary and `ddl-auto=validate` entries. A plan built from this spec should flag that doc edit explicitly, the same way a data-model change would flag a migration file.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `RequestCorrelationFilterTest` — inbound `X-Request-Id` header is reused verbatim when present, a fresh UUID is generated when absent, the response echoes the same header back, `username` is stamped only when `Authentication` is present/authenticated, `clubId` is extracted correctly from `/api/v1/platform/clubs/{uuid}` and `/api/v1/platform/clubs/{uuid}/profile`, `clubId` is NOT stamped for `/api/v1/platform/subscriptions/{uuid}` (the false-positive case the regex is specifically written to avoid) or any path without a `clubs` segment, and MDC is empty (via `MDC.getCopyOfContextMap()`) after the filter returns even when the downstream chain throws |
| Integration | A `@SpringBootTest` slice asserting the full filter chain ordering resolves as intended — an authenticated request (mock JWT, `spring-security-test`) against a `/clubs/{id}` route produces a log line (captured via a Logback `ListAppender` attached in the test) containing `requestId`, `username`, and `clubId` together; an unauthenticated request against `/api/v1/public/**` produces a log line with `requestId` only |
| Architecture | `LayeringRulesTest.noClassesAccessStandardStreams()` (new) passes against the current, already-clean codebase — proving the rule is wired correctly, not proving a violation was fixed, since none exist |
| Manual/local | `docker compose -f docker-compose.logging.yml up`, run the backend against it, confirm log lines appear in Grafana's Explore view filtered by the `app="cricketlegend"` label, and that a request's `requestId` value (read from a real response header) finds every log line for that request via a LogQL line filter |

No component/E2E tiers apply — this spec has no frontend or UI surface (`docs/standards/testing.md`'s Component/E2E tiers are both frontend-facing).

## Acceptance Criteria

- Running `mvn spring-boot:run -Dspring-boot.run.profiles=dev` locally produces the same readable console log output developers see today, unchanged in the absence of Loki/Grafana.
- With `docker-compose.logging.yml` running, every backend log line also appears in Grafana's Explore view within a few seconds, queryable by the `app="cricketlegend"` label with no manual Grafana datasource setup step.
- Every log line produced while handling a single HTTP request — across controller, service, and repository layers — carries the same `requestId` value, verifiable by reading them back from Grafana or the console for one real request.
- An authenticated request's log lines additionally carry the authenticated user's username (JWT `sub`); an unauthenticated request's log lines do not error or crash, they simply have no username value.
- A request against `/api/v1/platform/clubs/{id}` or `/api/v1/platform/clubs/{id}/profile` carries that club's id as `clubId`; a request against `/api/v1/platform/subscriptions/{id}` (or any other non-club resource) does not have its id misattributed as `clubId`.
- `MDC` never leaks a stale `requestId`/`username` from one request into another on a reused pooled thread — verified by the unit test asserting `MDC` is empty after the filter completes.
- Setting `LOGGING_LEVEL_COM_CRICKETLEGEND=DEBUG` (or any other `LOGGING_LEVEL_<PACKAGE>` variable) as an environment variable against a running, already-built artifact changes that package's log level with no code change and no rebuild.
- Adding a `System.out.println` or `System.err.println` anywhere under `backend/src/main/java` fails the build at `LayeringRulesTest`, with ArchUnit's own rule name in the failure output.
- `docker-compose.logging.yml` starts cleanly from a clean checkout with `docker compose -f docker-compose.logging.yml up`, no manual pre-steps beyond having Docker running.

## Rollout Notes

- Ships as its own PR — no dependency on any in-flight feature spec's work, and touches no domain code, only `backend/pom.xml`, new config/filter classes, `logback-spring.xml`, `application.properties`, the ArchUnit suite, `docs/standards/backend.md`, and the new root-level compose file.
- **`docs/standards/backend.md` needs a real edit as part of implementation** (see Configuration & Infrastructure Changes, item 6) — a new Non-negotiables line for the `System.out`/`System.err` ban. This is a standards-doc change riding alongside the spec, the same way `012` flagged its `app.media.storage-path` property as a new config convention worth naming explicitly rather than adding silently.
- **Not solving deployment now, but not writing something that has to be thrown away either.** `docker-compose.logging.yml`'s two service definitions are deliberately shaped (pinned tags, env-var overrides, no dev-only hacks) to be liftable into a future production/deployment compose file — that file itself, along with the backend Dockerfile, frontend-serving story, and TLS-for-subdomains work it would need, stays unscoped and unbuilt here (see Non-goals).
- **This spec's `clubId` is a path-derived stand-in, not the finished mechanism — needs a roadmap follow-up.** It only fires for the `/clubs/{id}` routes that exist today, and is blocked from becoming real subdomain-based tenant resolution purely by `002-realm-subdomain-auth.md`'s `TenantResolutionFilter` not existing in code yet. A human should add an entry to `docs/roadmap.md` once `002`'s tenant resolution actually ships, noting that `RequestCorrelationFilter` should be revisited to populate the same `clubId` MDC key from real subdomain resolution instead of (or in addition to) the path regex — the key itself, and everything built on it downstream (Loki queries, Grafana dashboards), stays unchanged; only the Java-side source of the value changes. Not actioned by this spec itself, same pattern `012-club-profile.md`'s Rollout Notes used for its own roadmap follow-up (the org-type field note under `003`).
- **Prometheus/Tempo remain a cheap door left open, not a plan.** The Loki + Grafana choice means a future metrics or tracing spec could add to the same Grafana instance and, plausibly, the same compose file — nothing here commits to that shape being right when the time comes, it's just not actively foreclosed.
