# Plan 064 — Unified Availability Polls

Implements `docs/specs/064-unified-availability-polls.md` (approved). Visual target: the approved design page (https://claude.ai/artifact/UWT99zDacBK74hBPSdSgua), built from the real theme tokens, so reproduce it closely using existing shared components.

## Context

`063` made polling style a team property (`Team.squadMode`) and put group polls on their own screen. Spec 064 moves the choice to the poll creator, merges both poll kinds into one list at `/manage/availability` with a **New poll** button, enforces one-poll-per-match across both kinds, adds delete, adds Autoclose to squad polls, and makes autoclose actually fire for both kinds. Nothing is deployed, so no data compatibility is needed.

## Findings that shape the plan (spec assumptions that don't hold, or gaps the spec left to the plan)

1. **No scheduler exists** (no `@EnableScheduling`, Batch, Quartz, ShedLock). Autoclose enforcement is new infrastructure.
2. **No `ON DELETE CASCADE` anywhere** in the poll tables. Every delete is child-first by hand: round → `match_squad_member` (block), `section_availability_response`, `section_availability_window_match`, `section_availability_window`, then the round. Squad poll → `player_availability` rows, then the poll.
3. **`match_availability_poll` has no `auto_close`/`scheduled_close_at`** (spec said "same as the round's"; they have to be added, not reused).
4. **`MatchSquadServiceImpl` resolves its window by bracket key, not via `window_match`.** The spec defines coverage by `window_match`; this plan moves it there (one shared resolver, below).
5. **No OpenAPI contract-diff test exists** (`testing.md`/`backend.md` describe one; the repo only checks in `backend/openapi/openapi.yaml`). Regeneration is manual.
6. **`RecordCard` has no delete action and there is no shared confirm dialog.** Delete goes through `RecordCard.secondaryActions` plus a new shared `ConfirmDialog`.
7. **`MatchFormPage` decides its top-level "Match Squad" tab before any data loads** (`hasFlexibleSide`), so coverage has to be fetched up front for both sides.
8. `AvailabilityPollsDashboard`/`SectionAvailabilityRounds` expose nothing reusable (all local); the cards get extracted into page-local files.
9. Spec's open items, settled here: window `(section, date, day-part)` uniqueness stays as is, deletion alone frees a bracket because delete removes the windows; the `alreadyPolled` DTO becomes `existingPollType` (`SQUAD`|`GROUP`), `existingPollId`, `existingPollLabel`.

## Step 0 — Commit the two earlier fixes on their own (before 064 work)

Two uncommitted fixes already on this branch are unrelated to 064's design and should not be mixed into it:
- `fix(ui): add show-past-matches toggle to match list` — `ui/src/pages/manage/MatchList.tsx`, `MatchList.test.tsx`.
- `fix(backend): group same-date fixtures and dedupe self-matches in poll proposals` — `SectionAvailabilityFixtureGroupResolverImpl.java` and its test.
Leave `CricketlegendApplication.java` (newline-only change) and untracked specs `055`/`058` out. Commit spec `064` + this plan as `docs(spec): …`.

## Part 1 — Backend (`backend-builder`, then `test-writer`)

**B1. Migration `035-unify-availability-polls.sql`** (+ include line in `db.changelog-master.xml`): `ALTER TABLE team DROP COLUMN squad_mode`; `ALTER TABLE match_availability_poll ADD COLUMN auto_close BOOLEAN NOT NULL DEFAULT true, ADD COLUMN scheduled_close_at TIMESTAMPTZ`. (Use the `new-migration` skill.)

**B2. Drop `squadMode`.** Delete `domain/SquadMode.java`, `exception/TeamSquadModeMismatchException.java`; remove the field from `Team`, `TeamDto`, `CreateTeamRequest`, `UpdateTeamRequest`, `TeamServiceImpl` (:103, :120). Remove the three FLEXIBLE conditions: `MatchRepository.findUpcomingFlexibleMatchesBySection` → rename `findUpcomingMatchesBySection` and drop the squad-mode predicate; `SectionAvailabilityRoundServiceImpl.resolveFlexibleTeamForSection` (:480-499, rename to a section-team resolver) and the `:363` check in `getMatches`; `SectionAvailabilityFixtureGroupResolverImpl:135`. Remove `requireFlexible` in `MatchSquadServiceImpl` (:204) and the create-time throw in `MatchAvailabilityPollServiceImpl` (:121-123).

**B3. One shared coverage resolver** (spec: "shared logic lives in one place"): new `service/MatchPollCoverageService` + `impl/MatchPollCoverageServiceImpl` — `resolve(matchId, teamId)` → none | `SQUAD(pollId, label)` | `GROUP(windowId, roundId, description)`, group via `SectionAvailabilityWindowMatchRepository` (add `findByMatchId`), squad via `MatchAvailabilityPollRepository.findByMatchIdAndTeamId`/`findByMatchId`. Used by: squad-poll create (409 if group-covered), `SectionAvailabilityRoundServiceImpl.create` (409 `MatchAlreadyPolledException` if any match has a squad poll), the fixture-group resolver (`alreadyPolled` + `existingPoll*` fields for either kind), `MatchSquadServiceImpl` (window lookup via `window_match`; `GET …/squad` returns `windowId: null` instead of 400), and `MatchSideServiceImpl.requireSquadMembership` (:396-407: group-covered → `MatchSquadMember`, else `TeamSquadMember`). Update `SectionAvailabilityFixtureMatchDto` and `SectionAvailabilityFixtureGroupResolverImpl` for the new `existingPoll*` fields.

**B4. Squad-poll autoclose.** `MatchAvailabilityPoll` entity + `CreateMatchAvailabilityPollRequest` (`autoClose`, default true when absent) + `MatchAvailabilityPollDto`/`OpenAvailabilityPollDto` (`autoClose`, `scheduledCloseAt`) + mapper; `MatchAvailabilityPollServiceImpl.create` sets `scheduledCloseAt = match.matchDate − 24h` when on (mirrors `SectionAvailabilityRoundServiceImpl:186-187`, extract the 24h rule into one shared helper rather than duplicate it).

**B5. Delete endpoints.** `DELETE …/matches/{matchId}/polls/{pollId}` (`MatchAvailabilityPollController`, `canAccessClub`; service calls `assertCanAdministerMatch`, then `PlayerAvailabilityRepository.deleteByPollId`, then the poll) and `DELETE …/section-availability-rounds/{roundId}` (`SectionAvailabilityRoundController`, `canAccessClub`; service `findRoundOrThrowForClub` + `assertCanAdministerSection`, then `MatchSquadMemberRepository.existsBy…WindowIdIn` → new `RoundHasMatchSquadException extends ConflictException`, then responses → `window_match` → windows → round). Both `@Transactional`.

**B6. Autoclose job.** `@EnableScheduling` on a config class; new `AvailabilityAutoCloseService` + `Impl` with `@Scheduled(fixedDelay = 5 min)` calling internal, auth-free `closeDueAutoClosePolls(now)` on `MatchAvailabilityPollService` and `SectionAvailabilityRoundService` (the group one cascades through the existing `setWindowsOpen`). Gate with a property (`cricketlegend.autoclose.enabled`, default true; false in the test profile) so it can't fire during integration tests. Single-node only, no distributed lock (documented, matches how the app runs today).

**B7. OpenAPI.** Regenerate `backend/openapi/openapi.yaml` (run app, fetch `/v3/api-docs.yaml`) and commit it with the change.

Existing backend tests that reference `squadMode`/`SquadMode` (25 files, mostly fixtures) need the field removed — assign to `test-writer` along with the new tests in the spec's Test Plan (coverage 409s both directions, autoclose compute + job incl. idempotence/off/closed/not-due, both deletes incl. 409 and freeing, `requireSquadMembership` by coverage, squad endpoint `windowId: null`, section-scope 403/404 on both DELETEs, migration on fresh DB).

## Part 2 — Frontend (`frontend-builder`, after Part 1 so real shapes exist; then `test-writer`)

**F1. API files.** `matchAvailabilityApi.ts`: `createPoll(clubId, matchId, teamId, autoClose)`, `deletePoll`, `autoClose`/`scheduledCloseAt` on both poll types. `sectionAvailabilityApi.ts`: `deleteRound`; `SectionAvailabilityFixtureMatch` gets `existingPollType`/`existingPollId`/`existingPollLabel`. `teamApi.ts`: drop `SquadMode`/`squadMode`.

**F2. Shared component:** `components/ConfirmDialog/` (four-file anatomy, story + test) modelled on the inline Replace-XI dialog at `MatchFormPage.tsx:560`; reused for both deletes and the "can't delete" notice.

**F3. Dashboard** (`pages/manage/AvailabilityPollsDashboard.tsx`): `ManageScreenHeader` with **New poll** `action` → `/manage/availability/new`; `ListToolbar` with search, `sortToggle`, and `filters` = Stack of Type select + `SectionTreeSelect` (same Stack-in-`filters` pattern `MatchList` already uses, no toolbar change needed), both persisted via `usePersistedListFilters`; merged grid of squad + group cards. Extract page-local `SquadPollCard` (existing `PollCard`, + Closes row, Delete) and `GroupPollCard` (from `RoundCard`, SectionAvailabilityRounds.tsx:321, + Delete) into `pages/manage/availability/`. Type shown with `RecordCard.badge`/`badges` (neutral/muted tones; no new tone needed).

**F4. `NewPollPage`** (`pages/manage/NewPollPage.tsx`, `RecordFormScreen`, template `SponsorFormPage.tsx`): chooser (two choice cards) → squad branch (team select, upcoming-match list from `listMatches` filtered to the team and uncovered, per-match close time, Autoclose switch, "Open N polls" = N `createPoll` calls) or group branch (move `FixtureGroupCard` + helpers out of `SectionAvailabilityRounds.tsx`, unchanged behaviour; covered matches disabled with link built from `existingPoll*`: squad → `/manage/fixtures/matches/:id/edit?tab=availability`, group → `/manage/availability`). Honour `?type=&sectionId=&matchId=`.

**F5. Routing/cleanup.** `App.tsx`: add `availability/new`; replace `section-availability` route with a `Navigate` that preserves the query string (retargeted to `?type=group`). Delete `SectionAvailabilityRounds.tsx` + its test (cases migrated to dashboard/`NewPollPage` tests). `ManagerDashboard.tsx`: remove the "Section Availability" card (l.61); `MatchSquadPicker.stories.tsx` `createWindowHref`.

**F6. Remove `squadMode` and branch on coverage.** `TeamForm.tsx` (field l.179-187), `TeamFormPage.tsx` (l.388, 542, 704, 829-847 → always season squad), `MatchList.tsx` l.119. `MatchFormPage.tsx`: new per-side coverage query (`getMatchSquad` windowId + `listPolls` for the team, always enabled, shared query keys) replacing `isFlexible` (l.157, 652) and `hasFlexibleSide` (l.990-994, top-level Match Squad tab visible when any side is group-covered); `MatchAvailabilityPanel` shows the squad-poll tab, the "covered by group poll" panel, or both "Open squad poll"/"Open group poll" shortcuts; add the Autoclose switch to `MatchAvailabilityTab`'s create. Update ~25 `squadMode` test/story fixtures.

## Part 3 — Docs (human-sign-off items flagged, builder edits)

Add a "superseded by 064" note to `docs/specs/063-…`; update `docs/roadmap.md` (mark "fold into 034" and "enforce `scheduledCloseAt`" resolved, point to 064; reminders stay open) and `docs/architecture.md` (drop `squadMode` from the diagram, per memory notes); correct 064's "same names as the round's" wording. Save the approved plan verbatim as `docs/plans/064-unified-availability-polls.md`.

## Order and ownership

1. Step 0 commits. 2. `backend-builder`: B1→B7 (self-contained prompt incl. shapes above). 3. `test-writer` backend tier; I re-run `./mvnw test` myself. 4. `frontend-builder` F1→F6. 5. `test-writer` frontend tier (+ Playwright golden path from spec); I re-run `npm run build/lint/test/test:storybook` under `nvm use 22.12.0`. 6. Browser smoke test with `claude-in-chrome`: create one squad + one group poll for two matches of one team, see both in one list, delete one and re-poll its match, autoclose switch/close-time text, redirect. 7. `standards-reviewer`. 8. Commits in logical chunks (Conventional Commits, `Co-Authored-By` trailer), then PR via `gh pr create` only when you ask.

## Verification

- `cd backend && ./mvnw verify` (includes ArchUnit; the new `@Service` + scheduled class must satisfy its `*Impl`/`@Service` rules) and fresh-DB migration test.
- `cd ui && nvm use 22.12.0 && npm run build && npm run lint && npm run test && npm run test:storybook`.
- Manual: restart the dev backend (it doesn't hot-reload), walk the flows above in the browser against the real design page.
- Autoclose: integration test of the job with an overdue poll of each kind; in dev, create a poll with a past close time and confirm it closes within one interval.

## Flags for your review

1. **OpenAPI:** there is no contract-diff test despite what the standards say; I'll regenerate `openapi.yaml` by hand (app → `/v3/api-docs.yaml`). Tell me if you have a different method.
2. **New shared `ConfirmDialog`** (spec silent): added because no shared confirm exists and two features need one.
3. **Scheduler is `@Scheduled`, 5-minute fixed delay, no distributed lock** (spec left the mechanism open). Fine while the backend is a single node.
4. **Small additions beyond the spec's literal text, all following from it:** Autoclose switch also on the in-match squad-poll create; `ManagerDashboard`'s "Section Availability" card removed; the two earlier fixes committed separately first.
5. **Spec wording to fix after build:** "same names as `section_availability_round`'s" (columns are new on the poll table) and the nonexistent contract-diff test.
