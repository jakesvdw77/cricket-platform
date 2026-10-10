# 094: Club Structure on the Club Profile, and Seasons as their own page

**Depends on:** 001 (Club and Section hierarchy), 020 (club manager access), 025 (club structure: the Section tree, its org-chart editor and detail panel), 029 (seasons), 056 (the Club Profile overview), 078 and 080 (brand icon set and surfaces), 079 (manager shell and the one nav config), 081 (page header and counters), 087 to 092 (the Matches, Players, Polls, Leagues and Teams gold standards: `FilterBar`, `ContentControlsLine`, `PageCounters`, `ListViewToggle`, `useListViewPreference`, `KeyFigureTile`, `InfoCard`, `FormSectionHeading`, `SelectionGauge`, the table pattern, the "Record detail page" and "Compact forms" paragraphs in `docs/standards/design-system.md`)
**Status:** built on branch `feat/094-club-structure-and-seasons`, awaiting the user's browser check (not merged, no PR). Drafted 2026-10-10 from the user's request ("the Club Profile is the one page that is not gold standard", with an org-chart mockup for the club structure and Seasons moved out to its own menu item). Two slices in one spec: **A, Club structure** and **B, Seasons**. See "Built as" at the end for where the build differs from the draft below.

## Problem & Goals

The Club Profile page (`ClubOverviewPage`, route `/manage/club-profile`) is the one manager page still on the pre-gold-standard look: a `PageHeaderBand` with a "Back to Dashboard" link (the persistent menu replaced those in 079), a bespoke bento of cards, and two cards that are really other pages squeezed in. The **Structure** card is a plain indented list of section names (`SectionTreeList`, no age ranges, no interaction), although an interactive org chart with connector lines already exists on a different page (`/manage/sections`, `SectionTreeEditor`, spec 025). The **Seasons** card is a hand-rolled list of labels and dates, while the real Seasons screens (`SeasonList`, `SeasonDetailPage`, `SeasonFormPage`) are reachable only from that card, have no menu entry (the Club profile item reaches them through a route-prefix match) and are on the old toolbar-and-card look with no counters, no status, no list view.

