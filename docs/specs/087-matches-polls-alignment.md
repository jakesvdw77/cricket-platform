# 087 — Matches Aligned With Polls

**Depends on:** 042 (Matches list filters and search), 069 and 075 (match card), 081 (page counters and the Matches counters list), 083 (FilterBar, shared filters), 084 and 085 (clickable counters, compact density, `ContentControlsLine`, `CompactSwitch`, `SortLink`, zebra rows), 064–066 and 082 (the poll card)
**Status:** approved by the user 2026-10-09 (mockup and spec). Written 2026-10-09 from the user's request ("Matches: the clickable-counter filters and the match card need to follow the patterns in the Polls page: layouts, information, icons, alternating row styling. Polls is our gold standard for all pages"). Decided by the user the same day: the counters are quick filters on the card list; zebra rows go inside the card and any panel; Season stays on Matches in the shared FilterBar. Mockup built 2026-10-09 (https://claude.ai/artifact/Vdq4fj9fxjV6Me3qqG2LVE: desktop page, card comparison, card variants, counters and zebra states, phone page, phone Filters sheet), approved; this spec was updated to match it. Nothing built. Backend contract is an outline to finalise in planning.

## Problem & Goals

The Polls page was polished across 064–066, 082–085 and is the benchmark. Matches still looks like the pre-polish version of the same screen:
- No counters under the header (the Matches counters in 081 were never built).
- The toolbar is the old `ListToolbar` (search, sort icon, Section / League / Season / "Show past matches" in one row), with no filter chips, no phone Filters sheet with a badge, no compact density, and its toggle and sort are not on the `ContentControlsLine`.
- The match card shares `RecordCard` with the poll card but differs in body layout, information order, how it signals urgency (no countdown, no amber tone), and its detail lines and Selection rows do not follow the poll card's tinted-strip / zebra conventions.

Goals:
- **A. Counters:** a row of four clickable quick-filter counters under the Matches header, in the Polls style (`PageCounters`, `density="compact"`).
- **B. Toolbar:** the shared `FilterBar` and `ContentControlsLine` on Matches, identical in layout, chips and phone sheet to Polls.
- **C. Match card:** the poll card's layout, information hierarchy, icons and row styling.
- **D. Zebra rows:** alternating row tint wherever Matches shows rows (inside the card; any list in a panel).

## Non-goals

- **No drill-down panels for Matches counters** (user decision): all four counters filter the cards below. A panel for Matches can be added later by the same two-kind rule (084) if a to-do list proves useful.
- **No list/table view toggle** for Matches (offered, not chosen).
- **No change to what a match is**, the Match View (075), the Edit Match page, Team Selection (076), the team sheet share (030/039) or polls. Cards keep their four footer actions.
- **No change to `SquadPicker`'s reuse of `MatchList`** beyond inheriting the new look; it keeps its own primary action (`viewTo={null}`).
- **No other pages.** Players, Leagues, Seasons and the rest follow in their own specs, each asked the same way.

## User Stories

- As a manager, I see at a glance how many matches are on this week, how many teams are not announced, and how many matches have no availability poll, so that I know what needs attention.
- As a manager, I click a counter and the cards narrow to those matches; I click it again, or "Upcoming matches", to go back.
- As a manager, the Matches toolbar behaves exactly like the Polls toolbar (filters, chips, phone Filters sheet, "Showing N matches" line, sort link), so I do not relearn it.
- As a manager, a match card reads like a poll card: I see when it starts and how long to go, the selection progress and the poll state without opening it.
- As a section manager, counters count only matches in my sections.

## Data Model Changes

None.

## Counters (A)

Four `PageCounters` in `density="compact"`, all **filters** (`kind="filter"`: `aria-pressed`, `active` outline, the "filter" tag), the 084 rule for filter counters. The first is the reset.

