# 137: Team Selection revamp (hub, four views, Select Team page)

**Status:** built 2026-11-04 on the owner's answers; owner browser hand-check pending. Approved by the owner 2026-11-04 with these answers: Select Players lives in Manage Team for now (after the revamp the owner wants to look at the whole process of choosing available players, a later spec); Matches gets Cards as well as the table; a ready row keeps a quick Announce Team button; Batting Order column actions (Select Players, Reorder, Announce) are LEFT AS THEY ARE for now: the owner saw the kebab mockup (`docs/mockups/team-selection-reorder-mockup.html`), found the kebab odd on that view and will review it again later; counters on the Matches tab only; team names open the team page. The owner asked for the revamp after merging `136`. Written from `docs/standards/page-anatomy.md` (binding, including the 2026-11-04 decisions made while building `136`: Create New labels, empty-state links, referenced names are links, Back restores the same view, `DateTile`) with `136`, `129` and `130` as worked examples, then checked against the current code under `ui/src/pages/manage/teamSelection`. Nothing is built.
**Depends on:** `136` (pattern and shared pieces), `126` (Manage menu), `127` (`returnTo`), `093` (the hub and the Select Team page), `076` (selection rules, which do not change), `040` (announce), `114`/`131` (sharing), `085` (counters, filters), `069`/`074` (availability grid).

## Problem & Goals
Team Selection was built on the Availability hub's old pattern (`093`) and predates the page standard. The hub header holds a segmented switch with icons and a "Showing: ..." subtitle; each view has a floating filter bar plus a second "Showing N matches" line with loose switches; the Matches table has a chevron-less stretched link but three inline buttons per row (Announce, Share, Select players); the Time slots cards and the Batting order columns carry their own buttons; the Select Team page has a button grid of four equal buttons on the title row and a Season pill that cannot be changed.

**Goals**
- Apply the standard without losing any function: skeleton, real tab row, fused toolbar, toggle chips, one kebab per row and card (Batting Order columns excepted for now), one Manage menu on the Select Team page with Share last, compact counters, Title Case, Create New labels, empty-state links, record names as links, `returnTo` with Back restoring the same view.
- Keep the selection rules, availability answers, announcing and sharing exactly as they are (`076`, `040`, `114`, `131`).
- Make the four views read as one family with the Availability hub, so the user sees one pattern.

## Non-goals
No change to selection rules, availability rules, announce or share outputs, permissions, the overview request or any backend, migration or `openapi.yaml`. No new view. The Batting order drag-free reorder interaction, the Players grid answer menu and the Select Players dialog keep their behaviour.

## User Stories
- As a manager, I open Team Selection and see the same page skeleton as Availability and Matches: a title, tabs, counters on the Matches tab, one flat toolbar.
- As a manager, I act on a match side (select players, announce, share) from one kebab, and the row itself opens the Select Team page.
- As a manager, I click a team or player name anywhere in these views and get that record, and Back brings me to the same view with the same filters and toggles.
- As a manager, on the Select Team page I find Select Players, Availability, Announce Team and Share Team in one Manage Team menu, with the reason shown when something is blocked.

## Data Model Changes
None.

## API Contract
No change.

## What differs today (and the change)
| Area | Today | Change |
|---|---|---|
| Hub header | "Team selection", subtitle "Showing: ...", Season pill, icon segmented switch in `middle` | "Team Selection" title with the Season pill, no subtitle, a real tab row (`ViewTabsRow`, no icons): Matches, Time Slots, Players, Batting Order |
| Toolbars | `FilterBar` floating, then `ContentControlsLine` with "Showing N ..." and switches | One flat `ToolbarCard` per view: League, Section, Team, search, the View Entire Season chip (`ToolbarToggle`); no count text; switches in the phone sheet |
| Matches rows | Whole-row link plus Announce, Share and Select players buttons | Whole-row link opens the Select Team page; ONE kebab per row: Select Players, Announce Team, Share Team last; a ready row also keeps a quick Announce Team button beside the kebab; Cards as well as the table |
| Time slots cards | Footer buttons Select players and Share | Flat card, ONE kebab in the card header; team and player names are links |
| Batting order | Per-column footer buttons Select players, Reorder, Announce | Footer buttons unchanged for now (owner, 2026-11-04: review later); only the toolbar, Title Case labels and name links change |
| Players grid | Toolbar, content line, slot arrows beside the scope text | Toolbar as above; the slot navigator at the right of the legend row (as on Availability Players); player names are links |
| Select Team page | Back, Season pill, four equal buttons (Availability, Announce team, Share team, Select players) | Back alone, title row with logos, name and an Announced badge, ONE filled **Manage Team** menu, no Season pill |
| Empty states | Text only | Icon, and a "Create New Match" link when nothing exists yet; none for a filtered-out result |
| State on return | View toggles and filters partly in storage, "View entire season" in component state | Filters and View Entire Season in the address, so Back from Select Team restores them |
| Labels | Sentence case ("Time slots", "Batting order", "Select players", "Announce team") | Title Case everywhere (see Labels) |

