# Plan 147: Player Hub Stats (My stats, Team stats, Leaderboards as flip cards on one registry)

Implements `docs/specs/147-player-hub-stats.md` (draft 2026-11-07 plus its **AMENDMENT**: no club switch, no migration `063`, rankings shown to every held player while the owner takes legal advice, and its **Addendum**: Extras and Bowling discipline cards, card system built in a shared location). Branch: continue on `feat/145-player-hub-results` (nothing is pushed; the owner will decide PR boundaries), commits local only.

## Context
The Hub Stats group is three Soon panels. The figures exist for managers (`103`, `116`, `117`) and the held-player access, flagged-results-only rule and Results frame exist (`145`). This plan builds the three Stats pages as flip cards on an extensible card registry (the owner will add many more cards), with every number from the existing calculators. The owner wants to **see the cards early**, so the order puts a visible My stats page ahead of Team stats and Leaderboards.

## Findings that shape the plan (verified in code)
- **Only the player stats service, the match list and `MyResultServiceImpl` have held-player variants.** `PlayerDashboardServiceImpl`, `TeamStatsServiceImpl`, `TeamDashboardServiceImpl` and `LeaderboardServiceImpl` all call `StatsScopeResolver.resolve` (manager reach). Held-player variants are needed for dashboard series, team stats, team dashboard and leaderboards (`StatsScopeResolver.resolveForHeldPlayer` at `service/support/StatsScopeResolver.java:86`; `StatsScope.playerVisibleOnly` already exists).
- **`TeamStatsSql` (`TEAM_RESULTS` :113, `TEAM_INNINGS` :153) has no `visible_to_players` predicate.** It gets the same default-off parameter `PlayerStatsSql` has (`:56`); manager reads pass false. `TeamStatsSqlLiteralsTest` pins the literals and must be updated deliberately.
- **Calculators lack most new figures.** `PlayerStatsCalculator` has no rolling average, bands, by-innings-number, by-opposition, dismissed-by, wickets-by-position, milestones, home/away or by-season; `TeamStatsCalculator` has `ExtrasFigure` but no home/away or by-season. All new figures are added to the calculators (never builders, mappers or the client).
- **ArchUnit (`LayeringRulesTest`)**: `ownersRegex()` allow-list for stats repositories, `PURE_STATS_CLASSES` regex and an asserted count (~:200) must be updated for any new pure class or nested type; new services must be reachable through the existing stats services as the spec intends.
- **No FlipCard exists.** `components/Card`, `components/FormStrip` are the four-file anatomy examples; `components/ResultDrawings` (`drawingMath.ts`, `RunsMixBar`, `OverBlocks`) is the model for `components/StatsDrawings`.
- **`HubResults.tsx` (419 lines)** holds the scope controls (Season select :266, Filters panel/sheet :301/:408, chips :53, tags :93, persistence :138). Extract them to `HubScopeControls` first.
- **Routing**: stats leaves are `soon: true` in `hubNav.ts` (:64-70); `MyPlayerPage.tsx` falls through to `HubSoonPanel` at :233; `hubBack` (`hubNav.ts:254`) has a `results/:matchId` case to extend with a stats origin.
- **`openapi.yaml` is maintained by hand** (me/players paths from ~:2162); `LinkedAccountCannotReachManagerSurfaceIntegrationTest` is the real contract check. Never run `mvn` in `backend/` under the live IntelliJ app: use an rsync'd scratch copy.

