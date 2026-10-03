# Plan 073 — Availability Hub and Poll Card Polish

Implements `docs/specs/073-availability-hub.md` (approved; design approved). Design: https://claude.ai/artifact/4x7HDVQG893xvcv8rSQJar. Branch: `feature/073-availability-hub` (off master; specs 073 and 074 committed as `db6fc75`). Frontend only: no backend, migration or `openapi.yaml` change. Built before `074` (Coverage), which adds its tab and route on top.

## Context

Availability is two unrelated dashboard tiles with a one-way link between them, the poll card is the odd one out against the Match card (only footer buttons clickable, loose Closes text and pencil), and on a phone the shared list toolbar buries the sort control. This puts Polls and Players under one **Availability** hub with a routed switch, makes the poll card click-through like the Match card with a "Poll closes" `DetailLine`, and moves the sort control first on phones in the shared `ListToolbar`.

## Findings that shape the plan

1. **Pattern to copy:** `072`'s layout route (`LeagueViewLayout` with `<Outlet context>`) and `SectionAvailabilityRedirect` for the new `PlayerAvailabilityRedirect`. `ResponsesPageShell`'s view switch style is extracted into one shared `segmentedSwitchSx` constant (`ui/src/utils/segmentedSwitch.ts`); the Responses page behaviour and markup stay unchanged.
2. **Routes in `App.tsx`:** `availability` becomes a layout route with `index` (Polls) and `players` children; `availability/new`, `availability/group/:roundId`, `availability/squad/:matchId/:pollId` stay siblings outside the layout; `player-availability` becomes a query-preserving redirect to `availability/players`; `section-availability` redirect unchanged. `/manage/availability?showClosed=true` must keep opening Polls.
3. **Header:** `ManageScreenHeader` gains one additive optional `middle` slot (switch between title and action); omitted means markup unchanged. "New poll" is rendered only on Polls; the Polls and Players pages lose their own headers and the one-way "Availability Polls" button.
4. **`ListToolbar` is shared (14 users).** Phone order via CSS `order: { xs: -1, md: 0 }` on the sort group (DOM order unchanged so existing tests hold), a visible `aria-hidden` caption on xs showing the current sort label verbatim, the sort `IconButton` fixed to 40x40; desktop byte-for-byte unchanged. The spec's table of users drives the browser check.
5. **`PollCard`:** `viewTo` via a new `pollResponsesPath(item)` helper (also used by the Responses footer button); the new close-time pencil carries `position: 'relative'`; `pollHelpers.closesRow` is new while `closesRowText` stays exactly as is (the two Responses pages use it). Pencil only while open; closed value keeps today's date-only/"Manually" logic.
6. **Process constraints** carry over: `source ~/.nvm/nvm.sh && nvm use 22.12.0`, one heavy command at a time with `uptime` checks, background + poll, no `git stash`, never touch the user's `CricketlegendApplication.java` / `055` / `058`; use file-level `configure({ asyncUtilTimeout })` rather than sleeps for cold first renders; stage commits with explicit paths (never `git add docs` or `backend/src/main` wholesale).

## Part 1 — Frontend (`frontend-builder`, in this order, one heavy command at a time)

**F1. Shared pieces:** `utils/segmentedSwitch.ts` (+ `ResponsesPageShell` uses it, test unchanged); `ManageScreenHeader` `middle` prop (+ test/story); `ListToolbar` phone order, caption, 40px icon, field-picker `height: 40` (+ tests, stories incl. 375px toggle, field-picker and Select-plus-create); `pollHelpers.ts` `closesRow` and `pollResponsesPath` (+ tests, `closesRowText` assertions untouched).
**F2. Hub:** `pages/manage/availability/AvailabilityHubLayout.tsx` (clientId guard "Not authorized", header "Availability", `ToggleButtonGroup` of `RouterLink`s inside `<nav aria-label="Availability views">` for Polls and Players, `aria-current`, New poll only on Polls, `<Outlet context={{ clubId }} />`), `PlayerAvailabilityRedirect.tsx`; `App.tsx` routes per spec section 1; `ManagerDashboard.tsx` one Availability tile (drop `GridOnOutlinedIcon` import); `AvailabilityPollsDashboard` and `PlayerAvailabilityPage` lose their headers and unused imports.
**F3. PollCard:** `viewTo`, Responses button via `pollResponsesPath`, the "Poll closes/closed" `DetailLine` (`labelWidth` 78, `EventBusyOutlinedIcon`, pencil inside the value while open, own `position: relative`), keep title pencil, corner delete, footer unchanged.
**Tests (Vitest/RTL):** the spec's Component row in full: routes and redirects, layout switch/aria/New poll visibility/clubId forwarding, dashboard tile, updated page tests (no removed headers), `ManageScreenHeader`, `ResponsesPageShell` unchanged, `ListToolbar`, `PollCard` (click-through vs button/pencil/bin no navigation, "Poll closes" cases), `pollHelpers`. No arbitrary timeouts.

## Order and ownership

1. `frontend-builder`: F1, F2, F3 and tests. I verify independently: `tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm run build`, vitest (`--project unit --testTimeout=30000`) on `src/components/ListToolbar`, `ManageScreenHeader`, `src/pages/manage/availability`, `AvailabilityPollsDashboard`, `PlayerAvailabilityPage`, `ManagerDashboard`, `MatchList`, `LeagueList` and the other `ListToolbar` users, `App` routing tests.
2. `standards-reviewer` (read-only), fix findings. Docs by me in the same PR: add "Amended by 073" to the Status lines of `064`, `066`, `068`; `docs/roadmap.md` note (hub, `068` route moved).
3. Commits in chunks (`feat(ui)`, `test(ui)`, `docs`) with explicit paths, PR, CI; I ask before merging. Browser check by you (my tab is unreliable): the 073 spec's browser row, especially the phone toolbar on every list screen.
4. Then `074`.

## Flags for your review

1. **`ListToolbar` changes every list screen on a phone** (agreed earlier); review the spec's per-screen check table.
2. **Closed-poll "Poll closed" value stays date-only** (existing logic), unlike the mockup's time.
3. **No Coverage tab until `074`**; `/manage/availability/coverage` is an unknown route in the meantime.
4. **Keyboard tab order on a phone still reaches sort last** (visual reorder only), as the spec accepts.
5. Playwright not extended (no live services), as before.

## Verification

- `tsc`, lint, build, touched-file vitest (full UI suite still has ~10-25 unrelated pre-existing 5s timeouts).
- Browser: dashboard shows one Availability tile; header with the switch; New poll only on Polls; old Player Availability URL redirects; poll card hover lift and click-through with working footer/pencils/bin; "Poll closes" row alignment; phone toolbars start with sort and caption on all list screens; desktop toolbars unchanged.
