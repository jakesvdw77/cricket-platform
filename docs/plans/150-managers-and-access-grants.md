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

---

# Release 2 (approved 2026-11-14)


---

# Release 2 (approved 2026-11-14)

## Context
There is still no way to add a second person, change what they may do, or take access away except SQL. Release 2 gives a manager the People and Roles tabs on the Access page (`/manage/permissions`), an Add Person dialog, Change Role, Resend Invitation and Remove Access, backed by six endpoints. All the rules in the spec's "Rules" section are enforced on the server. The owner answered the four open questions on 2026-11-14: peers may be changed or removed (never a bigger role, never yourself); redundant grants are refused; section Managers see club-wide holders as a count only; deleting a section that has grants is refused.

## Points to flag back to the human (nothing is silently reinterpreted)
1. **Only Manager is assignable in Release 2.** The spec says roles are offered only once the areas they cover are enforced, and nothing is enforced yet (that is Release 3). So the Add Person picker offers **Manager alone**, and the **Change Role action is hidden** until a second role is assignable (a one-option dialog would be pointless). The endpoint and dialog are still built and tested, behind `app.access.assignable-roles` (default `MANAGER`). The practical value of Release 2 is therefore: add and remove managers, club-wide or per section, with invitations. Recommend starting Release 3 with Players, Teams and Matches soon after so Viewer can be switched on.
2. **The Roles tab shows all five roles.** It is a read-only grid that documents the target, while the picker offers Manager only. Alternative (show only assignable roles) leaves a one-column grid. Say if you prefer the alternative.
3. **No prefill of a known person's name.** The mockup showed first and last name locked when the email is a known person. That needs an email lookup endpoint, which lets any manager test whether an email has an account (enumeration of personal data) and is not in the spec's API. Plan: no lookup. The form always asks for the names, the server ignores them for a known person (`findOrCreatePerson` already does), and the result message says whether an account already existed. The mockup's locked-name detail is dropped.
4. **Two small additions to Release 1 code** (additive, no behaviour change): `EffectivePermissions.holdsClubWide(permission)` and `AccessService.canClubWide(...)`. The rule "you can only give what you hold" needs to ask "do I hold this club-wide" for a club-wide grant, which the Release 1 methods cannot express.
5. **Mixed checks.** The new endpoints use `@access.can(..., Permission.ACCESS_*)`. `GET /roles` is "any grant" (spec), expressed with the existing `canAccessClub`. Release 3 moves the rest.
6. **Provisioning logic is duplicated, not shared.** `SubscriptionServiceImpl.provisionKeycloakAccountIfNeeded` is private and its tests construct the class directly. Plan: a small new `service/support/AccountInvitations` used only by the new service; extracting `SubscriptionServiceImpl` onto it is a follow-up (cleanup backlog), not done here, to keep its tests untouched.
7. **"Invited" is derived**: the person's `status` is `PENDING`. A known person who has never signed in therefore also shows Invited, which is accurate.
8. **No migration in Release 2.** Release 1's columns (`granted_by_person_id`, `invitation_sent_at`) are enough. Deploy is an image pull only. One config property is added.
9. **Rate limit counting.** `role_assignment` has no club column, so the 20 per club per day count is a JPQL query over club-scope rows plus section-scope rows whose section belongs to the club (`invitation_sent_at` in the last 24 hours). Resend counts too.
10. **Section delete refusal (rule 9) touches Club Structure.** `SectionServiceImpl.delete` must refuse with a 409 naming the grants. This is small, backend only, and in this release because the Access screen makes grants on sections possible for the first time.

## Design (reuse first)

