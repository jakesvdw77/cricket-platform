# Implementation Plan — 017: Subscription Welcome Email

## Context

Spec `016` (Keycloak account provisioning) is merged to `master`. This spec is the next amendment to the same `SubscriptionServiceImpl.create()` method `016` already amended: after the Subscription is saved, its `RoleAssignment` grant is created, and Keycloak provisioning is attempted, this spec adds a third best-effort step — a themed HTML welcome email to the responsible `Person`, naming the club, product, and subscription dates. It also stands up this application's first-ever outbound SMTP/templating mechanism (`EmailService`, a Thymeleaf base layout), a reusable primitive two other roadmap items already name as future consumers (the self-serve signup OTP flow, spec `003`'s still-unbuilt `Invitation` admin-invite email).

`docs/specs/017-subscription-welcome-email.md` is the authoritative spec, with real code sketches already resolved through 7 named "Real Architectural Judgment Calls" (keeping this separate from Keycloak's own invite email, an unconditional per-`create()` trigger, best-effort failure posture, standalone Thymeleaf rendering, a shared local Mailpit/Mailhog sink, a fixed support address, and reusing `016`'s `app.frontend.base-url`) — none of these are re-litigated here.

This plan was produced after directly reading the actual current (post-`016`-merge) `SubscriptionServiceImpl.java`, `SubscriptionServiceImplTest.java`, `SubscriptionControllerIntegrationTest.java`, `backend/pom.xml`, `application.properties`, the exception package, and `docs/deployment.md`/`docs/roadmap.md`'s named sections — no drift found between the spec's own assumptions and reality anywhere, independently confirmed a second time (constructor shape, insertion line numbers, doc section locations). One genuine gap the spec itself is silent on (test package placement) is resolved explicitly below rather than left ambiguous — see Flags for your review.

**Confirmed current state of the insertion point** (`backend/src/main/java/com/cricketlegend/service/impl/SubscriptionServiceImpl.java`):
- `create()` runs lines 100–129. The insertion point for the new best-effort step is between the existing line 126 (`provisionKeycloakAccountIfNeeded(responsiblePerson, subscription);`) and line 128 (`return toDto(subscription, club, product, responsiblePerson);`) — a new line 127: `sendWelcomeEmailBestEffort(responsiblePerson, subscription, club, product);`. Both `club` and `product` are already in scope (resolved at lines 106–107) — no new lookup needed.
- The constructor (lines 75–98) currently takes **11** parameters, ending in `KeycloakProvisioningService keycloakProvisioningService`. This spec adds a 12th: `SubscriptionWelcomeEmailService subscriptionWelcomeEmailService`, appended after it — the same "append one new dependency" shape `016` itself used.
- `SubscriptionServiceImplTest.java`'s single `@BeforeEach` constructs `subscriptionService` via one 11-arg constructor call — confirmed the only call site anywhere in `backend/src/test/java`. Adding one `@Mock SubscriptionWelcomeEmailService` field + one constructor argument fixes compilation for all existing tests at once, the same low-risk shape `016`'s own plan established for this file.
- `SubscriptionControllerIntegrationTest.java` already `@MockitoBean`'s `KeycloakProvisioningService`, with an explanatory Javadoc block precisely describing why — this spec's own `@MockitoBean SubscriptionWelcomeEmailService` should be added alongside it with an equivalent one-line Javadoc addition, not a new pattern.
- `backend/pom.xml` confirmed: `spring-boot-starter-parent 3.4.3` is the sole parent; no existing `spring-boot-starter-mail`/`spring-boot-starter-thymeleaf` dependency exists yet. Both are genuinely unpinned, dependency-managed Spring Boot starters here — no placeholder-version correction needed this time, unlike `016`'s `keycloak-admin-client` pin.
- No template resources directory (`backend/src/main/resources/templates/`) exists yet. `012-add-person-keycloak-provisioned-at.sql` is confirmed still the current highest-numbered migration; this spec needs none of its own.
- Confirmed by grep: every controller in this codebase is `@RestController`, none is a bare `@Controller` — so `spring-boot-starter-thymeleaf`'s auto-configured `ViewResolver` bean has nothing to attach to and is confirmed harmless.

