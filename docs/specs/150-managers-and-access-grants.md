# 150: Roles, Permissions and Access Grants (who can do what, and where)

**Depends on:** `001-tenancy-identity-model.md` (`Person`, `RoleAssignment`, the section tree), `003-club-onboarding.md` (the Invitation idea this spec finally builds), `015-person-status-and-role-assignment.md` (`RoleAssignmentRole`, `PersonStatus`, the unique grant index; **this spec supersedes 015's "flat role, no per-permission granularity" decision, at the owner's request 2026-11-14**), `016-keycloak-account-provisioning.md` (`provisionAccount`, `POST /me/activate`, the "bridge by verified email" rule), `020-club-manager-access.md` (the `/api/v1/manage/**` namespace), `035-section-scoped-access.md` (`AccessService.accessibleSectionIds`, the downward closure, `SectionTreeSelect`), `119-login-account-journey.md` (the Access page, `ProfileResolver`), `docs/standards/page-anatomy.md`, `docs/standards/backend.md` (Authorization).
**Status:** draft. Requested by the owner 2026-11-14, the day after the first production rollout showed there is no way to add a second manager except SQL, and then widened the same day from "where" to "where and what" (full role-based access control, custom roles later).

## Problem & Goals

A grant today says only **where** (a club or a section). Everyone who can reach a place can do everything there, and the code asks one question everywhere: "can this person administer the club or section?" (`canAccessClub` on 119 endpoints, `canAdministerClub` on 76, `canAdministerSection` on 14). A club cannot add a second person, cannot say "U15 coordinator can edit players and matches but not leagues", cannot say "the scorer may only enter results", and cannot give someone view-only access. In production the owner had to insert a grant by SQL. The Managers tab on the Access page (`/manage/permissions`) shows "Coming soon".

**Goals**
- A grant becomes **person + role + place**. A **role** is a named bundle of **permissions**; a **place** is the whole club or one section and everything beneath it.
- Ship a fixed, code-defined list of permissions and five built-in roles. **Custom roles are a later spec**, but the data model is built for them now so that spec adds only screens.
- Every manager endpoint asks "does this person hold permission X, at a place covering this data?" instead of "are they an administrator?". Nothing changes for existing managers: their grant becomes the Manager role (all permissions).
- A manager can add a person by email with a role and a place, see who holds what where, change a role, resend an invitation, and remove access, from the Access page.
- The rule "you can only grant what you hold, and only inside your own reach" is enforced on the server.
- Two safety rules hold: nobody removes their own access; a club never loses its last club-wide Manager.

## Non-goals

