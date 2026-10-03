# Plan 071 — League Card Redesign

Implements `docs/specs/071-league-card-redesign.md` (approved; design approved, `072` already merged as `54ed10f`). Design: https://claude.ai/artifact/SkLSFF8G4yaTUqJ4cJvmQo (version 10). Branch: `feature/071-league-card-redesign` (off master; spec is already on master).

## Context

The Leagues list card is flat and unlike the Match and poll cards. This rebuilds it on `RecordCard` (badges above a wrapping title, stacked icon details, a "Matches played" progress block, an all-teams avatar row, social icons, a Schedule / Teams / Conditions / Edit footer that deep-links into the `072` views) and adds a persisted Format filter on the shared card grid. The extra data (match counts, first/last/next match dates, season teams) arrives as additive `LeagueDto` fields on the existing list response, computed in batched queries.

## Findings that shape the plan

1. **Backend is an additive list enrichment**, the same shape as `069`'s match list and `070`'s propagation work: `LeagueServiceImpl.list` already batch-computes the current-season fields once (`resolveCurrentSeasonId`, `countDistinctTeamsBySeasonId`, `LeaguePlayingConditionsRepository.findBySeasonId`); three new batch queries join it. `LeagueDto` is a record, so its constructor call sites (`LeagueServiceImpl`, tests) fan out; `LeagueMapper.toDto` gets `ignore = true` for the six new fields; `withCurrentSeasonFields` takes a small private holder record instead of a growing argument list (no nested/synthetic classes in `service.impl` per ArchUnit: use a top-level helper or a record in `dto/`/`service/support/`, not a nested class).
2. **`now` is read once per `list()`** (`ServerClock.now()`, new beside `startOfToday()`) and passed into the match aggregate, so played + to-go always equals the count; a match exactly at `now` is to-go and is the next match.
3. **N+1 guard test** (Hibernate statistics, query count equal for 1 vs 12 leagues, no ambient test transaction) is a new test style here; the builder checks whether statistics are already enabled in the test config and, if not, enables them in the test only.
4. **Shared extractions touch Match card code** (`DetailLine` from `MatchCard.tsx`, `CardProgressBar` from `SelectionBlock.tsx`): behaviour-preserving, existing Match tests must pass untouched. Also `SocialLinksRow` gets a `website` icon, `nextMatchCountdown.ts` exports `resolveCountdownLabel`, `pollHelpers.ts` gets `formatMatchDate`.
5. **`LeagueList.tsx` helpers** (`badgeFor`, `leagueSeasonBadges`, `leagueRecordFields`) were kept by `072`; with `LeagueDetailPage` gone they are deleted here (builder greps for stray importers first); their tests are rewritten against the new card, not kept for dead code.
6. **Team count badge** = `teams.length` (own + active league teams) from `leagueBadges` (built in `072`); `currentSeasonTeamCount` and `currentSeasonPlayingConditionsUrl` stay on `LeagueDto` untouched.
7. **Backend restart needed** for the real UI check (new fields); the frontend can be built against mocks first.
8. Process constraints from earlier work carry over: backend built/tested ONLY in an rsync'd scratch copy (never mvn in `backend/`), Node 22 via nvm, one heavy command at a time with `uptime` checks, no `git stash`, never touch the user's `CricketlegendApplication.java` / `055` / `058`.

## Part 1 — Backend (`backend-builder`)

**B1.** `service/support/ServerClock.now()`. `repository/MatchRepository.summariseByLeagueForSeason(clubId, seasonId, now)` with interface projection `LeagueMatchSummary` (leagueId, count, played, first, last, nextUpcoming) exactly as the spec's JPQL. `LeagueAffiliationRepository.findTeamSummariesBySeasonId(seasonId)` (+ projection) and `LeagueTeamRepository.findActiveBySeasonId(seasonId)`.
**B2.** `dto/LeagueSeasonTeamDto` (name, abbreviation, logoUrl, own); `LeagueDto` gains `matchCount`, `playedCount` (`Integer`), `firstMatchDate`, `lastMatchDate`, `nextMatchDate` (`Instant`), `teams` (`List<LeagueSeasonTeamDto>`), appended last; update every positional `new LeagueDto(` (main + tests) and `LeagueMapper` (`ignore = true`). `LeagueServiceImpl.list`: read `now` once; when a current season exists run the three batches once and merge per league (own affiliated teams first, then active league teams, each name-sorted as the queries return them; defaults 0/0/null/null/null/empty for leagues without matches); no current season: zeros, nulls, empty teams, none of the new batches invoked; `create/update/deactivate/reactivate/get` leave the six fields null.
**B3.** `backend/openapi/openapi.yaml`: additions only (six `LeagueDto` properties, `LeagueSeasonTeamDto` schema).
**Backend tests** (`backend-builder` with the code; `test-writer` for gaps), exactly the spec's Unit and Integration rows: `LeagueServiceImplTest.list` cases and batch guard, `ServerClock.now()` test, `MatchRepository` summary tests (active/club/season/league filters, past vs future, exactly-at-now, first/last/next, grouped in one call), `LeagueAffiliationRepository` and `LeagueTeamRepository` query tests, the Hibernate-statistics N+1 test, and `LeagueControllerIntegrationTest` list shape through real HTTP (populated and empty club, other club's admin refused).

