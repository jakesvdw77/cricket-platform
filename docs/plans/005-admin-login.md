# Implementation Plan — 005: Admin Login

*Permanent record of the plan approved via `/plan-feature docs/specs/005-admin-login.md`. The working copy Claude Code keeps under `~/.claude/plans/` is a scratch file; this is the git-tracked copy, kept alongside the spec it implements.*

## Context

`docs/specs/005-admin-login.md` wires up the first real Keycloak login in this codebase: a platform admin logs in from a club subdomain's `/login` route (reached via the already-built `FindYourClubLogin` component on the root landing page) and lands on a minimal page confirming their admin identity, backed by a real backend role check. Everything needed already exists in scaffold form — `ui/src/auth/keycloak.ts`, `SecurityConfig`'s `hasRole("platform_admin")` gate on `/api/v1/platform/**` — but nothing calls any of it yet. This plan wires it together without touching anything `001`'s full `RoleAssignment` model would otherwise require.

## Flags for your review

Two things surfaced during planning that change what's in this slice — confirming here before build starts, per `docs/workflow.md` step 5's "don't quietly patch around it" rule:

1. **Realm/client naming diverges from what's checked in.** `docs/specs/002-realm-subdomain-auth.md`, `application.properties`/`application-dev.properties`, and `keycloak.ts`'s defaults all say `platform-dev`/`platform-web`. The actual local Keycloak uses realm `cricketlegend`, client `cricketlegend`. **Resolved:** update the checked-in defaults to `cricketlegend`/`cricketlegend` (confirmed with the human) rather than renaming the local Keycloak setup. `002` itself is left untouched this pass — it still documents `platform-dev`/`platform-web` — and should get a follow-up edit once naming is finalized for the real prod rollout, since editing `002` isn't this feature's job to redefine unilaterally.
2. **The Playwright E2E golden path runs locally only, not in CI.** `.github/workflows/ci.yml`'s `e2e-smoke` job deliberately has no Keycloak today (its own comment says so — the golden paths it covers don't need one). Standing up Keycloak in CI (service container, realm import, a seeded credential CI can read) is a separate, larger infra decision than this feature needs to make. This plan writes the real E2E test (satisfies `testing.md`'s "one E2E per golden path" rule) with the same "seed a fixture manually, document the prerequisite in the test's own header comment" convention `ui/e2e/landing-page.spec.ts` already uses for its Club fixture — but does **not** add it to `ci.yml`. Flagging this explicitly so it's not mistaken for an oversight; revisit when CI-Keycloak infra is actually wanted.

## Backend — `backend-builder`

Follows `LeadController`/`PublicClubController`'s exact shape (flat `controller` package, no class-level `@RequestMapping`, constructor injection) but with **no repository layer** — the endpoint reads only the verified JWT, per the spec's explicit non-goal against a `Person` lookup.

1. `backend/src/main/resources/application.properties` and `application-dev.properties` — change the `issuer-uri` default from `.../realms/platform-dev` to `.../realms/cricketlegend` (env override `KEYCLOAK_ISSUER_URI` unaffected).
2. `backend/src/main/java/com/cricketlegend/dto/AdminIdentityDto.java` — new record: `AdminIdentityDto(String keycloakUserId, String username, String email)`.
3. `backend/src/main/java/com/cricketlegend/service/AdminIdentityService.java` — new interface: `AdminIdentityDto getCurrentAdmin(Jwt jwt)`.
4. `backend/src/main/java/com/cricketlegend/service/impl/AdminIdentityServiceImpl.java` — new `@Service` impl, maps `jwt.getSubject()` → `keycloakUserId`, `jwt.getClaimAsString("preferred_username")` → `username`, `jwt.getClaimAsString("email")` → `email`. (Confirmed via `SecurityConfig`: it only overrides `setJwtGrantedAuthoritiesConverter`, so the `Authentication`'s principal is the plain `Jwt` — no custom principal type to work around.)
5. `backend/src/main/java/com/cricketlegend/controller/AdminIdentityController.java` — new `@RestController`, `GET /api/v1/platform/me`, `@AuthenticationPrincipal Jwt jwt` param, delegates to the service. **No `SecurityConfig` change** — the existing `.requestMatchers("/api/v1/platform/**").hasRole("platform_admin")` already covers this path.
6. `backend/openapi/openapi.yaml` — hand-add the `/api/v1/platform/me` path (tag `admin-identity-controller`, `operationId: me`, 200 → `AdminIdentityDto`) and the `AdminIdentityDto` schema, matching the existing hand-maintained style (confirmed: this file has no generation tooling/CI diff wired up yet — it's manually kept in sync, same as the prior two feature PRs did).

## Frontend — `frontend-builder`

Confirmed gaps to close (not just "add two pages"): `keycloak.init()` is never called anywhere in the app today, and `ui/public/silent-check-sso.html` (required by `keycloak.ts`'s `silentCheckSsoRedirectUri`) doesn't exist. This is the first real usage of the scaffolded client.

1. `ui/src/auth/keycloak.ts` — change `realm`/`clientId` fallback defaults to `'cricketlegend'`. Add, at module scope (so it fires once, automatically, the first time anything imports this module — which `axiosConfig.ts` already does):
   ```ts
   export const keycloakInitPromise = keycloak.init({
     onLoad: 'check-sso',
     redirectUri: window.location.origin + '/',
     silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
   })
   ```
2. `ui/public/silent-check-sso.html` — new file, the standard Keycloak boilerplate (`parent.postMessage(location.href, location.origin)`).
3. `ui/src/api/axiosConfig.ts` — request interceptor `await`s `keycloakInitPromise` before checking `keycloak.authenticated`, fixing the race for every current and future authenticated call (one-line addition ahead of the existing `if (keycloak.authenticated)` check).
4. `ui/src/api/adminApi.ts` — new file, mirrors `leadApi.ts`'s one-function-per-resource shape: `getAdminIdentity(): Promise<AdminIdentity>` → `GET /platform/me`.
5. `ui/src/pages/view/Login.tsx` — new page. On mount, `keycloak.login({ redirectUri: `${window.location.origin}/admin` })`. Lives in `pages/view/` (not `pages/admin/`) because it's reachable by anyone attempting to log in, admin or not — the role check happens after, at `/admin`.
6. `ui/src/pages/admin/AdminHome.tsx` — new page (folder currently just `.gitkeep`). `useQuery(['admin-me'], getAdminIdentity)`; renders `Card` with the identity on success, `EmptyState` ("not authorized") on error — never admin content while loading or after failure, per the spec's acceptance criteria.
7. `ui/src/App.tsx` — add `/login` → `Login` and `/admin` → `AdminHome`, inside the existing `!isRootDomain` branch, alongside the current `/` route. No change to root-domain or existing `/` (`UpcomingMatches`) behavior.

**Route design note:** `AdminHome` mounts at a dedicated `/admin` path (via `login()`'s per-call `redirectUri` override), not at `/` itself — even though `002`'s own snippet shows `redirectUri: window.location.origin + '/'` for the default `init()` call. Reusing `/` for both `UpcomingMatches` and post-login admin content would mean branching the existing public route on auth state, which isn't needed anywhere else yet and isn't something `005` asks for. `keycloak-js` supports this per-call override natively; `keycloak.init()`'s own `redirectUri` (used for silent SSO only) is untouched.

## Tests — `test-writer`

Compared against the spec's Test Plan table; nothing here is already covered elsewhere.

**Backend:**
- `backend/src/test/java/com/cricketlegend/service/impl/AdminIdentityServiceImplTest.java` — plain JUnit 5 (no Spring context), build a `Jwt` via `Jwt.withTokenValue(...)`, assert the claim → DTO field mapping.
- `backend/src/test/java/com/cricketlegend/controller/AdminIdentityControllerIntegrationTest.java` — same `@SpringBootTest @AutoConfigureMockMvc @Import(AbstractIntegrationTest.class) @Transactional` shape as `LeadControllerIntegrationTest`/`PublicClubControllerIntegrationTest` (Testcontainers Postgres is needed only for the full app context to boot — confirmed neither of those two DB-untouching endpoints skips it either). Reuse/extend the existing `platformAdmin()` JWT-builder pattern (lines 168–182 of `LeadControllerIntegrationTest`), adding `sub`/`preferred_username`/`email` claims this endpoint reads, plus a `nonAdmin()` variant (authenticated, some other role) for the 403 case:
  - `meWithoutAuthenticationReturns401()`
  - `meWithNonAdminJwtReturns403()`
  - `meWithPlatformAdminJwtReturnsIdentity()` — asserts response JSON matches the built JWT's claims.

**Frontend:**
- `ui/src/pages/view/Login.test.tsx` — `vi.mock('../../auth/keycloak', ...)`, asserts `keycloak.login` is called once on mount with the `/admin` redirect URI.
- `ui/src/pages/admin/AdminHome.test.tsx` — `vi.mock('../../api/adminApi', ...)` (mirrors `LandingPage.test.tsx`'s per-test `QueryClientProvider` + module-mock pattern), one case for the success render (`Card` shows identity), one for the error render (`EmptyState` shows).
- `ui/e2e/admin-login.spec.ts` — new Playwright golden path, following `landing-page.spec.ts`'s exact convention (prerequisite documented in a header comment, fixture values env-overridable): navigate to `{slug}.{rootDomain}/login`, follow the real Keycloak redirect (same origin/port locally, so Playwright can actually follow it — unlike `landing-page.spec.ts`'s cross-subdomain redirect test, which aborts the navigation instead), fill real credentials for a seeded `platform_admin` test user (`E2E_ADMIN_USERNAME`/`E2E_ADMIN_PASSWORD` env vars), assert landing on `/admin` with the identity visible. **Not added to `ci.yml`** — see Flag #2 above.

## Verification

- `cd backend && ./mvnw verify` — full backend build + unit + integration tests (Testcontainers).
- `cd ui && npm run lint && npm run test && npm run build` — frontend unit/component tests + build.
- Manual smoke test (`CLAUDE.md`'s step 8, via `claude-in-chrome`): start both dev servers, hit `riverside.localhost:5173` (or whichever club is seeded), go through "find your club" → `/login` → real Keycloak login with the `cricketlegend` realm's admin user → confirm landing on `/admin` showing the identity. Then repeat starting from a *different* seeded club to confirm the selected club has no bearing on the outcome (spec's acceptance criteria).
- `cd ui && npm run test:e2e` locally (not CI) once a `platform_admin` test user exists in the local realm — confirms `admin-login.spec.ts` passes end-to-end.
