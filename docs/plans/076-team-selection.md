# Plan 076 — Team Selection (phase 1: first run)

Implements `docs/specs/076-team-selection.md` (approved; design approved). Design: https://claude.ai/artifact/Vt3LivHuMT9oHwibMo2bau. Branch: `feature/076-team-selection` (off master; spec committed as `ddca16a` and `6137bf1`). This plan covers **phase 1 only**: the feature built with the **existing tests kept green** and **no new test suite**. The PR is opened as a **draft** and is **not merged** until the user has tried it and phase 2 (full tests, stories, smoke tests) is done (`CLAUDE.md` principle 5). CI is expected to be red on the draft for the test-demanding gates; no gate is loosened.

## Context

Choosing who plays is the product's most important job and today it is three disagreeing places (Match Squad, Playing XI, a block of three dropdowns) with no server guard against the same player in two teams, a player who said "unavailable" selectable, and a 12th man outside the cap. This replaces them with one selection list per team per match (at most 12), two server-enforced hard blocks (taken for the slot, said unavailable), a Release action, a pool endpoint and an atomic apply endpoint behind one "Select players" dialog, a tap-a-name menu with sorting by drag, spinner and move up/down, and an optional batting position so players can wait unordered.

## Decisions already made (user, this session)
- Native HTML5 drag and drop like the legacy app, **no new dependency**; Move up/down and the spinner for touch and keyboard.
- 12th man exists only where `allowSubstitutions` is true for the league and season; a friendly keeps one; a league of 11 without substitutions now has 11, a league of 12 now has 12.
- A Role submenu is added to the tap menu; a selected player who later says unavailable shows a red marker and does not block Announce.
- Phase 1 first run without new tests; draft PR; tests and smoke tests in phase 2 before any merge.

