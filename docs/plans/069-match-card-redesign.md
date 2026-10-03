# Plan 069 — Match Card Redesign

Implements `docs/specs/069-match-card-redesign.md` (approved; design approved). Design: https://claude.ai/artifact/BBSzMNUBLhQjpuuAWR7CJK (footer Edit / Select / Poll / Share, colour-coded badges, stacked details, Selection block, no bin). Branch: `feature/069-match-card-redesign` (off master; spec committed).

## Context

The Matches list card is cramped and shows nothing about selection progress or the availability poll. 069 rebuilds it on the same shared pieces as the poll card: `RecordCard` `footerButtons` (icon over caption), colour-coded badges, a stacked details block, a **Selection block** (picked N of the playing XI per club team) and a **poll badge**. It needs three new read-only values on the matches list response (picked counts, playing XI size, the match's polls), loaded in batches.

## Findings that shape the plan

1. **Matches list assembly:** `MatchServiceImpl.list` (L94-110) maps the page with MapStruct then `enrichAnnounced` (L286-297) rebuilds each `MatchDto` with a canonical-constructor call. `MatchDto` is a 18-component record; adding components touches its only call sites (`MatchServiceImpl:290`, `MatchServiceImplTest` L96/530/532). MapStruct's `MatchMapper` ignores the announced flags; new derived fields need the same `@Mapping(ignore = true)`.
2. **`MatchDto` is built by seven other paths** (`get`, `create`, `update`, `deactivate`, `reactivate`, `listPrevious` via `TeamPreviousMatchController`) that do not compute these fields. The spec only says "list"; the plan makes the new fields **`null` (counts, XI size) and an empty `polls` list** on those paths.
3. **All batch sources exist** (added for the grid): `MatchSideRepository.findByMatchIdIn`, `MatchSidePlayerRepository.findByMatchSideIdIn`, `MatchAvailabilityPollRepository.findByMatchIdIn`, `SectionAvailabilityWindowMatchRepository.findByMatchIdIn`, `findAllById` for windows, leagues and teams. **No new repository queries are needed.**
4. **No shared batch poll-coverage logic exists:** `PlayerAvailabilityServiceImpl` (L215-233, 517-556) has it inline; `MatchPollCoverageService` is per-match (N+1). To keep "shared logic in one place", add a **batch method to `MatchPollCoverageService`** returning each match's poll refs; the matches list uses it. The grid is not refactored in this change (it keeps one poll per match filtered to the club's team); flagged.
5. **Picked count and XI size definitions differ from the grid/cap:** picked = `MatchSidePlayer` rows of the side's `MatchSide` (the playing XI), not the grid's "also group squad picks"; XI size = `League.maxPlayingXiSize` (int), `null` when the match has no league (the existing `MatchSideServiceImpl.applicableCap` defaults to 11, the spec explicitly wants `null`). "Club team" side = a side whose team belongs to this club (`Team.clubId`, via a `teamRepository.findAllById` batch), because an opponent team can belong to another club.
6. **Frontend: `RecordCard` footerButtons ignores `editTo`/`secondaryActions`/`onEdit`**, so Edit must be a footer button that navigates; `children` body slot is not lifted above the stretched title link (plain text there is fine); no dashed "No poll" tone exists (a new additive `noPoll` tone and a `variant` tweak are needed); `announcedBadges` tests assert "Not Announced" (capital A), the spec/design say "Not announced".
7. **`MatchCard` is page-local in a ~660-line `MatchList.tsx`** and `MatchDetailPage` imports `sideName`/`badgeFor`/`matchFields` from it. The card moves to its own files; the helpers `sideName`, `badgeFor`, `announcedBadges`, `withPlayingXiTab` move to a helpers file and `MatchList.tsx` re-exports them so `MatchDetailPage` and tests keep working.
8. **Existing route builders are inline** (`PollCard`, `MatchFormPage`) or tied to the grid's `GameColumn` (`gridHelpers`); the new card gets its own small builders (`/manage/availability/group/:roundId`, `/squad/:matchId/:pollId`, `/new?type=group&sectionId&matchId`, match Availability tab). The match's `sectionId` for the new-poll link comes from `teamsById.get(clubSideTeamId)?.sectionId`.
9. **Poll destination rule** (spec): 0 polls → new-poll flow prefilled; 1 poll → its Responses page; 2 polls (a derby with one squad poll per side) → the match edit screen's Availability tab. A group poll covers the match once (teamId `null` in the entry); squad polls are one per club team side.

## Final API shape (additive; list response only carries values)

