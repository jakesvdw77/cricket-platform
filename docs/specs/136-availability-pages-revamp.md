# 136: Availability pages revamp (hub, polls, new poll, responses)

**Status:** built 2026-11-03 on the defaults of the open questions (owner said go ahead); owner hand-check pending; tests updated 2026-11-04. Owner approved the New Group Poll and New Squad Poll mockup (`docs/mockups/availability-new-poll-mockup.html`) on 2026-11-04: both pages open on the matches with no poll, grouped by section or team, preselected for a one-section or one-team manager, "All Sections" / "All My Teams" otherwise. Also decided 2026-11-04: player names in the Players grid and its phone lists are links with returnTo, the player page's Back returns to the Players tab with the same filters and toggles (they live in the address: `useUrlFlag`), rules added to page-anatomy section 5; on the Players toolbar the slot navigator and Jump To Today sit at the right of the legend row above the grid (Jump To Today is a text link); the toolbar is one row; Group Polls and Squad Polls is one segmented toggle with small icons; empty states carry a quick-action Add button and an empty Cards view shows no dashed Add card (page-anatomy section 5). Written from `docs/standards/page-anatomy.md` (binding, including 6b, 7a, 7b and the 2026-11-01 defaults) with `129` and `130` as worked examples (built from the documents only), then checked against the current code under `ui/src/pages/manage/availability`, `AvailabilityPollsDashboard`, `NewPollPage`, the two poll Responses pages and specs 064 to 066, 068, 072 to 074, 082 to 087.
**Depends on:** `129`, `130` (pattern), `126` (Manage menu), `127` (`returnTo`), `064` (unified polls, `NewPollPage`), `065`, `067` (Responses pages), `066`, `082` (poll card, close time), `073` (hub), `083`, `084`, `085` (filters, counters, panels), `068`, `074` (Players grid, Match-day cover), `087`.

## Problem & Goals
The Availability pages predate the page standard. The hub header holds a segmented view switch and a hidden placeholder button; the Polls list has a floating filter bar plus a second "Showing N open polls" line, loose switches, a raised table with a chevron and no row actions, and cards with a four-button footer, a corner Delete and two inline pencils; the Responses pages carry four separate header buttons; "New poll" is a two-step page of radio cards, and its Group branch opens on a "Choose a section" empty state.

**Goals**
- Apply the standard (skeleton, fused toolbar, toggle chips, one kebab per row and card, no chevron, flat panels, Manage menu with Share last, compact counters, `ProgressMeter`, return navigation, Title Case, no em dashes) without losing any function.
- Keep the poll screens' character and behaviour (owner favourites, `064` to `066`): `PollCard` content, `SlotSummary`, the close-time strip with countdown, the Responses views and the override menu are unchanged in meaning and look.
- Resolve the owner's complaints explicitly: Group poll flow, the Squad or Group choice, labels, the "No open polls" empty state.

