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

## Built differently from the plan
- `service/support/PlayerRoster` (a small public record) holds the visible roster shared by the list and the summary, and the focus uses plain conditionals: ArchUnit forbids nested types and the synthetic class an enum `switch` creates inside `service.impl`.
- The Status-actions hook is `hooks/usePlayerStatusActions.tsx` and, besides `requestAction` and `dialog`, returns `pending`.
- The default season reuses the existing `hooks/useAvailabilitySeason` rather than a new `listSeasons` + `pickDefaultSeasonId` pair.
- Tests ended up as `PlayersSummaryIntegrationTest`, `PlayersSummaryQueryCountIntegrationTest`, `PlayerCounterQueriesIntegrationTest` (the two new queries against Postgres), `PlayerListFocusTest` and additions to `PlayerServiceImplTest`; frontend `PlayerStatusMenu`, `usePlayerStatusActions`, `playerStatus` tests plus rewritten `PlayerCard`, `PlayerList` and `PlayerDetailPage` tests. Every existing `Player` fixture gained `verificationStatus: 'VERIFIED'`.
- Results: backend 1,822 tests green (full run in a scratch copy); frontend 2,449 unit tests green (`--maxWorkers=2`), Storybook stories for `PlayerCard` and `PlayerStatusMenu` green.
- Not checked in a browser: the card at phone, 2- and 3-column widths, the Status menu and confirmations, the Player page banner. The running backend must be restarted first (migration 040), and an unverified player has to be set by hand in the dev database since no registration flow exists yet.

---

# Follow-on: games played on the card, and the Cards | List view

*Approved by the user 2026-10-09 and recorded verbatim; deviations are listed at the end.*

## Context

Spec 088 is built and committed on `feat/087-slice-1-shared-pieces` except for two parts the user added after approving the card (spec sections **E** and **F**, mockup boards 1–8 approved, "per-page remembered view is fine", "Players sets the standard going forward"):

- **E. Games played:** two equal-width stat chips in the card header's top-right corner, "N this season" over "N overall", always present ("0" when none) so cards keep one height. Counted from the platform's own selections.
- **F. Cards | List view:** a switch on the content line (first control in the Filters sheet on a phone), the choice remembered per page in the browser (`playerList:view`, default Cards), and a compact list: one bordered panel, header row, zebra rows, **whole row opens the player**, a Status kebab above that link opening the same `PlayerStatusMenu`. The switch and the remembered preference are built as **shared** pieces (`ListViewToggle`, `useListViewPreference`) because Matches and Polls will reuse them (roadmap item already written).

Nothing else in 088 changes. All work stays on the same branch.

## Findings that shape the plan

- `PlayerMapper.toDto(person, profile, sectionIds)` is the one compose point (used by list, create, update, verify, reject and the squad DTOs). Games counts are only meaningful on the **list**, so the mapper gets an overload with the two counts and the existing signature delegates with zeros; other endpoints keep returning `0` for both (documented on the DTO and in OpenAPI). Flagged below.
- `PlayerProfileRepository` already has a projection-view pattern (`PlayerDateOfBirthView`, `findActiveDatesOfBirth`), so a grouped games query returns an interface view the same way; two statements (overall, and this season when `seasonId` is given), never per player.
- `PlayerList` currently sends `seasonId` only with a season focus and does not wait for seasons; the card now needs `seasonId` on every list request, so the list query must wait for the seasons query to finish (otherwise it would fetch twice). `useAvailabilitySeason` already returns `seasonsLoading`.
- `utils/segmentedSwitch.ts` (`segmentedSwitchSx`) is the existing segmented-switch style (Availability views); `ListViewToggle` reuses it.
- `utils/zebraTint`, `PlayerStatusMenu`, `usePlayerStatusActions`, `badgeSx`, `playerStatusBadge` and the stretched-link pattern (`RecordCard`/`PlayerCard`) are all reused as is.
- Every `Player` test/story fixture needs the two new numeric fields (same mechanical insertion as `verificationStatus` was).

## Decisions to confirm (spec left room; each is my reading)

