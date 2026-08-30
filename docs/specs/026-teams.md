# 026 — Teams

**Depends on:** `001-tenancy-identity-model.md` (`Team` — the entity this spec builds for the first time, exactly as `001` already modeled it: `id, club_id, section_id, name`, a leaf hanging off a `Section`), `025-club-structure.md` (`Section`, `SectionDetailPanel`, `ClubStructure.tsx`, and its own Rollout Notes naming this spec as "the explicit next step"), `020-club-manager-access.md` (the `/api/v1/manage/**` namespace, `AccessService.canAdministerClub`, `ManagerHome`'s `Outlet` context), `021-club-contacts.md` (the `ListToolbar`/`RecordCard`/`RecordFormScreen` list/CRUD pattern this spec reuses, and its "disable, never delete" precedent), `006-post-login-home-shells.md` (`ManagerDashboard`'s existing "Teams" nav card, which this spec finally wires to a real screen — see Rollout Notes).
**Status:** draft.

## Problem & Goals

`001`'s entity model has always drawn `Team` as a real, separate entity — `SECTION ||--o{ TEAM : places`, with its own `id`/`club_id`/`section_id`/`name` — sitting as a leaf under a `Section`, never a variant of `Section` itself. Nothing has ever built it. `025` built the `Section` tree for real but explicitly stopped short of `Team`, saying in its own Non-goals: *"A future spec will place real `Team` rows under a leaf `Section` once roster/registration management is scoped — this spec's `Section` rows are shaped to be exactly what that future `Team.section_id` FK will point at, but no `Team` row is created here."* `025`'s `SectionTemplatePicker` currently seeds leaf `Section` nodes named "1st XI"/"2nd XI" as a placeholder for this gap — those names describe a team, not a structural age-group node, which is exactly the tell that `Team` is missing.

This spec is that "future spec" — deliberately the narrowest possible slice: a club admin can create, rename, and deactivate/reactivate named `Team`s under a `Section` of their choosing. It does not touch rosters, seasons, or league play — none of `Season`, `TeamRegistration`, or `LeagueAffiliation` exist in code yet, and building any of them here would be scoping ahead of a dependency that doesn't exist.

**Goals**
- A club admin can create one or more named `Team`s under any `Section` in their club's tree (e.g. "1st XI", "2nd XI" under a "Men" section, or "O/15 A", "O/15 B" under an "O/15" section), rename them, and deactivate/reactivate them.
- Reuses this project's mandatory list/CRUD pattern (`ListToolbar` + `RecordCard` + `RecordFormScreen`, established by `008`/`010`, reused by `021`/`023`/`024`) for the Teams screen — `025`'s org-chart tree editor was the one deliberate exception to that pattern for editing *structure*; a flat list of `Team`s under a chosen `Section` is not structure, it's an ordinary scoped record list, so it goes back to the standard shape.
- The `Team` row this spec creates is shaped to be exactly what a future `TeamRegistration.team_id` FK will point at — mirroring `025`'s own forward-compatibility framing for `Section`.
- Reached from `025`'s existing `SectionDetailPanel` — selecting a `Section` node surfaces a "Manage Teams" entry point for the teams that live directly under it.
- A club admin can also see every `Team` across their whole club in one flat, unpaginated list — a "Teams" directory — without drilling into the Club Structure org-chart first, and can create a new `Team` from that directory by picking its `Section` from a dropdown. `006-post-login-home-shells.md`'s `ManagerDashboard` already ships a "Teams" nav card routing to `/manage/teams` (currently an `EmptyState` placeholder); this spec is what finally gives that card a real screen, rather than adding a second, separate entry point.

## Non-goals

