# 138: Results list revamp (list, cards, table)

**Status:** approved 2026-11-05 on the defaults of the open questions; the owner's one answer: the capture wizard is done as ONE follow-up spec (question 7). The owner asked for the Results page next after Team Selection (`137`). Written from `docs/standards/page-anatomy.md` (binding, including every decision taken while building `136` and `137`: Create New labels, empty-state links, record names as links, Back restores the view, three cards per row, opaque surfaces, one kebab per row and card) with `137` and `130` as worked examples, then checked against the current code under `ui/src/pages/manage/results`. Built 2026-11-05, then extended by the owner's browser review (see Later changes).
**Depends on:** `100` (match results core, the list), `104` (import), `114` (share result), `118` (result review fixes), `127` (`returnTo`), `130` (the Matches list pattern), `136`, `137` (pattern and shared pieces).

## Problem & Goals
The Results list predates the page standard. The title row has three actions (Leaderboards, Import result, Capture result); a subtitle and a content line both say "Showing ..."; the filter bar is the older floating one with the sort as a quiet link and the Cards | List toggle on a separate content line; each card ends in a footer bar of four buttons (View, Edit, Publish, Share) and the table rows have a chevron; the card grid is the old 380 px auto-fill grid; labels are sentence case ("Capture result", "Tied / no result").

**Goals**
- Apply the standard without losing any function: one filled title-row button, compact counters kept as quick filters, one flat toolbar (fused into the table in List view, a standalone card above the cards), Sort in the toolbar, one kebab per row and card, the three-card grid, Title Case, Create New labels, an empty-state link, names as links with `returnTo`.
- Keep what the cards say (both teams and scores, the result line coloured from the club side, the toss, Player of the match, the Draft or Published badge) and every rule (Edit only while a draft, Share only when published, Publish validation).

## Non-goals
No change to result rules, publishing, sharing, import or the data model, and no backend, migration or `openapi.yaml` change. The **capture wizard** (`ResultCapturePage` and its steps) is a separate review: only the small items listed under Later changes were done here. (The result page was brought into this spec by the owner during review, see Later changes.)

## User Stories
- As a manager, I open Results and see the same skeleton as Matches and Seasons: a title, one Capture New Result button, counters, one toolbar, flat cards or a flat table.
- As a manager, I act on a result from one kebab (open, edit, publish, share) and the card or row itself opens the result.
- As a manager, I click a team name and reach that team, and Back returns me to Results with the same filters.

## Data Model Changes
None.

## API Contract
No change.

## What differs today (and the change)
| Area | Today | Change |
|---|---|---|
| Title row | Season pill; three buttons: Leaderboards, Import result, Capture result; subtitle "Showing: ..." | Season pill kept; ONE filled **Capture New Result** (opens the existing capture picker, which already offers Import); no subtitle |
| Counters | Compact counters as quick filters (Played, Won, Lost, Tied / no result, Drafts) | Kept, Title Case: Played, Won, Lost, Tied / No Result, Drafts |
| Toolbar | Floating `FilterBar` plus Outcome and Status selects, a separate content line with "Showing N results", the sort link and the Cards | List toggle | One flat `ToolbarCard`: League, Section, Team, Outcome, Status, search, **Sort** (`ToolbarSortButton`: Latest First / Oldest First), Cards | List last; no count text; fused into the table card in List view |
| Cards | `RecordCard` with a footer of View, Edit, Publish, Share; a caption "unpublish to edit" under a published card | Flat card, no footer bar, ONE kebab (Open Result, Edit Result, Publish Result on a draft, Share Result last); the "unpublish to edit" sentence becomes the disabled Edit Result item's reason; a quick **Publish Result** button on a draft card |
| Table | Chevron column | Flat table, whole row opens the result, last cell is the row kebab, no chevron |
| Card grid | Auto-fill, 380 px minimum | `dynamicCardGridSx`: never more than three cards in a row; the dashed **Capture New Result** card counts as one and is shown only when there is at least one card |
| Names | Plain text | Team names are links to the team page with `returnTo` (label "Results"); the card or row opens the result |
| Empty states | Text, with Import and Capture buttons when nothing exists | Icon kept; one text link "Capture New Result" when nothing exists; none for a filtered-out result |
| State on return | Filters saved per club; the quick filter and view are local | Filters and the quick filter in the address (`?focus=`), Sort in the address; Back from a result restores them |
| Labels | "Capture result", "Import result", "Tied / no result", "latest first" | Title Case everywhere (see Labels) |

## UI Requirements
Everything follows `page-anatomy.md`; only the decisions specific to this page are listed.

### Title row
"Results" with the Season pill beside it (kept, with its "All" choice as today). The one filled button is **Capture New Result**; it opens the existing `CaptureResultDialog` (pick a match to capture, or choose Import). Leaderboards and a separate Import button leave the title row.

### Counters and toolbar
`PageCounters density="compact"` stays directly under the title row (five quick filters, each equal to its filter). Then one flat toolbar card (the standalone `ToolbarCard` over Cards, fused into the table in List view): the shared League, Section and Team filters, the two extra selects (Outcome, Status), search with suggestions, then Sort and Cards | List last. On a phone: Filters and search on the row, the rest (including the quick-filter chip row, Sort and the toggle) in the sheet.

### Cards view (`ResultCard`)
A flat `RecordCard`: the brand result icon, the two teams with logos and a score line each, the result line coloured from the club side, the Draft or Published badge, the "Played" strip, Toss and Player of the match lines, the field. ONE dense kebab in the corner: Open Result, Edit Result (disabled with "Unpublish the result to edit it" once published), Publish Result (draft only), Share Result last (published only). A draft card also has a quick Publish Result button, as a ready side has Announce Team in Team Selection. The field is part of the sub-title (under the league and season), without a directions button (the match is played). Team names are links.