## Non-goals
- **No backend, migration or API change.** All calls (polls, rounds, fixture groups, summary, player grid, override) are as they are. (No gap forced one.)
- **No change to what a poll is:** one poll per match, autoclose rules, close-time validation, reopen rule, covered-by links, the public response pages, the 48-hour rule, the `Truncated` notice.
- **No Group poll model change** (matches still cannot be edited after creation, `064`); no reminders; no poll history beyond the 50 closed per kind.
- **No redesign of the Players grid, the coverage maths, `SlotSummary`, `ResponseGauge` or the status colours.**
- **No change to `PageCounters`, `FilterBar`, `ToolbarCard`, `ManageMenu`, `RecordCard`, `ProgressMeter`, `AddCard` internals**; no breadcrumbs.
- **No Season pill** (see Open questions 1); no season control (083's decision stands).
- **Other pages** (Team selection hub, Results) keep their review rows.

## User Stories
- As a club admin, I see Availability like the other lists: one title row, Create New Poll, four counters, tabs, a toolbar, flat polls.
- As a club admin, I use one Actions button per poll (row or card) holding everything I can do with it.
- As a club admin, I choose Squad Poll or Group Poll from a chooser and, for a group poll, land on a section's fixtures already scoped.
- As a club admin, on a poll's page I see Back alone, the title with its badges and one Manage Poll menu.
- As a club admin, Back, Cancel and Save return me to where I came from.

## Data Model Changes
None.

## API Contract
No new or changed endpoints; no `openapi.yaml` change.

## What differs today (and the change)
| Area | Today | Standard says | Change |
|---|---|---|---|
| Hub header | Title, segmented Polls / Players / Match-day cover switch in `middle`, "New poll", hidden placeholder, "Showing: scope" subtitle | One title row, one filled Add; tabs; no count or scope text | Title "Availability", filled **Create New Poll** right (all three views, no placeholder); view switch becomes a real tab row (links); subtitle goes |
| Tab actions | Jump to today sits in the header (Players) | Tab's own actions on the tab row | **Jump To Today** (outlined) right-aligned on the tab row, Players only, not on a phone as today |
| Counters | Sentence case labels, drill cards | Compact counter card, Title Case, pointer, ring when open | Labels: Open Polls (Polls Shown), Players Responded, Players Still To Answer, Close In 48 Hours; still open the side panels; ring while its panel is open |
| Polls toolbar | `FilterBar` plus a second line (`ContentControlsLine`) with "Showing N open polls", type and closed switches, text sort link | Toolbar fused in the table card or a toolbar card above cards; chips; Sort then Cards or List last; no count | One `FilterBar` (`bare inCard viewControlsInline`): search, League, Section, Team, chips **Group Polls**, **Squad Polls** (last one cannot be switched off), **Show Closed Polls**, **Sort: Soonest First**, Cards or List last. The "Group polls only" removable chip and the count line go |
| Poll list view | Raised table, odd-row tint, bespoke Answered bar, chevron, no row actions | Flat, tinted header, first row white, no chevron, kebab, `ProgressMeter` | Flat card; Answered uses `ProgressMeter` (text above, bar below); chevron column becomes the kebab column |
| Poll cards | Footer buttons (Close or Reopen, Matches, Responses, Share), corner Delete, pencil beside a group title, pencil in the time strip, custom grid | One kebab, no footer, flat, hover lift, dynamic grid, dashed Add card | `RecordCard flat`, `footerActions` none, one kebab top right; both pencils move into the kebab; `dynamicCardGridSx` and a dashed **Create New Poll** card (opens the chooser) |
| Empty states | "No open polls" with a New poll button | No button when Add is visible; section BrandIcon | See "Empty states" below |
| Players view | Bare toolbar, "Showing N players, M games", loose switches | Toolbar card, chips, no count | Toolbar card above the grid: search, League, Section, Team, chips **View Entire Season**, **Hide Players With No Answers**; count line goes |
| Match-day cover | Toolbar, "Showing N slots", switch, "Go to Polls" button in an empty state | Same | Toolbar card with the **View Entire Season** chip; count line and the empty-state button go (Create New Poll is visible); `dynamicCardGridSx` |
| Responses pages | Back, title, pencil, four header buttons (Share invite, Close or Reopen poll, Delete poll), meta row with badges and a close pencil, bare filter panel | One filled Manage menu, badges inline, flat toolbar | See "Responses pages" below |
| New poll | Radio cards and Continue, then a branch form | One Add with a chooser of large tiles | Chooser dialog on the list; page keeps the branch forms |
| Labels | "New poll", "Close poll", "Share invite", "Open poll for N selected fixtures", "Match-day cover", "Time slot" | Title Case | See "Labels" |

## UI Requirements

### Hub shell (`AvailabilityHubLayout`)
Top to bottom, 16 px between bands (12 px phone). No Back, no Season pill. **Title row:** "Availability" (page name) and the one filled compact **Create New Poll** right-aligned (full width on a phone). **Tab row (real navigation, `aria-current`):** Polls, Players, Match-Day Cover on the left; that tab's own action right-aligned (Jump To Today on Players). **Counters** belong to Polls and sit directly under the tab row inside the Polls tab (they describe that view only; see Open questions 2). The shared League, Section and Team filters, the saved defaults and the address mirroring (083) are unchanged. Create New Poll opens the chooser (below); where Create New Poll is shown no empty state repeats it.

### Polls tab (`AvailabilityPollsDashboard`, `PollTable`, `PollCard`)
- **Counters:** as table above, `kind: 'drill'`, zero is a plain card, tone warning above zero for the two that need attention, as `085`. No icons. Players Responded keeps "n / m" as its text value.
- **Toolbar:** as table above. List: it is the top of the table card, the empty message replaces the rows inside the card so the search keeps focus. Cards: a standalone `ToolbarCard` above the grid, holding the empty message. Tablet: chips fold into the Filters sheet before Sort and the toggle; phone: Filters and Search on one row, rest in the sheet (toggle first). View stays remembered (`pollList:view`); all else per visit.
- **List view:** columns Poll, Type, Status, Closes, Answered, then the kebab column; no chevron; whole row opens the poll's Responses page (stretched link keeps the accessible name); "-" for a missing value. Phone: Poll (type and status chips and closing time under the title), Answered, kebab.
- **Cards view:** content unchanged (avatar, title, type badge, Open or Closed, side badge, subtitle, close-time strip with countdown and amber tone, one `SlotSummary` per slot). Strip and title keep their meaning but have no pencil.
- **Kebab** (`pages/manage/availability/PollRowMenu.tsx`, after `LeagueRowMenu`; `ManageMenu trigger="kebab" dense`, "Actions for {poll title}", never navigates the row), in order: **Open Responses**; **Edit Close Time** (Reopen path when closed: item reads **Reopen Poll** and is disabled with the existing reason line, `REOPEN_PAST_REASON`); **Edit Description** (group only); **Matches Covered** (opens `PollMatchesDialog`); **Close Poll** (open polls); **Delete Poll** (error tone, confirm dialogs unchanged, `usePollDelete`); **Share Invite** last (disabled with `SHARE_CLOSED_REASON` when closed). Respond on behalf stays on the Responses page (override menu per player and slot), reached through Open Responses.
- **Empty states** (BrandIcon `nav/availability-polls`, no button): "No open polls" (Show Closed off, nothing in scope): "Nothing is collecting answers right now. Use Create New Poll to ask a team or a section about their matches, or turn on Show Closed Polls to review earlier ones." "No polls" (Show Closed on): same first sentence dropped, "No polls match this scope yet." "No matching polls": unchanged reasons (search, type, section, league, team).
- **Return navigation:** Create New Poll, row, card and every kebab destination use `withReturnTo(..., currentOrigin(location), 'Availability')`.

### Players and Match-Day Cover tabs
Toolbar cards as in the table; the legend stays directly above the grid; the grid, mark menu, truncated notices and `CoverageLegend` are unchanged. Cover cards use `dynamicCardGridSx`. The side panels (Open Polls and Closing, Responded and Still To Answer) are unchanged except Title Case and `ProgressMeter` for "N of M answered" where an x-of-y bar is drawn; rows still link to the Responses page with `returnTo`.

### Create New Poll chooser and New poll
- **Create New Poll opens a dialog with two large tiles** (one Add button with a chooser, section 8): **Squad Poll** ("Ask one team's squad about one or more of its matches. Each match gets its own link.") and **Group Poll** ("Ask a whole section about several fixtures. One link covers them all."). Clicking a tile goes straight to `/manage/availability/new?type=squad|group` (no radio, no Continue, no bullets). Cancel closes.
- `NewPollPage` keeps its two branches (shortcuts from the match page still pass `type`, `sectionId`, `matchId`). Without `type` it shows the same two tiles inline. Title "New Squad Poll" or "New Group Poll"; Back "Back to Availability" or the `returnTo` label; Cancel and Create go to the origin through `useAfterSave('/manage/availability')`. The ghost "Change poll type" becomes a white **Change Poll Type**.
- **Group Poll flow (owner complaint).** Today: a full-width Section field and a large "Choose a section" empty state, then stacked outlined cards, one per proposed group, each with its own description, Autoclose switch, close time, tick list and a button, with nothing saying that each card is its own poll. Change:
  1. The section is **preselected** from the hub's Section filter (passed as `sectionId`) or when the manager can see one section only; otherwise the field is blank.
  2. The Section select sits in a flat toolbar card (36 px, `SectionTreeSelect`) with a one-line hint beside it, "Each card below opens one poll with one link."; the big "Choose a section" empty state becomes a short hint line under the toolbar until a section is chosen.
  3. Fixture groups are headed "Upcoming Fixtures" and sorted soonest first, with groups that are fully covered last, collapsed to one line ("Every fixture here is already in a poll") with their covering links.
  4. Each group is a flat hairline card on a compact 36 px form: header (date range, plain "3 fixtures"), Description, Autoclose switch with its Closes At field, the fixture rows (Home v Away, day-part chip, date and time, league, `CoveredByNote`; covered rows greyed and unticked as now), and a footer with one filled button, **Create Poll For 3 Fixtures** (disabled with its reason when none ticked). The highlighted group (from `matchId`) scrolls into view as now.
  Behaviour, validation and payload are unchanged. See Open questions 3.
- **Squad Poll branch:** same compact treatment (flat toolbar card with Team, "Choose a team" hint line instead of an empty state, flat rows, **Create 2 Polls**); no behavioural change.

### Responses pages (`GroupPollResponsesPage`, `SquadPollResponsesPage`, `ResponsesPageShell`)
- **Top row:** Back alone ("Back to Availability", or "Back to {label}" with `returnTo` through `useBackLink`; the existing team-selection `returnTo` of `076` keeps working and its caller adds `returnLabel` "Team selection").
- **Title row:** the poll title (display face, own capitals), badges inline (Group Poll or Squad Poll, Open or Closed), then ONE filled **Manage Poll** menu at `MANAGE_BUTTON_WIDTH` (full width on a phone): **Edit Description** (group only, replaces the title pencil; the Edit item is first), **Edit Close Time** (**Reopen Poll** when closed, disabled with reason), **Close Poll**, **Matches Covered** (squad: where offered today), **Delete Poll**, **Share Invite** last (disabled with reason when closed). The loose Share, Close, Delete buttons and both pencils go.
- **Under the title:** inline items: section (group), close text with the live countdown (`Closes ...`), as today's meta row without chips.
- **Figures:** `ResponseGauge` stays as the page's figure element (its character is the owner's favourite) in a flat hairline panel on the right of that band; x-of-y bars elsewhere use `ProgressMeter`.
- **Toolbar:** a flat `ToolbarCard`: Time Slot | Player segmented control, search; no count text. The closed note and override error stay as inline messages. Slots, player lists, "via link" marker and the override menu are unchanged. All panels flat with the hairline.
- **Return navigation:** every link that leaves carries `returnTo` with the poll title (kept within 60 characters); Delete returns through `useAfterSave`.