## Findings that shape the plan
1. **Backend core is a rules module** the spec fixes: `SelectionRules` (service.support) composed of `SelectionLimitsResolver`, `MatchSlots`, `SelectionAvailabilityResolver`, `SelectionEligibility`; used by the existing `MatchSideServiceImpl` and the new `MatchSelectionServiceImpl` (pool + apply). No nested/synthetic classes in `service.impl` (ArchUnit).
2. **Migration `038`** drops NOT NULL on `match_side_player.batting_order` (nullable unique keeps working in Postgres) and backfills existing 12th men as rows with NULL position and role BATSMAN. `MatchSidePlayer.battingOrder` becomes `Integer` and every unboxing reader is rewritten; `MatchSideDto` gains `limits`; `MatchDto.playingXiSize` now means `maxSelected` (batched conditions lookup per page).
3. **Race guard:** a per-player Postgres advisory transaction lock (`SelectionLockRepository`, ascending id order) taken by every add path; honest note that a DB constraint is a roadmap item.
4. **`MatchSquadMember` goes dormant:** no rule reads it; `loadPicked` stops reading it and counts the 12th man; `SectionAvailabilityRoundServiceImpl.delete` clears match-squad rows instead of refusing; `GET .../squad` stays as the coverage source.
5. **Existing tests that the replacement necessarily breaks** (update only these; list in the spec's Rollout Notes): `MatchSideServiceImplTest`, `MatchSideControllerIntegrationTest`, `SectionAvailabilityRoundServiceImplTest`, `PlayerAvailabilityGridRepositoryTest`/grid expectations, `MatchServiceImplTest`, frontend `MatchFormPage.test.tsx`, `MatchDetailPage.test.tsx`, deleted `PlayingXiBuilder` and `MatchSquadPicker` tests/stories, `PlayingXiSummary`, team sheet and `matchApi` fixtures.
6. **Frontend replaces the Playing XI tabs' content:** new `TeamSelectionList` and `SelectPlayersDialog` components (four-file anatomy; tests/stories deferred to phase 2, which is why the folder-shape check will be red), `ui/src/api/matchSelectionApi.ts`; `MatchSideTab` keeps the state; retired: `PlayingXiBuilder`, `MatchSquadPicker`, `MatchSquadPanel`, the Match Squad tab, Pick match squad on the Match View, the `033` tinting.
7. **Readers to update:** `PlayingXiSummary` (waiting players, single 12th man), team sheet PDF and WhatsApp text (null positions, 12th man as a row), `MatchDetailPage` `TeamCard` (M from `limits.maxSelected`), the match card needs no code change.
8. Process constraints carry over: backend built/tested ONLY in an rsync'd scratch copy (never mvn in `backend/`), Node 22 via nvm, one heavy command at a time with `uptime` checks, `configure({ asyncUtilTimeout })` for cold first renders, explicit-path staging (never `git add docs`/`backend/src/main` wholesale), never touch the user's `CricketlegendApplication.java`/`055`/`058`, no `git stash`.

## Part 1 — Backend (`backend-builder`, two sequential tasks, scratch-copy verification)

**B1. Foundations and existing endpoints.** Migration `038` + master changelog; `MatchSidePlayer.battingOrder` nullable and all readers; `SelectionLimitsDto` and `SelectionLimitsResolver` (+ `MatchSideDto.limits`, mapper third argument, `MatchDto.playingXiSize` = `maxSelected` batched); `MatchSlots` (+ the new `MatchRepository` window query); `SelectionAvailabilityResolver`; `SelectionEligibility` (membership rule: active club player + roster or section-tagged, age rule batch-capable); `SelectionLockRepository`; `SelectionRules`; rewrite `MatchSideServiceImpl` paths per the spec (add, updateSide incl. 12th man, remove with `keepAnnounced`, reorder as full order, announce rule via `SelectionIncompleteException`, positions contiguous); new exceptions (`PlayerTakenForSlotException`, `PlayerSaidUnavailableException`, `TwelfthManNotAllowedException`, `SelectionIncompleteException`); `PlayerAvailabilityServiceImpl.loadPicked`; `SectionAvailabilityRoundServiceImpl.delete`. Update only the existing tests this breaks.
**B2. Pool and apply.** `MatchSelectionController`/`Service`/`Impl`; `GET .../selection-pool` and `PUT .../sides/{sideId}/selection` with the DTOs, `SelectionRejectedException` + the `GlobalExceptionHandler` `rejections` property; `openapi.yaml` additions plus the `battingOrder` nullability; full `./mvnw test` green in a fresh scratch copy.

## Part 2 — Frontend (`frontend-builder`, in this order, after the backend shapes exist; one heavy command at a time)

**F1. API and readers:** `matchSideApi.ts` types (nullable `battingOrder`, `limits`, `keepAnnounced`), new `matchSelectionApi.ts`, `matchApi.ts`; update `PlayingXiSummary`, `teamSheetPdf.ts`, `teamSheetWhatsAppText.ts`, `MatchDetailPage` (`TeamCard` M, remove Pick match squad).
**F2. Components and page:** `TeamSelectionList` (holding area, numbered places, 12th man row, tap menu with Make captain / Wicketkeeper / Batting position spinner / Make 12th man / Role / Move up / Move down / Remove, native drag with indicator, optimistic reorder) and `SelectPlayersDialog` (switch, search, groups, blocked rows with Release/Change answer, limit, footer, apply with 409 rejections, Add new player); `MatchSideTab` rewritten as the page (header summary, unconfirmed lines, instruction line, three buttons, announce rule text); Release confirmation; Re-select from previous match with blocks; remove Match Squad tab/panel and `?tab=match-squad` now opens the XI tab; delete `PlayingXiBuilder` and `MatchSquadPicker` (grep first). Update only the existing tests this breaks. **No new test files.**

## Order and ownership
1. `backend-builder` B1 then B2 (scratch copy). In parallel, `frontend-builder` can start F1 against the spec's DTO shapes; F2 after B2's shapes are final. I verify independently: backend full `./mvnw test` in a fresh scratch rsync; frontend `tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm run build`, vitest (`--project unit --testTimeout=30000`) on the touched areas (`pages/manage`, `components/PlayingXiSummary`, team sheet utils, `matchApi`).
2. `standards-reviewer` (read-only), focused on the rules module (slot matrix, availability, race guard, apply atomicity, announce rule) then standards; fix findings.
3. Docs by me in the same PR: roadmap additions and "Amended by 076" notes listed in the spec's Rollout Notes.
4. Commits in chunks (`feat(backend)`, `feat(ui)`, `test` for the updated existing tests, `docs`), explicit paths; push; open a **draft PR**; do not merge. You try it (restart the backend; migration `038` runs automatically).
5. Phase 2 (separate go-ahead from you): the full test plan, stories and smoke tests, then merge.

## Flags for your review
1. **Behaviour change for leagues** (no 12th man without `allowSubstitutions`, XI size 12 means 12 total) is in effect from phase 1.
2. **CI will be red on the draft** (new components without their test/story files, diff coverage); accepted, not to be loosened.
3. **Backend restart needed** (migration `038`, new endpoints).
4. **Existing double-picks and over-limit sides in the test data are marked, not repaired.**
5. **Last write wins within one side** if two managers edit it at once; the slot and unavailable blocks still hold.
6. Playwright not extended (no live services); smoke tests are phase 2.

## Verification (phase 1)
- Backend (scratch copy): full `./mvnw test` including ArchUnit and the updated existing tests; `openapi.yaml` additions plus the one nullability change.
- Frontend: tsc, lint, build, touched-area vitest with only updated existing tests.
- By you in the browser after a backend restart, using the six practical scenarios from the mockup: juniors (A morning, C afternoon), two senior sides sharing a player with Release, national champs with 12 selected, said-unavailable then Change answer, team full, re-select skipping blocked players; plus the holding area after Done, drag and the spinner, announce blocked then allowed, release from an announced team.
