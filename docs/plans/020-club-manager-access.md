# Plan: 020 — Club Manager Access

## Context

`docs/specs/020-club-manager-access.md` (approved) closes the gap between "a club admin already has a real `CLUB_ADMIN` `RoleAssignment`" (auto-granted by `016` on Subscription creation) and "nothing they can do with it" — `SecurityConfig` gates the entire `/api/v1/platform/**` prefix at `hasRole("platform_admin")` before any method-level `@PreAuthorize` runs, so `ClubProfileController`'s existing scope-shaped check is unreachable for a `CLUB_ADMIN`, and `ManagerHome.tsx` is still a 100% mock placeholder from `006`. This plan adds an additive `/api/v1/manage/**` namespace, wires a real route guard into `ManagerHome`, and gives a club admin a working Club Profile screen — reusing `012`'s `ClubProfile` entity/service/DTO and `ClubForm` unchanged in shape, extended with a `mode` prop. It is the foundation the next two specs (Club Contacts, Sponsors) build directly on top of.

Everything below reuses existing services/components as-is; no new entity, no migration, no new controller or service class.

## Backend changes

**1. `backend/src/main/java/com/cricketlegend/config/SecurityConfig.java`**
Add one line to `filterChain()`'s `authorizeHttpRequests`, directly after the existing `/api/v1/platform/**` matcher and before `.anyRequest().authenticated()`:
```java
.requestMatchers("/api/v1/manage/**").authenticated()
```
No other change — `/api/v1/platform/**` stays `hasRole("platform_admin")`, untouched.

