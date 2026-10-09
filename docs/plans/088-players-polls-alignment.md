# Plan: spec 088 — Players aligned with Polls, and player verification (one plan, whole spec)

## Context

Spec 088 (`docs/specs/088-players-polls-alignment.md`, mockup approved by the user 2026-10-09) brings the Players page onto the Polls/Matches pattern and adds a verification status for later self-registration. Four counters (Active players, In a squad this season, Players selected this season, Unverified players) from a backend summary endpoint; `FilterBar` + content line toolbar; a `PlayerCard` with the same five rows and the same Status / Edit / View footer on every card; one Status button whose menu offers only valid changes (Verify, Reject, Suspend, Reactivate). It builds on `PageCounters` short labels, the zebra tint, `FilterBar` and the Matches list from PR #106, so all work goes on branch **`feat/087-slice-1-shared-pieces`** (the spec commits on `docs/088-players-polls-alignment` are cherry-picked or merged in first). Slicing follows the spec's Rollout Notes; each slice is its own commits, one branch.

## Findings that shape the plan

- `PlayerServiceImpl.list` already loads the whole club roster (`findByClubId`), batches section links once, then filters in Java by section scope. It is an unpaginated, bounded list (028). So `includeInactive`, `focus` and verification filtering belong in the same in-memory step; the summary reuses the same resolved set, so list and counters cannot drift.
- **"Suspended" is `active = false`**: the existing `deactivate` and `reactivate` endpoints (they also close/reopen the `ClubMembership`) stay unchanged and back the Suspend and Reactivate menu items. Rejected profiles stay `active = true`.
- `PlayerMapper.toDto` is a hand-written compose (the only `new PlayerDto(` call), so adding `verificationStatus` is one place.
- Squad membership = `TeamSquadMember(teamId, seasonId, playerProfileId)`; selection = `MatchSidePlayer(matchSideId, playerProfileId)` via `MatchSide(matchId)` and `Match(seasonId, clubId, active)`. `ManagerOverviewFixtures` already seeds players, rosters and sides for tests.
- Today `listPlayers` is also called by `TeamFormPage` and `MatchFormPage` (pickers); the spec's default `includeInactive=true` leaves them unchanged (they will still see rejected and unverified players until registration lands, a known non-goal).
- Deactivate and Reactivate currently live only on `PlayerFormPage` (kept as is); the Player detail page has Edit only.
- **`PageCounters` needs no change**: the spec ended with four counters, which is the existing four-across grid and short labels already exist (slice 4 of 087). The "column count" item in the spec's rollout note is therefore dropped.

## Decisions to confirm (spec left room; each is my reading)

1. **"Selected" counts active matches only** of the default season (past or upcoming); a deactivated match's selection does not count.
2. **A suspended player shows the Suspended badge** (it overrides their verification badge) and only offers Reactivate; their verification status is kept underneath.
3. **Section scope for unverified players:** a player with no section tags is visible only to club-scope admins (the existing rule); self-registration will need to tag sections, which is out of scope here.
4. `focus=in-squad|selected` without `seasonId` is a 400 (spec); the Players page sends the default season (`pickDefaultSeasonId`) and, with no season at all, shows the two season counters as 0 and plain.
5. Reject and Suspend ask first (`ConfirmDialog`); Verify and Reactivate act at once (spec).

Nothing else in the spec is reinterpreted.

## Backend — `backend-builder` (all under `backend/src/main/`)

