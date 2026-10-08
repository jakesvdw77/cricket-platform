# 085 — Availability Polish

**Depends on:** 081 (page counters), 083 (filters, toolbars, `ContentControlsLine`), 084 (clickable counters), 064–066 and 067 (poll cards and the group and squad Responses pages), 068 (Players grid and its legend), 073 and 074 (availability hub; Coverage is now Match-day cover), 079 (Overview key-figure cards, which share `keyFigureCardSx` with `PageCounters`)
**Status:** draft — written 2026-10-08 from the user's review of the built 083/084 pages in the browser; the small findings were raised one at a time and are combined here. Agreed by the user: A (counters), B (toggles), C (Responses page), E (Players on a phone, "yes that looks great"). **D1–D3 (Players on desktop and tablet): mockup presented, to be confirmed** — the user approved the phone part and asked to see the full layouts, and has not yet said yes to the desktop part. Nothing built.

## Problem & Goals

After 083 and 084 the Availability pages work but look heavy. The four counters take about 90 px of height, the toggles are MUI default size (larger than the approved mockup), the group poll Responses page has a toolbar on the bare background and lists that are hard to scan, and the Players view scrolls twice (the grid and the page) with its legend and Jump button out of sight or out of place. On a phone the Players grid is hard to use at all.

Goals:
- Slimmer counters (A) and one small toggle style across Availability (B).
- A tidier Responses page: a toolbar panel, names first, aligned match lines (C).
- Players on desktop and tablet: one scroll, Jump to today in the header, legend above the grid (D).
- Players on a phone: two vertical lists instead of the grid (E).

## Non-goals

- **No backend, API or data change.** Everything is presentation over the data and endpoints that exist today.
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
- As a manager, I read a player's name first in the Available, Unsure and Unavailable lists, with the shirt number tucked to the right, so that I can scan names quickly.
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
- **C2 Name lists.** In the Available / Unsure / Unavailable lists (the player row in `ResponsesByTimeSlot.tsx`) the shirt number (`#9`, `#97`) moves to a fixed-width, right-aligned column after the name, so the name starts at the left edge. Rows without a number keep the column empty so names still align. The row remains the tap target for the override menu.
- **C3 Match lines.** `SlotMatches` renders each match as a row with columns: match (`Team v Opponent`, bold), date and time, league. Columns align across the lines of one slot (CSS grid, or a shared `grid-template-columns` per list) and the separators line up. On a phone each match stacks (match, then date and time, then league). The Summary cards use the same component and get the same alignment. Empty-league lines leave the third column empty.
- **C4 Player tab shirt numbers.** On the Player tab (`ResponsesByPlayer.tsx`, a table with `#`, Player and one column per time slot) the `#` column header and its numbers are right-aligned in a narrow fixed-width column, so the number sits next to the name. Rows without a number keep the cell empty.
- **C5 Alternating rows.** The rows of the Player tab table alternate between the panel background and a light tint (an opaque tint from the theme, as the Players grid uses, not a raw colour), so a name can be followed across to its status. The hover state, the override menu tap target and the "Hide players who haven't answered" switch are unchanged. Applies to this table only for now; see Open Questions.

### D. Players on desktop and tablet (mockup presented, to be confirmed)

Applies from the tablet breakpoint up (`sm` and above, `theme.breakpoints.up('sm')`); the grid stays on desktop and tablet. Files: `ui/src/pages/manage/PlayerAvailabilityPage.tsx`, `playerAvailability/AvailabilityGrid.tsx`, `playerAvailability/Legend.tsx`, `availability/AvailabilityHubLayout.tsx`.

