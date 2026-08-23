# 020 — Club Manager Access

**Depends on:** `006-post-login-home-shells.md` (`ManagerHome`/`GridNavShell`/`EmptyState`, and its own Non-goal — "no real backend-verified role gate" for the Manager shell — that this spec resolves), `012-club-profile.md` (`ClubProfile` entity/service/DTO, `ClubForm`, `AddressFields`, `MediaUpload`, and its own "designed for club-admin self-service, not built for it" deferral), `015-person-status-and-role-assignment.md` (`RoleAssignment`, `RoleAssignmentRole.CLUB_ADMIN`, `AccessService.canAdministerClub`), `016-keycloak-account-provisioning.md` (`SubscriptionServiceImpl.create()` auto-granting `CLUB_ADMIN`, `MeServiceImpl`/`MeAccessDto.clubAdminClubIds`, `PostLoginRedirect.tsx`).
**Status:** draft.

## Problem & Goals

A Subscription's responsible person already gets a real Keycloak account and a real `CLUB_ADMIN` `RoleAssignment` for their club, automatically, on Subscription creation (`016`). Nothing they can actually do with it exists yet. `SecurityConfig` gates the entire `/api/v1/platform/**` prefix at `hasRole("platform_admin")` before any method-level `@PreAuthorize` runs, so `ClubProfileController.upsert`'s existing scope-shaped `@PreAuthorize("@access.canAdministerClub(...)")` (written in `012` specifically so a club admin could use it later) is unreachable dead code for anyone but a platform admin — and `GET /profile` has no method-level check at all, relying solely on that URL gate. On the frontend, `ManagerHome.tsx` (`006`) is still a 100% visual placeholder: a hardcoded `MOCK_MANAGER` user, no auth guard of any kind, and every nav card renders `EmptyState`, even though `/api/v1/me/activate` (`016`) already returns exactly the `clubAdminClubIds` needed to gate it for real.

This spec closes that gap for one concrete slice — the club's own profile — and, in doing so, builds the general-purpose access pattern (a new authenticated-but-not-platform_admin URL namespace, a real `ManagerHome` route guard, a `clubId` resolved from a verified grant rather than a mock) that the next two specs (Club Contacts, Sponsors — both already named, unscoped, in `docs/roadmap.md` under `003`'s section) build directly on top of, instead of each solving access from scratch.

**Goals**
- A person holding a `CLUB_ADMIN` `RoleAssignment` for club X can reach a real, backend-verified `/manage` shell and view/edit club X's `ClubProfile` (org type, logo, banner, address, email, phone, website) — the same fields a platform admin already edits via `012`, without needing `platform_admin`.
- That access is enforced twice, independently: a new `/api/v1/manage/**` URL namespace open to any authenticated caller, plus the existing `@access.canAdministerClub` scope check per endpoint — not a bare role check, and not reachable by a `CLUB_ADMIN` of a *different* club.
- `ManagerHome` stops rendering for anyone: it resolves the caller's real `clubAdminClubIds` and shows "Not authorized" (mirroring `AdminHome`'s existing pattern) if that list is empty and the caller isn't a platform admin.
- The existing `/api/v1/platform/**` surface (Subscriptions, Products, Club CRUD/create, Leads, and `ClubProfile`'s own platform-admin-facing endpoints) is completely untouched — this is additive, not a reclassification.

## Non-goals

- **Editing a club's name or slug from `/manage`.** Slug changes affect subdomain routing and are part of `003`'s vendor-assisted onboarding process — they stay `platform_admin`-only via `/admin/onboarding`, unchanged. The `/manage` profile screen exposes only the `ClubProfile` fields `012` added (type, contact, address, branding), never `Club.name`/`Club.slug`.
- **Suspend/Reactivate from `/manage`.** `010`'s club lifecycle actions are a platform/billing-level decision, not something a club admin self-serves. Untouched, `platform_admin`-only.
- **Any grant/revoke `RoleAssignment` UI, or inviting additional per-club users.** The one `CLUB_ADMIN` grant a Subscription's responsible person already gets (`016`) is the only real persona this spec builds for. Multi-user-per-club, an `Invitation` entity (`003`'s own still-unbuilt scope), and a general permission-management screen are deliberately deferred — no second real consumer exists yet to design against, and building it now would be designing ahead of `001`'s still-missing `Section`/`Team` model that a real permission story needs anyway.
- **`MANAGER`/`PLAYER`-role screens, or `SECTION`/`TEAM`-scoped permission resolution.** Both stay exactly as unbuilt as `docs/roadmap.md`'s "Blocked on the full tenancy model" section already describes — unrelated to this spec, which only ever checks `CLUB_ADMIN` at `CLUB` scope (the one branch `AccessService.canAdministerClub` already implements).
- **A club-switcher UI.** `016` only ever grants one `CLUB_ADMIN` `RoleAssignment`, on Subscription creation, for one club — a person administering more than one club isn't a real case yet. `ManagerHome` resolves `clubAdminClubIds[0]` directly; a real multi-club UI is future work if that ever becomes a real case.
- **Any other `/manage` nav card** (Sections, Teams, Players, Fixtures & Results, Team Managers & Permissions, Squads, Communication, Availability Polls). All stay exactly the `EmptyState` placeholders `006` shipped — this spec adds exactly one new card, Club Profile, and leaves the rest alone.
- **Reclassifying any existing `/api/v1/platform/**` endpoint's security gate.** Discussed and deliberately rejected during this epic's planning in favour of the additive `/api/v1/manage/**` namespace below — see Rollout Notes.

