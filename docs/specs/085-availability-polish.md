# 085 — Availability Polish

**Depends on:** 081 (page counters), 083 (filters, toolbars, `ContentControlsLine`), 084 (clickable counters), 064–066 and 067 (poll cards and the group and squad Responses pages), 068 (Players grid and its legend), 073 and 074 (availability hub; Coverage is now Match-day cover), 079 (Overview key-figure cards, which share `keyFigureCardSx` with `PageCounters`)
**Status:** implemented in PR #104 (built 2026-10-08 in one branch; items A to I; standards reviews done, the second review's fixes in progress), awaiting the user's browser check. Written 2026-10-08 from the user's review of the built 083/084 pages in the browser; the findings were raised one at a time and are combined here. Agreed by the user: A (counters), B (toggles), C (Responses pages), D (Players on desktop and tablet), E (Players on a phone); F, G, H, I were added later the same day at the user's request. Storybook and Playwright were not run when it was built.

## Problem & Goals

After 083 and 084 the Availability pages work but look heavy. The four counters take about 90 px of height, the toggles are MUI default size (larger than the approved mockup), the group poll Responses page has a toolbar on the bare background and lists that are hard to scan, and the Players view scrolls twice (the grid and the page) with its legend and Jump button out of sight or out of place. On a phone the Players grid is hard to use at all.

Goals:
- Slimmer counters (A) and one small toggle style across Availability (B).
- A tidier Responses page: a toolbar panel, names first, aligned match lines (C).
- Players on desktop and tablet: one scroll, Jump to today in the header, legend above the grid (D).
- Players on a phone: two vertical lists instead of the grid (E).

## Non-goals

- **No backend, API or data change** (F reuses the existing override endpoints). Everything is presentation over the data and endpoints that exist today.
- **No per-match or per-team (group by team) view on desktop.** Dropped by the user.
- **The Polls | Players | Match-day cover switch in the header stays** on wide screens (the side menu can drive the same views). Left as it is; may be revisited.
- **The page title stays "Availability"**; it does not show the current view.
- **The "Show / Hide arrow buttons" request is not specified** until the user says which control (see Open Questions).
- **No reminders, and no change to the Overview or Matches counters.** See 084 and `docs/roadmap.md`. The Overview key figures keep their current look.
- **No change to counter labels, figures or the 083/084 filter and drill-down behaviour**; only their look and density.
- **No change to what the grid shows** (columns, marks, sorting, the 068 cell rules) beyond sizing and placement.

## User Stories

- As a manager, I see the four Polls counters as a slim row, so that the poll list starts higher on the screen.
- As a manager, every toggle on the Availability pages is the same small size, so that the controls do not dominate the page.
- As a manager on a group poll Responses page, I find the view tabs and search in a panel like the other pages', so that the page looks consistent.
- As a manager, I read the player names in the Available, Unsure and Unavailable lists separated by thin dividers and without shirt numbers, so that I can scan names quickly.
- As a manager, I see each slot's match lines in aligned columns (match, date and time, league), so that I can compare them.
- As a manager on desktop or tablet, I use the Players grid without a second page scrollbar, so that scrolling is predictable.
- As a manager, I find "Jump to today" at the top right of the header and the legend directly above the grid, so that neither is lost below the fold.
- As a manager on a phone, I switch between "By game" and "By player" lists, so that I can read availability without a wide grid.
- As a manager on a phone, I open on the next game day and step through games with arrows or a swipe, so that I find the game I need quickly.

## Data Model Changes

None.

## API Contract

None. No new or changed endpoint; `openapi.yaml` is untouched. The phone lists use the same `listPlayerAvailability` request and response as the grid (`ui/src/api/playerAvailabilityApi.ts`, same query key and filters), so no backend change is expected.

## UI Requirements

### A. Compact counters (`ui/src/components/PageCounters`)