- **`Season`, `TeamRegistration`, rosters, or any player-facing squad membership.** None of these exist in code yet (`docs/roadmap.md`'s "Blocked on the full tenancy model" section, and confirmed by a search of `backend/src/main/java` — no `Season`/`Team` classes exist anywhere today). A `Team` created by this spec has a name and a `Section` placement and nothing else; who's actually on it is a future spec's job, blocked on `Season` existing at all.
- **`LeagueAffiliation` or any league/fixture concept.** Same blocker as above — `League`/`LeagueAffiliation` (`001`) are unbuilt and unrelated to this slice.
- **Any `RoleAssignment` `TEAM`-scope wiring.** `001`/`015` already reserve `TEAM` as a recognized `scope_type` value; granting or resolving a Team-scoped manager grant is separate, unbuilt future scope, matching `025`'s identical Non-goal for `SECTION`-scope. This spec only ever checks `CLUB`-scope access via the existing `canAdministerClub`.
- **A `/platform` mirror.** Matches `020`/`021`/`023`/`024`/`025`'s established precedent — `canAdministerClub` already gives `platform_admin` a superset pass on `/manage/**` endpoints; no parallel `/platform/**` surface is built.
- **Enforcing that a `Team` attaches only to a leaf `Section` (no active children).** A club's notion of "leaf" is exactly as varied as `025` found for section shape itself — a Vets section with no age split might reasonably carry a `Team` directly. The UI can *guide* toward leaves (see UI Requirements), but the backend does not reject a `Team` created against a non-leaf `Section`, matching `025`'s own precedent of capturing structure without enforcing business rules the codebase can't yet validate meaningfully.
- **Re-parenting a `Team` to a different `Section`.** First pass supports create, rename, and deactivate/reactivate only — matching `025`'s identical cut for `Section` re-parenting, for the same reason (real complexity, no concrete need yet). Moving a `Team` means deactivating it under the old `Section` and creating a new one under the new `Section`.
- **Hard-deleting a `Team`.** Unlike `025`'s `Section`, which added a deliberate one-off hard-delete-when-empty exception to guard against tree-orphaning, a `Team` is always a flat leaf record with no children of its own — there's no orphaning risk a hard-delete carve-out would be solving. This spec applies the codebase's ordinary "disable, never delete" posture (`Product`, `Club`, `ClubContact`, `Sponsor`, `SponsorContact`, and `Section`'s own contact-linked branch) unmodified: deactivate/reactivate only, no delete endpoint at all. This also keeps the row stable for a future `TeamRegistration`/`LeagueAffiliation` FK to reference without a "what if the team was deleted out from under a season's history" case to design around.
- **Team-level metadata beyond a name** (kit colour, home ground, short name/abbreviation, captain). None of it has a real consumer yet; add fields when a spec actually needs them, matching `025`'s eligibility-metadata precedent of only capturing what's asked for.
- **A general-purpose search/filter UI on the club-wide directory beyond `ListToolbar`'s existing name search.** No filtering by section, active state, etc. in this first pass — matching how minimal `021`/`023`/`024`'s own lists started.
- **Re-parenting a `Team` to a different `Section` via the club-wide directory's edit form, or anywhere else.** The section picker on the club-wide directory is a *create-time* choice only — editing an existing `Team` never exposes a section field, on the directory or on the section-scoped screen alike (see the Non-goal above on re-parenting generally).

## User Stories

- As a club admin, I select a `Section` node in Club Structure (e.g. "Men") and see a "Manage Teams" entry point leading to the list of `Team`s that sit directly under it.
- As a club admin, I can add a new `Team` under that `Section` by giving it a name (e.g. "1st XI"), without leaving the flow started from Club Structure.
- As a club admin, I can rename an existing `Team`.
- As a club admin, I can deactivate a `Team` that's no longer fielded, without losing its record, and reactivate one if that turns out to be premature.
- As a club admin for club X, I cannot view or modify club Y's teams, even by guessing a `sectionId`/`teamId` — enforced server-side.
- As a club admin, deactivated teams still show in the list (muted), so I can find and reactivate one later rather than it silently disappearing.
- As a club admin, I open "Teams" from my dashboard and see every team in my club in one list, each showing which section it sits under, without needing to know or navigate the section tree first.
- As a club admin, I can create a new team from that club-wide list by picking its section from a dropdown, without first navigating into Club Structure.

## Data Model Changes

**New entity — `Team`**, the first real implementation of `001-tenancy-identity-model.md`'s already-designed `Team` shape. Adds this codebase's standard audit/active-flag columns, exactly as `025` did for `Section`:

