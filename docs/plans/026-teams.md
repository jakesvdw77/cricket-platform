# Plan — 026: Teams

## Context

`docs/specs/026-teams.md` (already drafted and read in full this session) builds the `Team` entity `001-tenancy-identity-model.md` always designed but never implemented — `id, club_id, section_id, name, active` + audit columns, sitting as a leaf under a `Section` (`025-club-structure.md`). The spec's original scope was deliberately narrow: create/rename/deactivate/reactivate a `Team` under one chosen `Section`, reached only via `SectionDetailPanel`'s new "Manage Teams" button — explicitly **no** club-wide "all teams" view, per its own Non-goals.

**Scope change surfaced and resolved during this planning pass:** `ManagerDashboard.tsx` already ships a "Teams" nav card (from `006-post-login-home-shells.md`) routing to `/manage/teams`, currently an `EmptyState` "Coming soon" placeholder — a pre-existing promise the spec's "no club-wide view" Non-goal didn't account for. Asked the user directly: they want that card repurposed into a real club-wide Teams directory — a flat `RecordCard` grid of every team across every section (each card showing which section it's under), reachable without drilling into the Club Structure org-chart. They also want that club-wide screen to support **creating** a team directly, via a section-picker dropdown on the create form (not view/edit-only).

This plan builds both the section-scoped flow the spec describes **and** this club-wide directory as one coherent feature, reusing the same backend endpoints and the same `TeamForm`/`TeamFormPage` wherever possible rather than duplicating them. **The spec itself (`026-teams.md`) needs a follow-up edit to document this addition** — its Non-goals currently say the opposite of what's being built. That edit happens first, by hand, before any builder agent starts, so the spec and the plan agree before code is written (per `docs/workflow.md` step 5's rule: a spec/reality gap gets flagged and resolved, never quietly built around).

## Step 0 — Amend `docs/specs/026-teams.md` (done directly, before any agent runs)

- **Goals**: add a bullet for the club-wide Teams directory + create-with-section-picker.
- **Non-goals**: remove/replace the "A club-wide 'all teams' view... not built here" bullet — no longer true.
- **API Contract**: add `GET /api/v1/manage/clubs/{clubId}/teams` (list every team for the club, flat, across all sections) alongside the existing five nested endpoints. No new create/update/deactivate/reactivate endpoints — the directory reuses the existing nested ones (a team row always carries its own `sectionId`, which is all a caller needs to hit them).
- **UI Requirements**: add `ui/src/pages/manage/TeamDirectory.tsx`, describe `TeamForm`'s optional section-picker mode, note `App.tsx`'s `teams` route now points at `TeamDirectory` instead of `EmptyState`, and that no `ManagerDashboard.tsx` change is needed (the existing card already points at the right path).
- **Test Plan** / **Acceptance Criteria**: extend for the new endpoint and screen.

## Backend (`backend-builder`)

Mirrors `SectionController`/`SectionServiceImpl` (nested scoping pattern) and `ClubContactServiceImpl` (plain deactivate/reactivate, **no** hard-delete branch — `Team` never hard-deletes, per spec).

**New files:**
- `backend/src/main/java/com/cricketlegend/domain/Team.java` — `id, clubId, sectionId, name, active, createdAt, updatedAt, updatedBy`; `@PrePersist`/`@PreUpdate` timestamp callbacks matching `Section.java`'s exact pattern (this codebase has no `AuditorAware`/JPA auditing anywhere — `updatedBy` stays unpopulated, same as every other entity today; not a gap `Team` needs to solve alone).
- `backend/src/main/java/com/cricketlegend/repository/TeamRepository.java` — `findByClubIdAndSectionId(UUID clubId, UUID sectionId)`, `findByClubId(UUID clubId)` (backs the new club-wide endpoint).
- `backend/src/main/java/com/cricketlegend/dto/{TeamDto,CreateTeamRequest,UpdateTeamRequest}.java` — `TeamDto` stays flat (`id, clubId, sectionId, name, active, createdAt, updatedAt, updatedBy`), no denormalized section name (the club-wide frontend screen composes this itself from the already-existing `listSections` call, same pattern `ClubStructure.tsx` already uses for sections+contacts).
- `backend/src/main/java/com/cricketlegend/mapper/TeamMapper.java` — MapStruct, matching `SectionMapper`/`ClubContactMapper` shape.
- `backend/src/main/java/com/cricketlegend/service/TeamService.java` + `service/impl/TeamServiceImpl.java`:
  - `listBySection(clubId, sectionId)`, `listByClub(clubId)`, `create(clubId, sectionId, req)`, `update(clubId, sectionId, teamId, req)`, `deactivate(clubId, sectionId, teamId)`, `reactivate(clubId, sectionId, teamId)`.
  - Two-level scoping, following `SectionServiceImpl`'s private-helper pattern exactly: `findSectionOrThrowForClub(clubId, sectionId)` (via `SectionRepository`, injected) then `findTeamOrThrowForSection(sectionId, teamId)` (via `TeamRepository`) — both throw `NotFoundException` on mismatch, same message-hides-existence-vs-cross-tenant posture as `Section`/`ClubContact`.
  - Deactivate/reactivate: exact `ClubContactServiceImpl` shape — `if (!team.isActive()) throw new InvalidStatusTransitionException(...)` / mirror for reactivate. Plain `TeamDto` return, **not** `Optional<TeamDto>` — `SectionServiceImpl`'s 200-vs-204 branch is specific to Section's hard-delete-when-empty exception and does not apply here.