## User Stories

- As a club admin (a Subscription's responsible person, auto-granted `CLUB_ADMIN` via `016`), logging in lands me on `/manage` with my own identity shown, instead of a shell built for a mock user.
- As a club admin, I can open "Club Profile" from my dashboard and view/edit my club's organisation type, logo, banner, address, email, phone, and website — the same fields a platform admin already manages for me via `012`, without ever needing platform-admin access.
- As a club admin, refreshing or bookmarking `/manage` keeps me signed in, the same way `/admin` already survives a refresh.
- As a club admin for club X, I cannot read or write club Y's profile, even by guessing its id in the URL — enforced server-side, not just hidden client-side.
- As someone authenticated but holding neither `platform_admin` nor any `CLUB_ADMIN` grant, navigating to `/manage` shows "Not authorized," not a broken or empty shell.
- As a platform admin, my own `/admin/onboarding` club editing (name, slug, suspend/reactivate, and the full profile) is completely unchanged by this spec.

## Data Model Changes

None. Reuses `RoleAssignment`/`RoleAssignmentRole.CLUB_ADMIN` (`015`), `Person` (`014`), and `ClubProfile`/`ClubProfileService`/`ClubProfileDto` (`012`) exactly as they exist today. No migration.

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{id}/profile` | `@PreAuthorize("@access.canAdministerClub(authentication, #id)")` | Club admin fetches their own club's profile — same read shape and same "empty default rather than 404" behaviour as `012`'s existing platform-facing `GET`, on the new namespace, with a real method-level check (the platform version's `GET` relies solely on the URL gate; this one can't, since `/manage/**` isn't role-gated at the URL level) |
| `PUT /api/v1/manage/clubs/{id}/profile` | `@PreAuthorize("@access.canAdministerClub(authentication, #id)")` | Club admin upserts their own club's profile — identical request/response shape and validation to `012`'s existing `PUT`, delegating to the same `ClubProfileService.upsert` |

Both live on `ClubProfileController` (`012`) as a second pair of mappings alongside its existing `/api/v1/platform/clubs/{id}/profile` `GET`/`PUT` — same service call, same DTO, no duplicated logic. No new controller, no new service.

`GET /api/v1/platform/clubs/{id}/profile` and `PUT /api/v1/platform/clubs/{id}/profile` (`012`) are unchanged. `POST /api/v1/me/activate` (`016`) is unchanged — this spec is its first real UI consumer beyond `PostLoginRedirect`.

**`SecurityConfig` change:** add `.requestMatchers("/api/v1/manage/**").authenticated()` alongside the existing `.requestMatchers("/api/v1/platform/**").hasRole("platform_admin")` line. Any authenticated caller can reach the URL; `@access.canAdministerClub` is what actually decides whether the request succeeds, per endpoint — matching this codebase's existing precedent (`docs/standards/backend.md`'s Authorization section) of resolving club-scoped permission through the `RoleAssignment` model rather than a flat role.

## UI Requirements

Composes entirely from existing components (`006`'s `GridNavShell`/`EmptyState`, `012`'s `ClubForm`/`AddressFields`/`PhoneInput`/`WebsiteInput`/`MediaUpload`) plus one small, targeted extension to `ClubForm`:

- **`ui/src/api/clubApi.ts`** — add `getManagedClubProfile`/`updateManagedClubProfile`, thin wrappers hitting `/manage/clubs/{id}/profile` instead of `/platform/clubs/{id}/profile`, same request/response types (`ClubProfile`/`ClubProfilePayload`) as the existing pair.
- **`ui/src/components/ClubForm/ClubForm.tsx`** — grows an optional `mode?: 'full' | 'profileOnly'` prop (default `'full'`, so every existing `platform_admin` call site is unaffected). `profileOnly` hides the Basic Info tab (name/slug) entirely, drops `name`/`slug` from validation, and `onSubmit` receives only `{ profile }` — no `club` payload. A near-miss extended with a prop, per `docs/standards/frontend.md`'s reuse rule, not a new component; `ClubForm`'s existing "Save the club first" gating logic doesn't apply in this mode since a `/manage` caller's club always already exists.
- **`ui/src/pages/manage/ManageClubProfilePage.tsx`** (new) — reads `clubId` from `ManagerHome`'s new `Outlet` context (below), fetches via `getManagedClubProfile`, renders `RecordFormScreen` + `ClubForm` in `profileOnly` mode, saves via `updateManagedClubProfile`. Mirrors `ClubFormPage.tsx`'s loading/error-state shape (`isLoading`/`isError` → `null`/`EmptyState`) rather than inventing a new one.
- **`ui/src/pages/manage/ManagerHome.tsx`** — replaces `MOCK_MANAGER` and the missing auth check:
  - `useQuery({ queryKey: ['me', 'activate'], queryFn: activateSession })` — same query key `PostLoginRedirect` already uses, so a fresh login's cached result is reused rather than double-fetched; a direct navigation/refresh/bookmark fetches fresh.
  - If the query errors, or resolves with `clubAdminClubIds.length === 0` and `platformAdmin === false`: render the same `EmptyState title="Not authorized"` pattern `AdminHome.tsx` already uses for its own unauthorized case — not a second, differently-worded copy.
  - Otherwise, render `GridNavShell` as today, with the displayed `user` (`name`/`email`) read from `keycloak.tokenParsed` (already-parsed JWT claims, available client-side once `keycloak.init()` resolves) rather than a new backend field — this is cosmetic display only, not an authorization decision; the actual gate above is entirely server-verified via `clubAdminClubIds`. `MeAccessDto` is not extended.
  - Passes `{ clubId: data.clubAdminClubIds[0] }` via `<Outlet context={...} />`, the same context-threading precedent `AdminHome.tsx` already uses.
- **`ui/src/pages/manage/ManagerDashboard.tsx`** — add one new card to the existing `'Club manager'` group: `{ title: 'Club Profile', description: "Edit your club's details", to: '/manage/club-profile' }`. No change to the `'Team manager'` group or any other existing card.
- **`ui/src/App.tsx`** — add `<Route path="club-profile" element={<ManageClubProfilePage />} />` under the existing `/manage` route. (Deliberately not `/manage/profile` — that path is already the personal-avatar-profile placeholder from `006`; reusing it here would collide.)
- **`ui/src/auth/keycloak.ts`** — add `'/manage'` to `AUTH_AWARE_PATH_PREFIXES` (currently `['/admin']` only). Without this, `check-sso` never runs on a direct load of `/manage`, so a page refresh there silently loses the in-memory Keycloak session — the exact class of bug this file's own comments describe already being fixed for `/admin`, not yet extended to `/manage` because nothing on `/manage` needed a real session until now.

## Test Plan

| Tier | Coverage |
|---|---|
| Integration | `ClubProfileControllerTest` (or equivalent, Testcontainers-backed) extended: a JWT resolving to a `Person` with a `CLUB_ADMIN` `RoleAssignment` for club X can `GET`/`PUT` `/api/v1/manage/clubs/X/profile` and gets `403` for club Y; a JWT with neither `platform_admin` nor any matching `CLUB_ADMIN` grant gets `403` from `/api/v1/manage/**`; a regression check that `/api/v1/platform/**` still rejects a non-`platform_admin` caller unchanged. |
| Unit | None new in the service layer — both new mappings delegate to `ClubProfileService`, already covered by `012`'s tests; `AccessService.canAdministerClub` is already unit-tested by `015`, unchanged here. |
| Contract | The two new `/manage` endpoints + unchanged `/platform` ones documented in the checked-in OpenAPI schema. |
| Component | `ClubForm.test.tsx` extended — `mode="profileOnly"` renders no Basic Info tab and submits `{ profile }` only; `ManagerHome.test.tsx` extended — renders "Not authorized" `EmptyState` when `clubAdminClubIds` is empty and not a platform admin, renders `GridNavShell` with the real (non-mock) user otherwise; `ManageClubProfilePage.test.tsx` (new) — loading/error/loaded states, same shape as `ClubFormPage.test.tsx`. |
| E2E | Extend the existing Playwright golden path: log in as a `CLUB_ADMIN`-provisioned test user (reusing `016`'s seeded fixture), land on `/manage` (not "Not authorized"), open Club Profile, edit a field, save, reload, confirm it persisted; separately, a direct page refresh on `/manage` keeps the session (verifies the `keycloak.ts` fix) instead of dropping to a logged-out state. Not wired into CI, same precedent as `005`/`008`–`012`. |

## Acceptance Criteria

- A person with a `CLUB_ADMIN` `RoleAssignment` for club X can `GET`/`PUT` `/api/v1/manage/clubs/X/profile`; the same person gets `403` for a different club's id.
- A person with neither `platform_admin` nor any `CLUB_ADMIN` grant gets `403` from `/api/v1/manage/**` and sees "Not authorized" when navigating to `/manage`.
- `/api/v1/platform/**` continues to reject any non-`platform_admin` caller exactly as it does today — verifiable by an unchanged/still-passing existing test, not just by reading the diff.
- `ManagerHome` no longer renders `MOCK_MANAGER` under any code path — the displayed identity always reflects the real authenticated caller.
- A club admin can view and edit their own club's profile fields (org type, contact, address, logo, banner) end to end through `/manage/club-profile`, with no name/slug field present anywhere on that screen.
- A direct browser refresh on `/manage` restores the session rather than requiring a fresh login, matching `/admin`'s existing behaviour.

## Rollout Notes

- Ships as its own PR, independent of any in-flight work, extending `006`'s and `012`'s already-merged code.
- **This is the access pattern the next two specs build on, not a one-off.** Club Contacts and Sponsors (`docs/roadmap.md`, named under `003`'s section, not yet written) should each add their own `/api/v1/manage/**` mappings and `@PreAuthorize("@access.canAdministerClub(...)")` checks the same way `ClubProfileController` does here, and their own `/manage` screens should read `clubId` from the same `Outlet` context `ManagerHome` now provides — neither should re-derive a club admin's identity or re-solve the URL-namespace question from scratch.
- **Resolves `012`'s "designed for club-admin self-service, not built for it" deferral** for the Club Profile screen/endpoint specifically. `012`'s other Non-goals (local-disk media storage, address validation depth, hard delete) are untouched.
- **Resolves `006`'s "no real backend-verified role gate" Non-goal** for the Manager shell specifically — the System Admin gate (`005`) was already real; this makes the Manager gate real too, on the strength of `015`/`016`'s already-built `RoleAssignment`/provisioning work. The Player shell is untouched and stays exactly as unguarded as `006` left it — no `PLAYER`-role consumer exists yet to gate against.
- A human should update `docs/roadmap.md` once this ships: mark the "a real backend-verified route guard on `/manage`" bullet (under "Blocked on the full tenancy model") resolved, and add this spec as the next entry under `003-club-onboarding.md`'s section, ahead of the still-unwritten Club Contacts and Sponsors specs.
- **Full role/permission management — inviting additional per-club users, a grant/revoke `RoleAssignment` UI, an `Invitation` entity — stays deliberately out of scope and unscheduled**, not because it's forgotten but because no second real persona needs it yet (decided explicitly during this epic's planning, not just a roadmap carry-over). Revisit once a real "second user at the same club" need shows up, likely alongside `001`'s `Section`/`Team` model landing.
- **E2E prerequisite (`ui/e2e/manager-club-profile.spec.ts`):** unlike `005`'s `platform_admin` E2E fixture, this repo has no seeded default `CLUB_ADMIN` account, so `E2E_CLUB_ADMIN_USERNAME`/`E2E_CLUB_ADMIN_PASSWORD`/`E2E_CLUB_ADMIN_CLUB_ID` have no fallback and must be provisioned manually before that spec can run, same as `admin-login.spec.ts`'s own out-of-band `platform_admin` user. Two ways to get there: (1) drive the real Subscription-creation flow (`/admin/billing`) for a known `ACTIVE` club with a real responsible-person email — `016`'s `SubscriptionServiceImpl.create()` auto-provisions both the Keycloak user and the matching `CLUB_ADMIN` `RoleAssignment` end to end, then set the Keycloak password via the console or "forgot password" flow; or (2) provision directly — create a Keycloak user in the `cricketlegend` realm via the console, then manually insert/confirm a matching `Person(keycloakUserId = ...)` row and a `RoleAssignment(role = CLUB_ADMIN, scopeType = CLUB, scopeId = <a known Club's id>)` row against the local `cricketlegend_platform` database. Either way, the resulting username/password/club id feed the three env vars above.