- **Custom roles** (a club building its own bundle). Later spec. This spec ships the built-in roles read-only, shown in a Roles tab so people can see what each one means.
- **Per-record permissions** ("only this player"), **`TEAM` scope** ("only the 1st XI", `035`'s non-goal), and **deny rules**. Permissions only add; there is no "not allowed" grant.
- **Platform admin.** Stays a Keycloak realm role, outside this model, and still overrides everything (`012`, `015`).
- **Player, parent and agent accounts.** Their access (`119`) is not role-based and does not change. The Player accounts tab is unchanged.
- **Editing the Keycloak account** of a person whose access is removed. They may hold other roles or clubs. Only the grant goes.
- **An audit-log screen.** Grants and removals are logged at INFO with ids only; browsing them is later.

## Model

### Permissions (fixed list, an enum in code, `Permission`)

Each permission has a **key**, a plain label, a **level** (View or Edit), and a **reach**: `SECTION` (applies to data tied to sections, narrowed by the grant's place) or `CLUB` (applies only when the role is granted club-wide, because the data has no section: `035`'s Leagues decision). An Edit (or Manage) permission **implies** its View permission. (Amended 2026-11-14 during the Release 1 build: the first draft listed 16 keys and no View key for Results, Selection or Availability, which the Viewer role needs; there are now 19.)

| Key | What it allows | Reach |
|---|---|---|
| `PLAYERS_VIEW` | See players and their records | Section |
| `PLAYERS_EDIT` | Add, edit, tag, deactivate players | Section |
| `TEAMS_VIEW` | See teams and squads | Section |
| `TEAMS_EDIT` | Add and edit teams and squads | Section |
| `MATCHES_VIEW` | See fixtures and matches | Section |
| `MATCHES_EDIT` | Create, edit and delete matches | Section |
| `RESULTS_VIEW` | See results and scorecards | Section |
| `RESULTS_EDIT` | Capture and correct results and scorecards, share results | Section |
| `SELECTION_VIEW` | See team selection and the playing XI | Section |
| `SELECTION_MANAGE` | Team selection and the playing XI | Section |
| `AVAILABILITY_VIEW` | See availability polls and rounds | Section |
| `AVAILABILITY_MANAGE` | Availability polls and rounds | Section |
| `STATS_VIEW` | Stats, leaderboards, form | Section |
| `ACCESS_VIEW` | See who has access (this screen) | Section |
| `ACCESS_MANAGE` | Add, change and remove access | Section |
| `LEAGUES_EDIT` | Leagues, seasons, affiliations | Club |
| `CLUB_SETUP_EDIT` | Club profile, structure (sections), sponsors, contacts, Hub settings | Club |
| `IMPORTS_RUN` | Run schedule and result imports | Club |
| `PLAYER_ACCOUNTS_MANAGE` | Link requests and player accounts | Club |

**Reference data is readable by every grant.** Anyone holding any role at a club can read club-wide reference data (club profile, section tree, leagues and seasons, grounds, sponsors, contacts). Otherwise a section coordinator could not even pick a league when creating a match. Only editing it needs `LEAGUES_EDIT` or `CLUB_SETUP_EDIT`.

### Built-in roles (seeded, read-only, global)

| Role | Meant for | Permissions |
|---|---|---|
| **Manager** | Runs the club or a whole section | All |
| **Coordinator** | Runs the day-to-day of a section | Players, Teams, Matches, Results, Selection, Availability (all Edit), Stats View, Access View |
| **Team Manager** | Looks after one side | Players View, Teams Edit, Matches Edit, Results Edit, Selection, Availability, Stats View |
| **Scorer** | Enters results on the day | Players View, Teams View, Matches View, Results Edit, Stats View |
| **Viewer** | Sees everything in the place, changes nothing | All View permissions |

Club-wide-reach permissions in a role are **inert** when the role is granted on a section (a section Manager does not get Leagues Edit). The Add dialog says so in the helper line ("covers U15 and beneath; league and club setup need a club-wide grant").

### How a check resolves

`AccessService` gains one method that replaces the three checks over time:

```java
boolean can(Authentication a, UUID clubId, Permission p)                 // club-wide data or any-section question
boolean can(Authentication a, UUID clubId, Permission p, UUID sectionId) // data in one section
Optional<Set<UUID>> sectionIdsFor(Authentication a, UUID clubId, Permission p) // list filtering; empty = unrestricted
```

- Platform admin: always true.
- A **club-wide grant** whose role holds `p` (or a permission implying it): true everywhere in the club.
- A **section grant** whose role holds `p` and whose section closure contains the data's section (only for `SECTION` reach permissions): true there.
- A person with several grants gets the **union**.
- `canAccessClub` becomes "holds any grant at this club". `canAdministerClub` and `canAdministerSection` stay as thin deprecated wrappers (mapped to "holds Manager-level permissions") until the last endpoint has moved, so the migration can be done one area at a time with the old and new checks agreeing for every existing Manager.
- The caller's grants are loaded **once per request** (request-scoped), not once per check, so list endpoints with many checks do not multiply queries.
- Server-side only. The UI receives the caller's effective permissions (below) to hide actions, never to decide them.

## Rules (owner-approved 2026-11-14; the four open questions were answered the same day)

1. **Level rule (Decided).** A grantor can grant only on a section **inside their own reach** (their section and everything beneath it, `035`). Same level is allowed; above never is.
2. **Hold-what-you-give rule (Decided).** A grantor can grant a role only if they hold, at that place, **every permission the role carries at that place**. Permissions that are inert at the place (club-wide permissions on a section grant) are not compared. A Scorer cannot create a Manager; a section Manager can create a Manager of U15 because the club-wide permissions in the role are inert there.
3. **Needs the permission (Decided).** Granting, changing and removing need `ACCESS_MANAGE`; seeing the list needs `ACCESS_VIEW`. Coordinator, Team Manager, Scorer and Viewer cannot grant by default.
4. **Club-wide grants (Decided).** Only a club-wide holder of `ACCESS_MANAGE` can grant or remove a club-wide grant.
5. **Removal and change (Decided 2026-11-14: same reach, no bigger role).** A person can remove or change a grant if it is inside their reach and its role's permissions at that place are a subset of their own. They cannot touch their own grant.
6. **Last club-wide Manager (Decided).** The last club-wide holder of the Manager role cannot be removed or changed (409). A platform admin can still fix a club.
7. **Redundant grants (Decided 2026-11-14: refuse).** Granting the same role (or a role whose permissions the person already has) on a section they already cover is refused, naming the existing grant. A person may hold different roles on the same place (Scorer and Team Manager); the permissions union.
8. **Who is visible (Decided 2026-11-14: a count only for club-wide holders).** A viewer with `ACCESS_VIEW` sees grants whose place is inside their reach, plus their own. Club-wide holders appear to section viewers only as a count. Emails are personal data and stay inside the reach that needs them.
9. **A section that is deleted (Decided 2026-11-14).** Club Structure refuses to delete a section that still has grants, naming them.
10. **Abuse limit.** 20 invitations per club per day, 429 after.
11. **Existing grants (Decided).** Every existing `CLUB_ADMIN` grant (club or section scope) becomes the Manager role at the same place by migration. No one gains or loses anything on the day it ships.

## User Stories

- As a club-wide Manager, I can add a person with a role (for example Scorer) for the whole club or for one section, so that people can do their job and no more.
- As a Coordinator of U15, I can see everything in U15, edit what my role allows and nothing else, and I cannot reach leagues, club setup or access management.
- As a section Manager, I can add people on my own section tree, but only with roles whose permissions I hold there, and never club-wide.
- As a manager adding someone who already has an account, I am told no password email is needed and the person gets access when next signing in.
- As a manager adding someone without an account, an invitation is sent and the card shows "Invited" with Resend.
- As a manager, I can change a person's role on a place (for example Scorer to Team Manager) and remove access, within my reach.
- As a manager, I cannot remove myself or the last club-wide Manager.
- As a viewer of the Roles tab, I can see what each built-in role can do in a plain grid, so that I choose the right one.
- As a person given a role, the manager screens show only what I can do: buttons I cannot use are hidden, and a direct URL or API call returns 403.

## Data Model Changes

Migrations after `063`, in this order (never edit an applied migration):

**`064-access-roles.sql`** (new tables, seeded):

```sql
CREATE TABLE access_role (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID REFERENCES club(id),          -- null = built-in, global; set for a custom role (later spec)
    key         VARCHAR(40)  NOT NULL,
    name        VARCHAR(80)  NOT NULL,
    description VARCHAR(255) NOT NULL,
    built_in    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_access_role_key ON access_role (COALESCE(club_id, '00000000-0000-0000-0000-000000000000'), key);

CREATE TABLE access_role_permission (
    role_id    UUID        NOT NULL REFERENCES access_role(id) ON DELETE CASCADE,
    permission VARCHAR(40) NOT NULL,               -- Permission enum name; unknown values are ignored on read
    PRIMARY KEY (role_id, permission)
);
```

The five built-in roles and their permission rows are inserted by the migration. The permission **list** lives in code (`Permission`), not in a table, because the code that checks it must know it at compile time; the **bundles** live in the database so custom roles need no further schema change.

**`065-role-assignment-roles.sql`** (grants point at a role):

```sql
ALTER TABLE role_assignment ADD COLUMN access_role_id UUID REFERENCES access_role(id);
ALTER TABLE role_assignment ADD COLUMN granted_by_person_id UUID REFERENCES person(id);
ALTER TABLE role_assignment ADD COLUMN invitation_sent_at TIMESTAMPTZ;
UPDATE role_assignment SET access_role_id = (SELECT id FROM access_role WHERE key = 'MANAGER' AND club_id IS NULL)
 WHERE role = 'CLUB_ADMIN';
DROP INDEX ux_role_assignment_grant;
CREATE UNIQUE INDEX ux_role_assignment_grant ON role_assignment
  (person_id, COALESCE(access_role_id, '00000000-0000-0000-0000-000000000000'), role, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'));
```

- The old `role` column (`CLUB_ADMIN`/`MANAGER`/`PLAYER`) **stays for now**: `PLAYER` rows and platform rows do not use `access_role_id`. It is dropped for manager grants in a later cleanup once nothing reads it. For manager grants, `access_role_id` is the truth.
- `granted_by_person_id`: who granted it (null for `016` or SQL rows). `invitation_sent_at`: last invitation email (drives Resend). "Invited" is derived: the person's status is `PENDING`.
- The owner's hand-inserted grant (2026-11-13) is migrated to Manager like every other.

`RoleAssignmentRole` is **not** extended: new roles are data, not enum values.

## API Contract

Manager endpoints are under `/api/v1/manage/clubs/{clubId}/access`. URL access is "authenticated" (`020`); the real check is in the service through `AccessService.can(...)`. A wrong-club section id is a 404, a right-club wrong-section id a 403 (`035`).

| Endpoint | Needs | Purpose |
|---|---|---|
| `GET /roles` | any grant | The five built-in roles with their permissions, level and reach (for the Roles tab and the Add dialog). Custom roles (later) appear here too. |
| `GET /grants` | `ACCESS_VIEW` | The people list, shaped by rule 8. Query `?q=`, `?sectionId=`, `?roleId=`, `?status=`. The response also carries `canGrantClubWide`, `grantableSectionIds` and, per role, `grantable` (rule 2), so the form never offers what the server refuses. |
| `POST /grants` | `ACCESS_MANAGE` with reach | Body `{ email, firstName, lastName, roleId, scope: "CLUB"\|"SECTION", sectionId? }`. Finds or creates the `Person` (`findOrCreatePerson`); provisions a Keycloak account and sends the invitation only if none exists (`016`), else a short "you now have access" email. Saves the grant. 400 invalid, 403 rules 1 to 4, 404 section not in club, 409 duplicate or redundant, 429 limit. Keycloak failure: grant kept, `invitationFailed: true` in the response. |
| `PATCH /grants/{id}` | `ACCESS_MANAGE` with reach | Body `{ roleId }`. Changes the role in place under rules 2 and 5; never moves the place (Remove and Add for that). |
| `POST /grants/{id}/resend` | `ACCESS_MANAGE` with reach | Resend while the person is `PENDING`, else 409. |
| `DELETE /grants/{id}` | `ACCESS_MANAGE` with reach | Remove under rules 5 and 6. |

**`GET /api/v1/me/access` gains `permissions`:** for each club where the caller holds any grant, the caller's effective permission keys with, for section-reach permissions, the section ids they apply to (`unrestricted` when club-wide). The UI uses this only to hide actions and menu items; every endpoint re-checks. `MeAccessDto.clubAdminClubIds` stays for compatibility and means "clubs where the caller is a club-wide Manager".

**Existing endpoints** keep their paths and shapes. Their `@PreAuthorize` expressions move from `canAccessClub`/`canAdministerClub`/`canAdministerSection` to `@access.can(..., Permission.X ...)`, area by area (Rollout). `openapi.yaml` is regenerated by hand (live-backend memory).

## UI Requirements

Replaces the EmptyState on `/manage/permissions` (Managers tab of `AccessPage`; the tab is renamed **People**) and adds a **Roles** tab. Mockup first: `docs/mockups/managers-access-round1-mockup.html` (club-wide and Coordinator viewer, Add dialog with role, Change Role, Roles tab grid, removal, empty and error states, 375 px).

- **Tabs:** People, Roles, Player accounts. People is the grants list; Roles is a read-only grid.
- **People:** `ManageScreenHeader`, filled button **Add New Person** (hidden without `ACCESS_MANAGE`); figures (People, Invited, Club-wide, Sections covered); toolbar (search, Section filter via `SectionTreeSelect` limited to the viewer's reach, Role filter, status chips, Cards | List last); shared `RecordCard` showing name, email, a **role tag**, a **place tag** ("Whole club" or the section), Invited or Active, "Added by". One kebab: Change Role, Resend Invitation (Invited only), Remove Access. Rows the viewer may not touch have no kebab and show "Your access" or a lock note.
- **Add New Person dialog** (`RecordFormScreen`): email, first and last name (auto-filled and locked for a known person), **Place** (segmented Whole Club | One Section, Whole Club absent without club-wide `ACCESS_MANAGE`) with `SectionTreeSelect` of grantable sections, **Role** as a radio list. Each role shows its name and one line of meaning; roles the viewer cannot give (rule 2) are shown disabled with the reason ("You do not hold Matches Edit here"). A **What this role can do** expander lists the permissions as plain sentences. The helper line states the place and the inert-permission note. Submit "Add New Person"; a snackbar says whether an invitation was sent.
- **Change Role:** small dialog with the same role list, same rules.
- **Roles tab:** a grid, roles across, permissions down, grouped (People and teams, Matches and results, Availability and selection, Club setup), with ticks, view and edit shown as two levels, club-wide-only rows marked. Read-only. A quiet line "Custom roles are planned" is **not** shown (no promises in the UI); the tab simply has no Add button.
- **Elsewhere:** buttons and menu items the caller lacks the permission for are hidden (not disabled-with-lecture), driven by `me/access.permissions`; the Manager nav hides areas with no view permission. A direct URL returns the shared "not allowed" state from a 403.
- **Remove Access** confirm names the person, the role and the place, and says the account stays. Blocked cases disable the menu item with a reason; the server still checks.
- **Phone (375 px):** cards only, dialog full-screen, Roles grid scrolls inside its own container only. Buttons are the shared compact `Button`, Title Case. No em dashes. "Manager", never "CLUB_ADMIN".
- Empty state, first-run: "You are the only person with access" with a link-style Add New Person (`136`'s rule).

## Test Plan

Per `docs/standards/testing.md`; run after the owner has checked function (project rule), targeted per step, full suite once at the end.

- **Backend unit:** `AccessService.can` truth table (platform admin; club-wide grant; section grant inside and outside the closure; club-reach permission on a section grant is inert; union of two grants; Edit implies View); grant rules 1 to 7 (hold-what-you-give with inert permissions, level, redundant, self, last Manager); visibility shaping; rate limit; Keycloak failure keeps the grant.
- **Permission matrix test (the safety net):** for every built-in role and every manager endpoint, assert the expected 200 or 403 from a table checked into the repo. A new endpoint without a permission fails this test and the ArchUnit rule below.
- **ArchUnit:** after the migration, no controller method under `/api/v1/manage/**` may use `canAccessClub`, `canAdministerClub` or `canAdministerSection` directly; each must name a `Permission`.
- **Integration (Testcontainers):** migration `064`/`065` on a database holding an old `CLUB_ADMIN` grant (becomes Manager, behaviour identical); full grant, change, resend, remove against Postgres including the new unique index; a Scorer calling `PUT` on a match gets 403 and a Scorer capturing a result gets 200.
- **Frontend (Vitest):** People list for each viewer type; Whole Club absent without club-wide manage; roles disabled with reasons; Change Role; Roles grid; hidden buttons driven by `permissions`; snackbar outcomes; empty state.
- **Playwright:** one flow (Manager adds a Scorer for U15; Scorer signs in, can enter a U15 result, cannot see Leagues edit). Needs a second account; added to the smoke set only if the owner wants it.
- **OpenAPI contract diff** updated.

## Acceptance Criteria

- Every existing manager keeps exactly their current access after the migration (they hold the Manager role at the same place).
- A person given Scorer on U15 can enter results for U15 matches and cannot create matches, edit players, open Leagues setup or see Access management; each refused action returns 403 from the server, not only a hidden button.
- A Coordinator can see the Access People tab (their reach) but not change anything.
- A grantor cannot grant a role carrying a permission they do not hold at that place, cannot grant above their section, and a section grantor cannot grant club-wide.
- Adding a person by email gives them the role and place; an unknown email gets one invitation; a known account gets none.
- Change Role works under the same rules; removal never touches the Keycloak account.
- Nobody can remove or change their own grant; the last club-wide Manager cannot be removed or changed.
- Any single grant can be traced: one INFO log line per grant, change and removal, ids only.
- The Roles tab shows each built-in role's permissions exactly as the seeded database holds them.
- No manager endpoint is gated by the old three checks (ArchUnit green).
- The screens pass the page-anatomy section 0 checklist and have no horizontal scroll at 375 px.

## Rollout Notes

Three releases so nothing breaks and each can be hand-checked on the Irene club:

1. **Release 1, foundation (no visible change).** Migrations `064`/`065`; `Permission`, role tables, `AccessService.can`; the old checks become wrappers around it; `me/access.permissions`. Everyone is a Manager, so every test and every screen behaves as before. This is the point to confirm nothing changed.
2. **Release 2, Access screens.** People and Roles tabs, Add New Person, Change Role, Remove, invitations. Until the endpoints are moved, a role is only as strong as the checks behind it, so release 2 offers only roles that are already safe: **Manager** (all) and **Viewer** (a read-only role is safe only if every write endpoint is already permission-checked, so Viewer is offered once Players, Teams and Matches have moved; until then the picker shows Manager alone). The other roles are seeded but hidden by a flag until the areas they cover are enforced, so no one is ever given a role that is not yet honoured.
3. **Release 3, enforcement area by area.** Move endpoints to permissions in this order, each its own PR with its matrix-test rows: Players and player stats; Teams and squads; Matches, results, scorecards, imports; Selection and availability; Leagues, seasons, club setup, sponsors, contacts, Hub settings; Access. When the last area moves, the deprecated wrappers and the ArchUnit rule's allow-list are deleted and the hidden roles are switched on.

- **Custom roles** (a later spec) add: a role editor, `POST/PATCH/DELETE /access/roles`, `club_id`-scoped rows. No schema change.
- **Production:** migration only, no Keycloak or realm change. SMTP already works. Images are pulled as usual.
- **Follow-ups:** `TEAM` scope, an audit-log screen, a platform-admin override for the last Manager, dropping the legacy `role_assignment.role` for manager grants, and the platform-admin club pages revamp (separate owner idea).
- `docs/roadmap.md` gets rows in the same change as the plan; `docs/architecture.md` (RoleAssignment diagram) is updated when release 1 lands. `docs/standards/backend.md`'s Authorization section is amended in release 1 to name `Permission` as the one way to guard an endpoint.
- **Files:** `docs/mockups/managers-access-round1-mockup.html`.
