# 035 — Section-Scoped Access

**Depends on:** `001-tenancy-identity-model.md` (`RoleAssignment{person_id, role, scope_type, scope_id}`, the `canAdminister(roleAssignment, team)` recursive scope-hierarchy rule and its "Juniors admin sees only juniors" worked example — this spec builds the part of that design every prior spec has deferred, it does not redesign it), `015-person-status-and-role-assignment.md` (`RoleAssignmentRole{CLUB_ADMIN, MANAGER, PLAYER}` as a fixed enum, not a role-hierarchy/permission-matrix system — this spec's own resolution design stays inside that constraint), `020-club-manager-access.md` (`AccessService.canAdministerClub`, the `/api/v1/manage/**` namespace every endpoint touched below already sits on), `025-club-structure.md` (`Section`, its self-referential `parentSectionId` tree, the flat-list-not-nested-JSON architecture this spec's own closure computation reuses), `026-teams.md` (`Team.sectionId`, the club-wide `TeamDirectory`/section-nested `TeamList` dual-route precedent this spec extends rather than replaces), `028-players.md` (`PlayerProfile`, `PlayerSection` many-to-many tagging), `029-league-management.md` (`League`, `Season`, `LeagueAffiliation`, `Match`, `MatchSide`, `TeamSquadMember` — this spec determines what section-scoping means, and deliberately does not mean, for each), `032-match-availability-polls.md`/`034-availability-polls-dashboard.md` (`MatchAvailabilityPoll`, the not-yet-built `GET /availability-polls/open` endpoint `034` explicitly deferred section filtering from, naming this spec by number), `ui/src/components/SectionTree/`, `ui/src/components/SectionTreeSelect/` (`026`/`028`'s Rollout Notes, reused and extended here rather than forking a new picker — see CLAUDE.md's tech-stack table).
**Status:** draft.

## Problem & Goals

`001` designed section-scoped access from the very first version of this codebase's tenancy model — a `RoleAssignment` bound to a `SECTION` scope automatically covers that section and every section beneath it, with one recursive rule (`canAdminister`) reused for every scope level. Every spec since has left it exactly where `001` put it: reserved, not built. `015` built `RoleAssignment` for real but only ever creates/queries `scope_type = CLUB`. `025` built `Section` for real but its own Non-goals explicitly punted: *"granting or resolving a Section-scoped admin grant is separate, unbuilt future scope."* `026`, `028`, and `029` each repeated the identical Non-goal for `SECTION`/`TEAM` scope as their own entities landed. `034` (drafted, not yet built) named the resulting gap explicitly and pointed at this spec by number: *"Section-scoped visibility is a real, designed-but-unbuilt part of the tenancy model... it affects every club-wide list screen, not just this one, and needs its own spec covering `AccessService`/`RoleAssignmentRole` resolution plus filters across Players/Teams/Matches/Availability together."*

The practical consequence, confirmed against the real code, not assumed: every `/manage` list screen today — `PlayerList`, `TeamList`/`TeamDirectory`, `MatchList`, and `034`'s still-unbuilt open-polls dashboard — is gated only by `@access.canAdministerClub`, a flat "does this person administer the whole club" check. A club admin who should only manage Juniors sees, and can edit, every player, team, match, and availability poll across the entire club, exactly as if they held the full `CLUB_ADMIN` grant. This spec closes that gap for real, in one combined pass across every affected area, rather than five ad-hoc screen-level patches.

**Goals**
- Build real `SECTION`-scoped `RoleAssignment` resolution: a person granted administration over a section automatically administers every section beneath it, resolved by the same kind of closure `001` originally described as an upward parent-walk, computed here (functionally equivalently) as a downward descendant closure — see Data Model Changes.
- Extend `AccessService` with the minimum new access checks needed to express "a section-scoped grant sees only its own section and descendants" without weakening `canAdministerClub`'s existing club-wide reach for anyone who already holds it.
- Thread one shared, server-enforced section filter through Players, Teams, Matches (including `TeamSquadMember`/`MatchSide`, which are Team/Match-anchored), and `034`'s Availability dashboard — both as the *real* fix (a section-scoped admin's list is narrowed automatically, cannot be widened by any client-supplied parameter) and as an *optional* convenience filter any admin (club-wide or section-scoped) can apply on top.
- Determine and document precisely what section-scoping means, and deliberately does not mean, for `League`/`Season`/`LeagueAffiliation` — named explicitly in the request, but structurally different from Player/Team/Match (see Non-goals).
- Reuse one shared UI picker (`SectionTreeSelect`, extended, not forked) identically across every affected list screen, rather than five bespoke filter controls.

## Non-goals

