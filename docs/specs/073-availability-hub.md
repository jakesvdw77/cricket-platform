# 073 — Availability Hub and Poll Card Polish

**Depends on:** `034-availability-polls-dashboard.md` and `064-unified-availability-polls.md` (the Polls list at `/manage/availability`, its New poll button and `NewPollPage`; **this spec moves that screen's header and New poll button into a shared layout, see Rollout Notes**), `066-poll-close-time-and-unified-cards.md` (`PollCard`, the Closes row, `EditCloseTimeDialog`; **its Closes row is replaced here**), `065-group-poll-responses-view.md` and `067-squad-poll-responses-page.md` (the Responses pages the card now opens on click, and `ResponsesPageShell`'s view switch whose look the hub switch copies), `068-player-availability-grid.md` (the Players view; **its route, dashboard card and header link are amended here**), `069-match-card-redesign.md` (the whole-card click, hover lift and green outline of `RecordCard`'s `viewTo`) and `071-league-card-redesign.md` (`DetailLine`), `072-league-view-pages.md` (the layout-route pattern, `Outlet` with forwarded context), `042-match-list-filters-and-search.md` and `043-list-toolbar-gold-standard.md` (`ListToolbar` and its `sortToggle`). Sibling: `074-availability-coverage.md` (the third view; **this spec is built first**).
**Status:** approved (design approved by the user). Design: https://claude.ai/artifact/4x7HDVQG893xvcv8rSQJar

## Problem & Goals

Availability is spread over two unrelated dashboard tiles ("Availability Polls" and "Player Availability"). The Players page has a one-way "Availability Polls" button back, the Polls page has no way to reach the Players page at all, and a third view (`074`, Coverage) would need a third tile. The poll card is also the odd one out against the Match card (`069`): only its footer buttons are clickable, and its Closes row is plain text with a loose pencil next to it, unlike the stacked label/value lines on the Match and League cards. On a phone the shared list toolbar buries the sort control under search and filters.

This spec is frontend only. It puts everything under one **Availability** hub with a Polls | Players switch (Coverage is added by `074`), brings the poll card in line with the Match card, and moves the sort control to the top of the shared toolbar on a phone.

**Goals**
- One **Availability** tile on the manager dashboard, replacing "Availability Polls" and "Player Availability"; it opens Polls.
- One shared layout route at `/manage/availability` with the page header "Availability" and a segmented switch (Polls, Players) that is real navigation, so each view has its own address and the browser Back button works.
- The Player Availability grid moves to `/manage/availability/players`; the old `/manage/player-availability` redirects there.
- Poll cards open their Responses page when clicked anywhere, with the same hover lift and green outline as the Match card, without disturbing the buttons inside the card.
- The "Poll closes" line becomes a `DetailLine` (label column, value, the edit pencil inside the value).
- The shared `ListToolbar` shows the sort control first on a phone, with a visible short caption, and its icon button gets one consistent size.

## Non-goals

- **Any backend change.** Confirmed: no migration, endpoint, DTO or `openapi.yaml` change. Every call involved already exists.
- **The Coverage view.** That is `074`. This spec ships the switch with Polls and Players only and leaves a clearly marked place for the third tab; visiting `/manage/availability/coverage` before `074` is built is an unknown route.
- **Changing what the Polls list or the Players grid shows or filters by.** Both keep their own filters and their own persistence (`availabilityPolls:filters:<clubId>`, `playerAvailability:filters:<clubId>`) exactly as today. Filters are not moved into the URL and not shared between views.
- **Putting `NewPollPage` and the two Responses pages inside the layout.** They are sub-flows with their own header and Back link; they stay standalone routes and show no switch. Their Back label "Back to Availability Polls" still points at `/manage/availability`, which is still the Polls view, so it stays true and is not changed.
- **Changing the poll card's footer** (Close/Reopen, Matches, Responses, Share stay as `066` fixed them, in the same order) **or its header, subtitle, slot summaries, badges, corner delete and group title pencil.**
- **A pencil on a closed poll's "Poll closed" line.** The approved design shows none; Reopen in the footer opens the same dialog and the Responses page header keeps its pencil (`066`).
- **A shorter sort caption supplied by each caller.** The caption is the toolbar's existing current-sort label verbatim (see UI Requirements); a separate `shortLabel` prop per screen is not added.
- **Restyling the Players page's own two-row filter panel** or converting it to `ListToolbar` (it has no search-plus-sort shape); it is only relocated under the new header.
- **The player-facing `/player/availability` placeholder** and the public poll response pages. Untouched.
- **Changing `ListToolbar` on desktop.** From `md` up the order and look stay byte for byte (sort trailing).

## User Stories

- As a manager, I see one Availability tile on my dashboard and it opens the polls list.
- As a manager, I switch between Polls and Players with a switch under the page title, and the page title stays "Availability".
- As a manager, I only see the New poll button on Polls, where it belongs.
- As a manager, an old bookmark to Player Availability still works and lands on the Players view.
- As a manager, I click anywhere on a poll card to open its Responses page, and I see the card lift and get a green outline as I hover, like a match card.
- As a manager, I can still use the Close, Matches, Responses and Share buttons, the title pencil of a group poll and the delete bin on a card without opening the Responses page by accident.
- As a manager, I read "Poll closes" (or "Poll closed") and its date as a labelled line like the rest of the card details, and I edit the close time with the pencil beside the date.
- As a manager on a phone, every list screen starts with the sort control, and I can read which sort is active next to the icon.

## Data Model Changes

None.

## API Contract

None. No endpoint is added or changed and `openapi.yaml` is untouched.

## UI Requirements

Composed from existing pieces: `ManageScreenHeader`, `Button`, `NavTile`, `ListToolbar`, `RecordCard` (`viewTo`, `titleEdit`, `cornerAction`, `footerButtons`), `DetailLine`, MUI `ToggleButtonGroup`/`ToggleButton`. Shared-component changes are all additive (a `middle` slot on `ManageScreenHeader`, a shared switch style, `ListToolbar`'s phone order and caption).

### 1. Routes (`ui/src/App.tsx`)

Replace the single route `availability` (and `player-availability`) with a layout route; the sub-flow routes stay siblings:

```
availability                              -> <AvailabilityHubLayout />   (header + switch + <Outlet />)
  index                                   -> <AvailabilityPollsDashboard />
  players                                 -> <PlayerAvailabilityPage />
  (coverage                               -> added by 074)
availability/new                          -> <NewPollPage />                 (unchanged, outside the layout)
availability/group/:roundId               -> <GroupPollResponsesPage />      (unchanged, outside the layout)
availability/squad/:matchId/:pollId       -> <SquadPollResponsesPage />      (unchanged, outside the layout)
player-availability                       -> <PlayerAvailabilityRedirect />  (-> /manage/availability/players, keeping ?query)
section-availability                      -> <SectionAvailabilityRedirect /> (unchanged)
```

The layout's children are `index` and `players` only, so `availability/new`, `availability/group/...` and `availability/squad/...` (more segments, and listed as their own routes) never match a layout child, and `players` does not collide with any of them. `PlayerAvailabilityRedirect` is a tiny page-local component modelled on `SectionAvailabilityRedirect` (`useLocation().search`, `<Navigate replace>`), so the redirect keeps the incoming query string. `/manage/availability?showClosed=true` (the "covered by" links from `064`) keeps opening Polls with the switch preset.

New files in `ui/src/pages/manage/availability/`: `AvailabilityHubLayout.tsx` (+ `AvailabilityHubLayout.test.tsx`) and `PlayerAvailabilityRedirect.tsx` (+ test). Pages compose from components and need no story.

### 2. Shared layout: `AvailabilityHubLayout`

Reads `clubId` from `ManagerHome`'s Outlet context and forwards it through its own `<Outlet context={{ clubId }} />`, so both views keep their existing `useOutletContext<{ clubId?: string }>()`. With no `clubId` it renders the same "Not authorized" `EmptyState` the pages use today (and no switch).

**Header** (`ManageScreenHeader`, title "Availability", the default Back to Dashboard link): three parts in one row on `sm` and up, matching the approved mockup: the title on the left, the **switch** in the middle, the **action** on the right (the existing `justify-content: space-between` row). To make that possible `ManageScreenHeader` gains one additive optional prop, `middle?: ReactNode`, rendered between the title and `action`; on `xs` the row already stacks, so the order is title, `middle` (full width), `action`. A header without `middle` is byte for byte unchanged. Story and test updated. (As in the approved mockup, with the action hidden on Players the switch sits at the right end of the row rather than the middle.)

- **Action:** the primary `Button` "New poll" (`navigate('/manage/availability/new')`), **rendered only on Polls**. On Players (and Coverage, `074`) the slot is empty. On `xs` the button is full width beneath the switch.
- **Active view** is derived from the pathname: ends with `/players` is Players; otherwise Polls (so `/manage/availability` with or without a trailing slash and `?showClosed=true` is Polls).

**Switch:** a `ToggleButtonGroup` (`exclusive`, `size="small"`, `aria-label="Availability views"`, wrapped in `<nav aria-label="Availability views">`) whose buttons are real links: each `ToggleButton` is `component={RouterLink}` with `to`, `value` and an icon plus label:

| Label | Route | Icon |
|---|---|---|
| Polls | `/manage/availability` | `EventAvailableOutlinedIcon` (the old Polls tile icon) |
| Players | `/manage/availability/players` | `GridOnOutlinedIcon` (the old Players tile icon) |
| *(Coverage, added by `074`)* | `/manage/availability/coverage` | `JoinInnerOutlinedIcon` |

The links carry no query string (each view keeps its own filters, none of them in the URL). The selected link has `aria-current="page"`. Styling is exactly `ResponsesPageShell`'s view switch: green fill (`primary.main` background, `primary.contrastText` text, `primary.main` border, weight 600) when selected, `primary.dark` on selected hover, `px: 2`, `whiteSpace: nowrap`; on `xs` the group stretches to the full width and every button takes an equal share (`flex: 1`; halves now, thirds once `074` adds Coverage), from `sm` the buttons are content width. To avoid copying the style block, the `sx` object is extracted from `ResponsesPageShell` into one exported constant (`segmentedSwitchSx`, in `ui/src/utils/segmentedSwitch.ts`, style-only, no component) used by both; `ResponsesPageShell` behaviour and markup are unchanged.

### 3. Dashboard tile (`ManagerDashboard.tsx`)

In the "Team manager" group, the two cards "Availability Polls" and "Player Availability" are replaced by **one** `NavTile`: title **Availability**, description "Polls and who is free, game by game", `to="/manage/availability"`, icon `EventAvailableOutlinedIcon`. The `GridOnOutlinedIcon` import leaves this file. (`074` extends the description to mention coverage.)

### 4. The two views under the layout

- **`AvailabilityPollsDashboard`:** drops its own `ManageScreenHeader` (title "Availability Polls" and the New poll action move to the layout). Everything below it (toolbar, closed-polls switch, grid, empty states, the empty state's own New poll button) is unchanged. Its loading state (`isLoading` renders nothing) now sits under a header that is already visible, which is an improvement, not a behaviour to preserve.
- **`PlayerAvailabilityPage`:** drops its own `ManageScreenHeader` (title "Player Availability") and the "Availability Polls" `MuiButton` header action, along with the imports that become unused (`RouterLink`, `EventAvailableOutlinedIcon`, `ManageScreenHeader`; `MuiButton` stays for the Filters control). The "Go to Availability Polls" link in the grid's no-polls empty state (`068`) stays and still points at `/manage/availability`.

### 5. `ListToolbar` (shared; every list screen changes on a phone, by agreement)

`ui/src/components/ListToolbar/ListToolbar.tsx`, additive, desktop (`md` and up) unchanged:

- **Order on `xs`:** the sort group (the `sortToggle` icon button with its optional field picker, or the `Select` sort, **and the create button when present**) renders **first**, before search and filters. Implemented with CSS `order` (`order: { xs: -1, md: 0 }` on the sort group) so the DOM order, and every existing test that depends on it, stays as it is; the trade-off, accepted, is that on a phone the keyboard tab order still reaches sort last.
- **Visible caption on `xs`:** for the `sortToggle` path, a short caption sits beside the icon button on `xs` only (`display: { xs: 'inline', md: 'none' }`, caption-size text, `text.secondary`, `aria-hidden` because the button's `aria-label` and the tooltip already carry the meaning). The text is the **current** sort's label, i.e. `sortToggle.value === 'asc' ? sortToggle.ascLabel : sortToggle.descLabel` verbatim (for the Polls list "Match date, soonest first"; the mockup's "Soonest first" is illustrative of the style). The tooltip text is unchanged and still shows on hover and focus.
- **Icon button size:** the sort `IconButton` becomes a fixed 40 x 40 (`width`/`height` 40, same 1px divider border and radius, icon centred, `alignSelf: 'center'`) on every breakpoint, so it lines up with the 40px inputs and the create button beside it. The field-picker button (`sortFieldOptions`) keeps its look but is `height: 40` so the pair aligns.
- Unchanged: props, the `Select` sort path, the search `Autocomplete`, the filters slot, the tooltip, the `aria-label`.

**Every current `ListToolbar` user** (all gain the phone order and 40px icon; none changes on desktop) and what to look at in the browser check:

| Screen | Sort path | Check |
|---|---|---|
| `MatchList` (also serves `SquadPicker`) | `sortToggle` | Caption "Match date ..." fits beside the icon at 375px; any create button comes first with the sort |
| `AvailabilityPollsDashboard` | `sortToggle` | Sort first, then search, Type, Section, Show closed |
| `LeagueList`, `SeasonList`, `TeamList`, `TeamDirectory`, `PlayerList`, `SponsorList` | `sortToggle` | Caption fits beside the icon; filters still stack below search |
| `ClubContactList`, `SponsorContactList` | `sortToggle` + `sortFieldOptions` | Field picker button, arrow and caption share the first row without clipping at 375px (if they would not fit, the caption wraps below, never clips) |
| admin `ClubList`, `SubscriptionList`, `ProductList` | `sortOptions` `Select` + `createLabel` | Sort Select and Add button form the first row; no caption (not a toggle) |

`ListToolbar.test.tsx` gains: the caption text per sort state and its `aria-hidden`; the sort `IconButton` is 40px; the sort group carries the `xs` order style; DOM order unchanged; the create button sits in the sort group; no caption on the `Select` path. `ListToolbar.stories.tsx` gains a 375px (viewport) story for the toggle path and for the field-picker path, and the Select-plus-create story is re-checked at 375px.

### 6. `PollCard` (`ui/src/pages/manage/availability/PollCard.tsx`)

**Whole-card click.** `PollCard` passes `viewTo` to `RecordCard`: `/manage/availability/group/${round.id}` for a group poll, `/manage/availability/squad/${matchId}/${pollId}` for a squad poll. That gives the card the stretched title link (the title becomes the link, heading semantics kept), the pointer, and the same hover as the Match card (shadow lift and a 1px `primary.main` outline). The destination is already used by the **Responses** footer button, so both come from one new helper `pollResponsesPath(item)` in `pollHelpers.ts` and the button's `navigate` uses it too.

Everything interactive inside the card stays clickable above the overlay. `RecordCard` already lifts the footer (`CardActions` is positioned), the title pencil (`titleEdit`) and the corner delete (`cornerAction`) above the stretched link. The only new interactive element in the body, the close-time pencil (below), must carry its own `position: 'relative'` for the same reason (`RecordCard`'s `fields` note and `DetailLine`'s own note). The slot summaries and the `DetailLine` text are non-interactive and click through to the card link.

**"Poll closes" row.** The Closes `Typography` plus separate `IconButton` is replaced by a `DetailLine`:

- `icon`: `EventBusyOutlinedIcon` (a calendar with a cross; same icon open and closed), `fontSize="small"`.
- `labelWidth`: **78** (as the League card, `071`).
- `label`: **"Poll closes"** while the poll is open, **"Poll closed"** once closed.
- `value`: the formatted close date and time while open, e.g. "Fri 2 Oct, 17:00" (`formatCloseTime`, unchanged); **"Manually"** when Autoclose is off. For a closed poll the value keeps today's wording and logic from `066`: the close date without a time (e.g. "Fri 25 Sep"), or "Manually". (The mockup's closed example shows a time; the existing rule is kept so the existing tests keep their meaning.)
- **The pencil sits inside the value**: the value node is a small row `[text][IconButton]`, the `IconButton` `size="small"` with `aria-label="Edit close time"`, `title="Edit close time"`, `sx={{ position: 'relative' }}` and a negative vertical margin so the line is no taller than a text-only `DetailLine`, aligned with the text. It opens the existing `EditCloseTimeDialog` and does not navigate. It is shown **only while the poll is open** (the approved design shows none on a closed poll; Reopen in the footer opens the same dialog).
- Group polls keep the title pencil (`titleEdit`, "Edit description") unchanged.

The `DetailLine` takes the place of the old row at the bottom of the body, below the summary area that still grows (`flex: 1`) so cards in a row keep their footers aligned.

### 7. `pollHelpers.ts`

`closesRowText` is **kept exactly as it is** (the two Responses page headers use it: "Section · Closes ..."), now composed from a new helper so the wording and logic live once:

```ts
// returns { label: 'Poll closes' | 'Poll closed', value: string }
closesRow(open: boolean, autoClose: boolean, scheduledCloseAt: string | null)
```

- open + time: label "Poll closes", value `formatCloseTime(date)`; open without a time (Autoclose off): label "Poll closes", value "Manually".
- closed + time: label "Poll closed", value the date only (e.g. "Sat 3 Oct", the format `closesRowText` uses today); closed without a time: label "Poll closed", value "Manually".

`closesRowText` returns `Closes ${value}` / `Closes manually` / `Closed ${value}` / `Closed manually` (the lower-case "manually" kept), so every existing `closesRowText` test passes unchanged. `PollCard` uses `closesRow`.

## Test Plan

| Tier | Coverage |
|---|---|
| Component (Vitest/RTL) | **Routes:** `/manage/availability` renders the Polls dashboard under the layout; `/manage/availability/players` renders the grid page; `availability/new`, `availability/group/:id`, `availability/squad/:m/:p` still resolve to their own pages and show no switch; `/manage/player-availability?x=1` redirects (replace) to `/manage/availability/players?x=1`; `/manage/section-availability` still redirects as before. **`AvailabilityHubLayout`:** h1 "Availability"; the switch shows exactly Polls and Players as links to the right routes, the active one has `aria-current="page"` and the selected style, derived from the pathname (including `?showClosed=true`); New poll button present on Polls and absent on Players and navigates to `/manage/availability/new`; "Not authorized" with no club; the layout forwards `clubId` so both views work with their existing outlet-context hook. **Dashboard tile:** exactly one "Availability" tile linking to `/manage/availability`; neither "Availability Polls" nor "Player Availability" tile renders. **`AvailabilityPollsDashboard` / `PlayerAvailabilityPage`:** existing tests updated for the removed headers (no "Player Availability" heading, no "Availability Polls" header link), all other behaviour unchanged (filters, persistence, closed switch, `?showClosed=true`, empty states). **`ManageScreenHeader`:** `middle` renders between title and action; omitted, markup unchanged. **`ResponsesPageShell`:** switch unchanged after the style extraction. **`ListToolbar`:** as listed in section 5. **`PollCard`:** card has the stretched link to the right Responses path for a squad and a group poll (and the Responses button goes to the same place); clicking the footer buttons, the title pencil, the delete bin and the close-time pencil does not navigate (each runs only its own action: confirm dialog, description dialog, delete confirm, `EditCloseTimeDialog`); "Poll closes" `DetailLine` with the formatted value while open, "Manually" for Autoclose off, "Poll closed" with the date-only value or "Manually" once closed, pencil present only while open and inside the value; icon and label width. **`pollHelpers`:** `closesRow` for the four cases; every existing `closesRowText` assertion still passes. |
| Browser check | Phone (375px), two-column and wide. Dashboard shows one Availability tile that opens Polls. Header: title, switch, New poll on one row on desktop; stacked title, full-width equal-part switch, full-width New poll on a phone; New poll disappears on Players; the switch fill is the same green as the Responses page's; Back and forward move between Polls and Players; the old Player Availability URL lands on Players. A poll card lifts and gets the green outline on hover, clicking blank card area and the title opens Responses, and the footer buttons, group title pencil, delete bin and close-time pencil still do only their own thing. The "Poll closes" line lines up with the label column, the pencil sits inside the value without making the row taller. On a phone every list screen in the table above starts with the sort control and caption, none wraps badly or clips at 375px, desktop toolbars look as before. |
| End-to-end | None new (extends the existing, not-in-CI polls golden path: open Availability, create a poll, open its Responses by clicking the card). |

No backend tiers apply: no backend change.

## Acceptance Criteria

- The manager dashboard has one **Availability** tile that opens `/manage/availability`; the "Availability Polls" and "Player Availability" tiles no longer exist.
- `/manage/availability` (Polls) and `/manage/availability/players` (Players) share one header titled "Availability" with a Polls | Players switch styled like the Responses page's switch (green fill selected, equal parts full width on a phone); each view has its own address and the browser Back button moves between them.
- **New poll** shows only on Polls. The Players page has no "Availability Polls" button.
- `/manage/player-availability` redirects to `/manage/availability/players`, keeping the query string. `availability/new`, `availability/group/:roundId` and `availability/squad/:matchId/:pollId` work as before and do not show the switch.
- Each view keeps its own filters and persistence as before.
- Clicking anywhere on a poll card (except its buttons) opens that poll's Responses page; hovering lifts the card and draws the green outline, like a match card. The footer buttons, title pencil, delete bin and close-time pencil keep working and never trigger the card navigation.
- The poll card shows a "Poll closes" line (label "Poll closed" once closed) with a calendar-cross icon in a 78px label column, the formatted date and time (or "Manually") as the value, and, while open, the edit pencil inside the value opening the close-time dialog.
- On a phone every `ListToolbar` screen shows the sort control (and create button, where it has one) first, with a visible caption naming the current sort beside the toggle icon; the sort icon button is 40px everywhere; desktop toolbars are unchanged.
- No backend, migration or `openapi.yaml` change is part of this spec.

## Rollout Notes

- **Build this spec first.** `074` adds its tab, route and tile text to what is created here. Frontend only, one PR, no migration, no flag.
- **Amends earlier layouts** (the build PR adds an "Amended by `073`" note to each Status line, as `072` did for `062`):
  - **`068`:** the Players view moves from `/manage/player-availability` to `/manage/availability/players`; the separate dashboard card and the page header's "Availability Polls" link are removed; the page title now comes from the hub header.
  - **`064`:** the list's `ManageScreenHeader` and New poll action move into the hub layout; "the dashboard's nav entry/card is the only entry point" now means the single Availability tile.
  - **`066`:** the Closes row becomes the "Poll closes" `DetailLine`, and the card gains the whole-card click.
- **`ListToolbar` is shared.** The phone order and caption change reaches every list screen; the user agreed to this. Review the browser check table above before merging.
- **`docs/roadmap.md`** (living index; update in the build PR, not by this spec): note the hub and that `068`'s route moved; no new forward-looking item arises from this spec itself (the Coverage items are listed in `074`). `docs/architecture.md` is unaffected.
- **Open point for the build (none blocking):** whether the installed `@mui/icons-material` has `JoinInnerOutlined` (only needed by `074`; the build confirms and picks the nearest "overlapping circles" icon if not).