**2. `backend/src/main/java/com/cricketlegend/controller/ClubProfileController.java`**
Add two new mappings, both delegating to the existing `clubProfileService` (no interface/impl change), both with a real `@PreAuthorize` (the platform `GET` today has none — relies solely on the URL gate, which `/manage/**` doesn't provide):
```java
@PreAuthorize("@access.canAdministerClub(authentication, #id)")
@GetMapping("/api/v1/manage/clubs/{id}/profile")
public ResponseEntity<ClubProfileDto> getManaged(@PathVariable UUID id) {
    return ResponseEntity.ok(clubProfileService.get(id));
}

@PreAuthorize("@access.canAdministerClub(authentication, #id)")
@PutMapping("/api/v1/manage/clubs/{id}/profile")
public ResponseEntity<ClubProfileDto> upsertManaged(@PathVariable UUID id, @Valid @RequestBody UpdateClubProfileRequest request) {
    return ResponseEntity.ok(clubProfileService.upsert(id, request));
}
```
`ClubProfileService`/`ClubProfileServiceImpl`/`ClubProfileDto`/`UpdateClubProfileRequest` are unchanged.

**3. Regenerate the checked-in OpenAPI schema** (`backend/openapi/openapi.yaml`) — this repo has no generation tooling or CI contract-diff (confirmed absent); the established manual process (used by every prior plan, e.g. `012`, `014`) is: run the backend locally, `curl http://localhost:8082/v3/api-docs.yaml`, splice the two new `/manage/clubs/{id}/profile` paths (same schema refs as the existing `/platform` pair) into the checked-in file, commit.

**Assigned to:** `backend-builder`.

## Backend tests (`test-writer`, after backend-builder)

Extend `backend/src/test/java/com/cricketlegend/controller/ClubProfileControllerIntegrationTest.java` (existing `@SpringBootTest @AutoConfigureMockMvc @Import(AbstractIntegrationTest.class) @Transactional` class) with real end-to-end `CLUB_ADMIN` cases — this is new coverage, no existing test does this today:

- Add `withSubject(String subject)` to `backend/src/test/java/com/cricketlegend/PlatformRoleJwtPostProcessors.java` — a JWT postprocessor that sets only `.subject(subject)`, no realm-role authority (mirrors `withRole`'s shape but for a caller whose authorization comes entirely from a DB-resolved `RoleAssignment`, not a JWT claim).
- New test cases, following `RoleAssignmentRepositoryTest`'s existing pattern for creating real rows: save a `Person(keycloakUserId = "<test-subject>")` via `PersonRepository`, save a `RoleAssignment(role=CLUB_ADMIN, scopeType=CLUB, scopeId=<clubX.id>)` via `RoleAssignmentRepository`, then:
  - `GET`/`PUT /api/v1/manage/clubs/{clubX.id}/profile` with `.with(withSubject("<test-subject>"))` → `200`.
  - `GET`/`PUT /api/v1/manage/clubs/{clubY.id}/profile` (a second, unrelated club) with the same subject → `403`.
  - `GET`/`PUT /api/v1/manage/clubs/{clubX.id}/profile` with `.with(withSubject("<unknown-subject>"))` (no matching `Person`/`RoleAssignment` at all) → `403`.
- Confirm (not necessarily new test) that the existing `/platform/clubs/{id}/profile` cases using `.with(withRole("someone_else", ...))` still assert `403` unchanged — this is the "platform namespace untouched" regression check the spec's Test Plan calls for; only add a new one if that path isn't already covered.

## Frontend changes (`frontend-builder`)

**4. `ui/src/api/clubApi.ts`** — add, mirroring the existing `getClubProfile`/`updateClubProfile` pair exactly, same `ClubProfile`/`ClubProfilePayload` types, different path:
```ts
getManagedClubProfile(id: string): Promise<ClubProfile>   // GET /manage/clubs/{id}/profile
updateManagedClubProfile(id: string, payload: ClubProfilePayload): Promise<ClubProfile> // PUT /manage/clubs/{id}/profile
```

**5. `ui/src/components/ClubForm/ClubForm.tsx`** — add `mode?: 'full' | 'profileOnly'` (default `'full''`, so every existing call site/test is unaffected — this must reproduce today's behavior byte-for-byte in `'full'` mode). Concrete changes:
- `const showBasicInfo = mode !== 'profileOnly'`.
- Tab list: `'profileOnly'` renders only Contact/Address/Branding (no Basic Info tab, no `ClubNameSlugFields`) — always enabled (no "Save the club first" disabled/tooltip state, since a `/manage` caller's club always already exists).
- `FIELD_TAB` becomes mode-aware: in `'profileOnly'`, `email`/`website` map to tab `0` (not `1`), and `name`/`slug` keys don't exist at all.
- `validate()` skips `name`/`slug` checks entirely when `!showBasicInfo`.
- `handleSubmit`: only build/include the `club` key when `showBasicInfo`. Widen `onSubmit`'s type to `{ club?: ClubPayload; profile?: ClubProfilePayload }` (widening, not narrowing — every existing `'full'`-mode caller still always receives `club`).
- **Flag:** `ClubFormPage.tsx`'s `saveMutation` destructures `{ club: clubPayload, profile: profilePayload }` and calls `createClub(clubPayload)`/`updateClub(clubPayload)`, which need a non-optional `ClubPayload`. Since `ClubFormPage` only ever uses default `'full'` mode, `club` is always actually present there — add a `clubPayload as ClubPayload` (or equivalent narrow) at that one call site rather than restructuring the type further. Minimal, contained fix, not a redesign.
- All 19 existing `ClubForm.test.tsx` cases must keep passing unmodified (verifies `'full'` mode is unchanged).

**6. `ui/src/utils/errorDetail.ts`** (new, small extraction) — pull `ClubFormPage.tsx`'s local `errorDetail(error, fallback)` helper (RFC 7807 `ProblemDetail` → `.detail`, else fallback) into a shared util, since `ManageClubProfilePage.tsx` (below) needs the identical logic — a genuine second use, per `CLAUDE.md`'s "reuse before you write." Update `ClubFormPage.tsx` to import it instead of defining it locally.

**7. `ui/src/pages/manage/ManagerHome.tsx`** — replace `MOCK_MANAGER` and add the real guard:
- `useQuery({ queryKey: ['me', 'activate'], queryFn: activateSession })` — same query key `PostLoginRedirect.tsx` already uses (cache-shared on a fresh login; refetches fresh on a direct nav/refresh to `/manage`).
- Not-authorized when `isError`, or when `data` resolves with `!data.platformAdmin && data.clubAdminClubIds.length === 0` — render the same `EmptyState title="Not authorized"` pattern `AdminHome.tsx` uses (centered `Box`, same component), description text along the lines of "You are not recognized as a club manager."
- Otherwise render `GridNavShell` as today. Displayed `user` (`name`/`email`) comes from `keycloak.tokenParsed` (already-parsed JWT claims, available once `keycloak.init()` resolves) — cosmetic display only, not an authorization decision; `MeAccessDto` is not extended. Keep `brand="Cricket Legend Platform"` (matching `AdminHome`'s own brand text) rather than fetching the real club name — a club admin can't reach `GET /platform/clubs/{id}` (platform-admin-gated), and `ClubProfile` doesn't carry `Club.name`; fetching it is out of scope for this spec.
- Pass `{ clubId: data.clubAdminClubIds[0] }` via `<Outlet context={...} />`, same precedent `AdminHome.tsx` already uses for `data`.
- Edge case: a `platform_admin` navigating directly to `/manage` with zero `CLUB_ADMIN` grants is not blocked (matches the spec's literal guard condition), but `clubId` would then be `undefined`. Guarded defensively in `ManageClubProfilePage` (below), not here — `ManagerHome` itself doesn't need special-case logic for this.

**8. `ui/src/pages/manage/ManagerDashboard.tsx`** — add one card to the existing `'Club manager'` group: `{ title: 'Club Profile', description: "Edit your club's details", to: '/manage/club-profile' }`. No other card changes.

**9. `ui/src/pages/manage/ManageClubProfilePage.tsx`** (new) — mirrors `ClubFormPage.tsx`'s loading/error/loaded shape (`isLoading` → `null`, `isError` → `EmptyState`), but simpler (one query, one mutation, no lifecycle actions):
- `const { clubId } = useOutletContext<{ clubId?: string }>()` — if `clubId` is falsy, render `EmptyState title="Not authorized"` (handles the platform-admin-with-no-grant edge case above without crashing on `getManagedClubProfile(undefined)`).
- `useQuery(['managed-club', clubId, 'profile'], () => getManagedClubProfile(clubId!), { enabled: Boolean(clubId) })`.
- `useMutation` calling `updateManagedClubProfile`, invalidating that query key on success.
- Renders `RecordFormScreen` (`backTo="/manage"`, `backLabel="Back to Dashboard"`) + `<ClubForm mode="profileOnly" profileInitialValues={...} onSubmit={(values) => values.profile && saveMutation.mutate(values.profile)} />`, using the new shared `errorDetail` util for the save-error message, same action-bar shape as `ClubFormPage.tsx` (Save button targeting `CLUB_FORM_ID`, minus the Cancel/Suspend/Reactivate buttons — those aren't club-admin actions).

**10. `ui/src/App.tsx`** — add `<Route path="club-profile" element={<ManageClubProfilePage />} />` under the existing `/manage` route (deliberately not `/manage/profile`, already the personal-avatar-profile placeholder).

**11. `ui/src/auth/keycloak.ts`** — `AUTH_AWARE_PATH_PREFIXES = ['/admin', '/manage']` (currently `['/admin']` only). Without this, `check-sso` never runs on a direct load of `/manage`, so a refresh there silently drops the in-memory Keycloak session — same class of bug already fixed for `/admin`.

## Frontend tests (`test-writer`, after frontend-builder)

- `ClubForm.test.tsx` — extend with `mode="profileOnly"` cases: no Basic Info tab rendered, no name/slug validation triggered, `onSubmit` receives `{ profile }` only (no `club` key). All 19 existing cases must still pass unmodified.
- `ManagerHome.test.tsx` (new) — model on `AdminHome.test.tsx`'s structure but mock `meApi.activateSession` (per `PostLoginRedirect.test.tsx`'s existing `meAccess(overrides)` factory pattern), not `adminApi`. Cases: `isError` → "Not authorized"; `platformAdmin: false, clubAdminClubIds: []` → "Not authorized"; a real grant → renders `GridNavShell`, not the old mock user; `Outlet` receives `{ clubId }` in context.
- `ManageClubProfilePage.test.tsx` (new) — model on `ClubFormPage.test.tsx`'s mock-every-export-individually + `renderPage`-with-nested-routes structure, but needs a route wrapper that supplies `Outlet` context for `clubId`. Cases: no `clubId` → "Not authorized"; loading → nothing renders; error → `EmptyState`; loaded → prefilled `ClubForm` in `profileOnly` mode; submit → calls `updateManagedClubProfile`.
- `ManagerDashboard.test.tsx` — check whether this file exists; if so add a case asserting the new "Club Profile" card renders and links to `/manage/club-profile`; if it doesn't exist, this is a pre-existing gap, not blocking for this spec.
- Backend `ClubProfileControllerIntegrationTest` cases — covered above under Backend tests.

## E2E (`test-writer` or `frontend-builder`, decided with the user)

Per the user's decision: mirror `ui/e2e/admin-login.spec.ts`'s existing manually-provisioned-account pattern exactly (the only e2e-login precedent in this repo) rather than automating full Keycloak provisioning or skipping this tier.

- New `ui/e2e/manager-club-profile.spec.ts`, `test.skip(!!process.env.CI, ...)` matching every other Keycloak-dependent e2e spec here.
- Document a `PREREQUISITE` comment block (same shape as `admin-login.spec.ts`'s) describing the manual one-time setup: a `Club` + `ClubProfile` row, a `Person` linked to a real Keycloak user via a completed `016`-style provisioning flow (or a directly-created Keycloak user + matching `Person.keycloakUserId` + `RoleAssignment(CLUB_ADMIN, CLUB, <that club's id>)`), read from new env vars `E2E_CLUB_ADMIN_USERNAME` / `E2E_CLUB_ADMIN_PASSWORD` / `E2E_CLUB_ADMIN_CLUB_ID`.
- Golden path: log in as that user (same real-Keycloak-redirect flow `admin-login.spec.ts` already exercises) → land on `/manage` (not "Not authorized") → open Club Profile → edit a field → save → reload → confirm it persisted.
- Separately, a direct page load/refresh on `/manage` (already logged in) keeps the session — verifies the `keycloak.ts` `AUTH_AWARE_PATH_PREFIXES` fix.
- Record the exact manual setup steps in spec `020`'s Rollout Notes (a follow-up doc edit, not code) so the prerequisite is discoverable the next time this test needs to run, same as `admin-login.spec.ts`'s own `PREREQUISITE` comment already is.

## Verification

- Backend: `./mvnw verify` (unit + Testcontainers integration + ArchUnit) from `backend/`.
- Frontend: `npm run lint && npm run test && npm run build` from `ui/`.
- Manual smoke test (per `CLAUDE.md`'s UI-change rule, `claude-in-chrome`): start both dev servers, log in as a real `CLUB_ADMIN`-provisioned user (or a manually-inserted `Person`+`RoleAssignment` row against local Postgres if no real Keycloak account is set up yet), confirm landing on `/manage` shows the real identity (not "Sam Manager"), open Club Profile, edit and save a field, reload, confirm it persisted; separately confirm a caller with no grant sees "Not authorized"; separately confirm `/admin/onboarding`'s existing platform-admin club editing (name/slug/suspend/reactivate/profile) is completely unaffected.
- OpenAPI: after backend changes, regenerate and diff `backend/openapi/openapi.yaml` as described above.

## Order of work

1. `backend-builder`: `SecurityConfig.java`, `ClubProfileController.java`, regenerate `openapi.yaml`.
2. `frontend-builder`: `clubApi.ts`, `ClubForm.tsx`, `errorDetail.ts` extraction (+ `ClubFormPage.tsx` update), `ManagerHome.tsx`, `ManagerDashboard.tsx`, `ManageClubProfilePage.tsx`, `App.tsx`, `keycloak.ts`.
3. `test-writer`: backend integration test cases + `PlatformRoleJwtPostProcessors.withSubject`, frontend component test cases, new e2e spec + `020`'s Rollout Notes update documenting the manual prerequisite.
4. Manual smoke test, then `standards-reviewer` before PR, per `docs/workflow.md`.
