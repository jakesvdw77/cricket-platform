# Plan 083 — Availability Filters and Toolbars

Spec: `docs/specs/083-availability-filters-and-toolbars.md` (lives only on branch `docs/083-availability-filters`; merge or branch from it before building). Depends on 073, 074, 081, 043, 082.

## Context

Polls, Players and Coverage each have their own toolbar and saved filters, and the 081 counters ignore the filters entirely. The spec fixes the target: one shared filter model (League, Section, Team) owned by the hub layout, saved once per club and mirrored in the URL; one toolbar layout (shared filters + search in the card, view-specific toggles on a line above the content); a phone "Filters" sheet with badge and chips; counters that follow the filters, with "Players still to answer" replacing "Answers awaited"; Season moved to a label beside the title on Players/Coverage; League and Team filters on Polls.

## Items to flag to the human before building (spec ambiguities, not reinterpreted here)

1. **API outline is stale.** "API Contract" lists only `leagueId` for the poll listings, but Decisions add a **Team filter on Polls**. Plan assumes `leagueId` and `teamId` on `availability-polls/open|closed` and `section-availability-rounds` (as the roadmap resume pointer says). Please confirm and update the spec's outline.
2. **`seasonId` on the summary endpoint.** The outline gives the summary a `seasonId` param, but Polls has no season and the counters only show on Polls (hub only runs the summary query when `view === 'polls'`). Plan: **do not add `seasonId`**; flag if you want it.
3. **Section semantics must match between list and counters.** The poll list filters by section *with descendants*; `OverviewPolls` audiences use the *exact* section tag. Plan: the summary computes its poll set with the same scoping as the lists (descendants), and "audience" stays as `OverviewPolls` defines it. Confirm.
4. **Group poll league/team match rule.** Spec: group polls filter by "the teams of the matches in their slots". Plan: a group poll matches a team if any match in its windows has that team as the club's own side (mirrors `PlayerAvailabilityServiceImpl.ownTeamInGame`), and a league if any slot match has that league.
5. **"Players still to answer" for group polls.** `OpenPoll.responded` for group polls means "answered any window", but "still owes an answer" means "has not answered every window" (`repliedCount`). A new `awaiting` set is needed on `OverviewPolls.OpenPoll`.
6. **Closed-poll cap (50)** is applied after filtering today (section); keep league/team filtering before the cap too.
7. **Open question in spec:** phone puts type toggles and sort inside the sheet — plan follows the mockup (spec's recorded approach) unless you object.

## Slices (each its own PR, in this order — matches Rollout Notes)

### Slice 1 — Shared filter model + unified toolbar (frontend only)

Agent: **frontend-builder**, tests by **test-writer**.

- `ui/src/hooks/usePersistedListFilters.ts` — extend (backwards compatible) rather than fork: add optional `reset()`. Keep existing callers unchanged.
- **New** `ui/src/hooks/useAvailabilityFilters.ts` (+ test): owns `{leagueId, sectionId, teamId, seasonId}`, one localStorage key `availability:filters:${clubId}` via `usePersistedListFilters`, mirrored to `?league=&section=&team=&season=` with `useSearchParams` (URL wins on load, then persists; changing section clears team; team value kept when a view doesn't show it; `clearFilters()`). Migration: if the new key is absent, seed from the three old keys (`availabilityPolls:filters`, `playerAvailability:filters`, `availabilityCoverage:filters`) once, then ignore them.
- **New** shared season hook `ui/src/hooks/useAvailabilitySeason` (or inside the filters hook): wraps `listSeasons` + `utils/defaultSeason.pickDefaultSeasonId`, replacing the per-page season queries/derivation in Players and Coverage.
- `pages/manage/availability/AvailabilityHubLayout.tsx` — call the hook, pass `{clubId, filters, setFilters, clearFilters, season...}` via `Outlet` context (today only `clubId`); render season label beside the title on Players/Coverage only.
- `components/ManageScreenHeader` — add an after-title slot (e.g. `titleAdornment`) for the "2026 season ▾" label (small prop extension, no new component); update its test/story.
- **New** `components/FilterBar/` (4-file anatomy: `FilterBar.tsx`, `.test.tsx`, `.stories.tsx`, `index.ts`): desktop card = shared filters in fixed order League, Section (`SectionTreeSelect allowClear`), Team (optional) + search, using `utils/filterPanel.filterPanelSx`; phone = row with search + "Filters" button with active-count `Badge`, bottom sheet copied from `components/MenuSheet` (SwipeableDrawer bottom, handle, "Clear all"/"Done"), removable `Chip`s under the toolbar. Accepts a `viewControls` slot rendered in the sheet on phone.
- **New** small `components/ContentControlsLine` (scope text on the left, view toggles on the right, "soonest first ↕" text link) — or a `FilterBar` sub-export if it stays tiny. Reuse check: `ListToolbar.sortToggle` is the old pattern and stays for other pages.
- Rewire the three views to use the context + FilterBar:
  - `pages/manage/AvailabilityPollsDashboard.tsx`: drop its own persisted `{sectionId,type}`; keep `search`, `showClosed` (still honours `?showClosed=true`), `sort` locally; League/Team filters wired in slice 3 (UI present in slice 1 only where the backend already supports it — Section now; League/Team controls appear on Polls in slice 3).
  - `pages/manage/PlayerAvailabilityPage.tsx`: remove Season/Section/Team/League fields and the half-working "Filters" button; keep `includePast`, `hideUnanswered`, `search`.
  - `coverage/AvailabilityCoveragePage.tsx`: remove its own key/filters; keep `includePast`; still reuses the Players query key with `teamId: null`.
- Poll type becomes two light toggles (Group polls / Squad polls, both default on, last one can't be switched off) — client-side now: replaces the `Type` select (`type: ALL|SQUAD|GROUP` mapping preserved for query-enabling).
- Docs: `docs/standards/frontend.md` — note that availability pages use `FilterBar`, not `ListToolbar` (ListToolbar stays for other pages); `docs/standards/design-system.md` entry for `FilterBar`; `docs/roadmap.md` and `docs/architecture.md` untouched unless relationships change.

Tests (slice 1): `useAvailabilityFilters.test.ts` (shared across tabs, URL sync, persistence, old-key seeding, clear, section clears team), `FilterBar.test.tsx` (desktop order, phone sheet, badge count, chips remove, a11y: labels, aria-expanded), update `AvailabilityPollsDashboard.test.tsx` (Type-filter ~l.529, persisted-section ~l.423, sort ~l.394), `PlayerAvailabilityPage.test.tsx` (layout-order ~l.145, persistence ~l.198-280, phone Filters ~l.431-470), `AvailabilityCoveragePage.test.tsx` (own-key assertions ~l.184-233 become "shares key with Players"), `AvailabilityHubLayout.test.tsx` (season label, context). Stories for `FilterBar`. Playwright: extend `ui/e2e/manager-availability-polls.spec.ts` (mobile + desktop viewport) with one golden path: pick a section on Polls, switch to Players, section still applied, URL carries it.

### Slice 2 — Filtered counters + new wording (backend + frontend)

Agents: **backend-builder** → **frontend-builder** → **test-writer**.

Backend (`$B = backend/src/main/java/com/cricketlegend`):
- `controller/AvailabilitySummaryController.java` — add optional `leagueId`, `sectionId`, `teamId`, `type` (GROUP|SQUAD|ALL), `includeClosed` params (no `seasonId`, see flag 2).
- `service/AvailabilitySummaryService.java` + `service/impl/AvailabilitySummaryServiceImpl.java` — introduce a small request/criteria record (e.g. `AvailabilityFilter`) and apply it. Validate `sectionId` via `accessService.assertCanAdministerSection` and use `sectionAndDescendantIds`, like the poll lists; 404 for another club's league/team like `PlayerAvailabilityServiceImpl.resolveTeamFilter`.
- **Reuse, don't copy**: put the League/Team/Section poll matching in one shared place used by the summary *and* the poll list services (new `service/support` helper, e.g. `AvailabilityPollFilter`) — slice 3 reuses it, so write it here with both squad and group rules (flags 3, 4).
- `service/support/OverviewPolls.java` — add `awaiting` (players who haven't fully answered) to `OpenPoll`; accept the filter so it also covers closed polls when `includeClosed`. `ManagerOverviewServiceImpl` shares this class: keep its behaviour identical (default filter = today's behaviour) and keep its tests green.
- `dto/AvailabilitySummaryDto.java` — rename `answersAwaited` → `playersStillToAnswer` (distinct count), keep `openPolls` (reads "Polls shown" when closed included — semantic is in the UI) , `playersResponded`, `playersInAudience`, `closingSoon`. This is a contract change on the 081 endpoint: update `backend/openapi/openapi.yaml` by hand (`/availability/summary` l.~4577 params; `AvailabilitySummaryDto` schema) per the "don't build under the live backend" rule; only frontend consumes it.
- No migration; no new entities.

Frontend:
- `api/availabilitySummaryApi.ts` — params, key `availabilitySummaryKey(clubId, filters)` (prefix-compatible so `invalidateAvailabilityCounters` keeps working), new field name.
- `AvailabilityHubLayout.tsx` — pass the current filters (+ type toggles + showClosed, which therefore must be lifted into the hub context too) into the summary query; "Players still to answer" label; first counter "Polls shown" when closed are included; a one-line "Showing: Vets › Over 40, League X" under the counters (reuse `utils/sectionBreadcrumb`).
- `ui/src/pages/manage/Overview*` — grep for any other consumer of `answersAwaited`.

Tests: `AvailabilitySummaryServiceImplTest` (filters, distinct players, group "not answered every window"), `AvailabilitySummaryControllerIntegrationTest` (params, 403/404), `AvailabilitySummaryQueryCountIntegrationTest` (statement count still constant with filters), `OverviewPollsTest`, `ManagerOverview*` regression; frontend `availabilitySummaryApi.test.ts`, `AvailabilityHubLayout.test.tsx` (counters follow filters, wording, scope line).

### Slice 3 — League + Team filters on Polls (backend + frontend)

Agents: **backend-builder** → **frontend-builder** → **test-writer**.

Backend:
- `controller/MatchAvailabilityPollController.java` (`/open`, `/closed`) and `controller/SectionAvailabilityRoundController.java` — add optional `leagueId`, `teamId`.
- `service/impl/MatchAvailabilityPollServiceImpl.java` `listScopedPolls`: squad poll matches `match.leagueId == leagueId` and `poll.teamId == teamId`; apply before the `CLOSED_POLLS_LIMIT` cap.
- `service/impl/SectionAvailabilityRoundServiceImpl.java` (l.159-189): group rounds via windows → window-matches → matches, using batched `SectionAvailabilityWindowRepository.findByRoundIdIn` / `SectionAvailabilityWindowMatchRepository.findByWindowIdIn` (extend `roundSpans` batching; no N+1); apply before the 50 cap. Both services call the shared helper from slice 2.
- `backend/openapi/openapi.yaml`: `/availability-polls/open` (l.~4717), `/closed` (l.~4744), `/section-availability-rounds` (l.~2522).
- Any new repository query → Testcontainers integration test.

Frontend: `api/matchAvailabilityApi.ts` (`ListOpenPollsParams` + `leagueId`, `teamId`), `api/sectionAvailabilityApi.ts` (`ListRoundsParams`), query keys in `AvailabilityPollsDashboard.tsx` (l.60-78) include league/team; show League and Team controls in the Polls `FilterBar` (Team options scoped by section as in `PlayerAvailabilityPage`); `isFiltering` includes them; type toggles may now hit the server filter or stay client-side (keep client-side).

Tests: `MatchAvailabilityPollServiceImplTest`, `SectionAvailabilityRoundServiceImplTest`, controller integration tests (`MatchAvailabilityPollControllerIntegrationTest`, `SectionAvailabilityRoundControllerIntegrationTest`, `UnifiedAvailabilityPollsIntegrationTest` with league/team cases incl. the cap), dashboard test cases for League/Team refetch.

## Reuse inventory

`usePersistedListFilters`, `SectionTreeSelect`, `MenuSheet` (sheet pattern), `PageCounters`, `ManageScreenHeader` (extended), `utils/filterPanel`, `utils/defaultSeason`, `utils/segmentedSwitch`, `utils/sectionBreadcrumb`, `AccessService.sectionAndDescendantIds/assertCanAdministerSection`, `OverviewPolls`, `PlayerAvailabilityServiceImpl` filter semantics. `ListToolbar` untouched.

## Verification

- Frontend: `nvm use 22.12.0`, then in `ui/`: `npm run lint`, `npx tsc --noEmit`, `npx vitest run` (changed files + component folder-shape check), Storybook story for `FilterBar`, Playwright mobile + desktop for the golden path.
- Backend (verify in an rsync'd scratch copy, never `mvn` in `backend/` while the IntelliJ app runs): `./mvnw test` incl. Testcontainers integration tests and ArchUnit; hand-edit/regenerate `openapi.yaml`.
- Manual smoke against the running app: pick League/Section/Team on Polls, check cards and counters agree and the scope line; switch to Players/Coverage (filters kept, season label); reload and use back button (URL); phone width: Filters badge, sheet, chips; lazy-loading check on summary/list endpoints (no `LazyInitializationException`, `@Transactional(readOnly = true)` on new service methods).
- Then `/review` (standards-reviewer) before each PR; conventional commits per slice.

## After approval

Copy this plan verbatim to `docs/plans/083-availability-filters-and-toolbars.md` (git-tracked).