**Backend (`com.cricketlegend`)**
- DTOs (`dto/`): `AccessRoleDto{id,key,name,description,assignable,permissions[{key,label,level,reach}]}`, `AccessGrantDto{id,personId,firstName,lastName,email,roleId,roleName,scopeType,sectionId,sectionName,status(ACTIVE|INVITED),addedByName,invitationSentAt,self,canChange,canRemove,canResend}`, `AccessGrantListDto{items,clubWideCount,canManage,canGrantClubWide,grantableSectionIds,roles[{roleId,grantable,reason}]}`, requests `AddAccessGrantRequest{email,firstName,lastName,roleId,scope,sectionId}` and `ChangeAccessGrantRoleRequest{roleId}`, `AddAccessGrantResultDto{grant,accountExisted,invitationSent,invitationFailed}`. Bean Validation on the requests, email lowercased and trimmed once in the service.
- `service/AccessRoleService` + impl: `GET /roles` from `AccessRoleRepository.findByClubIdIsNull()`, marking `assignable` from `app.access.assignable-roles`.
- `service/AccessGrantService` + `impl/AccessGrantServiceImpl` (one skeleton per `docs/standards/backend.md`): `list`, `add`, `changeRole`, `resend`, `remove`. Rules live here only, in small private methods (one per spec rule 1 to 11) so the unit tests map one to one:
  - level rule and `ACCESS_MANAGE` at the target place via `AccessService.can(..., ACCESS_MANAGE, sectionId)` or `canClubWide`; 404 for a section of another club (`sectionRepository`), 403 above reach;
  - hold-what-you-give: the role's permissions **at that place** (section grant: section-reach permissions only; club grant: all) each checked with `can`/`canClubWide` (flag 4);
  - removal and change: in reach, role permissions at the place a subset of the caller's, never your own grant, last club-wide Manager (`accessRoleId = MANAGER_ID`, scope CLUB) count of one gives 409;
  - redundant: the person's existing grants at the club already cover the target place with a superset of the role's permissions at that place: 409 naming the existing grant; the unique index `ux_role_assignment_grant` backs the exact-duplicate case (catch `DataIntegrityViolationException` to a 409);
  - visibility: caller with club-wide `ACCESS_VIEW` sees every grant; otherwise only grants whose place is inside `sectionIdsFor(ACCESS_VIEW)` plus their own; club-wide holders are returned only as `clubWideCount` to the second group;
  - add: `PersonService.findOrCreatePerson` (existing), then `AccountInvitations` (flag 6): provision a Keycloak account and send the invite only if `keycloakUserId` and `keycloakProvisionedAt` are both null, else send the short "you now have access" email; a `KeycloakProvisioningException` or `EmailDeliveryException` keeps the grant and sets `invitationFailed` (the posture 016 set), with the failure logged;
  - every grant, change and removal logs one INFO line with ids only (no emails), as `AgentInvitationService` does.
- Email: `service/AccessGrantEmailService` + impl following `AgentInvitationEmailServiceImpl` (Thymeleaf `templates/email/access-granted.html` on `base-layout.html`, `EmailService.send`, `AfterCommit.run`). New accounts get Keycloak's own invite through `KeycloakProvisioningService.provisionAccount` (unchanged).
- `repository/RoleAssignmentRepository`: add `findByScopeTypeAndScopeId`, `findBySectionScopeIn(...)` for the list, `countInvitationsSince(clubId, since)` (flag 9), `countByAccessRoleIdAndScopeTypeAndScopeId` for the last-Manager rule. Existing methods untouched.
- `controller/AccessGrantController` (package-private, `/api/v1/manage/clubs/{clubId}/access`): `GET /roles`, `GET /grants`, `POST /grants` (201), `PATCH /grants/{id}`, `POST /grants/{id}/resend` (204), `DELETE /grants/{id}` (204). Annotations: `@access.can(authentication, #clubId, T(com.cricketlegend.domain.Permission).ACCESS_VIEW)` for the list, `ACCESS_MANAGE` for the writes (the service re-checks the exact place), `canAccessClub` for roles. Model after `LinkRequestManagementController`.
- `service/impl/SectionServiceImpl.delete`: refuse with the existing business-exception type (409) when `RoleAssignment` rows point at the section or a descendant, naming up to five people (flag 10).
- `application.properties`: `app.access.assignable-roles=MANAGER`, `app.access.invitations-per-club-per-day=20`.
- `backend/openapi/openapi.yaml` by hand: six paths, the schemas above; `LinkedAccountCannotReachManagerSurfaceIntegrationTest` loads this file, so keep it valid.