`MatchDto` gains `Integer homePickedCount`, `Integer awayPickedCount`, `Integer playingXiSize`, `List<MatchPollDto> polls`. New top-level record `MatchPollDto(AvailabilityPollType type, UUID teamId, UUID pollId, UUID roundId, boolean open)`.
- Counts: for a side whose team belongs to this club, the number of `MatchSidePlayer` rows (0 when no `MatchSide` row yet); `null` for a free-text or other-club side.
- `polls`: group-covered match → one entry `{GROUP, teamId: null, pollId: roundId, roundId, open: window.open}`; otherwise one `{SQUAD, teamId, pollId, roundId: null, open}` per squad poll of a club team side; `[]` when none.
- Not computed on `get/create/update/deactivate/reactivate/listPrevious`: counts and `playingXiSize` are `null`, `polls` is `[]`.

## Part 1 — Backend (`backend-builder`; build/test ONLY in an rsync'd scratch copy, never in `backend/`; one Maven run at a time)

**B1.** `dto/MatchPollDto` (top-level record), extend `dto/MatchDto` and `MatchMapper` (`ignore = true` for the four new fields so non-list paths yield nulls; make `polls` default to `List.of()` where the service builds it), update every `new MatchDto(...)` call (`MatchServiceImpl`, tests).
**B2.** Batch poll refs: add `MatchPollCoverageService` method (e.g. `Map<UUID, List<PollRef>> pollsForMatches(Collection<UUID> matchIds)` with `PollRef` as a nested record in the interface like `Coverage`; no nested classes in `service.impl`) implemented in `MatchPollCoverageServiceImpl` with `findByMatchIdIn` (links), `findAllById` (windows) and `MatchAvailabilityPollRepository.findByMatchIdIn`, group beats squad (as `MatchPollCoverageService.resolve`), squad entries only for the match's own team ids.
**B3.** In `MatchServiceImpl.list`: replace `enrichAnnounced` with one combined enrichment on `page.getContent()` (one call per batch: `MatchSideRepository.findByMatchIdIn` (announced + counts), `MatchSidePlayerRepository.findByMatchSideIdIn` (counts grouped in Java), `teamRepository.findAllById` (club ownership), `leagueRepository.findAllById` (XI size), the new poll batch), skipping batches for an empty page; keep the announced flags exactly as before. `@Transactional(readOnly = true)`.
**B4.** `backend/openapi/openapi.yaml`: additions only (the four `MatchDto` properties and the `MatchPollDto` schema) via the scratch-copy temporary `@SpringBootTest` + block-level merge (revert springdoc reordering noise).
**Tests:** `MatchServiceImplTest` (batch guard: each batch method once per page regardless of page size; squad-covered, group-covered, derby with two polls, unpolled; counts for 0/partial/full XI; `null` count for free-text and other-club sides; `playingXiSize` with and without a league; announced flags unchanged; non-list paths return nulls/empty polls); `MatchPollCoverageServiceImplTest` for the batch method (precedence, own-team filter, open flags); `MatchControllerIntegrationTest` list response shape (fixtures: `buildXi`, poll/window fixtures as in `PlayerAvailabilityGridRepositoryTest`), pagination test still green.

## Part 2 — Frontend (`frontend-builder`, in parallel with Part 1 against the shape above; all under `ui/`; `source ~/.nvm/nvm.sh && nvm use 22.12.0` first; one command at a time, `uptime` before heavy ones; zsh: pass file lists via xargs)