| Counter | Figure | Tone | Action |
|---|---|---|---|
| Upcoming matches / Matches shown | Matches in scope (the list's own total) | default | The reset: active by default, clears the counter filter. Reads "Matches shown" when Show past matches is on |
| This week | Matches from today to today + 7 days | default | Toggles the "this week" filter |
| Teams not announced | Matches with at least one own side not yet announced | warning when > 0 | Toggles the filter |
| Without a poll | Upcoming matches with an own side and no availability poll | warning when > 0 | Toggles the filter |

- "Played this season" (081's fourth counter) is **dropped**: it is a history figure, not something to act on, and "Show past matches" already covers it. Revisit with the manager if wanted.
- A counter whose figure is 0 is a plain card (the `PageCounters` zero rule), except the active one.
- **Definitions** reuse the existing ones: "announced" is the badge logic in `matchCardHelpers.announcedBadges`; "without a poll" is `pollBadgeFor` returning the no-poll state; "this week" is the Overview's (079) today to today + 7 days.
- **Counters follow the list's filters** (the 083 rule): League, Season, Section, Team, search and Show past matches all narrow the figures; the counter filter itself does not (the reset card stays meaningful), the same decision as 084.
- A short "Showing: Vets › Over 40" scope text under the title when a shared filter is set, as on Polls.
- The counter filter appears as a removable chip, counts in the phone Filters badge, is named in the scope text ("this week") and cleared by "Clear filters".
- Mutually exclusive: choosing one counter filter replaces another (they overlap, so combining would confuse).
- **Look (mockup boards 1 and 4):** `density="compact"`, filter kind (corner "FILTER" tag), four across from md. States: at rest (the reset card outlined), hover (lift and light primary tint), filter on (the chosen counter takes the outline and the list narrows), keyboard focus ring, zero (plain card, no tag, not a button). "Teams not announced" and "Without a poll" use the amber figure when above zero.
- **Phone (board 5):** two by two, with shortened labels ("Upcoming", "This week", "Not announced", "No poll"; the full labels stay as the accessible names). The counter filter also shows as a removable chip and, with a Clear link, as a "Quick filter" row in the Filters sheet.
- **List line:** with a counter filter on, the scope text names it ("Showing 4 matches · Teams not announced · soonest first ↕").

## Toolbar (B)

Same anatomy as the Polls page, composed from the shared components:
- **`FilterBar`** (`density="compact"`): League, Season, Section, Team, search. `FilterBar` today shows League, Section and Team; it gains an optional `seasons` slot (order League, Season, Section, Team), included in the chips, the phone badge and "Clear all". Team is new on Matches (a side's team; for the manager the easiest way to find "our U13s"). Search placeholder: "Search by opponent or team name", with the existing team-name suggestions.
- **`ContentControlsLine`**: scope text "Showing N matches" (or "N upcoming matches") on the left; "Show past matches" as a `CompactSwitch` and the date sort as a `SortLink` ("soonest first" / "latest first"). In the Filters sheet on a phone, as on Polls.
- Filter state: Section / League / Season persist per club exactly as today (042, `matchList:filters:<clubId>`); Team and the counter filter are per visit. The "Show past matches survives a round trip into a match" behaviour (`restoreShowPastOnReturn`) is kept.
- The Section / League / Season option narrowing from `filter-options` (042) is kept and extended with Team.
- Header unchanged: "Matches" title, "Add Match" action, back link when `SquadPicker` provides one. On a phone "Add Match" is full width (44 px) under the title.
- **Phone (boards 5 and 6):** one row with search and a "Filters" button whose badge counts active filters (League, Season, Section, Team, counter filter); active choices show as removable chips under it; the line above the cards shows only "Showing N matches". The sheet holds League, Season, Section and Team (44 px fields), "Show past matches", the sort link, the Quick filter row, then "Clear all" and "Done".

## Match card (C)

The card stays a `RecordCard` grid item with equal heights and a pinned footer (069). Aligned with `PollCard`:

| Area | Polls (reference) | Matches (after) |
|---|---|---|
| Avatar | Brand icon tile, `nav/availability-polls`, 48 px + 4 px padding (56 px box) | Same tile with the existing `nav/upcoming-matches` brand icon (decided in the mockup); the MUI cricket glyph is replaced. No new icon needed |
| Title | Wraps up to three lines | "Home vs Away", same wrap rule (`titleWrap`, `titleLines={3}`) |
| Badges | Row **below** the header, left-aligned | Same placement (today's match card right-aligns them above the title). Announced / Not announced (prefixed with the team name when both sides are ours), Inactive, and the poll state (Poll open / Poll closed / No poll), in the same tones. Needs a small `RecordCard` change: a badge row below the header also when `headerActions` is given |
| Subtitle (`description`) | `Section · N matches` / date · venue | `League · Season`; just the season when there is no league; hidden when neither |
| Time strip | Tinted "Poll closes" strip with pencil and live countdown; amber within 24 h | A tinted **"Starts"** strip: calendar icon, label, kickoff date and time in bold, and a `Countdown` chip ("1 day 20 h to go", `phrase="to go"`) right-aligned. Amber within 24 hours of kickoff, neutral otherwise. No pencil (the date is edited on the Edit page). For a match already played (Show past matches on) the label reads **"Played"**, the tone is neutral and there is no countdown. This is the "Match card countdown" item in `docs/roadmap.md` |
| Detail line | — | One **Venue** line below the strip (the *When* and *League* lines are gone, folded into the strip and subtitle) |
| Body | `SlotSummary` (bar, legend, "N of M answered") | A divider, the **Selection** heading, then one row per own team: name and "N of M picked", the progress bar, the "N picked · M to go" / "squad complete" legend (existing `CardProgressBar` and `pickedLegend`). Zebra rows (below). With no club side: the existing "Neither side is one of your teams…" message |
| Corner action | Delete (bin) | None (deactivate lives on the Edit page, 038) |
| Footer | Four equal columns, icon over caption | Unchanged: Edit, Select, Availability, Share; same sizing rules, never clip or wrap. With no club side Select, Availability and Share are disabled (50 % opacity, with the existing reason as the tooltip) |
| Header icons | Pencil and bin | Scoring and Watch live icon buttons stay top-right when the match has those links (075) |

- Icons: MUI outlined icons under 32 px as the Polls card uses (footer, strip, venue line, header links); the brand icon only for the avatar (CLAUDE.md icon rule). Strip icon `EventOutlined` (the poll card uses `EventBusyOutlined` for "closes"), venue `PlaceOutlined`.
- Clicking the card still opens the Match View (059/075); inner buttons stay above the stretched link.
- **Variants shown in the mockup (board 3):** derby (two own teams, team-prefixed announced badges, two Selection rows), starts within 24 hours (amber), past match (Poll closed, "Played"), no club side (disabled actions), inactive (Inactive badge), and a very long title with no league and a long venue (title wraps, subtitle shows the season only).

## Zebra rows (D)

The poll pages tint alternate rows with `lighten(theme.palette.primary.main, 0.95)` (Players grid, Responses by-player list). Matches uses the same opaque tint, the same way:
- **Inside the card:** only the **Selection team rows** alternate (first row tinted `#f5f8f6`, second plain, and so on), padded 8 px with a 6 px radius and bleeding 8 px past the card padding so the tint reads as a row. The strip, the Venue line and the footer are never tinted. A one-team match shows one tinted row (see Open Questions).
- **Any panel list** added later (not in this spec) uses the same helper.
- One shared helper (`zebraTint` is currently declared in `AvailabilityGrid.tsx` and `ResponsesByPlayer.tsx`; planning extracts it to `ui/src/utils`) so Matches does not become a third copy.

## API Contract (outline, finalised in planning)

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/matches/summary?leagueId&seasonId&sectionId&teamId&search&includePast` | `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")`, section-scoped via `AccessService.accessibleSectionIds` | `MatchesSummaryDto { matchesShown, thisWeek, teamsNotAnnounced, withoutPoll }` for exactly the list's filters |
| `GET /api/v1/manage/clubs/{clubId}/matches` | unchanged | Gains optional `teamId` and `focus=this-week\|not-announced\|no-poll` (the counter filter), case-insensitive, anything else is a 400 |
| `GET .../matches/filter-options` | unchanged | Gains `teamId` as an input |

- The summary and the list share one definition of each focus so the counters and the cards cannot disagree; `totalElements` of the list equals the matching counter for the same filters.
- Fixed query count, `openapi.yaml` additions only, per `docs/standards/backend.md` (flat record DTO, `Page` for the list unchanged).
- Whether to compute "teams not announced" and "without a poll" in SQL or from the loaded poll data is a planning decision; both must be a bounded number of statements.

## UI Requirements

- **Composed from existing components:** `PageCounters`, `FilterBar` (+ `seasons` slot), `ContentControlsLine`, `CompactSwitch`, `SortLink`, `RecordCard`, `SlotSummary`/`CardProgressBar`, `Countdown`, `BrandIcon`, `ManageScreenHeader`. New code is the match-specific wiring, the strip, and the helper extraction; no new shared component unless planning finds a near-match to extend (CLAUDE.md principle 2).
- `MatchList` is rebuilt around the hub-like state it needs (filters, counter focus, show-past); `SquadPicker` keeps working through the same props.
- Storybook: stories updated for `MatchCard` (strip tones, derby, no league, no club side) and the `FilterBar` `seasons` variant.
- Mobile first: counters two by two, the toolbar collapses behind Filters (badge and chips), footer never clips at 375 px, 2- and 3-column grid widths checked (feedback: check footers at phone, 2-column and 3-column).
- The mockup (linked in Status) is in the app's real tokens and is the reference for the build; approved by the user on 2026-10-09.

## Test Plan

Per `docs/standards/testing.md`:
- **Frontend:** `MatchList` (counters present and following filters, filter vs reset behaviour, `aria-pressed`, zero rule, chip, badge, scope text, clear, mutually exclusive focus, persistence of Section/League/Season, Team and focus not persisted, past-matches round trip); `FilterBar` with `seasons`; `MatchCard` (strip tone and countdown at 24 h and after kickoff, badges, zebra rows, equal-height footer, derby, no club side); the zebra helper; `SquadPicker` unaffected.
- **Backend:** summary endpoint (definitions, edge cases around week boundaries and announced / poll states, section-manager scoping, another club 403, statement count); list `focus` and `teamId` (counts equal counters, bad `focus` 400).
- **Contract:** `openapi.yaml` diff showing only the new endpoint and parameters.
- **Playwright smoke:** click "Teams not announced", see the cards narrow, clear it.

## Acceptance Criteria

- Matches shows the four counters (compact, filters, `aria-pressed`) with figures matching the list for the same filters.
- Selecting a counter narrows the cards, appears as a chip, in the scope text and in the phone Filters badge; "Upcoming matches" or "Clear filters" resets it.
- The Matches toolbar, chips, phone Filters sheet and "Showing N matches" line match Polls' structure and density; Season is available.
- A match card shows the `upcoming-matches` avatar tile, wrapped title, left-aligned badges under the header, `League · Season` subtitle, the "Starts" strip with countdown (amber within 24 h of kickoff; "Played" without countdown for past matches), the Venue line, Selection rows with bars, and the four pinned footer buttons at phone, 2- and 3-column widths; with no club side Select, Availability and Share are disabled.
- Selection team rows alternate with the shared zebra tint; the strip, Venue line and footer are never tinted.
- On a phone the counters sit two by two, the toolbar is search plus a Filters button with a badge, and the sheet matches the mockup.
- Section managers only see their sections' matches in both list and counters; a failed summary hides the counters and the list still works.
- `SquadPicker` still routes cards to the Playing XI tab.

## Open Questions

- Confirm dropping "Played this season" (above), or keep it as a non-clickable figure.
- Whether a one-team match should show its single Selection row tinted (as drawn), or untinted so zebra only appears with two or more rows.
- Whether "Starts" should show the countdown for matches more than a few days away (the mockup shows it always, up to "15 days 23 h to go") or only inside a window (e.g. 7 days), to avoid noise on a long fixture list.
- The countdown's exact text format ("23 h 40 min to go", "1 day 20 h to go") comes from the shared `useCountdown`; the mockup's wording is illustrative.

## Rollout Notes

Slices, each its own PR, in this order so the user can review one visible change at a time:
1. Mockup review (done, approved), then the shared pieces: zebra helper extraction, `FilterBar` `seasons` slot, and the `RecordCard` badge-row change.
2. The toolbar (B) on Matches, frontend only.
3. The match card (C) and zebra rows (D), frontend only.
4. The summary endpoint, list `focus` / `teamId`, and the counters (A).

Add a pointer in `docs/roadmap.md` (the "Counters on other pages" and "Match card countdown" items) when this is approved, and resolve those entries when it ships.
