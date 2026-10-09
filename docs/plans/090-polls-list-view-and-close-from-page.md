# Plan: spec 090 — Close / Reopen on the poll page, and the Polls list view (frontend only)

## Context

Spec 090 (`docs/specs/090-polls-list-view-and-close-from-page.md`, mockups approved by the user 2026-10-09: "Ok great, lets go") adds two things. **B:** the squad and group poll pages (Responses) get **Close poll** / **Reopen poll** in the header, because in a list view the only way to close a poll today (the card's footer) is gone. **A:** the Availability hub's Polls view gets a Cards | List switch with a zebra `PollTable`, built like `PlayerTable` / `MatchTable`. All frontend; no endpoint, DTO or migration change. Work stays on `feat/087-slice-1-shared-pieces` (PR #106), two slices (B first, as the table's rows depend on the page having Close).

## Findings that shape the plan

- **Close and Reopen logic lives inside `PollCard`** (`closeMutation`: `closeRound` / `closePoll`, then `onChanged()`; a `ConfirmDialog` with `closePollTitle()` / `closePollDescription(autoClose)`; Reopen opens `EditCloseTimeDialog` with `reopen`, disabled with `REOPEN_PAST_REASON` when `canReopen` is false). The two poll pages already own an `EditCloseTimeDialog` (opened by the pencil) but no close action. To keep the card and the two pages from drifting (spec UI Requirements) I extract the close half into one hook, `usePollClose`, and make `PollCard` use it too.
- **The poll pages' data** (`SquadPollResponsesPage`: `pollsKey`, `responsesKey`, matches/teams; `GroupPollResponsesPage`: `roundsKey`, `responsesKey`) are refreshed by `invalidateQueries` on those keys plus `['managed-club', clubId, 'availability-polls']` and `invalidateAvailabilityCounters` (as their override mutation does). After Close the page must refetch so the chip, Share invite and Reopen state flip; `EditCloseTimeDialog` already invalidates its own set on save, so Reopen needs no extra wiring.
- **One row shape already exists for the table:** `PollPanelRow` (`pollPanelRows.ts`: kind, title, open, autoClose, scheduledCloseAt, answered, total, bestSlot, path) with the builders `squadPollRow(poll, open, teamsById)` / `groupPollRow(round)` and `answeredText`. The dashboard already builds them for the polls panel. `PollTable` takes `PollPanelRow[]`, so the table, the panel and the counters can never disagree. It lacks only the line under the title ("Squad poll · Home · Thu 15 Oct" / "Group poll · Vets"), so the builders gain an optional `subtitle` field (the panel ignores it).
- **Order:** the spec says rows follow the card order; the dashboard's `visibleItems` is already searched and sorted (match date, ascending or descending), so I build the table rows from `visibleItems`, not from the panel's own sort.
- **The dashboard is the only list** (`AvailabilityPollsDashboard.tsx`); its toolbar (`AvailabilityFilterBar` with `viewControls`) and `ContentControlsLine` carry the type switches and Show closed, so the Cards | List switch goes in the same two places as on Players and Matches (`ContentControlsLine` controls; first control in the sheet, `fullWidth`).
- **Closes column:** open with auto-close and a scheduled close: the date (`closesRow(...).value`) in bold and a live countdown under it (`useCountdown`, amber within 24 hours, like `MatchTable`); open without auto-close: "Closes manually" and "No auto-close"; closed: "Closed <date>" / "Closed manually" (`closesRowText`).
- Layering: `PollTable` sits next to `PollCard` under `pages/manage/availability/` (it needs the page's helpers), not in `components/`.

## Decisions to confirm (readings; the spec fixes the behaviour)

1. `PollTable` consumes `PollPanelRow[]` with a new optional `subtitle` (rather than the dashboard's local item type).
2. Close poll is `variant="outlined"` with the lock icon beside Open match / Share invite (the mockup); on a phone the header actions wrap, no new layout.
3. Persistence key `pollList:view`, one per page (as 088 and 089).

## Slice 1 — Close / Reopen on the poll page (`frontend-builder`, then `test-writer`)

- **New** `pages/manage/availability/usePollClose.tsx`: `usePollClose({ clubId, target: {kind:'SQUAD', matchId, pollId} | {kind:'GROUP', roundId}, autoClose, onChanged })` → `{ requestClose, closing, closeError, confirmDialog }` (the `useMutation` calling `closePoll` / `closeRound`, the `ConfirmDialog` with `closePollTitle` / `closePollDescription`). Pattern: `usePlayerStatusActions`.
- `PollCard.tsx`: swap its own `closeOpen` / `closeMutation` / `ConfirmDialog` for the hook (behaviour and tests unchanged).
- `SquadPollResponsesPage.tsx` and `GroupPollResponsesPage.tsx`: in `headerAction`, add **Close poll** (open) or **Reopen poll** (closed; opens the page's existing `EditCloseTimeDialog` with `reopen`; `disabled` with `REOPEN_PAST_REASON` as `title` / `aria-label` when `canReopen` is false), using the hook; `onChanged` invalidates the page's keys, `['managed-club', clubId, 'availability-polls']`, `['managed-club', clubId, 'section-availability-rounds']` and `invalidateAvailabilityCounters`; a failed close shows the existing error text style. The pencil stays.
- Tests: new `usePollClose.test.tsx`; `SquadPollResponsesPage.test.tsx` and `GroupPollResponsesPage.test.tsx` (Close poll opens the confirmation, Cancel does nothing, Confirm calls the right request and the page shows Closed; Reopen poll opens the close-time dialog; disabled with the reason when `canReopen` false; not shown as Close once closed); `PollCard.test.tsx` must pass unchanged.
- Commit.

## Slice 2 — list view (`frontend-builder`, then `test-writer`)

- `pollPanelRows.ts`: optional `subtitle` on `PollPanelRow`, set by `squadPollRow` (`Squad poll · Home|Away · <short match date>`) and `groupPollRow` (`Group poll · <section>`); extend `pollPanelRows.test.ts`.
- **New** `pages/manage/availability/PollTable.tsx` (+ story, test): props `rows: PollPanelRow[]`. Desktop: Poll (title, subtitle) | Type chip | Status chip | Closes | Answered (small bar + `answeredText`-style "10 of 14", best slot) | chevron; phone: Poll (title, Type and Status chips, closes line) | Answered ("10/14") | chevron. Zebra via `zebraTint`, sticky clipped header, whole-row stretched `RouterLink` to `row.path`, `data-desktop-only` marks, `badgeSx` tones (`squadPoll` / `groupPoll`, `open` / `closed`), amber when closing within 24 hours.
- `AvailabilityPollsDashboard.tsx`: `useListViewPreference('pollList:view')`; `ListViewToggle` in `ContentControlsLine` controls and, `fullWidth`, first in the `viewControls` sheet; build `visibleRows` from `visibleItems` (same builders as `panelRows`) and render `PollTable` when `view === 'list'`, else the cards; counters, filters, search, switches, sort, empty states unchanged.
- Tests: `PollTable.test.tsx` (columns, chips, amber within 24 h via fake timers, manual close, closed text, best slot, row link, desktop-only cells); `AvailabilityPollsDashboard.test.tsx` (switch, remembered preference across remount, rows open the poll, filters/search/closed apply to the table); `PollTable.stories.tsx`.
- Commit.

## Docs (last commit)

`docs/standards/frontend.md`: list-view paragraph names `PollTable` and `pollList:view`; `docs/standards/design-system.md` unchanged (no new pattern); `docs/roadmap.md`: remove the Polls list-view item; spec 090 status line (built, awaiting the user's browser check, with the readings above); this plan to `docs/plans/090-polls-list-view-and-close-from-page.md`.

## Verification

- `source ~/.nvm/nvm.sh; nvm use 22.12.0` in `ui/`: `npx tsc -b`, `npm run lint` (no errors), `npx vitest run --project=unit --maxWorkers=2` (full run, nothing else running), `npx vitest run --project=storybook` for `PollTable` and `PollCard` (rerun once if the first run shows the transient `useContext null` error).
- Manual (the user, backend running): close an open squad poll and a group poll from their pages (confirmation, then Closed chip, Share disabled, Reopen poll shown; Reopen opens the close-time dialog; disabled with the reason when the matches have passed); counters and the cards agree afterwards; the Polls list: switch, reload keeps it, rows open the poll, filters/search/Show closed apply, phone width.

## Not in this plan

Backend work, row actions in the table (Close and friends stay on the card and, for Close and Reopen, the poll page), Delete on the poll page, changes to counters, panel or the other hub views.
