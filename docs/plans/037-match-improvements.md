# Implementation Plan — 037: Match Improvements

## Context

Real click-through use of `/manage/fixtures/matches` and the Playing XI builder surfaced eight
concrete problems, specified in `docs/specs/037-match-improvements.md` (status: draft). They're
grouped into one spec because they all touch the same three screens — `MatchList.tsx`,
`MatchFormPage.tsx` (via `MatchSideTab`/`PlayingXiBuilder.tsx`), and `MatchDetailPage.tsx` — and
shipping them separately would mean repeatedly re-touching the same files for unrelated reasons.

One item is a real bug (captain/wicketkeeper/twelfth-man selections clearing each other via an
incomplete PUT payload), one is a new backend query param (upcoming-only filtering), and the rest
are UI/UX additions or reorderings on top of already-shipped entities (`029-league-management.md`,
`033-availability-aware-xi-builder.md`, `028-players.md`). No new entity, no schema migration.

**Items 1–8 below were already fully implemented, tested, and merged (PR #40) before a ninth item
— "Re-select from Previous Match" — was added to the spec.** Item 9's own plan is Section 4 below,
planned and grounded separately once 1–8 were confirmed complete on `master`.

Verified directly against the current code (not just the spec's own claims) before writing this
plan:
- `ui/src/pages/manage/MatchList.tsx` — the list, its `ListToolbar`/`SectionTreeSelect` filter
  layout, `MatchCard`'s `secondaryActions`.
- `ui/src/components/PlayingXiBuilder/PlayingXiBuilder.tsx` — batting-order arrows, the
  Captain/Wicketkeeper/Twelfth Man `Select` block (currently last, after Playing XI).
- `ui/src/pages/manage/MatchFormPage.tsx` (`MatchSideTab`) — confirmed the exact bug: `onChangeCaptain`
  etc. call `updateSideMutation.mutate({ captainPlayerId: id })`, a single-field object.
- `backend/.../service/impl/MatchSideServiceImpl.java` (`updateSide`, ~line 165 area) —
  unconditionally does `side.setCaptainPlayerId(request.captainPlayerId())` /
  `setWicketKeeperPlayerId(...)` / `setTwelfthManPlayerId(...)` for **all three** fields every
  call, and `UpdateMatchSideRequest` is a plain 3-field record with no partial-update semantics
  (its own Javadoc: "sets (or clears, when null)"). Confirms the fix must be frontend-only: send
  all three fields, merging in the two untouched current values.
- `reorderPlayers` in the same file requires the request's `playerProfileIds` to be an exact
  permutation of the side's current players — confirms the stepper (item 7) can reuse this
  endpoint unchanged, no new backend endpoint needed.
- `ui/src/components/RecordCard/RecordCard.tsx` — `secondaryActions: RecordCardSecondaryAction[]`
  already exists and is generic (pending/onClick/icon), reused as-is for item 2's list-card button.
- `ui/src/components/RecordDetailScreen/RecordDetailScreen.tsx` — has no secondary-action slot
  today; needs one new additive prop for item 2's detail-page button.
- `ui/src/components/ListToolbar/ListToolbar.tsx` — Sort-by `Select` is hard-coded
  `flex: { xs: 1, md: '0 0 200px' }`; `MatchList`'s own sort labels ("Match date (newest first)")
  are the longest in the app and clip in that fixed width — confirms item 4's fix location.
- `ui/src/components/CreateAndLinkRecordDialog/CreateAndLinkRecordDialog.tsx` +
  `ui/src/components/PlayerForm/PlayerForm.tsx` (`PLAYER_FORM_ID`, `activeTab: 0|1|2` prop,
  `onSubmit`) — confirmed reusable verbatim for item 8, same pattern `TeamFormPage.tsx` already
  uses for Contacts/Sponsors.
- `ui/src/api/playerApi.ts` (`createPlayer(clubId, payload) -> Player`, `Player.id` **is** the
  `playerProfileId`) + `ui/src/api/teamSquadApi.ts` (`addToSquad(clubId, teamId, seasonId,
  playerId)`) — confirms item 8's two-step mutation: create player, then add
  `newPlayer.id` to the squad.
- `backend/.../domain/Match.java` — `matchDate` is `Instant`, not `LocalDate`. No existing
  club-timezone concept in the backend (only precedent: `ZoneId.systemDefault()` in
  `EmailTestSendServiceImpl`). Item 1's "upcoming" cutoff will use `ZoneId.systemDefault()` for
  now, same precedent — flagged as a known simplification, not a club-timezone feature.
- `backend/.../repository/MatchRepository.java` / `MatchController.java` /
  `MatchServiceImpl.list()` — `list()` branches on `sectionId` across three repository methods
  (`findByClubIdAndSectionIdIn` twice, `findByClubId` once); item 1's `upcomingOnly` filter must be
  threaded through all three branches, not just one.

## Approach

Three slices, in this order (backend must land before the frontend piece that depends on it):

### 1. Backend — `backend-builder` (item 1 only; everything else needs no backend change)

- `MatchController.list(...)`: add `@RequestParam(required = false, defaultValue = "false") boolean upcomingOnly`, pass through to the service.
- `MatchServiceImpl.list(...)`: accept `upcomingOnly`; when `true`, compute `Instant startOfToday = LocalDate.now(ZoneId.systemDefault()).atStartOfDay(ZoneId.systemDefault()).toInstant()` and add a `matchDate >= startOfToday` condition to whichever of the three repository calls the existing `sectionId`/`accessibleSectionIds` branching selects — add new repository methods (`findByClubIdAndMatchDateGreaterThanEqual`, `findByClubIdAndSectionIdInAndMatchDateGreaterThanEqual`) rather than bolting a boolean onto the existing ones, keeping each method's name self-documenting per `docs/standards/backend.md`'s "specific over generic" spirit. When `upcomingOnly` is `false` (the default for any caller not yet updated), behavior is byte-for-byte unchanged — purely additive.
- `MatchRepository`: add the two new derived-query methods above.
- No DTO change, no migration, no new exception type.
- Files: `MatchController.java`, `MatchService.java` (interface), `MatchServiceImpl.java`, `MatchRepository.java`.

### 2. Frontend — `frontend-builder`

Work through in this order (each is independent except where noted):

**Item 1 — upcoming-only default.** `ui/src/api/matchApi.ts`: add `upcomingOnly?: boolean` to `ListMatchesParams`, send it in `listMatches`'s params. `MatchList.tsx`: send `upcomingOnly: true` in the query (both the `listMatches` call and the query key), no new UI control. `SquadPicker.tsx` inherits this for free since it renders `MatchList` unchanged.

**Item 2 — "Select Team" shortcut.**
- `MatchList.tsx`'s `MatchCard`: add one more entry to `RecordCard`'s `secondaryActions` array — label "Select Team", icon `GroupsOutlined`, `onClick: () => navigate(\`${editTo}?tab=playing-xi\`)`, `pending: false`. Guard with `Boolean(match.homeTeamId) || Boolean(match.awayTeamId)` (no real-Team side ⇒ no Playing XI tab to jump to — omit the action entirely).
- `RecordDetailScreen.tsx`: add one new, additive, optional prop `secondaryActions?: { label: string; to: string; icon?: ReactNode }[]`, rendered as outlined/text buttons in the header before the existing `editTo` button. Link-shaped (`to`, `RouterLink`), not callback-shaped — matches this component's existing `editTo` being a link, unlike `RecordCard`'s callback-shaped actions.
- `MatchDetailPage.tsx`: pass one `secondaryActions` entry ("Select Team", `to: `/manage/fixtures/matches/${match.id}/edit?tab=playing-xi``), same real-Team-side guard.
- `MatchFormPage.tsx` already handles `?tab=playing-xi` (existing `useEffect` reading `searchParams`) — no change needed there.

**Items 3 & 4 — filters bar cleanup + Sort-by clipping**, both scoped to `MatchList.tsx`/`ListToolbar.tsx`:
- `ListToolbar.tsx`: add one new, additive, optional prop `sortMinWidth?: number` (default `200`, preserving today's width everywhere else), used in place of the hard-coded `'0 0 200px'` for the `md` breakpoint flex-basis on the Sort-by `Select`.
- `MatchList.tsx`: pass `sortMinWidth={260}` (or whatever value fits "Match date (newest first)" without clipping — verify visually per Verification below).
- `MatchList.tsx`: wrap `ListToolbar` + the `SectionTreeSelect` `Box` in one bordered/tinted container (reuse the `alpha(theme.palette.primary.main, 0.05)`-tinted, bordered `Box` treatment `RecordCard` already establishes — `docs/standards/design-system.md`'s Record list pattern) so the two read as one control group instead of two disconnected rows.

**Item 5 — bug fix, captain/WK/12th-man clearing each other.** `MatchFormPage.tsx`'s `MatchSideTab`: change `onChangeCaptain`/`onChangeWicketKeeper`/`onChangeTwelfthMan` to each send all three fields, merging in `side`'s current values for the two not being changed, e.g.:
  ```
  onChangeCaptain={(id) => updateSideMutation.mutate({
    captainPlayerId: id,
    wicketKeeperPlayerId: side.wicketKeeperPlayerId,
    twelfthManPlayerId: side.twelfthManPlayerId,
  })}
  ```
  and the equivalent for the other two handlers. `PlayingXiBuilder.tsx` itself is unchanged — its props already only ever carry the single new id.

**Item 6 — reorder Captain/WK/12th-man above Playing XI.** `PlayingXiBuilder.tsx`: move the three-`Select` `Box` (currently the last block) to render first, before the "Playing XI" heading/progress bar/list/"Add player" row. Pure JSX reordering — no prop or option-scoping change.

**Item 7 — click-to-edit batting-order stepper.** `PlayingXiBuilder.tsx`: replace the static `<Typography>{entry.battingOrder}</Typography>` with a click-to-edit control — plain text by default; click swaps in a small `Input type="number"` (`inputProps={{ min: 1, max: 12, step: 1 }}`), auto-focused; commits on blur/Enter. Commit logic: clamp the entered value to `[1, orderedXi.length]`, build the full reordered `playerProfileIds` array (splice the moved player out, reinsert at the clamped index — same logic shape as the existing `handleMove`), call the existing `onReorderPlayers` prop (same callback/endpoint the arrows use, confirmed above). The existing up/down `IconButton`s stay unchanged, alongside the new stepper. No drag-and-drop (confirmed no `dnd-kit`-class dependency in `ui/package.json` — out of scope per spec's Non-goals).

**Item 8 — "Add Squad Member".** `PlayingXiBuilder.tsx`: add one new, additive, optional prop `onAddSquadMember?: () => void`, rendered as a `Button` ("Add Squad Member") next to the existing "Add player" row; omitted entirely when not passed. `MatchFormPage.tsx`'s `MatchSideTab`: owns the dialog/mutation —
  - local `squadMemberDialogOpen` state, opened by `onAddSquadMember`;
  - `CreateAndLinkRecordDialog<PlayerPayload>` wrapping `PlayerForm` (both unmodified) — since `PlayerForm` externalizes its own tab bar to its caller, `MatchSideTab`'s dialog wrapper renders a small local 3-tab bar (Basic/Contact/Cricket Info), same pattern `PlayerFormPage.tsx` already uses;
  - `onCreateAndLink`: `createPlayer(clubId, payload)` then, on success, `addToSquad(clubId, teamId, seasonId, newPlayer.id)` — sequential, matching `TeamFormPage.tsx`'s existing two-step `createAndLink*Mutation` shape;
  - on success, invalidate the squad query key `['managed-club', clubId, 'teams', teamId, 'seasons', seasonId, 'squad']` (same key `squadQuery` already uses) so the new player appears in `PlayingXiBuilder`'s "Add player" `Autocomplete` immediately.

Files touched: `ui/src/api/matchApi.ts`, `ui/src/pages/manage/MatchList.tsx`,
`ui/src/pages/manage/MatchFormPage.tsx`, `ui/src/pages/manage/MatchDetailPage.tsx`,
`ui/src/components/PlayingXiBuilder/PlayingXiBuilder.tsx`,
`ui/src/components/RecordDetailScreen/RecordDetailScreen.tsx`,
`ui/src/components/ListToolbar/ListToolbar.tsx`.

### 3. Tests — `test-writer`

Per spec's own Test Plan section and `docs/standards/testing.md`'s "required per change type":
- Backend: extend `MatchServiceImplTest` (unit — `upcomingOnly` true/false × with/without `sectionId`) and `MatchControllerIntegrationTest` (integration, real Postgres via Testcontainers — past/today/future rows). Update the checked-in OpenAPI schema for the new `upcomingOnly` param (contract tier).
- Frontend component tests: `PlayingXiBuilder.test.tsx` — Captain/WK/12th-man `onChange*` callbacks still only ever receive the single new id (merge responsibility stays in `MatchSideTab`); Captain/WK/12th-man block renders before the Playing XI heading (item 6); batting-order stepper commits a correctly-reordered array via `onReorderPlayers`, clamps a too-large value (item 7); `onAddSquadMember` renders/fires only when passed (item 8). `MatchFormPage.test.tsx` — changing Captain when WK/12th-man are already set sends a merged 3-field payload (item 5's actual regression test); Add Squad Member dialog creates-then-adds-to-squad and invalidates the squad query (item 8). `MatchList.test.tsx` — `upcomingOnly: true` sent by default (item 1); "Select Team" navigates to `?tab=playing-xi` and is hidden with no real-Team side (item 2). `MatchDetailPage.test.tsx` — same "Select Team" assertions via `RecordDetailScreen`'s new prop. `RecordDetailScreen.test.tsx` — new `secondaryActions` prop renders before `editTo`, omitted when absent (no regression to other `*DetailPage`s).
- New shared-component behavior (the `ListToolbar.sortMinWidth` prop, `PlayingXiBuilder`'s stepper/reorder block) needs its own Storybook story per `docs/standards/frontend.md`'s four-file component anatomy — extend existing `.stories.tsx` files, not new ones.
- One Playwright E2E extending `029`'s golden path, per spec's own Test Plan: schedule a match dated yesterday/tomorrow → list defaults to future only; card's "Select Team" → lands on Playing XI tab; set Captain, then WK, then 12th man → all three survive; click a batting-order number, retype it → order updates; "Add Squad Member" → new player immediately selectable.

### 4. Item 9 — "Re-select from Previous Match" (`backend-builder`, `frontend-builder`, `test-writer`)

Planned and built separately, after items 1–8 were already confirmed complete on `master` — see
this section's own grounding against the current code before it started (`TeamSquadController`/
`TeamSquadServiceImpl` as the exact precedent for a `teams/{teamId}/seasons/{seasonId}/...` nested
resource; `MatchSideServiceImpl`'s `updateSide`/`addPlayer`/`removePlayer` exact signatures and
exception classes; `LinkExistingRecordDialog`'s no-`extraField` immediate-fire mode; no generic
confirm-dialog component existing anywhere in `ui/src/components/**`).

**Backend** — new `GET /api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/matches/previous`
(`TeamPreviousMatchController`, new file, mirroring `TeamSquadController`'s nested-resource shape
rather than folding onto `MatchController`'s own club-scoped `/matches`). Backing service method
`MatchService.listPrevious`/`MatchServiceImpl.listPrevious` — `findTeamOrThrowForClub` →
`accessService.assertCanAdministerSection` → `findSeasonOrThrowForClub` (two new private helpers
on `MatchServiceImpl`, copied from `TeamSquadServiceImpl`'s exact shape) → a new
`MatchRepository.findPreviousForTeamSeasonLeague` JPQL query: same team (either side), exact
`seasonId`, exact `leagueId` match including `null`-to-`null`, `active = true`, `matchDate` before
now, optional `excludeMatchId`, and only matches whose side for this team already has ≥1
`MatchSidePlayer` (nested `EXISTS`/`EXISTS`, not the originally-sketched nested `IN` — adjusted
during build for Hibernate clarity) — ordered newest-first. Reuses the existing `MatchDto`
unmodified. `backend/openapi/openapi.yaml` documents the new endpoint in the same style as the
existing `upcomingOnly` entry.

**Frontend** — `ui/src/api/matchApi.ts` gains `listPreviousMatches`. `MatchFormPage.tsx`'s
`MatchSideTab` gains `teamsById`/`leagueId` props (wired from both existing call sites' own
already-computed values), a `previousMatchesQuery` (fetched only while the picker is open), and a
`copyFromPreviousMatchMutation`: clears a non-empty destination side first (remove-each-player then
one full-replace `updateMatchSide` nulling captain/WK/12th), replays the source's players in
ascending `battingOrder` via the existing `addMatchSidePlayer` (a per-player 400 is caught and
counted as skipped, not fatal), then resolves and sets captain/wicketkeeper/twelfth-man only for
ids that actually survived into the copy. A `LinkExistingRecordDialog<Match>` (no `extraField`,
immediate-fire) is the picker; a small inline MUI `Dialog` (no new shared component) confirms a
destructive replace only when the destination side is already non-empty — both share one new
`isSideNonEmpty` helper so the confirm-trigger and the clear-before-copy logic can never disagree.
An info `Alert` reports "copied X of Y, N skipped" after the copy. `PlayingXiBuilder.tsx` gains an
additive `onReselectFromPreviousMatch?` prop, rendered as a button next to "Add Squad Member",
omitted when not passed. **Review-pass fix, folded in before merge:** the mutation gained an
`onError` handler (in addition to `onSuccess`) closing both dialogs and re-invalidating sides on a
non-400 failure — without it, a failed copy left the confirm/picker `Dialog` open on top of the
page, hiding the `errorMessage` `Alert` behind the modal backdrop with no visible reason for the
stall.

**Tests** — `MatchServiceImplTest`/`MatchControllerIntegrationTest` extended for `listPrevious`
(scoping, 404s, ordering, real Postgres). `PlayingXiBuilder.test.tsx`/`.stories.tsx` extended for
the new button's render/omit/fire behavior. `MatchFormPage.test.tsx` extended: empty-side copy
applies immediately with no confirm dialog; a non-empty side opens the confirm dialog and only
copies on confirm/leaves the side untouched on cancel; a simulated per-player 400 is skipped
without aborting the rest of the copy; captain/WK/12th-man only carry over when they survived.

No Claude Design pass was done for the confirm dialog (a deliberate decision at planning time,
overriding the spec's own Rollout Notes suggestion) — it's built entirely from existing MUI
primitives (`Dialog`/`DialogTitle`/`DialogContent`/`DialogActions`, the same ones
`LinkExistingRecordDialog` already uses) with one paragraph of copy, judged not to need a separate
design pass.

## Verification

- Backend: `cd backend && ./mvnw test` (unit + Testcontainers integration + ArchUnit) and confirm the OpenAPI diff check passes with the new `upcomingOnly` param documented.
- Frontend: `cd ui && npm run test` (Vitest) and `npm run test:e2e` (Playwright) for the new/updated specs above.
- Manual/visual check (per spec's own Rollout Notes — items 3/4 had no supplied screenshot, so this is the one part of the plan not mechanically determined): run the app (`run` skill or `mvnw spring-boot:run` + `npm run dev`), open `/manage/fixtures/matches`, confirm the Sort-by dropdown no longer clips "Match date (newest first)"/"(oldest first)" at both mobile (375px) and desktop widths, and that the filters bar reads as one grouped control. Also click through: Select Team from both a card and the detail page; set Captain → Wicketkeeper → Twelfth Man in sequence and confirm none get cleared; click a batting-order number and retype a position; use Add Squad Member end-to-end.
- After implementation, run the `review` skill (adversarial standards-compliance pass) before opening the PR, per `docs/workflow.md`.
- **Item 9 specifically:** `cd backend && ./mvnw test` (864 tests, `BUILD SUCCESS`, includes the new `listPrevious` unit/integration tests) and `cd ui && npm run test`/`npm run build`/`npm run lint` (741 tests, clean build, no new lint warnings) both verified independently, not just on the builder agents' own word. A live browser walkthrough of the actual copy/confirm/skip flow was attempted but blocked — the dev environment's only CLUB_ADMIN login belongs to the human user and this session had no password for it; automated coverage was judged sufficient to proceed rather than block on it. Worth a manual pass before this is considered fully closed out: the local DB already has the exact fixture for it (one team/season/league, a past match with a built XI and a future one with captain/WK already set).