## UI Requirements
Everything follows `page-anatomy.md`; only the decisions specific to this page are listed.

### Hub shell (`TeamSelectionHubLayout`)
Title row: "Team Selection" with the Season pill beside it (the content depends on the season, so the pill stays; no "All seasons"). No button on the title row (nothing is created here). Under it a `ViewTabsRow` of link navigation, `aria-current` on the active tab. The tab row carries no icons and no actions. Counters sit inside the Matches tab only, as they do now (they are that view's quick filters).

### Matches tab (`MatchesView`, `SelectionMatchesTable`)
Compact counters (Upcoming Matches or Matches Shown, Not Started, In Progress, Ready To Announce, Announced) stay as the quick filters. The toolbar is fused into the table card: League, Section, Team, search, View Entire Season chip. Columns, status chip and gauge unchanged; the last cell is ONE dense kebab (`ManageMenu trigger="kebab" dense`): Select Players, Announce Team (disabled with its reason until ready), Share Team last (disabled until announced). The row link keeps the accessible name; no chevron. The kebab never navigates the row. Team names in the row are links with `returnTo` (label "Team Selection"); the stretched row link sits under them.

### Time Slots tab (`SlotsView`)
Date and part-of-day heading per block (sentence case body, bold heading), one flat card per club side: title as links to the two teams, kickoff and league as caption, the Announced badge, the gauge (`ProgressMeter` where an x-of-y bar is drawn: `SelectionGauge` keeps its look unless the owner asks), the picks list with player names as links, and ONE kebab in the card header. The two footer buttons go.

### Players tab (`PlayersView`)
Toolbar as above (search placeholder "Search players"). The slot navigator and the legend share a row, the navigator right-aligned. Player names in the grid are links with `returnTo`. The pick and unpick behaviour, muted reasons and busy states are unchanged.

### Batting Order tab (`BattingOrderView`)
Toolbar as above. The column footer buttons (Select Players, Reorder or Done, Announce), the "+ Add" cell buttons and the pick menus are unchanged for now; the owner will review this view's actions later (a kebab did not look right here). Labels become Title Case and player names are links.

### Select Team page (`SelectTeamPage`)
Back alone on the top row ("Back to Team Selection", or the origin from `returnTo`, through `useBackLink`). Title row: team logos, the match title, an Announced or Not Announced badge, and ONE filled **Manage Team** button (`ManageMenu`, fixed width) containing Select Players, Availability (opens the existing availability menu or panel), Announce Team (Un-announce Team once announced; disabled with its reason when blocked) and Share Team last (disabled until announced). The blocked reason shows as the disabled item's reason, not as a caption under the title. No Season pill (the page is about one match). Subtitle: kickoff and the league name as a link. The Select Players dialog, the Announce confirmation and every rule are unchanged.

### Return navigation and state
Every link that leaves a Team Selection page carries `returnTo` with the label "Team Selection" (`withReturnTo(..., currentOrigin(location), 'Team Selection')`); the Select Team page honours it. League, Section, Team filters and View Entire Season live in the address (`useUrlFlag` for the toggle); search is the one exception.

### Labels (Title Case; body text and headings sentence case)
Team Selection, Matches, Time Slots, Players, Batting Order, View Entire Season, Upcoming Matches, Matches Shown, Not Started, In Progress, Ready To Announce, Announced, Select Players, Announce Team, Un-announce Team, Share Team, Reorder, Done Reordering, Manage Team, Create New Match.

### Components and files
Reuse `ViewTabsRow`, `ToolbarCard`, `ToolbarToggle`, `ManageMenu`, `EmptyStateLink`, `ProgressMeter`, `useUrlFlag`, `PlayerNameLink`. A small `TeamNameLink` (team page, `returnTo`) is the one new shared piece, beside `PlayerNameLink`. A shared `useSideActions` hook builds the ordered kebab and Manage Team items from one place (like `usePollActions`), so the four views and the page cannot drift. Retire `ContentControlsLine` use here and `segmentedSwitchSx` in the hub.

## Documentation gaps
- `page-anatomy.md` row for "Team selection hub" (currently "Not reviewed") to "In progress" with the decisions above.
- `frontend.md` paragraph on the Team Selection hub still describes the `ContentControlsLine` and the segmented switch.
- `docs/roadmap.md` row for `137`.

## Test Plan
- **Unit/component:** hub shell (title, tabs with `aria-current`, no subtitle); toolbar per view (chip, no count text); Matches row kebab items and their order, disabled reasons, row link accessible name, no chevron; `useSideActions` order for row, card, column and page; Time Slots card kebab; Batting Order column kebab and the Done button in reorder mode; Players legend row with the navigator; Select Team page (Manage Team items, Share last, reason on a disabled item, Back honours `returnTo`, no Season pill); `TeamNameLink` carries `returnTo`; filters and View Entire Season restored from the address.
- **Stories:** `TeamNameLink`; kebab states of the row and card.
- **Not run:** Playwright, as with `136`; the 375 px check is done by the owner in the browser.

## Acceptance Criteria
1. The four tabs are a real tab row with no icons and no subtitle; titles and labels are Title Case.
2. Every view has one flat toolbar card with League, Section, Team, search and the View Entire Season chip, and no "Showing N" line.
3. A match row and a Time Slots card each have exactly one kebab, with Share Team last and reasons on disabled items; the row link still opens the Select Team page.
4. The Select Team page has Back alone, one filled Manage Team menu, no Season pill and an Announced badge; every action works as before.
5. Team and player names are links with `returnTo`; Back from a record, and from Select Team, returns to the same tab with the same filters and toggles.
6. An empty "No upcoming matches" offers "Create New Match"; a filtered-out result does not.
7. Selection, availability, announce and share behaviour is unchanged (existing tests for them stay green).

## Decisions (owner, 2026-11-04)
1. Select Players sits inside **Manage Team** on the Select Team page, with the empty "Nobody picked yet" state carrying a "Select Players" link. The owner will look at the process of choosing available players after this revamp (a later spec, listed in the roadmap).
2. Matches has a **Cards | List** toggle (`ListViewToggle`, remembered per page); the cards are `RecordCard`-style flat cards with the status chip, the gauge and one kebab, in the dynamic card grid, and the dashed card rule does not apply (nothing is created here).
3. A **ready** row or card keeps a quick **Announce Team** button beside its kebab (the one frequent action); the kebab also lists it.
4. **Batting Order column actions stay as they are** (no kebab, Reorder unchanged) until the owner reviews the view again.
5. Counters on the **Matches tab only**.
6. **Team names** open the team page.

## Later changes (owner, 2026-11-05)
- The Matches list card and the Team Selection card are the same layout: the venue is part of the sub-title (under the league), with a round Get Directions button at the right end (shown when the venue has a usable position); the weather forecast is its own strip card (only within the forecast window, today and six days); a Team Manager card shows "–" until a team can have a manager (backlog: full spec required).
- The kebab menus of the Matches list and Team Selection rows, cards and Manage Team have Get Directions and Show Weather Forecast (a modal); each is hidden when there is nothing to show.
- Cards never show more than three in a row (the three-card rule, page-anatomy section 6).
- The Select Team page's four figures are compact counters (no icons).

## Rollout Notes
Frontend only; no migration. Update `page-anatomy.md`, `frontend.md` and `roadmap.md` (including the later "choosing available players" item) in the same PR.