- `backend/src/main/java/com/cricketlegend/controller/TeamController.java` — every method carries its own `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")` (method-level, matching `SectionController` — `/api/v1/manage/**` is only `authenticated()` at the URL level):
  | Endpoint | Purpose |
  |---|---|
  | `GET /api/v1/manage/clubs/{clubId}/teams` | club-wide flat list (new, for the directory) |
  | `GET /api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams` | section-scoped list |
  | `POST .../sections/{sectionId}/teams` | create (201) |
  | `PUT .../sections/{sectionId}/teams/{teamId}` | update `{name}` |
  | `POST .../sections/{sectionId}/teams/{teamId}/deactivate` | 409 if already inactive |
  | `POST .../sections/{sectionId}/teams/{teamId}/reactivate` | 409 if already active |
- `backend/src/main/resources/db/changelog/v1/018-add-team.sql` — exact SQL already specified in `026-teams.md`'s Data Model Changes section (creates `team` table, `ix_team_club`, `ix_team_section` indexes). Add its `<include>` line to `backend/src/main/resources/db/changelog/db.changelog-master.xml`, appended after `017-add-section.sql`'s.
- `backend/openapi/openapi.yaml` — manually splice in the six paths above + `TeamDto`/`CreateTeamRequest`/`UpdateTeamRequest` schemas, same manual regenerate-and-splice process `025`'s own plan used (run the app, `curl .../v3/api-docs.yaml`, merge by hand).

**Tests (co-written by `backend-builder`, gap-checked by `test-writer` after):**
- `backend/src/test/java/com/cricketlegend/service/TeamServiceImplTest.java` — create/update, both 409 transitions, cross-club/cross-section `NotFoundException` isolation for `sectionId` and `teamId`, `listBySection`/`listByClub`.
- `backend/src/test/java/com/cricketlegend/repository/TeamRepositoryTest.java` (Testcontainers) — migration applies, FKs behave.
- `backend/src/test/java/com/cricketlegend/controller/TeamControllerIntegrationTest.java` — real `CLUB_ADMIN` (`withSubject` + a real `Person`+`RoleAssignment` row, exact `SectionControllerIntegrationTest` pattern) success across all six endpoints for their own club, `403`/`404` for a different club, `404` for a `sectionId` belonging to a different club, `platform_admin` (`platformAdmin()` helper) superset success, both `409`s through real HTTP, and the club-wide `GET` returning teams from multiple different sections in one call.

## Frontend (`frontend-builder`, after backend)

Follows `SponsorContact`'s nested-route pattern (`sectionId` via `useParams`, not Outlet context) for the section-scoped screens, and composes a new page for the directory.