## Phase 0 — Manual infrastructure prerequisite (human, not `backend-builder`)

Not blocking for the code to compile or for unit/integration tests to pass (those either mock the send entirely or don't invoke it) — blocking only for a real local end-to-end smoke test.

1. Stand up a local Mailpit/Mailhog SMTP sink: `docker run -p 1025:1025 -p 8025:8025 axllent/mailpit`. Not committed as a docker-compose service by this spec (per its own Rollout Notes) — a one-off command, the same local sink `016`'s own Phase 0 already named as an unmet need for Keycloak's realm-level invite email. One sink now serves both.

## Phase 1 — Backend: Maven dependencies and config properties (`backend-builder`)

Before Phase 2 — the new template files and service classes below depend on these being present.

2. `backend/pom.xml` — add the two dependencies exactly as spec'd:
   ```xml
   <dependency>
       <groupId>org.springframework.boot</groupId>
       <artifactId>spring-boot-starter-mail</artifactId>
   </dependency>
   <dependency>
       <groupId>org.springframework.boot</groupId>
       <artifactId>spring-boot-starter-thymeleaf</artifactId>
   </dependency>
   ```
   No version pin — both are managed by `spring-boot-starter-parent 3.4.3` already declared in this file, confirmed above.
3. `backend/src/main/resources/application.properties` — append the spec's new properties block verbatim (`spring.mail.host`/`port`/`username`/`password`/`properties.mail.smtp.auth`/`properties.mail.smtp.starttls.enable`, and `app.mail.from-address`/`from-name`/`support-address`), same `${ENV_VAR:default}` convention already used by the `016` block immediately above it. `app.frontend.base-url` (already present from `016`) is reused unmodified — no edit needed to that line.

## Phase 2 — Backend: email templates (`backend-builder`)

Sequenced first (before the Java classes that render them) because `subscription-welcome.html` composes on top of `base-layout.html`.

4. `backend/src/main/resources/templates/email/base-layout.html` (new) — the shared shell, exactly the spec's checked-in HTML (table-based layout, inline styles, header/content/footer using `ui/src/theme.ts`'s `primary.main`/`text.primary`/`text.secondary`/`divider` tokens verbatim, plus the one flagged non-token addition, `#f4f6f5`, for the outer page background — already independently verified and explained in the spec itself, not re-litigated here).
5. `backend/src/main/resources/templates/email/subscription-welcome.html` (new) — the welcome email's content fragment, exactly the spec's checked-in HTML, composed into the base layout via `th:replace="~{email/base-layout :: layout(~{::content})}"`.

## Phase 3 — Backend: exception (`backend-builder`)

6. `backend/src/main/java/com/cricketlegend/exception/EmailDeliveryException.java` (new) — extends `RuntimeException` directly, exactly as spec'd. Lives alongside `KeycloakProvisioningException.java` in the same package, same reasoning: an external-system integration failure, not a business-rule violation, deliberately outside `NotFoundException`/`ConflictException`/`ValidationException`'s hierarchy. **Same hard-requirement shape `016`'s own plan flagged for `KeycloakProvisioningException`:** `GlobalExceptionHandler` has no handler for this exception either — it is safe only because `sendWelcomeEmailBestEffort`'s own catch block (Phase 6) always catches it before it can propagate.

## Phase 4 — Backend: generic send primitive (`backend-builder`)

Depends on Phase 3 (`EmailDeliveryException` must exist first).

