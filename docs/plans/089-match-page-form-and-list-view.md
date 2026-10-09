# Plan: spec 089 — the match page, the compact Add/Edit match form and the Matches list view (frontend only)

## Context

Spec 089 (`docs/specs/089-match-page-form-and-list-view.md`, mockups approved by the user 2026-10-09: "Mockups look amazing") redesigns three Matches screens the user called bloated or horrible: the **match page** (A), the **Add / Edit match form** (B) and a **Cards | List view** (C). All frontend; no endpoint, DTO or migration changes. Everything lands on `feat/087-slice-1-shared-pieces` (PR #106), three slices, one commit group each.

## Findings that shape the plan

- **The page already loads everything the new strip needs** (`MatchDetailPage.tsx`: match, own sides, squads, polls, coverage, leagues, seasons). The Starts tile reuses `useCountdown` / `Countdown` (the card's rule: amber within 24 h, "Played" after) and `formatMatchDateTime`; the League tile reuses `matchLeagueValue`; badges reuse `announcedBadge`, `badgeFor`, `pollBadgeFor`.
- **Poll close time is not on `MatchPoll`** (only `open`). Squad polls (`listPolls` → `scheduledCloseAt`) have it; group polls do not. **Flag, my reading:** the Poll tile's value is Open / Closed / None; its caption is "Closes <when>" only when exactly one open squad poll has `scheduledCloseAt`, otherwise "n polls" or "No poll yet". No new data is fetched.
- **The form is a `display: contents` fragment inside `RecordFormScreen`'s two-column grid.** Its footer (Save, the Active toggle on edit, the error text) lives in `MatchFormPage` and the form is submitted by `form={MATCH_FORM_ID}`. I keep `RecordFormScreen`, the page's title text ("Add Match" / "Edit Match", which the tests assert), tabs and footer, and give the `MatchForm` fragment one full-width child that lays out its own headings, 3-column grid and two side panels.
- **The three-way toggle is a MUI `ToggleButtonGroup`** (`MatchSideFields.tsx`). `ListViewToggle` already holds the compact tinted style as private sx. The side switch is the second consumer, so as the spec says I extract a shared **`CompactToggleGroup`** and move `ListViewToggle` onto it (no visual change there).
- **Existing tests assert helper text** (`MatchForm.test.tsx`: the scoring/streaming helper strings; "Choose a league and season first…" twice, once per side). Spec B removes helper text and shows one hint, so those assertions change by design, not weakened: the labels gain "(optional)", the hint appears once.
- **`MatchList` is also used by `SquadPicker` with `viewTo={null}`** (rows must not link). The table takes `viewTo` as optional and renders an unlinked row; `SquadPicker` keeps whichever view the page preference gives, so I pass the preference key but allow a `listView={false}` opt-out only if its tests need it (decide while building; default: it follows the same rules).
- Players' `PlayerTable` is the model for the table (sticky clipped header, zebra via `zebraTint`, stretched link, `data-desktop-only` for tests, `useListViewPreference`, `ListViewToggle` in `FilterBar`'s `viewControls` for the phone sheet and `ContentControlsLine` on desktop).

## Decisions to confirm

1. The Poll tile caption rule above.
2. The Edit page keeps `RecordFormScreen`'s own card; the "Match details" and "Teams" icon-tile headings live inside it (the mockup's separate card is the same card). Cancel is added to the footer (a link back to Matches; on edit, back to the match).
3. Selection column in the table: for a derby (two own sides) it shows the first own side's bar and "a/b" for both ("10/12 · 8/12" on desktop, "10/12" on the phone, as the mockup). The card already shows both rows.
4. Preference key `matchList:view`, one per page (as 088; spec Open Question stays open).

## Slice 1 — match page (`frontend-builder`, then `test-writer`)

New under `ui/src/pages/manage/matchDetail/`: `MatchKeyFigures.tsx` (four tiles: Starts, Venue, League, Poll; props are plain values so it is testable alone) and `MatchTeamCard.tsx` (the redesigned `TeamCard`: solid-green icon-tile heading, announced chip, "n of m picked · k to go" with `CardProgressBar`, the existing `PlayingXiSummary` restyled with 44 px zebra rows). The key-figure tile markup is the same as `PlayerKeyFigures`; extract a shared `KeyFigureTile` (`ui/src/components/KeyFigureTile/`, with a story) and make `PlayerKeyFigures` use it, rather than copy it.
Edit `pages/manage/MatchDetailPage.tsx`: header (64/52 px logo tiles, vs, 1.75/1.4 rem title, badges under it, Scoring and Watch live outlined on the right, **Edit** filled primary), action row (Select team, Availability, Share team sheet; same disabled rules and reason; on a phone Select team + Edit halves, then Availability + Share), the strip, the team cards; remove the old header details line. `PlayingXiSummary.tsx` gets a `zebra` row style (compact variant) used here only; its other callers stay unchanged.
Tests: update `MatchDetailPage.test.tsx` to the new markup (every existing behaviour kept: badges, actions and reasons, own-side cards, empty selection, share, availability menu); new `MatchKeyFigures.test.tsx`, `MatchTeamCard.test.tsx`, `KeyFigureTile.test.tsx`; stories for the strip and tile.

