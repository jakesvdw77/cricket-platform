# Page anatomy standard

The one place where the owner's decisions about how every manager page is laid out are written down, so a decision is made once and applied everywhere. We go through the application page by page against this file (see "Page review log"). **When the owner decides something, add it here in the same change, with the date.** Do not ask the owner a question this file already answers. Details of components live in `design-system.md`; this file says which pattern a page must use and where.

Status of each rule: **Decided** (owner said so, apply it), **Proposed** (my suggestion, not yet confirmed, ask once), **Open** (needs a decision).

## 1. Page skeleton (top to bottom)
1. **Top row.** Back alone on the left, quiet. **Decided 2026-10-30.**
2. **Title row.** Logo or avatar if the record has one, the title, the format/status badges inline, then the **Season pill beside the title** on the left (every season-scoped page, lists and detail pages alike). **The page-level actions sit on this same row, right-aligned: the Actions menu (white secondary) then the page's one filled primary (Edit X or Add X), rightmost.** They wrap under the title on a narrow screen and take the full width on a phone. Nothing else is on the title row's right. **Decided 2026-10-30** (the list pages already work this way; the detail pages move over as they are reviewed). Contacts and links sit directly under the title as inline items (icon then text), never on a row of their own. **Decided.**
3. **Figures** (if the page has any): one row of figure cards, section 2.
4. **Tabs** (if the page has them): the tab names on the left; that tab's own actions right-aligned on the same row (they wrap to a row under the tabs on a phone, equal width, 44 px). **Decided.**
5. **Filter bar:** flat, section 3.
6. **Data:** a table, cards or both, section 4.

## 2. Figure cards
- **One card: the Matches counter card** (`PageCounters`, `density="compact"`): raised (shadow 2, 1 px divider border), one fixed height (about 46 px), the number in the display face then its uppercase label on one line, **no icon**. **Decided 2026-10-30.**
- **No "FILTER" tag.** A card that filters or drills shows a pointer cursor, a small lift on hover, and a green ring when selected. A static figure is the same card without the pointer. **Decided 2026-10-30.**
- The icon-tile `KeyFigureTile` (72 px), the tinted `StatTile` are to be replaced by this card as each page is reviewed. **Proposed** (the owner liked the Matches cards and disliked mixed heights and icons; confirm the stats pages and profile pages when we reach them).
- A zero counter is a plain card (already the rule in `PageCounters`).

## 3. Filter bar and count
- **The filter bar is the table's own toolbar** (owner chose this over a floating row or a hairline, 2026-10-30, after `docs/mockups/filter-bar-line-mockup.html`): search, selects, sort, the Cards | List toggle and the switches on **one row** inside a flat white card, separated from the data by a hairline. **Decided 2026-10-30.**
  - **List view:** the toolbar row is the top of the table's card (one card: toolbar, hairline, column headers, rows).
  - **Cards view and other content** (card grids, panels): the same toolbar sits as a flat white card of its own directly above the content, with the hairline border, so the controls always read as belonging to what they filter. In List view an empty result stays inside the fused card (the message replaces the rows) so the toolbar never remounts and the search keeps focus while typing.
  - **Sort and the Cards | List toggle are a pair at the far right of the toolbar, in this order: Sort, then Cards | List (the toggle is last).** They sit in the same place in both views, so the user always sees them together and the toggle never moves under the pointer. **Decided 2026-10-30.** Switches (Show inactive and the like) sit to the left of the pair. At tablet width the switches fold into the Filters sheet before the pair does; on a phone the pair also moves into the sheet (the toggle first).
  - Fields inside the toolbar are white-filled with a clean label (no patch behind a floating label).
  - **Every control in the toolbar is a 36 px sibling of the selects and search:** body font 13 px weight 600 in the ink colour, white fill, 1 px green-grey edge, 6 px radius. Sort is an outlined "Sort: Name, A to Z" button with a caret (opens a menu), Cards | List is the same-height segmented control (selected side tinted), and switches are outlined toggle chips (`aria-pressed`, tinted with a check when on). No loose switch text and no green link text in the toolbar.
  - On a phone: the Filters button and Search share the row; everything else is in the sheet.
- **No count text at all** ("Showing N ...", "3 leagues", "N upcoming matches"): the figure cards at the top carry the totals, so the list does not repeat them. No season text repeated either. **Decided 2026-10-30.** (If a filtered result count is ever wanted, show it only while a filter is active.)
- **Segmented toggles never show counts in their labels** ("All", "Our teams", "League teams"); a section's count sits in its own heading or in the table header. **Decided 2026-10-30.**