### Labels (Title Case; body text and headings sentence case)
Create New Poll (was New poll), Squad Poll, Group Poll, Open Polls, Polls Shown, Players Responded, Players Still To Answer, Close In 48 Hours, Show Closed Polls, Soonest First, Latest First, Match-Day Cover, Time Slot, Player, Close Poll, Reopen Poll, Edit Close Time, Edit Description, Matches Covered, Share Invite, Delete Poll, Create Poll For N Fixtures, Create N Polls, Change Poll Type. **"Open" now means only a status or navigation (Open Polls, Open Responses); starting a poll is "Create"** (the old "Open poll for N fixtures" and "Open N polls" read as status).

### Components and files
- Changed: `AvailabilityHubLayout`, `AvailabilityPollsDashboard`, `PollTable`, `PollCard`, `AvailabilityFilterBar` (feeds `bare inCard`), `PlayerAvailabilityPage`, `AvailabilityCoveragePage`, `PollsPanel`, `PlayersPanel` (labels), `GroupPollBranch`, `FixtureGroupCard`, `SquadPollBranch`, `NewPollPage`, both Responses pages, `ResponsesPageShell`, `EditCloseTimeDialog`, `EditDescriptionDialog`, `PollMatchesDialog` (Title Case only).
- New: `PollRowMenu.tsx`, the Manage Poll groups builder, the poll-type chooser dialog.
- Removed from these pages: `ContentControlsLine`, `SortLink`, `CompactSwitch` in toolbars, the hidden header placeholder, `pollCardGridSx`, the card footer bar, corner Delete, chevron, scope subtitle.
- Stories updated: `PollCard`, `PollTable`, `PollsPanel`, `PlayersPanel`, plus `PollRowMenu` and the chooser.

