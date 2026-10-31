# 130: Matches pages revamp (list, match page, match form)

**Status:** draft, derived from the standards only, with `129` as the worked example. Sources: `docs/standards/page-anatomy.md` (binding, including section 6b), `design-system.md`, `frontend.md`, `CLAUDE.md`, specs 075, 087, 089, 109, 126, 127, 129. Not approved; no build before approval.
**Depends on:** `129-seasons-pages-revamp.md` (pattern), `126` (Manage menu), `127` (`returnTo`), `089` (the current match page and list), `109` (delete an empty match), `087` (counters and quick filters), `076` (Select Team page).

## Problem & Goals
The Matches pages predate the page standard. The match page has Back on the same row as Capture Result, a filled Edit and a loose kebab; a bare title row; four raised icon tiles (one holding a lone Open Availability button); and a raised, half-width team card with its own buttons. The list has a floating filter bar, a "Showing N matches" line, a raised table with a chevron and a Delete icon column, and raised cards with a footer bar.

**Goals**
- The Matches list works like the Leagues and Seasons lists: fused toolbar, one kebab per row and card, flat cards on the dynamic grid with a dashed Add Match card, no chevron, no count text.
- The match page works like the season page: Back alone, title row with badges and ONE filled Manage Match menu, static compact figure cards, flat panels.
- The match form is a compact flat card with the standard footer.
- Every existing action stays reachable; nothing is dropped.

