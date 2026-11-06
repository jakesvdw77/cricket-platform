# Plan 145: Player Hub Results (Results main item, hero plus carousel, Show In Player Hub flag)

Implements `docs/specs/145-player-hub-results.md` (approved 2026-11-06, all open questions resolved or on defaults). Backend and frontend, one PR. Branch `feat/145-player-hub-results` (spec, mockups rounds 1 to 4, roadmap row and the ball standards note are already committed there). Approved visual direction: `docs/mockups/player-hub-results-round4-mockup.html`.

## Context
A parent in the Player Hub can see upcoming matches but not what has happened; Schedule > Results is a "Soon" slot. The data is already counted correctly for managers (`PlayerMatchListService`, `PlayerStatsService`). This plan adds (1) a per-result **Show In Player Hub** flag with manager controls, (2) three player-facing reads over the existing stats services (no second copy of any counting rule), and (3) the Hub UI: Results as the second main item, a hero plus a no-peek carousel of result cards, a Season dropdown plus Team tabs (multi-team players only) plus a League filter sheet, and a Hub Result page with the full scorecard and names. Stats screens stay "Soon"; the same reads and page frame are their foundation.

## Findings that shape the design (verified in code)
- **The stats services return nothing for a Hub user.** `PlayerMatchListServiceImpl.list` and `PlayerStatsServiceImpl.get` call `StatsScopeResolver.resolve(authentication, ...)`, which narrows by manager section reach; a parent gets `nothingInReach` and an empty result. They cannot be called as they are.
- **`PlayerStatsSql.APPEARANCES` (line 22) has no `visible_to_players` condition** and every stats query starts from it. The flag must be added there behind a default-off parameter so manager stats are unchanged.
- **No published, flag-gated scorecard read exists.** `ScorecardService` is manager-only; `ScorecardService.load(UUID resultId, Match)` has no auth but is not a public read. ArchUnit pins who may touch `MatchResult` and the scorecard entities (`noMatchResultAccessOutsideTheResultServices`, `theResultDataOwnersAreExactlyWhoWeExpect`), so the new read must live in `ResultServiceImpl`/`ScorecardServiceImpl`, not in a new class that touches repositories.
- **Publish and unpublish are keyed by `matchId`** (`POST /api/v1/manage/clubs/{clubId}/matches/{matchId}/result/publish` and `/unpublish`) and are not audited beyond `published_at/by`; `unpublish` does not touch any visibility field today.
- **The Hub nav is pinned by tests**: exactly seven main items, two levels (`hubNav.test.ts`, `HubMenu.test.tsx`, `MyPlayerPage.test.tsx:59` `ROOT_BARS`). `account` today holds real pages (Invitations, Link requests, Link more players, Sign out) with pill counts, rendered by `MyPlayerPage` through `HUB_NAV` resolution.
- **`WizardFooter` has no slot for a switch**; the capture Review step publishes through a `ConfirmDialog` ("Players will be able to see this result.").
- **`openapi.yaml` is maintained by hand** (no contract-diff CI step; the real test is `LinkedAccountCannotReachManagerSurfaceIntegrationTest`, which requires every new `/api/v1/manage/**` operation to be in the file and protected). Never run `mvn` in `backend/` under the live IntelliJ app: verify in an rsync'd scratch copy.