1. **"Played" = an active match whose `matchDate` is on or before now** (started, past or in progress), counted per player as `count(distinct match)` over their `MatchSidePlayer` selections; a deactivated or upcoming match does not count.
2. **Games counts are populated by the list endpoint only.** `create`, `update`, `verify`, `reject`, `deactivate`, `reactivate` and the squad DTOs return `0` for both (the frontend always refetches the list after a status change). The alternative, computing them in every response, adds two queries to every write for no use.
3. **The list query waits for the seasons query**, then sends `seasonId` on every request (so the card's "this season" is right on first paint). With no season in the club, "this season" is `0` and the list still loads.
4. **Equal-width chips:** a fixed minimum width (104 px) plus stretch, so the two chips match each other and line up from card to card.
5. **The list header row is sticky** (`position: sticky; top: 0`) within the page's scroll container, as the mockup says; it needs no scroll container of its own.
6. **Phone list view:** columns Player (avatar, name, status badge under it), Season, Overall and the Status button, 56 px rows, as the mockup.

## Backend — `backend-builder` (all under `backend/src/main/`)

1. `repository/PlayerGamesView` (new interface projection: `getPlayerProfileId()`, `getGames()`), and two JPQL queries on `MatchSidePlayerRepository`: `findGamesPlayed(clubId, now)` (all seasons) and `findGamesPlayedInSeason(clubId, seasonId, now)`, both `MatchSidePlayer → MatchSide → Match` with `m.clubId`, `m.active = true`, `m.matchDate <= :now`, `group by p.playerProfileId`, `count(distinct m.id)`.
2. `dto/PlayerDto` gains `int gamesThisSeason`, `int gamesOverall` (last components). `mapper/PlayerMapper`: `toDto(person, profile, sectionIds)` delegates to a new `toDto(person, profile, sectionIds, gamesThisSeason, gamesOverall)` with zeros; all other callers untouched.
3. `service/impl/PlayerServiceImpl.list`: after the focus step, load the two maps once (overall always; season only when `seasonId` is not null) and pass each player's counts to the mapper; `Instant.now()` read once per call. A club with no matches makes both queries return empty and costs nothing extra. No change to the summary.
4. `backend/openapi/openapi.yaml`: `gamesThisSeason` and `gamesOverall` on `PlayerDto` (additions only), described as "populated by the list; 0 elsewhere".

## Backend tests — `test-writer`

- Repository (`PlayerCounterQueriesIntegrationTest`, extended): a started match counts, an upcoming and a deactivated match do not, a player in two matches counts 2, another season is excluded from the season query but counted overall, another club excluded, a player with no selections is absent (the mapper treats absent as 0).
- Unit (`PlayerServiceImplTest`): the list maps the two counts from the repository views (including "no seasonId → this season 0, season query not called").
- Integration (`PlayersSummaryIntegrationTest`, extended): the list JSON carries `gamesThisSeason` and `gamesOverall` for a seeded club (past match in the season, past match in another season, upcoming match); other endpoints return 0. New statement-count guard for the **list** with a season (small vs large club, same count), in `PlayersSummaryQueryCountIntegrationTest`.

## Frontend — `frontend-builder` (all under `ui/src/`)

1. `api/playerApi.ts`: `Player.gamesThisSeason`, `gamesOverall` (numbers); every test/story fixture gains `gamesThisSeason: 0, gamesOverall: 0` (mechanical).
2. `hooks/useListViewPreference.ts` (new, shared): `useListViewPreference(storageKey, defaultView = 'cards')` returns `[view, setView]`; reads `localStorage` once in the `useState` initialiser, accepts only `'cards' | 'list'` (anything else, or unavailable storage, falls back to the default), writes on every change; every access try/catch-guarded like `usePersistedListFilters`. Test.
3. `components/ListViewToggle` (new, four-file anatomy, shared): a small segmented control "Cards | List" (MUI `ToggleButtonGroup`, `segmentedSwitchSx`, icons `GridViewOutlined` / `ViewListOutlined`, `aria-label="View"`, each button `aria-pressed`), `value` + `onChange`; a `fullWidth` option for the phone sheet.
4. `components/PlayerCard`: the two stat chips in the header's right corner, a stretched column with `minWidth: 104`, chips `justifyContent: center`, `aria-label` "N games this season" / "N games overall", always rendered; title keeps its two-line clamp beside them. Tests and stories updated (including "0", large numbers, and a long name).
5. `components/PlayerTable` (new, four-file anatomy, the list view): props `players`, `sectionNamesFor`, `viewTo(player)`, `onStatusAction(player, action)`. One bordered panel; sticky header row; body rows in a separate container with the zebra tint (first row tinted); CSS-grid columns on `sm` and up (Player, Status, Section, No., Phone, Bat, Bowl, This season, Overall, Status button), reduced to Player / Season / Overall / Status button below `sm`; the player's name is a `RouterLink` whose `::after` stretches over the row (row `position: relative`), hover tint and `:focus-within` ring; the Status `IconButton` is `position: relative` above the link and opens `PlayerStatusMenu` (anchor per row); "–" for absent values; 44 px rows (56 px on a phone). Tests and stories.
6. `pages/manage/PlayerList.tsx`: `useListViewPreference('playerList:view')`; `ListViewToggle` as the first control on the content line and first in the sheet's `viewControls` (full width); render `PlayerTable` instead of the card grid when the view is list; the list query `enabled` also waits for `!seasonsLoading` and always sends `seasonId`; search, sort, filters, counters, empty states, the Status dialogs and `keepPreviousData` unchanged. Existing `PlayerList` tests adjusted for the always-sent `seasonId` and the waiting query; new tests for the switch.
7. Docs: `docs/standards/design-system.md` (`ListViewToggle`, `PlayerTable`, `useListViewPreference`, the stat chips), `docs/standards/frontend.md` (**"List views" standard**: a page with a card grid gets the Cards | List switch, the choice is remembered per page via the shared hook, the whole row opens the record, row actions never navigate), spec status, and this plan appended to `docs/plans/088-players-polls-alignment.md`.

## Frontend tests — `test-writer`

`useListViewPreference` (default, restore, invalid value, storage unavailable, writes on change), `ListViewToggle` (pressed states, change, full width), `PlayerCard` (chips always present, "0", equal width via the shared min width and stretch, aria labels), `PlayerTable` (columns and "–", zebra, whole-row link and no navigation from the Status button, the menu per status and its calls, reduced columns on a phone, equal row heights, header present), `PlayerList` (switch changes the layout only, the choice survives a remount, counters and filters identical in both views, the list waits for seasons and sends `seasonId`, the sheet's switch on a phone). Stories: `PlayerTable` (all statuses, nothing on file, narrow), `ListViewToggle`, `PlayerCard` stat variants.

## Order and commits

1. Backend (queries, DTO/mapper, service, openapi) + tests (2 commits). 2. Frontend: api + fixtures + hook + `ListViewToggle` → `PlayerCard` chips → `PlayerTable` → `PlayerList` wiring → tests/stories (4 commits). 3. Docs. Conventional commits tagged `(088)`.

## Verification

- **Backend:** never run Maven under the live app; `rsync` to the session scratchpad and run there: `-Dtest='PlayerServiceImplTest,PlayersSummary*,PlayerCounterQueries*,PlayerController*,LayeringRulesTest'`, then the full backend run once (it takes about 12 minutes); confirm `openapi.yaml` parses and only adds lines. The user must restart the running backend for the new numbers.
- **Frontend:** `nvm use 22.12.0`; `npx tsc -b`, `npm run lint`, `npx vitest run --project=unit --maxWorkers=2`, Storybook project for `PlayerCard`, `PlayerTable`, `ListViewToggle`.
- **Manual (needs the user at their PC, backend restarted):** the two chips on each card match the player's past selections; Cards | List switch changes the layout and the choice survives a reload; clicking anywhere on a row opens the player while the Status button only opens its menu; the phone list and the Filters-sheet switch.

## Not in this plan

List views for Matches and Polls (own specs and mockups, roadmap item exists), sortable list columns and a column picker, career statistics, a server-side (cross-device) preference.

## Built differently from the plan
- `ListViewToggle` has its own compact style (light primary tint when selected), not `segmentedSwitchSx`: the approved mockup uses the quiet tint on the content line, while the Availability switch keeps its solid fill.
- The page treats the wait for seasons as loading (`isPending`, not `isLoading`), otherwise it flashed "Couldn't load players" while the list query waited for the seasons query; the existing `PlayerList` tests now `mockReset` their mocks in `beforeEach` so a leftover `mockReturnValueOnce` cannot leak across tests.
- The Unverified quick filter now also sends the season (every request does).
- Results: backend 1,827 tests green (full run in a scratch copy, including new tests for the two games queries, the list counts and a list statement-count guard); frontend suite green with `--maxWorkers=2`; Storybook stories for `PlayerCard`, `PlayerTable` and `ListViewToggle` green.
- Not checked in a browser: the chips' equal width, the list view at desktop and phone widths, the sticky header inside the real page, and the remembered view across a reload. The running backend must be restarted for the new numbers.