## Part 2 — Frontend (`frontend-builder`, after backend)

**F1. Shared pieces:** `components/DetailLine/` (four files; `ReactNode` value, `labelWidth` default 56, `muted`; `MatchCard` imports it), `components/CardProgressBar/` (four files; used by `SelectionBlock` and the league progress block), `SocialLinksRow` `website` platform (+ test/story), `utils/nextMatchCountdown.ts` `resolveCountdownLabel` (+ tests; `resolveNextMatchCountdown` unchanged in behaviour), `pollHelpers.ts` `formatMatchDate` (+ test). `api/leagueApi.ts`: six new nullable fields and `LeagueSeasonTeam` type; update fixtures/mocks that build `League` objects.
**F2. League card and list:** `pages/manage/leagues/LeagueCard.tsx` (+ page-local `LeagueTeamAvatars`) exactly per spec section 2 (badges via `leagueBadges`, details with First / Next (green "in N days/today/tomorrow") / Last / Playing XI / Age range, progress block, all-teams avatars wrapping with own solid and league neutral, social row above the card link, footer Schedule/Teams/Conditions/Edit, `viewTo` Schedule). `LeagueList.tsx`: `cardGridSx`, Format filter (`ListToolbar` `filters`, "All formats" + every `LeagueFormat`, `usePersistedListFilters('leagueList:filters:${clubId}', { format: '' })`), empty-state copy mentions the format, delete the three dead helpers.
**Tests (Vitest/RTL):** the spec's Component row in full (card states, progress, avatars with 20 teams, social clicks not navigating, footer routes, list filter + persistence + corrupt storage, grid util, shared-extraction tests, existing `MatchCard`/`SelectionBlock`/`SquadPicker` tests untouched).

## Order and ownership

1. `backend-builder` B1-B3 + unit/integration tests in the scratch copy; I verify independently (fresh rsync, full `./mvnw test`).
2. `frontend-builder` F1-F2 + tests; I verify: `tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm run build`, vitest (`--project unit --testTimeout=30000`) on `LeagueCard`/`LeagueList`/`DetailLine`/`CardProgressBar`/`SocialLinksRow`/`nextMatchCountdown`/`pollHelpers`/`MatchCard`/`SelectionBlock`/`SquadPicker`/`MatchList` and neighbours.
3. `test-writer` only for any gaps vs the spec's test rows.
4. `standards-reviewer` (read-only), fix findings. Docs in the same PR by me: `docs/roadmap.md` additions from the spec's Rollout Notes, component-library entries for `DetailLine`/`CardProgressBar` in `design-system.md`.
5. Commits in chunks (`feat(backend)`, `test(backend)`, `feat(ui)`, `test(ui)`, `docs`), PR, CI; I ask before merging. Browser check after you restart the backend: the cards at phone/two-column/wide, many-teams wrap, social icons, footer routes, card click, Format filter and its persistence. If my browser tab is unreliable you get a short checklist.

## Flags for your review

1. **`ServerClock.now()` is new**, and `list()` passes one `now` through; played/next boundaries are the spec's (`< now` played, `>= now` next).
2. **Dead helpers deleted** from `LeagueList.tsx` (spec section 3); their tests rewritten.
3. **`DetailLine` and `CardProgressBar` extracted from the Match card** (spec section 1); Match tests must stay green untouched.
4. **Hibernate-statistics N+1 test** is a new pattern in this codebase; enabled in the test only if needed.
5. **Backend restart needed** to see real data in the browser.
6. Playwright not extended (no live services), as before.

## Verification

- Backend (scratch copy): full `./mvnw test` including ArchUnit; `openapi.yaml` additions only.
- Frontend: tsc, lint, build, touched-file vitest (full UI suite still has ~10-25 unrelated pre-existing 5s timeouts).
- Browser (after backend restart): the Leagues list shows the new cards; badges colours; First/Next/Last lines; progress "N of M"; all team avatars wrapping; social icons clickable without opening the league; each footer button and the card click land on the right `072` view; Format filter works, combines with search and survives a reload; phone width one column, footer not clipped.