**Frontend (`ui/src`)** (shared compact `Button`, `CompactToggleGroup`, `PageCounters`, `ListToolbar`, `RecordCard`, `SectionTreeSelect`, `ConfirmDialog`, `EmptyState`; no raw MUI `Button`, Title Case, no em dashes, no "you" in lists)
- `api/accessGrantsApi.ts` (types, query keys, `useAccessRoles`, `useAccessGrants`, `useAddAccessGrant`, `useChangeAccessGrantRole`, `useResendAccessInvitation`, `useRemoveAccessGrant`; mutations invalidate the list); mirror `api/sectionApi.ts`/`useLinkRequests`.
- `pages/manage/access/`: `AccessPage.tsx` gets three tabs People, Roles, Player accounts (`TABS` array, tab in the URL); new `PeopleTab.tsx` (header figures, toolbar, cards | list, empty state), `AccessGrantCard.tsx` (over `RecordCard`: name, email, role tag, place tag, Invited or Active, added by, one kebab: Change Role when more than one role is assignable, Resend Invitation when Invited, Remove Access; "Your access" for the viewer's own row), `AddPersonDialog.tsx` (email, names, place segmented control, `SectionTreeSelect` limited to `grantableSectionIds`, role radio list from `AccessRoleDto`, helper line, "Add Person"), `ChangeRoleDialog.tsx`, `RemoveAccessDialog.tsx` (over `ConfirmDialog`), `RolesTab.tsx` with `RoleGrid.tsx` (read-only grid grouped as in the mockup), `accessGrantFormat.ts` (plain-language permission sentences, place text, status text) with tests.
- `App.tsx`: the `permissions` route's index becomes `PeopleTab`, add `roles`; `components/ManagerShell/managerNav.ts`: `match` gains `/manage/permissions/roles`.
- Snackbar outcomes: "Access given. Invitation sent", "Access given. No invitation needed", "Access given, but the invitation email could not be sent. Resend it from the card".

**Docs**
- `docs/standards/page-anatomy.md`: the Access page (tabs, role and place tags, Add Person, no bare "Manager" label); `docs/roadmap.md` (Release 2 done list, Release 3 next); `docs/architecture.md` (the grant flow).

## Slices, order and who does what
1. **backend-builder:** `holdsClubWide`/`canClubWide`, DTOs, `AccessRoleService`, `GET /roles`, config properties.
2. **backend-builder:** `AccessGrantService.list`, `GET /grants`, visibility rules, repository queries.
3. **backend-builder:** `add` + `resend` (person, `AccountInvitations`, email template, limit).
4. **backend-builder:** `changeRole` + `remove` + last-Manager and own-grant rules, section delete refusal, `openapi.yaml`.
5. **frontend-builder:** `accessGrantsApi.ts`, tabs and routes, `PeopleTab` read-only list and counters.
6. **frontend-builder:** `AddPersonDialog`, outcomes, `RemoveAccessDialog`, Resend.
7. **frontend-builder:** `ChangeRoleDialog` (hidden by default, flag 1), `RolesTab`.
8. **Human check (no tests before this, per the project rule):** the owner adds a club-wide and a Juniors Manager locally with a second email, checks the invite, removal, refusals.
9. **test-writer, after the owner's OK and when Release 2 is complete:** see Verification. Release 1's deferred tests are written in the same pass.
10. **Docs**, then **deploy** (image pull, no migration, no Keycloak change; smoke the owner's own login and one add and remove on Irene).
Backend rule for every step: never `mvn` in `backend/` under the live app; verify in an rsync'd scratch copy.

## Verification
- **Backend unit (`AccessGrantServiceTest`):** level rule (own section, above, other club's section, club-wide as a section grantor), hold-what-you-give with inert club permissions, own grant, last club-wide Manager, peer allowed, bigger role refused, redundant refused (club, parent section), duplicate 409, visibility shaping (count only), rate limit, known and unknown account branches, Keycloak and email failure keeps the grant, section delete refusal.
- **Integration (Testcontainers):** full add, list, resend, change, remove; a section Manager gets 403 for a club-wide add and 404 for another club's section; `GET /roles`; `LinkedAccountCannotReachManagerSurface` stays green with the new yaml.
- **Frontend (Vitest + Testing Library):** list for both viewer types, Whole Club absent without club-wide manage, section picker limited to grantable, role picker offers Manager only, kebab items per state, the three snackbar outcomes, empty state, Roles grid; the page-anatomy guard test stays green.
- **Manual (owner), local and on Irene after deploy:** add a club-wide Manager, add a Juniors Manager, accept the invitation, confirm each sees only their reach, remove, confirm refusals for self and the last club-wide Manager.
- **Playwright:** one flow only if the owner wants it (needs a second account).
- One full backend and frontend run at the very end of the PR.

## Release 3 (outline, unchanged)
Move every manager endpoint to `@access.can(..., Permission.X)` area by area (Players and stats first, then Teams, Matches and results, Selection and availability, club setup), each PR adding rows to the permission matrix test; then delete the old wrappers, add the ArchUnit rule, switch the remaining roles on (Viewer after Players, Teams and Matches), and hide actions in the UI from `me/access.permissions`.