- Add a **`density` prop** to `PageCounters`: `'comfortable'` (default, today's look, used by the Overview) and `'compact'`. The Overview and any other caller keep the default, so their figures do not change. The Availability Polls page (`counterItems` in `AvailabilityHubLayout.tsx`) passes `density="compact"`. Decided here rather than changing `keyFigureCardSx`, which the Overview also uses; `keyFigureStyle.ts` gets a compact variant next to it.
- Compact: four **separate** cards, about 44 px tall, the number and its label on one line (value then label, baseline aligned, label truncates with an ellipsis rather than wrapping), a 6 px gap between cards and no dividers. Desktop four across; on a phone 2×2 with the same gap.
- Unchanged: the corner marks (`›` for a drill-down, "filter" for a filter), the hover lift, the green outline for the active card, `aria-pressed`, the visually hidden hint, the non-clickable-at-zero rule, the focus ring and the loading skeleton (compact skeleton matches the compact height). The corner mark is positioned so it does not overlap the one-line text at 44 px.

### B. One small toggle style

- Add a shared **`CompactSwitchLabel`** (or a small exported style, `ui/src/components/CompactSwitch`, four-file anatomy) wrapping `FormControlLabel` + `Switch size="small"` with a `body2`/caption label (about 0.78–0.82 rem). It is the single source of the style; no page sets its own.
- Used by every Availability toggle: the `ContentControlsLine` controls, the `FilterBar` sheet toggles, and the Polls, Players and Match-day cover toggles ("Group polls", "Squad polls", "Show closed polls", "Show past games", "Hide players with no answers", "Show past slots"). Call sites in `AvailabilityHubLayout.tsx`, `PlayerAvailabilityPage.tsx`, `coverage/AvailabilityCoveragePage.tsx` and the toggles passed to `FilterBar`/`AvailabilityFilterBar` change to the shared component.
- Touch target on a phone stays at least 44 px high (padding on the label row, not a bigger switch).

### C. Responses pages (`ui/src/pages/manage/availability/responses/`)

`ResponsesPageShell.tsx`, `ResponsesByTimeSlot.tsx` and `SlotMatches.tsx` are shared by the group poll page and the squad poll page (`ResponsesPageShell` is "shared by the group and the squad poll pages"), so all three changes apply to both.

- **C1 Toolbar panel.** The row with the Time slot | Player | Summary tabs and "Search players" is wrapped in the same white elevated panel as the other pages' toolbars (`filterPanelSx` from `ui/src/utils/filterPanel.ts`, the look `FilterBar` uses). Layout inside is unchanged (stacked on a phone, one row from sm).
- **C2 Name lists (revised 2026-10-08).** In the Available / Unsure / Unavailable lists (the player row in `ResponsesByTimeSlot.tsx`) the shirt number is **dropped** (the user: it only takes space) and a thin divider separates the player names, as in the mockup; the row remains the tap target for the override menu and the "via link" marker stays. (First built as a right-aligned number column, then removed.)
- **C3 Match lines.** `SlotMatches` renders each match as a row with columns: match (`Team v Opponent`, bold), date and time, league. Columns align across the lines of one slot (CSS grid, or a shared `grid-template-columns` per list) and the separators line up. On a phone each match stacks (match, then date and time, then league). The Summary cards use the same component and get the same alignment. Empty-league lines leave the third column empty.
- **C4 Player tab (revised 2026-10-08).** The Player tab table (`ResponsesByPlayer.tsx`) no longer has a `#` column: the shirt number is dropped here too. (First built as a right-aligned `#` column, then removed.)
- **C5 Alternating rows.** The rows of the Player tab table alternate between the panel background and a light tint (an opaque tint from the theme, `lighten(primary.main, 0.95)` as the Players grid uses), starting with the **first** row tinted (the user asked for Brain Best, the first player, to be the green one), so a name can be followed across to its status. The hover state, the override menu tap target and the "Hide players who haven't answered" switch are unchanged. Applies to this table only for now.
- **C6 No Summary tab, a gauge in the header.** The Summary tab (`ResponsesSummary.tsx`) is removed, leaving Time slot | Player. The coloured response gauge moves into the page header, right-aligned in the poll's info line (the row with the poll type, status, section, close time and edit icon), so it is visible on both tabs and adds no row; on a phone it takes its own full-width line under the info. Mockup: https://claude.ai/artifact/MtuNUFa7cuP86kWoyBMrpq. **Multi-slot polls:** the header gauge is for the whole poll, a slim stacked bar with the counts underneath: players who answered every slot ("answered all"), some slots ("some") and none ("none"), the same "answered every slot" meaning the poll cards use, and each slot card on the Time slot tab keeps its own counts and gains a thin bar (Available, Unsure, Unavailable, No response) that replaces the old Summary card. **Single-slot polls (and squad polls):** the header gauge shows the four-status split (Available, Unsure, Unavailable, No response) with the "N of M answered" figure, and no per-slot bar (it would repeat the header). The gauge is computed from the data the Responses pages already load (state in planning whether any endpoint change is needed; none is expected). Old links or bookmarks to the Summary tab fall back to Time slot.
- **C7 Show / Hide on "No response".** At the bottom of each slot card the collapsible "No response (3)" bar has a plain "SHOW" text button. Make it stand out: an arrow icon next to the label (a down arrow with "Show", an up arrow with "Hide", the icon switching with the state), the whole bar is the click target, `aria-expanded` is set, and the focus ring and hover state are visible. The count stays in the bar's label. Same treatment wherever the same collapsible bar is used (check the squad poll page).
- **C8 Page title in the browser tab.** The browser tab (document) title names the view, "Players · Availability", "Polls · Availability", "Match-day cover · Availability", and on the poll Responses pages the poll title, so several open tabs can be told apart. The visible page title stays "Availability". One small shared hook, no layout change.
- **C9 Slot lists grow.** The Available, Unsure and Unavailable lists inside a slot card (`ResponsesByTimeSlot.tsx`) no longer have their own maximum height and inner scrollbar: they grow to their full length and the page scrolls, so there is one scroll direction on the Time slot tab. Check the squad poll page too.

### D. Players on desktop and tablet (agreed)

Applies from the tablet breakpoint up (`sm` and above, `theme.breakpoints.up('sm')`); the grid stays on desktop and tablet. Files: `ui/src/pages/manage/PlayerAvailabilityPage.tsx`, `playerAvailability/AvailabilityGrid.tsx`, `playerAvailability/Legend.tsx`, `availability/AvailabilityHubLayout.tsx`.

- **D1 One scroll.** `SCROLL_BOX_MAX_HEIGHT = 'calc(100vh - 320px)'` in `AvailabilityGrid.tsx` is a guess from before the taller 083 header and filters, so the page scrolls as well as the grid. Replace it with a **`useFillViewportHeight`** hook (in `ui/src/hooks/` if that is where hooks live, else beside the grid) that measures the grid box's top offset (`getBoundingClientRect`) and sets its height to `window.innerHeight - top - bottom padding`, re-measured on resize, orientation change and when the content above changes (a `ResizeObserver` on the page container, so the filter row wrapping or an alert appearing is handled). Minimum height about 150 px (`SCROLL_BOX_MIN_HEIGHT` is lowered from 240); below that the page scrolls instead. The box gets `overscroll-behavior: contain` so the grid's scroll never chains to the page. Sticky date headers, sticky slot rows and the sticky player column stay exactly as they are (068).
- **D2 Jump to today.** The button moves out of `ContentControlsLine`'s `pinned` slot into the page header action slot, right-aligned, where "New poll" sits on Polls. `AvailabilityHubLayout.tsx` currently reserves that slot on Players with an invisible placeholder button (`visibility: hidden`, so the header does not jump between views); the real button replaces the placeholder. The page passes the button up through the existing hub context (`hubContext`), alongside how the Polls "New poll" action is supplied. Shown only where the grid is shown (not on a phone, not when there are no polls); otherwise the placeholder keeps the height. Behaviour is unchanged (`scrollToGame` of the first upcoming game; disabled when there is none).
- **D3 Legend above the grid.** The six-mark legend (`Legend.tsx`) moves from under the grid to directly above it, in one compact row (tighter gaps, `caption` text) so it is visible without scrolling. It still wraps instead of clipping on narrow tablets.

### E. Players on a phone (agreed)

Below the tablet breakpoint (`down('sm')`) the grid is replaced by a new **`PlayersPhoneLists`** component (four-file anatomy, `ui/src/pages/manage/playerAvailability/`). Same filters, search and Filters sheet as today (083), same data and endpoint (see API Contract).

- A **"By game | By player"** segmented switch (`segmentedSwitchSx`) at the top; **By game opens first**. The choice is local per visit, like the other view choices.
- **By game:** a game selector card with previous/next arrows (and a horizontal swipe) showing the game's title, date and time and "Game n of N"; status chips with counts that also filter the list (Available, Unsure, Unavailable, No response; tapping an active chip clears it); one tall list of players, each row with a status pill and a small dot for "picked". **Opens on the next game day** (the first upcoming game, `firstUpcomingGame`/`nextGameDayMarker` in `gridHelpers.ts`). No jump button. A one-line note under the chips explains the picked dot.
- **By player:** one row per player with a mark for each of the **next four games** (`CellMark`), under a strip with the date and match label of those four games; tapping a row expands the full list of that player's games with their marks. The **legend sits directly under the switch** (compact, wraps); on the phone lists the "Not in this game's poll (or no poll)" entry reads "No poll" (decided).
- Reuses `CellMark`, `cellFor`, `cellLabel`, `kickoffText`, `groupGames`/`orderedGames` and the player filtering from `gridHelpers.ts` rather than re-deriving them. Rows are at least 44 px high. Players with no games or no polls show the existing empty states.

### F. Change an answer from the Players grid and lists (added 2026-10-08, user request)

Clicking a mark in the Players grid currently navigates to the poll's page (`pollPath(game)` in `AvailabilityGrid.tsx`), where all the poll's players are listed, so it is hard to see which player and game the click was about. Instead the click opens a small menu to change that one answer, the same as the override on the Responses pages.

- **Menu.** Clicking a cell with a poll opens the shared `StatusOverrideMenu` (Available / Unsure / Unavailable, the current answer selected), titled with the player's name and the game ("Anton de Villiers, Thu 15 Oct 07:15 v POHBS"). A last entry **"Open poll"** keeps the old route reachable. The cell is a real button (keyboard reachable, `aria-haspopup`, `aria-expanded`, focus ring); the existing cell label ("Anton de Villiers, Thu 15 Oct ..., Available") stays its accessible name. Cells with no poll for that game (`NOT_IN_POLL`) are not clickable.
- **Saving.** Squad poll games use `setPlayerStatus(clubId, matchId, pollId, playerProfileId, status)` (`matchAvailabilityApi.ts`). Group poll games use `setRoundPlayerStatus(clubId, roundId, playerProfileId, windowId, status)` (`sectionAvailabilityApi.ts`); the window id is not in the grid's `GameColumn`, so it is looked up from `getRoundMatches(clubId, roundId)` (which returns `matchId` and `windowId`) through React Query, loaded when the menu is first opened for that round and cached. No backend or `openapi.yaml` change. Both calls also work on a closed poll (a manager's correction), as on the Responses pages.
- **After a save.** The grid and phone lists refresh (invalidate the player-availability queries and `invalidateAvailabilityCounters`), the cell shows the new mark, and the cell is disabled while its save is running; a failure shows the same error message pattern as the Responses pages and keeps the old answer.
- **Phone.** The same menu opens from the status pill on a By game row and from a game's mark in an expanded By player row (so the grid's click change and the phone lists behave alike).
- **Not in scope.** Changing answers in bulk, and a "No response" entry (as on the Responses pages, an answer can be set but not cleared).