## Documentation gaps
1. **Tabs versus figures order.** Section 1 puts figures before tabs, but Availability's figures describe the Polls view only. Assumed tabs first, figures inside Polls. Belongs in section 1.
2. **Delete in a kebab.** 6b keeps Delete off the kebab for records with an edit page; polls have none. Assumed Delete Poll in the kebab and in Manage Poll, with the existing confirm. Belongs in 6b.
3. **Inline pencils on a card.** Standard says one actions button per card. Assumed the time-strip and title pencils move into the kebab. Belongs in section 6.
4. **Title row action across views.** Assumed Create New Poll shows on all three tabs. Belongs in section 1.
5. **Return label when `returnTo` has no `returnLabel`** (the team-selection link). Assumed the caller adds one. Belongs in 7a.

## Test Plan
Tiers per `docs/standards/testing.md`; UI only. Per the owner's rule, tests are written after the owner's browser check; the plan is fixed here.
- **Component, hub and Polls:** Create New Poll on every tab; tab row links and `aria-current`; Jump To Today only on Players; counters labels, drill behaviour and ring; toolbar order (chips, Sort, Cards or List last), fused in List and a toolbar card in Cards; the last type chip cannot be switched off; no "Showing" text in any view or empty state; table flat, zebra parity, no chevron, kebab column; `ProgressMeter` in Answered; kebab "Actions for {title}" items and order, disabled reasons, never navigates the row; cards have no footer, corner Delete or pencils; dashed Create New Poll card; empty-state texts and no button; `returnTo` everywhere.
- **Component, new poll:** chooser tiles go straight to the branch; Group branch preselects from `sectionId` and from a single section; hint line instead of the empty state; covered-last ordering; button label and disabled reason; payload unchanged; Cancel and Create honour `returnTo`.
- **Component, Responses:** Back alone; one Manage Poll with every action reachable (Edit Description, Edit Close Time or Reopen, Close, Matches Covered, Delete, Share Invite last, disabled reasons); badges inline; `ResponseGauge` unchanged; toolbar card; override menu still works; team-selection `returnTo` still returns.
- **Existing tests** (`PollCard`, `PollTable`, `PollsPanel`, `PlayersPanel`, `AvailabilityHubLayout`, coverage, responses shell, `NewPollPage`, dashboard) updated, not weakened.
- **Phone 375 px** for hub, Polls, new poll and Responses; **Storybook** as listed; the e2e poll golden path is checked.