## Points to confirm (the plan applies the stated default; nothing is silently reinterpreted)
1. **Flag endpoint path.** Spec says `.../results/{resultId}/player-visibility`; every existing result endpoint is keyed by `matchId`. **Default: `POST` and `DELETE /api/v1/manage/clubs/{clubId}/matches/{matchId}/result/player-visibility`**, same authorization as publish. Shape and rule unchanged.
2. **"Audited like publish".** Publish has no audit log, only `published_at/by`. **Default: `visible_to_players_at` and `_by` columns**, the same level.
3. **A fourth read, `GET /me/players/{key}/results/filters`** (seasons, teams, leagues the player has flagged results in). The spec's API table lists three; Decision 4 ("only offer values with data") needs this fourth, wrapping the existing `PlayerStatsService.filterOptions`.
4. **Account moves to the avatar: where do Invitations and Link Requests go?** They are pages with counts. **Default:** the header avatar menu (`AccountShell`) gains Invitations (count), Link Requests (count) and Link More Players beside Switch Profile, Back To Club and Sign Out; `account` stays a route target in `hubNav.ts` but is `inMenu: false` (not listed, not one of the seven). The count badge moves to the avatar.
5. **Existing Hub reads that show a result line** (`MyMatchServiceImpl` Recent rows, `MyLeagueServiceImpl`) use `ResultService.publishedResults` with no flag. **Default: leave spec 135 and 123 unchanged** (headline result only); the flag gates Results, the summary, the filters and the Hub Result page. Say if Recent matches should also hide a result with the flag off.
6. **Review step switch placement.** The wizard footer has no slot, so **the "Show In Player Hub" checkbox goes in the Publish confirm dialog** (off by default), and that dialog's text "Players will be able to see this result." is corrected (publishing no longer shows it to players).
7. **Shared stats SQL changes** (two new default-off parameters). Manager stats must not change: the existing parity and query-count tests must stay green; the ArchUnit pins (stats repository users, 89 pure classes) are not touched because no new repository user and no new pure class is added.

## Design

### Backend (backend-builder)
**Slice A, the flag and manager control**
1. `db/changelog/v1/061-result-visible-to-players.sql` (+ include in `db.changelog-master.xml` after 060): `ALTER TABLE match_result ADD COLUMN visible_to_players BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN visible_to_players_at TIMESTAMPTZ, ADD COLUMN visible_to_players_by UUID;`. No backfill (Decision 8).
2. `domain/MatchResult` (3 fields, builder default false); `dto/MatchResultDto` (+`visibleToPlayers`; update `withPlayingAreaName` and `copyWithScorecardFlags`); `mapper/MatchResultMapper.applyDraft` ignores the three new targets; `toDto` maps the flag.
3. `service/ResultService` + `service/impl/ResultServiceImpl`: `setPlayerVisibility(authentication, clubId, matchId, boolean visible)` (gate `matchService.requireAdministrableMatch`; 409 `InvalidStatusTransitionException` unless PUBLISHED; sets flag, `_at`, `_by`). **`unpublish` also clears the flag, `_at`, `_by`** (spec rule). Imported and new results stay false by default.
4. `controller/MatchResultController`: `POST` and `DELETE .../matches/{matchId}/result/player-visibility`, `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")` like publish.