- **`League`, `Season`, and `LeagueAffiliation` administration stays `CLUB`-scope-only — a deliberate determination, not an oversight.** Confirmed by reading `029` in full: `League`/`Season` carry no `section_id` at all, and `LeagueAffiliation` links a `League` to a `Team` (which does have a section) only per-`Season`, not structurally. A league can legitimately span several sections (e.g. an U13/U15 combined "Colts" league), so there is no single section a `League` or `Season` row could be scoped to without inventing a many-to-many concept `029` never designed and this spec has no mandate to add. This spec's determination: a purely section-scoped admin (no `CLUB`-scope grant at all) cannot reach `LeagueController`/`SeasonController`/`LeagueAffiliation` endpoints in this pass — they stay exactly as `@access.canAdministerClub`-gated as `029` built them, unchanged. What a section-scoped admin *can* do, covered below, is manage their own team's squad and a match's playing XI/availability — both genuinely Team/Match-anchored, not League-anchored.
- **`TeamSquadMember` and `MatchSide` (`029`) do get section-scoped access** — named here as a Non-goal *boundary*, not excluded: they're covered below because a squad belongs to one `Team` (one `sectionId`) and a `MatchSide` belongs to one `Match` resolved to a `Team`'s section the same way the match itself is, so both reuse this spec's Match/Team resolution directly. Flagged so the League/Season exclusion above doesn't read as "nothing under `029` is touched" — it isn't nothing, it's specifically not League/Season/Affiliation.
- **`TEAM`-scoped `RoleAssignment` resolution.** `001` reserves `ScopeType.TEAM`; this spec resolves `SECTION` only, matching the user's actual request and `034`'s own gap. A team-scoped grant (e.g. "manager of just the 1st XI, not the whole Open section") is real, plausible future scope, not built here — `ScopeType.TEAM` stays exactly as unresolved as `025`/`026`/`028`/`029` already left it.
- **A `RoleAssignment` grant/revoke admin UI.** `docs/roadmap.md` already tracks this separately as unbuilt. This spec makes `SECTION`-scoped grants real and testable — via `RoleAssignmentRepository.save(...)` directly, the exact same primitive `016`'s `SubscriptionServiceImpl.create()` already uses for `CLUB`-scope grants, reusable unchanged for `SECTION`-scope rows in a test's own setup step — but ships no screen for a club admin to actually grant one to a real person. Until that future spec ships, a section-scoped grant is only creatable by direct repository/DB access, not self-service. Judgment call: building that UI as a prerequisite here would roughly double this spec's surface area for a capability (self-service grant management) nobody has asked for yet; the resolution logic is the genuinely blocking, cross-cutting gap, the grant UI is not.
- **Editing the `Section` tree itself (Club Structure).** `025`'s `SectionTreeEditor`/`SectionController` (structure CRUD, eligibility metadata, contact linking) stays `canAdministerClub`-gated, unchanged. A section-scoped admin can administer players/teams/matches/availability *within* their section, but cannot restructure the tree that defines what their section even is — a materially bigger capability the request didn't ask for and that risks a section-scoped admin re-parenting or renaming sections outside their intended remit.
- **Any change to `MatchAvailabilityTab.tsx`, `PollShareDialog.tsx`, `PlayingXiBuilder.tsx`, poll open/close semantics, or the public/unauthenticated `/api/v1/public/polls/**` surface (`032`).** This spec only narrows who can reach the already-built `/manage`-side admin surfaces around these; the public, no-login poll-response flow has no `clubId`/section concept to scope in the first place and is untouched.
- **Enforcing `Section.minAge`/`maxAge`/`gender` against anything.** Unrelated to access control; stays exactly as non-enforced as `025` left it.
- **A `/platform` mirror, or any change to `platform_admin`'s existing superset access.** `canAdministerClub`'s `platform_admin` branch is untouched; every new check below layers underneath it, never around it.
- **Concurrent-section grants with conflicting reach are not specially reconciled beyond simple union.** If a person somehow holds two `SECTION`-scope grants (e.g. one on "Juniors" and one on "Vets"), their accessible set is the union of both closures — the natural, unsurprising behaviour of "holds two grants," not a new rule this spec needs to design around.

## User Stories