## Acceptance Criteria
1. No count or scope text on any Availability view; toolbars are fused (List) or standalone cards (Cards, Players, Cover); order chips, Sort, Cards or List last.
2. Poll rows and cards each have one kebab with every former action (Open Responses, Edit Close Time or Reopen Poll, Edit Description, Matches Covered, Close Poll, Delete Poll, Share Invite); no chevron, footer bar or pencil remains.
3. Create New Poll opens a Squad Poll or Group Poll chooser; Group Poll lands with the section preselected when known and no "Choose a section" empty state.
4. Each Responses page has Back alone, badges inline and ONE Manage Poll menu holding every former header action, Share Invite last.
5. Every x-of-y bar is a `ProgressMeter`; all labels are Title Case with UK spelling and no em dashes.
6. Poll behaviour, validation, payloads, endpoints, permissions and the status colours are unchanged; `returnTo` is carried and honoured as `127` says; checked at 375 px.

## Open questions (default if unanswered)
1. **Season pill.** The hub filters by the default season with no control (083). Default: no pill.
2. **Counters inside the Polls tab** rather than above the tabs. Default: inside.
3. **What feels wrong in the Group flow.** Assumed: unexplained section field, empty state, and stacked card-forms. Default: the six changes above; the owner may describe more.
4. **Pencils in the kebab only** (loses the one-click edit of a close time). Default: kebab only.
5. **"Create" for starting a poll** versus keeping "Open". Default: Create.

## Rollout Notes
UI only, one change, no flag. Order: (1) `PollRowMenu`, `PollTable`, `PollCard`; (2) hub shell and Polls toolbar; (3) Players and Cover; (4) chooser and new-poll branches; (5) Responses pages. Then update `page-anatomy.md` section 9 (Availability row to "In progress"), `design-system.md` text describing the 073 header and 083 toolbars, `docs/roadmap.md`, and copy the section 10 checklist into the PR.
