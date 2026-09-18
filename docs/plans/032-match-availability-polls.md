# Plan: 032 — Match Availability Polls

## Context

`docs/specs/032-match-availability-polls.md` (approved, on `feature/032-match-availability-polls`, branched off `master` now that `031-jersey-numbers` is merged) adds two new entities — `MatchAvailabilityPoll` (per match+team) and `PlayerAvailability` (per poll+player) — and two response surfaces: an admin-facing Availability tab on `MatchFormPage` (`029`'s existing tabbed pattern), and a new public, unauthenticated, self-select response page at `/poll/:pollId`. The Claude Design pass for both new visual pieces (`MatchAvailabilityTab`, `PublicAvailabilityPoll`) is done and approved.

This plan does not redefine anything the spec already fixed: the two-table data model, the `/api/v1/public/**` namespace choice, the "closed = read-only, reopenable" behavior, "no per-player identity check," "no automated delivery," and the exact endpoint list are all taken as given. One real correctness issue surfaced during file-list research is called out below (not a redefinition — a mechanical detail the spec's prose didn't need to pin down at this level).

## Files to touch, in order

### Backend

#### 1. `backend/src/main/java/com/cricketlegend/domain/AvailabilityStatus.java` (new enum)
`AVAILABLE`, `UNAVAILABLE`, `UNSURE` — per spec's Data Model Changes (fresh names, not legacy's `YES`/`NO`/`UNSURE`).

#### 2. `backend/src/main/java/com/cricketlegend/domain/MatchAvailabilityPoll.java` (new entity)
Per spec exactly: `id`, `matchId`, `teamId`, `open` (boolean, default true, no `active` column), audit fields. Matches `MatchSide`'s entity shape/style.

#### 3. `backend/src/main/java/com/cricketlegend/domain/PlayerAvailability.java` (new entity)
`id`, `pollId`, `playerProfileId`, `status` (`AvailabilityStatus`), audit fields including nullable `updatedBy` (per spec, always null this pass — no authenticated identity on the public write path).

#### 4. `backend/src/main/resources/db/changelog/v1/023-add-availability-polls.sql` (new migration)
Exactly the SQL in the spec's Data Model Changes section — `match_availability_poll` and `player_availability` tables, both unique constraints, both indexes.

#### 5. `backend/src/main/resources/db/changelog/db.changelog-master.xml` (edit)
Add the `<include file="v1/023-add-availability-polls.sql" .../>` line, matching the existing entries' exact format.

#### 6. `backend/src/main/java/com/cricketlegend/repository/MatchAvailabilityPollRepository.java` (new)
```java
Optional<MatchAvailabilityPoll> findByMatchIdAndTeamId(UUID matchId, UUID teamId);
boolean existsByMatchIdAndTeamId(UUID matchId, UUID teamId);
List<MatchAvailabilityPoll> findByMatchId(UUID matchId);
```

#### 7. `backend/src/main/java/com/cricketlegend/repository/PlayerAvailabilityRepository.java` (new)
```java
List<PlayerAvailability> findByPollId(UUID pollId);
Optional<PlayerAvailability> findByPollIdAndPlayerProfileId(UUID pollId, UUID playerProfileId);
```

#### 8. `backend/src/main/java/com/cricketlegend/exception/PollClosedException.java` (new)
`extends ConflictException` — the one genuinely new exception the spec calls for. Everything else reuses existing subclasses (see below).

#### 9. New DTOs (`backend/src/main/java/com/cricketlegend/dto/`)
- `MatchAvailabilityPollDto(UUID id, UUID teamId, boolean open, long availableCount, long unavailableCount, long unsureCount, long noResponseCount)` — admin list/create/open/close response.
- `CreateMatchAvailabilityPollRequest(UUID teamId)`.
- `PlayerAvailabilityRowDto(UUID playerProfileId, String firstName, String lastName, Integer squadJerseyNumber, AvailabilityStatus status)` — `status` nullable (no response yet). Shared shape for both the admin responses endpoint and the public endpoint's squad list.
- `MatchAvailabilityPollResponsesDto(UUID pollId, UUID teamId, boolean open, long availableCount, long unavailableCount, long unsureCount, long noResponseCount, List<PlayerAvailabilityRowDto> responses, String publicPath)` — admin's `GET .../responses`. `publicPath` is `"/poll/" + pollId`.
- `PublicAvailabilityPollDto(UUID pollId, boolean open, String homeTeamName, String awayTeamName, Instant matchDate, String venue, String leagueName, String seasonLabel, String teamName, List<PlayerAvailabilityRowDto> responses)` — public `GET`/`PUT` response.
- `SetPlayerAvailabilityRequest(AvailabilityStatus status)`.