```
Team {
    uuid      id           -- PK, generated
    uuid      club_id      -- FK to club.id, not null
    uuid      section_id   -- FK to section.id, not null — where this team currently sits (001)
    string    name         -- free text, user-editable, not null, e.g. "1st XI"
    boolean   active       -- default true; "disable, never delete" (see Non-goals)
    timestamp created_at
    timestamp updated_at
    uuid      updated_by
}
```

No uniqueness constraint on `(section_id, name)` — a club renaming/restructuring mid-season, or briefly having two similarly-named teams during a reorganisation, isn't this spec's business rule to police, matching `025`'s equally permissive stance on `Section` names.

**Migration** (next sequential file after `025`'s `017-add-section.sql`):

```sql
-- backend/src/main/resources/db/changelog/v1/018-add-team.sql
CREATE TABLE team (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID NOT NULL REFERENCES club(id),
    section_id  UUID NOT NULL REFERENCES section(id),
    name        VARCHAR(255) NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID
);

CREATE INDEX ix_team_club ON team(club_id);
CREATE INDEX ix_team_section ON team(section_id);
```

## API Contract

**Architecture note — nested under `Section`, plus one flat club-wide list.** Mutating endpoints (create/update/deactivate/reactivate) and the section-scoped list all nest under `Section`, matching `025`'s own `.../sections/{sectionId}/contacts` shape — a `Team` is always created and edited in the context of "the teams under this section," so nesting keeps the URL structure honest about that and gives the `sectionId`-ownership check a natural place to live (404 if `sectionId` doesn't belong to `clubId`, exactly as `025`'s contact endpoints already do). Alongside that, one additional flat `GET /api/v1/manage/clubs/{clubId}/teams` lists every team for the club regardless of section, backing the club-wide Teams directory (Goals) — no new mutating endpoint is needed for it: the directory's create flow still calls the nested `POST .../sections/{sectionId}/teams` once a section is chosen, and its deactivate/reactivate/edit actions call the same nested endpoints using the `sectionId` already present on each returned `TeamDto`.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/teams` | `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")` | Lists every team for the club, flat, across all sections (active and inactive) — backs the club-wide Teams directory |
| `GET /api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams` | same | Lists every team under the section (active and inactive — inactive renders muted, matching `ClubContact`/`Sponsor`/`Section`'s existing "inactive stays visible" posture) |
| `POST /api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams` | same | Creates a team. `{name}` |
| `PUT /api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}` | same | Updates `{name}`. `section_id` is not editable via this endpoint (see Non-goals on re-parenting) |
| `POST .../teams/{teamId}/deactivate` | same | `active: true → false`. `409` (`InvalidStatusTransitionException`) if already inactive, matching `ClubContact`/`Sponsor`'s existing error shape |
| `POST .../teams/{teamId}/reactivate` | same | `active: false → true`. `409` if already active |

Every endpoint is scoped to `clubId` first, then (where applicable) `sectionId`, matching `025`'s own isolation posture — `404` if `sectionId` is real but belongs to a different club, `404` if `teamId` is real but belongs to a different section or club.

## UI Requirements

Composes entirely from existing shared components (`ListToolbar`, `RecordCard`, `RecordFormScreen` — `008`/`010`'s established anatomy, reused as-is by `021`/`023`/`024`) plus one new, minimal form component:

- **`ui/src/components/SectionDetailPanel/SectionDetailPanel.tsx`** (`025`, existing) — gains a "Manage Teams" entry point below the existing linked-contacts section: a `Card` with an icon and an outlined `Button` routing to `/manage/sections/{sectionId}/teams` (per this codebase's existing convention that a cross-link to a child resource needs a real button, not a bare text link — matching the treatment already given to other section↔resource links, e.g. `SponsorFormPage.tsx`'s "Manage Contacts" card). Shown for any selected node, not conditioned on leaf-ness (see Non-goals on leaf enforcement). Requires a new `clubId` prop, plumbed down from `ClubStructure.tsx`'s existing `Outlet`-context value.
- **`ui/src/components/TeamForm/`** (new, four-file anatomy per `docs/standards/frontend.md`) — a `name` field (`Input`, required), plus an *optional* `sections` prop: when supplied, a required `Select` for the team's section renders above the name field (the club-wide directory's create flow); when omitted, no section field renders at all (the section-scoped create/edit flow, where the section is already fixed by the route, matching the re-parenting Non-goal that editing never exposes a section field). One component, two modes — a near-miss prop extension per `docs/standards/frontend.md`'s reuse rule, not two components. No Claude Design pass needed — composed entirely from existing primitives, not a genuinely new visual pattern (unlike `025`'s tree editor).
- **`ui/src/pages/manage/TeamList.tsx`** (new) — reads `clubId` from `ManagerHome`'s `Outlet` context (`020`) and `sectionId` from the route param, fetches the section's own name (via `025`'s existing `listSections` call, filtered client-side — no new endpoint) to show as a page-header breadcrumb back to Club Structure, fetches the team list, and renders `ListToolbar` (search by name) + a grid of `RecordCard`s (`title` = team name, a muted "Inactive" badge when deactivated, `secondaryAction` = Deactivate/Reactivate depending on current state — mirroring `021`'s `ClubContactList.tsx` shape exactly).
- **`ui/src/pages/manage/TeamFormPage.tsx`** (new) — `RecordFormScreen` wrapping `TeamForm`, same create/edit-via-`:teamId?`-param shape `021`'s `ClubContactFormPage.tsx` already establishes. Shared by three routes (see below): when `sectionId` is present in the route, `TeamForm` renders without its section picker (the section is fixed); when absent (the club-wide directory's "add team" route), it fetches `listSections(clubId)` and passes it as `TeamForm`'s `sections` prop, and the section chosen in the form drives which nested create call fires.
- **`ui/src/pages/manage/TeamDirectory.tsx`** (new) — reads `clubId` from `ManagerHome`'s `Outlet` context only (no route param). Fetches the new flat `GET .../teams` list plus the existing `listSections(clubId)`, joins them client-side into a `sectionId → name` map (same "flat, unpaginated, compose client-side" posture `ClubStructure.tsx` already uses for sections+contacts), and renders `ListToolbar` + a `RecordCard` grid — each card's `fields` includes the team's section name from that map, `secondaryAction` deactivate/reactivate wired directly (every returned `TeamDto` already carries its own `sectionId`), `editTo` pointing at the *same* `/manage/sections/{sectionId}/teams/{teamId}/edit` route `TeamList.tsx` uses (no separate club-wide edit screen). This is the real screen `006-post-login-home-shells.md`'s existing "Teams" nav card (`/manage/teams`) has been pointing at an `EmptyState` placeholder for.
- **`ui/src/api/teamApi.ts`** (new) — one file per backend resource per `docs/standards/frontend.md`, thin wrappers over the API Contract above, including the flat club-wide list call.
- **`ui/src/App.tsx`** — the existing `teams` route's `element` changes from `<EmptyState title="Teams" description="Coming soon." />` to `<TeamDirectory />`; new routes nested under the existing `/manage` block: `teams/new` (club-wide create, with the section picker), `sections/:sectionId/teams` (section-scoped list), `sections/:sectionId/teams/new`, `sections/:sectionId/teams/:teamId/edit`.

