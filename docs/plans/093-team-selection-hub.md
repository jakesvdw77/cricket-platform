# Plan: spec 093 — Team selection hub and the Select team page

## Context

Spec 093 (`docs/specs/093-team-selection-hub.md`, mockups approved 2026-10-09 as "a great start") renames "Squads" to **Team selection**, adds a four-view hub (Matches | Players | Time slots | Batting order) and moves picking onto a standard **Select team page** (replacing the Home XI / Away XI tabs of Edit Match). Selection and availability rules (spec 076) are unchanged. Branch `feat/093-team-selection-hub` (spec committed `177a2e2`). One small backend slice, then frontend slices; a commit group each; one PR only when the user says so.

## Findings that shape the plan

- **Squads today** = `pages/manage/SquadPicker.tsx` (25 lines, wraps `MatchList` with `title="Squads"`, edit link `/manage/fixtures/matches/:id/edit?tab=playing-xi`); route `App.tsx:232`; nav `managerNav.ts:90` (`id 'squads'`, icon `nav/squads`, People group) with `managerNav.test.ts`.
- **Home/Away XI** live inside `pages/manage/MatchFormPage.tsx` (1243 lines): tabs ~1172, side panel state and server calls ~289–850 (Select players ~713, Announce/Un-announce ~729, `ConfirmDialog` ~806, not-confirmed notices), `?tab=playing-xi` ~1057, Availability button in `headerAction` ~1110 (`useAvailabilityNavigation`). The pick table is `components/TeamSelectionList/TeamSelectionList.tsx` (28 px `BrandIcon` role icons, 40 px badge chips = the oversized look); dialog `components/SelectPlayersDialog/`.
- **"Deactivate"** is `components/RecordStatusToggle` (spec 038) in the Edit Match header `actions` slot on every tab. Decision: it moves to the Edit Match **Details** tab only (the spec's open question).
- **Hub switch to mirror:** `pages/manage/availability/AvailabilityHubLayout.tsx` (`VIEWS`, `activeView(pathname)`, `ToggleButtonGroup` with `segmentedSwitchSx`, layout route in `App.tsx:240-244`, `hubContext.ts`, `AvailabilityFilterBar.tsx`). Players grid pieces to reuse: `pages/manage/playerAvailability/` (`CellMark` picked dot, `Legend`, `gridHelpers`, `PlayersPhoneLists`).
- **Data:** `GET /matches` already gives per match `homePickedCount/awayPickedCount`, `playingXiSize`, `home/awaySideAnnounced` (enough for the Matches view and the gauge), but **no batched per-player pick data exists**: `MatchSideController GET .../matches/{id}/sides` is per match (N+1), `/player-availability` has only a boolean `picked`, no side id, order, markers or eligibility. A **new read endpoint is required** (the spec's API Contract anticipated it). Writes reuse spec 076: `PUT .../matches/{matchId}/sides/{sideId}/selection` (apply), `POST .../sides/{sideId}/players/{pid}/remove`, announce/unannounce. Reason codes: `SelectionRejectionReason` (`AGE_INELIGIBLE`, `SAID_UNAVAILABLE`, `NOT_CONFIRMED`, `TAKEN_FOR_SLOT`, …) from `SelectionRules.evaluate(match, teamId, playerIds)`.
- Backend layering/ArchUnit as in the Leagues plan: controller → service iface+impl → repository; records in `service/support`; no nested types or enum switches in `service.impl`; `openapi.yaml` additions by hand; fixed statement count (guard test), never per match or per player.

## Decisions to confirm (readings; the spec fixes the behaviour)

1. **New endpoint** `GET /api/v1/manage/clubs/{clubId}/team-selection?seasonId&leagueId&sectionId&teamId&includePast` → `TeamSelectionOverviewDto { matches[], players[], counts, truncated }`: per match (column) the side id(s) for the club's own side(s) (a derby has two), announced flag, `limits`, ordered picked players with `battingOrder`, captain / keeper / 12th-man markers, picked count; per player row the cells with `pickable` and a `reasonCode` when not (via the same `SelectionRules` batch, one resolution per call). Counts for the Matches view counters (`upcoming`, `notStarted`, `inProgress`, `readyToAnnounce`, `announced`) come from the same data so each counter equals its filter. Capped like `/player-availability` (`truncated`).
2. The Matches view table uses the same endpoint (one source for all four views, so they cannot disagree); `GET /matches` is not changed.
3. **Routing:** `/manage/team-selection` (layout route with children `matches`, `players`, `slots`, `batting`), `/manage/squads` redirects to it; menu label "Team selection" (keep the `nav/squads` icon for now). The Select team page is `/manage/team-selection/matches/:matchId/sides/:sideId` (Home/Away switch inside); old `/manage/fixtures/matches/:id/edit?tab=playing-xi` redirects to it.
4. **Edit Match** keeps Details only (plus a "Select team" link to the new page) and gains the Deactivate toggle on Details; the Home/Away XI tabs go.
5. Click-to-pick on the Players grid and "+ Add" on Batting order call the existing apply endpoint with the player added (batting order appended); a refusal shows the rule's message; muted cells use `reasonCode` text as tooltip. Unpick uses the remove endpoint. Every successful write invalidates the overview query.
6. Phone: grids and the matrix scroll horizontally inside a box with a sticky first column (the spec's proposal); phone variants of the Matches view reuse the card-less compact list pattern of `MatchTable`.
7. All four views are built; Time slots can be dropped later if unused.

## Slice 1 — backend overview endpoint (`backend-builder`, `test-writer`)

`TeamSelectionController` (`@PreAuthorize canAdministerClub`, GET above), `TeamSelectionService` + `TeamSelectionServiceImpl`, DTO records (`TeamSelectionOverviewDto`, match/side/player/cell records in `dto` or `service/support` per ArchUnit), reuse `PlayerAvailabilityServiceImpl.loadPicked` approach and `SelectionRules`/`SelectionAvailabilityResolver` in batch (no per-player calls), one batched sides + players + names query. `backend/openapi/openapi.yaml` additions. Tests: service tests (counts rules, ordering, markers, derby, eligibility reasons, past filter, truncation), `TeamSelectionIntegrationTest` (parity: a cell reported pickable is accepted by the apply endpoint and a not-pickable one is refused with the same reason; counters equal filters), statement-count guard, ArchUnit, controller access test. Backend tests run in a scratch copy (`rsync` to the scratchpad `be-run`), never in `backend/`; the user restarts the backend afterwards. Commit.

## Slice 2 — hub shell and Matches view (`frontend-builder`, `test-writer`)

`api/teamSelectionApi.ts` (+ query key, types); `pages/manage/teamSelection/TeamSelectionHubLayout.tsx` (header, `HeaderSeasonSelect showAll={false}`, four-way switch via `segmentedSwitchSx`, shared `FilterBar` + `ContentControlsLine` with Show past, persisted filters `teamSelection:filters:<clubId>`); `MatchesView.tsx` (+ `PageCounters` quick filters, zebra `SelectionMatchesTable` with `data-desktop-only`, `SelectionGauge`, **Select players** / **Announce** buttons that do not wrap); nav label/route/redirect (`managerNav.ts` + test, `App.tsx`), delete `SquadPicker.tsx`. Tests for each, stories for the table. Commit.

## Slice 3 — Select team page (`frontend-builder`, `test-writer`)

New `pages/manage/teamSelection/SelectTeamPage.tsx`: Back, Season pill, logo/title/date/league, one action group (Availability outlined, Announce team outlined, Select players filled), Home XI | Away XI switch, `KeyFigureTile` strip (Selected, Captain, Wicketkeeper, Status), restyled `TeamSelectionList` (text role, small C / WK markers, no `BrandIcon` pills, availability tick only, drag handle, row menu). Extract the side-panel state and calls out of `MatchFormPage.tsx` into a hook (`useMatchSidePanel`) reused by the page; `MatchFormPage` loses the Home/Away XI tabs, keeps Details, hosts `RecordStatusToggle` on Details, adds the "Select team" link, redirects `?tab=playing-xi`. Update `MatchFormPage.test.tsx`, `TeamSelectionList` tests/stories, `MatchDetailPage` links. Commit.

## Slice 4 — Players grid (`frontend-builder`, `test-writer`)

`PlayersView.tsx`: grid of players × matches (columns grouped by day and slot, header and footer "Picked n / max"), cells picked / not picked only, legend "Picked / Not picked", muted ineligible cells with reason tooltip, click to pick/unpick through the apply/remove hooks; reuse `CellMark`, `Legend`, `gridHelpers`, phone lists. Tests: pick, unpick, refusal message, muted reasons, filters. Commit.

## Slice 5 — Time slots and Batting order (`frontend-builder`, `test-writer`)

`SlotsView.tsx` (a block per day and slot, one card per match: picked players in order, C / WK markers, 12th man labelled, gauge, announced chip) and `BattingOrderView.tsx` (matrix: columns = matches grouped by slot, rows = positions 1–11 + 12th man, cells = name + markers, "+ Add" offering only eligible players, per-column Select / Announce). Tests and stories. Commit.

## Docs (last commit)

`docs/standards/design-system.md` (hub switch pattern, pick-state grid, Select team page), `docs/standards/frontend.md` (new routes, `teamSelection:filters`), `docs/roadmap.md` (bulk announce, phone variants, Time slots keep/drop, menu icon), spec 093 status line (built, awaiting the user's browser check, readings above, Deactivate resolved), this plan copied to `docs/plans/093-team-selection-hub.md`.

## Verification

- Backend in a scratch copy (`rsync` backend/ to the scratchpad `be-run`, `./mvnw -q -o test` for the new tests then the full suite; Docker needed; run alone).
- Frontend (`source ~/.nvm/nvm.sh; nvm use 22.12.0` in `ui/`): `npx tsc -b`, `npm run lint` (no errors), changed files first, then **one** full `npx vitest run --project=unit --maxWorkers=2` alone, then `--project=storybook` (rerun once on a transient "useContext null").
- Manual (the user, backend restarted): the four views against the mockup boards (counters filter, Show past, click-to-pick respecting availability with reasons, announce), the Select team page (action group, strip, no oversized icons), Edit Match Details with Deactivate, `/manage/squads` redirect, old `?tab=playing-xi` links.

## Not in this plan

Selection or availability rule changes, share/announce outputs, new availability concepts in the selection views, bulk announce, new icons for the menu, and a PR (only on the user's say-so).