- As a club admin holding a `SECTION`-scoped grant on "Juniors," I see only Juniors (and its sub-sections') players, teams, and matches on `/manage/players`, `/manage/teams`, and `/manage/fixtures/matches` — never the Open or Vets side's data — with no way to widen that by editing the URL or a query parameter.
- As that same Juniors admin, if Juniors has multiple sub-sections (e.g. U13, U15), I can further narrow any of those four list screens to just one sub-section using a section filter, and clear it again to see everything my grant covers.
- As a club-wide `CLUB_ADMIN`, none of my existing access narrows — I still see and can manage every player, team, match, and open poll across the whole club by default, exactly as before this spec shipped.
- As a club-wide `CLUB_ADMIN`, I can optionally narrow any of the four list screens to one section (and its sub-sections) using the same filter control a section-scoped admin sees, as a convenience, not a restriction.
- As a Juniors-scoped admin, I can manage a Juniors team's squad and build a Juniors match's playing XI, exactly as a club-wide admin could, but attempting the same against an Open team's squad or an Open match is rejected server-side.
- As a Juniors-scoped admin, I can open/close and review a Juniors-side availability poll and see it on the Availability Polls dashboard; an Open-side poll never appears there for me and I'm rejected server-side if I try to reach it directly by id.
- As a Juniors-scoped admin, I cannot reach League, Season, or League Affiliation administration at all — those stay `CLUB_ADMIN`-only, and I get a clean `403`, not a confusing empty list, if I try.
- As a Juniors-scoped admin, I can create a brand-new player (club-wide action, no section chosen yet) and then tag them to one of my own accessible sections, but I cannot tag them to a section outside my grant, and I cannot edit or deactivate an existing player who is tagged only to sections outside my grant.
- As anyone testing this feature, a `SECTION`-scoped `RoleAssignment` row is creatable directly via `RoleAssignmentRepository`, without needing a grant/revoke UI to exist first.

## Data Model Changes

**No new entities, columns, or migration.** Every field this spec needs already exists: `RoleAssignment.scopeType` already recognizes `ScopeType.SECTION` (`015`), `RoleAssignment.scopeId` is already a bare, polymorphic `UUID` column with no DB-level FK (`015`'s own design, exactly because `scope_id` means something different per `scope_type`), and `Section.parentSectionId` already carries the tree this spec's closure computation walks (`025`). This spec is purely new resolution logic and query filtering built on top of already-shipped schema.

**Drift note against `001`, stated explicitly per this spec's own brief.** `001`'s worked example names the grant itself "Juniors Admin" — read literally, that phrasing could suggest a distinct role value per scoped grant. `015` already narrowed `RoleAssignment.role` to a fixed, small enum (`CLUB_ADMIN`, `MANAGER`, `PLAYER`) specifically *not* meant to grow a role-hierarchy/permission-matrix (`015` Non-goals). This spec resolves that tension by reusing `RoleAssignmentRole.CLUB_ADMIN` unchanged at a narrower `scope_type = SECTION` — a person holding `{role: CLUB_ADMIN, scopeType: SECTION, scopeId: <Juniors section id>}` *is* `001`'s "Juniors admin," functionally, without a role value that literally reads "Juniors Admin" anywhere. This is the more direct reading of `001`'s own `canAdminister(roleAssignment, team)` pseudocode in any case — it never branches on the *role name*, only on `scope_type`/`scope_id`; the "admin-ness" is `CLUB_ADMIN`, the "which part of the club" is the scope. No new `RoleAssignmentRole` value is added. `RoleAssignmentRole.MANAGER` remains exactly as unused/unresolved as it already was — this spec doesn't touch it, matching `015`'s own posture that only `CLUB_ADMIN` has a real, built consumer so far.

**Repository additions** (existing tables, no migration):

```java
// RoleAssignmentRepository — every SECTION-scope CLUB_ADMIN grant a person holds, used to
// compute their accessible-section closure. (The existing existsByPersonIdAndRoleAndScopeTypeAndScopeId
// stays as-is, still the CLUB-scope check AccessService.canAdministerClub uses.)
List<RoleAssignment> findByPersonIdAndRoleAndScopeType(UUID personId, RoleAssignmentRole role, ScopeType scopeType);
```

```java
// MatchRepository — the section-filtered counterpart to the existing findByClubId(clubId, pageable).
// Match stores home/away as plain UUID columns (029, no @ManyToOne), so this is a JPQL subquery
// join against Team by field value, not a navigated association — matching this codebase's
// existing flat-FK style exactly.
@Query("SELECT m FROM Match m WHERE m.clubId = :clubId AND ("
     + "m.homeTeamId IN (SELECT t.id FROM Team t WHERE t.sectionId IN :sectionIds) "
     + "OR m.awayTeamId IN (SELECT t.id FROM Team t WHERE t.sectionId IN :sectionIds))")
Page<Match> findByClubIdAndSectionIdIn(@Param("clubId") UUID clubId, @Param("sectionIds") Collection<UUID> sectionIds, Pageable pageable);
```

**Resolution logic — new methods on `AccessService`** (`@Component("access")`, unchanged identity, grows a `SectionRepository` dependency alongside its existing `PersonRepository`/`RoleAssignmentRepository`):

```java
/**
 * The closed set of Section ids (self + every descendant) a caller can administer within this
 * club, computed as a downward closure over Section.parentSectionId — functionally equivalent
 * to 001's own "walk parent_section_id upward from the target section" framing, just computed
 * top-down from the grant instead of bottom-up from the target, which is cheaper when checking
 * many resources against the same grant in one request (a list endpoint).
 *
 * Optional.empty() is the "unrestricted" sentinel — the caller is platform_admin or already
 * holds a CLUB-scope CLUB_ADMIN grant, so every section in the club is implicitly covered and
 * no filtering should be applied at all (existing club-wide admins must see exactly what they
 * see today). A present-but-possibly-empty Set is the real, closed accessible-section list for
 * a caller who is NOT club-wide — empty means "holds no SECTION-scope grant in this club
 * either," i.e. no access to anything section-scoped (such a caller already fails
 * canAccessClub and never reaches a resource-level check in practice).
 */
public Optional<Set<UUID>> accessibleSectionIds(Authentication authentication, UUID clubId);

/** True if canAdministerClub already passes, OR accessibleSectionIds(...) is non-empty — the
 *  new, broader entry gate for endpoints a section-scoped admin must be able to reach at all
 *  (list/read/mutate within Players, Teams, Matches, TeamSquad, MatchSide, Availability). Does
 *  NOT replace canAdministerClub anywhere it's used today for a genuinely club-wide-only
 *  surface (Club Profile, Club Structure, Sponsors, Club Contacts, Seasons, Leagues). */
public boolean canAccessClub(Authentication authentication, UUID clubId);

/** True if canAdministerClub already passes, OR sectionId is a member of
 *  accessibleSectionIds(...). Throws NotFoundException (404) first if sectionId doesn't belong
 *  to clubId at all — matching this codebase's existing cross-club isolation convention (025/
 *  026's own "real id, wrong tenant" precedent) — before ever reaching the access question, so
 *  a wrong-club id and a right-club-wrong-section id are never confused with each other. */
public boolean canAdministerSection(Authentication authentication, UUID clubId, UUID sectionId);

/** Void form of the above — throws org.springframework.security.access.AccessDeniedException
 *  (Spring Security's own type, the same one @PreAuthorize throws internally on a false SpEL
 *  expression — see the API Contract note below on why this is not a new backend.md exception
 *  base class) when canAdministerSection would return false. Used from service-layer code where
 *  the target section can only be known after loading a resource, so it can't be expressed as a
 *  #pathVariable in @PreAuthorize's own SpEL. */
public void assertCanAdministerSection(Authentication authentication, UUID clubId, UUID sectionId);

/** Same as assertCanAdministerSection, but passes if ANY of the given sectionIds is accessible
 *  — for a resource that can carry more than one section (a Player's PlayerSection tags). An
 *  empty sectionIds collection always fails for a non-club-wide caller (an untagged player is
 *  administerable only by a CLUB-scope admin — a deliberate, conservative default, since there
 *  is nothing to narrow a section-scoped admin's reach against). */
public void assertCanAdministerAnySection(Authentication authentication, UUID clubId, Collection<UUID> sectionIds);
```

`accessibleSectionIds`' closure computation reuses `SectionRepository.findByClubId(clubId)` (`025`'s existing, already-small, already-fully-fetched method — no new query shape) plus a `parentSectionId → children` grouping identical in spirit to `ui/src/utils/sectionTree.ts`'s `buildSectionTree`, just server-side and only for the ids the caller's own grants root at, not the whole tree.

## API Contract

**A new, deliberate 403 path, stated once here rather than repeated per endpoint below.** Every prior spec in this codebase's cross-tenant isolation story used `404` for "the id is real but belongs to a different club" (`NotFoundException`, `docs/standards/backend.md`'s table). This spec introduces the first *same-club, wrong-section* case, which is a genuinely different failure: the resource exists, belongs to the right club, and the caller has *some* real access to that club — they're just not authorized for that specific slice of it. That's a `403`, using Spring Security's own `org.springframework.security.access.AccessDeniedException` (the exact exception `@PreAuthorize` already throws internally whenever its SpEL expression evaluates `false`), thrown explicitly from `AccessService.assertCanAdministerSection`/`assertCanAdministerAnySection` wherever a `@PreAuthorize` expression alone can't express the check (a body-supplied team id on `Match` create, or a resource whose section is only known after it's loaded). This is deliberately **not** added to `docs/standards/backend.md`'s `NotFoundException`/`ConflictException`/`ValidationException` table — it isn't a new *business* exception type, it's the same security-layer mechanism every `@PreAuthorize`-guarded endpoint already relies on, just triggered from a different call site than usual.

**A new pattern: controllers pass `Authentication` into the service layer, not just into `@PreAuthorize`.** Every endpoint below that needs to filter a list or resolve a resource's own section gains an explicit `Authentication authentication` method parameter (Spring injects the current `Authentication` directly when a controller method declares it), passed straight through to the corresponding service call alongside `clubId`. Until this spec, `AccessService` was only ever consulted from `@PreAuthorize` SpEL; this is the first time a service method itself needs to know *who* is calling, not just *that* the gate already passed — flagged explicitly since it's a new, if unsurprising, shape.

### Players (`PlayerController`, `PlayerSectionService`)

| Endpoint | Access change | New behaviour |
|---|---|---|
| `GET .../clubs/{clubId}/players?sectionId=` (new optional param) | `canAdministerClub` → `canAccessClub` | Returns every player for the club whose tagged `sectionIds` intersects the caller's `accessibleSectionIds` (unrestricted/no filtering for a club-wide caller). If `sectionId` is supplied, further narrows to that section's closure — `assertCanAdministerSection` validates it first (404 wrong club, 403 outside the caller's own reach) |
| `POST .../players` | `canAdministerClub` → `canAccessClub` | Unchanged behaviour otherwise — creation stays reachable by any club-accessible admin (club-wide or section-scoped); the new player starts with zero tagged sections, exactly as today |
| `PUT .../players/{playerId}` | `canAdministerClub` → `canAccessClub`, **plus** `assertCanAdministerAnySection(auth, clubId, player.sectionIds)` inside `PlayerServiceImpl.update` | A section-scoped admin can only edit a player tagged to at least one of their own accessible sections; an untagged player is editable only by a `CLUB`-scope admin |
| `POST .../players/{playerId}/deactivate` / `.../reactivate` | same as `update` | Same `assertCanAdministerAnySection` check inside `PlayerServiceImpl` |
| `GET .../players/{playerId}/sections` | `canAdministerClub` → `canAccessClub`, plus the same `assertCanAdministerAnySection` read guard | Unchanged shape |
| `POST .../players/{playerId}/sections/{sectionId}/link` | `@PreAuthorize("@access.canAdministerSection(authentication, #clubId, #sectionId)")` (direct SpEL — `sectionId` is already a path variable) | A section-scoped admin can only tag a player into one of their own accessible sections, regardless of what other sections that player might already carry |
| `POST .../players/{playerId}/sections/{sectionId}/unlink` | same direct SpEL | Same reasoning — can only remove a tag for a section they themselves administer |

### Teams (`TeamController`)

| Endpoint | Access change | New behaviour |
|---|---|---|
| `GET .../clubs/{clubId}/teams?sectionId=` (new optional param, club-wide directory) | `canAdministerClub` → `canAccessClub` | Filters to `team.sectionId ∈ accessibleSectionIds` (unrestricted for club-wide callers). `sectionId` param narrows further, closure-inclusive, same `assertCanAdministerSection` validation as Players |
| `GET .../sections/{sectionId}/teams` (existing section-nested route — kept, not replaced) | `@PreAuthorize("@access.canAdministerSection(authentication, #clubId, #sectionId)")` | Unchanged semantics otherwise (exact section only, no descendant-inclusion — this route was always "teams directly under this one node," distinct from the club-wide directory's new descendant-inclusive filter; the two intentionally differ and that difference is called out here so it doesn't read as an inconsistency) |
| `POST .../sections/{sectionId}/teams` (create) | same direct SpEL | A section-scoped admin can only create a team under a section they administer |
| `PUT .../sections/{sectionId}/teams/{teamId}` | same | |
| `POST .../sections/{sectionId}/teams/{teamId}/deactivate` / `.../reactivate` | same | |
| `GET/POST .../sections/{sectionId}/teams/{teamId}/contacts/**` (`027`) | same | Team-contact linking narrows with the team itself — no separate check needed beyond the section the URL already carries |
| `GET/POST .../sections/{sectionId}/teams/{teamId}/sponsors/**` (`027`) | same | Same reasoning |

`canAdministerSection`'s own internal `canAdministerClub` short-circuit means every one of these direct-SpEL replacements is a strict superset of the old `canAdministerClub` check — a club-wide admin's access is provably unchanged, not just intended to be.

### Matches, TeamSquad, MatchSide (`MatchController`, `TeamSquadController`, `MatchSideController`)

A `Match`'s "own section(s)" are resolved once, reused by every check below: the `sectionId` of whichever of `homeTeamId`/`awayTeamId` (if any) references a `Team` belonging to this `Match`'s own `clubId` — `029`'s existing cross-club-team-reference allowance means a match's other side may not resolve to any of this club's own sections at all, which is fine, see the fallback rule below.

| Endpoint | Access change | New behaviour |
|---|---|---|
| `GET .../clubs/{clubId}/matches?sectionId=` (new optional param, existing `Pageable`) | `canAdministerClub` → `canAccessClub` | Unrestricted callers use the existing `findByClubId(clubId, pageable)`; restricted callers (or anyone passing `sectionId`) use the new `findByClubIdAndSectionIdIn` — a real query-level filter, not a fetch-then-filter, since this endpoint is genuinely paginated (`docs/standards/backend.md`'s pagination rule, unlike Players/Teams' small bounded lists) |
| `GET .../matches/{matchId}` | `canAdministerClub` → `canAccessClub`, plus `assertCanAdministerAnySection(auth, clubId, match's own resolved sectionIds)` inside `MatchServiceImpl.get` | **Fallback rule, stated explicitly:** if a match resolves to *zero* of this club's own sections (both sides free-text, or both sides another club's real `Team`), only a `CLUB`-scope admin can reach it — there's no section to scope a narrower grant against, so the conservative default wins, matching this spec's identical default for an untagged `Player` |
| `POST .../matches` (create) | `canAccessClub` at the controller, plus the same assert inside `MatchServiceImpl.create` resolved against the *request body's* own-club `homeTeamId`/`awayTeamId` (not yet a persisted `Match`) | A section-scoped admin can only schedule a match where at least one of their own club's team references falls in their own accessible sections |
| `PUT .../matches/{matchId}` / `.../deactivate` / `.../reactivate` | same pattern as `GET` | |
| `GET/POST/PUT .../teams/{teamId}/seasons/{seasonId}/squad/**` (`TeamSquadController`) | `canAdministerClub` → `canAccessClub`, plus `assertCanAdministerSection(auth, clubId, team.sectionId)` inside `TeamSquadServiceImpl` (resolved by loading the `Team` once, already required for the existing cross-club check) | A section-scoped admin manages only their own team's squad |
| `GET/POST/PUT .../matches/{matchId}/sides/**` (`MatchSideController`) | `canAdministerClub` → `canAccessClub`, plus the same match-section resolution/assert as `MatchController` above (the side's own `teamId` is already constrained to equal one of the match's own team ids per `029`) | A section-scoped admin builds a playing XI only for their own section's side of a match |

### Availability (`MatchAvailabilityPollController`, including `034`'s not-yet-built dashboard endpoint)

| Endpoint | Access change | New behaviour |
|---|---|---|
| `GET/POST .../matches/{matchId}/polls/**` (`032`, existing) | `canAdministerClub` → `canAccessClub`, plus the identical match-section assert `MatchController` uses (a poll's own section is its parent match's section) | Unchanged shape/response otherwise |
| `GET .../clubs/{clubId}/availability-polls/open?sectionId=` (`034`, not yet built — this spec amends `034`'s own draft contract before it's ever implemented, so it ships section-aware from day one rather than needing a second patch) | `canAdministerClub` → `canAccessClub` (`034`'s draft already specified `canAdministerClub`; this is the one change to `034`'s own contract) | `MatchAvailabilityPollServiceImpl.listOpenForClub` filters to polls whose match resolves to an accessible section, using the same `findOpenByMatchClubId` result set intersected with `accessibleSectionIds` in Java (this list is already small/unpaginated per `034`'s own reasoning, so no new query-level join is needed the way `Match`'s paginated list needs one) — plus the same optional `sectionId` narrowing param, same validation |

### Leagues, Seasons, League Affiliations — unchanged

`LeagueController`, `SeasonController`, and `LeagueController`'s affiliation endpoints keep `@access.canAdministerClub` exactly as `029` built it. No new parameter, no new check. A caller who holds only a `SECTION`-scope grant (no `CLUB`-scope grant at all) gets the same `403` from `@PreAuthorize` these endpoints already produce for any non-admin caller today — nothing new to build, this is `canAdministerClub` returning `false` exactly as it always has.

## UI Requirements

**One shared control, extended not forked: `ui/src/components/SectionTreeSelect/`** (`026`, existing) gains two new optional props:

```ts
export interface SectionTreeSelectProps {
  label: string
  sections: Section[]
  value: string | null
  onChange: (sectionId: string | null) => void   // widened: null is now a real, intentional value
  error?: boolean
  helperText?: string
  allowClear?: boolean     // new — renders an "All sections" row above the tree in the Popover
  allLabel?: string        // new — defaults to "All sections"; shown as the trigger's display value when value is null and allowClear is true
}
```

`allowClear` defaults to `false` (or is simply omitted), so `TeamForm`'s existing required-section picker — the one other real consumer of this component today — is unaffected in behaviour; only its `onChange` prop's TypeScript signature widens (a compile-time-only change, since `TeamForm` never receives `null` in practice — `SectionTree`'s own `onSelect` never fires for a non-existent node). Every one of the four/five list screens below passes `allowClear` (and reuses the default `allLabel`), making this the one, identically-reused filter control across all of them — the "one shared filtering approach" the request asked for, not five bespoke pickers.

- **`ui/src/pages/manage/PlayerList.tsx`** — gains a `SectionTreeSelect` (filter mode) rendered in a filter row directly below `ListToolbar`, using the already-fetched `sections` list (no new query). Selecting a section adds `sectionId` to `listPlayers(clubId, { sectionId })`'s query params and the React Query key; clearing it removes the param. The default (no explicit selection) already reflects the caller's own server-enforced accessible set — the filter only ever *narrows further*, it is never what makes a section-scoped admin's default view scoped in the first place (that's server-side, unconditional).
- **`ui/src/pages/manage/TeamDirectory.tsx`** — same pattern, `listTeamsForClub(clubId, { sectionId })`. `ui/src/pages/manage/TeamList.tsx` (the section-nested screen) needs no filter control of its own — it's already scoped to one exact section by its route.
- **`ui/src/pages/manage/MatchList.tsx`** — same pattern, `listMatches(clubId, { page, sort, sectionId, ...search })`; `SquadPicker.tsx` (`029`) reuses `MatchList` directly and inherits the filter for free, with no changes of its own needed.
- **`ui/src/pages/manage/AvailabilityPollsDashboard.tsx`** (`034`, not yet built — built section-aware from the start per this spec) — same pattern, `listOpenPolls(clubId, { sectionId })`, filter row below `034`'s own `ManageScreenHeader`.
- **`ui/src/api/playerApi.ts`, `teamApi.ts`, `matchApi.ts`, `matchAvailabilityApi.ts`** — each existing list function grows an optional `sectionId` param, appended as a query string param exactly like `MatchList`'s existing `search`/`sort` wiring.
- **No new UI component.** `SectionTreeSelect`'s extension is the entire UI surface this spec adds — every screen it's added to already exists and already fetches the section list it needs.

A club-wide admin sees the exact same filter control a section-scoped admin does — the two are visually identical; only the *default*, unfiltered result set differs, entirely server-side. Nothing in the UI needs to know or branch on which kind of grant the current user holds.

**Mobile-first**, per `docs/standards/frontend.md` — `SectionTreeSelect`'s existing `Popover` layout already handles narrow viewports (`026`'s own mobile-first pass); adding one more filter-mode instance per screen introduces no new responsive surface.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `AccessServiceTest` (new) — `accessibleSectionIds`: `Optional.empty()` for `platform_admin` and for a `CLUB`-scope grant; a real closed descendant set for a `SECTION`-scope grant (parent grant covers a multi-level child correctly); union of two `SECTION`-scope grants; empty set for no grant at all. `canAccessClub`/`canAdministerSection`/`assertCanAdministerSection`/`assertCanAdministerAnySection` — every combination of club-wide/section-scoped/no-access, the 404-vs-403 split (section belongs to a different club vs. belongs to this club but outside the caller's grant), the empty-`sectionIds`-collection-always-fails-for-non-club-wide case |
| Unit | `PlayerServiceImplTest`/`TeamServiceImplTest`/`MatchServiceImplTest`/`TeamSquadServiceImplTest`/`MatchSideServiceImplTest`/`MatchAvailabilityPollServiceImplTest` — each extended: a section-scoped caller's list is filtered to their own accessible sections and no further; an explicit `sectionId` filter narrows correctly and is rejected (403) if outside the caller's reach or (404) if it belongs to a different club; a club-wide caller's result set is provably identical to before this spec (a regression guard, not just a new-behaviour test); the untagged-player and zero-resolved-section-match fallback-to-club-wide-only cases |
| Integration | `MatchRepositoryTest` extended — `findByClubIdAndSectionIdIn` returns only matches with at least one own-club team side in the given sections, excludes a match with neither side in scope, still pages correctly (not silently unpaginated); `RoleAssignmentRepositoryTest` extended — `findByPersonIdAndRoleAndScopeType` returns exactly the `SECTION`-scope rows for a person, excluding their own `CLUB`-scope rows and another person's rows. New/extended `*ControllerIntegrationTest`s across `PlayerController`/`TeamController`/`MatchController`/`TeamSquadController`/`MatchSideController`/`MatchAvailabilityPollController` — a real `SECTION`-scope `CLUB_ADMIN` (granted via `RoleAssignmentRepository.save(...)` directly in test setup, per this spec's own Non-goals) succeeding only within their section and getting `403` outside it through the real HTTP layer, a `CLUB`-scope admin's full access proven unchanged end-to-end, `platform_admin` superset unaffected, `LeagueController`/`SeasonController` proven to still reject a pure `SECTION`-scope caller with `403` exactly as before this spec |
| Contract | Every touched endpoint's new optional `sectionId` query parameter documented in the checked-in OpenAPI schema; no response shape changes |
| Component | `SectionTreeSelect.test.tsx` extended — `allowClear` renders the "All sections" row, selecting it calls `onChange(null)`, the trigger displays `allLabel` when `value` is `null` and `allowClear` is set, existing non-`allowClear` behaviour (used by `TeamForm`) unchanged; `PlayerList.test.tsx`/`TeamDirectory.test.tsx`/`MatchList.test.tsx`/`AvailabilityPollsDashboard.test.tsx` each extended — the filter control renders, selecting a section re-fetches with the right query param, clearing it removes the param |
| End-to-end | New golden path: with a `SECTION`-scope `CLUB_ADMIN` seeded against one section of a club that has at least two sections' worth of players/teams/matches, log in as that admin and confirm `/manage/players`, `/manage/teams`, `/manage/fixtures/matches`, and the Availability dashboard each show only that section's data by default; use the section filter to narrow further within the grant; attempt to navigate directly to a different section's team/match edit URL and confirm a clean `403`/access-denied experience, not a broken page. Extends, rather than replaces, the existing golden paths for `026`/`028`/`029`/`032`/`034` (run as a `CLUB`-scope admin, unchanged). Not wired into CI, same precedent as every prior `/manage` spec |