No `ManagerDashboard.tsx` change — its existing `{ title: 'Teams', to: '/manage/teams' }` card (`006`) already points at the right path; only the route's `element` changes, in `App.tsx` above.

**Mobile-first**, same responsive rules `021`'s `ClubContactList`/`ClubContactFormPage` already established for this exact list/CRUD anatomy — no new pattern to design.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `TeamServiceImplTest` — create/update, deactivate/reactivate transitions and their invalid-transition `409`s, cross-club/cross-section `NotFoundException` isolation for both `sectionId` and `teamId`, `listByClub` returning teams across multiple sections |
| Integration | `TeamRepositoryTest` (Testcontainers) — migration applies cleanly, the `section_id`/`club_id` FKs behave correctly; `TeamControllerIntegrationTest` — real `CLUB_ADMIN` success across all six endpoints for their own club, `403`/`404` for a different club, `404` for a `sectionId` belonging to a different club, `platform_admin` superset success, both transition `409`s proven through the real HTTP layer, the flat club-wide `GET` returning teams from multiple different sections in one call |
| Contract | New endpoints (including the flat club-wide `GET`) + `TeamDto`/`CreateTeamRequest`/`UpdateTeamRequest` documented in the checked-in OpenAPI schema |
| Component | `TeamForm.test.tsx` + Storybook story — required-name validation, both with and without the `sections` prop (section-picker rendered vs. not); `TeamList.test.tsx` — renders cards with the right badge, deactivate/reactivate wiring; `TeamFormPage.test.tsx` — both modes (fixed section vs. club-wide with picker); `TeamDirectory.test.tsx` — renders every team with its joined section name, deactivate/reactivate wiring, create-with-picker flow; `SectionDetailPanel.test.tsx` extended — the new "Manage Teams" entry point renders and links to the right `sectionId` |
| E2E | New golden path, extending `025`'s own Club Structure spec: open Club Structure, select a section, open Manage Teams, add a team, rename it, deactivate it, reactivate it, reload and confirm every change persisted. Second golden path: open the "Teams" dashboard card, see teams from more than one section in one list, create a new team by picking a section from the dropdown, confirm it appears, deactivate it from the directory. Not wired into CI, same precedent as every prior `/manage` spec |