### G. Poll lists from "Open polls / Polls shown" and "Close in 48 hours" (added 2026-10-08, user request)

The user clicked "Polls shown" (the first counter reads "Polls shown" once Show closed polls is on, and then counts closed polls too) and nothing happened, and asked how a closed poll can be an "open poll". The first counter was the reset for the 48-hour filter (already active, so a click did nothing), and "Close in 48 hours" was a list filter (084). Both become the same kind of counter as the two players counters: a drill-down that opens the slide-in panel.

- **Both counters become drill-downs** (`kind: 'drill'`, the `›` marker): "Open polls" (or "Polls shown") and "Close in 48 hours" open a right-hand panel on desktop and tablet and a bottom sheet on a phone (the `PlayersPanel` pattern: `Drawer` / `BottomSheet`, Escape, close button, focus returns to the counter).
- **Panel content:** one row per poll with its title (for example "Thursday 15 October - Over 40 fixtures"), a Group / Squad chip, an Open / Closed chip, when it closes ("closes in 5 d 11 h", or "closed Fri 2 Oct") and how many have answered ("15 of 18"); each row is a link to that poll's Responses page (`utils/pollRoutes.ts`). Sorted by soonest closing first (closed polls after the open ones). Header text names the scope, for example "3 polls shown, 2 open and 1 closed" for the first counter and "Open polls closing within 48 hours" for the second; the same footer "Showing: ..." line as the players panel.
- **Same polls as the list.** The first panel lists exactly the polls the page shows (the section, league, team, type and Show closed filters apply, so with Show closed on the closed polls appear, with a Closed chip); the second lists the open polls closing within 48 hours (the existing rule, `scheduledCloseAt` after now and at most 48 hours away). Both are built from the lists the Polls page already loads (no new endpoint), so the counter and the panel always agree; a counter showing 0 is not clickable.
- **Replaces the 084 filter behaviour (decided by the user's request, recommended default).** The 48-hour list filter, its removable chip, its switch in the phone Filters sheet and the "closing within 48 hours" scope text are removed; the poll list is only filtered by the shared filters, the Group / Squad toggles and Show closed. The counters keep their labels and figures. "Players responded" and "Players still to answer" are unchanged.
- **Label.** The first counter keeps "Open polls" while Show closed is off and "Polls shown" while it is on (083 decision, so the figure always matches the list); the panel header spells out how many are open and how many are closed, so "Polls shown 3" is no longer ambiguous.

### H. New group poll page (added 2026-10-08, user review)

- **Fully covered groups are read-only.** In `FixtureGroupCard.tsx` a proposed group whose fixtures are all already in a poll no longer shows the editable Description, Autoclose and "Closes at" fields (the closing time showed a red "A closing time is required" error on an empty field) nor a disabled "Open poll for 0 selected fixtures" button; it shows "Every fixture here is already in a poll." and the covering poll's link. A group with some fixtures free stays editable, and unticking every fixture shows no red error (the disabled action is enough).
- **The linked group scrolls into view.** Arriving from an "Open a poll" link (`?matchId=`, for example from a Players grid column header or Match-day cover), the outlined group is scrolled to the middle of the screen, so a group far down the page is not mistaken for missing. Built and confirmed by the user (commit `f636659`).

### I. A tighter toolbar and page spacing on the Availability pages (added 2026-10-08, user request)

The filter toolbar (League, Section, Team, Search) is about 72 px tall next to 44 px counter cards, and 24 px gaps between the page header, the counters, the toolbar, the scope line and the content make the page look loose. A compact density for the Availability pages only:

| | Now | Compact |
|---|---|---|
| Toolbar panel padding | 16 px | 8 px |
| Toolbar fields | 40 px (small input) | 36 px |
| Toolbar panel height | about 72 px | about 52 px |
| Gap between header, counters, toolbar and content (hub layout and Polls dashboard) | 24 px (`gap: 3`) | 12 px (`gap: 1.5`) |
| Gap between rows inside the toolbar panel | 16 px | 8 px |

- Applies to `FilterBar` (desktop card and the phone search row) and the shared `filterPanelSx` surface where the Availability pages use it (Polls, Players, Match-day cover, and the Responses pages' toolbar panel from C1); implemented as a `density` option (default unchanged), so the other list pages (`ListToolbar`, Matches, Players, Leagues and so on) keep today's look until the user decides to roll it out.
- The page gaps are changed in `AvailabilityHubLayout.tsx` and `AvailabilityPollsDashboard.tsx` (and the Players and Match-day cover pages if they set their own).
- Unchanged: the fields' labels and behaviour, the phone Filters sheet, chips and badge, touch targets (44 px minimum for tappable controls on a phone, so the phone toolbar keeps its field height).

### J. Status chips and sorting on the Player tab (added 2026-10-08, user request: "love it")

So a manager can see at a glance who is available or not on the Player tab of the Responses page (`ResponsesByPlayer.tsx`, both poll types). Mockup: https://claude.ai/artifact/EJgcSMkgxT8LHmVt8hSRMB.

- **Status chips** directly above the table (and left of the "Hide players who haven't answered" switch): All, Available, Unsure, Unavailable, No response, each with its count, in the same colours as the status pills. Tapping a chip shows only the players with that status; tapping it again, or All, shows everyone. The counts describe the selected slot's answers for all players (not narrowed by the search or the chip).
- **Sortable headings:** the Player heading sorts by name (default, A to Z; click to reverse); a slot heading sorts by that slot's status in the order Available, Unsure, Unavailable, No response (click again to reverse). The active heading shows an arrow and `aria-sort`; headings are real buttons (keyboard, focus ring). The sort is applied after the search and the chip filter.
- **Several slots:** a "Slot" selector appears in front of the chips (not for a single-slot or squad poll); the chips and the status sort follow the selected slot, and clicking another slot's heading selects it. The other slots' columns stay visible. Default slot: the first one.
- **Phone:** the chips wrap onto two lines above the table; the slot selector (multi-slot polls) comes first; headings stay tappable (44 px).
- Local UI state only (not in the address); both choices reset when leaving the page. The zebra tint, the override menu and the hide-unanswered switch behave as before (the switch and the chips combine).

## Test Plan

Per `docs/standards/testing.md`:

- **Component tests (Vitest + Testing Library):**
  - `PageCounters`: default density unchanged (Overview), compact renders one-line cards, markers, `aria-pressed`, zero rule and skeleton still pass in both densities.
  - Shared compact switch: small size and label class; used by the `ContentControlsLine` and `FilterBar` sheet.
  - `ResponsesPageShell`: toolbar is inside the panel; `ResponsesByTimeSlot`: number in its own right-aligned column, absent numbers keep alignment; `SlotMatches`: three columns per match and the stacked layout on a phone. Run for both the group and the squad poll pages.
  - Grid sizing hook: height from the measured offset, minimum, re-measure on resize (mocked `getBoundingClientRect`, `ResizeObserver`); `overscroll-behavior: contain` applied.
  - `PlayerAvailabilityPage`: Jump to today in the header slot and not in `ContentControlsLine`; legend before the grid in DOM order; on a phone the lists render and the grid does not.
  - `PlayersPhoneLists`: By game first; opens on the next game day; arrows and swipe change the game; chips filter and clear; By player shows the next four games and expands; legend placement; search and filters apply.
- **F to I (added):** change-answer menu on the grid cell and the phone pill (opens a menu not navigation; squad and group saves with the looked-up window id; two overlapping saves; failure keeps the old mark); the two poll panels (rows, sorting, chips, header text for both Show closed states, links, zero not clickable, no 48-hour filter left); the read-only fully covered fixture group and the scroll-into-view of the linked group; the compact toolbar density (comfortable default unchanged, League/Team/Section fields aligned at 36 px, 12 px page gaps, phone unchanged). Visual checks of these need Storybook or Playwright, which were not run.
- **Storybook:** stories for `PageCounters` compact (rest, active, loading, warning), the compact switch, the aligned name list and match lines, the legend row, and `PlayersPhoneLists` (both modes, empty).
- **Playwright e2e (one spec, mobile and desktop viewport):** desktop — the Players page does not produce a page scrollbar next to the grid, Jump to today in the header scrolls the grid; mobile — the By game / By player lists show and filtering a chip changes the list.
- **Backend / contract:** none (no backend change).

## Acceptance Criteria

- On the Polls page the four counters are separate cards about 44 px tall with number and label on one line and a 6 px gap; four across on desktop, 2×2 on a phone. The corner marks, hover lift, green active outline and keyboard behaviour are unchanged.
- The Overview key figures look exactly as before; `PageCounters` without `density` renders as it does today.
- Every Availability toggle uses the shared small switch and caption-size label; no page defines its own toggle style.
- On both the group and the squad poll Responses pages the tabs and search sit in the white elevated panel.
- In the Available, Unsure and Unavailable lists the player names are separated by thin dividers and there is no shirt number.
- The Player tab has no `#` column and its rows alternate in a light tint starting with the first row (readable in light mode, with the status pills still legible on both tints).
- The Responses pages have two tabs (Time slot | Player). A slim gauge sits in the page header on both tabs (right-aligned in the poll's info line on desktop, its own line on a phone): answered all / some / none for a poll with several slots, the four-status split for a single-slot or squad poll; each slot card of a multi-slot poll has its own thin bar; the old Summary tab and its cards are gone.
- The "No response" bar of each slot card shows an arrow next to Show / Hide, the whole bar toggles it, and it announces its expanded state.
- The browser tab title names the view (and the poll on a Responses page); the Time slot lists have no inner scrollbar and the page is the only vertical scroller there.
- Match lines under a slot heading align in columns (match | date and time | league), and stack on a phone.
- On the Players view at desktop and tablet width, with the Filters row at its tallest, the page has no vertical scrollbar of its own while the grid is taller than the window; the grid never scrolls the page when it reaches its end; below about 150 px of available height the page scrolls instead; sticky headers and the sticky player column still work.
- "Jump to today" is right-aligned in the page header on Players (grid shown, not on a phone); the header height does not change when switching views.
- The legend is a single compact row directly above the grid and visible without scrolling at 1280×720.
- Below the tablet breakpoint the Players view shows "By game" first, opening on the next game day, with working arrows, swipe and filtering chips; "By player" shows the next four games per player and expands to all of that player's games; the legend sits under the switch.
- Clicking a mark in the Players grid, or a status pill / game mark on the phone lists, opens a menu to change that one answer (with an "Open poll" entry) instead of navigating away; the answer saves through the existing override endpoints for both squad and group polls, the cell updates, and cells with no poll are not clickable.
- Clicking "Open polls" / "Polls shown" or "Close in 48 hours" opens a slide-in panel (bottom sheet on a phone) listing those polls with Open / Closed chips, closing times, answered counts and links to their Responses pages; the 48-hour list filter, chip and phone toggle no longer exist.
- A fully covered fixture group on the New group poll page is read-only with a note, and a linked group is scrolled into view (H).
- On the Availability pages the toolbar panel is about 52 px tall with 8 px padding and 36 px fields, and the gaps between the page header, counters, toolbar and content are 12 px; the other list pages are unchanged (I).
- The Player tab has status chips with counts (All / Available / Unsure / Unavailable / No response) that show only players with that status for the selected slot, sortable headings (name; slot status in the order Available, Unsure, Unavailable, No response) with an arrow and `aria-sort`, and a Slot selector for polls with several slots.
- No new endpoint, no `openapi.yaml` change; the phone lists send the same request as the grid.

## Rollout Notes

Decided by the user (2026-10-08): one branch and one PR for the whole spec, built in one go, then the standards reviews, because all of it is frontend-only work on the Availability pages. Inside that PR, one commit per item so it can be reviewed (and if needed reverted) piece by piece:
1. **Compact counters, shared toggles and the browser tab title** (A, B, C8).
2. **Responses page polish** (C1–C7, C9; C1–C3, C6, C7 and C9 on both poll types, C4–C5 on the Player tab).
3. **Players on desktop and tablet** (D1 sizing hook, D2 header action, D3 legend).
4. **Players on a phone** (E, `PlayersPhoneLists`).
5. Later the same day, at the user's request: **F** change an answer from the Players grid and lists, **G** poll lists behind the Open polls and Close in 48 hours counters (replacing the 48-hour list filter), **H** the New group poll page fixes, **I** the compact toolbar and spacing, plus review fix commits.

Mockups:
- Counters, gap variant (figures 5 and 6): https://claude.ai/artifact/17AcuMRL6c79Btf5rqzAyL
- Players phone lists (By game / By player): https://claude.ai/artifact/8pLSkdAXZDAXU9cwtbtTAL
- Grid scroll options (option 1 chosen): https://claude.ai/artifact/NboSCFBhbsQsDf6fJpJ3y8
- Combined Players layouts, desktop and phone (desktop part confirmed): https://claude.ai/artifact/56L3BkDVpZz48U9XtHzeM9

## Open Questions

None. Decided by the user on 2026-10-08 ("yes to all" to the suggestions): the browser tab title includes the view (C8); the phone lists say "No poll" in the legend; alternating rows on the Player tab only for now (others later); the header gauge as drafted in C6; the Time slot lists grow with no inner scrollbar (C9). The earlier questions (which control "Show / Hide" meant, the Players desktop layout) are resolved in C7 and D.
