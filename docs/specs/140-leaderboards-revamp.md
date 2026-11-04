# 140: Leaderboards revamp (tabs, toolbar, standings, awards)

**Status:** approved 2026-11-04 (the owner accepted all six defaults: "Yes to all"), built the same day; owner browser review pending. One deviation: the Awards minimums and Choose Categories stay where they are on the Awards view (their own row), not inside the toolbar card; the toolbar card above Awards holds the filters and the name toggle. The owner asked for the Leaderboards page next after Results (`138`) and the quiet menu (`139`). Written from `docs/standards/page-anatomy.md` (binding, including every decision taken in `136` to `138`) with `137` and `138` as worked examples, then checked against `ui/src/pages/manage/leaderboards`. 
**Depends on:** `103` (player stats, leaderboards, awards), `116` (team stats, Teams tab), `127` (`returnTo`), `136` to `138` (pattern and shared pieces).

## Problem & Goals
Leaderboards predates the page standard. The title row holds a filled Awards button that duplicates the Awards tab; the tabs are the older MUI strip; the filter bar is the floating one, Season is one of its selects, Sort by is a loose select with a separate reverse icon button above the table, and the Full name | Initials toggle sits alone on its own row; names are plain text; labels are sentence case.

**Goals**
- Apply the standard without losing any function: skeleton, a real tab row, one flat toolbar fused into the standings table, Sort inside the toolbar, name toggle last in it, Season as the title-row pill, record names as links with `returnTo`, Title Case, Back restoring the same view.
- Keep every rule: the filters, the sort and direction, the minimums, the Awards sheet and its category chooser, the Teams tab.

## Non-goals
No change to what a board counts, the minimums, the awards rules, paging, or any backend, migration or `openapi.yaml`. Player stats and Team stats pages are separate reviews. PDF or text output of Awards stays deferred (`103`).

## User Stories
- As a manager, I open Leaderboards and see the same skeleton as Matches and Results: a title with the Season pill, a tab row, one toolbar, a flat table.
- As a manager, I change what the table is ranked by, and reverse it, from the toolbar's one Sort button.
- As a manager, I click a player or team name and reach that record, and Back returns me to the same tab, sort and filters.

## Data Model Changes
None.

## API Contract
No change.

## What differs today (and the change)
| Area | Today | Change |
|---|---|---|
| Title row | "Leaderboards" and a filled Awards button (hidden on Awards and Teams) | "Leaderboards" with the Season pill beside it (All Seasons offered); no button: Awards is already a tab |
| Tabs | MUI tab strip | `ViewTabsRow` (link tabs, no icons, `aria-current`): Batting, Bowling, Fielding, Awards, Teams |
| Toolbar | Floating `FilterBar` with Season, League, Section, Team (and Competition on Teams); Sort by select and a Reverse icon button above the table; name toggle on its own row | One flat `ToolbarCard`, fused into the standings card: League, Section, Team (Competition on Teams), Sort (`ToolbarSortButton`: "Sort: Runs, Highest First", with a direction choice), the name toggle last in the toolbar look (not on Teams) |
| Sort direction | A separate Reverse icon button | The Sort menu lists each sortable column and, for the current one, its two directions; the heading click still reverses; state in the address as today |
| Standings | Card with a title and a tinted header | Flat card fused with the toolbar, tinted header, zebra rows; player names are links (player page, `returnTo` "Leaderboards"); team names `TeamNameLink` |
| Awards | Category cards in a 2-column grid, minimums above | Cards follow the three-card rule (3 columns from `lg`, 2 from `sm`, 1 on a phone); the toolbar card above them holds the filters and the name toggle; the minimums and Choose Categories keep their own row (moving them into the toolbar is a later step) |
| Empty states | Text and "Clear filters" button | Message plus the underlined "Clear Filters" text link only when filtered (page-anatomy empty-state rule); no create link (nothing is created here) |
| State on return | Filters saved per club, tab and sort in the address | Same, plus the Season pill and the direction in the address so Back restores the whole view |
| Labels | "Sort by", "Reverse order", "Clear filters", "Choose categories" | Title Case: "Sort: ...", "Clear Filters", "Choose Categories", "Highest First", "Lowest First", "All Seasons" |

## UI Requirements
Everything follows `page-anatomy.md`; only the decisions specific to this page are listed.

