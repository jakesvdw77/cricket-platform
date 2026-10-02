# Plan 065 — Group Poll Responses View

Implements `docs/specs/065-group-poll-responses-view.md` (approved). Visual target: the approved design page https://claude.ai/artifact/5CUvicghrTHBhdmKLWV1vP (three views, real theme tokens), reproduced as closely as possible with existing shared components. Frontend only; the spec fixes "no backend or API change".

## Context

A group poll's responses are shown today inside the poll card as one box per player with one chip per time slot, which is hard to read and cramped in the card grid. 065 replaces that with a dedicated page per poll with three views (By time slot, By player, Summary), a player search, a collapsed "No response" row for big sections, and the same admin override as today. Branch: `feature/065-group-poll-responses-view` (off 064's branch, since it builds on `GroupPollCard`).

## Findings that shape the plan

1. **Everything needed already exists in the API:** `getRoundResponses` (players, per-slot statuses, per-slot counts, `open`, `publicPath`), `getRoundMatches` (matches with `windowId`/`dayPart`), `setRoundPlayerStatus` (returns the full responses payload), `listRounds`. There is **no single-round GET**, and the responses payload lacks `scheduledCloseAt`/`autoClose` and the full `SectionAvailabilityRound` the share dialog needs.
2. **Round details are fetched with a list-and-find**, the same pattern `ClubContactDetailPage` uses: `listRounds(clubId)` (no `open` filter, so it returns open and closed) then `.find(r => r.id === roundId)`. This works on a direct visit/deep link, needs no backend change, and yields the full `SectionAvailabilityRound` for `SectionAvailabilityShareDialog`.
3. **Everything the old in-card UI does is page-local in `GroupPollCard.tsx`:** `playerDisplayName`, `STATUS_OPTIONS`, and `BracketStatusChip` (which owns the override `Menu`). They must be extracted for the new page. Already shared and reusable: `utils/dayPart.ts`, `utils/availabilityStatus.ts` (`STATUS_LABEL`, `STATUS_COLOR`), `pollHelpers.ts` (`formatMatchDateTime`, `formatCloseTime`, `closesValue`), `utils/errorDetail`, `components/SectionAvailabilityShareDialog`, `ManageScreenHeader`, `Input`, `EmptyState`.
4. `RecordDetailScreen` is edit-oriented (required `editTo`, link-only actions) and a poor fit; the spec's choice of `ManageScreenHeader` (back link + `action` slot) is right, with the Open/Closed badge and close time as content beneath it.
5. The existing separator in `formatBracketLabel` is a hyphen ("Sat 4 Oct - Morning"); the spec wants "Sat 3 Oct · Morning". A new page-local heading formatter is added; the shared one (used elsewhere) is not changed.
6. The status menu order in the old code is Available/Unavailable/Unsure; the spec's group order is Available, Unsure, Unavailable. The new menu follows the spec's order.
7. The only test touching the old responses UI is the override test in `AvailabilityPollsDashboard.test.tsx` (~932-948) and its `makeResponses` fixture; it moves to the new page's tests.

## Build (frontend-builder; one agent, all under `ui/`)

