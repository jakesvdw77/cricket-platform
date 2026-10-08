# Plan 085 — Availability Polish

Spec: `docs/specs/085-availability-polish.md` (branch `docs/085-availability-polish`, PR #104). Depends on 081, 083, 084, 064–068, 073/074, 079. **Frontend only** (no backend, no `openapi.yaml`, no migration).

## Context

After 083/084 the Availability pages work but look heavy and have rough edges the user found in the browser: tall counters, oversized toggles, an untidy group poll Responses page (bare toolbar, hard-to-scan lists, a redundant Summary tab, a low-key "SHOW" button), a Players grid that scrolls twice with its Jump button and legend misplaced, and a grid that is hard to use on a phone. The spec fixes the target (mockups linked in its Rollout Notes). Decided by the user: **one branch, one PR, built in one go, then the standards reviews**; inside the PR one commit per item so it can be reviewed or reverted piece by piece. The work is built on the existing branch `docs/085-availability-polish` in the main checkout (spec, plan and code in one PR #104), no helper worktrees.

## Items to flag to the human (the spec points where the code differs; the plan makes the smallest choice, please confirm)

1. **D2 has no "existing hub mechanism".** The spec says the Jump button reaches the header "through the existing hub context, as Polls supplies New poll". Today "New poll" is hardcoded in `AvailabilityHubLayout.tsx` (l.164–179) and `hubContext.ts` only carries filters/state. Plan: add a small header-action slot to the hub state (`jumpToToday: { onClick, disabled } | null`, set by `PlayerAvailabilityPage` through an effect and cleared on unmount); the layout renders the real button where the invisible placeholder is now (same width, so the header does not jump).
2. **C6 wording.** (a) "Old links to the Summary tab fall back to Time slot": the view is plain `useState` with no URL param, so there is nothing to fall back from; nothing to build. (b) "answered every slot, the meaning the poll cards use": the poll cards have no such figure, so "answered all / some / none" is new; it is computed client-side from rows and brackets (matching `windowId`s, not `statuses.length`), no endpoint change. (c) The header gauge uses the **unfiltered** rows so a player search never changes it; the per-slot thin bar uses the bracket totals.
3. **E "next game day".** `firstUpcomingGame` (kickoff >= now) and `nextGameDayMarker` (day-based; a game earlier today still counts as Today) disagree. Plan: By game opens on the **first game of the `nextGameDayMarker` day**, matching the desktop "Next game day" chip.
4. **B scope.** The spec's toggle list misses "Closing within 48 h" (dashboard) and "Hide players who haven't answered" (`ResponsesByPlayer`); both are included. The form switches (auto-close in `SquadPollBranch`/`EditCloseTimeDialog`, `FixtureGroupCard`) are form fields, not page toggles, and are **left alone**.
5. **Swipe is new.** There is no swipe/gesture code in `ui/src` (only `SwipeableDrawer`). Plan: a small `useSwipe` hook (pointer/touch, threshold, `touch-action: pan-y`, ignores mostly-vertical moves). Arrows remain the primary control.
6. **Phone touch targets vs the Filters sheet.** The `FilterBar` sheet wraps view toggles in a `minHeight: 28` row; the spec wants 44 px targets. Plan: raise that row to 44 px for toggles on a phone.
7. Smaller: `overscroll-behavior: contain` is already set on the grid (the real D1 change is replacing the max/min height constants with a measured height); the slot lists' `role="region" tabIndex=0` only make sense while they scroll, so they go with C9 (tests adjusted); the squad page's info line is three rows (not one), so the gauge goes through a shell-level wrapper (meta + gauge), not into each page's `meta`.

## Order and commits (one PR; sequential so agents never edit the same files at once)

Agent for all parts: **frontend-builder** (writes component tests and stories with the code); then **standards-reviewer** over the whole diff; fixes; then browser check by the user.

### Commit 1 — Compact counters, shared toggles, browser tab title (A, B, C8)

- `components/PageCounters/PageCounters.tsx`, `keyFigureStyle.ts` (+ test, stories): `density?: 'comfortable' | 'compact'` (default unchanged; Overview imports only `keyFigureCardSx`/`keyFigureValueSx` and is untouched). Compact: `compactCardSx`/`compactValueSx` (row, baseline, `minHeight: 44`, label `noWrap` ellipsis), grid gap 0.75 (6 px), 2×2 on xs and four across from md, marker vertically centred (`top: 50%`) with right padding so it never overlaps the text, compact skeleton at the same height. Keep markers, hover lift, active outline, `aria-pressed`, hidden hint, zero rule, focus ring. `AvailabilityHubLayout.tsx` passes `density="compact"`.
- **New** `components/CompactSwitch/` (four-file anatomy: `CompactSwitch.tsx`, test, stories, `index.ts`): `FormControlLabel` + `Switch size="small"` + caption/body2 label (~0.78–0.82 rem), 44 px touch target on a phone via padding on the label row; the single source of the style. Replace every Availability toggle: `AvailabilityPollsDashboard.tsx` (Group polls, Squad polls, Show closed polls, Closing within 48 h), `PlayerAvailabilityPage.tsx` (Show past games, Hide players with no answers), `coverage/AvailabilityCoveragePage.tsx` (Show past slots), `responses/ResponsesByPlayer.tsx` (Hide players who haven't answered); adjust `FilterBar`'s sheet row to 44 px.
- **New** `hooks/useDocumentTitle.ts` (+ test; restores the previous title on unmount): called in `AvailabilityHubLayout` ("Polls · Availability", "Players · Availability", "Match-day cover · Availability") and in `ResponsesPageShell` (the poll title). Visible page title unchanged.

### Commit 2 — Responses page polish (C1–C7, C9; group and squad pages)

All in `ui/src/pages/manage/availability/responses/` (shared by `GroupPollResponsesPage` and `SquadPollResponsesPage` through `ResponsesPageShell`).

- **C1** `ResponsesPageShell.tsx`: wrap the tabs + search `Stack` in a Box with `filterPanelSx` (`utils/filterPanel.ts`); inner layout unchanged.
- **C6** remove the Summary tab (`ResponsesSummary.tsx` deleted, `summarySlots` and the `'summary'` view state removed; update tests/stories). **New** `components/ResponseGauge/` (four-file anatomy), a slim stacked bar with counts, in two modes: *poll* (answered all / some / none) and *status* (Available / Unsure / Unavailable / No response with "N of M answered", reusing `STATUS_COLOR`/`STATUS_LABEL` from `utils/availabilityStatus`); `components/SlotSummary` stays as is for `PollCard`. New pure helper `answeredCoverage(rows, brackets)` in `responseHelpers.ts` (+ tests). The shell renders `meta` and the gauge in one flex row (gauge right-aligned on desktop, its own full-width line on a phone): multi-slot polls use the *poll* mode in the header and a thin per-slot bar (bracket totals) in each slot card; single-slot and squad polls use the *status* mode in the header and no per-slot bar. Unfiltered rows only.
- **C2/C9** `ResponsesByTimeSlot.tsx`: `PlayerRow` = name first, then a fixed-width right-aligned number column (empty cell when none, so names align; override-menu tap target unchanged); remove `maxHeight`/`overflowY` and the `region`/`tabIndex` from `StatusColumn` (lists grow, page scrolls); `SCROLL_*` constants in `responseHelpers.ts` removed if unused.
- **C3** `SlotMatches.tsx`: CSS-grid rows `match | date and time | league`, columns shared per list so separators align; stacked on a phone; empty league leaves the cell empty. (Only consumer after the Summary tab goes is the slot card.)
- **C4/C5** `ResponsesByPlayer.tsx`: right-aligned narrow `#` column (header and cells); zebra rows with an opaque theme tint (as the grid: `lighten(primary.main, 0.95)`), checking the status chips' contrast on both tints; hover, override menu and switch unchanged.
- **C7** the "No response (n)" bar in `SlotBlock`: whole bar is the click target, arrow icon next to Show/Hide (down/up), `aria-expanded`, visible hover and focus; keep the aria-label pattern the tests use.
- Tests/stories: shell (toolbar in panel, two tabs, gauge in both tabs and both modes), time slot (aligned number column, no inner scroll, No response bar), by-player (alignment, zebra), `SlotMatches` (columns/stack), `answeredCoverage`, `ResponseGauge`, group and squad page tests; stories for the gauge modes.

### Commit 3 — Players on desktop and tablet (D1–D3)

- **New** `hooks/useFillViewportHeight.ts` (+ test): measures the element's top offset (`getBoundingClientRect`), height = `innerHeight - top - bottom padding`, re-measured on resize/orientation change and by a `ResizeObserver` on the page container (guard `typeof ResizeObserver === 'undefined'` for jsdom, as `AvailabilityGrid` already does); minimum about 150 px, below which the page scrolls. `AvailabilityGrid.tsx`: replace `SCROLL_BOX_MAX_HEIGHT`/`MIN_HEIGHT` with the hook's height (keep `overscroll-behavior: contain`, sticky headers and column untouched; `scrollIntoView` for the jump keeps working).
- **D3** `Legend.tsx` (+ new test): compact single row (tighter gaps, caption text), rendered **above** the table inside `AvailabilityGrid`; a prop for the phone wording ("No poll") used by commit 4.
- **D2** hub header slot (flag 1): `hubContext.ts` gets the `jumpToToday` slot; `AvailabilityHubLayout.tsx` renders it in the header action position on Players (replacing the placeholder, same width); `PlayerAvailabilityPage.tsx` registers the button (shown only where the grid is shown and not on a phone; disabled when there is no upcoming game) and stops passing it as `pinned` to `ContentControlsLine`. `AvailabilityHubStub` renders the slot so `PlayerAvailabilityPage.test.tsx` can assert it.
- Tests: hook, grid (height, min, legend above the table in DOM order), page (Jump in the header, not in `ContentControlsLine`), hub layout.

### Commit 4 — Players on a phone (E)

- **New** `pages/manage/playerAvailability/PlayersPhoneLists/` (four-file anatomy) and new pure helpers in `gridHelpers.ts` (+ tests): `nextFourGames`, `playersByStatusForGame`, status counts per game, and the opening-game rule (flag 3). By game | By player switch (`segmentedSwitchSx`, By game first, local state): game selector card with arrows and swipe (new `hooks/useSwipe.ts` + test), "Game n of N", status chips with counts that filter and clear on re-tap, 44 px player rows with a status pill and a picked dot, a one-line note for the dot; By player: a strip with date and match labels for the next four games, a `CellMark` per game per row, tap to expand the full list of that player's games, the legend directly under the switch ("No poll" wording). Reuses `CellMark`, `cellFor`, `cellLabel`, `kickoffText`, `groupGames`/`orderedGames`, `filterPlayers`, and the existing empty states.
- `PlayerAvailabilityPage.tsx`: `useMediaQuery(down('sm'), { noSsr: true })`; below `sm` render `PlayersPhoneLists` instead of the grid and no Jump button; same query, filters, search and Filters sheet.
- Tests (`setViewport(false)` already exists in the page test): By game first, opening game, arrows and swipe, chips, By player strip and expand, legend placement, search/filters, empty states; stories for both modes and empty.

### Playwright (written, not run here)

One new spec in `ui/e2e/` (`desktop-chromium` 1280×720 and `mobile-chromium` Pixel 5; same env vars and skip rules as `manager-availability-polls.spec.ts`; skips on CI/no data): desktop — no page scrollbar next to the grid, Jump to today in the header scrolls the grid; mobile — By game / By player show and a status chip changes the list.

## Reuse inventory

`PageCounters` + `keyFigureStyle.ts`; `filterPanelSx` (`utils/filterPanel.ts`); `segmentedSwitchSx`; `BottomSheet`/`FilterBar`/`ContentControlsLine`; `CellMark`, `gridHelpers.ts` helpers, `Legend`; `STATUS_COLOR`/`STATUS_LABEL`; `responseHelpers.ts`; `useMediaQuery(..., { noSsr: true })` idiom; the `ResizeObserver` guard in `AvailabilityGrid`; `ManageScreenHeader` (`action`, `subtitle`); the hub context/stub pattern.

## Verification

- Each commit: `nvm use 22.12.0`; in `ui/`: lint, `npx tsc -b`, the affected vitest files; after the last commit `npm run build` and the full `npx vitest run --project unit --maxWorkers=2` (re-run failures alone). Storybook and Playwright cannot run here (no stack): say so in the PR.
- Standards review (`standards-reviewer`) on the whole diff, fix findings, then the user checks in the browser (desktop 1280 and phone 375): counters slim with gap and still clickable; every toggle small; Responses pages (toolbar panel, name first/number right, aligned match lines, header gauge on both tabs, no Summary tab, arrow on No response, no inner list scroll, zebra and right-aligned `#` on Player tab, browser tab titles); Players desktop (one scrollbar, Jump in the header, legend above the grid, grid never scrolls the page); Players phone (By game and By player lists, swipe/arrows, chips, legend).
- Then update PR #104's title and body (spec + plan + code), and merge when the user is happy.

## After approval

Copy this plan verbatim to `docs/plans/085-availability-polish.md` on `docs/085-availability-polish` (commit it with the code).
