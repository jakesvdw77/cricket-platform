# 100 — Match Results: Core Capture and Publish Gate

**Depends on:** `001-tenancy-identity-model.md` (club, section, team, player), `029-league-management.md` (`Match`, `Season`, `League`), `075-match-view-and-edit.md` (match page), `076`/`093` (team selection: `MatchSide`, `MatchSidePlayer` batting order), `087`/`089` (Matches page: counters, toolbar, card, list view, the gold standard this page copies), `097-import-framework.md` (confirm-before-write pipeline the future import adapters plug into), `099-fields-directory.md` (`PlayingArea` for the field override), `docs/standards/*.md`.
**Status:** built, in review (feature/100-match-results) — written 2026-10-13 from the user's Results brief and answers (limited overs only for now; either club manager can capture and publish; if both teams are ours treat both as ours; league tables out of scope). This spec builds **slice 100 only**; slices 101 to 104 are outlined under "Roadmap of the Results module" and each gets its own spec.

## Problem & Goals

The platform schedules matches, polls availability and selects teams, but a match never ends: there is no result, no score, no completed status, and no data for player or team statistics (`PlayerDetailPage`'s Stats card is a "Coming soon" placeholder, `060`). Results are a hero feature, and must be captured quickly by a manager copying from an official scorecard, must stay hidden until deliberately published, and must be shaped so results from other platforms can later be transformed into the same model.

This spec builds the foundation every later slice stands on: the **Results page**, a **capture wizard** for the result itself (outcome, toss, scores, field), the **draft / publish gate**, and the **canonical data model**, designed now so scorecards, stats and imports need no rework.

Goals:
- **A. Results page** following the Matches gold standard: counters, the same filters, Cards | List views.
- **B. Capture a result** by picking from past matches that have no result yet, and walking a short wizard.
- **C. Every cricket outcome** capturable in one or two taps: won by runs, won by wickets, tie, draw, no result, abandoned, forfeit, decided by DLS, decided by super over (any number of super overs).
- **D. Toss, scores, field:** who won the toss and chose what; runs, wickets and overs (e.g. 36.4) per innings; field defaulting to the match's, overridable.
- **E. Publish gate:** a result is a draft until published; drafts are invisible to anyone who cannot capture results; only published results count for anything (completed status, later stats).
- **F. Import-ready model:** one canonical `ResultDraft` shape that manual capture and future adapters both produce, with `source` and `external_id`.

## Non-goals

- **Scorecards (batting, bowling, fielding), standouts, player of the match** — slices `101` and `102`. This slice stores only match-level facts and innings totals. The detail level field and the wizard's step list are in place so those slices extend them.
- **Statistics** — slice `103`. Decision recorded here so the model is right: stats are **computed from published scorecard rows by link, never copied onto player or team records** (see "Statistics decision").
- **Import adapters** — slice `104`; this slice only reserves `source`, `external_id`, the raw payload column and the `ResultDraft` DTO.
- **League tables, standings and points** — out of scope (the user's answer, 2026-10-13); `029` still defers them. Nothing here computes points.
- **Multi-innings (two-day, declarations, follow-on) formats.** Limited overs only (user's answer). The innings list in the model does not preclude them; no UI or validation for them is built.
- **Player- and public-facing result views.** Only the gate is built: every read path hides drafts from non-capturing roles. A "My results" or public results page is a later spec.
- **Ball-by-ball or live scoring.** This is not a scoring application (the user's words); `scoring_url` on `Match` stays a link.
- **Notifications or announcements on publish** (a roadmap item once the notifications infrastructure exists).
- **Per-role capture rights.** Any club manager who can access the club can capture, edit, publish and unpublish (user's answer); section-scoped restriction can reuse `canAdministerSection` later.

## User Stories

- As a club manager, I can open Results and see counters, filters and a card or list view of past matches with their results (and drafts marked), so that I can review what has been played at a glance.
- As a club manager, I can choose **Capture result** and pick from the past matches that have no result yet, so that I never hunt for the right fixture.
- As a club manager, I can also start capture from a past match's card or page, so that I can go straight to it.
- As a club manager, I can record the outcome by tapping one of the outcome tiles (won by runs, won by wickets, tie, draw, no result, abandoned, forfeit) and say whether it was decided by DLS or a super over, so that every way a match ends is covered.
- As a club manager, I can enter each innings' runs, wickets and overs as I read them ("36.4"), and have the winner and margin proposed from the scores, so that I confirm rather than calculate.
- As a club manager, I can record any number of super overs, so that tied matches decided in a super over are captured properly.
- As a club manager, I can record who won the toss and whether they chose to bat or bowl, so that the result tells the full story.
- As a club manager, I can change the field from the one the match was scheduled at, so that a late change of ground is recorded.
- As a club manager, I can save a result as a draft and come back to it, and publish it when I am sure, so that nothing half-entered is shown.
- As a club manager, I can unpublish a published result to correct it, so that mistakes are fixable.
- As a player or a manager without capture rights, I see no result, draft or otherwise, until it is published, so that unfinished figures never leak.
- As a club manager of a match where both teams are the club's, I record one result covering both sides, so that internal fixtures work like any other.

## Data Model Changes

Migration sketch: `backend/src/main/resources/db/changelog/v1/043-match-results.sql` (the next sequential number after `042`; confirm at plan time). Two tables in slice 100; slices 101 to 103 add more (see the roadmap section).

**Naming of sides.** `Match` has a home side and an away side, each either one of the club's own teams (`home_team_id` / `away_team_id`), a league team, or a free-text opponent. A result refers to sides as `HOME` or `AWAY`; a side is "ours" when its team id is set. Both sides can be ours; then both are ours, and neither is treated as the opposition (user's answer).

### `match_result` (one row per match)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `club_id` | uuid not null | tenancy, matches `match.club_id` |
| `match_id` | uuid not null | **unique**: at most one result per match |
| `status` | varchar | `DRAFT` / `PUBLISHED` |
| `detail_level` | varchar | `SUMMARY` / `OUR_SIDE` / `FULL`; only `SUMMARY` is selectable in this slice, the column and enum exist so `101`/`102` raise it |
| `outcome_type` | varchar | `WON`, `TIE`, `DRAW`, `NO_RESULT`, `ABANDONED`, `FORFEIT` (see below) |
| `decided_by` | varchar | `REGULAR` (default), `DLS`, `SUPER_OVER`; only meaningful for `WON` (a tie settled by super over is `WON` + `SUPER_OVER`) |
| `winning_side` | varchar null | `HOME` / `AWAY`; required for `WON`, null for `TIE`/`DRAW`/`NO_RESULT`/`ABANDONED`; for `FORFEIT` it is the side that **received** the win |
| `margin_type` | varchar null | `RUNS` / `WICKETS`; null for outcomes with no margin and for `SUPER_OVER` |
| `margin_value` | int null | runs or wickets; non-negative |
| `dls_target` | int null | revised target, when `decided_by = DLS` |
| `dls_revised_balls` | int null | revised innings length in balls, when DLS |
| `scheduled_balls` | int null | the match's scheduled length in balls (e.g. 40 overs = 240) |
| `balls_per_over` | int | default 6; overs entry and display convert with it |
| `toss_won_by` | varchar null | `HOME` / `AWAY` |
| `toss_decision` | varchar null | `BAT` / `BOWL` |
| `playing_area_id` | uuid null | field played at; **defaults to `match.playing_area_id` when the result is created**, overridable (`099`) |
| `note` | text null | free text (e.g. "Rain stopped play at 3.40") |
| `source` | varchar | `MANUAL` (default) or `IMPORT:<provider>` (slice `104`) |
| `external_id` | varchar null | provider's id; unique per `(club_id, source, external_id)` where not null |
| `source_payload` | jsonb null | raw provider payload kept for audit and re-mapping (slice `104`) |
| `published_at`, `published_by` | timestamp / uuid null | set on publish, cleared on unpublish |
| `created_at`, `updated_at`, `updated_by` | as the other entities | |

**Outcome rules** (enforced in the service, not just the UI):
- `WON`: `winning_side` required. Regular or DLS wins need a margin (`RUNS` or `WICKETS`). A `SUPER_OVER` win has no margin; the regular innings must be level and at least one `SUPER_OVER` innings for each side (a pair) must exist.
- `TIE`: innings totals must be level when both are present (warning, not a block: official scorers' ties are the truth).
- `DRAW`, `NO_RESULT`, `ABANDONED`: no winner, no margin.
- `FORFEIT`: `winning_side` required; no margin, no innings required.
- `margin_type = WICKETS` implies the winning side batted second; `RUNS` implies it batted first. The service **warns** when the entered scores contradict the margin, never silently overwrites it.
- **Score-versus-result warnings** (all in `ResultValidator`, run by validate and publish, so import adapters (`104`) get them too; never errors, skipped for `FORFEIT`/`ABANDONED`/`NO_RESULT`/`DRAW` and when an innings is missing runs or batting side): `WINNER_NOT_HIGHER_SCORER` (regular win where the other side scored more; margin is then not checked), `MARGIN_MISMATCH` (runs = difference with the winner batting first; wickets = 10 minus wickets lost with the winner batting second), `TIE_NOT_LEVEL` (a tie with unequal scores, or level scores entered as a regular win), `SUPER_OVER_WINNER_MISMATCH` (winner is not the side with more super-over runs, or the super over is level), and for DLS wins only a plausibility check of the winner against the DLS target. A super over win with unlevel regular innings stays an error. **Other warnings** (also acknowledgeable at publish, same rules as above): a win or tie with fewer than two regular innings scores entered (unless decided by super over): "Both innings scores have not been entered."; a DLS win without the revised target or revised overs; an innings longer than the scheduled length; an innings marked all out with fewer than 10 wickets (fewer than eleven batters is legitimate, so only a warning); and the toss disagreeing with the batting order. The response carries message strings only; the codes name the rules in code and tests.

### `match_innings`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `match_result_id` | uuid not null | fk, on delete cascade |
| `sequence` | int not null | 1, 2, then 3, 4… for super overs; **unique with `match_result_id`** |
| `kind` | varchar | `REGULAR` / `SUPER_OVER` |
| `batting_side` | varchar | `HOME` / `AWAY` |
| `runs` | int | ≥ 0 |
| `wickets` | int | 0 to 10 (regular), 0 to 2 (super over) |
| `balls` | int | balls faced, stored as **balls**, never decimal overs |
| `extras` | int null | filled by `101` when a scorecard exists |
| `all_out` | boolean | derived from wickets but stored so "10 wickets down in 30.2" and "9 wickets, innings closed" are distinguishable |

**Why balls:** "36.4" is 36 overs and 4 balls = 220 balls. Storing a decimal would make 36.4 vs 36.67 a bug in every run-rate and bowling average. The UI parses and formats overs (`36.4`, `.4` handled at the edge), the database and API carry `balls`; only the Results API's display fields (`oversDisplay`) are derived strings. Entry validates the digit after the point is below `balls_per_over`.

**Batting order of innings.** `sequence` and `batting_side` are the truth for who batted first; the toss and decision are stored separately and a warning shows when they disagree (e.g. toss winner chose to bat but batted second).

### Match completed status

`Match` gets no new column. A match is **completed** when it has a `PUBLISHED` result; this resolves the roadmap's "true completed/results status" item (`071`, `089`). The match list/summary/filter queries gain a derived `hasPublishedResult` / `resultStatus` (`NONE` / `DRAFT` / `PUBLISHED`) via a join, which also replaces the "played means date passed" approximation on the card.

### Statistics decision (recorded now, built in `103`)

Player and team statistics are **computed from the scorecard rows of published results**, referencing `player_id`, not copied onto player or team records. Reasons: a correction or late player change is one edit instead of re-deriving copies; unpublish removes the result from every stat automatically; there is a single source of truth. If reads become slow, `103` adds a **derived aggregate table rebuilt on publish/unpublish**, a disposable cache, never the source. Results that fail to hold `player_id` (opposition free-text names) never feed club player stats.

### `ResultDraft` (DTO, not a table)

The canonical in-memory shape: match reference, outcome, toss, field, innings list (and, in later slices, entries). The wizard builds one, the manual endpoints accept it, and slice `104`'s per-provider adapters transform external payloads into it, then it passes through the **same validation and the same confirm step** (`097`'s preview-and-confirm principle: nothing writes before an explicit confirm; an import marks `source` and keeps `source_payload`). No business logic lives in the wizard.

## API Contract

Managed routes, club-scoped, consistent with `MatchController`; all use `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")` (any club manager, per the decision above). Lists are backend-paginated (`Page<T>`), per `docs/standards/backend.md`.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/results` | club manager | Paged list of past matches **with a result (draft or published)**; filters `seasonId`, `leagueId`, `sectionId`, `teamId`, `outcome`, `status`, `from`, `to`, text search; same filter parameters and ordering as `matches` |
| `GET /api/v1/manage/clubs/{clubId}/results/summary` | club manager | Counters for the page (see UI): played, published, drafts, awaiting result, won, lost, tied/other |
| `GET /api/v1/manage/clubs/{clubId}/results/filter-options` | club manager | Distinct filter options (as `matches/filter-options`) |
| `GET /api/v1/manage/clubs/{clubId}/results/awaiting` | club manager | Paged active matches with **no result**, newest first; `includeUpcoming` (default false) adds future-dated ones; feeds the capture picker; same filters |
| `GET /api/v1/manage/clubs/{clubId}/matches/{matchId}/result` | club manager | The result (any status) or 404 |
| `PUT /api/v1/manage/clubs/{clubId}/matches/{matchId}/result` | club manager | Create or replace the **draft** (upsert from a `ResultDraft` body: outcome, toss, field, innings). Allowed only while `DRAFT`; a published result must be unpublished first (409 `ResultPublishedException`) |
| `POST /api/v1/manage/clubs/{clubId}/matches/{matchId}/result/validate` | club manager | Dry run: returns errors (block publish) and warnings (acknowledged at publish), writes nothing |
| `POST /api/v1/manage/clubs/{clubId}/matches/{matchId}/result/publish` | club manager | Re-validates server-side, refuses on errors (400), requires `acknowledgedWarnings: true` when warnings exist; sets `PUBLISHED`, `published_at/by` |
| `POST /api/v1/manage/clubs/{clubId}/matches/{matchId}/result/unpublish` | club manager | Back to `DRAFT`; everything derived follows |
| `DELETE /api/v1/manage/clubs/{clubId}/matches/{matchId}/result` | club manager | Delete a **draft** only (a published result is unpublished first) |
| `GET /api/v1/manage/clubs/{clubId}/matches` (existing) | club manager | Gains `resultStatus` per match and a `resultStatus` filter |

**Visibility.** The gate is enforced in the repository specifications/queries, not in the controller: any read path reachable by a role that cannot capture results adds `status = PUBLISHED`. In this slice every results endpoint is manager-only; the gate is a shared `ResultVisibility` specification that player and public endpoints must use when they arrive (unit and ArchUnit-style structural test: no query on `match_result` without it outside the manager services).

**Exceptions** (named subclasses per `backend.md`, extend its table only if a new base is needed; none is): `ResultAlreadyExistsException` (conflict), `ResultPublishedException` (conflict), `InvalidResultException` (validation, carries `errors` and `warnings` as structured `ProblemDetail` properties like `SelectionRejectedException`).

**OpenAPI.** `backend/openapi/openapi.yaml` regenerated and committed; contract diff must show only additions.

## UI Requirements

Compose from existing shared components (`docs/standards/design-system.md`); the Results page is deliberately the Matches page's sibling, per the "record list/create-edit pattern is mandatory" rule: `PageCounters`, `FilterBar`, `ContentControlsLine`, `HeaderSeasonSelect`, `ListToolbar`, `RecordCard`, `ListViewToggle` with `useListViewPreference`, the zebra list-table skeleton, `KeyFigureTile`, `ConfirmDialog`, and `RecordFormScreen`. Nothing hand-rolled. Pixel values come from `theme.ts`.

### Results page (`/manage/results`, menu entry "Results" with the `nav/result-scorecard` brand icon)

- Header: title, Season pill (`HeaderSeasonSelect`), **Capture result** (filled primary, like Add), Cards | List switch.
- Counters (quick filters, `PageCounters`): **Played** (matches with a published result), **Won**, **Lost**, **Tied / no result** (tie, draw, no result, abandoned), **Drafts** (amber), **Awaiting result** (past matches without one, amber, shown as an action). "Won / Lost" are per club team (a team filter narrows to that team; a match between two of the club's own teams gives one team a win and the other a loss).
- Filters: the same as Matches (`FilterBar`: season, league, section, team, date range, search) plus Outcome and Status. In this slice the date range (`from`/`to`) is API-only: the endpoints accept it but `FilterBar` has no date control on the Results page yet (see the roadmap).
- **Result card** (`RecordCard`): both team names with logos, a score line per side ("212/6 (40.0)"), the result line ("Irene Villagers won by 24 runs", "Match tied — won in super over", "Abandoned — rain"), the toss line, date and field, a **Draft** chip (amber) when unpublished. Footer: **View**, **Edit** (filled primary), and **Publish** on a draft. The card never says "Draft" to a role that cannot see drafts (they cannot reach this page).
- **List view:** compact zebra table: Date, Match, Result, Scores, Field, Status; row opens the result page.
- Empty state: "No results yet" with **Capture result**; when matches await a result, a prompt "n matches are waiting for a result".

### Capture picker (dialog opened by Capture result)

A searchable list of matches from `results/awaiting`, newest first, grouped by date, each row showing teams, time, league and the team's section; one tap selects. Filtered to active matches without a result, past ones by default, with an **Include upcoming** toggle (nothing stops a result being captured for any match without one); a "Show all seasons" toggle reuses the existing wording. A match card or page for a past match also shows **Capture result** (a draft is created on first save, not on opening the wizard).

### Capture wizard (`/manage/matches/{matchId}/result`)

A full-page `RecordFormScreen`, mobile-first at 375 px, with a progress stepper; **Save draft** is always available and the page autosaves on step change. In this slice the steps are:

1. **Result:** large outcome tiles (Won, Tie, Draw, No result, Abandoned, Forfeit). Choosing Won shows the side and a "How was it decided" segmented control (Normal | DLS | Super over); a DLS choice reveals revised target and revised overs. The margin is entered here; when scores already exist a **Suggested result** line offers the computed winner and margin with **Use this**.
2. **Toss and field:** who won the toss (two team buttons, or **Not known / skip**) and **Bat / Bowl**; the Field defaulting to the match's field with **Change field** and the Fields picker from `099`; **Scheduled overs pre-filled from the league's playing conditions** (editable; a friendly starts blank); optional note. The toss decides who batted first.
3. **Scores:** the innings are listed in batting order derived from the toss (winner bats: winner first, else the other side), with the toss line shown read-only and a link back to step 2. Without a recorded toss the step asks **Who batted first?**. Changing the toss later re-orders the innings and keeps the entered figures with their side. One row per innings: Runs, Wickets, Overs (accepts "36.4", validates the ball digit), labelled with the team name; run rates read-only. A **Suggested result** line (winner and margin from the scores) offers **Use this**. Super over rows (**Add super over**, any number, numbered 1, 2...) appear only when the result is a win decided by a super over.
4. **Review and publish:** a summary exactly as the card will show it, a single **Checks** list merging the server's validation with the client's score checks (margin against scores with a **Fix** action, winner against scores, super over winner; errors block, warnings need a tick), **Save draft** and **Publish**. Publish uses `ConfirmDialog` ("Players will be able to see this result").

> **Decision after browser check (2026-10-14):** the step order was first drafted as Result, Scores, Toss and field, Review. The user found it wrong: the toss determines who batted first, so Toss and field now comes before Scores. Scheduled overs are pre-filled from the league, and super over panels appear only for a super over decision.

Later slices insert **Our batting**, **Our bowling and fielding**, **Awards and standouts**, **Opposition scorecard** after Scores (step 3) and before Review (step 4) depending on detail level; the stepper is data-driven so adding steps is a registration, not a rewrite. The detail-level chooser is not shown in this slice (always `SUMMARY`).

### Result page (`/manage/results/{matchId}`)

Read page in the Player/Match page standard: header with team logos, result line and Draft chip, key-figure strip (Result, Scores, Toss, Field), **Edit** (filled primary), and **Unpublish** / **Publish** as appropriate. Edit on a published result is disabled with the explanation "Unpublish to edit".

### Match page and Matches list

The match page and card show a result line and a **Capture result** / **View result** action for past matches; counters/progress that said "played" read the real result status.

### Shared helpers

`oversFormat.ts` (balls ⇄ "36.4" with `balls_per_over`), `resultLine.ts` (outcome to the sentence), and a `ResultScoreLine` component (a score line in card, list and page), each with unit tests and, for the component, the required test and story.

## Test Plan

**Backend unit (JUnit 5, `docs/standards/testing.md`):** outcome-rule matrix (every outcome type against missing/extra winner, margin, DLS fields, super-over innings); margin-versus-score contradiction produces a warning not an error; toss-versus-batting-order warning; balls ⇄ overs conversion including `balls_per_over != 6`; publish refuses when invalid and requires acknowledged warnings; cannot edit while published; a result can be captured for a future-dated match (no clock rule); `ResultVisibility` applies `PUBLISHED` filter.

**Backend integration (Testcontainers, `AbstractIntegrationTest`):** migration applies; unique `match_id` and `(club_id, source, external_id)`; upsert creates then replaces a draft's innings; `awaiting` returns only active, result-less matches in the club (past by default, future with `includeUpcoming`); `results` list filters and paging; summary counts; `resultStatus` on the matches list/filter; tenancy (club A cannot read club B's result); super overs persisted in sequence order. Service-tier tests without an ambient transaction so the `open-in-view=false` lazy-loading risk (`backend.md`) is exercised.

**Structural (ArchUnit):** no repository access to `match_result` outside the result services, and every read method that is not manager-only goes through `ResultVisibility`.

**Contract:** OpenAPI diff, additions only.

**Frontend component (Vitest + Testing Library + Storybook):** `ResultScoreLine`, outcome tiles, the overs input (valid and invalid ball digit), the wizard step flow with the proposed margin, capture picker selection, draft/publish buttons by status. `oversFormat` and `resultLine` unit tests.

**End-to-end (Playwright, mobile and desktop viewport):** golden path: manager opens Results, taps Capture result, picks an awaiting match, records a won-by-runs result with toss and scores, saves draft, sees it as a draft on the Results page, publishes it, sees the match as completed. A second short test: super-over tie.

Per the user's working rule ("build first, tests after approval"), tests and the standards review run **after** the user has checked the function in the browser, not per step; the plan still lists them.

## Acceptance Criteria

- A club manager can open **Results** from the manager menu and sees counters, filters and Cards / List views matching Matches' layout and behaviour; the list view preference is remembered.
- **Capture result** lists active matches of the club that have no result, past ones first by default (newest first) with an Include upcoming toggle, and selecting one opens the wizard.
- Each of won by runs, won by wickets, tie, draw, no result, abandoned, forfeit, won on DLS, and won in a super over can be recorded in no more than the four wizard steps (Result, Toss and field, Scores, Review), each in one outcome-tile choice plus its own fields.
- Entering overs as `36.4` stores 220 balls and displays `36.4`; `36.7` is rejected with a plain-English message.
- Two or more super overs can be recorded and are displayed in order.
- After scores are entered the winner and margin are proposed; changing the proposal is possible and a contradiction between margin and scores shows as a warning on review, not a silent change.
- Toss winner and decision, and the field (defaulting to the match's, overridable to another field), are saved and shown.
- A draft is saved without full validity; **Publish** is refused with plain-English errors when the result is invalid and requires a tick for warnings.
- A draft is invisible to every role that cannot capture results: no results endpoint returns it, and the structural test fails any new unguarded query.
- A published match is shown as completed on the Matches page and card; unpublishing returns it to not completed.
- A published result cannot be edited or deleted until unpublished.
- A match between two of the club's own teams has one result covering both sides.
- Re-saving or re-publishing never creates a second result for a match (unique per match).
- `source` is `MANUAL` and `external_id` null for hand-captured results; the columns and `ResultDraft` exist unchanged for slice `104`.
- The wizard and pages work at 375 px without horizontal scrolling.
- OpenAPI changes are additive; all new services have unit tests and all new queries integration tests in the same PR.

## Roadmap of the Results module (outlines only; each becomes its own spec)

**`101` — Our-side scorecard.** Detail level `OUR_SIDE`. Tables `batting_entry` (innings, `player_id` or free-text name plus side, position, runs, balls, fours, sixes, `NOT_OUT` / dismissal type, bowler and fielder as optional player or name), `bowling_entry` (balls, maidens, runs, wickets, dots, wides, no-balls), `fielding_entry` (catches, run-outs, stumpings; pre-filled from dismissals, extras addable), a `dismissal_type` enum, **standouts** (computed suggestions with a `featured` flag, rank and user overrides stored separately so recomputing never erases edits; thresholds in club settings: e.g. top three batters if above a threshold, bowlers by wickets then economy), and **player of the match** (official, either side or free text; plus the club team's). Wizard steps *Our batting*, *Our bowling and fielding*, *Awards*. The batting list **pre-fills from `MatchSidePlayer` in batting order but never constrains it**; a late change of player is an edit on the row (player swap or free-text add). Reconciliation checks as warnings: batting runs plus extras equal the total, outs equal wickets, bowling balls equal the other side's balls. The recorded order sets the *actual batting order* the roadmap's rotation item needs (planned order kept as a snapshot); re-derived on edit. Keyboard-first grid rows in official scorecard order for quick copying.

**`102` — Full scorecard.** Detail level `FULL`: the same entries for the opposition with **free-text names** (no `Person` created for opposition); optional opposition-player directory later. Result capture never requires this level.

**`103` — Statistics.** Player and team stats computed by link from published entries (batting: matches, innings, runs, average, strike rate, highest score, 50s/100s; bowling; fielding), the `PlayerDetailPage` Stats card goes live (`060`'s "full breakdown" page), and the team results record. Derived aggregate table only if measured slow, rebuilt on publish/unpublish. Honours the gate: drafts never count.

**`104` — Import adapters.** A provider-adapter interface mapping an external payload to `ResultDraft`; `source` / `external_id` / `source_payload` populated; dismissal-code mapping tables per provider; player and team resolution via `097`'s link-or-create step; idempotent upsert by `(source, external_id)`; the whole pass through `097`'s preview, validation and explicit confirm. The adapters are the only provider-specific code.

## Rollout Notes

- **Order:** backend migration, entities, services, endpoints, and `ResultVisibility`; then the Results page, picker and wizard; then the Matches page/card result status. The wizard's data-driven stepper ships here so `101` only registers steps.
- **No feature flag:** Results appears in the menu when built; with no results the page is empty and harmless.
- **Standards and docs to update when built:** `docs/roadmap.md` (this spec's deferred items; mark "true completed/results status" and "Results module" items as in progress under `100`; link the `MatchResult` blocker on schedule-import delete, `097`/`098`, which this slice satisfies by registering `MatchResult` as a delete blocker); `docs/architecture.md` (Match → MatchResult → Innings, and later entries); `docs/standards/frontend.md` (a short "Results" paragraph: overs are balls at the API, `oversFormat` is the one converter); `docs/standards/backend.md` (the publish-gate rule: every `match_result` read on a non-capturing path uses `ResultVisibility`).
- **Matches that finished before this ships:** nothing is back-filled; they appear in the *Awaiting result* list for managers to capture.
- **Review decisions (user, 2026-10-13):**
  1. **No time restriction on capture.** Results are often read in during the week after the match, so **any active match without a result can have one captured at any time**, and published at any time; there is no "finished" check against the clock and no rule that the start time must have passed. The picker and the *Awaiting result* list default to past matches (with an **Include upcoming** toggle) purely for convenience. A match is **completed** only when its result is **published**: publishing is the manager declaring the match over.
  2. **Inactive matches cannot have a result captured** and are excluded from *Awaiting result*.
  3. **Won / Lost is per team.** Each of the club's teams in a match gets its own win, loss or other outcome; a match between two of the club's own teams gives one team a win and the other a loss (both a tie, draw, etc.). Counters and filters count **team results** (a team filter narrows to that team; unfiltered, an internal match contributes one win and one loss), while *Played* still counts matches. There is no separate "Internal" bucket.
  4. **Results menu icon:** the user added the brand icon `ui/src/icons/nav/result-scorecard.svg` (with 128/256/512 px PNGs); the Results menu entry uses `nav/result-scorecard` through `NavItemIcon`/`BrandIcon`, and it is also the empty-state illustration. It is a 32 px and larger brand icon per `078`; the existing `nav/match-results` and `nav/scorecards` icons stay for other uses.
  5. **`scheduled_balls` defaults from the league's playing conditions** (`LeaguePlayingConditions`) when the match belongs to a league, editable on the result; a standalone match has no default.