- **D1 One scroll.** `SCROLL_BOX_MAX_HEIGHT = 'calc(100vh - 320px)'` in `AvailabilityGrid.tsx` is a guess from before the taller 083 header and filters, so the page scrolls as well as the grid. Replace it with a **`useFillViewportHeight`** hook (in `ui/src/hooks/` if that is where hooks live, else beside the grid) that measures the grid box's top offset (`getBoundingClientRect`) and sets its height to `window.innerHeight - top - bottom padding`, re-measured on resize, orientation change and when the content above changes (a `ResizeObserver` on the page container, so the filter row wrapping or an alert appearing is handled). Minimum height about 150 px (`SCROLL_BOX_MIN_HEIGHT` is lowered from 240); below that the page scrolls instead. The box gets `overscroll-behavior: contain` so the grid's scroll never chains to the page. Sticky date headers, sticky slot rows and the sticky player column stay exactly as they are (068).
- **D2 Jump to today.** The button moves out of `ContentControlsLine`'s `pinned` slot into the page header action slot, right-aligned, where "New poll" sits on Polls. `AvailabilityHubLayout.tsx` currently reserves that slot on Players with an invisible placeholder button (`visibility: hidden`, so the header does not jump between views); the real button replaces the placeholder. The page passes the button up through the existing hub context (`hubContext`), alongside how the Polls "New poll" action is supplied. Shown only where the grid is shown (not on a phone, not when there are no polls); otherwise the placeholder keeps the height. Behaviour is unchanged (`scrollToGame` of the first upcoming game; disabled when there is none).
- **D3 Legend above the grid.** The six-mark legend (`Legend.tsx`) moves from under the grid to directly above it, in one compact row (tighter gaps, `caption` text) so it is visible without scrolling. It still wraps instead of clipping on narrow tablets.

### E. Players on a phone (agreed)

Below the tablet breakpoint (`down('sm')`) the grid is replaced by a new **`PlayersPhoneLists`** component (four-file anatomy, `ui/src/pages/manage/playerAvailability/`). Same filters, search and Filters sheet as today (083), same data and endpoint (see API Contract).

- A **"By game | By player"** segmented switch (`segmentedSwitchSx`) at the top; **By game opens first**. The choice is local per visit, like the other view choices.
- **By game:** a game selector card with previous/next arrows (and a horizontal swipe) showing the game's title, date and time and "Game n of N"; status chips with counts that also filter the list (Available, Unsure, Unavailable, No response; tapping an active chip clears it); one tall list of players, each row with a status pill and a small dot for "picked". **Opens on the next game day** (the first upcoming game, `firstUpcomingGame`/`nextGameDayMarker` in `gridHelpers.ts`). No jump button. A one-line note under the chips explains the picked dot.
- **By player:** one row per player with a mark for each of the **next four games** (`CellMark`), under a strip with the date and match label of those four games; tapping a row expands the full list of that player's games with their marks. The **legend sits directly under the switch** (compact, wraps).
- Reuses `CellMark`, `cellFor`, `cellLabel`, `kickoffText`, `groupGames`/`orderedGames` and the player filtering from `gridHelpers.ts` rather than re-deriving them. Rows are at least 44 px high. Players with no games or no polls show the existing empty states.

## Test Plan

Per `docs/standards/testing.md`:

- **Component tests (Vitest + Testing Library):**
  - `PageCounters`: default density unchanged (Overview), compact renders one-line cards, markers, `aria-pressed`, zero rule and skeleton still pass in both densities.
  - Shared compact switch: small size and label class; used by the `ContentControlsLine` and `FilterBar` sheet.
  - `ResponsesPageShell`: toolbar is inside the panel; `ResponsesByTimeSlot`: number in its own right-aligned column, absent numbers keep alignment; `SlotMatches`: three columns per match and the stacked layout on a phone. Run for both the group and the squad poll pages.
  - Grid sizing hook: height from the measured offset, minimum, re-measure on resize (mocked `getBoundingClientRect`, `ResizeObserver`); `overscroll-behavior: contain` applied.
  - `PlayerAvailabilityPage`: Jump to today in the header slot and not in `ContentControlsLine`; legend before the grid in DOM order; on a phone the lists render and the grid does not.
  - `PlayersPhoneLists`: By game first; opens on the next game day; arrows and swipe change the game; chips filter and clear; By player shows the next four games and expands; legend placement; search and filters apply.