## Slice 2 — compact form (`frontend-builder`, then `test-writer`)

- `ui/src/components/CompactToggleGroup/` (new, with story and test): the compact tinted `ToggleButtonGroup` (28 px desktop; `fullWidth` 40 px) extracted from `ListViewToggle`; `ListViewToggle.tsx` becomes a thin user of it.
- `components/MatchForm/MatchSideFields.tsx`: a bordered panel with the side name and `CompactToggleGroup` (My team | League team | Other; "League" on a phone; same `aria-label`s and values), then only the field(s) the mode needs; drop its own per-side "Choose a league…" caption.
- `components/MatchForm/MatchForm.tsx`: one full-width layout box: "Match details" icon-tile heading, 3-column grid (1 on a phone) of Season, League, Date & time, Venue, Scoring link, Streaming link with "(optional)" labels and placeholders instead of helper text (validation errors still show), a "Teams" heading with the two panels side by side, the single hint line (when league teams are unavailable) and the existing "league/season changed" alert. Payload, validation and `MATCH_FORM_ID` unchanged.
- `pages/manage/MatchFormPage.tsx`: Cancel added to the footer; Details tab gets the new look; Home XI / Away XI tabs only pick up the tighter spacing (their content untouched).
- Tests: `MatchForm.test.tsx` (labels, side modes and their fields, league team disabled without scope, hint shown once, validation unchanged, payloads unchanged), `MatchFormPage.test.tsx` (Cancel, tabs), `CompactToggleGroup.test.tsx`; `ListViewToggle` tests must still pass untouched; update `MatchForm.stories.tsx`.

## Slice 3 — list view (`frontend-builder`, then `test-writer`)

- `ui/src/pages/manage/matches/MatchTable.tsx` (+ story, test; moved from components/ because it needs the card helpers): props `matches`, `teamsById`, `leaguesById`, `seasonsById`, `viewTo?`. Desktop columns When (date, time, countdown, amber within 24 h via `useCountdown`) | Match (logo, "Home vs Away", "League · Season") | Selection (mini bar + a/b via `selectionRows`) | Announced chip | Poll chip (`announcedBadges`, `pollBadgeFor`, `badgeSx`) | chevron; phone: Match (names, time and countdown under it), Picked, chevron. Zebra, sticky header, stretched link over the row (no link when `viewTo` is absent).
- `pages/manage/MatchList.tsx`: `useListViewPreference('matchList:view')`; `ListViewToggle` in `ContentControlsLine`'s controls and, with `fullWidth`, in `FilterBar`'s `viewControls`; render `MatchTable` when `view === 'list'`, else the existing cards; counters, filters, sort, past switch, paging, empty states unchanged.
- Tests: `MatchTable.test.tsx` (columns, amber tone, derby selection, unlinked row, desktop-only cells via `data-desktop-only`), `MatchList.test.tsx` (switch, remembered preference across remount, rows open the match, counters and filters apply, `mockReset` in `beforeEach`), `SquadPicker` test still green.

## Docs (in the last commit)

`docs/standards/design-system.md`: extend the "Record detail page" paragraph to match pages, note the compact form density and `CompactToggleGroup`; `docs/standards/frontend.md` list-view standard mentions `MatchTable`; spec 089 status line (built, awaiting browser check); `docs/roadmap.md`: remove Matches from the "List view for Matches and Polls" item (Polls stays); copy this plan to `docs/plans/089-match-page-form-and-list-view.md`.

## Order and commits

1. `KeyFigureTile` + `PlayerKeyFigures` refactor (commit). 2. Slice 1: strip, team card, page (+ tests, commit). 3. `CompactToggleGroup` + `ListViewToggle` (commit). 4. Slice 2: side switch, form, page footer (+ tests, commit). 5. Slice 3: `MatchTable`, `MatchList` (+ tests, commit). 6. Docs (commit). Conventional commits tagged `(089)`; push to PR #106 only when the user says so.

## Verification

- `source ~/.nvm/nvm.sh; nvm use 22.12.0` in `ui/`: `npx tsc -b`, `npm run lint` (no errors), `npx vitest run --project=unit --maxWorkers=2` (full run, nothing else running at the same time), the changed stories (`--project=storybook`): `KeyFigureTile`, `CompactToggleGroup`, `MatchTable`, `MatchKeyFigures`, `ListViewToggle`, `MatchForm`.
- Manual (the user, backend running): the match page at desktop and phone widths against boards 1 and 2 (countdown amber within 24 h, actions disabled with the reason when no own team, Scoring/Watch live only when set); the form against boards 3 and 4 (fits one desktop screen, switch looks like Cards | List, League team disabled until league and season, validation and Create/Save still work, Edit tabs); the list against boards 5 and 6 (switch remembered after reload, rows open the match, counters and filters apply, squad picker still works).

## Not in this plan

Backend, new data, results or scores, a redesign of the Playing XI picker tabs, the Polls list view, a shared view preference across pages.