7. `backend/src/main/java/com/cricketlegend/service/EmailService.java` (new interface) — `void send(String toAddress, String toName, String subject, String htmlBody)`, exactly the spec's sketch.
8. `backend/src/main/java/com/cricketlegend/service/impl/EmailServiceImpl.java` (new) — constructor-injected `JavaMailSender` plus `@Value("${app.mail.from-address}")`/`@Value("${app.mail.from-name}")`, builds a `MimeMessageHelper`-backed HTML message, wraps any failure in `EmailDeliveryException`. Constructor injection only (`docs/standards/backend.md`, ArchUnit-enforced) — no field injection.

## Phase 5 — Backend: welcome-email-specific service (`backend-builder`)

Depends on Phase 2 (templates), Phase 3 (exception), and Phase 4 (`EmailService`).

9. `backend/src/main/java/com/cricketlegend/service/SubscriptionWelcomeEmailService.java` (new interface) — `void sendWelcomeEmail(Person responsiblePerson, Subscription subscription, Club club, Product product)`, exactly the spec's sketch.
10. `backend/src/main/java/com/cricketlegend/service/impl/SubscriptionWelcomeEmailServiceImpl.java` (new) — constructor-injected `EmailService`, `SpringTemplateEngine` (auto-configured by `spring-boot-starter-thymeleaf`, no extra bean needed), `@Value("${app.frontend.base-url}")`, `@Value("${app.mail.support-address}")`. Builds the Thymeleaf `Context` (`firstName`/`clubName`/`productName`/formatted `startDate`/`endDate`-or-"Ongoing" fallback/`loginUrl`/`supportAddress`), renders `email/subscription-welcome` to a `String`, builds the subject line, calls `EmailService.send(...)`. `buildClubLoginUrl` reuses `app.frontend.base-url`'s scheme/authority exactly as spec'd (judgment call #7) — no new "root domain" property.

## Phase 6 — Backend: amend `SubscriptionServiceImpl` (`backend-builder`)

Depends on Phase 5 (`SubscriptionWelcomeEmailService` must exist first).

11. `backend/src/main/java/com/cricketlegend/service/impl/SubscriptionServiceImpl.java` — amend:
    - Add `SubscriptionWelcomeEmailService subscriptionWelcomeEmailService` as a 12th constructor-injected field, appended after the existing `keycloakProvisioningService` field/parameter (confirmed current 11-param shape above).
    - Insert `sendWelcomeEmailBestEffort(responsiblePerson, subscription, club, product);` as the new line between the confirmed current lines 126 and 128.
    - Add the new private method verbatim from the spec's sketch, including its `try { ... } catch (EmailDeliveryException e) { log.error(...); }` block — reusing the class's existing `Logger log` field (already present, added by `016`, no new field needed). **This catch block is the safety net Phase 3/step 6 depends on — must not be narrowed or removed.**
    - `get()`/`list()`/`update()`/`cancel()` remain untouched.

## Phase 7 — Documentation updates (`backend-builder`)

Its own small step, per the spec's own Rollout Notes — not left implicit in the code changes above.

12. `docs/deployment.md`'s "Email / SMTP — not yet configured anywhere" section — amend to note this application's own `spring.mail.*` now exists too (not just Keycloak's realm-level SMTP), that both share one local Mailpit/Mailhog sink in development (Phase 0), and that a real SMTP provider plus SPF/DKIM/DMARC DNS records for `cricketlegend.co.za` remain an open, unresolved decision for either consumer to work end-to-end in a real deployed environment.
13. `docs/roadmap.md`'s "Next up — notifications / email infrastructure" section — amend to record that this spec resolves its first named use case (the Subscription responsible party's welcome email), and that the reusable `EmailService`/base-layout primitive now exists for the entry's second named use case (the self-serve signup OTP flow) and for `003`'s still-unbuilt `Invitation` admin-invite email to reuse next — the same "flag as a reusable primitive for a named future spec" pattern `016`'s own Rollout Notes already used for `KeycloakProvisioningService`.

## Flags for your review

1. **Test package placement — the spec's own Test Plan is silent on this, resolved here rather than left ambiguous.** `docs/plans/016`'s own Flag #5 raised exactly this question (flat `com.cricketlegend.service` vs. `com.cricketlegend.service.impl`) as a recommendation, subsequently actually applied: `KeycloakProvisioningServiceImplTest` and `MeServiceImplTest` both landed under `.service.impl`, while every older `*ServiceImplTest` (including `SubscriptionServiceImplTest` itself) still sits flat under `.service`. This plan places the two brand-new test classes this spec needs — `EmailServiceImplTest` and `SubscriptionWelcomeEmailServiceImplTest` — under `backend/src/test/java/com/cricketlegend/service/impl/`, following the now-twice-applied newer convention. `SubscriptionServiceImplTest` itself (amended, not new) stays exactly where it already is.
2. **`EmailDeliveryException`'s catch block in `SubscriptionServiceImpl` is a hard requirement, not a suggestion** — the identical shape already named for `KeycloakProvisioningException`, now present a second time in the same method. No downstream safety net exists in `GlobalExceptionHandler` for either exception. `test-writer` must assert this explicitly for the new exception too.
3. **No test-scoped `application.properties`/`application-test.properties` override exists anywhere in this repo** (confirmed — no `backend/src/test/resources/application*.properties` file at all). Every `@SpringBootTest`-based integration test, including the amended `SubscriptionControllerIntegrationTest`, boots the real Spring context against the checked-in `application.properties`'s new `spring.mail.host=localhost`/`port=1025` defaults. Safe today only because `SubscriptionWelcomeEmailService` is `@MockitoBean`'d in that one test class (the real `EmailServiceImpl`/auto-configured `JavaMailSender` bean is constructed at context startup — harmless, no network call happens at construction — but never actually invoked to `send()`), and because no other `@SpringBootTest` class anywhere in this repo currently exercises `SubscriptionServiceImpl.create()` without also mocking it. Flagged explicitly: a future test that drives a real Subscription creation through the full stack without mocking `SubscriptionWelcomeEmailService` will attempt a real SMTP connection to `localhost:1025` and fail in CI, where no sink is running.
4. **No spec-vs-code drift found anywhere else** — `SubscriptionServiceImpl.create()`'s current shape, its constructor's current 11 parameters, `SubscriptionServiceImplTest`'s single shared constructor call site, and `SubscriptionControllerIntegrationTest`'s existing `@MockitoBean KeycloakProvisioningService` pattern all match the spec's own stated assumptions exactly, confirmed by direct reading twice over (once by the Plan agent, once independently by re-reading the actual file). Unlike `016`'s corrected Maven placeholder version, this spec's two new dependencies genuinely need no manual pin — confirmed against the actual `spring-boot-starter-parent 3.4.3` declaration.

## Test plan mapping (for `test-writer`)

| Spec Test Plan tier | File(s) | What's new vs. amended |
|---|---|---|
| Unit (new) | `service/impl/EmailServiceImplTest.java` (package per Flag #1) | Mocked `JavaMailSender`/`MimeMessage`: correct from-address/name, to-address, subject, HTML body with `isHtml=true`; any exception thrown by the mocked sender is wrapped in `EmailDeliveryException`. |
| Unit (new) | `service/impl/SubscriptionWelcomeEmailServiceImplTest.java` (package per Flag #1) | Real `SpringTemplateEngine` against the checked-in templates, no Spring context needed: rendered HTML contains substituted `firstName`/`clubName`/`productName`/formatted `startDate`; a `null` `endDate` renders "Ongoing - no fixed end date," never blank/`null`; `loginUrl` correctly prefixes the club's `slug` onto `app.frontend.base-url`'s own scheme/authority; subject line contains the club name and person's first name; `EmailService.send(...)` (mocked) is called with the person's own email as the to-address. |
| Unit | `service/SubscriptionServiceImplTest.java` | **Amend the shared `@BeforeEach`** (add one `@Mock SubscriptionWelcomeEmailService` field + the 12th constructor argument — fixes all existing tests at once) + append: `create()` calls `subscriptionWelcomeEmailService.sendWelcomeEmail(...)` exactly once per call, including on a *second* `create()` call for a `Person` who's already Keycloak-provisioned (the regression proving this call is **not** gated the way Keycloak provisioning is — judgment call #2); a thrown `EmailDeliveryException` is caught, logged, and does **not** propagate — `create()` still returns a `SubscriptionDto`. |
| Integration | `controller/SubscriptionControllerIntegrationTest.java` | **Amend:** add `@MockitoBean SubscriptionWelcomeEmailService`, mirroring the exact `@MockitoBean KeycloakProvisioningService` pattern and its Javadoc reasoning already in this file; extend `createValidSubscriptionPersistsAsActiveWithStatus201` with an assertion that `sendWelcomeEmail(...)` was invoked once with the correct `Person`/`Subscription`/`Club`/`Product`; add a new test mirroring `createStillReturns201WhenKeycloakProvisioningThrows` — stubbing the mocked service to throw `EmailDeliveryException` still yields `201` and a persisted Subscription. |
| Contract | `backend/openapi/openapi.yaml` | No change expected — confirm the checked-in schema diff is empty for `POST /api/v1/platform/subscriptions` (and every other endpoint), matching `016`'s own precedent for an invisible-to-the-wire side effect. |
| Component | Not applicable | No frontend surface — confirmed by the spec's own Non-goals/UI Requirements, matching `013`'s precedent for a backend-only spec. |
| End-to-end | Not CI-wired | Manual/local run per Verification below, using Phase 0's Mailpit/Mailhog sink. |

## Verification

1. `cd backend && ./mvnw verify` — full build + unit + Testcontainers integration + ArchUnit + OpenAPI contract diff. Watch specifically for: (a) any transitive dependency conflict introduced by `spring-boot-starter-mail`/`spring-boot-starter-thymeleaf` (none expected — both are dependency-managed by the existing parent — but confirm empirically, not by inspection alone); (b) that `spring-boot-starter-thymeleaf`'s auto-configured `ViewResolver` bean doesn't change any existing `MockMvc`-based controller test's response handling (expected to be a non-issue, confirmed no bare `@Controller` exists anywhere, but worth watching the full suite pass).
2. Independently re-run `./mvnw verify` myself after `backend-builder`/`test-writer` report, exactly as done for `016` — a subagent's self-report that "tests pass" is not sufficient confirmation on its own.
3. **Manual local E2E smoke test** (after Phase 0's Mailpit/Mailhog sink is running):
   - Start the backend (`./mvnw spring-boot:run -Dspring-boot.run.profiles=dev`) and frontend (`npm run dev`).
   - As `platform_admin`, create a Subscription for a Club/Product/responsible-person combination, using an email address different from any already-provisioned `Person` (to isolate this from `016`'s own Keycloak invite email arriving in the same inbox).
   - Confirm exactly one welcome email arrives at the Mailpit/Mailhog web UI (`http://localhost:8025` by default), correctly naming the club, product, start date, and "Ongoing - no fixed end date" if no `endDate` was set.
   - Visually confirm the rendered HTML: header/button colours match `ui/src/theme.ts`'s `primary.main`/`text.primary`/`text.secondary`/`divider` tokens, and the outer page background renders as the deliberate `#f4f6f5` addition, not a jarring blank-white-on-white message.
   - Click the "Log in to your club" link — confirm it resolves to `{club's slug}.{app.frontend.base-url's own host}/login`, matching `FindYourClubLogin.tsx`'s own client-side URL shape.
   - Create a second Subscription for the *same* responsible person against a *different* Club — confirm a second, separately-scoped welcome email arrives (correct second club/product/dates), not a single email and not a silently suppressed second send.
   - Stop the Mailpit/Mailhog sink (or point `spring.mail.host` at an unreachable host) and repeat Subscription creation — confirm the `POST` still returns `201` and the Subscription persists, with the failure visible only in the backend's own log output at `ERROR`.