## Non-goals
- **No backend change, no migration, no endpoint change** (UI only). Match, sides, polls, summary and filter-options calls are as they are.
- **No change to what the actions do:** Capture, Continue, View and Import Result, Select Team (spec 076), Open Availability (poll destination logic), Share Team Sheet (dialog), Share Result, Edit, Deactivate, Delete (109's rules) keep their behaviour, guards and disabled reasons.
- **No change to filters, quick filters, paging or the default "upcoming only" rule** (087, 042, 037); only their layout moves.
- **No change to `MatchForm` fields or validation**, the league-date message, or the saved payload.
- **No new Share content for matches** beyond the existing team sheet and result share.
- **No Season pill redesign:** the existing header Season pill stays beside the list title as `HeaderSeasonSelect` does today.
- **No change to the teamSelection `MatchesView`, player-stats match lists, results list or result import** (other pages keep their "Not reviewed" rows).
- **No change to `PageCounters`, `ManageMenu`, `ToolbarCard`, `FilterBar`, `AddCard`, `RecordCard` internals**; no breadcrumbs.

## User Stories
- As a club admin, I use the Matches list like the Leagues and Seasons lists, with one Actions button per match.
- As a club admin, on a match page I see Back alone at the top, the title, its badges and one "Manage Match" menu holding everything I can do with the match.
- As a club admin, I see when, where, league and poll state as four compact figures, and each team's Playing XI in a flat panel.
- As a club admin, Back, Cancel and Save return me to where I opened the match from.

## Data Model Changes
None.

## API Contract
No new or changed endpoints; no `openapi.yaml` change.

## UI Requirements

### Matches list (`MatchList`, `matches/MatchTable`, `matches/MatchCard`)
- **Header:** `ManageScreenHeader` page name "Matches", the Season pill beside it (as now), the one filled compact **Add Match** right-aligned on the title row. The "Showing: scope" subtitle goes. 16 px between bands (12 px phone; the 24 px gap goes).
- **Counters:** `PageCounters density="compact"` unchanged in meaning (Upcoming or Shown, This Week, Teams Not Announced, Without A Poll; quick filters, mutually exclusive, warning tone above zero). Labels Title Case.
- **Toolbar:** one `FilterBar` (`bare inCard viewControlsInline`): search, League, Section, Team, Field, then on the right the **View Entire Season** (or "View All Seasons") toggle chip, **Sort** (`ToolbarSortButton`: "Soonest First", "Latest First"), and **Cards | List** last. List view: toolbar is the top of the table card; Cards view: a standalone `ToolbarCard` above the grid and the empty message. No `ContentControlsLine`, no `SortLink`, no "Showing N" text.
- **List view:** flat card (hairline, no shadow), tinted header, first data row white and second tinted, no chevron column, no Delete icon column; kebab at the row's right end; whole row opens the match.
- **Cards view:** `RecordCard flat`, footer bar removed (`footerActions={null}`), one kebab top right replacing the Scoring, Watch and Delete icons (Scoring and Watch Live become kebab items); `dynamicCardGridSx`; dashed "Add Match" card at the end (`cardGridSx` goes).
- **Kebab** (`pages/manage/matches/MatchRowMenu.tsx`, after `LeagueRowMenu`, "Actions for {home} v {away}", dense): **Open Match**, **Edit Match**, **Select Team**, **Open Availability**, the result action when offered (**View Result**, **Continue Result** or **Capture Result**), **Import Result** when offered, **Scoring** and **Watch Live** when the match has the link, **Share Team Sheet** last. Items that cannot apply say why in one small line (no own team, polls not ready). Deactivate, Reactivate and Delete are not in the kebab (6b; they stay on the edit page, 109).
- **Empty states:** no action button in the message (Add Match and the Add card are visible); `BrandIcon` for Matches.
- **Pagination** stays (Previous, Next) inside the content band.
- **Return navigation:** Add Match, row, card and every kebab destination carry `withReturnTo(..., currentOrigin(location), 'Matches')`.

### Match page (`MatchDetailPage`, `matchDetail/*`)
Skeleton top to bottom, 16 px between bands (12 px phone). `PageHeaderBand` goes; the header is built inline like the season page.
1. **Top row:** Back alone, quiet ("Back to Matches", or "Back to {label}" with `returnTo`, `useBackLink`). Capture Result, Edit and the More kebab leave this row.
2. **Title row:** team logos and "{Home} vs {Away}" as the record name (display face, 32 px, 26 px phone, weight 700, own capitals), then badges inline (Inactive, result badge); then ONE filled **Manage Match** `ManageMenu` right-aligned at `MANAGE_BUTTON_WIDTH` (full width on a phone). The Season pill sits beside the title (a season-scoped page), showing the match's season label. Scoring and Watch Live are inline link items directly under the title (icon then text), not buttons, on every width.
3. **Figures:** static compact `PageCounters` (no icons, no pointer): **Starts** (date, text value, with the countdown or "Played"/"Awaiting Result" kept as the card's caption text, warning tone within 24 hours), **Venue** (or Field, the existing field-verification note; links to the field page as it does now, which makes that one card clickable), **League** (or "Friendly", with season), **Poll** (Open, Closed, None, the close time). The `KeyFigureTile` strip goes. The lone **Open Availability** button leaves the Poll card and becomes a Manage Match item.
4. **Team panels:** one per own team, **flat with a hairline** (no shadow), side by side from `md`, equal height, filling the width (a single own team is also full width, not half). Inside the panel: the compact heading (team name, side, Announced chip), the selection gauge and the Playing XI rows as now. **Select Team** and **Share Team Sheet** become text-only outlined buttons inside the panel's header row on the right (Share carries the share icon, Select none, per the icon rule), so no button row at the foot of the card. The panel title keeps `cardTitleSx` (6b).
5. The text "None of your teams is playing..." stays as the panel band's empty message.

**Manage Match** (`groups`, one group "Match"; Share last): **Edit Match** (first), **View/Continue/Capture Result**, **Import Result** (when offered), **Select Team** (one item per own side when both are ours, "Select Team: {name}"), **Open Availability** (disabled with its reason when no own team or polls not ready), **Share Result** when the match has a published result and sharing exists today, **Share Team Sheet** (per own side when two). Deactivate, Reactivate and Delete are not in this menu (6b: they live on the edit page; Delete keeps 109's rule there). The confirm dialogs for them move with them.

**Return navigation:** every link that leaves the page carries the page as origin, label "{Home} v {Away}" kept within 60 characters; the page never copies its own `returnTo` forward. Delete (on the form) still returns through `useAfterSave`.

### Match form (`MatchFormPage`, `MatchForm`)
- `RecordFormScreen compact`, title "Add Match" or "Edit Match", Back "Back to Matches" by default or "Back to {label}" with a valid `returnTo`. The Season pill is right-aligned on the title row where the match's content depends on the season (the existing season field stays a form field).
- **Header action:** the loose "Select Team" button leaves the title row (it is in Manage Match on the page).
- **Card:** one flat card, hairline, compact headings, 36 px fields (`compactFieldSx`), three columns from `md`, two at `sm`, one on a phone; fields, validation and payload unchanged.
- **Footer (one band, one filled button):** Cancel (white), **Save Changes** (**Create Match** on add), then on edit **Deactivate** or **Reactivate** (shared `RecordStatusToggle` styling) and **Delete** (outlined, error colour, disabled with its reason per 109). Title Case labels ("Save changes" and "Create match" change).
- Back, Cancel, Save, Deactivate/Reactivate and Delete honour `returnTo` through `useAfterSave('/manage/fixtures/matches')`; without one the default Back of the edit page is the match page for an edit and the list for an add, as today.

### Components and files
- Changed: `MatchList.tsx`, `MatchDetailPage.tsx`, `MatchFormPage.tsx`, `matches/MatchTable.tsx`, `matches/MatchCard.tsx`, `matchDetail/MatchKeyFigures.tsx`, `matchDetail/MatchTeamCard.tsx`, `MatchForm` (layout only).
- New: `matches/MatchRowMenu.tsx`; the match page's Manage Match groups builder.
- Reused unchanged: `PageCounters`, `FilterBar`, `ToolbarCard`, `ToolbarSortButton`, `ToolbarToggleChip`, `ListViewToggle`, `ManageMenu`, `AddCard`, `dynamicCardGridSx`, `RecordCard flat`, `SelectionGauge`, `PlayingXiSummary`, `RecordFormScreen`, `RecordStatusToggle`, `useDeleteMatchDialog`, `useTeamSheetShare`, `useAvailabilityNavigation`, `utils/returnTo`, `hooks/useReturnTo`.
- Removed from these pages: `PageHeaderBand` use, `MatchHeaderActions` (its Result menu, filled Edit, More kebab and Deactivate dialog), `KeyFigureTile` strip, table chevron and Delete column, card footer bar and icon cluster, `ContentControlsLine`/`SortLink`, raised team card.

## Test Plan
Tiers per `docs/standards/testing.md`; UI only (no backend or contract tier). Per the owner's standing rule, tests are written after the owner's browser check; the plan is fixed here.
- **List:** counters still filter, no FILTER tag; toolbar fused in List and standalone in Cards; order toggle chip, Sort, Cards | List last; no "Showing" text in any state; no chevron, no Delete column; kebab "Actions for ..." with the listed items, disabled reasons, never navigates the row; no card footer; dashed Add card; zebra parity; `returnTo` on every outgoing link.
- **Match page:** Back alone; no filled Edit or loose kebab outside Manage Match; one filled Manage Match at `MANAGE_BUTTON_WIDTH` with Edit first and Share last; title keeps capitals; badges inline; links under the title; four figures static (Venue card clickable only with a field), no lone button; team panels flat, full width, Select Team and Share Team Sheet inside their panel; every action reachable (result variants, import, availability disabled reason, per-side items); outgoing links carry `returnTo`.
- **Form:** one compact card; footer order and labels; Delete disabled with reason; Cancel, Save, Deactivate and Delete go to `returnTo` or the default; invalid `returnTo` ignored; payload unchanged.
- **Phone (375 px)** for all three; **Storybook** for `MatchRowMenu`, flat `MatchCard`, `MatchTable`, `MatchTeamCard`; existing tests updated, not weakened.

## Acceptance Criteria
1. The Matches list has no count text, a fused toolbar with the toggle chip, Sort, then Cards | List last, flat table and cards, no chevron, one kebab per row and card, a dashed Add Match card.
2. The match page top row holds Back alone; the title row holds the name, badges and ONE filled Manage Match menu; no separate Edit, Capture Result or kebab.
3. Figures are static compact cards without icons or a lone button; team panels are flat, full width, with their buttons inside.
4. Every previous action is reachable from Manage Match, the panels or the list kebab.
5. The form is one compact card with Cancel, Save Changes (Create Match), Deactivate or Reactivate and Delete.
6. `returnTo` is carried and honoured as `127` says; all labels Title Case, UK spelling, no em dashes.
7. No field, validation, endpoint, permission or backend change; checked at 375 px.

## Rollout Notes
UI only, one change, no flag. Order: (1) `MatchRowMenu`, `MatchTable`, `MatchCard`; (2) `MatchList`; (3) match page (header, Manage Match, figures, panels); (4) form. Then update `page-anatomy.md` section 9 (Matches list and Match page rows to "In progress"), the `design-system.md` paragraphs that describe the 089 header and tiles, and `docs/roadmap.md`. Copy the section 10 checklist into the PR.

## Documentation gaps
1. **Delete, Deactivate and Reactivate on the match page.** 6b puts them on the edit page, but the match page offers them today (More menu). Assumed removed from the page and kept on the form. Belongs in 6b (does a record's page ever hold them?).
2. **Season pill on the match form.** Section 1 says edit pages right-align the pill; the form's season is also a field. Assumed the pill is shown and the field stays. Belongs in section 1.
3. **Venue figure as a link.** Section 2 says static figures carry no pointer; the Venue figure links to the field page. Assumed it keeps the link. Belongs in section 2.
4. **Scoring and Watch Live.** No rule for external links on a detail page. Assumed inline items under the title, and kebab items in lists. Belongs in section 1 (contacts and links).
5. **Per-side items in Manage Match.** The standard has no rule for a menu item that applies to one of two sides. Assumed one item per own side, labelled with the team. Belongs in section 8.
6. **In-panel buttons.** 6b allows a text-only outlined button in an info card repeating a navigation; Select Team and Share Team Sheet are actions repeated from the menu. Assumed allowed. Belongs in section 5.
7. **Team panels versus info cards.** Not stated whether the Playing XI panel is "flat info card" or a record panel with its own heading style. Assumed flat with the existing heading. Belongs in section 4.
8. **Default Back of the match form** (match page versus list), as gap 13 of `129`.