**Slice B, the Hub reads**
5. Stats scope: add `boolean playerVisibleOnly` and `UUID matchId` (nullable) to `StatsScope`; `PlayerStatsSql.APPEARANCES` gains `and (:playerVisibleOnly = false or r.visible_to_players)` and `and (:matchId is null or r.match_id = :matchId)`; bind both in `PlayerStatsAggregateRepository` and `PlayerStatsFactsRepository` (every call site of `APPEARANCES`). `StatsScopeResolver` gets a held-player variant (unrestricted section reach, `sectionTeamIds = null`, still validates season, league and team belong to the club, `playerVisibleOnly = true`).
6. `PlayerMatchListService` and `PlayerStatsService`: extract the body after the resolve into methods that take a prepared scope (`PlayerStatsServiceImpl.readFacts(StatsScope, playerId)` already exists) and expose them as `listForHeldPlayer` / `getForHeldPlayer` / `filterOptionsForHeldPlayer`, so `MyResultServiceImpl` reuses `PlayerMatchRowBuilder` and `PlayerStatsCalculator` untouched.
7. Published, flag-gated scorecard read inside the result services (ArchUnit owners): `ResultService.visibleResult(clubId, matchId)` and `ScorecardService.readForPlayers(clubId, matchId)`: only `PUBLISHED && visible_to_players`, else `NotFoundException`.
8. `service/MyResultService` + `service/impl/MyResultServiceImpl` (`@Service`, `@Transactional(readOnly = true)`, `MyPlayerAccess.resolve` first, club and player ids from `HeldPlayer`, hand-built records like `MyMatchServiceImpl`; result words via `LeagueResultText`, header data via `resultService.publishedResults`): `list`, `summary`, `filters`, `get`. The held player's own card on `get` is the `PlayerMatchRowDto` for that match from the same list read with `matchId` set, so it equals the manager figures by construction; a match outside the held player's counted rows is 404. Names come out in full (Decision 7); dismissals carry type plus bowler and fielder names; `resultId` and other internals are not exposed.
9. `dto/MyResultListDto`, `MyResultRowDto`, `MyResultSummaryDto` (totals plus the last five rows for the streak), `MyResultFiltersDto`, `MyResultDto` (header, innings, `mine`, full scorecard with names). `MePlayersController`: `GET /{playerKey}/results`, `/results/summary`, `/results/filters`, `/results/{matchId}` (params `seasonId`, `teamId`, `leagueId`, `page`, `size`), one-liners like the existing ones.
10. `openapi.yaml` merged by hand: the manager visibility operations, the four `me` reads, schemas (additions only).

### Frontend (frontend-builder)
**Slice C, the manager controls** (`pages/manage/results/`, `api/matchResultApi.ts`)
11. `MatchResult.visibleToPlayers` (+ `setResultPlayerVisibility(clubId, matchId, visible)`), fixture default in `test/resultFixtures.ts`.
12. `ResultDetailPage`: `show` / `hide` items in the one Manage Result menu after the status transitions (disabled with a reason on a draft: "Publish the result first"), an "In Player Hub" chip beside Published; the same chip on `ResultCard` and `ResultTable`. `ResultCapturePage` Review: the checkbox in the Publish confirm dialog (off by default), call after a successful publish, dialog text corrected.

**Slice D, the Hub**
13. `hubNav.ts`: new order `availability`, `results` (leaf), `schedule` (Matches, Leagues, Team sheets; Results child removed), `stats`, `updates`, `club`, `profile`; `account` becomes `inMenu: false` (route target only); `LEGACY_REDIRECTS` gains `schedule/results` to `results`; `hubBack` gets the `results/:matchId` case ("Back to Results", same query string); pill bubbling moves the Account counts to the avatar. `AccountShell` avatar menu: Invitations (count), Link Requests (count), Link More Players, Switch Profile, Back To Club, Sign Out.
14. `api/meResultsApi.ts` (keys `['me','players',key,'results',...]`, `useInfiniteQuery` list like `usePlayerMatches`, summary, filters, detail; `retry: false`).
15. `pages/view/myPlayers/`: `HubResults.tsx` (header Season select in the Hub dark style via `darkFieldSx`, `HubTeamTabs` only when more than one team, filter button plus League `BottomSheet tone="dark"`, hero, `HubResultCarousel`, All Cards list, "No matches for this filter" with Clear Filters, empty "No results yet"), `HubResultCard.tsx` (batting, bowling, did-not-bat, milestone variants; scope label; "Next: ..." label), `HubResultCarousel.tsx` (full-width cards, gap wider than the margin so no next card shows, counter, arrows, dots, keyboard), `HubResult.tsx` (result page: header, own card first, full scorecard, footer Back), `resultsFormat.ts` (pure words and figures). Scope: URL params win, saved per player with `usePersistedListFilters('hubResults:filters:'+playerKey, ...)` as the fallback.
16. Own SVG drawings, one shared folder `components/ResultDrawings/` (`RunsMixBar`, `OverBlocks`, `drawingMath.ts` pure scale and path helpers, text alternative, reduced motion), four-file anatomy plus stories. No chart library for this slice; the cricket ball (if drawn) uses `BallArt` (straight seam rule).
17. Docs: `docs/standards/design-system.md` (Player Hub results and the drawings rule), `page-anatomy.md` (result page bullet and review log), `docs/specs/121` (menu), `docs/standards/frontend.md`, roadmap row 145, `openapi.yaml` note.