- **Storybook:** stories for `PageCounters` compact (rest, active, loading, warning), the compact switch, the aligned name list and match lines, the legend row, and `PlayersPhoneLists` (both modes, empty).
- **Playwright e2e (one spec, mobile and desktop viewport):** desktop — the Players page does not produce a page scrollbar next to the grid, Jump to today in the header scrolls the grid; mobile — the By game / By player lists show and filtering a chip changes the list.
- **Backend / contract:** none (no backend change).

## Acceptance Criteria

- On the Polls page the four counters are separate cards about 44 px tall with number and label on one line and a 6 px gap; four across on desktop, 2×2 on a phone. The corner marks, hover lift, green active outline and keyboard behaviour are unchanged.
- The Overview key figures look exactly as before; `PageCounters` without `density` renders as it does today.
- Every Availability toggle uses the shared small switch and caption-size label; no page defines its own toggle style.
- On both the group and the squad poll Responses pages the tabs and search sit in the white elevated panel.
- In the Available, Unsure and Unavailable lists the player's name starts at the left edge and the shirt number is right-aligned in its own column.
- On the Player tab the `#` column is right-aligned next to the name and the table rows alternate in a light tint (readable in light mode, with the status pills still legible on both tints).
- Match lines under a slot heading align in columns (match | date and time | league), and stack on a phone.
- On the Players view at desktop and tablet width, with the Filters row at its tallest, the page has no vertical scrollbar of its own while the grid is taller than the window; the grid never scrolls the page when it reaches its end; below about 150 px of available height the page scrolls instead; sticky headers and the sticky player column still work.
- "Jump to today" is right-aligned in the page header on Players (grid shown, not on a phone); the header height does not change when switching views.
- The legend is a single compact row directly above the grid and visible without scrolling at 1280×720.
- Below the tablet breakpoint the Players view shows "By game" first, opening on the next game day, with working arrows, swipe and filtering chips; "By player" shows the next four games per player and expands to all of that player's games; the legend sits under the switch.
- No new endpoint, no `openapi.yaml` change; the phone lists send the same request as the grid.

## Rollout Notes

Likely slices, each its own PR (the first two are independent):
1. **Compact counters and shared toggles** (A, B).
2. **Responses page polish** (C1–C5; C1–C3 on both poll types, C4–C5 on the Player tab).
3. **Players on desktop and tablet** (D1 sizing hook, D2 header action, D3 legend). Held until the user confirms D.
4. **Players on a phone** (E, `PlayersPhoneLists`).

Mockups:
- Counters, gap variant (figures 5 and 6): https://claude.ai/artifact/17AcuMRL6c79Btf5rqzAyL
- Players phone lists (By game / By player): https://claude.ai/artifact/8pLSkdAXZDAXU9cwtbtTAL
- Grid scroll options (option 1 chosen): https://claude.ai/artifact/NboSCFBhbsQsDf6fJpJ3y8
- Combined Players layouts, desktop and phone (desktop part to be confirmed): https://claude.ai/artifact/56L3BkDVpZz48U9XtHzeM9

## Open Questions

1. **"Show / Hide arrow buttons"** (raised on the group poll Responses page): which control does the user mean? Not visible in the screenshot. Not specified until answered.
2. **D1–D3 desktop layout** (sizing to the window, Jump to today in the header, legend above the grid in one row): mockup presented, to be confirmed by the user.
3. **Browser tab title** (nice-to-have): include the view, e.g. "Players · Availability"? Not part of the slices unless the user says yes.
4. **Phone legend wording:** shorten "Not in this game's poll (or no poll)" to "No poll" on the phone lists?
5. **Alternating rows beyond the Player tab:** should the Summary table, the Time slot name lists, the Players grid and the Match-day cover lists get the same alternating tint, or only the Player tab? Drafted as the Player tab only.
