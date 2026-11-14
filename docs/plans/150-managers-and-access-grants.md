# Plan 150: Roles, Permissions and Access Grants (Release 1 in detail; Releases 2 and 3 outlined)

Implements `docs/specs/150-managers-and-access-grants.md` (draft 2026-11-14). Build branch: `feat/150-roles-permissions` (cut from `docs/150-roles-permissions-spec`, commit `42f71c68`).

## Context
A grant today says only where (club or section); every manager endpoint then asks "administrator or not" (`canAccessClub` on 119 endpoints, `canAdministerClub` on 76, `canAdministerSection` on 14). The owner wants full RBAC: a grant is person + role + place, with a fixed permission list, five built-in roles and custom roles later. Release 1 lays the foundation with **no visible change**: tables, the `Permission` enum, one new resolution method in `AccessService`, `me/access.permissions`, and every existing grant becoming the Manager role. Every existing test must pass unchanged; that is the proof of "no visible change".

## Points to flag back to the human (nothing is silently reinterpreted)
1. **What the old checks become.** The spec says they "become wrappers ... mapped to Manager-level permissions". Plan: `canAdministerClub(club)` is true when the caller holds a **club-wide grant whose role carries every permission** (today only Manager, so identical to the old rule); `accessibleSectionIds` and `canAdministerSection` use the same "all section-reach permissions" test on section grants. Behaviour is bit-for-bit the old one while only Manager exists. Wrappers are deleted in Release 3.
2. **Grants with a null `access_role_id`.** Migration 065 backfills existing `CLUB_ADMIN` rows, but a row inserted later by hand (as the owner's grant on 2026-11-13 was) would have none. Plan: `AccessService` treats `role = CLUB_ADMIN` with a null `access_role_id` as Manager, so a hand-inserted row can never lock anyone out. The spec does not say this; it is a safety fallback and goes away when the legacy `role` column is dropped.
3. **Caching the caller's grants once per request.** The spec requires it but names no mechanism. Plan: a small `@RequestScope` bean `CallerGrants` (grants plus their roles, loaded lazily on first use), reached from the singleton `AccessService` through `ObjectProvider`; outside a web request (tests, jobs) it falls back to an uncached load. Alternative (a `RequestContextHolder` attribute) rejected as harder to test.
4. **`me/access.permissions` shape is not fixed by the spec.** Plan: `permissions: [{ clubId, clubWide: boolean, items: [{ key, sectionIds: UUID[] | null }] }]` where `sectionIds` is `null` for club-wide and for club-reach permissions, else the resolved closure. Platform admin gets `permissions: []` plus the existing `platformAdmin: true`; the UI must treat `platformAdmin` as "everything" (decide in Release 2 when the UI first reads this).
5. **Unanswered spec questions** (peer change or removal, redundant grants, count-only visibility, deleting a section that has grants) affect **Release 2 only**. Release 1 does not depend on them.
6. **Stacked branch.** The spec is not on `master` yet. Recommend merging the spec PR first (or the build PR will carry the spec commit).
7. **Fixed UUIDs for the five built-in roles** in migration 064 (so 065, tests and `AccessRoleRepository` can name them without a lookup by key). Keys remain unique anyway.

## Design (reuse first)

**Backend (`com.cricketlegend`)**
- `backend/src/main/resources/db/changelog/v1/064-access-roles.sql` and `065-role-assignment-roles.sql` exactly as in the spec's Data Model Changes (tables, seed of the five roles and their permission rows, new columns, backfill of `CLUB_ADMIN` to Manager, unique index swap); register both in `db.changelog-master.xml` after `063`. Never edit an applied migration.
- `domain/Permission.java`: enum of the 19 keys with `label`, `level` (VIEW/EDIT), `reach` (SECTION/CLUB), `implies()` (Edit implies its View). Pure, no Spring.
- `domain/AccessRole.java` (`@Entity access_role`, `@ElementCollection(fetch = EAGER) Set<Permission>` over `access_role_permission`, unknown stored values ignored on read through a converter or a filtering getter), `repository/AccessRoleRepository.java` (`findByClubIdIsNull`, `findByKeyAndClubIdIsNull`). Plain UUID FKs, no `@ManyToOne`, per the existing convention in `RoleAssignment`.
- `domain/RoleAssignment.java`: add `accessRoleId`, `grantedByPersonId`, `invitationSentAt` (nullable, plain columns). `RoleAssignmentRole` is not changed.
- `config/EffectivePermissions.java` (pure class, easy to unit test): given a caller's grants, their roles and a section-closure function, answers `holds(permission, clubId)`, `holds(permission, clubId, sectionId)`, `sectionIdsFor(permission, clubId)`. Club-reach permissions count only for club-wide grants (inert on a section grant); union across grants; Edit implies View.
- `config/CallerGrants.java`: the request-scoped holder (flag 3); `config/AccessService.java`: add `can(a, club, p)`, `can(a, club, p, section)`, `sectionIdsFor(a, club, p)` (spec signatures), platform admin first. Rewrite `canAccessClub`, `canAdministerClub`, `accessibleSectionIds`, `canAdministerSection`, `assertCanAdminister*` on top of them (flag 1) with the existing Javadoc updated; `resolveMatchSectionIds` and `resolveCurrentPersonId` untouched. Existing `@PreAuthorize` annotations are **not** touched in Release 1.
- `service/impl/SubscriptionServiceImpl.java` (line ~142): the automatic grant also sets `accessRoleId` to Manager (through `AccessRoleRepository`).
- `dto/MeAccessDto` gains `permissions` (flag 4); new records `MePermissionsDto` and `MePermissionItemDto`; `service/impl/MeServiceImpl.toAccessDto` fills them from the same `EffectivePermissions`. `clubAdminClubIds` keeps its meaning ("clubs where the caller is a club-wide Manager").
- `ProfileResolver` is not changed in Release 1 (still reads `role`).
- `backend/openapi/openapi.yaml`: updated by hand (MeAccessDto plus the new schemas); `LinkedAccountCannotReachManagerSurfaceIntegrationTest` loads this file, so keep it valid. No new endpoint in Release 1.

**Frontend (`ui/src`)**
- `api/meApi.ts`: additive optional `permissions` type only; nothing reads it yet. No screen changes.

**Docs**
- `docs/standards/backend.md` Authorization section: name `Permission` and `AccessService.can` as the one way to guard an endpoint (old checks marked deprecated).
- `docs/architecture.md`: RoleAssignment diagram gains AccessRole and the permission bundle.
- `docs/roadmap.md`: row for spec 150 (Release 1 build, Releases 2 and 3 forward items).

## Slices, order and who does what
1. **backend-builder:** migrations 064 and 065, `Permission`, `AccessRole`, repositories, `RoleAssignment` columns.
2. **backend-builder:** `EffectivePermissions`, `CallerGrants`, `AccessService` core plus wrappers, `SubscriptionServiceImpl` grant, null-role fallback.
3. **backend-builder:** `MeAccessDto.permissions`, `MeServiceImpl`, `openapi.yaml`.
4. **frontend-builder:** the additive type in `meApi.ts` (a few lines).
5. **Human check (no tests before this, per the project rule):** the owner runs the app locally (club manager and section manager as before) and confirms nothing changed.
6. **test-writer, after the owner's OK:** see Verification.
7. **Docs** (standards, architecture, roadmap) in the same PR.
Rule for every backend step: never run `mvn` inside `backend/` while the IntelliJ app is running; verify in an rsync'd scratch copy and regenerate nothing live (memory: dont-build-under-live-backend).

## Verification (Release 1)
- **The regression net:** the existing `AccessServiceTest` (36 tests) and the 40 tests that touch `RoleAssignment` pass **unchanged**. Any edit needed to make them pass is a sign the wrappers changed behaviour and is flagged, not patched.
- **New backend tests (after owner OK, targeted per step):** `EffectivePermissionsTest` (truth table: platform admin; club-wide grant; section grant inside and outside the closure; club-reach permission inert on a section grant; two grants unioned; Edit implies View; unknown permission value ignored); `AccessServiceTest` additions for `can` and the null-role fallback; `AccessRolesMigrationOverEarlierDataTest` (follow `ResultVisibleToPlayersMigrationOverEarlierDataTest`): a database holding a club grant and a section `CLUB_ADMIN` grant migrates to Manager with identical `canAdministerClub` and `accessibleSectionIds` answers; a `MeAccess` integration assertion for `permissions`; `LayeringRulesTest` stays green.
- **OpenAPI contract diff** green. **One full run** at the very end of the PR only.
- **Production note:** migrations only, no Keycloak or realm change; deploy by image pull as usual; confirm the owner's hand-inserted grant still gives `/manage` after the migration.

## Release 2 (outline, own plan later)
`GET /roles`, `GET/POST/PATCH/DELETE /grants` and resend, the invitation email, the People and Roles tabs, Add Person and Change Role dialogs, page-anatomy section 0 checklist, only Manager (and Viewer once Players, Teams and Matches are enforced) offered in the picker; the other roles seeded but flag-hidden.

## Release 3 (outline, own plans later)
Move `@PreAuthorize` and service-layer checks to `@access.can(..., Permission.X)` area by area (Players and stats; Teams and squads; Matches, results, imports; Selection and availability; Leagues, club setup, sponsors, contacts, Hub settings; Access), each PR adding its rows to the permission matrix test. At the end: delete the old wrappers, add the ArchUnit rule banning them under `/api/v1/manage/**`, switch the hidden roles on, hide actions in the UI from `me/access.permissions`.