## Acceptance Criteria

- A person holding only a `SECTION`-scope `CLUB_ADMIN` `RoleAssignment` sees and can administer only players, teams, matches, team squads, match sides, and availability polls within that section and its descendants — enforced server-side, not bypassable via any client-supplied parameter.
- A person holding a `CLUB`-scope `CLUB_ADMIN` `RoleAssignment` (or `platform_admin`) sees and can administer exactly what they could before this spec shipped — no narrowing, proven by a regression test on every touched endpoint.
- The same `SectionTreeSelect` filter control, extended with an "All sections" clear option, is reused identically across Players, Teams (club-wide directory), Matches, and the Availability dashboard — no bespoke per-screen filter UI.
- `League`, `Season`, and `LeagueAffiliation` administration remains reachable only by a `CLUB`-scope admin (or `platform_admin`) — a pure `SECTION`-scope caller gets `403` attempting any of those endpoints, exactly as before this spec.
- A cross-club id (a section, team, or match belonging to a different club) still returns `404`; a same-club id outside the caller's own section grant returns `403` — the two cases are never confused with each other.
- A `SECTION`-scoped `RoleAssignment` row is creatable and testable via `RoleAssignmentRepository` directly, with no dependency on a grant/revoke admin UI existing.
- `TeamSquadMember`/`MatchSide` administration is section-scoped via the squad's/side's own `Team`; `034`'s open-polls dashboard endpoint ships section-aware from its first implementation, per this spec's amendment to its draft contract.