## Acceptance Criteria

- A club admin can create a `Team` under any `Section` in their club's tree, from that section's detail panel, via `/manage/sections/{sectionId}/teams`.
- A `Team`'s name is freely editable at any time.
- A `Team` is never hard-deleted — only `active` toggles, and it can be reactivated later.
- A club admin for club X gets `403`/`404` attempting to reach club Y's teams, or to create a team under a section that isn't theirs.
- The `Team` row this spec creates carries exactly `id, club_id, section_id, name, active` plus standard audit columns — nothing roster-, season-, or league-shaped is present yet.
- A club admin can open "Teams" from `ManagerDashboard` and see every team across every section of their club in one list, each showing its section.
- A club admin can create a `Team` from that club-wide list by picking its section from a dropdown, without first navigating into Club Structure.

## Rollout Notes

- Ships as its own PR, on top of `025`'s already-built `Section` tree and `020`'s `/api/v1/manage/**` namespace.
- **This is `Team`'s first real implementation.** A human should add a footnote to `001-tenancy-identity-model.md`'s Field Reference table for the `Team` row, in the same style already used for `Person` (`014`), `RoleAssignment` (`015`), and `Section` (`025`) — noting `active` as the one addition beyond `001`'s original four-field sketch, and that `TEAM`-scope `RoleAssignment` resolution remains unwired (unchanged from `001`'s own note).
- **`Season` and `TeamRegistration` are the explicit next step.** Once `Season` is scoped and built, a follow-up spec adds `TeamRegistration` (`person_id, team_id, season_id, role`) against the exact `Team` rows this spec creates — a season never creates a new `Team`, it only adds registration rows against an existing one, matching `001`'s original design (see `001`'s own worked example: the same `Person` moves from `U13A` to `U15A` to `Open 1st XI` purely via new `TeamRegistration` rows across seasons).
- **`001`'s own already-flagged gap remains open, not solved here:** the model tracks a `Team`'s *current* `section_id` only, not its grade-history across seasons (e.g. promotion/relegation). `001`'s Deliberately Deferred section already names the fix — a `TeamSeasonPlacement` join — "only if grade history turns out to matter." Still not this spec's job.
- A human should update `docs/roadmap.md`'s "Blocked on the full tenancy model" section once this ships: the `Team`-existence gap is resolved; `Season`, `TeamRegistration`, `LeagueAffiliation`, and `TEAM`-scoped `RoleAssignment` resolution remain blocked exactly as before.
- **Amended during `/plan-feature`, before any code was written:** this spec's first draft excluded a club-wide "all teams" view as a Non-goal, written without accounting for `006`'s pre-existing `ManagerDashboard` "Teams" nav card already routing to `/manage/teams` (an `EmptyState` placeholder). Rather than leave that card pointing at a permanent dead end, or add a second unrelated nav entry, the user chose to have this spec give that card its real screen — the flat club-wide directory now described throughout Goals/User Stories/API Contract/UI Requirements/Test Plan/Acceptance Criteria. The section-scoped flow (`SectionDetailPanel` → "Manage Teams") is unchanged from the original draft; the directory is additive on top of it, sharing the same backend endpoints and the same `TeamForm`/`TeamFormPage` rather than duplicating them.
