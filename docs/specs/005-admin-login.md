# 005 — Admin Login

**Depends on:** `002-realm-subdomain-auth.md` (Keycloak login sequence, the flat `platform_admin` realm role as the documented exception to scope-walk authorization), `004-landing-page.md` (the root-domain landing page and its already-built "find your club" selection step, `ui/src/auth/keycloak.ts` scaffold).
**Status:** draft.

## Problem & Goals

`004-landing-page.md` built the root domain's "find your club" step — search for a club, select it, get redirected to `{slug}.{rootDomain}/login` — but that per-club `/login` route was explicitly left for a later spec to build, and `ui/src/auth/keycloak.ts` was scaffolded but never wired into the app. Nothing in the codebase actually calls Keycloak yet. Before building out full club-member login (which needs `001`'s `RoleAssignment`/`Section`/`Team` model, none of which exists in code today — see `004`'s implementation-time addendum), this spec wires up the simplest real login path: a platform admin, whose access doesn't depend on any club-scoped data at all, just the flat `platform_admin` realm role `002` already documents as its one deliberate exception to scope-walk authorization.

**Goals**
- A platform admin can complete a real Keycloak login from the root landing page's existing club-selection step, ending on a page that confirms they're recognized as an admin.
- The club selected before login has no bearing on the outcome for an admin — only the `platform_admin` realm role matters.
- The backend independently verifies the `platform_admin` role on every request to the admin identification page — the frontend never trusts a decoded token by itself.
- Admin users are provisioned entirely in Keycloak, out of band — this spec adds no endpoint, form, or UI path that creates, promotes, or configures a `platform_admin` user.

## Non-goals