**F1.** `api/matchApi.ts`: `Match` gains `homePickedCount`, `awayPickedCount` (`number | null`), `playingXiSize` (`number | null`), `polls: MatchPoll[]`; new `MatchPoll` type. Update fixtures/mocks that construct `Match` (add defaults: nulls and `[]`).
**F2.** `components/RecordCard`: additive `noPoll` badge tone (dashed outline, muted text) incl. the `variant` selection tweak so it renders outlined; leave every existing tone unchanged; update `RecordCard.test.tsx` and a story.
**F3.** New `pages/manage/matches/` files: `matchCardHelpers.ts` (moved `sideName`, `badgeFor`, `announcedBadges` [label casing "Not announced"], `withPlayingXiTab`; plus `pollBadgeFor(polls)` [either open → Poll open; any and none open → Poll closed; none → No poll], `pollDestination(...)` [0/1/2 rule above with route builders], `selectionRows(match, teamsById)` [one row per club team side: team name, picked, XI size; none when neither side is a club team], `clubSideSectionId`), `SelectionBlock.tsx` (rows with a MUI `LinearProgress`-based bar styled like `SlotSummary`'s bar, "N of M picked", "N picked · K to go" / "squad complete"; no bar and "N picked" when `playingXiSize` is null; the "nobody to pick" note), `MatchCard.tsx` (the card: `RecordCard` with avatar, `titleWrap`, `badge`/`badges`, **stacked details as `children`** [When via `formatMatchDateTime`, Venue, League · Season with `EventOutlined`/`PlaceOutlined`/`EmojiEventsOutlined` icons, empty lines omitted], `SelectionBlock`, `footerButtons` Edit (`EditOutlined`, navigates to `editTo`), Select (`GroupsOutlined`, Playing XI tab; disabled + explanatory `title` when neither side is a club team), Poll (`EventAvailableOutlined`; per `pollDestination`; disabled when neither side is a club team), Share (`ShareOutlined`, the Team Sheet dialog; disabled when neither side is a club team); `viewTo` stays, the Team Sheet dialog/queries move with the card unchanged).
**F4.** `pages/manage/MatchList.tsx`: render the new `MatchCard`, re-export `sideName`, `badgeFor`, `announcedBadges` from the helpers (so `MatchDetailPage` keeps importing from `MatchList`), grid `repeat(auto-fill, minmax(340px, 1fr))` with `alignItems: 'stretch'`; `SquadPicker` unchanged (still `viewTo={null}`, Edit goes to the Playing XI tab).
**Tests:** rewrite the card-dependent tests in `MatchList.test.tsx` (title wrap, Edit is now a button that navigates [L147/169], Select Team → Select + disabled-with-explanation [L222-275], announced badge text casing [L310-383], the "never renders Deactivate/Reactivate" test [L385], inactive badge [L301]); keep filter/search/persistence/pagination/sort tests; new tests for `matchCardHelpers`, `SelectionBlock`, `MatchCard` (every badge state, details lines and omissions, Selection rows incl. derby/no-league/squad-complete/no-club-side, footer order + destinations for 0/1/2 polls, disabled states, Edit/Select/Share behaviour), the `SquadPicker` `?tab=playing-xi` no-duplication check stays; no arbitrary timeouts.

## Order and ownership

1. `backend-builder` (Part 1, scratch-copy verification) and `frontend-builder` (Part 2) in parallel; I give both the exact shapes above.
2. I independently verify, one after the other (machine load!): backend full `./mvnw test` in a fresh scratch copy; frontend `tsc`, `npm run lint`, `npm run build`, vitest on touched files + `MatchDetailPage`, `SquadPicker`, `RecordCard`, `MatchList`, storybook for `RecordCard`.
3. Browser check of the Matches list at phone / two-column / wide widths (my tab may be unreliable; if so you get a short checklist); needs your backend restarted (new fields).
4. `standards-reviewer` (read-only), fix findings, commit in chunks (`feat(backend)`, `test(backend)`, `feat(ui)`, `test(ui)`, `docs`), PR; I ask before merging.

## Verification

- Backend (scratch copy): full `./mvnw test`; OpenAPI additions only.
- Frontend: `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm run build`, `vitest run --project unit --testTimeout=30000` on touched files (+ `MatchDetailPage`, `SquadPicker`); the full UI suite still has ~10-25 unrelated pre-existing 5s timeouts.
- Browser (after your backend restart): the cards in the list and the Select Team screen: stacked details, badges (announced, poll open/closed/none, inactive), Selection rows, four-column footer never clipped, equal heights, Poll opening the right place for zero/one/two polls.

## Flags for your review

1. **Non-list endpoints return null counts and an empty `polls`** (the spec says only the list); `MatchDto` is also used by `get/create/update/deactivate/reactivate` and the team "previous matches" endpoint.
2. **`playingXiSize` is `null` with no league**, unlike the existing selection cap's default of 11 (per the spec).
3. **"Club team" means the side's team belongs to this club** (checked via `Team.clubId`), so another club's team is treated like a free-text opponent for picks/polls.
4. **A group poll entry has `teamId: null`** (it covers the match once); the Poll button uses its `roundId`.
5. **"Picked" here = the playing XI selection only**; the Player Availability grid's "picked" also counts group-poll squad picks, so the two can differ.
6. **The grid's inline poll-coverage logic is not refactored** onto the new shared batch method in this change (kept to limit risk); worth a follow-up to avoid duplication.
7. **"Not Announced" becomes "Not announced"** (spec/design casing); the existing tests change accordingly.
8. **Two polls (a derby) open the match's Availability tab** (no `side` param); the tab's default side applies.
9. **No corner action/bin** on the match card (the earlier mockup had one by mistake; removed).
10. Playwright is not extended (no live services here), as before.