**New files:**
- `ui/src/api/teamApi.ts` — `Team` (`id, clubId, sectionId, name, active, createdAt, updatedAt, updatedBy`), `TeamPayload` (`{name}`); `teamsPath(clubId, sectionId)` / `clubTeamsPath(clubId)`; `listTeamsForSection`, `listTeamsForClub`, `createTeam`, `updateTeam`, `deactivateTeam`, `reactivateTeam` — thin wrappers, plain-array responses (matching `sectionApi.ts`/`clubContactApi.ts`).
- `ui/src/components/TeamForm/` (four-file anatomy) — `name` `Input` (required), plus an **optional** `sections?: { id: string; name: string }[]` prop: when provided, renders a required `Select` for `sectionId` above the name field (club-wide create flow); when omitted, no section field at all (section-scoped create/edit, where the section is already fixed by the route). One component, two modes — a near-miss prop extension per `docs/standards/frontend.md`'s reuse rule (same precedent as `ClubForm`'s `mode` prop), not two components.
- `ui/src/pages/manage/TeamList.tsx` — section-scoped list. `sectionId` via `useParams`, `clubId` via Outlet context (exact `SponsorContactList.tsx` shape: both guarded with an `EmptyState` if missing). `ListToolbar` (search by name) + `RecordCard` grid (title = name, muted "Inactive" badge, `secondaryAction` deactivate/reactivate). `onCreate` → `/manage/sections/${sectionId}/teams/new`. `editTo` → `/manage/sections/${sectionId}/teams/${team.id}/edit`.
- `ui/src/pages/manage/TeamFormPage.tsx` — shared by **three** routes (see below): `sectionId` via `useParams` (optional — absent on the club-wide create route), `teamId` via `useParams` (absent on create). When `sectionId` is present, `TeamForm` gets no `sections` prop (fixed section, editing never changes it — matches spec's re-parenting Non-goal). When `sectionId` is absent (club-wide create only), fetches `listSections(clubId)` (existing `sectionApi.ts` call, no new endpoint) and passes it as `TeamForm`'s `sections` prop; on submit, the chosen `sectionId` from the form drives which nested `createTeam(clubId, sectionId, ...)` call fires. `backTo` is `/manage/sections/${sectionId}/teams` when scoped, `/manage/teams` when club-wide.
- `ui/src/pages/manage/TeamDirectory.tsx` (new — this is what `/manage/teams` now renders instead of `EmptyState`) — `clubId` via Outlet context only, no route param. Two queries: `listTeamsForClub(clubId)` and `listSections(clubId)` (existing), joined client-side into a `sectionId → name` map for display (same "flat, unpaginated, compose client-side" posture `ClubStructure.tsx` already uses). `ListToolbar` + `RecordCard` grid: `fields` includes a "Section" row from the joined map, `secondaryAction` deactivate/reactivate called directly using `team.sectionId` + `team.id` (no navigation needed — the row already carries everything the nested endpoints need), `editTo` → the **same** `/manage/sections/${team.sectionId}/teams/${team.id}/edit` route `TeamList.tsx` uses (no separate club-wide edit page). `onCreate` → `/manage/teams/new`.
- `ui/src/components/SectionDetailPanel/SectionDetailPanel.tsx` (edit, existing file) — add a `clubId: string` prop, and a "Manage Teams" block placed right after the existing "Linked contacts" section, copying `SponsorFormPage.tsx`'s exact Card+icon+outlined-`MuiButton` cross-link pattern (real bordered `Card`, icon, title/subtitle, `MuiButton component={RouterLink} to={`/manage/sections/${section.id}/teams`} variant="outlined"` — **not** a bare text link, per this codebase's established convention). Shown for any selected node, active or not — no leaf-only gating (spec's explicit Non-goal).
- `ui/src/pages/manage/ClubStructure.tsx` (edit, existing file) — pass `clubId={clubId as string}` into its existing `<SectionDetailPanel ... />` call. No other change — the file has no `useNavigate` today and doesn't need one for this.
- `ui/src/App.tsx` — replace the placeholder `<Route path="teams" element={<EmptyState title="Teams" description="Coming soon." />} />` and add the nested routes, as siblings of the existing `sections` route:
  ```tsx
  <Route path="teams" element={<TeamDirectory />} />
  <Route path="teams/new" element={<TeamFormPage />} />
  <Route path="sections/:sectionId/teams" element={<TeamList />} />
  <Route path="sections/:sectionId/teams/new" element={<TeamFormPage />} />
  <Route path="sections/:sectionId/teams/:teamId/edit" element={<TeamFormPage />} />
  ```
- `ui/src/pages/manage/ManagerDashboard.tsx` — **no change.** Its existing `{ title: 'Teams', description: 'Register teams', to: '/manage/teams' }` card already points at the right path; only the route's `element` changes, in `App.tsx`.

**Tests (co-written by `frontend-builder`, gap-checked by `test-writer` after):**
- `ui/src/components/TeamForm/TeamForm.test.tsx` + `.stories.tsx` — required-name validation; a story/test for both modes (with and without `sections` prop).
- `ui/src/pages/manage/TeamList.test.tsx`, `TeamFormPage.test.tsx`, `TeamDirectory.test.tsx` — list rendering + badges, create/edit submission (both `TeamFormPage` modes), deactivate/reactivate wiring, the section-name join rendering correctly in `TeamDirectory`.
- `ui/src/components/SectionDetailPanel/SectionDetailPanel.test.tsx` (extend) — the new "Manage Teams" block renders and links to the right `sectionId`.

## Order

1. **Step 0** (above) — amend `026-teams.md`, done directly.
2. `backend-builder` — full backend slice + its own tests.
3. Independently re-run `mvn test` — don't just trust the report.
4. `frontend-builder` — full frontend slice + its own tests (needs the real `TeamDto`/endpoint shapes from step 2).
5. Independently re-run `npm run build`, `npm run lint`, `npm run test`, `npm run test:storybook`.
6. `test-writer` — compare both Test Plans (spec's, as amended) against what's actually on disk, fill any real gaps named above (don't take a generic "write the tests" pass).
7. Manual browser smoke test (`claude-in-chrome` skill, per `CLAUDE.md`'s UI rule): Club Structure → select a section → Manage Teams → add/rename/deactivate/reactivate a team; separately, `/manage/teams` → see teams from multiple sections, create one via the section picker, edit one (lands on the same edit page), deactivate/reactivate from the directory.

## Verification

- `cd backend && ./mvnw test` — all new unit/integration tiers pass, existing suite unaffected.
- `cd ui && npm run build && npm run lint && npm run test && npm run test:storybook` — all pass, no dependency-cruiser/folder-shape violations.
- Contract: confirm `openapi.yaml` diff matches what springdoc actually generates for the six new endpoints (the manual-splice step named above).
- Manual smoke test per step 7 above — both entry points (section-scoped and club-wide), all four mutating actions (create, rename, deactivate, reactivate), confirmed to persist across a reload.
