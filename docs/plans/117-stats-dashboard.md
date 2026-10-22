# Plan: 117 Statistics Dashboard (charts for Player and Team statistics)

Spec: `docs/specs/117-stats-dashboard.md` (worktree `/private/tmp/claude-501/-Users-jaco-Development-cricket-platform-v2/e3330e84-b2d8-4c1b-b0d4-0baff10253e5/scratchpad/wt117`, branch `feature/117-stats-dashboard`, on master with 116 merged; mockups canvas https://claude.ai/artifact/2oinhHnKX5DyjZ17W8U7nB v10 approved; `@mui/x-charts` v7 approved 2026-10-22). Compute on read: **no migration, no table, no index**, manager-only. Owner accepted the recommended defaults for the open questions; build first, tests only after the owner reviews.

## Context

Add a Dashboard to the player statistics page (first tab) and the team page (Hide/Show block under tiles and Recent form strip). Each is fed by one read-only series endpoint, `GET /players/{id}/stats/dashboard` and `GET /teams/{id}/stats/dashboard`, carrying 11 charts (player 6, team 5). Every plotted number comes from the existing calculators through two new pure series builders; the client only draws.

## What the code research settled

- **Landing and Stats links need no link edits:** `resolvePlayerStatsTab` falls back to the first tab; making Dashboard first and the fallback makes every `?tab=`-less link (leaderboard rows, Players list, PlayerStatsCard) land on it. Links with `?tab=` are unchanged.
- **Reuse existing reads:** `PlayerStatsFactsRepository.matchPage(ascending=false, limit=301)` (301st row = `truncated`), `matchBatting`, `matchBowling` unchanged; `PlayerMatchRowBuilder.build(headers, batting, bowling, List.of(), List.of())` (no fielding/awards read).
- **Reference lines equal the tab figures by construction:** overall economy and batting average come from the existing `PlayerStatsAggregateRepository.aggregate` counters via a new public `PlayerStatsCalculator.economy(runs, overs)` (the Bowling tab's `bowling()` is refactored to call it); team run rate / NRR use `numeric` overs in SQL and the calculator's existing 40-decimal arithmetic extracted into one method; NRR status comes from the existing team `aggregate`.
- **Wicket types never use `how_out in (...)` in SQL** (`PlayerStatsSqlLiteralsTest` forbids it): the new query returns raw counts per (bowling innings, how_out); `DismissalType.isBowlerCredited()` decides in the calculator.
- **Hoist the dashboard query to the page** (player enabled when `tab==='dashboard'`; team when shown and ready) so it runs in parallel with the page's own read; preload the chart chunk with `import()` in an effect and render it with `React.lazy` + `Suspense` skeleton (first `lazy` use in `ui/src`).
- **`DashboardCard` is library-free** (takes children); only `components/charts/*` import `@mui/x-charts`.
- No MapStruct (builders return DTO records, as `PlayerMatchRowBuilder`). No `TeamStatsSeed` exists: tests extend `PlayerStatsSeed` with an opt-in `seedDashboard()`.
- Named constants in one pure `DashboardLimits` (30 points, 300 history cap, trend span 5, minimum 3 per half, flat bands 0.25 economy / 0.5 dots).

## Owner items: plan's working answers (all changeable)

1. `dependency-cruiser` is not installed: enforce "only `components/DashboardCard/**` and `components/charts/**` import `@mui/x-charts`" with an oxlint `no-restricted-imports` override (config only) plus a small Vitest structural test; no new dependency.
2. Runs-per-innings average line = batting average (Σ runs ÷ dismissals, null with no dismissals).
3. Dot-balls average/trend over the plotted matches that have dots; economy reference and trend over the full scope.
4. Wickets-by-type parity with the Bowling tab's `dismissalModes` is asserted on fixtures without the c > w case.
5. Player points in a derby follow 115 (`derby=true`, opponent null, table shows "Internal match").
6. Playwright type-checked only (as 116) unless the e2e environment is confirmed.
7. The spec file and the dependency commit are separate commits (spec docs commit first).

## Backend (backend-builder), `backend/src/main/java/com/cricketlegend/` (scratch copy for mvn, never the live backend/)

1. **Calculators (pure, additive).** `PlayerStatsCalculator`: public `economy`, `battingAverage`, `matchOvers`/`matchEconomy`, `dismissalCounts`, `splitWickets` (c ≤ w rule, caught-and-bowled own slice, notItemised, coverage), `percent` (1 dp). `TeamStatsCalculator`: public `rate`, `nrrValue` (extracted from `netRunRate()`), `dotsForMatch`, `dotPercent`, `extrasPoint`, pooled-average helpers; result letter via existing `formLine`.
2. **New pure** `StatsTrend` (UP/DOWN/FLAT, last 5 vs 5 before, minimum 3 per half) and `DashboardLimits`.
3. **New pure** `PlayerDashboardSeriesBuilder` and `TeamDashboardSeriesBuilder` (series, windows, coverage, notCaptured; forfeit = results[] only).
4. **Repositories.** `PlayerStatsFactsRepository.bowlingCredits(...)` (all bowling rows left-joined to opposition batting entries credited to the bowler, one row per (innings, how_out), `BowlingCreditView`). `TeamStatsSql`: extract the `rs` CTE as a shared constant (identical text), add `DASHBOARD_RESULTS` (one row per counted team result: match fields, side, own/opp usable runs/wickets/balls/overs, extras components, NRR fields, bowler counters; forfeit innings never read; newest first, limit 301); `TeamStatsFactsRepository.dashboardResults(...)`.
5. **Readers:** extend `PlayerMatchFactsReader` (`toCredit`), add `TeamDashboardFactsReader`.
6. **Services** `PlayerDashboardService(+Impl)`, `TeamDashboardService(+Impl)` (`@Transactional(readOnly=true)`, `StatsScopeResolver` called not copied, 404/403/empty-reach as the existing stats services; small shared player-lookup helper; no person named in logs).
7. **DTOs** `PlayerDashboardDto`, `TeamDashboardDto` (+ prefixed nested records), exactly the spec's series fields; reuse existing scope/basis/notCaptured records.
8. **Controllers:** `PlayerStatsController.getPlayerDashboard` (`.../players/{playerId}/stats/dashboard?seasonId&leagueId&teamId&sectionId&competition`), `TeamStatsController.getTeamDashboard` (`.../teams/{teamId}/stats/dashboard?seasonId&leagueId&competition`), both `canAccessClub`.
9. **Tests that must stay green and be edited:** `LayeringRulesTest` (STATS_SERVICES, exact-users list, `PURE_STATS_CLASSES`, recount of pure classes), `PlayerStatsSqlLiteralsTest.allSql()` (new TeamStatsSql constants).
10. **`backend/openapi/openapi.yaml`** by hand: two paths (operationIds `getPlayerDashboard`, `getTeamDashboard`), schemas, 400/403/404.

## Frontend (frontend-builder), `ui/src/` (`source ~/.nvm/nvm.sh && nvm use 22.12.0` first)

1. **Dependency commit (first build commit):** `npm install @mui/x-charts@^7` (7.29.x, no MUI upgrade, no peer warnings) + the CLAUDE.md UI-library approved-addition sentence (wording from spec question 1).
2. **API:** `api/playerDashboardApi.ts`, `api/teamDashboardApi.ts` (types conformed to the backend DTOs, `usePlayerDashboard`, `useTeamDashboard`, `placeholderData: keepPreviousData`, keys under the existing stats key prefixes so existing invalidations refresh them).
3. **`components/DashboardCard/`** (four-file anatomy, library-free): title, subtitle (Batting/Bowling), coverage caption, 220/280 px chart area, 44 px "View as table" toggle with a real table, loading/empty/error states.
4. **`components/charts/{BarSeriesChart,StackedBarChart,LineSeriesChart,DonutChart,GroupedBarChart}/`**: the only `@mui/x-charts` importers; shared `chartTheme.ts` (theme-token colours, hatch patterns, reduced-motion), optional dashed reference line, no dual axis.
5. **Extract the Matches tile strip** to `playerStats/PlayerHeadlineTiles.tsx` (same `tile-*` ids and formatting); `MatchesTab` renders it unchanged.
6. **Player page:** `playerStatsTabConfig` gets `dashboard` first (fallback), page-level `usePlayerDashboard` + chunk preload; `playerStats/dashboard/` with `PlayerDashboardTab` (tile strip then lazy charts), the six cards in the spec's order (Runs per innings full width, How you were dismissed + Batting trend, Wickets per match full width, Wickets by type + Economy rate), `dashboardFormat.ts`.
7. **Team page:** `TeamStatsPage` hoisted `useTeamDashboard` (enabled when ready and shown), `TeamDashboardBlock` (Hide/Show, `aria-expanded`, per-visit state) directly after `TeamFormStrip`, five cards in `teamStats/dashboard/` (results donut, runs scored v conceded, run rate trend, extras conceded stacked, dot balls).
8. **Stories:** `DashboardCard` variants and one small story per chart wrapper.
9. **Docs in the build PR:** `frontend.md`, `backend.md`, `design-system.md`, `roadmap.md` (Active row + "Deferred by 117"), one-line pointers in specs 103/115/116; copy this plan to `docs/plans/117-stats-dashboard.md`.

## Order and slices

- **0.** Docs commit of the spec file, then **A.** dependency + CLAUDE.md commit (gate: clean install, `npm run build`).
- **B.** Backend series (calculators, trend, builders, SQL, readers, services, DTOs, controllers, ArchUnit/literals, openapi) in parallel with **C.** player Dashboard UI, which starts with a one-chart spike (Runs per innings: hatch patterns, custom not-out bar, gaps, dashed reference line, reduced motion, jsdom render, chunk size), then `DashboardCard`, wrappers, tile extraction, tab change, six cards.
- **D.** Team Dashboard UI (needs B's team part; may ship as a separate PR).
- **E.** Owner hand-check, then test-writer (backend unit, integration/parity/query-count/controller, frontend, import-restriction rule), then standards-reviewer, docs, PR. Existing tests that will change: `playerStatsTabConfig.test.ts`, `PlayerStatsPage.test.tsx`, `TeamStatsPage.test.tsx`, `manager-player-stats.spec.ts` landing assertion.

## Verification

- Backend (scratch copy): compile, `LayeringRulesTest`, `PlayerStatsSqlLiteralsTest`, existing 103/115/116 tests unchanged (proves the refactors); EXPLAIN and payload size in the PR.
- Frontend: `npm run lint`, `npm run build` (record the lazy chunk size, confirm `@mui/x-charts` is not in the main chunk), vitest on touched folders only.
- Owner manual: Season change moves tiles and charts together; View as table sums equal the tiles; Economy reference = Bowling tab Econ; team Hide/Show; 375 px phone.

## Risks

x-charts v7 pattern fills and custom bar slots unproven here (spike first; fallback outlines plus direct labels); `DASHBOARD_RESULTS` size (budget 200 ms p95; fallback fetch after first paint); parity holds only for untruncated scopes (captions say so).