### List view (`ResultTable`)
Date, Match, Result, Scores, Field, Status, then the kebab. Flat card, tinted header, zebra rows, no chevron; the whole row opens the result; the kebab holds the same items as the card.

### Return navigation and state
Every leaving link carries `returnTo` with the label "Results"; the result page already honours it. Filters, the quick filter and Sort live in the address so Back restores the same view.

### Labels (Title Case; body text sentence case)
Results, Capture New Result, Open Result, Edit Result, Publish Result, Share Result, Played, Won, Lost, Tied / No Result, Drafts, Latest First, Oldest First, All Outcomes, All Statuses.

### Components and files
Reuse `ToolbarCard`, `ToolbarSortButton`, `ListViewToggle`, `ManageMenu` (kebab), `EmptyStateLink`, `AddCard`, `dynamicCardGridSx`, `CardVenueLine`, `useUrlFlag` style address state. One pure function, `resultMenuItems`, builds the ordered kebab items for the card and the table row (like `sideMenuItems`), so they cannot drift; two new shared pieces came out of the review: `HeaderShareButton` with `HeaderActions`, and `SplitButton`. Retire the footer buttons, the chevron, `ContentControlsLine` and `SortLink` use here.

## Documentation gaps
- `page-anatomy.md` row "Results list" (currently "Not reviewed, three top-row actions") to "In progress" with these decisions.
- `frontend.md` paragraph on the Results list.
- `docs/roadmap.md` row for `138`.

## Test Plan
- **Unit/component:** title row (one filled button, no subtitle, Season pill); counters Title Case and equal to their filters; toolbar (Sort and Cards | List last, no count text); card kebab items and order, Edit disabled with its reason once published, Publish only on a draft with the quick button, Share last and published only; table row kebab, no chevron, whole row link; the three-card grid and the dashed card only when a card exists; empty-state link; team names carry `returnTo`; address state restored (`focus`, `sort`).
- **Stories:** the card in each status; `HeaderShareButton`, `SplitButton`. The kebab states are covered by `resultMenuItems.test.tsx`.
- **Not run:** Playwright; the 375 px check is done by the owner in the browser.

## Acceptance Criteria
1. The title row has one filled Capture New Result button and no subtitle; Leaderboards and Import are not on it (Import stays reachable in the capture picker).
2. One flat toolbar with the shared filters, Outcome, Status, search, Sort and Cards | List last; no "Showing N results" anywhere.
3. A result card and a table row each have exactly one kebab; no footer bar and no chevron; the rules (Edit while a draft, Share when published, Publish on a draft) are unchanged.
4. Never more than three cards in a row; the dashed Create card shows only when there is a card.
5. Team names are links with `returnTo`; Back from a result restores the filters, quick filter and sort.
6. An empty list with nothing recorded offers "Capture New Result"; a filtered-out list does not.
7. Existing publishing, sharing, import and capture behaviour is unchanged (their tests stay green).
8. Later changes (acceptance): the title-row split button offers Import Result; the result page has ONE Manage Result menu, Share beside it only when published, three compact counters (Result, two scores), Details without icons, ONE Scorecard card and team cards that start closed and are headed "First Innings - <Team>"; the name toggle is Full name | Initials and locks every share to initials while on it; Share sits beside the Manage menu on the League, Match, open poll and announced Select Team pages, and Announce Team replaces it on a complete, not yet announced side; the Teams step hides the planned batting position behind a switch; Review has two cards; the Import page has no Cancel.

## Open questions (default if unanswered)
1. **Title-row label:** "Capture New Result" (the standard) opening the existing picker, or keep "Capture Result"? Default: **Capture New Result**.
2. **Leaderboards button:** drop it from the title row (the manager menu already has Leaderboards)? Default: **drop**.
3. **Import Result:** only inside the capture picker (as today it is also offered there)? Default: **picker only**.
4. **Quick Publish Result button** on a draft card, besides the kebab item? Default: **yes**.
5. **Dashed Create card** in Cards view? Default: **yes** (counts toward the three).
6. **Field in the sub-title without directions** (the match is played)? Default: **yes**.
7. **Result page and capture wizard:** follow-up specs. Owner answer 2026-11-05: the **capture wizard (all its steps) is ONE spec**; the result page (`ResultDetailPage`) is its own later spec. Neither is part of `138`.

## Later changes (owner, 2026-11-05, while reviewing in the browser)
- **Title row:** the one button is a split button: Capture New Result, and Import Result in its caret menu (the label is "Capture", not "Create", because a result is captured).
- **Result page** (reviewed in the same pass, so its own spec is no longer needed for this): the shared detail header with ONE Manage Result menu and a Share button beside it when published; the Imported badge above the buttons; three compact counters (Result sentence, then the two scores); Details without icons, bold warning labels for what is not recorded; ONE Scorecard card (toss, innings table, name toggle) and a collapsible card per team, closed by default, "First Innings - <Team>".
- **Names:** the Full name | First name toggle becomes Full name | Initials ("J. Smith"), shared with every export; sharing is locked to initials while it is on. Spec `101`'s First name rules are superseded.
- **Share beside the Manage menu** on the League, Match, Availability poll (open) and Select Team (announced) pages; Select Team shows Announce Team there while a complete side is not yet announced.
- **Capture wizard bits done on the way:** the Teams step's planned batting position is a switch-controlled column, not text under the name; its controls row is a light band with the name toggle last; Review has two cards (Scorecard, Checks) and aligned labels; the Import page has no Cancel; the Capture and Add Player dialogs are larger.
- Capture wizard (all steps) remains ONE later spec.

## Rollout Notes
Frontend only; no migration. Update `page-anatomy.md`, `frontend.md` and `roadmap.md` in the same PR.