### Order
A (backend flag) then B (backend reads, `openapi.yaml`) then C (manager controls) then D (Hub) then docs. Within D: `hubNav` and avatar first (smallest blast radius to existing tests), then the API client, drawings, carousel, Results page, Result page.

## Who does what
- **backend-builder:** steps 1 to 10.
- **frontend-builder:** steps 11 to 17.
- **test-writer** (after the owner has checked the function, the standing rule): everything below.
- **standards-reviewer:** before the PR.

## Tests (per `docs/standards/testing.md`)
- **Backend unit:** `setPlayerVisibility` (draft 409, published ok, unpublish clears), the held-player scope (unrestricted reach, club validation), the DTO mapping.
- **Backend integration (Testcontainers, copy `MyPlayerMatchesIntegrationTest`):** authorization matrix (key not held, malformed, dropped out, another account, manager role without link: 404; unauthenticated 401; SUSPENDED 403); a flag-off result is absent from list, summary, filters and 404 on `get`; unpublish removes it; another club's result 404; **parity** (rows equal `basis.matchesCounted` and tiles equal the `103` totals for the same scope, as `PlayerMatchListParityIntegrationTest`); **exact JSON keys** per DTO; the migration applies with existing rows; the manager stats reads (`APPEARANCES` default) unchanged: the existing stats parity and query-count tests stay green.
- **Contract and layering:** `LinkedAccountCannotReachManagerSurfaceIntegrationTest` with the new operations; ArchUnit unchanged and green.
- **Frontend unit and component:** `hubNav` (seven main items in the new order, two levels, `account` not listed but resolvable, Schedule children, redirects), `HubMenu`, `MyPlayerPage` (`ROOT_BARS`, avatar menu entries and counts), `hubBack` (results states), `resultsFormat`, `drawingMath`, drawings (a11y text, reduced motion), `HubResults` (hero, streak, carousel arrows, counter, dots, scope sheet, Team tabs only for multi-team, empty and filtered-empty), `HubResult`, manager Manage Result items, chip, Review dialog checkbox and corrected text; stories for the drawings. Hub tests copy `HubMatches.test.tsx` (`routeApi`, `renderRoutes`).
- **Not run:** Playwright; the 375 px sweep, the real scroll position on Back, and a hand-check of the carousel on a phone are the owner's.

## Verification
1. Backend: rsync `backend/` to a scratch copy (never `mvn` under the live app), `./mvnw -B verify` there; regenerate nothing: `openapi.yaml` is merged by hand and checked by the layering and link-user tests.
2. Frontend: `cd ui && source ~/.nvm/nvm.sh && nvm use 22.12.0 && npx tsc -b && npx oxlint`, then run test folders separately (the full suite flakes under load).
3. Manual: publish a result, switch Show In Player Hub on, open the Hub as a linked parent: Results is second in the menu, the hero, carousel, scope (try a two-team player), the Result page with names and Back; switch it off or unpublish and confirm it disappears everywhere; Invitations and Link Requests still reachable from the avatar.
4. After the owner's check: tests, standards review, PR, and update the PR test plan.

## Risks
- Changing `APPEARANCES` touches every manager stats query; mitigated by default-off parameters and the existing parity and query-count tests.
- The avatar move changes several Hub tests and the Account page routing; it is isolated to `hubNav.ts`, `AccountShell`, `MyPlayerPage` and their tests.
- `PlayerStatsFactsRepository` binds many named parameters; a missed bind fails at runtime, so every call site must be updated together (the integration tests cover it).