## Rollout Notes

- **Ships as its own PR**, on top of `025`/`026`/`028`/`029`/`032`'s already-built surfaces. `034` is not yet built as of this spec — recommended sequencing is to build `034` first, exactly as its own spec describes (club-wide, unscoped, so its own golden path and tests land cleanly against a simpler baseline), then land this spec's amendment to it, matching how this spec treats `034` as a surface it extends rather than one it's bundled with. Shipping both in a single PR is also fine if that's more convenient — the two remain independently reviewable specs either way.
- **A human should update `docs/roadmap.md`'s "Blocked on the full tenancy model" section once this ships** — the `SECTION`-scoped `RoleAssignment` resolution bullet (and its section-filter sub-clause naming `PlayerList`/`MatchList`/`TeamList`/`034`) is resolved; the "UI to grant/revoke `RoleAssignment` rows" bullet stays open, now explicitly including `SECTION`-scope grants alongside `CLUB`-scope ones as a still-unbuilt self-service capability; `TEAM`-scoped resolution remains blocked exactly as before, now the sole remaining reserved-but-unresolved `ScopeType`.
- **This is the first spec to give `RoleAssignmentRole.CLUB_ADMIN` a second `scope_type`.** A human should add a footnote to `001-tenancy-identity-model.md`'s Field Reference table for the `RoleAssignment` row, in the same style as `Person`/`Section`/`Team`'s own footnotes, noting that `SECTION` is now real/resolved alongside `CLUB`, and pointing at this spec's Data Model Changes drift note for why no new role value was added.
- **`034`'s own Non-goals line — "Section-scoped visibility... needs its own spec... not a one-off fix bolted onto this dashboard alone" — is what this spec resolves**, for `034` and for the four other areas named in that same sentence together, not `034` alone.
- **`MANAGER`'s `RoleAssignmentRole` value remains entirely unused** after this spec, unchanged from every prior spec's posture — this spec only extends `CLUB_ADMIN`'s reach, it doesn't design what a section-scoped `MANAGER` grant would even mean (a real, separate future question, likely tied to whatever `TEAM`-scope resolution eventually needs).
- **The `PUT`/`POST` body-based `assertCanAdministerAnySection`/`assertCanAdministerSection` calls (`Match` create, `Player` update/deactivate/reactivate) are a new pattern for this codebase — a service-layer authorization check that isn't expressible as `@PreAuthorize` SpEL alone.** Flagged explicitly so a future reviewer treats it as the deliberate precedent it is (see API Contract's dedicated note), not an inconsistency against `docs/standards/backend.md`'s otherwise-uniform `@PreAuthorize`-at-the-controller shape.
