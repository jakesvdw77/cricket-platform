# Plan 084 — Clickable Counters (Availability Polls page)

Spec: `docs/specs/084-clickable-counters.md` (on branch `docs/084-clickable-counters`, PR #101, stacked on the 083 stack #97 → #98 → #99). Depends on 081 (`PageCounters`), 083 (filters, summary), 073/074, 065/066.

## Context

The four counters on the Availability Polls page are plain cards. The manager sees "6 still to answer" but not who, and cannot narrow the list to polls closing soon. The spec makes each counter either a **filter** (Close in 48 hours, with Open polls / Polls shown as its reset) or a **drill-down** (Players responded and Players still to answer open one per-player panel with Responded and Still to answer tabs). Labels and figures stay as they are. Polls page only; the mockup is approved (https://claude.ai/artifact/P7LqFQinmqPXFcuRrPhnJS).

## Items to flag to the human (spec points the code contradicts; the plan makes the smallest choice, please confirm)

1. **`PageCounters` does need an API change.** The spec says none is needed, but a selectable counter always gets `aria-pressed` today, and the spec wants drill-down counters without it. Also missing: hover/pressed affordance and non-clickable-at-zero (the component has no `disabled`). Plan: add an optional `kind: 'filter' | 'drill'` (default `'filter'`, so existing callers are unchanged), `aria-pressed` only for filters, a hover lift, and a plain (non-button) render when the figure is 0 unless the counter is the active filter.
2. **`closingSoon` and the 48-hour filter.** The spec adds `closingSoon` to the summary, the players endpoint and the poll list endpoints, but also says the 48-hour filter must not change the counters' figures (so the summary would never receive it) and offers a client-side fallback. The list already holds `scheduledCloseAt`. Plan: filter the list **client-side** (open polls with `scheduledCloseAt` in `(now, now+48h]`, the backend rule), add `closingSoon` **only to the players endpoint** (the panel must match the list), and add nothing to the summary or list endpoints. Small difference: the counter uses server time, the list uses the browser's clock.
3. **Paging in memory.** `docs/standards/backend.md` says list endpoints must page in the database, never in memory. The players list is derived in memory from the `OverviewPolls` aggregation, which is already bounded (open polls plus at most 50 closed per kind), and has no SQL query to page. Plan: slice the bounded derived list server-side and return a `PageImpl`, with the reason in the Javadoc and the spec. This is the first such endpoint (precedent: `PlayerAvailabilityServiceImpl` caps with `MAX_PLAYERS` and a `truncated` flag). Also the repo has no `@PageableDefault` and no size cap (Spring's default max is 2000), so the spec's default 25 / max 100 is new code (`@PageableDefault(size = 25)` plus a clamp to 100).
4. **Panel definition when "Show closed" is on.** The counters include closed polls (capped at 50 per kind), so the panel does too, using the same code, so the totals match. A player can appear on both tabs (answered one window of a group poll but not all).
5. **"Show more" is a new pattern** (`useInfiniteQuery`; the repo only has Prev/Next paging). `frontend.md` allows it. Right-anchored `Drawer`, local-state `Tabs` and a row-skeleton are also first uses.
6. **Display name.** `PlayerProfile` has no name; compose `Person.firstName + " " + Person.lastName` (two batched queries, as `PlayerAvailabilityServiceImpl` does).

## Slices (each its own PR, in the order of the spec's Rollout Notes; stack on the 083 branch until it merges, then rebase onto `master`)

### Slice 1 — 48-hour filter and clickable counters (frontend only)

Agent: **frontend-builder**, tests by **test-writer**.

- `ui/src/components/PageCounters/PageCounters.tsx` (+ test, stories, `keyFigureStyle.ts`): `kind` prop, `aria-pressed` only for filter counters, hover/pressed affordance in the Overview key-figure style (`keyFigureCardSx`), hint contrast check, zero rule (plain card at 0 except the active filter). Stories for Filter, Drill-down, Zero and Hover. `ManagerOverviewPage` is unaffected (it only imports the style).
- `ui/src/pages/manage/availability/hubContext.ts` (`useAvailabilityHubState`): add `closingSoon` boolean next to `showGroup`/`showSquad`/`showClosed` (per visit, not persisted).
- `AvailabilityHubLayout.tsx` `counterItems()`: "Close in 48 hours" = filter (toggles the flag, `active` when on), "Open polls / Polls shown" = filter reset (active when the flag is off), hints "Tap to filter"; the players counters get `kind: 'drill'` and a hint ("See who") wired in slice 2 (not clickable yet in this slice). The summary query is **unchanged** (no `closingSoon` param).
- `ui/src/pages/manage/AvailabilityPollsDashboard.tsx`: client-side 48-hour filter in `visibleItems` (open squad polls and open rounds only, `scheduledCloseAt` in `(now, now+48h]`; closed items excluded; `autoClose = false` never matches); `isFiltering`, the scope text ("closing within 48 hours") and `extraChips` (removable "Closing within 48 h" chip), `onClearedAll` resets it; a toggle in `viewControls` for the phone Filters sheet (so it counts in the badge, via `FilterBar`'s chips).
- Tests: `PageCounters.test.tsx`; `AvailabilityHubLayout.test.tsx` (counter semantics, pressed state, summary request unchanged); `AvailabilityPollsDashboard.test.tsx` (filter narrows, chip, badge, scope text, clear, reset card, closed items excluded); one Playwright golden path later in slice 2.
- Docs: `docs/standards/design-system.md` note for the two counter kinds.

### Slice 2 — players endpoint and `PlayersPanel`

Agents: **backend-builder** → **frontend-builder** → **test-writer**.

Backend (`$B = backend/src/main/java/com/cricketlegend`):
- Extract the summary's aggregation (the loop over `OpenPoll` building `audience`/`responded`/`stillToAnswer`, `responded.retainAll(audience)`) from `service/impl/AvailabilitySummaryServiceImpl.java` into one shared support class (e.g. `service/support/AvailabilitySummaryPlayers`) used by **both** the summary and the new endpoint, so totals equal the counters by construction. No behaviour change to the summary; its tests stay green.
- `controller/AvailabilitySummaryController.java`: `GET /api/v1/manage/clubs/{clubId}/availability/summary/players` with `kind=responded|awaiting`, the summary's filter params, `closingSoon`, `search`, `Pageable` (`@PageableDefault(size = 25)`, size clamped to 100); same `@PreAuthorize("@access.canAccessClub(...)")`.
- Service iface + impl method (`@Transactional(readOnly = true)`): reuse `AvailabilityPollFilters.resolve` (404 cross-club league/team, 403 section rules), `OverviewPolls.pollsWithPlayers`; apply `closingSoon` (open polls only, `scheduledCloseAt` in `(now, now+48h]`, the existing `CLOSING_SOON` constant); build player → polls map from `responded` or `awaiting`; batch-load names (`playerProfileRepository.findAllById` then `personRepository.findAllById`); filter by `search` on the composed name; sort by number of polls descending then name; slice and return a `PageImpl`; empty accessible sections → empty page.
- DTOs: `AvailabilitySummaryPlayerDto { playerProfileId, displayName, polls: [{ kind, id, matchId, title }] }` (built from the `OverviewPollDto` fields; no entity crosses the controller).
- `backend/openapi/openapi.yaml` (by hand, mirroring `PageClubDto` / `GET /matches`): the new path, `PageAvailabilitySummaryPlayerDto`, the DTOs. Additions only.
- Tests: unit tests for the new service method (distinct player with two polls, kind, search, closingSoon, sort, paging, size clamp); extend `AvailabilitySummaryParityIntegrationTest` (players `totalElements` equals `playersResponded` / `playersStillToAnswer` for the same filters, all combinations); `AvailabilitySummaryControllerIntegrationTest` (params, section-manager scoping, another club 403/404, bad `kind` 400); `AvailabilitySummaryQueryCountIntegrationTest` (statement count constant with filters and paging); non-transactional integration test, per the lazy-loading rule in `backend.md`.

Frontend:
- `ui/src/api/availabilitySummaryApi.ts` (+ test): `listAvailabilitySummaryPlayers`, types, key `['managed-club', clubId, 'availability-summary', 'players', {...}]` (under the existing prefix so `invalidateAvailabilityCounters` refreshes it).
- Extract one poll Responses URL helper (group `/manage/availability/group/:roundId`, squad `/manage/availability/squad/:matchId/:pollId`) from the four existing copies (`ManagerOverviewPage.tsx` ~64, `pollHelpers.ts` ~57, `matchCardHelpers.ts` ~155, `gridHelpers.ts` ~169) and use it in the panel.
- **New** `ui/src/pages/manage/availability/PlayersPanel/` (four-file anatomy: `PlayersPanel.tsx`, `.test.tsx`, `.stories.tsx`, `index.ts`): phone = `BottomSheet`, desktop (`useMediaQuery`, `noSsr: true`) = right-anchored MUI `Drawer`; local-state `Tabs` (Responded / Still to answer, pre-selected by the clicked counter), search (`Input` with the `SearchIcon` adornment, debounced), per-player rows (name, poll count, expanding to poll links), footer scope line, `useInfiniteQuery` with "Show more", states: loading skeleton rows, "Everyone has answered." / "No answers yet.", error with retry; 44 px phone row targets; Escape/backdrop/close; focus returned to the counter on close.
- `hubContext.ts` / `AvailabilityHubLayout.tsx`: panel open/tab state (not in the URL); the two players counters get `onSelect` (open on the matching tab), non-clickable at 0.
- Tests: `PlayersPanel.test.tsx` (tab pre-selection and switching, per-player grouping, links to both poll routes, search, loading/empty/error/more, bottom sheet vs drawer, keyboard and focus), hub layout tests (counter opens panel on the right tab; panel request carries the same filters plus `closingSoon`), API tests; Playwright golden path in `ui/e2e/manager-availability-polls.spec.ts` (click "Players still to answer", see a player, follow a poll link).
- Docs: `docs/standards/design-system.md` entry for `PlayersPanel`; `docs/roadmap.md` (084 status, reminders still undecided).

## Reuse inventory

`PageCounters` (`onSelect`, `active`, `hint`) and `keyFigureCardSx`; `BottomSheet`; `FilterBar` chips/badge/`viewControls`/`onClearedAll`; `ContentControlsLine`; `AvailabilityFilterBar`; `useAvailabilityHubState`; `scopeFilterText` (`utils/availabilityScope`); `OverviewPolls.pollsWithPlayers`; `AvailabilityPollFilter(s)`; `AccessService.accessibleSectionIds`; the existing summary tests and parity test; `invalidateAvailabilityCounters`.

## Verification

- Frontend: `nvm use 22.12.0`; in `ui/`: lint, `npx tsc -b`, `npm run build`, `npx vitest run --project unit --maxWorkers=2` (re-run any failing file alone), Storybook stories for `PageCounters` and `PlayersPanel`; Playwright mobile + desktop for the golden paths.
- Backend: scratch copy only (never `mvn` in `backend/` while the user's app runs); `./mvnw test` including ArchUnit and the query-count guards; `openapi.yaml` edited by hand.
- Manual (the user): Polls page at 375 px and desktop: counters show › / filter tags and hover; "Close in 48 hours" narrows the list, shows a chip, adds to the phone badge and leaves the counter figures alone; "Open polls" resets; "Players still to answer" and "Players responded" open the panel on the right tab, each player once with working poll links, totals equal the counters under every filter combination; "Everyone has answered." when nothing is owed (that counter is then not clickable); a section manager only sees their own sections; failed panel request leaves counters and list working; keyboard Tab/Enter/Space/Escape.
- Then the standards review (`/review`) before each PR; conventional commits per slice.

## After approval

Copy this plan verbatim to `docs/plans/084-clickable-counters.md` on branch `docs/084-clickable-counters` (PR #101).