## 4. Raised versus flat
- **Raised** (shadow) = the at-a-glance summary only: the figure cards, plus a card the user can click. It is what draws the eye first. **Decided 2026-10-30** (owner: "I think so", after comparing `docs/mockups/league-page-elevation-mockup.html`).
- **Flat with a hairline border** = a working surface that holds content: tables, panels and info cards (and record cards: see the open item). **Decided for tables 2026-10-30.**
- **Toolbars and tab rows** are flat: the filter toolbar is the top row of its content card (section 3); tab rows have no card. **Decided.**
- **Record cards in the Cards view are flat with the hairline border and lift on hover** as their click cue, so the Cards and List views match and only the figure cards are raised. **Decided 2026-10-30** (owner chose it after `docs/mockups/league-cards-view-mockup.html`). Built first on the league cards; the other lists' record cards move over when each page is reviewed (`RecordCard` has an opt-in `flat` prop).

## 5. Buttons and labels
- **Secondary = outlined = white-filled with the green edge**, readable on the cream wash and on cards. Text and ghost buttons stay transparent. Dark console screens (Player Hub, landing, status screens) keep their own transparent outline look. **Decided 2026-10-30.**
- **One filled button per band** (top row, tab row, dialog footer). Edit on a detail page is filled and rightmost. **Decided.**
- **Compact 32 px buttons in toolbars and cards; 44 px touch targets below `md`** (the compact button keeps a 44 px touch area). **Decided.**
- **Labels use Title Case** ("Import Schedule", "Add Match", "Edit League", "Share League...", "Import History (2)"). Body text and headings stay sentence case. **Decided 2026-10-30.**
- **No lone control in its own row** (see `design-system.md`, "Layout density"): put it in the toolbar, on the row of its neighbours, inside its card or in a menu; stacking is for phones. **Decided.**
- Secondary and rare page actions go in the **Actions menu** (Duplicate, Share, Import history, and so on), not as separate top-row buttons. **Decided.**
- Leading icons on buttons: **Open** (the league page uses them on Import Schedule, Add Match, Edit League; list pages use none). Ask once when reviewing the lists.

## 6. Tables and lists
- Home and Away are separate columns of equal width (logo then name, one line, ellipsis with a tooltip); the "Our match" chip in its own narrow column; the whole row opens the record. **Decided 2026-10-30.**
- **Header and zebra:** the table header row has a soft green tint; because of that the **first data row is white and the second is tinted** (zebra parity swapped so the first row does not merge with the header). Sticky header row, "-" for a missing value (see `design-system.md`). **Decided 2026-10-30.** Applied to the Leagues list and the league Schedule tab first; every other table moves over when its page is reviewed.
- **One actions button per record (Decided 2026-10-30, applied first on Leagues, other pages move over when reviewed).** Every table row and record card has ONE actions button: a borderless icon-only kebab (three vertical dots, 32 px, a real 44 px touch target below `md`, hover tint, tooltip and `aria-label` "Actions for <record name>") at the right end of the row (before the open chevron) and in the top-right corner of a card. It opens a **dense menu** of that record's actions (one list, icon and Title Case label per item, no descriptions; a bottom sheet with 44 px items on a phone) and never navigates the row: the row or card click still opens the record. Built as `ManageMenu` with `trigger="kebab"` and `dense`. A disabled item says why in one small line.
- **Card views fill the width and carry no footer bar (Decided 2026-10-30, applied first on Leagues).** The Cards grid fills the available width (`dynamicCardGridSx`: `repeat(auto-fit, minmax(340px, 1fr))`, cards capped at about 560 px and left aligned, 16 px gap, one column on a phone) and ends with a dashed `AddCard` ("Add League") where the user may add; in an empty or filtered-out Cards view it sits under the toolbar card with the empty message. A record card has no footer action bar: its actions are in the kebab (the card keeps its social icons in the header, left of the kebab).

- **Table rows carry no chevron (Decided 2026-10-31, owner).** The whole row is the link: the cue is the hover tint and the pointer, and the row's accessible name stays on the stretched link. The kebab stays at the right end of the row. Applied first on the Leagues list and the league Schedule table; other tables drop the visible open-chevron when their page is reviewed.

## 7. Forms inside a page (edit modes)
Editing is a mode of the page, not a different screen, and uses the same row editor, checks and Review as the import (`docs/specs/126`). Nothing is saved before an explicit, server-enforced confirmation.

