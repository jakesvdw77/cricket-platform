# 142: Teams revamp (list, cards, table, Team page, Team form, Team stats)

**Status:** DRAFT 2026-11-05, waiting for the owner's answers to the open questions (defaults listed; "Yes to all" accepts them). The owner asked for the Teams revamp after Players (`141`), covering EVERY page reached from Teams, including the stats. Written from `docs/standards/page-anatomy.md` (binding, including section 0, the build checklist) and `141` as the worked example, checked against the code: `pages/manage/teams/TeamsPage.tsx` (the list, used by `TeamList` and `TeamDirectory`), `TeamDetailPage.tsx`, `TeamFormPage.tsx`, `teamStats/*`, `components/TeamCard`, `components/TeamTable`.
**Depends on:** `036`, `060`, `092` (teams gold standard), `116` (team stats), `117` (dashboard), `127` (`returnTo`), `136` to `141` (pattern and shared pieces).

## Problem & Goals
The four pages predate the page standard and carry exactly the defects found on Players:
- **List (`TeamsPage`):** title "Teams — <breadcrumb>" with the Season pill and a small "Add Team"; counters (Teams, Players, Matches this week, No captain, Empty squads) are fine; the floating `FilterBar`, a separate `ContentControlsLine` with count text, a `SortLink`, switches; `TeamCard` has an icon-over-caption footer (Squad, Matches, Edit, Stats) and icon tiles; `TeamTable` has a Stats icon button and a chevron.
- **Team page:** a bespoke band with Back, the Season pill and a filled Edit Team (not a Manage menu), four icon `KeyFigureTile`s, a Statistics card whose only content is a button, raised Contacts, Sponsors and Squad cards, raw MUI buttons.
- **Team form:** a Cancel built from a raw MUI button, "Save changes" and "Create team" sentence case, the old MUI `Tabs` (Details, Contacts, Sponsors, Squad).
- **Team stats:** the old band header, a basis block of text lines above the figures, icon `StatTile`s, the filter bar before the figures, raw outlined buttons (Try again, Clear filters, Go to Results).

**Goals:** apply the standard (section 0 checklist) to all four pages without losing any function, and apply every lesson from `141` up front, so the owner's browser review finds none of them again.

## Non-goals
No change to team rules, squads, contacts, sponsors, statistics or the data model; no backend, migration or `openapi.yaml` change. **Team Manager** (its own full spec, backlog) and the **choosing available players** process stay out. The League page's Teams tab (`LeagueTeamsView`) keeps its own layout; only its links into the team page change if the destination changes.