1. **Migration** `resources/db/changelog/v1/040-player-verification-status.sql` + include in `db.changelog-master.xml` after 039: `ALTER TABLE player_profile ADD COLUMN verification_status VARCHAR(16) NOT NULL DEFAULT 'VERIFIED'` with a `CHECK (verification_status IN ('VERIFIED','UNVERIFIED','REJECTED'))`.
2. **Domain:** `domain/PlayerVerificationStatus` (`VERIFIED, UNVERIFIED, REJECTED`); `PlayerProfile.verificationStatus` (`@Enumerated(STRING)`, `@Builder.Default VERIFIED`); `domain/PlayerListFocus` (`IN_SQUAD("in-squad")`, `SELECTED("selected")`, `UNVERIFIED("unverified")`, `parse(String)` as `MatchListFocus`: blank → null, other → `ValidationException`).
3. **DTOs/mapper:** `PlayerDto` gains `verificationStatus` (last component); `PlayerMapper.toDto` fills it; new flat record `PlayersSummaryDto(playersShown, inSquad, selected, unverified)`. `CreatePlayerRequest`/`UpdatePlayerRequest` unchanged (spec: a manager never sets it by hand).
4. **Repositories:** `TeamSquadMemberRepository`: distinct player ids with a squad row for a season (JPQL, club-scoped through the loaded roster in Java); `MatchSidePlayerRepository`: distinct player profile ids selected in an **active** match of a club and season (`MatchSidePlayer` → `MatchSide` → `Match`, JPQL). Both single statements.
5. **Service** (`PlayerService` + `PlayerServiceImpl`):
   - extract the existing load-and-scope step into one private method (`visibleProfiles(authentication, clubId, sectionId, missingDateOfBirth, includeInactive)`): `includeInactive=false` hides `!active` and `REJECTED`.
   - `list(..., includeInactive, focus, seasonId)`: apply the focus to the visible set (`UNVERIFIED` by status; `IN_SQUAD`/`SELECTED` through the two new queries, `seasonId` required, else `ValidationException`), then load persons and map as today.
   - `summary(authentication, clubId, sectionId, missingDateOfBirth, seasonId, includeInactive)`: the same visible set; `playersShown` = its size, `unverified`, and (only when `seasonId` is given, else 0) `inSquad`/`selected`; no person lookups, fixed statement count.
   - `verify` and `reject`: `findOrThrowForClub`, `assertCanAdministerAnySection` on the player's sections, transitions `UNVERIFIED→VERIFIED`, `UNVERIFIED→REJECTED`, `REJECTED→VERIFIED`; anything else `InvalidStatusTransitionException` (409). `@Transactional`.
6. **Controller** (`PlayerController`): list gains `includeInactive` (default `true`), `focus` (String → `PlayerListFocus.parse`), `seasonId`; new `GET .../players/summary` and `POST .../players/{playerId}/verify` and `/reject`, all `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")`. The literal `/summary` path is declared so it never clashes with `{playerId}` routes.
7. **`backend/openapi/openapi.yaml`** (by hand, additions only; there is no CI contract check): the three new operations, the new schema, the three new list parameters and `verificationStatus` on `PlayerDto`.

## Backend tests — `test-writer` (JUnit 5 + Testcontainers, per `docs/standards/testing.md`)

- Unit: `PlayerListFocusTest`; `PlayerServiceImplTest` additions (focus without season → 400, includeInactive filtering of suspended and rejected, verify/reject transitions and 409s, summary composition and zeros for a caller with no sections).
- Repository: the two new queries (a player in two squads or two selections returned once; another season and an inactive match excluded; a selected player in no squad).
- Integration: new `PlayersSummaryIntegrationTest` (HTTP, `ManagerOverviewFixtures`): counters for a seeded club, **counters equal the list totals** for each focus across several filters, section-manager scoping, another club 403, bad `focus` 400, verify/reject endpoints, `PlayerDto.verificationStatus` present; existing players and manager-created players are `VERIFIED` (a migration/default check). New `PlayersSummaryQueryCountIntegrationTest` (small vs large club, same statement count).
- Existing `PlayerServiceImplTest`/`PlayerControllerIntegrationTest` call sites updated for the new signatures only.

## Frontend — `frontend-builder` (all under `ui/src/`)