Goals:
- **Slice A, Club structure:**
  - A. An interactive **org chart** of the section hierarchy on the Club Profile page, using the full width of the screen (the user's mockup: top-level sections side by side, children branching below with connector lines, each node a small rounded card with the name and an optional age-range chip; the chart is read-only).
  - B. A **read-only detail panel** for the clicked section (path, eligibility, sub-sections, teams, leagues, players, linked contacts) with an **Edit** button that goes to the existing edit screen.
  - C. The Club Profile page restyled to the gold standard (page header, key-figure strip, equal-height `InfoCard`s).
  - D. **Seasons removed** from the Club Profile page.
- **Slice B, Seasons:**
  - E. A **Seasons menu item** of its own.
  - F. A gold-standard Seasons page (counters, `FilterBar`, content line, Cards | List, status badges Current, Upcoming, Past, Inactive), season page and a compact add / edit form.

## Non-goals

- **No change to what a section or a season is.** No new section or season fields, no new rule, no migration. Re-parenting a section (dragging a node to a new parent) stays out, as 025 already decided; the org chart does not drag.
- **No section remove / deactivate on the Club Profile.** Removing, deactivating, reactivating, renaming and the contact link / unlink actions stay on the existing edit screen (`/manage/sections`, spec 025). The read-only panel never changes data. See Open Questions.
- **No restyle of `/manage/sections` itself** beyond reading a `?sectionId=` address parameter (so Edit can land on the right node) and sharing the org-chart component. It keeps its template picker, editable detail panel and "Section tree" card. Listed in the roadmap.
- **No new rule about seasons.** The backend enforces only `startDate <= endDate`; there is no "one current season" rule, no overlap check, no unique label, and never a hard delete (deactivate and reactivate only). "Current" is derived, not stored (the season containing today, `pickDefaultSeasonId`). This spec keeps all of that and shows the derived status; it does not add enforcement. See Open Questions.
- **No season rollover** (copying teams, squads or affiliations into a new season), and no per-season permissions.
- **No Season pill on the Club Profile page.** The panel's league and player figures describe the club's current season (the one `pickDefaultSeasonId` picks), labelled as such.
- **No change to the Contacts, Sponsors, Gallery, Managers or Club profile edit screens**, their permissions, or the quick-view dialogs.
- **No new brand icon is made here.** The user supplies the Seasons icon (see UI Requirements, Slice B).

## User Stories

- As a club manager, I see my club's structure as an org chart across the full width of the page, so that I understand how my sections relate at a glance.
- As a club manager, I click a section in the chart and read its details in a slide-in panel (where it sits, age range, gender, its teams, leagues and players), so that I do not have to open the editor just to look.
- As a club manager, I press Edit in that panel and land on the edit screen with that section already selected, so that changing it is one click.
- As a club manager on a phone, I browse the same structure as a nested, collapsible list and open a section's details in a sheet, so that the page works without sideways scrolling.
- As a club manager, I see the key figures of my club (sections, teams, players, current season) and my details, contacts and sponsors on a page that looks like every other manager page.
- As a club manager, I open **Seasons** from the side menu, so that I no longer hunt for it inside the Club Profile.
- As a club manager, I see how many seasons are current, upcoming, past and inactive, and filter the list by clicking those counters.
- As a club manager, I switch Seasons between Cards and List and the app remembers it.
- As a club manager, I open a season and see its dates, how far through it we are, and how many leagues, teams and matches it holds.
- As a club manager, I add or edit a season on one compact screen with a Cancel button.

## Data Model Changes

None. Everything is computed from existing data: `Section` (025), `Team` (026, `section_id`), the player-to-section link (028), `LeagueAffiliation` (029, team, league and season), `Season`, `Match` (`season_id`) and `ClubContact` links (025). No Liquibase migration.

## API Contract

What already exists and is reused unchanged: `GET/POST/PUT /api/v1/manage/clubs/{clubId}/sections` and `.../sections/{id}/deactivate|reactivate|contacts` (`SectionController`, all `canAdministerClub`), `GET .../sections/{id}/teams`, `GET .../teams`, and `GET/POST/PUT .../seasons` with `deactivate` and `reactivate` (`SeasonController`). The section list is a flat array (active and inactive); the client builds the tree (`utils/sectionTree.ts`). There is **no** tree endpoint and no counts today: a section tree endpoint is not needed (the flat list plus `parentSectionId` is enough and is what both screens already use), but **counts are**, which is the one real backend need.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/sections/summary?seasonId` | `canAdministerClub`, same as the section endpoints | **New (slice A).** `SectionsSummaryDto { totals { sections, teams, players }, sections: [ { sectionId, teamCount, activeTeamCount, playerCount, subtreeTeamCount, subtreePlayerCount, leagues: [ { id, name } ] } ] }`. `seasonId` is optional and defaults to the current season as the leagues list does; it scopes `leagues` (distinct leagues in which a team of that section is affiliated that season). `teamCount` and `playerCount` are the section's own (direct) teams and tagged players; the `subtree*` figures include every descendant, with players counted once (distinct). Players are counted by the definition the Players page counters use for an active player. `totals` are the club-wide figures for the key-figure strip (active sections, teams, players). A season of another club is a 404, as elsewhere. Fixed query count, never per section. The path does not clash with `.../sections/{sectionId}/...` (there is no `GET .../sections/{id}`). |
| `GET /api/v1/manage/clubs/{clubId}/seasons/summary` | same | **New (slice B).** `SeasonsSummaryDto { seasons: [ { seasonId, leagueCount, teamsEntered, matchCount } ] }`: leagues with at least one affiliation that season, distinct own teams entered, and matches (active) in the season. The season dates and `active` already come from the list, so the status counters (Current, Upcoming, Past, Inactive) are computed client-side from `GET .../seasons` with no endpoint (a season list is small and bounded, and the status is derived from dates and `today`). Fixed query count. |

`docs/standards/backend.md` layering applies (controller, service interface and implementation, repository; DTOs only across the controller boundary; no nested types in `service.impl`); `openapi.yaml` additions only, existing responses unchanged. Both endpoints are optional enrichments: if the user prefers no backend work in slice A, the panel can show teams from `GET .../sections/{id}/teams` and omit players and leagues (Open Questions).

## UI Requirements

### Reused versus new

| Piece | Status |
|---|---|
| `SectionTreeEditor` (the org chart with connector lines, node card, age-range chip, "+" button, `TreeScroller`) | **Reused, refactored.** The tree list, node card and connector styles are extracted into a shared `SectionOrgChart` component; `SectionTreeEditor` becomes the chart plus its rename / remove toolbar, unchanged in behaviour on `/manage/sections`. No second copy. |
| `SectionTree` (MUI `SimpleTreeView`) | **Reused** for the phone list, extended with an optional age chip per row. |
| `utils/sectionTree.ts`, `utils/sectionBreadcrumb.ts`, `ageRangeLabel` | **Reused** (`ageRangeLabel` moves out of `SectionTreeEditor` to a util so both use it). |
| `SectionDetailPanel` (editable) | **Unchanged**, stays on `/manage/sections`. |
| `SectionInfoPanel` (read-only) | **New**, in `components/`, four-file anatomy. |
| `SidePanel` (right drawer from `sm`, bottom sheet on a phone) and `OrgChartFullScreen` (expand overlay with zoom and fit) | **New**, shared components, four-file anatomy. |
| `PageHeaderBand`, `ManageScreenHeader`, `KeyFigureTile`, `InfoCard`, `DetailFieldRow`, `DetailFieldGrid`, `RecordIconButton`, `RecordQuickViewDialog`, `SocialLinksRow`, `BottomSheet`, `listSectionContacts`, `listTeamsForSection` | **Reused.** |
| `ClubOverviewPage` | **Rewritten** on the gold standard (same file, same route, same queries for profile, contacts and sponsors). |
| `SeasonList`, `SeasonDetailPage`, `SeasonFormPage`, `SeasonForm` | **Reworked** in slice B (same routes). |
| `SeasonCard`, `SeasonTable`, the seasons counters hook | **New** in slice B. |

### Slice A: Club structure

**Club Profile page (C).** Route and data unchanged. Top to bottom:
- **Header:** the page title "Club profile" (the `ManageScreenHeader` / poll-page style, no "Back to Dashboard", per 079), the club logo tile (64 px), name and club-type chip, and the filled **Edit profile** button on the right (to `/manage/club-profile/edit`). The old `PageHeaderBand` with its 56 px avatar goes.
- **Key-figure strip** (`KeyFigureTile`, three across, stacking on a phone): **Teams**, **Leagues** and **Players** (club totals from `sections/summary`), as the user asked (decision 2026-10-10). No Sections tile (the chart itself shows them) and no Seasons tile: Seasons has its own menu item.
- **Details row:** Club Details, Contacts and Sponsors as three equal-height `InfoCard`s, each with a **Manage** link (Details with the phone, email, website, address and social icons; Contacts and Sponsors keep the `RecordIconButton` avatars and the quick-view dialogs). Empty states as today.
- **Club structure card** (full width, below): described next. The old Structure and Seasons cards are gone.

**Org chart (A).** A full-width `InfoCard` titled "Club structure" with an **Expand** icon button and a **Manage** link (to `/manage/sections`) in its header and the read-only chart inside it.
- **Layout:** top-level sections side by side, children branching below with connector lines (the 025 technique), every node a small rounded card: the section name, an optional small age-range chip ("6-9", "40+", "Under 12", from `ageRangeLabel`) and "Inactive" muted when so. There are no "+" controls on this page. The selected node has the primary outline. The tree is centred when narrower than the card and uses its whole width; when wider, **the card scrolls sideways inside itself** (the page never scrolls sideways) and the first node is always reachable (no clipped start: the inner row is `width: max-content` with auto side margins, not a centred flex row, which is the 025 bug). Keyboard: nodes are buttons, arrow keys move between nodes, Enter or Space selects.
- **Clicking a node** selects it (selecting again keeps it selected; Escape or a Close button clears it). The chart does not navigate.
- **Expand** opens `OrgChartFullScreen`, a full-screen overlay of the same chart with zoom (50 to 200 percent in 10 percent steps) and **Fit to screen**; it opens fitted, and a node still opens the section panel. Adding a section stays on `/manage/sections` (its "New section" placeholder is unchanged). An empty club shows an empty state ("No sections yet") with a **Set up your structure** button to `/manage/sections` (where the starter-template picker lives).
- **Phone (below `sm`, proposed):** the chart is replaced by a nested collapsible list (every branch expanded by default, as `SectionTree` does) with the name, age chip and a chevron; tapping a row opens the detail panel in a bottom sheet (the `SidePanel` on a phone). Expand is not shown on a phone. No sideways scroll. See Open Questions for where the switch happens.

**Read-only detail panel (B).** The panel is a **slide-in panel** (decision 2026-10-10, after seeing the page): the shared `SidePanel`, a 420 px right-hand drawer from `sm` up and a bottom sheet on a phone, titled with the section name, opened while a node is selected and closed by Escape, the backdrop or the close button (closing clears the selection). It is modal, so another section is reached through the sub-section chips in the panel. The panel content is the flat `embedded` layout of `SectionInfoPanel` (no second title or close button, a three-column stat row, a two-column Eligibility grid). It is "almost like the edit screen, read-only": the same fields in the same order, as label-over-bold-value pairs ("-" muted when empty), no inputs.
- **Header:** the breadcrumb path (Juniors › Boys › U13), the section name at the title size, an Active / Inactive badge, a **Close** button, and the filled **Edit** button (to `/manage/sections?sectionId=<id>`; the edit screen reads the parameter, selects the node and opens its editable panel) with **Manage teams** (outlined, to `/manage/sections/<id>/teams`).
- **Eligibility:** Age range (written out: "6 to 9 years", "40 and over", "Under 12", "Not set"), Gender (Male, Female or Not specified), Parent section.
- **Key figures** (`KeyFigureTile`, compact): **Sub-sections** (direct, active), **Teams** (own, with the subtree figure as the caption when different), **Players** (own, with the subtree figure as the caption). From `sections/summary`.
- **Sub-sections:** chips of the direct children; clicking one selects it.
- **Teams:** chips of the section's own teams (`listTeamsForSection`), inactive ones muted, each opening the team page; "No teams yet" when none.
- **Leagues:** chips of the leagues the section's teams are entered in for the current season, labelled "Leagues in 2026/27" (each opening the league page); "Not entered in a league this season" when none.
- **Linked contacts:** the contacts linked to the section (`listSectionContacts`) as avatars with name and role, read-only (no link or unlink here).
- Loading is skeleton rows inside the panel; an error reads "We couldn't load this section's details." with Retry and leaves the chart alone. Selection is local state (not in the address).

**Edit screen (`/manage/sections`).** Reads `?sectionId=` once on load and selects that node; its Back link and title are untouched. It now renders the shared `SectionOrgChart` (with its "+" controls) inside `SectionTreeEditor`.

**Menu and routes (slice A).** `managerNav.ts`: the Club profile item's `match` list drops `'/manage/fixtures/seasons'` (kept: `/manage/club-contacts`, `/manage/sponsors`, `/manage/sections`). To keep Seasons reachable now that its card is gone, slice A already adds the **Seasons menu item** (below) pointing at the existing `/manage/fixtures/seasons` screen, unchanged. That is the slice boundary.

### Slice B: Seasons

**Menu item (E).** A new `NavItem` in `MANAGER_NAV`, **Schedule group** (decision 2026-10-10; placed first in the group, ahead of Leagues, because leagues and matches sit inside a season: Seasons, Leagues, Matches, Results): `id: 'seasons'`, `label: 'Seasons'`, description "Define your seasons and see what each holds", `to: '/manage/fixtures/seasons'` (route kept, so no redirect and no broken link; the existing `/manage/fixtures/seasons/...` sub-routes light the item through the prefix rule). Because "first match in menu order" applies and the Schedule group precedes Club, Seasons would win the highlight anyway; the Club profile item's season prefix is still removed as above so the two cannot disagree. The Menu sheet and the Overview tile grid pick the item up from the same config, so it appears there too.
- **Icon: `nav/season-cricket`** (`ui/src/icons/nav/season-cricket.svg`, rendered through `BrandIcon`, 078 and 080 rules: artwork only, background stripped and cropped by `npm run icons:strip`). **Supplied by the user and already added** (registered in `brandIcons.ts`; the 128, 256 and 512 px PNG exports are reference copies in `ui/design/icon-exports/nav/`, not bundled). The Seasons menu item therefore uses `icon: 'nav/season-cricket'` straight away; no stand-in MUI glyph is needed. No component imports the SVG directly.

**Seasons page (F).** Same shape as Leagues and Teams (091, 092), without a Season pill (this page lists the seasons):
- **Header:** "Seasons" with **Add Season** (filled) on the right; no back link (persistent menu).
- **Counters** (`PageCounters`, compact, four): **Current** (the season containing today, shown as its label when one, "None" otherwise; quick filter), **Upcoming** (start after today; quick filter), **Past** (end before today; quick filter), **Inactive** (amber when above zero; quick filter). Quick filters are mutually exclusive, clicking the active one clears it, a zero counter is a plain card. All four are computed client-side from the season list (bounded, so no summary endpoint is needed for them). The counters follow Show inactive: Inactive counts inactive seasons whether or not they are shown; the others count active seasons only. A season that is inactive is "Inactive" and never also "Current".
- **Toolbar:** `FilterBar` (compact) with search by label; content line "Showing N seasons" with `SortMenu` (Newest first, the default; Oldest first; Name A to Z), **Show inactive** (inactive hidden by default, as Teams) and the **Cards | List** switch (`useListViewPreference('seasonList:view')`; first control in the phone Filters sheet). The search is client-side, so the counters ignore it.
- **Season card** (`RecordCard`, whole card opens the season): a calendar tile avatar, the label, one **status badge** (Current positive, Upcoming neutral "Upcoming", Past muted, Inactive muted, using `badgeSx`); the date range written out ("1 Sep 2026 to 31 Mar 2027") and the length ("7 months"); a **time strip** (`CardTimeStrip`): "Ends in 41 days" for the current season, "Starts in 12 days" for an upcoming one, "Ended 3 months ago" for a past one (amber within 7 days of starting or ending, proposed); for the current season a `CardProgressBar` "Day 172 of 212"; three figure tiles **Leagues**, **Teams**, **Matches** (from `seasons/summary`, "0" when none); footer Matches, Leagues, Edit. Same parts and same height for every status (nothing appears or disappears; the progress bar row shows "-" muted when not current).
- **List view:** `SeasonTable` (zebra, sticky header, whole row opens the season): Season, Dates, Status, Leagues, Teams, Matches; phone: Season (status badge under the name), Dates, chevron.
- **Empty states:** "No seasons yet. Create your club's first season to get started." with **Add Season**; "No matching seasons" for a search; "No inactive seasons" when the Inactive filter finds none.

**Season page (`SeasonDetailPage`, F).** The "Record detail page" standard: Back (to Seasons), the label at the page-title size, status badge, the filled **Edit** (to `.../edit`). Key-figure strip (`KeyFigureTile`): **Starts**, **Ends**, **Length**, **Matches**, with the progress gauge (`SelectionGauge`) when current. Then equal-height `InfoCard`s: **Dates** (the existing label, start and end rows) and **In this season** (the Leagues and Teams entered counts from `seasons/summary`, with View leagues and View matches buttons to the unfiltered lists, because those pages do not read a season from the address yet; "Nothing entered in this season yet" when all counts are zero).

**Add / Edit season form (F).** `RecordFormScreen`, one compact card with a `FormSectionHeading` section **Season dates** (Label, Start date, End date; three columns on a desktop, one on a phone, "(optional)" rules as everywhere, no helper text), a footer with the **Active** switch (edit only, replacing the old `RecordStatusToggle` button in the actions bar), **Cancel** and **Save changes** / **Create season**. Same fields, validation (end not before start, now also shown inline under End date) and payload. Saving returns to the Seasons page as today.

**Updates.** `docs/standards/design-system.md` gets a short "Club profile and Seasons (094)" paragraph (the org chart and the read-only panel, the Seasons status vocabulary), `docs/standards/frontend.md` the `seasonList:view` key, `docs/architecture.md` is untouched (no relationship changes), and `docs/roadmap.md` gets the section below.

## Test Plan

Tiers per `docs/standards/testing.md`.

- **Unit (Vitest):** `ageRangeLabel` and the age-range written form (both, min only, max only, none); the season status derivation (Current, Upcoming, Past, Inactive, a season ending today, a season starting today, two seasons containing today, an inactive season containing today) and the time-strip wording; the seasons counters and quick filters (mutually exclusive, zero rule, Show inactive); the sort orders; the nav config (Seasons item present in the Schedule group, first, Club profile no longer matches `/manage/fixtures/seasons`, `/manage/fixtures/seasons/new` lights Seasons, `/manage/sections` still lights Club profile; extends `managerNav.test.ts` and `SideMenu.test.tsx`).
- **Unit (JUnit):** service tests for the two summaries: own versus subtree figures for teams and players, a player tagged to a parent and a child counted once in the parent's subtree, an inactive team in `teamCount` but not `activeTeamCount`, leagues scoped to the chosen season, a season of another club rejected (404), a club with no sections or seasons returning empty arrays and zero totals, `matchCount` and `teamsEntered` per season.
- **Integration (Testcontainers):** `SectionsSummaryIntegrationTest` and `SeasonsSummaryIntegrationTest` against real Postgres with a statement-count guard (the count does not grow with the number of sections or seasons), cross-club isolation, and the new custom repository queries (same PR, per the required-per-change-type rule).
- **Contract:** `openapi.yaml` additions for the two endpoints; no change to existing responses, so the diff must show additions only.
- **Component (Testing Library and Storybook):** `SectionOrgChart` (renders nodes, connectors, age chip, inactive state, "+" is labelled, selecting a node calls back, arrow-key movement, scrolls inside its card rather than the page; story at 375, 768 and 1280), the phone nested list (expand, collapse, row opens the sheet), `SectionInfoPanel` (every field, "-" for empty, the Edit link carries `?sectionId=`, sub-section chip selects, loading and error states), `OrgChartFullScreen` (zoom steps, Fit to screen), `SeasonCard`, `SeasonTable`, the Seasons page (counters as filters, Show inactive, view switch and remembered preference, empty states), the season page header and strip, the form (section, Cancel, Active switch, payload unchanged), the filled Edit assertion, and the Club Profile page (no Seasons card, no `SectionTreeList`, key figures, chart in place, equal-height cards). `ClubStructure` tests keep passing after the refactor and gain the `?sectionId=` selection case; existing tests are adjusted, not weakened. Stories for `SectionOrgChart`, `SectionInfoPanel`, `SeasonCard` and `SeasonTable`.
- **End-to-end (Playwright, mobile and desktop viewports), one golden path:** open Club profile, click the first section node in the chart, read the slide-in panel (heading is the section name), follow its Edit link to `/manage/sections?sectionId=...`; then open Seasons from the side menu (from the Menu sheet on a phone) and see the heading and the four counters; on a phone the nested list shows instead of the chart. It creates no data (`ui/e2e/manager-club-structure-and-seasons.spec.ts`).

## Acceptance Criteria

- The Club Profile page has no Seasons card and no plain list of sections; it shows the page header with a filled Edit profile, a three-tile key-figure strip (Teams, Leagues, Players), equal-height Details, Contacts and Sponsors cards, and the org chart.
- On a desktop the org chart uses the full width of its card, shows the user's mockup shape (Open Sides with Men and Women; Juniors with Boys over U11, U13, U15, U/9 and Girls over U13, U15; Vets with Over 40), age-range chips where set, no "+" controls, scrolls sideways inside its card when wider, and never clips the first node.
- Clicking a node opens a read-only panel with the path, age range, gender, key figures, sub-sections, teams, leagues for the current season and linked contacts; the panel has no inputs; Edit opens `/manage/sections` with that section selected.
- The Club Profile structure is read-only, with a Manage link to `/manage/sections`, an Expand overlay with zoom and Fit to screen, and no "+" or add dialog.
- Below the phone breakpoint the structure is a nested collapsible list and the details open in a sheet; the page does not scroll sideways.
- Slice A alone leaves Seasons reachable: the Seasons item is in the Schedule group, opens the existing Seasons screen, and stays highlighted on its sub-routes; the Club profile item no longer lights on them.
- The Seasons page shows the four counters (Current, Upcoming, Past, Inactive) as filters, the toolbar, and cards or the table; status badges follow the dates and the active flag; the view survives a reload.
- A season's page shows its dates, status, progress and what it holds; the form is one sectioned card with Cancel and an Active switch, saving the same payload as before.
- Edit is a filled primary button on the Club Profile and the season page.
- The Seasons menu item uses the brand icon `nav/season-cricket` (supplied by the user).
- No permission or data rule changes: cross-club access is still a 404.

## Open Questions

**Decided by the user on 2026-10-10:**

- **Seasons menu item:** in the **Schedule** group, **first** in it (Seasons, Leagues, Matches, Results), confirmed 2026-10-10.
- **Detail panel placement:** first decided as a card under the chart (mockup Option A), then **changed by the user to a slide-in panel** (the shared `SidePanel`: right drawer from `sm`, bottom sheet on a phone) after seeing the built page. A non-modal docked panel remains a possible follow-up.
- **Counts on the Club profile:** the key-figure strip shows **Teams, Leagues and Players** (club totals). The org chart nodes stay plain (name and age chip), as the mockup. The Seasons page may show season counters or none at all; the user is happy either way, so this spec keeps only the cheap client-side status counters (Current, Upcoming, Past) and no counts that need the backend beyond the figures already specified.
- **"+" on the Club profile:** first yes, through a small Add section dialog; **later removed by the user**. The view is read-only and adding stays on `/manage/sections`.
- **Counts backend:** yes, the new `sections/summary` endpoint (and `seasons/summary` for the season card figures, see question 9).
- **Seasons URL:** keep `/manage/fixtures/seasons` (no redirect).
- **Drag to re-parent:** stays deferred.
- **Slice order:** as proposed (slice A also adds the Seasons menu item, pointing at the existing screen; slice B reworks the page behind it).

**Still open:**

1. **Can a section be removed or deactivated from the read-only panel?** Proposed: no, stays on the edit screen. Option: a Deactivate button with a `ConfirmDialog`. (The user answered "I think so" to the proposed behaviour; treated as confirmed unless the mockups change it.)
2. **Phone breakpoint.** Proposed: nested list below `sm` (600 px), chart from `sm`. A narrow tablet may prefer the list up to `md`.
3. **Season card figures (Leagues, Teams, Matches).** Proposed: the new `seasons/summary` endpoint. Option: dates and status only, no endpoint (the user said season counts are optional).
4. **Season rules.** The backend has no "one current season", no overlap check and no unique label. Should the form warn (not block) when the dates overlap another active season, or when a second season contains today? Proposed: no change in this spec.
5. **Season time strip amber threshold.** Proposed: amber within 7 days of a start or an end.

## Rollout Notes

One branch, two slices, each independently shippable; migrations: none.

- **Slice A (Club structure):** (1) refactor: extract `SectionOrgChart` and `ageRangeLabel` from `SectionTreeEditor`, `?sectionId=` on `/manage/sections` (no visible change elsewhere); (2) backend `sections/summary` (service, repository, integration test, `openapi.yaml`); (3) the Club Profile page restyle, the full-width chart, the phone list and `SectionInfoPanel`; (4) remove the Seasons card and add the Seasons menu item (`nav/season-cricket` icon, existing screen), drop the season prefix from Club profile's `match`. After (4) slice A is complete and nothing is orphaned.
- **Slice B (Seasons):** (1) backend `seasons/summary`; (2) the Seasons page (counters, toolbar, `SeasonCard`, `SeasonTable`); (3) the season page; (4) the form. The `nav/season-cricket` icon is already in the repo and registered, so no icon work remains.
- Update `docs/standards/design-system.md`, `frontend.md` and `docs/roadmap.md` as each slice lands. Plan: `/plan-feature` against this file once approved, per `docs/workflow.md`.

## Built as

Built on `feat/094-club-structure-and-seasons`, in this commit order: org chart refactor (`SectionOrgChart`, `ageRange`, `?sectionId=`), sections summary (backend), building blocks (`SectionInfoPanel`, `SidePanel`, phone list extras), Seasons menu item, Club Profile, seasons summary (backend), Seasons list, read-only change, season page, season form, expand overlay. Where the build differs from the draft above:

- **Read-only Club Profile.** The "+" under nodes, **Add top-level section**, the Add section dialog and `AddSectionDialog` were removed at the user's request. The structure card has an **Expand** icon button and a **Manage** link to `/manage/sections`, where all editing stays. Club Details, Contacts and Sponsors each have a Manage link too.
- **Slide-in panel.** Section details open in the shared `SidePanel` (right drawer from `sm`, bottom sheet on a phone) using the `embedded` layout of `SectionInfoPanel`, not a card under the chart.
- **Expand overlay (added).** `OrgChartFullScreen`: zoom 50 to 200 percent in 10 percent steps, Fit to screen, opens fitted; desktop only.
- **Key figures.** The Club Profile strip has three tiles (Teams, Leagues, Players); the draft's "four-tile" acceptance line was wrong.
- **Menu.** Seasons is first in the Schedule group (the Test Plan line saying "Club group" was wrong).
- **Seasons counters.** Four (Current, Upcoming, Past, Inactive), all client-side quick filters.
- **Season card footer.** The Leagues and Matches buttons open those lists unfiltered, because those pages do not read a season from the address (roadmap).
- **Button label.** The button keeps its capitals: **Add Season**, like Add League.
- **Season form.** Compact card with the Active switch (edit only), Cancel and Save in the footer, and the end-date error inline.
- **Dates.** The season status uses the browser's local date while `pickDefaultSeasonId` is unchanged (UTC), so they can differ around midnight (roadmap).
- **End to end.** One golden path in `ui/e2e/manager-club-structure-and-seasons.spec.ts` (needs local Keycloak, skipped in CI); the season steps in the polls, league management and team selection specs now open Seasons from the side menu.
