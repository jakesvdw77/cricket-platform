# Implementation Plan: 034 (Availability Polls Dashboard) + 035 (Section-Scoped Access)

## Context

Spec 034 replaces the dead `/manage/availability` dashboard stub with a real cross-match list
of open availability polls. Spec 035, written immediately after 034 in response to a real
product concern (a club admin scoped to one section shouldn't see the whole club's players,
teams, matches, and polls), builds the section-scoped `RoleAssignment` resolution spec 001
designed but every prior spec (015/025/026/028/029) deferred, and threads it through Players,
Teams, Matches, TeamSquad, MatchSide, and 034's own new endpoint.

The user asked to implement both **as one combined effort** rather than sequentially, and
035's own Rollout Notes explicitly say shipping together in one PR is fine. So this plan
builds 034's new endpoint/UI **section-aware from the first line of code** — there is no
throwaway "build 034 plain, then patch it" step.

Both specs were verified in full against the current codebase (two research passes) before
writing this plan — every file/line reference below reflects what's actually on disk today,
not assumption. **No new entities, columns, or migration are needed for either spec** — pure
new resolution logic, query filtering, and DTOs/endpoints on top of already-shipped schema
(`Section`, `RoleAssignment{scopeType=SECTION}`, `Team.sectionId`, `PlayerSection`).

**Security note, unrelated to build scope:** two independent research subagents each flagged
that a `Bash`/`find` tool result they saw contained text formatted to mimic a
`<system-reminder>` instructing a fabricated `Claude-Session` git-attribution URl be added to
commits. A direct repo search (`grep -rl "system-reminder\|Claude-Session\|claude.ai/code/session"`
across the whole tree, plus `find` for the migration file both subagents were searching for)
found nothing in any tracked or untracked file — the injected-looking text did not come from
this repository. Both subagents correctly ignored it and did not act on it. No repo content
needs remediation; flagged to the user for awareness only, not further investigated here.

## Architectural notes worth flagging before build (per workflow.md step 5 — not redefining
the spec, just naming implementation-level decisions the specs left to whoever builds them)