1. **`api/playerApi.ts`**: `Player.verificationStatus`; `ListPlayersParams` + `includeInactive`, `focus`, `seasonId` (sent only when set; `includeInactive` sent only as `false`); `PlayersSummary` type, `getPlayersSummary`, `playersSummaryKey` under the existing `['managed-club', clubId, 'players']` prefix; `verifyPlayer`, `rejectPlayer`.
2. **`utils/playerStatus.ts`** (new): `PlayerStatus = 'verified' | 'unverified' | 'rejected' | 'suspended'` derived from `active` + `verificationStatus` (suspended first), the valid actions per status (table in the spec), and the badge label and tone per status. One definition for the card, the menu and the detail page.
3. **`components/PlayerStatusMenu`** (new, four-file anatomy): presentational MUI `Menu` headed "Status: <current>" listing only the valid actions; `onAction(action)`.
4. **`hooks/usePlayerStatusActions.tsx`** (new): the four mutations (`verifyPlayer`, `rejectPlayer`, `deactivatePlayer`, `reactivatePlayer`), the Reject and Suspend `ConfirmDialog`s with the spec's wording, invalidation of the players prefix (list and summary), error feedback; returns `{ requestAction(player, action), dialog }`, the same shape as `useAvailabilityNavigation`.
5. **`components/PlayerCard`** rewritten (tests and stories rewritten): header avatar (unchanged) with a title clamped to two lines; one badge row (status badge first, then the first section + `+N`, or a dashed "No section"); the five zebra rows Number / Born / Phone / Bat / Bowl with "–" when absent (reuse `DetailLine`-style rows and `zebraTint`); footer of three equal columns Status / Edit / View (the Status button opens `PlayerStatusMenu`); the whole card still a stretched link. Props: `player`, `sectionNames`, `viewTo`, `editTo`, `onStatusAction`.
6. **`pages/manage/PlayerList.tsx`** rebuilt on the Matches pattern: `PageCounters density="compact"` with the four counters (labels, short labels "Active / In a squad / Selected / Unverified", amber Unverified, reset card, mutually exclusive quick filter, per-visit); `FilterBar` (`sections` + search with no leagues/teams, `extraChips` for the quick filter and Missing date of birth, sheet `viewControls` with the two switches, sort link and a Quick filter row); `ContentControlsLine` ("Showing N players" + focus name, `SortLink` "A to Z", `CompactSwitch` "Show suspended and rejected players" and "Missing date of birth"); `ManageScreenHeader` subtitle for the section scope; section and missing-date-of-birth stay in `usePersistedListFilters`, show-suspended and focus are per visit; list and summary queries use `keepPreviousData`; the default season from `listSeasons` + `pickDefaultSeasonId`; existing empty states kept; each card wired to `usePlayerStatusActions`.
7. **`pages/manage/PlayerDetailPage.tsx`**: replace the Inactive badge by the status badge; add the Status button (outlined, beside Edit) opening `PlayerStatusMenu`; an amber banner above the cards for an unverified player (and the closed tone for a rejected one) with a "Change status" button, per the mockup.
8. `PlayerFormPage` keeps its Deactivate and Reactivate buttons unchanged.

## Frontend tests — `test-writer`

`PlayerCard` (status badge always first; five fixed rows with "–"; identical footer for every status; menu per status calling the right action; no height-changing parts), `PlayerStatusMenu`, `usePlayerStatusActions` (Reject and Suspend ask, Verify and Reactivate act at once, invalidation), `playerApi` (params and summary), `PlayerList` (counters from the summary and the filters sent, quick filter sends `focus` + `seasonId`, chip, badge, scope text, reset, zero rule, amber Unverified, failed summary hides the row, switch default off sending `includeInactive=false`, Missing date of birth persisted, Clear all, phone sheet), `PlayerDetailPage` (status badge, Status button, banner). Stories: `PlayerCard` (all statuses, nothing on file, long name, several sections), `PlayerStatusMenu`.

## Docs (same PR)

`docs/standards/design-system.md` (PlayerCard fixed rows and footer, `PlayerStatusMenu`, the status badge tones), `docs/standards/frontend.md` (Players now on the `FilterBar` pattern), roadmap (Players built; self-registration remains), spec status, and this plan appended to `docs/plans/088-players-polls-alignment.md` after approval.

## Order and commits

1. Bring the spec commits and the approved mockup note onto `feat/087-slice-1-shared-pieces`. 2. Backend: migration → domain → repos → service → controller → openapi → tests (3 commits). 3. Frontend: api + utils + status menu + hook → `PlayerCard` → `PlayerList` → `PlayerDetailPage` → tests/stories (4 commits). 4. Docs. Conventional commits tagged `(088)`.

## Verification

- **Backend:** never run Maven under the live app. `rsync` to the session scratchpad and run there: `./mvnw -q -o test -Dtest='PlayerListFocusTest,PlayerServiceImplTest,PlayersSummary*,PlayerController*,PlayerProfileRepositoryTest,MatchSidePlayerRepositoryTest,LayeringRulesTest,PlayerAvailability*,ManagerOverview*'`, then the full backend run once; confirm the migration applies (Testcontainers) and `openapi.yaml` parses and only adds lines. The user must restart the running backend before the counters and Status menu work (earlier lesson: the old build has no `/players/summary`).
- **Frontend:** `nvm use 22.12.0`; `npx tsc -b`, `npm run lint`, `npx vitest run --project=unit --maxWorkers=2` (full-parallel runs time out on form tests), Storybook project for the new and changed components.
- **Manual (needs the user at their PC, backend restarted):** every counter figure equals the cards after clicking it; Status menu per status; Reject and Suspend confirmations; all cards the same height with "–"; phone Filters sheet; Player page header button and banner (needs an unverified player: set one by hand in the dev database since no registration flow exists).

## Not in this plan

Self-registration, notifying the requester, keeping unverified or rejected players out of squads, selections and polls, a rejectable verified player, and a drill-down panel.