## Points to flag (the plan applies the stated default, nothing is silently reinterpreted)
1. **Shared card system location.** The spec body puts everything under `pages/view/myPlayers/stats/`; its Addendum says the card contract, shell, flip and drawings go in a shared location so the manager spec can reuse them. **Default: `components/FlipCard`, `components/StatsDrawings`, `components/StatsCards/` (shell, grid, contract types) are shared; the registry, groups and the card files stay under `pages/view/myPlayers/stats/`** (a later manager registry sits beside its own pages). The "page imports no card" guards apply to both.
2. **Amendment seam.** `HubRankingPolicy.allowsRankings(club)` (always true) is one backend class plus one UI helper; no `clubSwitches.leaderboards`, no `hub-settings`, no migration. Roadmap already carries the open legal item.
3. **Leaderboard reach default** (flagged results in leagues the held player's teams played in that season) needs a Hub-only optional `StatsScope` league-ids restriction in the aggregate SQL; manager reads pass null. Alternative (club-wide) is a one-line change if the owner prefers.
4. **`mine.fires` and `mine.fielding` ranking lines** are shown (amendment), via `HubRankingPolicy`.
5. **Guide values for juniors** (15/30, 20/40, 30/50) and **close-game constants** (20 runs, 2 wickets) are proposals in the spec; built as named server constants so a correction is one line.

## Design

### Slice 0: Foundations, no cards (frontend-builder)
1. Extract `HubScopeControls` from `HubResults.tsx` (Season select, Filters panel and sheet, chips, removable tags, quiet single-league line, persistence hook wiring), re-point Results at it, **no behaviour change** (Results tests pass unchanged).
2. `components/FlipCard` (four-file anatomy + stories): real stretched `<button>`, `aria-pressed`, both faces always in the a11y tree, hidden-face controls `tabIndex -1` via a `FaceActive` context, 3D flip ~0.7 s, 150 ms cross-fade under `prefers-reduced-motion`, faces share one grid cell (no fixed height), state local and reset on scope change.
3. `components/StatsCards/`: `StatsCardShell` (title row, data-tag chip HAVE/PARTLY/NOT CAPTURED with the word, Flip hint, scope label, "Based on N of M results", states ready/partial/empty/missing), `StatsCardGrid` (`repeat(auto-fit, minmax(310px, 1fr))`, headed groups on wide screens, `HubPillStrip` group selector on a phone via `?group=`), contract types (`StatsCardDef<P>`, `NeedsPath<P>`).
4. `components/StatsDrawings/` (own SVG; extends `drawingMath` patterns): line with guides and running average and hollow-dot links, donut, bars, progress bars, sparkline; each with a text alternative.
5. `pages/view/myPlayers/stats/`: `statsCardRegistry.ts`, `statsCardGroups.ts`, `statsFormat.ts` (formatting only), and `api/meStatsApi.ts` (types, keys `['me','players',key,'stats'|'team-stats'|'leaderboards',...]`, hooks `useMyStats`, `useMyStatsInnings` (infinite), `useMyTeamStats`, `useMyLeaderboard` (infinite), `useMyStanding`, `useMyBoardsFilters`; `retry: false`).
6. New brand tone tokens in `brandTokens.ts` only where missing (no inline hex).

### Slice 1: Backend My stats (backend-builder)
1. `PlayerStatsCalculator` additions with unit tests: `bands` (0-9, 10-29, 30-49, 50+ with drill tokens), `rolling` last-5 average and trend hint, `guides` per age band (`ageBand` from the player's age on the latest counted match), `byInningsNumber`, `byOpposition`, `dismissedBy` (+ `notRecorded`), `wicketsByPosition` (OPENERS 1-2, MIDDLE 3-6, TAIL 7-11, caught-by fielders), `milestones` (next round numbers, personal bests), `teamRecordWhenScoring` (30+), `homeAway` (+ unknown-field count), `bySeason` (Season filter ignored for this block), bowling discipline (wides, no-balls, per over; byes and leg byes never charged to a bowler). New fact queries are methods on the existing stats repositories under the shared `PUBLISHED`, `PLAYED_RESULT`, `playerVisibleOnly` predicates; reached only through stats services.
2. Held-player variant of `PlayerDashboardService` (series: `battingInnings`, `dismissals`, `battingTrend`, `bowlingMatches`, `wicketTypes`, `economySummary`).
3. `service/MyStatsService` + `impl` (`@Transactional(readOnly = true)`, `MyPlayerAccess.resolve` first, club and player from `HeldPlayer`), `dto/MyStatsDto` and `MyStatsInningsPageDto`, pure `StatsDrillFilter` in `service.support` (enumerated tokens advertised by the payload; unknown value 400; `HISTORY_CAP` 300, `truncated`, server-side paging), `HubRankingPolicy` (always true) with `standing` and `teamFieldingRank` filled through it (slice 4 supplies the ranker; null until then).
4. New thin `controller/MePlayerStatsController` (same base `/api/v1/me/players`): `GET /{playerKey}/stats` and `/stats/innings`; 404 not held/malformed/dropped, 403 suspended, 400 bad competition or drill kind/filter.
5. `openapi.yaml` additions; ArchUnit `ownersRegex()`, `PURE_STATS_CLASSES` and its asserted count updated for new classes.

### Slice 2: My stats page and cards (frontend-builder) , OWNER CHECKPOINT 1: "see the cards"
1. `hubNav.ts`: `stats.mine` loses `soon`; `MyPlayerPage.tsx` branch for `stats.mine` (and the drill sub-view `stats/mine/innings`); `hubBack` stats origin for `results/:matchId` ("Back to My Stats", scope query restored) and for the drill ("Back to My Stats").
2. `stats/HubMyStats.tsx` (page frame via `HubPageHeader`, `HubScopeControls`, loading skeletons, error + Retry, "No stats yet", "No matches for this filter") and `stats/HubStatsDrill.tsx`.
3. Cards, one file each in `stats/cards/mine/`, registered in `statsCardRegistry.ts`: `mine.season`, `mine.innings` (line + guides + links to Result), `mine.dismissals`, `mine.bands`, `mine.innings-number`, `mine.milestone`, `mine.fires`, `mine.bowling`, `mine.wickets-how`, `mine.discipline` (addendum), `mine.fielding`, `mine.availability`, `mine.homeaway`, `mine.seasons`; the closing "Not captured yet" panel.
Checkpoint: owner views the page in the browser; changes land before slices 3 and 4.

### Slice 3: Team stats (backend-builder, then frontend-builder)
- Backend: `TeamStatsSql` gains the default-off `playerVisibleOnly` predicate (manager reads unchanged; `TeamStatsSqlLiteralsTest` updated); held-player variants of `TeamStatsService` and `TeamDashboardService`; `TeamStatsCalculator` additions (`contribution` top-five + Others + Extras with guests grouped, `battingFirst`/`chasing`, `tossWon`, `headToHead`, `squad`, `closeGames` with `CLOSE_RUNS`/`CLOSE_WICKETS` constants, extras card data from `ExtrasFigure`); `MyTeamStatsService`/`MyTeamStatsDto`; `GET /{playerKey}/team-stats` (teamId required and must be one of the player's teams, else 404).
- Frontend: `hubNav` flip for `stats.teams`, `HubTeamStats.tsx` (Team chips only for multi-team players), cards `team.season`, `team.contribution`, `team.extras` (addendum), `team.first-chasing`, `team.squad`.

### Slice 4: Leaderboards (backend-builder, then frontend-builder)
- Backend: Hub-only `StatsScope` league-ids reach honoured by one predicate in the aggregate SQL (manager null); held-player `LeaderboardService` variant; `MyLeaderboardService` (tables with `more` column flags, `mine`, `me` row, 5,000-player ranker guard, server paging), `standing`, `awards` (category leaders only for a season that has ended), `filters`; endpoints `GET /{playerKey}/leaderboards/{group}`, `/standing`, `/awards`, `/filters`; `HubRankingPolicy` consulted.
- Frontend: `hubNav` flip for `stats.boards` (always visible), `HubLeaderboards.tsx` (tabs Batting/Bowling/Fielding/Awards, Sort by, heading-tap sort with `aria-sort`, More Columns, own row gold + `aria-current`, Jump to, sample and minimum note, Awards before/after season end), `boards.standing` card first.

### Slice 5: Docs
`design-system.md` (Player Hub stats section), `frontend.md` (registry rule, one-payload rule, no-export rule, `HubScopeControls`), `backend.md` (Hub reads of 103/116/117, flagged-only on team SQL, leaderboard reach, drill cap), `roadmap.md` (147 status), specs `121`, `103`, `145` notes, `page-anatomy.md` review-log row, `hubStatsNoExport` guard noted.

## Who does what
- **frontend-builder:** slices 0, 2, and the frontend halves of 3 and 4, docs.
- **backend-builder:** backend halves of 1, 3, 4 (incl. `openapi.yaml`, ArchUnit allow-list updates).
- **test-writer:** after the owner has checked the function (standing rule): everything under Tests.
- **standards-reviewer:** before the PR.
- Work in slices, each committed locally; the owner checks slice 2 first.

## Tests (per `docs/standards/testing.md`; written after the owner's function check)
- **Backend unit:** every new calculator figure incl. null and zero-denominator cases, `StatsDrillFilter` tokens, guides per age band, leaderboard `more` flags and reach input, `HubRankingPolicy`.
- **Backend integration (Testcontainers, copy `MyPlayerMatchesIntegrationTest` and the parity tests):** access matrix (404/403/400), flagged-only (flag-off, draft, unpublished absent everywhere incl. other players' leaderboard figures), parity (`MyStatsDto` blocks equal `PlayerStatsService.getForHeldPlayer`; Σ equals the Results summary; drill rows sum to their figure; team figures equal `TeamStatsService`; leaderboard row equals the player's `MyStatsDto`; `bySeason`), exact JSON keys for every new DTO, query count for `stats`, `stats/innings`, `team-stats`, a leaderboard page, manager reads unchanged (`103`/`115`/`116`/`117` suites untouched), `LinkedAccountCannotReachManagerSurfaceIntegrationTest` with the new operations, ArchUnit green.
- **Frontend:** registry guards (unique ids/orders, `needs` paths, no hex, no "you/your"), page/grid/shell/FlipCard import no card, `hubStatsNoExport`, `pageAnatomyGuard` green, `FlipCard` (button role, keys, `aria-pressed`, both faces readable, reduced motion), shell states, each card family on full/partial/empty/missing fixtures, the three pages, drill, leaderboards, `hubNav` and `hubBack` cases, `HubResults` unchanged after the extraction; Storybook for FlipCard, drawings, each family, and a "future card" story.
- **Not run:** Playwright; the 375 px sweep, keyboard and screen reader passes, reduced motion and 200 percent zoom are the owner's.

## Verification
1. Backend: rsync `backend/` to a scratch copy, `./mvnw -B verify` there (never under the live app); `openapi.yaml` merged by hand.
2. Frontend: `source ~/.nvm/nvm.sh && nvm use 22.12.0`, `npx tsc -b`, `npx oxlint`, then targeted vitest per slice, one full run at the end (re-run load-timeout files with `--maxWorkers=2`).
3. Manual after slice 2: open Stats, My stats for a linked parent with flagged results: cards flip, the innings dots open the Result page, tiles drill, Season/Filters change the request and URL, phone pill row shows one group; Back from a Result returns to My stats with the scope. After slices 3 and 4: Team stats for a two-team player, Leaderboards with the own row highlighted.
4. Per the owner's standing rule: no tests or builds run until the owner says; the owner checks each slice first.

## Risks
- Calculator and fact-query additions touch shared statistics code: mitigated by default-off parameters and the existing `103`/`115`/`116`/`117` suites staying green untouched.
- `TeamStatsSql` literal tests and ArchUnit counts are pinned: update them deliberately in the same change.
- The reach predicate is the only new filter in the shared aggregate SQL: pin with the leaderboard parity and query-count tests.
- Flip card accessibility (both faces in the tree) and the 3D transform at 200 percent zoom: covered by component tests and the owner's manual pass.