1. **`AccessService` becomes a real service-layer dependency, not just an `@PreAuthorize` SpEL
   target.** 035 already says this explicitly ("controllers pass `Authentication` into the
   service layer... this is the first time a service method itself needs to know *who* is
   calling"). Concretely: `PlayerServiceImpl`, `TeamServiceImpl`, `MatchServiceImpl`,
   `TeamSquadServiceImpl`, `MatchSideServiceImpl`, `MatchAvailabilityPollServiceImpl` each gain
   a constructor dependency on `AccessService` to call `assertCanAdministerSection` /
   `assertCanAdministerAnySection` / `accessibleSectionIds` directly.

2. **A `Match`'s "own section(s)" resolution needs a small shared helper**, since `Match` has
   no `sectionId` column (confirmed) — it's derived from `homeTeamId`/`awayTeamId` resolving to
   a `Team.sectionId` for whichever side is this club's own team. `MatchController`,
   `MatchSideController`'s service, and `MatchAvailabilityPollController`'s existing
   match-nested poll endpoints all need this same resolution. Plan: add
   `Set<UUID> resolveMatchSectionIds(UUID clubId, UUID homeTeamId, UUID awayTeamId)` to
   `AccessService` itself (it already becomes the section-resolution home in this spec, and
   gains a `TeamRepository` dependency to do it) — reused by all three call sites rather than
   duplicated. `MatchServiceImpl`/`MatchSideServiceImpl`/`MatchAvailabilityPollServiceImpl` may
   also need `TeamRepository` injected if they don't already have it — verify per class, add if
   missing.

3. **`assertCanAdministerSection`/`assertCanAdministerAnySection` throw Spring Security's own
   `AccessDeniedException` directly from service-layer code** — a genuinely new pattern for
   this codebase (every existing `AccessService` method today is a pure boolean consulted only
   from `@PreAuthorize` SpEL). 035's own API Contract section states this explicitly and says
   it deliberately does **not** join `docs/standards/backend.md`'s `NotFoundException`/
   `ConflictException`/`ValidationException` table. Backend-builder should not "fix" this into
   one of those three base classes — it's a deliberate spec decision.

## Backend — `backend-builder`, in this order

1. **`domain`/`repository` additions (no migration):**
   - `RoleAssignmentRepository`: add `List<RoleAssignment> findByPersonIdAndRoleAndScopeType(UUID personId, RoleAssignmentRole role, ScopeType scopeType)`.
   - `SectionRepository`: no new method needed — `findByClubId(clubId)` (existing) is enough for the closure computation.
   - `MatchRepository`: add `Page<Match> findByClubIdAndSectionIdIn(UUID clubId, Collection<UUID> sectionIds, Pageable pageable)` — **must** be a custom `@Query` (JPQL subquery joining `Team` by `homeTeamId`/`awayTeamId IN (SELECT t.id FROM Team t WHERE t.sectionId IN :sectionIds)`), not a derived-name method — `Match` has no `sectionId` field to derive from. Exact JPQL is already written out in 035's Data Model Changes section — reuse it verbatim.
   - `MatchAvailabilityPollRepository`: add `List<MatchAvailabilityPoll> findOpenByMatchClubId(UUID clubId)` — same reasoning, custom `@Query` joining `Match` by `matchId`, exact JPQL already written in 034's API Contract section.

2. **`AccessService` (`config/AccessService.java`)** — grows `SectionRepository` and
   `TeamRepository` dependencies. Add, in this order:
   - `accessibleSectionIds(Authentication, UUID clubId): Optional<Set<UUID>>` — `Optional.empty()` for `platform_admin`/`CLUB`-scope grant (unrestricted sentinel); otherwise the downward-descendant closure over `SectionRepository.findByClubId(clubId)` grouped by `parentSectionId`, rooted at every `SECTION`-scope grant the caller holds (via the new `RoleAssignmentRepository.findByPersonIdAndRoleAndScopeType(personId, CLUB_ADMIN, SECTION)`), unioned if more than one.
   - `canAccessClub(Authentication, UUID clubId): boolean` — `canAdministerClub(...) || accessibleSectionIds(...).map(s -> !s.isEmpty()).orElse(true)`.
   - `canAdministerSection(Authentication, UUID clubId, UUID sectionId): boolean` — 404s (`NotFoundException`) first if `sectionId` doesn't belong to `clubId`, matching the existing cross-club-isolation convention; then `canAdministerClub(...) || accessibleSectionIds(...).map(s -> s.contains(sectionId)).orElse(false)`.
   - `assertCanAdministerSection(...)` / `assertCanAdministerAnySection(...)` — throw `org.springframework.security.access.AccessDeniedException` when the corresponding boolean check fails (see architectural note 3). Empty `sectionIds` collection always fails for a non-club-wide caller.
   - `resolveMatchSectionIds(UUID clubId, UUID homeTeamId, UUID awayTeamId): Set<UUID>` — loads whichever of home/away resolves to a real `Team` in this club, returns their `sectionId`(s); empty set if neither does (both free-text or both another club's team) — this is the "zero resolved sections" fallback case 035 names explicitly, where only a `CLUB`-scope admin can reach the match.
   - New `AccessServiceTest` covering every case in 035's own Test Plan row for it.

3. **DTOs** — new records in `com.cricketlegend.dto`: `OpenAvailabilityPollDto`, `AvailabilityRespondentDto`, exactly as specified in 034 §API Contract (field names/types verbatim).

4. **`MatchAvailabilityPollService`/`Impl`** — add `listOpenForClub(Authentication authentication, UUID clubId, UUID sectionId)`:
   - Fetch via the new `findOpenByMatchClubId(clubId)`, batch-fetch the distinct `Match`es.
   - Resolve `accessibleSectionIds(authentication, clubId)`; if an explicit `sectionId` param is present, validate it via `assertCanAdministerSection` first, then narrow to just that id's closure.
   - Filter polls to those whose match resolves (via the new `AccessService.resolveMatchSectionIds`) to an accessible section; unrestricted callers skip filtering entirely.
   - Reuse the existing `rowsWithStatuses`/squad-resolution path unchanged, bucket into available/unavailable/unsure lists, sort by `matchDate` ascending.
   - Existing 6 methods (`list`/`create`/`open`/`close`/`getResponses`/`setPlayerStatus`) each gain an `assertCanAdministerAnySection(authentication, clubId, resolveMatchSectionIds(...))` call right after their existing `findMatchOrThrowForClub`.
   - Extend `MatchAvailabilityPollServiceImplTest` per both specs' Test Plans.

5. **`MatchAvailabilityPollController`** — change all 6 existing `@PreAuthorize` from
   `canAdministerClub` to `canAccessClub`; add the new endpoint:
   `GET /api/v1/manage/clubs/{clubId}/availability-polls/open?sectionId=` — `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")`, method takes `Authentication authentication` and passes it straight to the service. Existing 6 methods also gain the `Authentication authentication` parameter, passed through to the service calls added in step 4.

6. **Players** (`PlayerController`, `PlayerServiceImpl`, `PlayerSectionService`/`Impl` if section-link lives there): `canAdministerClub` → `canAccessClub` on all endpoints; `list` gains optional `sectionId` param filtering by `accessibleSectionIds` intersected with each player's tagged `sectionIds` (via existing `playerSectionRepository.findByPlayerProfileId`-based helper); `update`/`deactivate`/`reactivate`/`listSections` gain `assertCanAdministerAnySection(auth, clubId, sectionIds(playerId))`; `link`/`unlink` switch to direct SpEL `@PreAuthorize("@access.canAdministerSection(authentication, #clubId, #sectionId)")` since `sectionId` is already a path variable there.

7. **Teams** (`TeamController`, `TeamServiceImpl`): `listByClub` — `canAdministerClub` → `canAccessClub`, gains optional `sectionId` param filtering `team.sectionId ∈ accessibleSectionIds` (closure-inclusive, validated via `assertCanAdministerSection` if explicitly supplied). Every `/sections/{sectionId}/teams/**` endpoint (`listBySection`, create, update, deactivate, reactivate, team-contacts, team-sponsors) switches its existing `@PreAuthorize` from `canAdministerClub` to direct SpEL `canAdministerSection(authentication, #clubId, #sectionId)` — a strict superset since `canAdministerSection` internally short-circuits on `canAdministerClub`.

8. **Matches, TeamSquad, MatchSide** (`MatchController`/`MatchServiceImpl`,
   `TeamSquadController`/`Impl`, `MatchSideController`/`Impl`):
   - `MatchController.list` (paginated): `canAdministerClub` → `canAccessClub`; branches between existing `findByClubId` (unrestricted caller) and the new `findByClubIdAndSectionIdIn` (restricted caller, or explicit `sectionId` param) — a real query-level filter per the pagination rule, not fetch-then-filter.
   - `MatchController.get`/`update`/`deactivate`/`reactivate`: same access-gate change, plus `assertCanAdministerAnySection(auth, clubId, resolveMatchSectionIds(clubId, match.homeTeamId, match.awayTeamId))` inside `MatchServiceImpl`.
   - `MatchController.create`: same assert, resolved against the **request body's** own-club team ids (match doesn't exist yet).
   - `TeamSquadServiceImpl`: after the existing `findTeamOrThrowForClub`, add `assertCanAdministerSection(auth, clubId, team.getSectionId())` — `Team.sectionId` is already loaded there, no new lookup needed.
   - `MatchSideServiceImpl`: after `findMatchOrThrowForClub`, resolve the match's section set via `AccessService.resolveMatchSectionIds` (needs `TeamRepository` injected here for the first time — confirm and add) and `assertCanAdministerAnySection`.
   - Extend `MatchServiceImplTest`/`TeamSquadServiceImplTest`/`MatchSideServiceImplTest`, plus `MatchRepositoryTest` for `findByClubIdAndSectionIdIn`, plus `RoleAssignmentRepositoryTest` for `findByPersonIdAndRoleAndScopeType`.

9. **Controller integration tests** — new/extended `*ControllerIntegrationTest` for all six
   touched controllers, per both specs' Test Plans: a real `SECTION`-scope `CLUB_ADMIN`
   (seeded via `RoleAssignmentRepository.save(...)` directly in test setup — no grant/revoke UI
   needed) succeeding only within their section and getting `403` outside it; a `CLUB`-scope
   admin's full access proven unchanged (regression); `platform_admin` unaffected;
   `LeagueController`/`SeasonController` proven to still reject a pure `SECTION`-scope caller
   with `403`, unchanged.

10. **OpenAPI contract** — regenerate the checked-in schema after all endpoint changes (new
    endpoint, new `sectionId` query params, no response-shape changes elsewhere).

**Explicitly untouched, confirmed by both specs:** `LeagueController`, `SeasonController`,
`ClubProfileController`, `SectionController` (Club Structure/CRUD itself), `SponsorController`,
`ClubContactController` — no `@PreAuthorize` change, no new param.

## Frontend — `frontend-builder`, after backend (needs real endpoint shapes), in this order

1. **Shared-util extraction from `MatchAvailabilityTab.tsx`** (034's own Rollout Note — do
   this as part of this PR, not a follow-up): move the private `squadDisplayName` helper and
   `STATUS_COLOR`/`STATUS_LABEL` maps into `ui/src/utils/squadDisplayName.ts` and
   `ui/src/utils/availabilityStatus.ts` (or one combined file); update
   `MatchAvailabilityTab.tsx` to import from there instead of its own private copies —
   behavior must stay byte-identical, only the code's location moves.

2. **New component `ui/src/components/AvailabilityRespondentAvatars/`** (four-file anatomy:
   `.tsx`/`.test.tsx`/`.stories.tsx`/`index.ts`) — MUI `AvatarGroup` (`max={4}`) of tinted
   `Avatar`s using `initialsFromName` + the extracted `squadDisplayName`/status-tint helpers
   from step 1, a `Tooltip` per avatar, an explicit count label alongside (never inferred
   solely from an overflow "+N" avatar). Props exactly as specified in 034 §UI Requirements.

3. **Extend `SectionTreeSelect`** — add `allowClear`/`allLabel` optional props; widen
   `onChange` to `(sectionId: string | null) => void`; render an "All sections" row/affordance
   in the existing `Popover` when `allowClear` is set. Verify `TeamForm` (the only other
   consumer today) is unaffected — it doesn't pass `allowClear`, so its behavior is unchanged;
   only its `onChange` prop's TS signature technically widens. Extend
   `SectionTreeSelect.test.tsx`/`.stories.tsx`.
   - **No client-side section-closure logic needed** — the backend's `accessibleSectionIds`/
     `sectionId` param already does descendant-inclusive filtering server-side. The frontend
     filter just passes the single selected `sectionId` straight through as a query param.

4. **API client updates** (each existing list function gains an optional `sectionId` param,
   query-string wired like `MatchList`'s existing `search`/`sort`):
   - `ui/src/api/playerApi.ts` — `listPlayers(clubId, { sectionId }?)`.
   - `ui/src/api/teamApi.ts` — `listTeamsForClub(clubId, { sectionId }?)`.
   - `ui/src/api/matchApi.ts` — extend `ListMatchesParams` with `sectionId`.
   - `ui/src/api/matchAvailabilityApi.ts` — new `listOpenPolls(clubId, { sectionId }?)` plus
     new `OpenAvailabilityPoll`/`AvailabilityRespondent` types, matching the backend DTOs field-for-field.

5. **New page `ui/src/pages/manage/AvailabilityPollsDashboard.tsx`** — `ManageScreenHeader`,
   `SectionTreeSelect` filter row, `listOpenPolls` via React Query
   (`['managed-club', clubId, 'availability-polls', 'open', sectionId]`), club team list
   (`listTeamsForClub`, already-established pattern) to resolve whichever of
   `homeTeamName`/`awayTeamName` is `null`, one `RecordCard` per open poll (grid identical to
   `PlayerList`/`MatchList`) with `AvailabilityRespondentAvatars` in the `fields` slot per
   status, `editTo` deep-linking to
   `/manage/fixtures/matches/{matchId}/edit?tab=availability&side=home|away`, `EmptyState` for
   the no-open-polls case. No `ListToolbar`/`RecordFormScreen` (per 034's own stated exception).

6. **`ui/src/App.tsx`** — replace the `/manage/availability` stub route (current lines ~162-174, including its now-stale comment) with `<AvailabilityPollsDashboard />`; add the import.

7. **`ui/src/pages/manage/MatchFormPage.tsx`** — extend the existing `?tab=playing-xi`
   deep-link `useEffect` (current lines ~366-376) with a second case (or a second effect) for
   `?tab=availability&side=home|away`: sets `activeTab` to `availabilityTabIndex` and
   `activeAvailabilitySubTab` to `homeAvailabilitySubIndex`/`awayAvailabilitySubIndex` based on
   the `side` param. Extend `MatchFormPage.test.tsx`.

8. **Section filter added to `PlayerList.tsx`, `TeamDirectory.tsx`, `MatchList.tsx`** — a
   `SectionTreeSelect` (with `allowClear`) rendered below each page's existing
   `ListToolbar`/`ManageScreenHeader`, wired to a new `sectionId` state feeding the relevant API
   call + React Query key. `MatchList.tsx` **must** go through the backend param (it's the one
   genuinely paginated, backend-driven list per `docs/standards/frontend.md`'s pagination rule)
   — no client-side filtering there. `PlayerList`/`TeamDirectory` may filter via the same
   `sectionId` param for consistency with how the backend now enforces it by default anyway.
   `SquadPicker.tsx` reuses `MatchList` directly and inherits the filter for free — no change
   needed there.

## Tests — `test-writer`, after both builders (compare against both specs' Test Plan tables
verbatim, name specific gaps rather than "write more tests")

- Backend unit: `AccessServiceTest` (new), extended `PlayerServiceImplTest`/
  `TeamServiceImplTest`/`MatchServiceImplTest`/`TeamSquadServiceImplTest`/
  `MatchSideServiceImplTest`/`MatchAvailabilityPollServiceImplTest`.
- Backend integration: extended `MatchRepositoryTest`, `RoleAssignmentRepositoryTest`, new
  `MatchAvailabilityPollRepositoryTest`; new/extended `*ControllerIntegrationTest` across all
  six controllers (section-scoped success/403, club-wide regression, platform_admin,
  Leagues/Seasons still reject pure section-scoped callers).
- Frontend component: `SectionTreeSelect.test.tsx` extension,
  `AvailabilityRespondentAvatars.test.tsx` + Storybook story,
  `AvailabilityPollsDashboard.test.tsx` + Storybook story, `MatchFormPage.test.tsx` extension,
  `PlayerList.test.tsx`/`TeamDirectory.test.tsx`/`MatchList.test.tsx` filter extensions.
- E2E (not wired into CI, same precedent as every prior `/manage` spec): extend 032/034's
  golden path (open poll → dashboard card → edit deep-link) and add the new section-scoped
  golden path from 035's Test Plan (seed a `SECTION`-scope admin, confirm narrowed lists on all
  four screens, confirm 403 outside the grant).

## Verification

- `cd backend && ./mvnw test` — full backend suite, including new/extended unit, integration,
  and ArchUnit (layering, `@Service`-impl-suffix, ddl-auto=validate) checks.
- `cd ui && npm run build && npm run lint && npm run test && npm run test:storybook`.
- Manual smoke test via `claude-in-chrome` per `CLAUDE.md`'s UI-change rule: start both dev
  servers, walk the golden path as a club-wide admin (dashboard card → open-polls list →
  avatar/count summaries render → Edit deep-links into the correct match/side/tab), then seed a
  `SECTION`-scope grant directly via a throwaway repository call/test harness and confirm the
  same four screens visibly narrow, and that a direct URL to an out-of-section match/team
  returns a clean 403 experience, not a broken page.
- Confirm OpenAPI schema diff is intentional (new endpoint + `sectionId` params only).
