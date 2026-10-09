# Plan: spec 087, slice 1 — shared pieces (frontend only)

## Context

Spec 087 (`docs/specs/087-matches-polls-alignment.md`, approved, PR #105) aligns Matches with the Polls pattern in four slices. Slice 1 lands the three shared pieces the later slices consume, with **no visible change on any existing page**:

1. one shared `zebraTint` helper (today declared separately in `AvailabilityGrid.tsx` and inlined in `ResponsesByPlayer.tsx`);
2. an optional **Season** slot on `FilterBar` (needed by slice 2, the Matches toolbar);
3. a `RecordCard` option that puts the badge row **below** the header, left-aligned, also when `headerActions` is given (needed by slice 3, the match card).

Nothing in the spec is reinterpreted. The spec's Rollout Notes name exactly these three items; backend, API and data are untouched. Dependencies read: 083 (FilterBar, shared filters), 085 (compact density, zebra rows), 069/075 (match card, `badgesAbove`/`headerActions`), 082 (poll card). Standards read: `CLAUDE.md`, `frontend.md`, `testing.md` (a changed shared component needs its test and story updated in the same PR).

## Findings that shape the plan

- `zebraTint` is `lighten(theme.palette.primary.main, 0.95)`: `AvailabilityGrid.tsx:72` (`const zebraTint = (theme: Theme) => ...`, used at `:341`) and inline at `ResponsesByPlayer.tsx:191`. The 0.92 active-column tint (`ResponsesByPlayer.tsx:170`) and the grid's `hoverTint` are different tokens and stay where they are.
- `FilterBar` (`components/FilterBar/FilterBar.tsx`) builds fields in `fieldsFor()` (League, Section, Team) and chips in order League, Section, Team; `activeCount = chips.length` drives the phone badge, and "Clear all" is the caller's `onClearAll`. The only consumer is `AvailabilityFilterBar` (Polls, Players, Match-day cover), which will not pass the new props, so those pages cannot change.
- `RecordCard` today: with `badgesAbove`, badges render in a right-aligned row above the header and `headerActions` sit top-right; with `cornerAction && !badgesAbove`, badges render left-aligned below the header (the poll card layout). The match card uses `badgesAbove` + `headerActions`; `LeagueCard` uses `badgesAbove`. Neither may change in this slice.

## Changes (in order)

### 1. Shared zebra helper — `frontend-builder`
- **Create** `ui/src/utils/zebraTint.ts`: `export const ZEBRA_TINT_AMOUNT = 0.95` and `export const zebraTint = (theme: Theme) => lighten(theme.palette.primary.main, ZEBRA_TINT_AMOUNT)` (opaque, never alpha — the grid's sticky cells rely on that; keep that comment).
- **Edit** `ui/src/pages/manage/playerAvailability/AvailabilityGrid.tsx`: delete the local `zebraTint`, import the shared one (usage at `:341` unchanged). Leave `hoverTint`.
- **Edit** `ui/src/pages/manage/availability/responses/ResponsesByPlayer.tsx`: replace the inline `lighten(..., 0.95)` at `:191` with `'&:nth-of-type(odd)': { bgcolor: zebraTint }`; keep the `lighten` import for the 0.92 header cell.
- Output colour is byte-identical, so no existing test or screen changes.

### 2. `FilterBar` Season slot — `frontend-builder`
- **Edit** `ui/src/components/FilterBar/FilterBar.tsx`, all additive/optional:
  - props: `seasons?: FilterBarOption[]` (callers map a Season's `label` to `name`, same shape as leagues/teams), `seasonId?: string | null`, `onSeasonChange?: (id: string | null) => void`, `seasonAllLabel?: string` (default "All seasons").
  - `fieldsFor()`: render the Season `Input select` between League and Section, same `allValueSelectProps`, "All" row as the empty value.
  - chips: push a Season chip between League and Section (label = the season's name), so the phone badge count, removable chips and `viewControls` sheet all include it; the "All" value is never a chip.
  - Desktop row order becomes League, Season, Section, Team, then Search; `AvailabilityFilterBar` passes no season props, so its output is unchanged.
- **Edit** `FilterBar.test.tsx`: Season shows in order only when passed; "All seasons" floated value; change callback; counts in the phone badge with a removable chip (removal calls `onSeasonChange(null)`); present in the sheet; absent when not passed (existing tests stay green untouched).
- **Edit** `FilterBar.stories.tsx`: add a `WithSeasons` story (and phone variant if the file already has one).

### 3. `RecordCard` badge row below the header — `frontend-builder`
- **Edit** `ui/src/components/RecordCard/RecordCard.tsx`: add `badgesBelow?: boolean` (documented: badges render in a left-aligned wrapping row under the header — the poll-card layout — and `headerActions` sit top-right; takes effect without `cornerAction`; ignored if `badgesAbove` is set).
  - header right-hand slot: `cornerAction` cluster as today; else `badgesAbove || badgesBelow` → the `headerActions` box (existing markup); else the inline badge cluster.
  - the below-header row condition `cornerAction && !badgesAbove` becomes `(cornerAction || badgesBelow) && !badgesAbove`, same markup.
  - with neither new prop used, every branch renders exactly as before.
- **Edit** `RecordCard.test.tsx`: `badgesBelow` renders the badge row after the heading, left-aligned, not beside the title and not above it; `headerActions` still render top-right and keep `position: relative` above the stretched link; without `badgesBelow`, `badgesAbove` and default layouts unchanged (existing tests at `:165`/`:188` cover those).
- **Edit** `RecordCard.stories.tsx`: add `BadgesBelowWithHeaderActions` next to `BadgesAbove`.
- `MatchCard` and `LeagueCard` are **not** edited here; the match card switches to `badgesBelow` in slice 3.

### 4. Docs — `frontend-builder`
- **Edit** `docs/standards/design-system.md`: one line each for the shared zebra tint (`utils/zebraTint`), the `FilterBar` Season slot, and `RecordCard`'s `badgesBelow`, in the sections that already describe `FilterBar` (line ~54) and `RecordCard`. No new standards, only the new options.

### 5. Tests — `test-writer`
- New `ui/src/utils/zebraTint.test.ts`: returns `lighten(primary, 0.95)` for the base theme and for a club-branded theme (`withClubBranding`), and is opaque (no alpha).
- Fill any gaps in the FilterBar and RecordCard tests above (the component tier is "one critical interaction per shared component", so keep them small).

## Reused code (no new components)
`lighten` from `@mui/material`; `FilterBarOption`, `allValueSelectProps`, `Input`, `compactFieldsSx` already in `FilterBar.tsx`; `badgeChips`/existing below-header `Stack` in `RecordCard.tsx`; `withClubBranding` from `ui/src/theme.ts` in the helper test. No component folders are added, so the four-file anatomy rule is not triggered.

## Verification
Run in `ui/` with `nvm use 22.12.0` first (plain `node` is v12 on this machine); do not run Maven.
- `npm run lint` and `npm run typecheck` (or `tsc -b`); dependency-cruiser rule (`components/**` must not import `pages/**`: the helper lives in `utils/`, imported by both).
- `npx vitest run` for: `utils/zebraTint.test.ts`, `components/FilterBar`, `components/RecordCard`, `pages/manage/playerAvailability` (AvailabilityGrid), `pages/manage/availability/responses`, `pages/manage/matches/MatchCard.test.tsx`, `pages/manage/leagues` — then the whole suite once.
- Storybook: the new `FilterBar` and `RecordCard` stories render (build or run Storybook; not run in earlier slices, so flag it if skipped).
- Manual regression look at the Availability Polls, Players and Responses-by-player pages and the Matches and Leagues lists: nothing should look different.
- Branch from `master` after PR #105 merges (or stack on `docs/087-matches-polls-alignment`); one PR for this slice; Conventional Commits, e.g. `refactor(ui): shared zebra tint helper (087)`, `feat(ui): FilterBar season slot (087)`, `feat(ui): RecordCard badgesBelow (087)`.

## After approval
Copy this plan verbatim to `docs/plans/087-matches-polls-alignment.md` (same number as the spec; later slices extend the file) and commit it with the docs.

## Not in this slice (stays with slices 2–4)
Matches toolbar, `ContentControlsLine` on Matches, the match card rebuild and its zebra rows, counters, and all backend work.

---

# Slice 2 — Matches toolbar (frontend only)

*Added when the slice was built (the user was away and asked for the build to go ahead; no new contract, everything is fixed by the spec's Toolbar (B) section).*

## Deviations to note
- **Team field deferred to slice 4.** The spec lists Team on the Matches toolbar, but the list's `teamId` is backend work in slice 4 and `docs/standards/frontend.md` forbids client-side filtering of a paginated list. The slice ships League, Season, Section and search; the Team field, chip and its `filter-options` input arrive with the counters slice.
- **`FilterBar` gains `searchOptions`** (a `freeSolo` Autocomplete, same as `ListToolbar`'s) so Matches keeps its team-name search suggestions.

## Changes
- `ui/src/components/FilterBar/FilterBar.tsx`, `.test.tsx`, `.stories.tsx`: optional `searchOptions`; plain input unchanged without it.
- `ui/src/pages/manage/MatchList.tsx`: `ListToolbar` replaced by `FilterBar` (`density="compact"`: `leagues`, `seasons` mapped from `label`, `sections`, search with suggestions); `ContentControlsLine` with "Showing N upcoming matches / matches", `SortLink` and a `CompactSwitch` for Show past matches (both in the `FilterBar` sheet on a phone); `ManageScreenHeader` `subtitle` "Showing: <section> · <league> · <season>". Persistence of Section/League/Season, the past-matches round trip, filter-options narrowing and pagination are untouched.
- `ui/src/pages/manage/MatchList.test.tsx`: sort-link assertion, content-line text, scope subtitle and a phone test; every existing assertion kept.
- `SquadPicker` reuses `MatchList` and inherits the toolbar unchanged in behaviour.

## Verification
`tsc -b` clean; lint warnings only (pre-existing `only-export-components`); `MatchList` (31), `FilterBar`, `SquadPicker`, availability and Players tests pass; Storybook `FilterBar` stories pass (8). Not checked in a browser: the compact Autocomplete search field height (36 px) and the phone sheet.

---

# Slice 3 — Match card and zebra rows (frontend only)

*Built while the user was away, on the same branch as slices 1 and 2; contract fixed by the spec's Match card (C) and Zebra rows (D) sections.*

## Changes
- **New shared component `ui/src/components/CardTimeStrip`** (four-file anatomy): the tinted strip (icon, label, bold value, optional `action`, right-aligned `trailing`; `neutral` / `warning` tone), extracted from `PollCard` rather than copied, per the reuse rule. `PollCard` now renders it with the same `data-testid="poll-closes-row"` / `data-tone`, so its existing tests are the regression check.
- `ui/src/pages/manage/matches/MatchCard.tsx`: `BrandIcon name="nav/upcoming-matches"` avatar; `badgesBelow` (slice 1) instead of `badgesAbove`; `titleLines={3}`; `League · Season` as the `description`; `CardTimeStrip` "Starts" with `Countdown phrase="to go"` (amber within 24 h via `useCountdown`; "Played", neutral and no countdown once the start has passed); the `When` and `League` detail lines removed, `Venue` kept. Footer, header links, disabled states and the Selection block are unchanged.
- `ui/src/pages/manage/matches/SelectionBlock.tsx`: the team rows alternate with `zebraTint` (first row tinted), 8 px padding with a matching negative margin so the text stays aligned.
- Tests: `CardTimeStrip.test.tsx`; `MatchCard.test.tsx` (badges row, brand tile, subtitle and Venue, three strip states); `SelectionBlock.test.tsx` (zebra, single row). Stories: `CardTimeStrip.stories.tsx`, new `matches/MatchCard.stories.tsx` (seven variants).
- Docs: `design-system.md` row for `CardTimeStrip`; the roadmap's "Match card countdown" item is struck through.

## Notes
- "Played" is shown as soon as the start time passes, so a match in progress (or a multi-day match) reads "Played"; the spec says "Played", so this follows it. Worth a look if long-format matches matter.
- Not checked in a browser: the card's visual rhythm (strip, venue line, zebra padding) at phone, 2- and 3-column widths.

---

# Slice 4 — Matches counters, Team filter and backend (full stack)

*The plan below was approved by the user on 2026-10-09 and is recorded verbatim. Built afterwards; deviations are listed at the end.*

## Context

Spec 087 (`docs/specs/087-matches-polls-alignment.md`, approved) closes with slice 4: the four clickable quick-filter counters under the Matches header, the Team filter (moved here from slice 2 because its backend parameter is this slice's work), and the backend that makes both honest. Slices 1–3 (shared pieces, toolbar, match card) are built on `feat/087-slice-1-shared-pieces`; the user has reviewed cards and toolbar and approved continuing. This slice must reuse that branch (one place to review) and follow the spec's API Contract outline without redefining it.

## Decisions to confirm (spec wording that needs a concrete reading)

1. **Summary parameter name.** The spec fixes `…/matches/summary?leagueId&seasonId&sectionId&teamId&search&includePast`. The list and filter-options use `upcomingOnly` (the inverse). I follow the spec (`includePast`) and map it to the same upcoming rule inside the service.
2. **Which matches the three attention counters and their filters count.** Spec definitions: *This week* = today to today + 7 days (the Overview's rule, `ServerClock.startOfToday()` to `startOfDayFromToday(7)`, half-open); *Teams not announced* = matches with at least one own side not announced; *Without a poll* = **upcoming** matches with an own side and no poll. I read all three as **active, upcoming matches only** (an inactive or past match is not "something to do"), matching the Overview (`active()` + `matchDateOnOrAfter(startOfToday)`). The reset card ("Upcoming matches" / "Matches shown") is the list's own total and does include inactive/past per the filters.
3. **Own side for restricted callers** mirrors the Overview: an own-club side counts only if its team's section is one the caller administers (`Optional<Set<UUID>>` from `AccessService.accessibleSectionIds`); unrestricted callers count every own-club side.
4. **`SquadPicker` reuses `MatchList`** and so shows the counters too (they filter the same list). Say if it should not.
5. Counter figures follow League, Season, Section, Team, search and Show past matches; the counter filter itself does not narrow the figures (spec, same as 084).

Nothing else from the spec is reinterpreted (no entity change, no new table, no migration).

## Backend — `backend-builder`

All under `backend/src/main/java/com/cricketlegend/`.

1. **`domain/MatchListFocus`** (new enum `THIS_WEEK`, `NOT_ANNOUNCED`, `NO_POLL`): `parse(String)` accepts `this-week|not-announced|no-poll`, any case; blank/null → `null` for the list (no focus); anything else → `ValidationException` (400), same shape as `AvailabilitySummaryPlayerKind.parse`.
2. **`repository/MatchSpecifications`** (extend, small single-purpose methods; no new abstraction):
   - `forList(...)` gains an overload with `UUID teamId` (existing signature delegates with `null`, so the Overview and player-availability callers are untouched); `teamId` reuses the existing `teamIdEquals` (home or away).
   - `thisWeek(start, end)` = existing `matchDateOnOrAfter` + `matchDateBefore`.
   - `hasUnannouncedOwnSide(clubId, Optional<Set<UUID>> sections)` and `hasOwnSideWithoutPoll(clubId, sections)`: correlated `Subquery`s — own side = home or away team id in a `Team` subquery with `clubId` (and `sectionId in` sections when restricted); announced = a `MatchSide` row for (match, team) with `announced = true`; poll = a `SectionAvailabilityWindowMatch` row for the match (group beats squad) or a `MatchAvailabilityPoll` row for the match whose `teamId` is the home or away team (open or closed both count, exactly `pollBadgeFor`'s "none" rule).
   - `focus(MatchListFocus, clubId, sections, now…)` composes the above with `active()` and the upcoming/week window, so list and summary share one definition (spec: "share one definition").
3. **`service/MatchService` + `MatchServiceImpl`**:
   - `list(...)` gains `UUID teamId, MatchListFocus focus`; the spec composes with the existing `buildMatchSpecification`.
   - `filterOptions(...)` gains `UUID teamId`: the section/league/season arrays apply it; `teamIds` is computed ignoring the caller's own team pick (the own-dimension rule already used for the others), so it can feed both the Team dropdown and the search suggestions.
   - new `summary(authentication, clubId, sectionId, leagueId, seasonId, teamId, search, includePast)` returning `MatchesSummaryDto`: four `matchRepository.count(spec)` calls (shown = `forList` with the upcoming rule unless `includePast`; each focus = same spec `.and(focus)`), reusing `resolveAuthorizedSectionIds`. A restricted caller with no sections returns zeros. `@Transactional(readOnly = true)`.
4. **`dto/MatchesSummaryDto`** (new flat record: `matchesShown, thisWeek, teamsNotAnnounced, withoutPoll`).
5. **`controller/MatchController`**: list gets `teamId` and `focus` (String → `MatchListFocus.parse`); filter-options gets `teamId`; new `GET /api/v1/manage/clubs/{clubId}/matches/summary`, `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")`. Declared before `/matches/{matchId}`-style mappings are unaffected (literal path wins).
6. **`backend/openapi/openapi.yaml`**: additions only — the new path and schema, `teamId` and `focus` on `/matches`, `teamId` on `/matches/filter-options`. Written by hand (see Verification).

## Frontend — `frontend-builder`

All under `ui/src/`.

1. **`api/matchApi.ts`**: `ListMatchesParams` + `teamId`, `focus`; `listMatchFilterOptions` + `teamId`; `MatchesSummary` type, `MatchListFocus` type, `getMatchesSummary(clubId, filters)` and a key `['managed-club', clubId, 'matches', 'summary', filters]` — under the existing `matches` prefix, so the invalidations that already refresh the list (poll changes, match edits) refresh the counters too.
2. **`components/PageCounters`**: optional `shortLabel` on `PageCounterItem`; below `sm` (`useMediaQuery`, as `FilterBar`) the short text shows and the button's accessible name stays the full label. Test + story updated. (Needed for the spec's phone labels "Upcoming / This week / Not announced / No poll".)
3. **`pages/manage/MatchList.tsx`**:
   - state: `teamId` and `focus` (`'this-week' | 'not-announced' | 'no-poll' | null`), both per visit (not persisted, not in `matchList:filters:<clubId>`); both reset `page` to 0 and join the list, filter-options and summary query keys.
   - summary query (fixed filters = exactly those the list sends, plus `includePast = !upcomingOnly`), `retry: false`; a failed summary hides the row and the list still works.
   - `PageCounters density="compact"` with the four items: reset card (`Upcoming matches` / `Matches shown`, active when no focus, `onSelect` clears focus), then the three focus counters (`kind: 'filter'`, `active` when chosen, click toggles; amber tone when above zero for *Teams not announced* and *Without a poll*); labels, hints and short labels per the spec.
   - `FilterBar`: `teams` (the club's teams narrowed to `filterOptions.teamIds`), `teamId`, `onTeamChange`, `teamAllLabel`; `extraChips` gets the focus chip (removable); `viewControls` gains the phone-sheet **Quick filter** row ("Quick filter: <name>" with a Clear link); `onClearAll` also clears team and focus.
   - content line and scope: `Showing N matches · <focus name>` (focus text added to the `ContentControlsLine` scope); header subtitle includes the team name via `scopeFilterText`.
4. Docs: `design-system.md` (PageCounters `shortLabel`; Matches counters note), `frontend.md` list-screen note that Matches now uses `FilterBar` + `PageCounters`, roadmap entry "Counters on other pages" updated (Matches done; Players remains), plan file extended.

## Tests — `test-writer` (after the builders)

Backend (JUnit 5 + Testcontainers via `AbstractIntegrationTest`, per `docs/standards/testing.md`):
- unit: `MatchListFocusTest` (parse cases, 400); `MatchServiceImplTest` additions (summary composes the right specs, restricted/empty-section caller → zeros, `includePast`).
- repository (`MatchRepositoryTest`): each new specification against real Postgres — week boundaries (start inclusive, end exclusive, local-midnight), inactive and past excluded, announced/unannounced incl. a derby with one side announced, a free-text or other-club side (not "own"), group-link poll, squad poll (open and closed) vs none, restricted-section own-side rule, `teamId` home and away.
- controller integration (`MatchControllerIntegrationTest`): summary 200 shape, another club 403, section-manager scoping, bad `focus` 400, list `focus`/`teamId`, filter-options `teamId`.
- parity: list `totalElements` equals the matching counter for each focus under the same filters (the 084 parity test is the model).
- query-count guard: summary statement count is fixed regardless of data size (model: the availability summary query-count test).
Frontend (Vitest): `MatchList.test.tsx` (counters render from the summary; choosing a counter sends `focus` and shows the chip, scope text and phone badge; second click and the reset card clear it; focus counters mutually exclusive; zero counters are plain cards; Team field sends `teamId`; Clear all clears team and focus; neither is persisted; failed summary hides counters but not the list; phone Quick filter row), `matchApi` param mapping, `PageCounters` `shortLabel` test.

## Reused code
`MatchSpecifications.forList/active/matchDateOnOrAfter/matchDateBefore/teamIdEquals/sectionIn`; `ServerClock.startOfToday/startOfDayFromToday`; `MatchServiceImpl.resolveAuthorizedSectionIds`; `AccessService.accessibleSectionIds`; `MatchPollCoverageServiceImpl`'s coverage rule (group link beats squad) and `ManagerOverviewServiceImpl`'s own-side rule as the reference definitions; `AvailabilitySummaryPlayerKind.parse` shape; frontend `PageCounters`, `FilterBar` (`teams`, `extraChips`, `viewControls`), `scopeFilterText`, `ContentControlsLine`.

## Verification
- **Backend:** do not run Maven in `backend/` while the IntelliJ-run app is live (it crashes it). `rsync` the repo to a scratch copy under the session scratchpad and run there: `./mvnw -q test -Dtest='MatchRepositoryTest,MatchServiceImplTest,MatchListFocusTest,MatchControllerIntegrationTest,*Parity*,*QueryCount*'`, then the ArchUnit suite and the full backend test run once; also run the OpenAPI contract check there. `openapi.yaml` is edited by hand in the real tree, then copied into the scratch run to confirm the contract test and diff show additions only.
- **Frontend:** `nvm use 22.12.0`; `npx tsc -b`, `npm run lint`, `npx vitest run --project=unit --maxWorkers=2` (full-parallel runs time out on the form tests; known flake), Storybook project for `PageCounters`.
- Manual (needs the user at their PC): Matches page with real data — each counter figure equals the number of cards after clicking it; the phone Filters sheet.
- Commits: backend (domain/spec/service/controller), openapi, frontend (api, PageCounters, MatchList), docs; Conventional Commits with `(087 slice 4)`.

## After approval
Append this plan to `docs/plans/087-matches-polls-alignment.md` (same spec number) as "Slice 4" and commit it with the docs.

## Not in this slice
Players counters and anything outside Matches; a drill-down panel for Matches counters (spec Non-goal); "Played this season".

## Built differently from the plan
- `MatchList` now passes `placeholderData: keepPreviousData` on the list and summary queries, so a counter click or filter change keeps the toolbar and counters mounted (and the search field focused) instead of blanking the screen while the next page loads. This is a small behaviour improvement beyond the plan.
- The slice-4 backend tests ended up in a new `MatchesSummaryIntegrationTest` (HTTP, real Postgres, parity over 7 filter combinations, scoping, 403, 400, `teamId`), `MatchesSummaryQueryCountIntegrationTest` and `MatchListFocusTest`, plus additions to `MatchRepositoryTest` and `MatchServiceImplTest`, rather than extending `MatchControllerIntegrationTest`.
- No automated OpenAPI contract check exists in CI or the build; `backend/openapi/openapi.yaml` was edited by hand (91 lines added, none removed) and the YAML parses.

