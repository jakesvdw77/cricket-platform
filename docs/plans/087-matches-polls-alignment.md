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