#### 10. `backend/src/main/java/com/cricketlegend/mapper/MatchAvailabilityPollMapper.java` (new, MapStruct)
`MatchAvailabilityPollDto toDto(MatchAvailabilityPoll poll, long availableCount, long unavailableCount, long unsureCount, long noResponseCount)` — the one place the entity's own fields get mapped mechanically. `MatchAvailabilityPollResponsesDto`/`PublicAvailabilityPollDto` are assembled by plain record construction in the service layer (matching `MatchSideServiceImpl.toDto`'s own established precedent of composing a mapper call plus additional joined data — not "hand-mapping an entity," just response composition from several sources).

#### 11. `backend/src/main/java/com/cricketlegend/service/MatchAvailabilityPollService.java` + `service/impl/MatchAvailabilityPollServiceImpl.java` (new)
Admin surface — `list`, `create`, `open`, `close`, `getResponses`, each taking `clubId` first and reusing `MatchSideServiceImpl`'s exact `findMatchOrThrowForClub`/`findXOrThrowForY` isolation style:

- `create(clubId, matchId, request)`: resolve match, validate `request.teamId()` equals `match.homeTeamId` or `match.awayTeamId` (plain `ValidationException`, matching `MatchSideServiceImpl.createSide`'s identical check — no new subclass, per spec's own note), `409` `ConflictException` if a poll for that team already exists (same plain-exception precedent as `createSide`'s duplicate-side check). Creates with `open = true`.
- `open`/`close`: `409` `InvalidStatusTransitionException` (existing class, reused — matches `LeagueServiceImpl.deactivate/reactivate`'s exact "already X" shape) if already in that state.
- `getResponses(clubId, matchId, pollId)`: resolves the poll's squad and each player's current status (see the correctness note below), computes counts, builds `publicPath`.
- **Correctness note, not a spec redefinition:** counts/squad resolution must query `TeamSquadMemberRepository.findByTeamIdAndSeasonId(teamId, match.getSeasonId())` **directly**, then map each row via `PlayerMapper`'s existing person/profile lookup pattern (mirroring `TeamSquadServiceImpl`'s own private `toSquadMemberDto(TeamSquadMember)` — resolve `PlayerProfile`/`Person` per row) — **not** by calling `TeamSquadService.list(clubId, teamId, seasonId)`. That method's `findTeamOrThrowForClub` enforces `team.clubId == clubId`, which breaks for the legitimate cross-club-opponent-Team case `029` already allows (a poll's `teamId` can belong to a different club than the match's own managing `clubId`, exactly like XI-building already permits). Querying the repository directly sidesteps that false-404 risk. A small private helper, e.g. `resolveSquadRows(UUID teamId, UUID seasonId)`, shared by this service and the public service below (per `docs/standards/backend.md`'s "shared logic lives in one place" — extract before the second use).