## 7a. Navigation: where Back, Cancel and Save go (Decided 2026-10-31, `docs/specs/127-return-navigation.md`)
- **The origin of a page travels in its address** as `returnTo` (the origin's path and query) and `returnLabel` (a short plain-text name, for example "TVL Division 1 T20 schedule"), so it survives a reload and a new tab. It is accepted only for an in-app `/manage/` or `/admin/` path; anything else is ignored and the page behaves as before.
- **A link that leaves a page for one it is not the default parent of** is built with `withReturnTo(destination, currentOrigin(location), label)` (`utils/returnTo.ts`). **A page reached that way** shows "Back to {label}" and returns there on Back, Cancel and after a successful Save or Delete (`useBackLink`, `useAfterSave`, `hooks/useReturnTo.ts`). The headers (`ManageScreenHeader`, `RecordFormScreen`, `RecordDetailScreen`) do this on their own. Only one step back is kept: a page never copies its own `returnTo` forward.
- **After Save the origin must show the result.** A league Schedule origin gets `showAll=1` when the saved match is in the past (the Schedule tab honours `?showAll=1`).
- **Without a `returnTo` a page behaves as it always did** (its default parent). The router-state `{ backTo, backLabel }` and `?from=` mechanisms remain as fallbacks until their pages are migrated.
- **Breadcrumbs are a separate, later decision** (see the roadmap).

## 8. Decisions taken while building the league page, and what is still open
**Decided 2026-10-30** (owner: "the look is very good"):
- **Title style:** the record's own name in the display face at the list title size (32 px, 26 px on a phone), weight 700, **keeping its own capitals** (no uppercase), logo beside it; a page name ("Leagues", "Matches") stays uppercase. Built from `pageTitleSx` with the transform removed for record names.
- **Vertical rhythm:** 16 px between bands on desktop, 12 px on a phone.
- **Badges:** format and Active chips inline beside the title, then the Season pill.
- **Figures:** the Matches counter card as static compact `PageCounters` (no icons, no FILTER tag, no pointer); an explanatory sentence is an info icon (`PageCounterItem.info`). The old icon-tile strip and the `?look=classic` comparison switch were removed (owner chose this look).
- **One Add button.** When "Add" has several kinds, the tab or page shows **one** Add button that opens a chooser dialog with large tiles and a short explanation for each (Teams tab: Our team, Opponent team, Copy teams). No separate Copy or Add-variant buttons beside it.
- **Social links** are inline contact items like the others on the line: the small brand icon then the network name as a text link ("Facebook"), same size and colour as the website link (`SocialLinksRow variant="labelled"`). The round-button variant was tried and rejected (owner: "looks silly").

**Proposed, applied on the league page for owner review, not yet Decided:**
- **Icons on buttons (middle path):** a button has an icon only if it is one of the app's standard verbs: **Add** (plus), **Edit** (pencil), **Share** (share icon) (and Delete if wanted). Every other button is text-only. Menu items, icon-only buttons, the Actions caret and the tabs keep their icons. Needs to hold app-wide, so each page moves to it when reviewed.

**Decided 2026-10-30 (Manage League):** a detail page with many actions has ONE filled "Manage <thing>" button on the title row opening a grouped panel with a one-line explanation per option (`components/ManageMenu`: popover on desktop, bottom sheet on a phone); tab rows carry no buttons by default and at most ONE white text-only button per tab where the action would not otherwise be obvious; empty states carry their own action. Built on the league page; Edit is a menu item ("Edit League Details").

**Parked ideas (not yet decided, do not build without the owner):**

**Still open:**
- **Edit button on Player and Field pages:** they pair a Status or secondary button with Edit in a 2-up grid at 40-44 px; align to the rule in section 1 (suggest: Status and other secondary actions go in the Actions menu).
- **"Show inactive" as a Status select** (Active, Inactive, All) instead of a switch, so "which records" is a filter and switches stay for view options. Not yet shown to the owner.
- **Stats pages and profile pages' figure rows** (see section 2).
- **Season pill:** the Season detail page has none (it is the season); Player and Field have none. Confirm when we reach them.

**Decided 2026-10-31 (League edit, `docs/specs/128`):**
- **An edit page holds settings only.** Day-to-day lists (a league's Teams and Schedule) live on the record's own page, not as tabs of its edit page; old `?tab=teams` and `?tab=schedule` links open Details.
- **The Season pill shows only on tabs whose content depends on the season** (Details, for the season dates, and Playing Conditions); never a per-tab Season select.

**Decided 2026-10-31 (League page header and menus):**
- **The corner edit pencil is removed** from the league page. Edit League Details is the first item of Manage League.
- **Each tab's single action is a white "Manage X" menu** (Manage Schedule, Manage Teams, Manage Playing Conditions): the same `ManageMenu` as the title row, a secondary (outlined) text button with a caret, on the tab row. Actions come first and **Share is last**, and a tab's Share item opens the Share League dialog with only that tab's content ticked (Schedule, Teams, Conditions). Manage Schedule: Add Match, Import Schedule, Share Schedule. Manage Teams: Add Team (the chooser), Copy Teams, Share Teams. Manage Playing Conditions: Edit Playing Conditions, Share Playing Conditions, View Document (the season PDF in a new tab; disabled with "No PDF uploaded").
- **Manage League is league-wide only** (the filled title-row button): Edit League Details, Duplicate League, Import History, Share League (Share last; it ticks Schedule, or Conditions on that tab).
- **Equal widths:** Manage League and the tab-row Manage button share one fixed width, `MANAGE_BUTTON_WIDTH` (220 px, exported from `components/ManageMenu`, set from the longest label), full width on a phone, and one right edge.
- The Leagues LIST row and card kebab menu items are unchanged.

## 9. Page review log
Update the status as each page is brought in line. "Reviewed" means differences listed and agreed; "Done" means built, tested and hand-checked by the owner.

| Page | Status | Notes |
|---|---|---|
| League page (Schedule, Teams, Conditions) | In progress | Decisions in section 8 applied (title, rhythm, badges, counter cards, one Add button, round social buttons, Season pill beside the title); icons middle path proposed (the comparison switch is removed); the icon rule is still open; return navigation (section 7a) on every link that leaves the page; table rows have no chevron; kebab Actions menus on Schedule rows (Open Match, Edit Match: our matches only, as the Matches list has no row menu) and Teams tiles (our team: Open Team, Remove from League; league team: Edit League Team, Deactivate or Reactivate, Remove) |
| League edit | In progress | Revamped per `docs/specs/128` (built, pending the owner's browser check): four tabs (Details, Branding, Playing Conditions, Contacts), Season pill on Details and Playing Conditions only, season dates row at the top of Details, 36 px compact fields, tidy Playing Conditions grid; Back, Cancel and Save honour `returnTo` (2026-10-31) |
| Leagues list | In progress | Applied: FILTER tag removed app-wide (pointer, hover lift, green ring instead); flat filter bar (`bare` + `viewControlsInline`, no floating labels in the flat bar); flat table and flat cards (hairline, hover lift); toolbar fused into the table card (standalone toolbar card over Cards and empty states); no count text; return navigation (section 7a): every destination carries the list as `returnTo`; table rows have no chevron; one kebab Actions menu per row and card (Open League, Open Schedule, Open Teams, Open Conditions, Edit League Details, Add Match, Import Schedule, Share League, Duplicate League); the old Share icon and the card footer bar are gone; dynamic Cards grid with a dashed Add League card |
| Matches list | Not reviewed | Reference for the counter card; filter bar boxed |
| Match page | Not reviewed | Icon tiles; 44 px header controls; up to six top-row controls |
| Players list / Player page | Not reviewed | |
| Teams list / Team page | Not reviewed | Team page has the Season pill top-right |
| Seasons list / Season page | Not reviewed | Season page has a separate progress card |
| Fields list / Field page | Not reviewed | Field page has five tiles |
| Availability (Polls, Players, Cover) | Not reviewed | Segmented view switch in the header |
| Results list | Not reviewed | Three top-row actions |
| Team selection hub | Not reviewed | |
| Overview | Not reviewed | |
| Player stats / Team stats / Leaderboards | Not reviewed | Different title style; stat tiles with icons |
| Club profile | Not reviewed | h5 title, not the page title style |
| Import wizard and import history | Not reviewed | |

## 10. Per-page review checklist
Copy into the PR description for each page.
- [ ] Top row: Back alone. Title row: Actions menu and one filled primary right-aligned on the title row.
- [ ] Season pill beside the title (season-scoped pages).
- [ ] Title row: badges inline; contacts under the title, social links as icon plus name items on that line.
- [ ] Figure cards are the Matches counter card; no icons; no "FILTER" tag; pointer, hover and selected ring on clickable ones.
- [ ] Tabs: that tab's actions on the tab row.
- [ ] Filter bar is the table's own toolbar (inside the card, hairline below; a card of its own above card grids and panels), one row; no count text and no season text repeated.
- [ ] No counts in toggle labels.
- [ ] Raised only for the figure cards; tables, panels and cards are flat with a hairline; the filter toolbar sits inside its content card.
- [ ] Buttons: white secondary, one filled per band, compact, Title Case, no lone row; one Add button with a chooser when there are several kinds; icons only on Add, Edit and Share.
- [ ] Navigation: links that leave this page carry `returnTo`; pages reached from elsewhere honour it. Table rows have no chevron.
- [ ] Phone: checked at 375 px.
- [ ] Tests updated; `design-system.md` updated only if a component changed.
