# 141: Players revamp (list, cards, table, Player page, Player form, Player stats)

**Status:** approved 2026-11-04: the owner took every default except question 1, where the label is "Add New Player" (not "Add New Player"); built the same day. Extended the same day at the owner's request ("Yes to both, build them now") to the Player form and the Player stats page, so all four Players pages are done in this PR; see Later changes. The owner asked for Players next after Leaderboards (`140`). Written from `docs/standards/page-anatomy.md` (binding, including every decision taken while building `136` to `140`) with `130` (Matches) and `138` (Results) as worked examples, then checked against the current code: `pages/manage/PlayerList.tsx`, `PlayerDetailPage.tsx`, `playerDetail/*`, `components/PlayerCard`, `PlayerTable`, `PlayerStatusMenu`.
**Depends on:** `028` (players), `060` (player detail), `088` (players and polls alignment, status actions), `103` (player stats), `119` (link requests card), `127` (`returnTo`), `136` to `140` (pattern and shared pieces).

## Problem & Goals
The Players list and the Player page predate the page standard.

- **List:** one small filled "Add Player" button with a "Showing: ..." subtitle; counters are sentence case; the filter bar is the older floating one (Section select, search, chips) with two switches, the Cards | List toggle and the sort link spread over a separate content line that repeats "Showing N players"; the quick-filter "Clear" sits in the sheet. Cards end in a four-button footer (Status, Edit, View, Stats) and five zebra rows with icons; the table has a Status button and a Stats icon button per row instead of one kebab. Nothing the user filters is kept in the address, so Back from a player loses the view.
- **Player page:** a bespoke band with an 80 px avatar and a two-up Status plus Edit button pair (the standard has ONE Manage menu); four icon-tile figures (`KeyFigureTile`); info cards with raised shadows; the Back label is already honoured.

**Goals**
- Apply the standard without losing any function: skeleton, one filled title-row button, compact counters kept as quick filters, ONE flat toolbar (fused into the table, standalone above the cards), Sort inside it, switches as toggle chips, one kebab per row and card, three-card grid, Title Case, Create New labels, empty-state link, names as links with `returnTo`, Back restoring the view.
- Move the Player page to the shared detail header with ONE Manage Player menu and compact counters.
- Keep every rule: the status rules (Verify, Reject, Suspend, Reactivate and their confirmations in `usePlayerStatusActions`), the link-requests card, the unverified or rejected banner, the season-scoped game counts.

## Non-goals
No change to player rules, statuses, accounts, linking or the data model; no backend, migration or `openapi.yaml` change. The **Player form** (`PlayerFormPage`, `PlayerForm`) and the **Player stats page** (`/manage/players/:id/stats`, `PlayerStatsPage`) are separate reviews (see open question 7); only their links and labels that this spec touches are changed here.

## User Stories
- As a manager, I open Players and see the same skeleton as Matches and Results: a title, one Add New Player button, counters, one toolbar, flat cards or a flat table.
- As a manager, I act on a player from one kebab (open, edit, stats, status changes) and the card or row itself opens the player.
- As a manager, I filter the list, open a player, press Back and find the same filters, quick filter, sort and view.
- As a manager, I open a player and find the same header as a match or a result: Back alone, name and status, ONE Manage Player menu.

## Data Model Changes
None.

## API Contract
No change.