## Lessons from Players applied (the checklist the build must pass)
1. **Order:** title row, figure cards, tabs (where a page has them), ONE flat toolbar fused with the data. Nothing between the title and its figures; an explanatory sentence (the stats basis) is the first figure's info icon.
2. **ONE filled button on the title row** ("Add New Team"/"Manage Team"), at most one outlined button beside it (View Stats), status badge beside the name, plain-text sub-header (sections as a path, never pills).
3. **Compact buttons only** (`Button size="compact"`), `CompactToggleGroup` for switches, no `fullWidth` on a desktop, no hand-set heights; Cancel is the shared compact secondary button.
4. **Flat everywhere:** cards, info cards, tables and chart cards flat with a hairline; counters are the one raised element.
5. **One kebab per card and row**, built once (`teamMenuItems`) so card, row and page cannot drift; **the frequently used action stays visible** (View Stats on the card as an outlined button at the foot row, a quiet text button on the row, as on Players), also in the kebab.
6. **Wide screens:** the Team page is three columns from `lg` so nothing needs scrolling on a large display.
7. **No count text, no icon tiles, no chevron, no footer bar**; Title Case labels; the owner's wording for the record.
8. **Back restores the view** (filters, sort, quick filter, view in the address; Save, Cancel and every outgoing link carry `returnTo`, including the stats page's Back).
9. **Tests with the build:** component tests for the new menu, a figures function with a test, the guard test stays green; stories for new components; the old tests rewritten in the same PR.

## What differs today (and the change)
| Area | Today | Change |
|---|---|---|
| List title row | "Teams" or "Teams — <breadcrumb>", Season pill, small Add Team | "Teams" with the Season pill, the section scope as a plain sub-header path, ONE filled **Add New Team** (the owner's Players wording; open question 1) |
| List counters | Teams, Players, Matches this week, No captain, Empty squads, quick filters | Kept, Title Case, compact |
| List toolbar | Floating `FilterBar`, `ContentControlsLine` with count text, `SortLink`, switches | ONE flat `ToolbarCard`: Section (club scope), search, toggle chips, **Sort** (`ToolbarSortButton`), Cards, List last; fused into the table; sort, quick filter and view in the address |
| Team card | Footer of Squad, Matches, Edit, Stats; icon tiles for Players and Matches | Flat card, no footer bar, ONE kebab (Open Team, Edit Team, View Stats, View Squad, View Matches), icon-less figures, a foot row with an outlined **View Stats** button; dashed **Add New Team** card (counts toward three) |
| Team table | Stats icon button and chevron | Quiet **View Stats** text button (an icon on a phone), the kebab, no chevron; whole row opens the team |
| Team page header | Back, Season pill, filled Edit Team, chips | `ManageScreenHeader`: Back alone, logo and name, ONE status badge, sub-header the section path, the Season pill beside the title, ONE filled **Manage Team** menu (Edit Team, View Stats, View Squad, View Matches) plus an outlined **View Stats** beside it |
| Team page figures | Four `KeyFigureTile`s with icons | Four compact `PageCounters`, no icons |
| Team page cards | Statistics card (a button), raised Contacts, Sponsors, Squad | Statistics card removed (the View Stats button replaces it); flat Contacts, Sponsors, Squad; three columns from `lg`; Call, Email, edit buttons compact |
| Team form | Raw Cancel, sentence-case Save, old tabs | Shared edit footer: Cancel, Save Changes (Add Team on a new one), Deactivate or Reactivate; shared tab row (`viewTabsSx`); compact `RecordFormScreen`; Save and Cancel through `returnTo` |
| Team stats header and order | Band header, basis lines, icon tiles, filters first | `ManageScreenHeader` with the status badge, ONE figure row (Played, Won, Lost, Win %) with the basis sentence as the first card's info icon, then the toolbar, then the form strip, Dashboard and cards; Won and Lost keep their success and error tones |
| Team stats buttons | Raw outlined MUI buttons | Compact shared `Button`s; "Clear Filters" and "Open Results" as empty-state links; Title Case |

## UI Requirements
Everything follows `page-anatomy.md`; `141` is the worked example. Specific to Teams:
- **Scope:** `TeamList` (one section) and `TeamDirectory` (the club) stay two routes over the one `TeamsPage`; the section scope is the sub-header path.
- **Team page:** the Season pill has no "All" (as today); changing it keeps its place in the address.
- **Team stats:** no tabs (one page), so the order is title, figures, toolbar, then the content blocks; the Dashboard block and the six cards stay, flat; the form strip stays.
- **Return navigation:** every link out carries `returnTo` with the label "Teams"; the team page's Back, the form's Save and Cancel and the stats page's Back honour it.

### Labels (Title Case)
Teams, Add New Team, Open Team, Edit Team, View Stats, View Squad, View Matches, Manage Team, Save Changes, Add Team, Cancel, Clear Filters, Open Results, Try Again.

### Components and files
Reuse `ManageScreenHeader`, `HeaderActions`, `ManageMenu`, `ToolbarCard`, `ToolbarSortButton`, `ToolbarToggleChip`, `ListViewToggle`, `EmptyStateLink`, `AddCard`, `dynamicCardGridSx`, `PageCounters`, `InfoCard flat`, `ViewTabsRow` or `viewTabsSx`, `useReturnTo`. New: `utils/teamMenuItems.tsx` (pure, ordered items), `components/TeamActionsMenu` (kebab and Manage Team button, like `PlayerActionsMenu`), `pages/manage/teamStats/teamStatsFigures.ts`. Retire the `TeamCard` footer, the `TeamTable` chevron and icon button, `ContentControlsLine` and `SortLink` here.

## Documentation gaps
`page-anatomy.md` row "Teams list / Team page" and the Team stats row; `frontend.md` paragraph; `docs/roadmap.md` row `142`.

## Test Plan
- **Unit/component:** list (title row, one filled button, no count text, toolbar order, Sort and Cards, List last, address state); card (kebab items, quick View Stats, dashed card only with a card, three per row); table (quiet View Stats, no chevron, kebab); `teamMenuItems`; `TeamActionsMenu` (kebab and button, `returnTo` on every link); Team page (header, one Manage menu, View Stats button, four compact counters, three-column grid classes, flat cards); Team form (footer, tabs, `returnTo` after save); Team stats (order: figures, toolbar, content; basis as an info icon; compact buttons; tones).
- **Stories:** `TeamActionsMenu` (both triggers), the card.
- **Not run:** Playwright; the 375 px check is the owner's.

## Acceptance Criteria
1. The list follows the checklist: one filled Add New Team, no count text, ONE flat toolbar with Sort and Cards | List last, flat cards and rows with ONE kebab and a visible View Stats, no footer bar or chevron, at most three cards a row.
2. The Team page has the shared header with ONE Manage Team menu and View Stats beside it, four compact counters, flat cards, three columns from `lg`.
3. The Team form has Cancel, Save Changes, Deactivate or Reactivate with compact buttons, the shared tab row, and returns through `returnTo`.
4. The Team stats page is ordered title, figures, toolbar, content; the basis sentence is an info icon; no icon tiles; compact Title Case buttons.
5. Back from any of them restores the view the user came from.
6. Existing team, squad, contact, sponsor and statistics behaviour is unchanged (tests stay green apart from moved controls).

## Open questions (default if unanswered)
1. **Title-button label:** "Add New Team" (your Players wording) or "Create New Team" (the standard)? Default: **Add New Team**.
2. **Team page Statistics card:** remove it (View Stats beside Manage Team replaces it)? Default: **remove**.
3. **View Stats on the card and rows** as on Players (outlined foot-row button on the card, quiet text button on the row, also in the kebab)? Default: **yes**.
4. **Kebab items:** Open Team, Edit Team, View Stats, View Squad, View Matches (the card's old footer destinations)? Default: **yes**.
5. **Team stats:** figures first (Played, Won, Lost, Win %) with the basis as an info icon, then the toolbar? Default: **yes**.
6. **Team form:** keep the four tabs (Details, Contacts, Sponsors, Squad) on the shared tab row? Default: **yes**.
7. **Dashed Add New Team card** in Cards view (counts toward the three)? Default: **yes**.
8. **One PR** for all four pages (as Players)? Default: **yes**.

## Rollout Notes
Frontend only; no migration. Update `page-anatomy.md`, `frontend.md` and `roadmap.md` in the same PR.