#### 12. `backend/src/main/java/com/cricketlegend/service/PublicAvailabilityPollService.java` + `service/impl/PublicAvailabilityPollServiceImpl.java` (new)
Public surface — `getPoll(pollId)`, `setAvailability(pollId, playerProfileId, status)`:
- Both resolve `MatchAvailabilityPoll` → `Match` → (`Team` for `teamName`, home/away names falling back to `Match`'s free-text names, `League`/`Season` for `leagueName`/`seasonLabel` if set) entirely from the `pollId` alone — no `clubId` parameter anywhere in this service, per spec.
- Squad/response resolution reuses the **same shared helper** from item 11 (`resolveSquadRows`), keeping the join logic in exactly one place per `docs/standards/backend.md`.
- `setAvailability`: `404` `NotFoundException` if `pollId` doesn't exist, or if `playerProfileId` isn't one of the resolved squad rows (not a real `TeamSquadMember` for this poll's team+season); `409` `PollClosedException` if `poll.open == false`; otherwise upserts `PlayerAvailability` (find-by-poll-and-player, else build new) and returns the refreshed `PublicAvailabilityPollDto`.
- Both methods are unauthenticated-safe by construction — no `@PreAuthorize`, matching `PublicClubController`'s existing bare-`@RestController` precedent.

#### 13. `backend/src/main/java/com/cricketlegend/controller/MatchAvailabilityPollController.java` (new)
`/api/v1/manage/clubs/{clubId}/matches/{matchId}/polls[...]`, `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")` on every method, mirroring `MatchSideController`'s exact shape (constructor injection, `ResponseEntity.status(CREATED)` on the `POST` create, plain `ResponseEntity.ok(...)` elsewhere).

#### 14. `backend/src/main/java/com/cricketlegend/controller/PublicAvailabilityPollController.java` (new)
`/api/v1/public/polls/{pollId}` (`GET`) and `/api/v1/public/polls/{pollId}/players/{playerProfileId}` (`PUT`) — bare `@RestController`, no `@PreAuthorize` at all (already `permitAll` at the `SecurityConfig` filter-chain level, second consumer of that namespace after `PublicClubController`).

#### 15. `backend/openapi/openapi.yaml` (regenerate)
Standard regen step, matching `031`'s own precedent commit ("docs(backend): regenerate OpenAPI schema for jersey numbers").

### Frontend

#### 16. `ui/src/api/matchAvailabilityApi.ts` (new)
`listPolls`, `createPoll`, `openPoll`, `closePoll`, `getPollResponses` — thin wrappers on the shared `api` instance, typed against the DTOs above, matching `matchSideApi.ts`'s exact style (a `pollsPath(clubId, matchId)` helper, one function per endpoint).

#### 17. `ui/src/api/publicPollApi.ts` (new)
`getPoll(pollId)`, `setAvailability(pollId, playerProfileId, status)` — same shared `api` instance (`axiosConfig.ts` already no-ops the `Authorization` header when `keycloak.authenticated` is false, confirmed by reading it — no special unauthenticated client needed).

#### 18. `ui/src/components/MatchAvailabilityTab/` (new, four-file anatomy)
`MatchAvailabilityTab.tsx` / `.test.tsx` / `.stories.tsx` / `index.ts`. Presentational only (props: poll data, counts, squad rows, `onOpen`/`onClose`/`onShareInvite` callbacks, `pending` flags) — matches the approved Claude Design mockup's three states (no poll yet / open+mixed responses / closed+read-only). No React Query inside, per `docs/standards/frontend.md` and the spec's own explicit statement.

#### 19. `ui/src/components/PollShareDialog/` (new, four-file anatomy)
`PollShareDialog.tsx` / `.test.tsx` / `.stories.tsx` / `index.ts`. Props: `open`, `onClose`, `match`, `teamName`, `pollId`. Generates the invite text client-side (embeds `${window.location.origin}/poll/${pollId}` + match context), "Regenerate" rebuilds it, matches the approved mockup. Fresh copy, not a port of legacy's literal WhatsApp message text (per spec).

#### 20. `ui/src/pages/manage/MatchFormPage.tsx` (edit)
- New page-local wrapper function, `MatchAvailabilityPanel` (defined directly in this file, same pattern as the existing `MatchSideTab` wrapper — owns all React Query state: `listPolls`/`getPollResponses`/`openPoll`/`closePoll`, keyed `['managed-club', clubId, 'matches', matchId, 'polls']` and `[..., 'polls', pollId, 'responses']`, mirroring `MatchSideTab`'s exact key shape). Renders `MatchAvailabilityTab` (data-and-callback props only) plus `PollShareDialog` (local `dialogOpen` state).
- **Explicit divergence from `MatchSideTab`'s auto-create behavior:** unlike a `MatchSide` (silently auto-created via `useEffect` the moment its tab opens), a poll is **not** auto-created — `MatchAvailabilityPanel` shows the "Open a poll for this side" prompt from the approved design and only calls `createPoll` on an explicit admin click. Calling this out so the builder doesn't copy `MatchSideTab`'s auto-create-on-mount reflex.
- New fourth top-level `Tab` — "Availability" — appended after Home XI/Away XI using the same dynamic-index pattern (`availabilityTabIndex = nextTabIndex++`), gated by the same `hasXiTabs` boolean (a poll only ever makes sense for a real-`Team` side, identical gating rule to the XI tabs).
- Inside that tab, a nested inner `Tabs` (Home/Away sub-tabs, local `activeAvailabilitySubTab` state) — exactly matching the approved Claude Design mockup's two-level tab structure — each rendering `MatchAvailabilityPanel` for that side's `teamId`.

#### 21. `ui/src/pages/view/PublicAvailabilityPoll.tsx` (new page) + `.test.tsx`
No four-file anatomy (pages don't need it). `Container maxWidth="sm"` + natural page flow, matching `UpcomingMatches.tsx`'s existing no-shell public-page precedent (not the phone-frame chrome from the Claude Design mockup, which was presentational only). `useQuery(['public-poll', pollId], () => getPoll(pollId))`; a `useMutation` for `setAvailability` invalidating that same query key on success (server round-trip, not optimistic — matches this codebase's default mutation pattern elsewhere). Renders match header, open/closed banner, squad rows with a `ToggleButtonGroup` per row (disabled when closed), and a clean "Poll not found" state on a 404.

#### 22. `ui/src/App.tsx` (edit)
- New unguarded top-level route: `<Route path="/poll/:pollId" element={<PublicAvailabilityPoll />} />`, outside both `/manage` and `/player` trees.
- `/manage/availability`'s element changes from the generic `<EmptyState title="Availability Polls" description="Coming soon." />` to a short explanatory panel pointing admins at a match's own Availability tab (per spec — no standalone poll-list screen this pass). Simplest correct approach: a `<EmptyState>` with updated copy (e.g. "Open a match from Fixtures & Results to manage its availability poll.") rather than a new component — this isn't a real screen, just corrected placeholder text.

### Tests (test-writer, after builders finish)

Per spec's Test Plan, compared against what's actually written:
- `MatchAvailabilityPollServiceImplTest.java`, `PublicAvailabilityPollServiceImplTest.java` (unit) — every case listed in the spec's Test Plan table, including the cross-club-team squad resolution case from the correctness note above.
- Testcontainers repository tests for both new tables (migration applies cleanly, both unique constraints reject duplicates at the DB level).
- `MatchAvailabilityPollControllerIntegrationTest.java` (real `CLUB_ADMIN`/cross-club `403`/`404`/`platform_admin` superset) and `PublicAvailabilityPollControllerIntegrationTest.java` — **explicitly with no `Authorization` header at all**, per spec: real `200` round-trip, closed-poll `409`, unknown-`pollId` `404` on both `GET`/`PUT`, and a check that the public response shape carries no sibling club/match data.
- `MatchAvailabilityTab.test.tsx` + story, `PollShareDialog.test.tsx` + story, `PublicAvailabilityPoll.test.tsx` + story, `MatchFormPage.test.tsx` extended (new tab/sub-tab gating).
- Extend `ui/e2e/manager-league-management.spec.ts`: open a side's poll, generate/inspect share text, open the public link in a fresh unauthenticated browser context, set availability, confirm the admin count updates, close, confirm read-only, reopen, confirm writable again — per spec's own golden path.
- OpenAPI contract: both `/manage` and `/public` endpoint sets documented in the regenerated schema.

## Agent assignment

1. **`backend-builder`** — items 1–15 (entities, migration, repositories, exception, DTOs, mapper, both services, both controllers, OpenAPI regen).
2. **`frontend-builder`** (after backend-builder, since it consumes real endpoint shapes) — items 16–22.
3. **`test-writer`** — compares the spec's Test Plan against what both builders actually wrote, fills gaps per the Tests section above.

Then: manual smoke test per `CLAUDE.md` — open a match with a built squad, open a poll, generate the share text, open the public link in an incognito/unauthenticated browser context, set a few players' availability, confirm the admin tab's counts update, close and reopen the poll — before commit/review.

## Flags for your review

1. **`resolveSquadRows` bypasses `TeamSquadService.list(...)` and queries `TeamSquadMemberRepository` directly instead** (item 11). This is a correctness fix, not a style preference: `TeamSquadService.list` enforces `team.clubId == clubId`, which would incorrectly 404 a legitimate cross-club-opponent-Team poll (the same cross-club allowance `029` already established for XI-building). Confirming this is the right call before backend-builder writes it, since it's the one place this plan diverges from "just reuse the existing service method."
2. **Where the MapStruct line sits** (item 10). Only the plain entity→DTO mapping (`MatchAvailabilityPollDto`) goes through MapStruct; the two richer, multi-source DTOs are assembled via plain record construction in the service, matching `MatchSideServiceImpl.toDto`'s existing precedent. Flagging since a literal reading of backend.md's "mapped via MapStruct, never by hand" could be read more strictly — this is the same shape already shipped and accepted for `MatchSide`, not a new precedent.
3. **`/manage/availability`'s destination is corrected copy on the existing `EmptyState`, not a new component.** The spec's UI Requirements describes this as "a short explanatory panel" without fully specifying its shape; a plain `EmptyState` with updated text is the smallest correct fix (no standalone poll-list screen exists to link to this pass) — flagging in case you'd rather it be something more substantial.

## Verification

- Backend: `cd backend && ./mvnw test` (unit + Testcontainers integration), OpenAPI contract diff clean.
- Frontend: `cd ui && npm run build && npm run lint && npm run test && npm run test:storybook`.
- Manual smoke test per `CLAUDE.md`'s UI rule (see Agent assignment above) — including the public page in a real incognito window, not just a logged-in tab, since that's the entire point of this feature.
- `npm run test:e2e` locally for the extended golden path (not CI-gated, same precedent as every prior `/manage` spec).