**F1. Extract shared bits** into `ui/src/pages/manage/availability/responses/`:
- `responseHelpers.ts` (pure, unit-tested): `playerName(row)` / `playerNumber(row)` (replacing `playerDisplayName`), `groupBySlot(responses, matches)` → per slot `{ bracket, matches, available, unsure, unavailable, noResponse }` sorted by date then Morning before Afternoon, `filterPlayers(rows, query)` (case-insensitive first/last name), `hasAnyAnswer(row)`, `slotHeading(bracket)` ("Sat 3 Oct · Morning"), `STATUS_ORDER` (`AVAILABLE, UNSURE, UNAVAILABLE`).
- `StatusOverrideMenu.tsx`: page-local component wrapping a trigger (player row or status chip) with the status `Menu`, one `MenuItem` per status in `STATUS_ORDER`, `selected` on the current one, `disabled` when the poll is closed; aria-label keeps the current form `Set <name>'s <slot> availability` (the existing test's contract). Replaces `BracketStatusChip` (delete it from `GroupPollCard`).
- A small shared status-tint sx helper in `utils/availabilityStatus.ts` (`alpha(palette[tone].main, 0.12)` bg + `${tone}.dark` text, the documented 033/034 convention) used by the new files; the two existing copies are left alone (no churn).

**F2. `GroupPollResponsesPage.tsx`** (`ui/src/pages/manage/`, route `availability/group/:roundId`, clubId via `useOutletContext`, `useParams`): queries `getRoundResponses` (existing key `[..., 'section-availability-rounds', roundId, 'responses']`), `getRoundMatches` (existing `[..., roundId, 'matches']`), and `listRounds(clubId)` + find (new key `[..., 'section-availability-rounds', 'detail']`). `ManageScreenHeader` (`backTo="/manage/availability"`, Share invite button in `action` opening `SectionAvailabilityShareDialog`), beneath it Open/Closed badge + "Closes <date time>"/"Closes manually" (`closesValue`). Not-found/loading/not-authorized states mirror `ClubContactDetailPage`. State: view (`ToggleButtonGroup`, default `slot`, exclusive with the `next &&` guard, **not persisted**), player search (`Input`, label "Search players", search adornment), hide-non-responders switch (By player only), per-slot "No response" expanded map (not persisted). Closed poll: override disabled plus the line "This poll is closed, so answers can't be changed." Override success: `setQueryData` the returned payload into the `responses` key, then invalidate the `section-availability-rounds` prefix so the dashboard cards' counts refresh; errors via `errorDetail`.

**F3. The three views** (page-local components in `responses/`):
- `ResponsesByTimeSlot.tsx`: one block per slot (heading, matches line via `formatMatchDateTime`/team v opponent/league), three columns Available/Unsure/Unavailable (`md` 3 columns, stacked below), each with a count and "None" when empty, each column's list in a box with `maxHeight` ≈ 12 rows, `overflowY: auto`, `tabIndex={0}` and an `aria-label`; a full-width **No response (N)** row with Show/Hide, collapsed by default, expanded as a multi-column flow; players are rows of number + name that open `StatusOverrideMenu`.
- `ResponsesByPlayer.tsx`: table (`overflowX: auto` container), # / player / one column per slot with a fixed-width status chip (word always shown, so never colour alone), sorted by name, "Hide players who haven't answered" switch, chips open `StatusOverrideMenu`.
- `ResponsesSummary.tsx`: one card per slot: stacked bar (theme tones plus a neutral for no response), text legend with the four counts, "N of M answered", using the bracket counts from the payload (totals, never filtered by search).

**F4. Wire up.** `App.tsx`: add the route. `GroupPollCard.tsx`: **Responses** navigates to `/manage/availability/group/${round.id}` (via `useNavigate`); remove `responsesOpen`, the responses query, `setStatusMutation`/`settingKey`, the in-card rows and `BracketStatusChip`/`STATUS_OPTIONS`/`playerDisplayName` (dead after the move). "Covered matches" stays on the card as is. Tests/comments referencing the old expansion are updated.

## Tests (builder writes its own; `test-writer` fills gaps against the spec's Test Plan)

- `responseHelpers.test.ts` (pure grouping, ordering, search, hide-non-responders, heading format, a player with different answers per slot).
- `GroupPollResponsesPage.test.tsx`: header + default view from mocked responses/matches/rounds; players in the right group per slot; counts; "None"; No response collapsed → expands per slot; long group scrolls (container has the maxHeight style/labelled region); view switch to By player (aligned columns) and Summary (counts, "N of M answered"); search filters players in every view while Summary totals stay full; hide-non-responders; override menu calls `setRoundPlayerStatus('club','round-1','player-1','window-2','UNAVAILABLE')` (migrated from the dashboard test) and refreshes; override disabled with the explanation when closed; share dialog opens; back link; not-found state.
- `AvailabilityPollsDashboard.test.tsx`: Responses navigates (the test's `renderDashboard` needs a route stub for `availability/group/:roundId`); old expansion/override test removed.
- **Playwright:** not extended (the spec says only if the harness can run; it needs live services and a login, as in 064) — flagged below.

## Order and ownership

1. `frontend-builder`: F1→F4 plus its tests, verified in `ui/` under Node 22 (`source ~/.nvm/nvm.sh && nvm use 22.12.0`). No backend work, so the live IntelliJ backend is not at risk.
2. `test-writer`: compare the Test Plan against disk, fill gaps.
3. I re-run independently: `npm run build`, `npm run lint`, `vitest run --project unit --testTimeout=30000` on every touched file; and click through the real page in the browser (vite is already running on 5173; backend must be restarted by the user for closed-poll endpoints, which this page doesn't need).
4. `standards-reviewer` (read-only), fix findings.
5. Commit in chunks: `feat(ui)` (page, views, extraction, card change, route), `test(ui)`, `docs` (plan file + any spec wording). Open a PR only if you ask.

## Verification

- `cd ui && source ~/.nvm/nvm.sh && nvm use 22.12.0 && npm run build && npm run lint`.
- `npx vitest run --project unit --testTimeout=30000 src/pages/manage/GroupPollResponsesPage src/pages/manage/availability src/pages/manage/AvailabilityPollsDashboard` (the full suite still has ~10-25 unrelated, pre-existing 5s timeouts).
- Browser: open `/manage/availability`, click **Responses** on a group poll, check each view against the design page: grouping per slot, collapsed No response row, search, scrolling, override while open, disabled while closed, back link, share dialog; and at a phone width.

## Flags for your review

1. **Round header details come from `listRounds` + find**, because there is no single-round endpoint and the spec forbids API changes. Cost: one extra request on the page.
2. **A new "Sat 3 Oct · Morning" heading formatter** is added rather than changing the shared hyphen one used by other screens.
3. **The override menu order changes** to Available / Unsure / Unavailable (spec order) from the old Available / Unavailable / Unsure.
4. **Playwright is not extended** (can't run here without live services); the golden-path e2e from 064 stays as is.
5. The Responses button no longer expands in place; anyone with the old behaviour in muscle memory lands on a new page.
