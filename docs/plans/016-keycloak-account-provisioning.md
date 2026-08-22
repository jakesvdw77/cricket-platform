# Implementation Plan — 016: Keycloak Account Provisioning

## Context

Specs `014` (Subscription→Person) and `015` (Person.status + RoleAssignment) are merged to `master`. This is the third and final piece of the chain: when a Subscription is created, provision a real Keycloak account for the responsible `Person` (if they don't have one), grant them a `CLUB_ADMIN` `RoleAssignment`, send a password-reset invite email via Keycloak's Admin API, and on first login bridge the JWT to the `Person` by email, set `keycloakUserId`, flip `status` `PENDING`→`ACTIVE`, and route the login to the existing Manager shell instead of Admin.

`docs/specs/016-keycloak-account-provisioning.md` is the authoritative spec, with real code sketches already resolved through 6 named "Real Architectural Judgment Calls" (transactional posture, failure handling, multi-grant behavior, `PersonStatus` default change, activation trigger mechanism, Manager-view routing) — none of these are re-litigated here.

This plan was produced after two Explore passes confirming every file this spec touches against actual current (post-`014`/`015`-merge) code — no drift found between the spec's assumptions and reality — plus a Plan-agent design pass, both independently verified. One real discrepancy was found and corrected: the spec's Maven dependency sketch uses a placeholder version (`26.0.7`) but the actual running local dev Keycloak (`cricketlegend-keycloak-dev` container) is confirmed via `docker inspect` to be `quay.io/keycloak/keycloak:24.0.3` — this plan pins `keycloak-admin-client` to `24.0.3` to match exactly, not the spec's placeholder.

## Phase 0 — Manual infrastructure prerequisites (human, not `backend-builder`)

Blocking for local end-to-end verification, not for the code itself to compile/pass tests. The local dev Keycloak (`cricketlegend-keycloak-dev`, `auth.localhost:8180`) was started via a bare `docker run` — no compose file manages it and no volume is mounted (`docker inspect` shows `Mounts: []`), so any realm/client edits made through the admin console are **not persisted** across a container recreation. Worth calling out explicitly since it's easy to lose silently.

1. Create client `platform-provisioning` in realm `cricketlegend`: Client authentication **On**, Standard flow **Off**, Direct access grants **Off**, Service accounts roles **On**. Copy the generated secret for `KEYCLOAK_ADMIN_CLIENT_SECRET`.
2. Under that client's **Service accounts roles** tab, assign `manage-users` from the `realm-management` client.
3. Realm Settings → Email: point at a local catch-all SMTP sink (MailHog/Mailpit) so invite emails are inspectable. **No such container exists anywhere in this repo today** (confirmed — only `docker-compose.logging.yml` exists, no Mailhog/Mailpit reference found) — stand one up with a one-off `docker run` for local testing; not part of this spec's own deliverables.
4. Recommend exporting the realm config (`kcadm.sh` or the admin console's Export) once set up, since nothing persists it — a note for whoever does this, not a deliverable.

## Phase 1 — Backend: domain + migration (`backend-builder`)

1. `backend/src/main/java/com/cricketlegend/domain/Person.java` — add `@Column(name = "keycloak_provisioned_at") private Instant keycloakProvisionedAt;`. `Person` already uses `@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder` (Lombok) — no hand-written accessors needed.
2. `backend/src/main/resources/db/changelog/v1/012-add-person-keycloak-provisioned-at.sql` (new) — `ALTER TABLE person ADD COLUMN keycloak_provisioned_at TIMESTAMPTZ;`. Confirmed `011-add-role-assignment.sql` is the current highest file, so `012` is correctly next.
3. `backend/src/main/resources/db/changelog/db.changelog-master.xml` — add the twelfth `<include>` line.

No repository changes anywhere in this phase — `PersonRepository`/`RoleAssignmentRepository` already expose everything needed (`findByEmailIgnoreCase`, `findByKeycloakUserId`, `findByPersonId`, `existsByPersonIdAndRoleAndScopeTypeAndScopeId`), confirmed present.

## Phase 2 — Backend: config/infra (`backend-builder`)

Before Phase 3 — the new service classes depend on this bean/these properties existing.

4. `backend/pom.xml` — add:
   ```xml
   <dependency>
       <groupId>org.keycloak</groupId>
       <artifactId>keycloak-admin-client</artifactId>
       <version>24.0.3</version> <!-- pinned to match the actual running Keycloak server
                                        (quay.io/keycloak/keycloak:24.0.3, confirmed via
                                        docker inspect cricketlegend-keycloak-dev) — NOT the
                                        spec's own 26.0.7 placeholder, which assumed a newer
                                        server version than what's actually deployed. -->
   </dependency>
   ```
5. `backend/src/main/resources/application.properties` — add the spec's five new properties (`app.keycloak.admin.server-url`, `app.keycloak.admin.realm`, `app.keycloak.admin.client-id`, `app.keycloak.admin.client-secret`, `app.keycloak.public-client-id`, `app.frontend.base-url`), same `${ENV_VAR:default}` style as existing `app.media.*`/`app.logging.*` blocks. No naming collision with the sole existing Keycloak property (`spring.security.oauth2.resourceserver.jwt.issuer-uri`).
6. **Local dev secret handling (flagged, not silently invented):** `app.keycloak.admin.client-secret=${KEYCLOAK_ADMIN_CLIENT_SECRET:}` has no safe default — empty will fail Keycloak auth. This repo has no existing precedent for a required secret in `application-dev.properties` (its only Keycloak property, the JWT issuer URI, has no secret). `backend-builder` should not invent a new secrets mechanism — document in the PR description that a local dev must `export KEYCLOAK_ADMIN_CLIENT_SECRET=...` in their shell before `./mvnw spring-boot:run -Dspring-boot.run.profiles=dev`, matching this property's own `${ENV_VAR:default}` convention.
7. `backend/src/main/java/com/cricketlegend/config/KeycloakAdminClientConfig.java` (new) — one `@Bean Keycloak keycloakAdminClient(...)`, exactly the spec's sketch (`KeycloakBuilder`, `client_credentials` grant).

## Phase 3 — Backend: exception + new provisioning service (`backend-builder`)

8. `backend/src/main/java/com/cricketlegend/exception/KeycloakProvisioningException.java` (new) — extends `RuntimeException` directly, exactly as spec'd. **Hard requirement, not a suggestion:** confirmed `GlobalExceptionHandler` has handlers for exactly three bases (`NotFoundException`/`ConflictException`/`ValidationException`) and no bare-`RuntimeException` fallback. This is safe **only** because `SubscriptionServiceImpl`'s catch block (Phase 4) always catches it before it can propagate. If that catch block is ever narrowed or removed without a `GlobalExceptionHandler` change in the same PR, an uncaught `KeycloakProvisioningException` will 500 the entire `POST /platform/subscriptions` request — directly contradicting the spec's judgment call #1 (a Keycloak outage must never fail Subscription creation). `test-writer` must assert this explicitly (see Test Plan).
9. `backend/src/main/java/com/cricketlegend/service/KeycloakProvisioningService.java` (new interface) — `void provisionAccount(Person person)`.
10. `backend/src/main/java/com/cricketlegend/service/impl/KeycloakProvisioningServiceImpl.java` (new) — exactly the spec's sketch: build `UserRepresentation`, `POST /users`, extract id via `CreatedResponseUtil.getCreatedId`, call `executeActionsEmail(publicClientId, resetRedirectUri, List.of("UPDATE_PASSWORD"))`, wrap all failures in `KeycloakProvisioningException`. Constructor injection only (`docs/standards/backend.md`, ArchUnit-enforced), no field injection.

## Phase 4 — Backend: amend `PersonServiceImpl` and `SubscriptionServiceImpl` (`backend-builder`)

11. `backend/src/main/java/com/cricketlegend/service/impl/PersonServiceImpl.java` — one-line change in `findOrCreatePerson`'s create branch: `.status(PersonStatus.ACTIVE)` → `.status(PersonStatus.PENDING)`. Confirmed by grep this is the only call site of `findOrCreatePerson` anywhere in `backend/src/main/java` — safe to change unilaterally. The "link, don't overwrite" branch for an existing `Person` is untouched.
12. `backend/src/main/java/com/cricketlegend/service/impl/SubscriptionServiceImpl.java` — amend `create()`:
    - Add `RoleAssignmentRepository` and `KeycloakProvisioningService` as two new constructor-injected fields (9 → 11 constructor params).
    - Insert `grantClubAdminAccess(responsiblePerson, subscription.getOwnerId());` and `provisionKeycloakAccountIfNeeded(responsiblePerson, subscription);` between `subscription = subscriptionRepository.save(subscription);` and `return toDto(...)`, exactly per spec.
    - Add the two new private methods verbatim from the spec's sketch, including the `try { ... } catch (KeycloakProvisioningException e) { log.error(...); }` block. **This catch block is the safety net Phase 3/step 8 depends on — must not be narrowed or removed.**
    - Confirm/add an SLF4J `Logger` field if the class doesn't already have one.
    - `get()`/`list()`/`update()`/`cancel()` remain untouched.

## Phase 5 — Backend: `AccessService` extraction (`backend-builder`)

13. `backend/src/main/java/com/cricketlegend/config/AccessService.java` — extract the inlined `platform_admin` boolean check (currently lines 46-48) into a new public `isPlatformAdmin(Authentication authentication)` method; `canAdministerClub` calls it instead of duplicating the check. No constructor change. Update/remove the existing Javadoc note calling the `RoleAssignment` branch "correct but effectively unreachable in production" — it's reachable as of this spec.

## Phase 6 — Backend: new `Me` endpoint (`backend-builder`)

Depends on Phase 5 (`isPlatformAdmin`).

14. `backend/src/main/java/com/cricketlegend/dto/MeAccessDto.java` (new) — record exactly as spec'd.
15. `backend/src/main/java/com/cricketlegend/service/MeService.java` (new interface).
16. `backend/src/main/java/com/cricketlegend/service/impl/MeServiceImpl.java` (new) — `activateAndResolveAccess(Authentication, Jwt)`: fast path via `findByKeycloakUserId`, fallback `bridgeByEmail` (sets `keycloakUserId`, flips `PENDING`→`ACTIVE` only, leaves other statuses alone), builds `clubAdminClubIds` filtered to `CLUB_ADMIN`/`CLUB`-scoped rows only.
17. `backend/src/main/java/com/cricketlegend/controller/MeController.java` (new) — `@RestController @RequestMapping("/api/v1/me")`, single `@PostMapping("/activate")`. No `@PreAuthorize` needed — confirmed it falls through `SecurityConfig`'s existing `.anyRequest().authenticated()` catch-all with zero `SecurityConfig` changes, and `Authentication.getName()` already resolves to the JWT `sub` via Spring's default `JwtAuthenticationConverter` behavior (confirmed, not assumed).

`SecurityConfig.java` and `JwtAuthenticationConverter` are **not touched** in this phase.

## Phase 7 — Frontend: API client + routing page (`frontend-builder`)

Depends on Phase 6 existing.

18. `ui/src/api/meApi.ts` (new) — `MeAccess` interface + `activateSession()`, built on the shared `api` instance from `axiosConfig.ts` (bearer token auto-attaches, zero extra wiring).
19. `ui/src/pages/view/PostLoginRedirect.tsx` (new) — `useQuery(['me','activate'], activateSession)`, `useEffect` routing to `/admin` (platform admin, error, or neither-authority fallback) or `/manage` (has `clubAdminClubIds`). A `pages/view/**` file — no four-file component anatomy/`.stories.tsx` required (`docs/standards/frontend.md`: `pages/**` compose from `components/**`, not reusable), but still needs its own `.test.tsx` since it carries real routing logic.
20. `ui/src/pages/view/Login.tsx` — one-line change: `redirectUri` from `${origin}/admin` to `${origin}/post-login`.
21. `ui/src/App.tsx` — add `<Route path="/post-login" element={<PostLoginRedirect />} />` alongside the existing club-agnostic `/login`/`/admin` routes, plus the import.

**Confirmed explicitly untouched — do not let `frontend-builder` "helpfully" touch these:** `ui/src/pages/admin/AdminHome.tsx`/`ui/src/api/adminApi.ts` (a separate, already-working `GET /api/v1/platform/me` mechanism from spec `005` — different endpoint, different gate, not this spec's concern), `ui/src/pages/manage/ManagerHome.tsx` (stays on `MOCK_MANAGER` per the spec's own UI Requirements — real identity fetch is an explicit follow-up), `ui/src/auth/keycloak.ts` (unrelated code path).

## Flags for your review

1. **Maven dependency version corrected from the spec's placeholder** — see Phase 2/step 4 above. `26.0.7` → `24.0.3`, verified against the actual running container, not assumed.
2. **`KeycloakProvisioningException`'s catch block in `SubscriptionServiceImpl` is a hard requirement** — no downstream safety net exists in `GlobalExceptionHandler`. Flagged at both Phase 3/step 8 and Phase 4/step 12; `test-writer` must cover it explicitly.
3. **`SubscriptionServiceImplTest`'s 18 existing tests confirmed lower-risk than initially worried, but still the single highest-mechanical-risk file.** Verified directly: one shared `@BeforeEach` constructs `subscriptionService` via a single 9-arg `new SubscriptionServiceImpl(...)` call — adding 2 new `@Mock` fields + constructor args there fixes compilation for all 18 at once. Grepped for `verify(...)`/`verifyNoMoreInteractions` on the affected repositories — none exist that would be affected; the only `never()` assertions guard validation-failure paths that return before reaching the new code either way. None of the 18 need a behavioral assertion change — only the shared setup, plus genuinely new tests appended.
4. **`AccessServiceTest`'s 7 existing tests confirmed to need zero changes** — `isPlatformAdmin`'s extraction introduces no new constructor dependency (still just `PersonRepository`/`RoleAssignmentRepository`), it's a pure internal refactor of `canAdministerClub`'s body. Only new test(s) for the newly-public `isPlatformAdmin` method itself need appending.
5. **Test package convention inconsistency, worth resolving explicitly rather than silently picking one.** `backend/src/test/java/com/cricketlegend/service/**` has eight older `*ServiceImplTest` classes sitting flat under `com.cricketlegend.service`, but the most recent one (`AdminIdentityServiceImplTest`) sits under `com.cricketlegend.service.impl`, mirroring main-code package structure. `AdminIdentityService`/`Impl` is the closest structural sibling to this spec's new `MeService`/`KeycloakProvisioningService` (small, focused identity-resolution services). **Recommendation, not a hard rule:** place `KeycloakProvisioningServiceImplTest` and `MeServiceImplTest` under `backend/src/test/java/com/cricketlegend/service/impl/`, following the newer convention.
6. **`KEYCLOAK_ADMIN_CLIENT_SECRET` local-dev handling — documented as a manual step (Phase 2/step 6), not solved with new tooling.** No existing secrets-management convention exists in this repo for a required (non-defaultable) property; not inventing one unilaterally.
7. **No MailHog/Mailpit sink exists anywhere in this repo** — confirmed by grep. A real gap between the spec's own assumption ("local dev should point at a catch-all SMTP sink") and what's actually available. Resolved as a manual `docker run` step for whoever does the E2E smoke test (Phase 0/step 3), not part of this PR's own deliverables.

## Test plan mapping (for `test-writer`)

| Spec Test Plan tier | File(s) | What's new vs. amended |
|---|---|---|
| Unit | `PersonServiceImplTest.java` | **Amend:** rename `findOrCreatePersonSetsStatusActiveOnANewlyCreatedPerson` → `...SetsStatusPendingOnANewlyCreatedPerson`, flip both `ACTIVE` assertions to `PENDING`. The `SUSPENDED`-existing-person test is unaffected. |
| Unit | `SubscriptionServiceImplTest.java` | **Amend the shared `@BeforeEach`** (Flag #3) + append: grant creates a `CLUB_ADMIN` `RoleAssignment` scoped to `ownerId`; a second `create()` for a different club grants a second, independently-scoped row; the `existsBy...` guard prevents a duplicate for the same person+club; provisioning called only when both `keycloakUserId`/`keycloakProvisionedAt` are null, sets `keycloakProvisionedAt` on success; provisioning skipped when either is set; a thrown `KeycloakProvisioningException` is caught, logged, doesn't propagate, response still returns, `keycloakProvisionedAt` stays null. |
| Unit (new) | `service/impl/KeycloakProvisioningServiceImplTest.java` (package per Flag #5) | Mocked `Keycloak` admin client: `UserRepresentation` built with correct `enabled`/`emailVerified`/`email`/`firstName`/`lastName`; `executeActionsEmail` called with `["UPDATE_PASSWORD"]` + configured `publicClientId`/`resetRedirectUri`; non-201 create response and any thrown exception both wrapped in `KeycloakProvisioningException`. |
| Unit (new) | `service/impl/MeServiceImplTest.java` (package per Flag #5) | Already-`keycloakUserId`-resolvable person returned as-is, no email lookup, no write; email-only-resolvable person gets `keycloakUserId` set + `PENDING`→`ACTIVE`; already-`ACTIVE` person found by email left untouched; no person at all (unknown email/no email claim) returns `personId: null` without throwing; `clubAdminClubIds` includes only `CLUB_ADMIN`/`CLUB`-scoped rows. |
| Unit | `AccessServiceTest.java` | **No change to the existing 7** (Flag #4) — append `isPlatformAdmin` direct tests: null authentication, no `ROLE_platform_admin`, `ROLE_platform_admin` present. |
| Integration | `PersonRepositoryTest` (extended) | `012-add-person-keycloak-provisioned-at.sql` applies cleanly, column defaults `NULL`. |
| Integration | `RoleAssignmentRepositoryTest` | New assertion: two `CLUB_ADMIN` rows for the same `person_id` at two different `scope_id`s both persist and both return from `findByPersonId`. |
| Contract | `backend/openapi/openapi.yaml` | `POST /api/v1/me/activate` + `MeAccessDto` reflected; `POST /api/v1/platform/subscriptions` confirmed unchanged. |
| Component (new) | `ui/src/pages/view/PostLoginRedirect.test.tsx` | Renders "Signing you in…"; navigates `/admin` when `platformAdmin: true`; navigates `/manage` when `clubAdminClubIds` non-empty and not platform admin; navigates `/admin` when both false/empty; navigates `/admin` when `activateSession()` rejects. |
| Component (amend) | `ui/src/pages/view/Login.test.tsx` | Rename/retarget the existing single test to assert `/post-login`, not `/admin`. |
| E2E | Not CI-wired (matches `005`/`008`–`015`'s own precedent) | Manual Playwright run per Verification below. |

## Verification

1. `cd backend && ./mvnw verify` — full build + unit + Testcontainers integration + ArchUnit + OpenAPI contract diff. Watch for any transitive dependency conflict on the first run with `keycloak-admin-client` added (none found by static `pom.xml` inspection, but confirm empirically).
2. `cd ui && npm run lint && npm run test && npm run build`.
3. Independently re-run both of the above myself after `backend-builder`/`frontend-builder`/`test-writer` report, exactly as done for `014`/`015` — a subagent's self-report is not sufficient confirmation for a change touching authentication/authorization.
4. **Manual local E2E smoke test** (after Phase 0's manual Keycloak setup and a MailHog/Mailpit sink are in place):
   - Start backend (`./mvnw spring-boot:run -Dspring-boot.run.profiles=dev`, with `KEYCLOAK_ADMIN_CLIENT_SECRET` exported) and frontend (`npm run dev`).
   - As `platform_admin`, create a Subscription for a brand-new email.
   - Confirm exactly one new, enabled, `emailVerified: false` Keycloak user exists in the admin console.
   - Confirm exactly one `UPDATE_PASSWORD` invite email arrived at the SMTP sink.
   - Complete the reset flow — confirm the browser lands on `/post-login` briefly, then `/manage` (not `/admin`).
   - Query the `person` table directly — confirm `keycloak_user_id` is set, `status` is `ACTIVE`, `keycloak_provisioned_at` was already set from creation time.
   - Exercise a `canAdministerClub`-guarded endpoint (e.g. `PUT /api/v1/platform/clubs/{id}/profile`) as that now-logged-in user — succeeds for their Club, fails for an unrelated one.
   - Create a second Subscription for the same email against a different Club — confirm zero new Keycloak users/emails, and a second `CLUB_ADMIN` `RoleAssignment` row (query `role_assignment` directly).
   - As `platform_admin`, log in fresh — confirm still lands on `/admin`, unchanged behavior.