## What differs today (and the change)
| Area | Today | Change |
|---|---|---|
| Title row | "Players", small "Add Player", subtitle "Showing: <section>" | "Players", ONE filled **Add New Player** (opens the existing add page; the owner's wording, 2026-11-04), no subtitle, no Season pill (the two season counters use the default season, there is no control) |
| Link requests | `LinkRequestsWaitingCard` under the title | Kept as it is |
| Counters | Active (or Shown), In A Squad, Selected, Unverified as quick filters | Kept, Title Case: Active Players (Players Shown with Show Inactive), In A Squad, Selected, Unverified; each equals its filter |
| Toolbar | Floating `FilterBar` (Section, search, chips) plus a content line with count text, two `CompactSwitch`es, the Cards, List toggle and a sort link | ONE flat `ToolbarCard`: Section, search, then toggle chips **Missing Date Of Birth** and **Show Inactive**, then **Sort** (`ToolbarSortButton`: Name A To Z, Name Z To A, Most Games This Season, Fewest Games This Season) and last Cards, List; fused into the table card in List view; no count text; on a phone Filters and search, the rest in the sheet |
| Cards | `PlayerCard`: footer of Status, Edit, View, Stats; five icon rows; two games chips | Flat card, no footer; ONE kebab; five rows without icons (Number, Born, Phone, Bat, Bowl, "–" when empty); the status badge, section chip and the two games chips stay; a quick **Verify Player** button on an unverified card |
| Kebab (card and row) | Status button with its own menu; Stats icon button on the row | ONE kebab: Open Player, Edit Player, View Stats, then the status changes valid for that player (Verify, Reject, Suspend, Reactivate; Reject and Suspend in the error colour). Built by one pure function `playerMenuItems` for the card, the row and the Player page so they cannot drift |
| Table | Status button and Stats icon per row | Flat table, tinted header, whole row opens the player, last cell the kebab, no chevron and no Status or Stats buttons |
| Card grid | Auto-fill grid | `dynamicCardGridSx`: never more than three cards a row; a dashed **Add New Player** card (counts as one) shown only when there is at least one card |
| Empty states | Text only | Icon kept; "No players yet" carries the link **Add New Player**; searched or filtered out has none; "Every player has a date of birth" unchanged |
| State on return | Section and Missing Date Of Birth saved per club; focus, inactive, sort and view local | Quick filter (`?focus=`), Show Inactive (`?inactive=1`) and Sort (`?sort=`) in the address; Section and Missing Date Of Birth stay saved per club as today and the view stays remembered in the browser; Back from a player restores them all; search text is never kept |
| Names | Plain title with a stretched link | Kept as the stretched link; the destination gets `returnTo` with the label "Players" |
| Player page header | Band with 80 px avatar, Status and Edit side by side | Shared `ManageScreenHeader`: Back alone, avatar (kept, 56 px), name, ONE status badge inline, section chips under the title, ONE filled **Manage Player** menu at `MANAGE_BUTTON_WIDTH` (Edit Player, View Stats, then the status changes, as the kebab) |
| Player page figures | Four `KeyFigureTile`s with icons | Four compact counters, no icons: Games This Season, Games Overall, Jersey Number, Age (the born date as the Age hint is dropped; it is in Basic Info) |
| Player page cards | Basic Info, Contact Info (raised, Call and Email), Cricket card, Account card | Same four cards, flat with a hairline (`InfoCard flat`), Title Case headings; Call and Email stay as outlined buttons inside the Contact card; the unverified or rejected banner stays, its button reads **Change Status** and opens the same menu |
| Labels | "Add Player", "Change status", sentence case | Title Case everywhere (see Labels) |

## UI Requirements
Everything follows `page-anatomy.md`; only the decisions specific to this page are listed.

### Title row and counters
"Players", one filled Add New Player. `PageCounters density="compact"` directly under (and under the link-requests card when it shows). Clicking the active counter again clears the quick filter, as today.

### Toolbar
One flat toolbar card: Section, search ("Search By Name" placeholder kept as sentence case), the two toggle chips, Sort, Cards, List last. Fused into the table in List view; standalone above the cards. Chips for an active quick filter move into the toolbar as a removable chip (as Results does); "Clear Filters" appears only while a filter is on.

### Cards and table
See the table above. A card keeps the same parts and the same height whatever is on file (rule from `088`); the kebab is the dense `ManageMenu` in the corner. The row kebab holds the same items.

### Player page
Header as above; the status banner under the header; figures; two info cards side by side from `md`; the Cricket card and the Account card full width. No change to the data each card shows.

### Return navigation and state
Every leaving link carries `returnTo` with the label "Players"; `PlayerDetailPage` already honours it (`useBackLink`) and the Edit and Stats pages are checked in the build (a link that carries `returnTo` to a page that ignores it is a defect, so the Stats and Edit pages are made to honour it here, which is a one-line change each).

### Labels (Title Case; body text sentence case)
Players, Add New Player, Open Player, Edit Player, View Stats, Manage Player, Verify Player, Reject, Suspend, Reactivate (the existing status action labels, Title Case), Active Players, In A Squad, Selected, Unverified, Missing Date Of Birth, Show Inactive, Name A To Z, Name Z To A, Most Games This Season, Fewest Games This Season, Change Status, Clear Filters.

### Components and files
Reuse `ManageScreenHeader`, `HeaderActions`, `ManageMenu`, `ToolbarCard`, `ToolbarSortButton`, `ToolbarToggleChip`, `ListViewToggle`, `EmptyStateLink`, `AddCard`, `dynamicCardGridSx`, `PageCounters`, `InfoCard flat`, `useUrlFlag` style address state, `currentOrigin` and `withReturnTo`. New: `utils/playerMenuItems.ts` (pure, ordered items for the card, row and page). Retire the card footer, the row Status button and Stats icon, `ContentControlsLine` and the `CompactSwitch` use here, and `PlayerKeyFigures`' `KeyFigureTile`s (replaced by `KeyFigures` counters). `PlayerStatusMenu` stays for the status banner's button if the Manage menu cannot be reused there; otherwise it is deleted in the same change.

## Documentation gaps
- `page-anatomy.md` row "Players list / Player page" ("Not reviewed") to "In progress" with these decisions.
- `frontend.md` paragraph on the Players list.
- `docs/roadmap.md` row for `141`.

## Test Plan
- **Unit/component:** title row (one filled button, no subtitle, no Season pill); counters Title Case and equal to their filters; toolbar (Section, search, two chips, Sort, Cards, List last, no count text); card kebab items and order for each status (active, unverified, suspended, rejected) with Reject and Suspend cautious, quick Verify only on unverified; row kebab and no chevron or Status or Stats buttons; the three-card grid and the dashed card only when a card exists; empty-state link only when nothing exists; address state restored (`focus`, `sort`, `view`, chips); `returnTo` on the open link; Player page header (Back alone, ONE Manage Player menu, no separate Status or Edit), the four compact counters, the banner's Change Status; `playerMenuItems.test.ts` for every status.
- **Stories:** the card in each status; table row; the Manage Player menu.
- **Not run:** Playwright; the 375 px check is done by the owner in the browser.

## Acceptance Criteria
1. The title row has one filled Add New Player button, no subtitle and no Season pill.
2. One flat toolbar with Section, search, Missing Date Of Birth, Show Inactive, Sort, Cards, List last; no "Showing N players" anywhere.
3. A player card and a table row each have exactly one kebab with the same items, and no footer bar, chevron, Status button or Stats icon; every status rule and confirmation is unchanged.
4. Never more than three cards in a row; the dashed Create card shows only when there is a card.
5. Back from a player restores Section, Missing Date Of Birth, Show Inactive, the quick filter, Sort and the view.
6. An empty list with no players offers "Add New Player"; a searched or filtered-out list does not.
7. The Player page has the shared header with ONE Manage Player menu (no Status and Edit pair), four compact counters without icons and flat info cards; the status banner still appears for an unverified or rejected player.
8. Existing player, status, link-request and stats behaviour is unchanged (their tests stay green apart from moved controls).

## Open questions (default if unanswered)
1. **Title-row label:** "Add New Player" (the standard) instead of "Add Player"? Default: **Add New Player**.
2. **Season pill:** none (the two season counters use the default season and there is no control today; the anatomy file said "confirm when we reach them")? Default: **none**.
3. **Status changes inside the kebab and the Manage menu** (instead of a separate Status button) with a quick **Verify Player** button on unverified cards? Default: **yes**.
4. **Stats:** reached from the kebab and the Manage menu as View Stats (no footer or row button)? Default: **yes**.
5. **Card rows without icons** (like Results Details), the games chips and badges kept? Default: **yes**.
6. **Player page:** avatar kept (56 px) beside the name in the shared header, figures as four compact counters? Default: **yes**.
7. **Player stats page and Player form:** separate follow-up specs (stats next, the form after)? Default: **yes, separate**.
8. **Dashed Add New Player card** in Cards view (counts toward the three)? Default: **yes**.

## Later changes (owner, 2026-11-04, while reviewing in the browser)
- **Compact buttons:** Call, Email and Change Status are the shared compact `Button`; the Average | Runs switch is no longer full width. The rule is now written in `page-anatomy.md` section 5, `design-system.md` and `CLAUDE.md`.
- **Player page:** View Stats is its own outlined button beside Manage Player (as Share is on a result; the menu keeps its item); three columns from `lg` (Basic Info over Account, Contact Info, Cricket); sections are the plain sub-header line, not pills; Cricket chips read Batting, Bowling, Wicketkeeper.
- **Player form (in scope now):** the shared edit-page skeleton: compact card, the shared tab row, footer Cancel, Save Changes (Add Player on a new one), then Deactivate or Reactivate; the page is titled Add New Player; Save and Cancel return through `returnTo`.
- **Player stats page (in scope now):** the shared header (name and the status badge beside it, Back honouring `returnTo`), the shared tab row (`ViewTabsRow replace`, Overview, Batting, Bowling, Fielding, Awards & record, Matches), ONE flat `ToolbarCard` with the filters, compact counters in place of the icon tiles (`StatTile` now draws the compact counter), flat info cards and matches table, Title Case buttons (View As Table, Hide Batting, Show More, Try Again, Clear Filters as an empty-state link, Open Results).

- **Quick actions on the card and row (owner, 2026-11-04):** View Stats is used often, so it stays a button on the card (foot row, outlined, with a filled Verify Player before it on an unverified player) and a quiet text button on the table row (an icon on a phone), as well as an item in the kebab. This is the one allowed footer-row exception in page-anatomy section 0 item 5.
- **Match page (owner, 2026-11-04, outside the Players pages):** Get Directions is one of the header's inline links beside Scoring and Watch Live, not a row under the figures. The Result and Review cards are flat, not raised.
- **Leaderboards Awards (owner, 2026-11-04):** brought to the one-toolbar layout of spec 140 (minimums, Reset To Default and Choose Categories in the toolbar, no heading or count text, compact buttons).

## Rollout Notes
Frontend only; no migration. Update `page-anatomy.md`, `frontend.md` and `roadmap.md` in the same PR.