### Title row and tabs
"Leaderboards" with the Season pill (current season by default, "All Seasons" offered; kept per club as today). No filled button. Under it a `ViewTabsRow`; the Teams tab keeps its own filters (Competition) and the player catalogue is not fetched there.

### Toolbar
One flat `ToolbarCard`: League, Section, Team selects narrowed to values that have counted data (as today), Competition on Teams, then Sort and the name toggle last. In the standings it is fused into the table card; on Awards and Teams (no standings table to fuse with) it is a standalone card with the usual 16 px (12 px phone) gap. On a phone: Filters and the Sort button on the row, the rest in the sheet.

### Sort
`ToolbarSortButton` labelled "Sort: <Column>, <Highest First|Lowest First>". Its menu lists the sortable columns of the tab in the catalogue's order; choosing the current column reverses it, choosing another starts from that column's natural direction. `?sort=` and `?dir=` as today. A heading click behaves as today.

### Standings table and Awards
Standings: flat card, tinted header, zebra rows, minimum control kept under the table as today, "Load more" as today. Player and team names are links with `returnTo` (label "Leaderboards"). Awards: one `InfoCard` per category in the three-card grid, joint winners together, the quiet amber note kept; Choose Categories and the two minimums keep their own row for now.

### Return navigation and state
Every leaving link carries `returnTo` with the label "Leaderboards"; Back restores tab, sort, direction, season and filters (address plus the existing per-club saved filters).

### Labels (Title Case; body text sentence case)
Leaderboards, Batting, Bowling, Fielding, Awards, Teams, All Seasons, Sort: <Column>, Highest First, Lowest First, Clear Filters, Choose Categories, Show More.

### Components and files
Reuse `ViewTabsRow`, `ToolbarCard`, `ToolbarSortButton`, `ToolbarToggle` style chips for any switch, `NameModeToggle toolbar`, `PlayerNameLink`, `TeamNameLink`, `EmptyStateLink`, `dynamicCardGridSx`. No new shared component. Retire the Sort by select, the Reverse icon button, `FilterBar` (floating) and the loose name-toggle row here.

## Documentation gaps
- `page-anatomy.md` row "Player stats / Team stats / Leaderboards" (currently "Not reviewed"): Leaderboards to "In progress" with these decisions.
- `frontend.md` paragraph on the Leaderboards page, if one exists.
- `docs/roadmap.md` row for `140`.

## Test Plan
- **Unit/component:** title row (Season pill, no button); `ViewTabsRow` with `aria-current` and the tab in the address; toolbar (one Sort button, name toggle last, none on Teams); Sort menu choices and direction, `?sort=`/`?dir=` restored; fused standings card; name links carry `returnTo`; Awards three-card grid and Choose Categories; empty-state "Clear Filters" link only when filtered; Season pill choice and All Seasons.
- **Stories:** unchanged shared pieces only.
- **Not run:** Playwright; the 375 px check is done by the owner in the browser.

## Acceptance Criteria
1. The title row has the Season pill and no button; the tabs are a real tab row with no icons.
2. One flat toolbar holds League, Section, Team (Competition on Teams), Sort and, last, the name toggle (not on Teams); no Sort by select, Reverse icon or loose toggle row.
3. Sort works as today (column, direction, heading click) from the one button, and state survives Back.
4. Player and team names are links with `returnTo`.
5. Awards cards follow the three-card rule; the toolbar card above them holds the filters and the name toggle.
6. An empty filtered result offers "Clear Filters"; nothing is offered when there is no data at all.
7. Existing board, award and team-stats behaviour is unchanged (their tests stay green).

## Open questions (default if unanswered)
1. **Season control:** the title-row pill (with All Seasons), as on other lists? Default: **yes**.
2. **Awards button:** drop it from the title row (the Awards tab is one click away)? Default: **drop**.
3. **Sort menu:** one button listing columns and, for the current one, the two directions, instead of a separate Reverse button? Default: **yes**.
4. **Name toggle:** last control in the toolbar, hidden on Teams as today? Default: **yes**.
5. **Awards grid:** three cards per row from `lg` (was two)? Default: **yes**.
6. **Minimum control** (rate sorts) stays under the table where it is? Default: **yes**.

## Rollout Notes
Frontend only; no migration. Update `page-anatomy.md`, `frontend.md` (if it has a paragraph) and `roadmap.md` in the same PR.