- **Non-admin (club member) login.** Resolving a person's `RoleAssignment`s, calling a `/me/access`-style endpoint, or rendering club-scoped content after login is `001`/`002`'s full model — not built yet, per `004`'s addendum. This spec only proves the admin path works; a real club member reaching the same `/login` route gets a clear rejection (see Acceptance Criteria), not a real member experience.
- **Admin user management.** No endpoint or screen anywhere in the app creates, edits, deletes, or grants the `platform_admin` role. That stays a Keycloak-console operation performed by the vendor directly — deliberately never exposed to the application, per the request that motivated this spec.
- **Provisioning a `Person` row for the admin.** The admin identification page reads identity straight off the verified JWT (subject, username, email) — it does not look up or create a `Person` row by `keycloak_user_id`. `Person`↔Keycloak auto-provisioning is `001`/`002`'s to define later if a feature actually needs it.
- **Redesigning the "find your club" step.** `004`'s search-and-select UX stays exactly as built. This spec only wires up what happens once a club is chosen and Keycloak login completes.
- **Real admin functionality.** The post-login page is a placeholder that identifies the user as an admin — dashboards, club management, lead review UI (`004`'s `GET /api/v1/platform/leads` already exists as an API but has no admin screen yet) come from later specs.
- **Logout / session management beyond what's needed to prove login works.** No "remember me," idle timeout, or multi-tab session sync.
- **Verifying `002`'s ADR-03 wildcard redirect URI in production.** Still an open item on `002` itself; this spec exercises the login flow against local dev Keycloak (`auth.localhost:8180`) only.

## User Stories

- As a platform admin, I can select any club on the root landing page's "find your club" step and be taken to a real Keycloak login form, so I can authenticate with my admin credentials.
- As a platform admin, after I log in successfully, I land on a page that confirms I'm recognized as an admin — regardless of which club I selected before logging in.
- As a platform admin, that confirmation is backed by a real API call the backend gates on my `platform_admin` role, so a stale or tampered client-side token can't fake the admin page.
- As someone who authenticates through this flow without the `platform_admin` role, I see a clear "not authorized" state instead of the admin page, a crash, or a silent redirect loop.

## Data Model Changes

None. This spec adds no entity and no migration. It reads the already-verified JWT's claims (subject, `preferred_username`, `email`) directly — no lookup against the `person` table (`004`'s prerequisite stub) is introduced.

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/platform/me` | `platform_admin` (reuses `SecurityConfig`'s existing `hasRole("platform_admin")` match on `/api/v1/platform/**` — no `SecurityConfig` change needed) | Returns the authenticated admin's identity straight from the verified JWT: `{keycloakUserId, username, email}`. A 200 response is the frontend's sole signal that the current session is a recognized admin; a 401/403 (Spring Security's standard handling for an unauthenticated or under-privileged request against this path) is the signal it isn't. |

Follows `docs/standards/backend.md`'s Controller → Service → Repository skeleton with no repository layer — there's nothing to persist or query, so `AdminIdentityServiceImpl` maps the `Authentication`/`Jwt` directly to `AdminIdentityDto`. No new exception type: an unauthenticated or non-admin request never reaches the service — Spring Security's filter chain rejects it before the controller method runs, consistent with how `/api/v1/platform/leads` already behaves today.

## UI Requirements

Composed from the existing shared library (`docs/standards/design-system.md`) — no new shared component.

- **New route: `/login`**, added to every club subdomain's SPA (the route `004` anticipated but didn't build). On mount, it immediately calls `keycloak.login()` — the first real usage of `ui/src/auth/keycloak.ts`, which was scaffolded in `002` but never wired into the app until now. `FindYourClubLogin.tsx` is unchanged; its existing `goToClubLogin(slug)` redirect to `{slug}.{ROOT_DOMAIN}/login` already targets this route correctly.
- **New page: `ui/src/pages/admin/AdminHome.tsx`** (the `pages/admin/` folder already exists per `docs/standards/frontend.md`'s convention, currently just a `.gitkeep`). Keycloak's redirect after login lands here. On mount it calls `GET /api/v1/platform/me` via React Query:
  - `200` → renders a `Card` with the returned username/email and a plain "You are logged in as an admin" message. This is the entire admin experience for now, per the Non-goals above.
  - `401`/`403` → renders the existing `EmptyState` component with a "not authorized" message — no admin content is ever rendered speculatively while the request is pending or after it fails.
- No changes to `FindYourClubLogin.tsx`, `LandingPage.tsx`, or `LeadCaptureForm.tsx`.

**Mobile-first.** `AdminHome` is a single `Card` in a centered `Box`, authored at 375px first per `docs/standards/frontend.md` — nothing here needs a breakpoint.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `AdminIdentityServiceImpl` maps a `Jwt`'s claims to `AdminIdentityDto` correctly (subject/username/email extraction) |
| Integration | `GET /api/v1/platform/me` returns 200 with the expected identity for a JWT carrying `platform_admin`, and 401/403 for a JWT missing it — a Spring Security slice test against `SecurityConfig`, no Testcontainers needed since no database is touched |
| Contract | `GET /api/v1/platform/me` documented in the checked-in OpenAPI schema |
| Component | None new — `AdminHome` is a page, not a shared component, and composes existing already-tested `Card`/`EmptyState` |
| E2E | One golden path (Playwright), reusing `testing.md`'s already-named "login" golden path: against local dev Keycloak seeded with a `platform_admin` test user, select a club on the root landing page, complete Keycloak login, and assert the admin identification page renders. A second case: select a *different* club and confirm the same admin outcome, proving club selection doesn't matter |

## Acceptance Criteria

- Selecting any club on the root landing page's "find your club" step and completing Keycloak login as a `platform_admin` user lands on `AdminHome` showing that user's identity.
- The outcome is identical regardless of which club was selected before login — verified against at least two different clubs.
- `AdminHome` renders its confirmation only after `GET /api/v1/platform/me` returns 200 — never from a client-side–decoded token alone.
- A user who authenticates without the `platform_admin` role sees the "not authorized" `EmptyState`, not the admin page.
- No endpoint or screen anywhere in the app can create, promote, or configure a `platform_admin` user.

## Rollout Notes

- Requires `002`'s local dev Keycloak (`auth.localhost:8180`, `platform-dev` realm) actually running, with one seeded user carrying the `platform_admin` realm role — the first feature to depend on that environment piece existing rather than just being documented.
- Ship `GET /api/v1/platform/me` first — testable with a manually obtained token before the `/login` route or `AdminHome` exist.
- `/login` and `AdminHome` ship together; neither is useful without the other.
- This intentionally does not touch `001`'s `RoleAssignment`/`Section`/`Team` model at all — the next login-related spec to build real club-member access will need those, but nothing here blocks or assumes them.
