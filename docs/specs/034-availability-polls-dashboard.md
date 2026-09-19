# 034 — Availability Polls Dashboard

**Depends on:** `032-match-availability-polls.md` (`MatchAvailabilityPoll`/`PlayerAvailability`, `AvailabilityStatus`, `MatchAvailabilityPollService`/`Impl`, `MatchAvailabilityPollController`'s existing `/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls` family, `AvailabilityPollSquadResolver` — this spec's only data source, extended, not redefined; `MatchAvailabilityTab.tsx`'s tinted-status visual language, reused verbatim, and its admin-override `setPlayerStatus` action, deep-linked into rather than duplicated), `033-availability-aware-xi-builder.md` (confirms the `alpha(theme.palette.success/error/warning.main, ...)` tinted convention is this feature area's settled visual language — reused again here, not reinvented), `029-league-management.md` (`Match`, `MatchSide`, `TeamSquadMember`, `MatchList.tsx`'s established match-identity display — home/away team name resolution, date/venue fields — reused for this spec's own match-identifying info), `028-players.md` (`PlayerProfile` — the identity each avatar in this spec renders), `031-jersey-numbers.md` (`squadJerseyNumber`, shown in every avatar's tooltip, matching `MatchAvailabilityTab`'s own display convention), `020-club-manager-access.md` (`/api/v1/manage/**` + `@access.canAdministerClub`, reused unmodified for the one new endpoint this spec adds), `001-tenancy-identity-model.md` (`Club` as the tenant boundary this spec's new endpoint is scoped to).
**Status:** draft.

## Problem & Goals

`032` built the entire availability-poll mechanism — open/close, response counts, a public self-service link, and (added after live review, per its own `MatchAvailabilityTab.tsx`) an admin override — but deliberately shipped no cross-match view of it: "polls are managed per-match, from each match's own Availability tab — there is no cross-match 'all my open polls' admin view" (`032` Rollout Notes). `ManagerDashboard`'s own "Availability Polls" card (`ui/src/pages/manage/ManagerDashboard.tsx:47`) and the `/manage/availability` route it points to have stood in for that ever since as a stub `EmptyState` telling the admin to go find the right match themselves (`ui/src/App.tsx:166-174`). `032` named this explicitly as a real, scoped future addition once clubs are running several concurrent polls, "a paginated list mirroring `MatchList`'s own shape" — this spec is that future addition, picking it up directly.

**Goals**
- Clicking the dashboard's "Availability Polls" card takes a club admin to a real list of every currently-open poll across the whole club — no more "go find the match yourself."
- Each open poll's card shows, per response option (Available/Unsure/Unavailable), a compact avatar-plus-count summary of who responded that way — not a bare number — reusing this codebase's existing avatar/initials convention.
- Each card's Edit action deep-links straight into that poll's own, already-built `MatchAvailabilityTab` on `MatchFormPage` — the one and only place marking/overriding a response happens, unchanged.
- One new backend endpoint aggregates this across matches in a single call, owned by the service layer, following `docs/standards/backend.md`'s controller/service/repository shape exactly.

## Non-goals

- **The login-gated player-side "My Availability" view.** Tracked separately in `docs/roadmap.md` (~line 93, "Blocked on the full tenancy model" section, the paragraph beginning "**Resolved by `032-match-availability-polls.md`**...") as still open and explicitly blocked on `RoleAssignmentRole.PLAYER` not being grantable yet (`028`/`015`). This spec is admin-dashboard-only; no part of a logged-in player's own view is designed here.
- **Any new poll action.** No create/open/close/admin-override-status UI on this dashboard. Every one of those already lives on `MatchAvailabilityTab` (`032`, extended by the admin-override addition after `032` shipped) — this spec's card is read-summary-plus-navigate only, deep-linking into that existing surface rather than rebuilding any slice of it. Per the feature request's own framing: the per-match marking flow is already solved and stays exactly as-is.
- **Closed or historical polls.** Only currently-*open* polls are listed, matching the dashboard card's own "Ask who's available" framing — an admin's actual, immediate question is "who hasn't answered yet on what's still live." A "closed/all polls ever" browsing view is real, plausible future scope (e.g. a season-long poll-response history) but not built here; nothing in this spec's data model blocks adding one later.
- **Pagination.** Deliberately not applied here even though `032`'s own Rollout Notes speculated this future list would mirror `MatchList`'s paginated shape — that speculation assumed an unscoped "all polls" list; scoping this one to *open* polls only changes the growth characteristic entirely (a poll leaves the set the moment it's closed, so the set size is bounded by "how many matches this club has live availability questions on right now," not by match history). See API Contract for the full reasoning — this mirrors `PlayerList`/`SponsorList`'s existing small-bounded-club-list precedent, not `MatchList`/`ProductList`'s unbounded one. Revisit if a real club running many simultaneous concurrent polls makes this wrong in practice.
- **The `ListToolbar`+`RecordCard`+`RecordFormScreen` record-list pattern, applied wholesale.** Addressed explicitly, not silently skipped — see UI Requirements' dedicated sub-decision below for exactly what's reused (`RecordCard`, `ManageScreenHeader`) and what's deliberately not (`ListToolbar`, `RecordFormScreen`).
- **Any change to `MatchAvailabilityTab.tsx`, `PollShareDialog.tsx`, `PlayingXiBuilder.tsx`, or any existing `/manage/clubs/{clubId}/matches/{matchId}/polls/**` endpoint.** All reused exactly as `032`/`033` (and the admin-override addition) left them.
- **A card per match when a match happens to have two simultaneously open polls (both sides real `Team`s within this club, e.g. an intra-club fixture).** This spec's list is one card *per open poll*, not one card per match with two polls merged into it — each poll has its own independent squad, responses, and share link, so merging two into one card would either drop data or invent a compound UI that doesn't exist elsewhere in this codebase. In the overwhelming majority of real matches (one side is this club's own team, the other is an opposing club's team or a free-text opponent with no poll at all) this is indistinguishable from "one card per match" — named explicitly here so it isn't mistaken for an oversight the one time it isn't.
- **Any backend change to poll creation, open/close semantics, or authorization model.** This spec adds exactly one new read-only aggregation endpoint under the existing `@access.canAdministerClub` rule — no new business rule, no new exception type, no migration.
- **Filtering the open-polls list by `Section`.** This screen is club-wide, matching every other `/manage` list screen's current behaviour (`PlayerList`, `MatchList`) — none of them filter by section today. Section-scoped visibility is a real, designed-but-unbuilt part of the tenancy model (`001`'s `RoleAssignment{scope_type=SECTION}`, `ScopeType`'s reserved `SECTION` value) already tracked as an open, cross-cutting gap in `docs/roadmap.md` ("Blocked on the full tenancy model" section) — it affects every club-wide list screen, not just this one, and needs its own spec covering `AccessService`/`RoleAssignmentRole` resolution plus filters across Players/Teams/Matches/Availability together, not a one-off fix bolted onto this dashboard alone.

## User Stories

- As a club admin, I can click the "Availability Polls" dashboard card and land on a real list of every currently-open poll across my club, without first having to know which match it's on.
- As a club admin looking at that list, I can see, for each poll, which match/side it's for and — per response option — who's responded Available, Unsure, or Unavailable, as avatars plus a count, at a glance, without opening the poll itself.
- As a club admin, I can click a poll's Edit action and land directly on that match's own Availability tab, on the correct side's sub-tab, ready to mark or override a response — the exact same screen `032`/`033` already built, reached one click sooner.
- As a club admin with no currently-open polls, I see a clear empty state telling me polls are opened from a match's own Availability tab, not a blank or broken screen.
- As a club admin for club X, I cannot see club Y's open polls on this dashboard, even indirectly — enforced server-side by the same `@access.canAdministerClub` rule every other `/manage` endpoint already uses.

## Data Model Changes

None. This spec adds no entity, no field, no migration — every value it displays already exists on `MatchAvailabilityPoll`/`PlayerAvailability`/`Match`/`TeamSquadMember` (`032`, `029`, `031`). It is a read-only aggregation across rows that already exist, exposed through one new DTO shape (see API Contract) rather than any new table.

## API Contract

**One new endpoint**, added to the existing `MatchAvailabilityPollController` (same file, same `@access.canAdministerClub` rule, same `/api/v1/manage/**` namespace) since it's the same REST resource family — a club-scoped sibling of the existing match-scoped poll endpoints, not a new controller:

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/availability-polls/open` | `@access.canAdministerClub` | Every currently-open `MatchAvailabilityPoll` whose owning `Match.clubId` equals `clubId` (the same club-scoping rule `032` already established for the match-nested poll endpoints), aggregated with its match context and a per-status respondent summary in one call. Sorted by the poll's own match `matchDate` ascending (soonest match first) — the ordering a club admin actually cares about ("what do I need to chase before the next match"). Returns `[]`, not a 404, when the club has no open polls. |

**Response shape — `OpenAvailabilityPollDto`** (new record, `com.cricketlegend.dto`):

```java
public record OpenAvailabilityPollDto(
    UUID pollId,
    UUID matchId,
    UUID teamId,           // this poll's own side — matches Match.homeTeamId or Match.awayTeamId
    UUID homeTeamId,
    String homeTeamName,   // exactly one of homeTeamId/homeTeamName is non-null, per Match's own
    UUID awayTeamId,       // invariant (029) — frontend resolves the null one the same way
    String awayTeamName,   // MatchList.tsx/MatchFormPage.tsx already do (join against the club's
                            // own team list), not re-solved server-side, per Reuse-before-write
    Instant matchDate,
    String venue,           // nullable, matches Match.venue
    long availableCount,
    long unavailableCount,
    long unsureCount,
    long noResponseCount,
    List<AvailabilityRespondentDto> availableRespondents,
    List<AvailabilityRespondentDto> unavailableRespondents,
    List<AvailabilityRespondentDto> unsureRespondents) {
}

public record AvailabilityRespondentDto(
    UUID playerProfileId,
    String firstName,
    String lastName,
    Integer squadJerseyNumber) {
}
```

`*Count` fields are kept alongside the respondent lists (rather than the frontend computing `respondents.length` itself) purely for shape-consistency with the already-shipped `MatchAvailabilityPollDto`/`MatchAvailabilityPollResponsesDto`, which both already carry explicit count fields — not because the count can't be derived, but so a frontend consumer never has to remember which of two equivalent DTOs computes counts itself and which doesn't. `AvailabilityRespondentDto` reuses `PlayerAvailabilityRowDto`'s own field set minus `status` (implied by which of the three lists an entry is in) rather than reusing `PlayerAvailabilityRowDto` itself — a status field that's always the same value for every entry in a given list would be redundant noise on every single row.

**Service layer owns the aggregation** (`MatchAvailabilityPollService.listOpenForClub(UUID clubId)` / `MatchAvailabilityPollServiceImpl`, matching this spec's controller-stays-thin instruction and `docs/standards/backend.md`'s skeleton) — the controller method is a one-line pass-through, identical in shape to every other method already on this controller:

```java
@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
@GetMapping("/api/v1/manage/clubs/{clubId}/availability-polls/open")
public ResponseEntity<List<OpenAvailabilityPollDto>> listOpen(@PathVariable UUID clubId) {
    return ResponseEntity.ok(matchAvailabilityPollService.listOpenForClub(clubId));
}
```

`MatchAvailabilityPollServiceImpl.listOpenForClub`:
1. Fetches every open `MatchAvailabilityPoll` whose `matchId` belongs to a `Match` with this `clubId`, via a new repository method (below) — a single query, not N+1.
2. Batch-fetches the distinct `Match`es referenced (`matchRepository.findAllById(...)`) rather than one lookup per poll.
3. For each poll, reuses the exact same `AvailabilityPollSquadResolver.resolveSquadRows(teamId, seasonId)` + `PlayerAvailabilityRepository.findByPollId(pollId)` overlay `rowsWithStatuses` already performs for `getResponses`/`setPlayerStatus` — no new squad-resolution logic — then buckets the resulting rows into `availableRespondents`/`unavailableRespondents`/`unsureRespondents` by `status`, sorted `lastName, firstName` within each bucket (matching `PlayerList`'s own name-sort convention).
4. Sorts the final list by each poll's own `Match.matchDate` ascending.

**New repository method** (`MatchAvailabilityPollRepository`), a plain JPQL subquery against `Match`'s own `clubId` — matching this codebase's existing flat-FK style (`MatchAvailabilityPoll` stores `matchId`/`teamId` as raw UUIDs, no mapped `@ManyToOne`, so this is a JPQL join by field value, not a navigated association):

```java
@Query("SELECT p FROM MatchAvailabilityPoll p WHERE p.open = true "
     + "AND p.matchId IN (SELECT m.id FROM Match m WHERE m.clubId = :clubId)")
List<MatchAvailabilityPoll> findOpenByMatchClubId(@Param("clubId") UUID clubId);
```

**Why this list is not `Page<T>`, stated explicitly per `docs/standards/backend.md`'s pagination rule:** the rule targets result sets that can grow unbounded (a club's full match history, its full product catalog). This endpoint returns only *currently-open* polls — a poll leaves the set the instant it's closed, so its size is bounded by "how many matches this club has a live availability question on right now," structurally closer to `PlayerList`/`SponsorList`'s small, bounded, fetched-in-full club lists than to `MatchList`/`ProductList`'s ever-growing paginated ones. `032`'s own Rollout Notes speculated this future list would mirror `MatchList`'s paginated shape — that speculation assumed an unscoped "every poll" list; scoping to *open only* is exactly what changes the growth characteristic, so this spec deliberately diverges from that speculation rather than quietly building around it.

Every other endpoint under `/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/**` is unchanged — this spec adds one endpoint, changes zero others.

## UI Requirements

**Record-list pattern: a deliberate, partial adoption, named explicitly per `docs/standards/design-system.md`'s Record list / create-edit pattern.** This screen reuses `RecordCard` (grid unit, one card per open poll) and `ManageScreenHeader` (page title/back action, since this is a bare list, not a form) — the same visual family every other `/manage` list uses, for consistency. It deliberately does **not** use `ListToolbar` or `RecordFormScreen`:
- `ListToolbar` bundles search, sort, *and* a mandatory `createLabel`/`onCreate` action into one component (`ui/src/components/ListToolbar/ListToolbar.tsx` — `createLabel: string` is required, not optional). This screen has no create action of its own — a poll is created from a match's own Availability tab (`032`), not from this dashboard — and no real need for search/sort on a small, bounded, single-purpose "what needs my attention right now" view. Forcing a fake create button into `ListToolbar` just to reuse it would be worse than skipping it.
- `RecordFormScreen` wraps a create/edit form. This screen has no form — every field is read-only, and the one action (Edit) navigates away rather than opening one.

This mirrors `RecordCard`'s own established use elsewhere for a read-mostly, single-footer-action list (e.g. `PlayerList`'s deactivate/reactivate-only cards), not a new exception invented for this spec.

**One genuinely new shared component, flagged for a Claude Design pass before build** (`docs/workflow.md` Step 2, the same precedent `032` set for `MatchAvailabilityTab`/`PublicAvailabilityPoll` and `033` explicitly declined to need for its own, narrower reuse) — this is the first use of MUI's `AvatarGroup` anywhere in this codebase, and the first time this codebase renders a *group* of person-avatars rather than one:

- **`ui/src/components/AvailabilityRespondentAvatars/`** (new, four-file anatomy) — a compact row: an MUI `AvatarGroup` (`max={4}`, MUI's own default overflow "+N" avatar beyond that) of small `Avatar`s, each rendering `initialsFromName(...)` (`ui/src/utils/initials.ts`, reused unmodified — the exact fallback `RecordCard`/`PlayerCard` already use) inside a `Tooltip` showing that player's full name plus `squadJerseyNumber` if set (the same `#{jersey} {name}` format `MatchAvailabilityTab.tsx`'s private `squadDisplayName` helper already computes — pulled out to a shared `ui/src/utils/squadDisplayName.ts` and imported by both, rather than a second, copy-pasted formatter), plus an explicit count label next to the group (`"3 Available"`, not just the avatars) so the count is never solely inferred from an overflow "+N" avatar. Each avatar is tinted per status, reusing `MatchAvailabilityTab.tsx`'s exact `alpha(theme.palette.success/error/warning.main, 0.12)` background / `${status}.dark` initials-text convention (also pulled out to a shared `STATUS_COLOR`/`STATUS_LABEL` constant map alongside `squadDisplayName`, reused by `MatchAvailabilityTab.tsx` unmodified rather than duplicated a second time — Reuse-before-write). Props:

```ts
export interface AvailabilityRespondentAvatarsProps {
  status: AvailabilityStatus            // 'AVAILABLE' | 'UNAVAILABLE' | 'UNSURE' — drives tint/label
  respondents: AvailabilityRespondent[] // {playerProfileId, firstName, lastName, squadJerseyNumber}
  count: number                         // from the DTO's own countfield, see API Contract
}
```

- No indicator/avatars for "No response" — out of scope per the feature request (three response options only); `noResponseCount` renders as a plain number, reusing `MatchAvailabilityTab.tsx`'s existing neutral `SummaryTile` treatment (`tone: null`) rather than inventing a fourth avatar-group variant for a bucket with no specific respondents to show avatars of.

**`ui/src/pages/manage/AvailabilityPollsDashboard.tsx`** (new page, replaces the `/manage/availability` stub):

- `ManageScreenHeader title="Availability Polls"` (default `backTo="/manage"`, matching the card's own origin).
- Fetches `GET /availability-polls/open` via a new `listOpenPolls(clubId)` in `matchAvailabilityApi.ts`, React Query key `['managed-club', clubId, 'availability-polls', 'open']`.
- Also fetches the club's team list (`listTeamsForClub`, already used identically by `MatchList.tsx`/`MatchFormPage.tsx`) to resolve whichever of `homeTeamName`/`awayTeamName` is `null` into a real `Team.name`, via the exact same `sideDisplayName`/`sideName` join pattern those two files already use — not a new resolution helper.
- One `RecordCard` per open poll, grid layout identical to `PlayerList`/`MatchList` (`xs: 1fr`, `sm: repeat(2, 1fr)`, `md: repeat(3, 1fr)`):
  - `avatar`: `{ fallback: <EventAvailableOutlinedIcon fontSize="small" />, shape: 'rounded' }` — matching the dashboard nav card's own icon, `rounded` per `RecordCard`'s "organisation/named-thing, not a person" convention (this is a poll/event record, not a person).
  - `title`: `"{homeTeamName} vs {awayTeamName}"`, identical construction to `MatchList.tsx`'s own `MatchCard` title.
  - `badge`: `{ label: teamId === match.homeTeamId ? 'Home' : 'Away', tone: 'neutral' }` — which side this specific poll/card is for, since a match can in principle have two.
  - `fields`: `Date & time` and (if set) `Venue`, reusing `matchRecordFields.ts`'s existing formatting exactly, followed by three fields — `Available`/`Unavailable`/`Unsure` — each rendering `<AvailabilityRespondentAvatars status={...} respondents={...} count={...} />`, and a fourth plain `No response` count field.
  - `editLabel`: `"Manage responses"`, `editTo`: `/manage/fixtures/matches/{matchId}/edit?tab=availability&side=home|away` (new deep-link contract, below).
- Empty state (`hasPolls === false`): `EmptyState title="No open polls" description="Open a poll for an upcoming match from its own Availability tab to see it here."` — matching this spec's own Non-goal that poll creation isn't duplicated onto this screen.
- No pagination controls (see API Contract), no `ListToolbar` (see above).

**`ui/src/pages/manage/MatchFormPage.tsx` — small, existing-pattern extension, the only new navigation behaviour this spec needs.** The page already deep-links `?tab=playing-xi` straight to the first XI sub-tab (its existing `useEffect` reading `searchParams`, `ui/src/pages/manage/MatchFormPage.tsx` lines ~369-376). That same effect gains one more case: `?tab=availability&side=home|away` selects `availabilityTabIndex` and sets `activeAvailabilitySubTab` to `0` (home) or the away sub-tab's own index (mirroring `homeAvailabilitySubIndex`/`awayAvailabilitySubIndex`'s existing computation just above it) — the exact same mechanism, one more recognized query-string shape, not a new deep-linking system. This is the entirety of the "reuse `MatchAvailabilityTab` as-is" requirement — no new marking UI, no new component on `MatchFormPage` itself.

**`ui/src/api/matchAvailabilityApi.ts`** — one new function:

```ts
export interface OpenAvailabilityPoll {
  pollId: string
  matchId: string
  teamId: string
  homeTeamId: string | null
  homeTeamName: string | null
  awayTeamId: string | null
  awayTeamName: string | null
  matchDate: string
  venue: string | null
  availableCount: number
  unavailableCount: number
  unsureCount: number
  noResponseCount: number
  availableRespondents: AvailabilityRespondent[]
  unavailableRespondents: AvailabilityRespondent[]
  unsureRespondents: AvailabilityRespondent[]
}
export interface AvailabilityRespondent {
  playerProfileId: string
  firstName: string
  lastName: string
  squadJerseyNumber: number | null
}
export async function listOpenPolls(clubId: string): Promise<OpenAvailabilityPoll[]>
```

**`ui/src/App.tsx`** — the `/manage/availability` route's element changes from the current stub `EmptyState` to `<AvailabilityPollsDashboard />`. `ManagerDashboard.tsx`'s "Availability Polls" `NavTile` (`to: '/manage/availability'`) is unchanged — it already points at the right place, only its destination's content changes.

**Mobile-first**, per `docs/standards/frontend.md` — `AvailabilityRespondentAvatars`' avatar group + count stays a single compact row at 375px (MUI's own `AvatarGroup` sizing, no custom breakpoint math needed); `RecordCard`'s existing `fields` row already wraps (`flexWrap`), so four summary fields stacking to multiple lines on a narrow viewport is the existing, already-mobile-safe behaviour, not new.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `MatchAvailabilityPollServiceImplTest` extended — `listOpenForClub`: returns one entry per open poll scoped to `clubId` (a different club's open poll excluded), correctly buckets respondents into available/unavailable/unsure by status with a `null`-status squad member excluded from all three, `noResponseCount` matches the excluded count, results sorted by `matchDate` ascending, empty list (not an error) when the club has no open polls, a closed poll on the same club excluded. |
| Integration | New repository test for `findOpenByMatchClubId` (Testcontainers) — returns only open polls whose match belongs to the given `clubId`, excludes a closed poll and a different club's poll. New controller integration test for `GET /availability-polls/open` — real `CLUB_ADMIN` success scoped to their own club, `403` for a different club's admin, `platform_admin` superset success, empty-club `200 []` (not `404`). |
| Contract | The new endpoint + `OpenAvailabilityPollDto`/`AvailabilityRespondentDto` documented in the checked-in OpenAPI schema. |
| Component | `AvailabilityRespondentAvatars.test.tsx` + Storybook story — renders one avatar per respondent up to the overflow threshold, a "+N" MUI overflow avatar beyond `max`, the explicit count label always matches the `count` prop regardless of how many avatars are actually rendered, correct tint/label per `status`, empty `respondents` renders the count with no avatars rather than an empty `AvatarGroup`. `AvailabilityPollsDashboard.test.tsx` + Storybook story — renders one `RecordCard` per open poll with correct title/badge/fields, empty state when there are no open polls, each card's Edit action links to the correct `?tab=availability&side=...` URL for its own `matchId`/side. `MatchFormPage.test.tsx` extended — `?tab=availability&side=home` and `?tab=availability&side=away` each select the correct top-level tab and sub-tab on load, matching the existing `?tab=playing-xi` test's shape. |
| End-to-end | Extends `032`'s existing golden path: with an open poll already created (from `032`'s own flow) and at least one response recorded, navigate to the dashboard via the "Availability Polls" `NavTile`, confirm the poll's card renders with the correct match title, side badge, and at least one avatar in the correct response-option bucket; click "Manage responses" and confirm it lands on `MatchFormPage`'s Availability tab, correct side's sub-tab, showing the same poll. Not wired into CI, same precedent as every prior `/manage` spec. |

## Acceptance Criteria

- Clicking the dashboard's "Availability Polls" card shows every currently-open poll across the club, one card per open poll, with no prior knowledge of which match required.
- Each card shows, per response option (Available/Unsure/Unavailable), a compact avatar-plus-count summary of who responded that way — never a bare number alone.
- Each card's Edit action navigates directly to that poll's own match/side on `MatchFormPage`'s existing Availability tab — no new marking or override UI exists anywhere on the dashboard itself.
- A club with no open polls sees a clear empty state, not a blank or broken screen.
- A club admin for club X cannot see club Y's open polls on this dashboard, enforced server-side by the same `@access.canAdministerClub` rule as every other `/manage` endpoint.
- No existing poll endpoint, `MatchAvailabilityTab`, `PollShareDialog`, or `PlayingXiBuilder` behaviour changed.
- The new `GET /availability-polls/open` endpoint returns a plain array (not `Page<T>`), consistent with this spec's stated pagination reasoning.

## Rollout Notes

- **Resolves the specific future item `032`'s own Rollout Notes named**: "No standalone `/manage/availability` poll-list screen is built in this pass... If that turns out to be a real want once clubs are running several concurrent polls, it's a natural, scoped future addition (a paginated list mirroring `MatchList`'s own shape), not built here." This spec is that addition — deliberately *not* paginated, for the reasons stated in API Contract, a considered divergence from `032`'s own speculation, not an oversight.
- **One new shared component (`AvailabilityRespondentAvatars`) needs a Claude Design pass before build** — the first `AvatarGroup` usage and the first multi-person-avatar rendering in this codebase, even though every primitive it composes (`Avatar`, `initialsFromName`, the `success`/`error`/`warning` tint convention) is already approved and shipped. Flagged explicitly per `docs/standards/design-system.md`'s Workflow step 4, matching `032`'s own precedent for a genuinely new pattern rather than `033`'s precedent for declining one.
- **Two small, drive-by extractions this spec's UI Requirements calls for**, both reuse-before-write rather than new logic: `squadDisplayName` and the `STATUS_COLOR`/`STATUS_LABEL` maps move out of `MatchAvailabilityTab.tsx`'s private scope into shared `ui/src/utils/` modules, imported by both `MatchAvailabilityTab.tsx` (unmodified behaviour) and the new `AvailabilityRespondentAvatars`. Whoever builds this spec should do the extraction as part of this PR, not duplicate the logic a second time first and refactor later.
- **Frontend-plus-one-endpoint PR** — one new backend endpoint (`GET /availability-polls/open`), one new DTO pair, one new repository query; everything else is new/extended frontend on top of `032`/`033`'s already-shipped surfaces. No migration.
- **The player-side "My Availability" view stays exactly as open as `032` left it** — this spec doesn't touch it, doesn't narrow it, and doesn't change what it's blocked on (`028`/`015`'s `RoleAssignmentRole.PLAYER` gap). No `docs/roadmap.md` edit needed for that item; a human should, however, add a line noting `032`'s own "no standalone poll-list screen" forward-reference is now resolved by this spec, in the same roadmap paragraph that currently cites `032`.
