# Plan: match page header revision (spec 089 A, revised) and Delete / Edit description on the poll pages (spec 090 B, extended) — frontend only

## Context

After the user's browser check of the built pages, two follow-ups were agreed (mockups approved 2026-10-09; both specs updated in `04b132f`):
- **Spec 089 A (revised):** the match page header looks like the poll page: Back on the left and **Scoring / Watch live / Edit** on the right of the top row; **Select team / Availability / Share team sheet** right-aligned beside the title; **no header badges** (only Inactive when it applies); **a logo beside each team name that has one** in the title instead of the IRV-vs-PO tile pair; and the team cards show selection as a poll-style gauge (bar + "● 10 Picked  ● 2 To go").
- **Spec 090 B (extended):** on the squad and group poll pages, **Delete poll** (red outlined) and, for a group poll, an **Edit description** pencil after the title, because in the list view the card's Delete and pencil are out of reach.
All on `feat/087-slice-1-shared-pieces` (PR #106). No backend, endpoint or data changes.

## Findings that shape the plan

- **Match header** is `MatchDetailPage.tsx` (the `MatchView` return, lines ~250–380 plus `logoFor` / `TeamLogo`). It currently has: a `PageHeaderBand` `Stack` with the Back button, a title row (a logo pair, the `h1`, the badges group `aria-label="Match badges"`, and on desktop `match-header-links` with Scoring, Watch live, Edit), then `match-header-actions` (Select team, Edit on phone, Availability, Share) and a phone links row. `badges` (announced per own side, inactive, poll) are built just above. `MatchKeyFigures` and `MatchTeamCard` already exist.
- **Gauge:** `MatchTeamCard.tsx` uses `CardProgressBar` (10 px bar) and `pickedLegend`. The poll-style gauge is a bar with a dot-keyed count legend under it (`ResponseGauge` in `components/ResponseGauge`, `variant="header"`: segments keyed by `STATUS_COLOR`). `ResponseGauge` is typed to poll modes (`poll` coverage / `status` counts), so I add a small reusable **`SelectionGauge`** (`components/SelectionGauge/`: props `picked`, `size`, `ariaLabel`; renders the bar plus "● n Picked ● m To go", or "squad complete" when full) rather than bending `ResponseGauge`. `CardProgressBar` stays for the match card and the list.
- **Poll pages:** `ResponsesPageShell` passes `title` and `headerAction` to `ManageScreenHeader`, which now has `titleAdornment` (spec 089 D). The shell needs a pass-through `titleAdornment` prop so the group page can put the ✎ after its title.
- **Delete and description** live in `PollCard` (`deleteMutation` with the 409 "can't delete" notice for a group poll, the two `ConfirmDialog`s; `descriptionMutation` with `EditDescriptionDialog`). As with `usePollClose`, I extract them into hooks so the card and the pages cannot drift: **`usePollDelete`** (request, confirmation, blocked notice, `onDeleted`) and **`usePollDescription`** (group only: dialog open state, mutation, the `EditDescriptionDialog` node).
- After **Delete** on a page the poll no longer exists: invalidate the lists and counters (as the card does via `onChanged`) and **navigate to `/manage/availability`**; the page must not refetch the deleted poll.
- After **Edit description** the group page's round data is refetched (invalidate `roundsKey`, which covers `[...roundsKey,'detail']` and the responses) so the title updates.

## Decisions to confirm (readings; the specs fix the behaviour)

1. The gauge is a new `SelectionGauge` component (not `ResponseGauge`), used by `MatchTeamCard` only for now (spec: match page team cards only).
2. Delete poll on the page is a red outlined button (like the mockup) using the existing `Button` `danger` look if it has an outlined variant, otherwise a `MuiButton color="error" variant="outlined"`.
3. A match with no logo on either side shows no tiles at all (spec); the existing `logoFor` already yields `src: null` and initials, so I only render a tile when `src` is set.

## Slice 1 — match page header (`frontend-builder`, then `test-writer`)

- New `components/SelectionGauge/` (`SelectionGauge.tsx`, `index.ts`, `SelectionGauge.test.tsx`, `.stories.tsx`): 10 px rounded bar (`role="progressbar"`, `aria-valuenow/max/text` like `CardProgressBar`) with the legend; a `max` of 0 shows an empty bar; "squad complete" at or above `max`.
- `pages/manage/matchDetail/MatchTeamCard.tsx`: swap `CardProgressBar` + `pickedLegend` for `SelectionGauge`; the announced chip moves beside the "Playing XI" label; "n of m picked" stays on that row (no-league matches keep "n picked" and no gauge).
- `pages/manage/MatchDetailPage.tsx`: restructure the header: top row = Back (left) and `match-header-links` (Scoring, Watch live, filled Edit; Edit also on phone, links wrap), title row = `h1` with a logo tile before each team name that has `logo.src` (inline, one "vs") and the right-aligned `match-header-actions` (Select team, Availability, Share team sheet; phone: Select team + Availability halves, then Share, Scoring and Live thirds), drop the badges group except the Inactive badge, remove the `announcedBadge` / `pollBadgeFor` header use and the old phone links row. Keep every disabled rule and reason.
- Tests: update `MatchDetailPage.test.tsx` (the DOM-order test: Back + links on the top row, title row, actions; no `Match badges` for announced/poll, Inactive badge still shown; logos only when a source exists; Edit still a filled link; all actions and their disabled reasons), `MatchTeamCard.test.tsx` (gauge legend, complete state, announced chip), new `SelectionGauge` tests and story.
- Commit.

## Slice 2 — Delete and Edit description on the poll pages (`frontend-builder`, then `test-writer`)

- New hooks `hooks/usePollDelete.tsx` and `hooks/usePollDescription.tsx` (pattern: `usePollClose`), with tests; `PollCard.tsx` switches to them (its tests stay green unchanged).
- `ResponsesPageShell.tsx`: optional `titleAdornment` forwarded to `ManageScreenHeader`.
- `SquadPollResponsesPage.tsx` and `GroupPollResponsesPage.tsx`: add **Delete poll** to `headerAction` (confirmation, then invalidate the polls lists, counters and `matches`, then navigate to `/manage/availability`); the group page also gets the ✎ **Edit description** after its title (`titleAdornment`, opens `EditDescriptionDialog`; success invalidates `roundsKey`); a blocked group delete shows the card's "Can't delete this poll" notice.
- Tests: both pages (Delete opens the confirmation, Cancel does nothing, Confirm calls `deletePoll` / `deleteRound` and navigates to the list, a 409 on a group poll shows the notice and stays; group pencil opens the dialog, saving calls `updateRoundDescription` and the new title shows; no pencil on a squad poll), the two hooks, `ResponsesPageShell` pass-through.
- Commit.

## Docs (last commit)

`docs/specs/089` and `090` status lines (revisions built, awaiting browser check) with the readings above; `docs/standards/design-system.md` record-detail paragraph updated (page actions on the Back row, gauge); this plan to `docs/plans/089-090-header-revision-and-poll-page-actions.md`.

## Verification

- `source ~/.nvm/nvm.sh; nvm use 22.12.0` in `ui/`: `npx tsc -b`, `npm run lint` (no errors), the changed unit files first, then **one** full `npx vitest run --project=unit --maxWorkers=2` with nothing else running (it takes ~10 min on a quiet machine; do not overlap runs), `npx vitest run --project=storybook` for `SelectionGauge` and `MatchKeyFigures` (rerun once if the first run shows the transient `useContext null` error).
- Manual (the user): the match page at desktop and phone widths against boards 1 and 2 (top row, title with logos, buttons right, no badges, gauge), Inactive badge on an inactive match; a squad poll and a group poll page: Delete (confirmation, back to the list, the poll gone; a group poll with picked squad members is refused with the reason), the ✎ on a group poll renames it.

## Not in this plan

Backend work, the gauge on the match card or list table, Delete or Edit description in the list rows, any change to the counters, filters or the other pages.
