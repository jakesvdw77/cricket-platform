# 101 — Match Results: Our-Side Scorecard (batting, bowling, fielding, extras, standouts, player of the match)

**Depends on:** `100-match-results-core.md` (merged, PR #116: `match_result`, `match_innings`, the draft/publish gate, `ResultDraft`, `ResultValidator`, the data-driven wizard), `001-tenancy-identity-model.md` (`Person`, `PlayerProfile`: one profile per person per club, `UNIQUE (person_id, club_id)`), `029-league-management.md` and `076`/`093` (team selection: `MatchSide`, `MatchSidePlayer` with its planned `batting_order`, role, captain, wicketkeeper, 12th man), `097-import-framework.md` (confirm-before-write principle), `docs/standards/*.md`.
**Status:** draft — written 2026-10-14 from the user's requirements for slice 101 of `100`'s roadmap. Builds **our side's scorecard only** for **regular innings only**. Super-over scorecards are split out into [`105`](#rollout-notes) (number chosen here; `102` to `104` stay as `100` outlined them).

## Problem & Goals

`100` captures what happened (outcome, toss, innings totals) but not who did it. There is no batting, bowling or fielding record, so there is nothing to feed player statistics (`103`), no standouts or player of the match, and the batting order a coach actually used on the day is lost (`093` shows the announced plan only, and its roadmap item waits on this slice). The scorecard must also be quick to enter: a manager copies it from a paper or app scorecard, usually on a phone, often with last-minute player changes, borrowed players and a scorecard that does not quite add up.

Goals:
- **A. Our side's scorecard** per regular innings: batting (order, runs, balls, fours, sixes, how out), bowling (balls, maidens, runs, wickets, wides, no-balls), fielding (catches, stumpings, run-outs) and a full extras breakdown (wides, no-balls, byes, leg byes, penalty runs).
- **B. Pre-filled from the selection, never constrained by it:** the line-up and batting order come from `MatchSidePlayer` (the announced or proposed team); every part can be changed.
- **C. Last-minute changes and non-registered players:** a row-level player swap, and free-text names for guests and borrowed players with a clear stats rule.
- **D. Minimal clicks:** a keyboard-first grid that is also phone-first, with defaults (batting order from the line-up, did-not-bat for the rest, bowlers from the line-up) and a form driven by the wickets already known from the result.
- **E. Actual batting order recorded** (planned order kept as a snapshot) for the rotation item in `093`'s roadmap.
- **F. Reconciliation against the result,** as acknowledgeable warnings in the shared `ResultValidator` (so `104` imports get them too).
- **G. Standouts and player of the match,** in an Awards step.

## Non-goals

- **Super-over scorecards** — their own spec, [`105`](#rollout-notes). It is not known whether super-over runs and wickets count for statistics, and the answer changes how entries are marked. In 101 every scorecard entry belongs to a `REGULAR` innings; a scorecard entry sent for a `SUPER_OVER` innings is rejected. Super-over innings totals from `100` are untouched.
- **Opposition scorecard** (their batters, bowlers, fielders) — `102`. 101 records the **opposition's innings only as `100`'s totals** plus the extras breakdown and a non-bowler-wicket count, because our bowling figures must reconcile against them. Dismissal detail for opposition batters is `102`.
- **Statistics, averages, career pages** — `103`. 101 only guarantees the rows `103` needs: a stable link to `player_profile_id`, `NULL` for unlinked guests, and which rows may count (see "Guests and borrowed players").
- **Import adapters** — `104`. The canonical `ResultDraft` gains the scorecard section so adapters can fill it; no provider code here.
- **Ball-by-ball detail:** fall of wickets, partnerships, over-by-over, dot balls, minutes batted, wagon wheels, catches dropped. This is not a scoring app (`100`). The outline's `dots` column is **dropped**: no scorecard format prints it.
- **Creating a `Person` / `PlayerProfile` for a guest** ("create guest profile"), and **bulk linking** of a guest name across many past matches. Both are tied to the roadmap's player-linking item (cross-club persons, merge, confirm steps) and are deferred; 101 builds single-match linking only.
- **Rotation rules and warnings** ("opened in the last N matches"): only the data they need (actual and planned order) is recorded. The rule itself is a later spec.
- **Per-role capture rights,** player- or public-facing scorecards, notifications on publish: unchanged from `100`'s non-goals.
- **Multi-innings formats:** limited overs only, as in `100`.

## User Stories

- As a club manager, I can open **Our batting** and see my side's players already listed in the announced batting order, so that I only enter what happened.
- As a club manager, I can change the batting order by moving a batter up or down, so that the order I record is the order they actually batted.
- As a club manager, I can swap a selected player for someone else on a single row (a last-minute change) and keep the rest of that row, so that I never retype the figures.
- As a club manager, I can type a name for a guest or borrowed player who is not in the system, so that the scorecard is complete and adds up.
- As a club manager, I am only asked for dismissal details for as many batters as wickets fell, and the remaining batters are marked not out or did not bat for me, so that I do the minimum.
- As a club manager, I can see at a glance when the batters out do not match the wickets in the result, so that I catch a typo before publishing.
- As a club manager, I can enter the extras as wides, no-balls, byes, leg byes and penalty runs, so that the innings total can be checked and bowlers are charged correctly.
- As a club manager, I can enter our bowlers' overs, maidens, runs, wickets, wides and no-balls, pre-listed from the line-up, so that I only fill numbers.
- As a club manager, I can record catches, stumpings and run-outs per fielder, so that fielding is credited.
- As a club manager, I am warned (never blocked) when the scorecard does not agree with the result's totals, and I can acknowledge the warning at publish, so that an honest scorer's mismatch does not stop me.
- As a club manager, I can accept or change the suggested standouts and name the player of the match (official, from either side, or the club team's), so that the result tells who shone.
- As a club manager, I can link a guest row to a registered player afterwards, so that a mistake about who played can be fixed.
- As a coach, I can later see where each player actually batted against where they were planned, so that rotation can be judged (data only in this slice).

## Data Model Changes

Migration sketch: `backend/src/main/resources/db/changelog/v1/044-match-results-our-side-scorecard.sql` (`043-match-results.sql` exists; confirm the next number at plan time). All new tables are scoped through `match_result` (tenancy is `match_result.club_id`; no duplicate `club_id` column on child rows). Enums are `CHECK`-constrained varchars, as in `043`.

### Why the player list is its own table: `result_player`

A guest can bat, bowl and field in the same match; a swap, a link to a registered player and a duplicate check are each **one decision about one person**. So the scorecard first records **who played for our side**, once, and the batting, bowling and fielding rows point at that list. Swapping or linking is then one update, every row follows, and "matches played" (for `103`) is a row in this table.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `match_result_id` | uuid not null | fk `match_result`, on delete cascade |
| `side` | varchar | `HOME` / `AWAY`; must be a side that is ours (team id set on the match). Both sides are ours in an internal fixture. `102` will add opposition rows to this table with free-text names |
| `player_profile_id` | uuid null | fk `player_profile` (this club's profile; stats roll up by `person_id` through it) |
| `display_name` | varchar null | the name **as written**; required when `player_profile_id` is null (a guest). Kept after linking, as an audit of what was typed |
| `planned_batting_order` | int null | **snapshot** of `MatchSidePlayer.batting_order` when the line-up was pre-filled; never changed by edits |
| `replaced_player_profile_id` | uuid null | the selected player this person replaced, when swapped ("planned X, Y played") |
| `substitute` | boolean | a substitute fielder who is not one of the eleven; does not count as a match played |
| `captain`, `wicket_keeper` | boolean | pre-filled from `MatchSide`, editable (needed by `103` for keeper dismissals; no extra screen) |

Constraints: `CHECK (player_profile_id IS NOT NULL OR display_name IS NOT NULL)`; `UNIQUE (match_result_id, player_profile_id) WHERE player_profile_id IS NOT NULL` (a registered player appears once per match, on one side); `UNIQUE (match_result_id, side, lower(display_name)) WHERE player_profile_id IS NULL` (two unlinked guests on one side must be told apart: "John", "John (Dave's friend)").

### `match_innings` (altered; `043` fixed the base columns)

| Column | Type | Notes |
|---|---|---|
| `wides`, `no_balls`, `byes`, `leg_byes`, `penalty_runs` | int null | the extras breakdown, **in runs** (a wide that runs four is 5 wides), ≥ 0. The batting side's extras |
| `extras` | int null | existing column, now the **stored total**. When any component is non-null the server **derives** `extras` as their sum; a client total that disagrees with the components is a save error (`EXTRAS_TOTAL_MISMATCH`). With no components (a summary-level result) `extras` is whatever was sent, as in `100` |
| `non_bowler_wickets` | int null | wickets in this innings not credited to a bowler (run-outs, obstructing the field, handled ball, hit ball twice, timed out, retired out). Needed to reconcile our bowlers' wickets with the innings wickets without opposition batter rows (`102`). When the innings is one of **ours batting**, it is derived from the batters' dismissals instead and this column is ignored |
| (constraint) | | `ux_match_innings_sequence` becomes `DEFERRABLE INITIALLY DEFERRED`, so innings can be resequenced in place (see below) |

**Who is charged (cricket rules, enforced as the meaning of the columns):** wides and no-balls are charged to the bowler (they appear in the bowler's `runs`, and optionally in their `wides` / `no_balls`); byes, leg byes and penalty runs are **not** charged to any bowler. Runs off the bat from a no-ball are charged to the bowler and credited to the batter. Therefore, for an innings: `bowlers' runs + byes + leg byes + penalty runs = innings runs`, and `batters' runs + extras = innings runs`.

### Innings identity must survive saves (a change to `100`'s upsert)

`100`'s `PUT .../result` deletes and recreates the innings on every save. Scorecard entries cascade from `match_innings`, so that would silently erase the scorecard every time the Scores step is re-saved. 101 therefore changes the upsert to **reconcile innings in place**, matched on `(kind, batting_side)` (limited overs: one regular innings per side), updating `sequence`, runs, wickets, balls, `all_out` and the extras columns on the existing row and keeping its `id`. A changed toss re-orders (resequences) the innings without touching their entries, which belong to a side. An innings removed from the body is deleted with its entries; the wizard asks first when entries exist (`ConfirmDialog`: "This removes the scorecard for that innings"). This is the only change to `100`'s behaviour and it is invisible when no scorecard exists.

### `batting_entry` (our batters; one row per player in the innings, including those who did not bat)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `match_innings_id` | uuid not null | fk, on delete cascade; the innings must be a `REGULAR` innings **in which `result_player.side` batted** |
| `result_player_id` | uuid not null | fk `result_player`, on delete cascade; **unique with `match_innings_id`** |
| `position` | int null | **the actual batting order**, 1-based and distinct per innings; `NULL` for `DID_NOT_BAT`. Planned order stays on `result_player.planned_batting_order` |
| `how_out` | varchar | `DismissalType` (below), including `NOT_OUT` and `DID_NOT_BAT` |
| `runs`, `balls`, `fours`, `sixes` | int null | `runs` required once the row batted (validated at publish); balls, fours and sixes are optional and `NULL` means "not on the scorecard", never 0 |
| `bowler_result_player_id`, `bowler_name` | uuid / varchar null | who dismissed this batter, optional. Opposition bowlers are free text (`102` has no earlier rows to point at); in an internal fixture the other side's `result_player` may be chosen |
| `fielder_result_player_id`, `fielder_name` | uuid / varchar null | catcher, stumper or run-out thrower, optional, same rule |

**`DismissalType` enum:** `NOT_OUT`, `DID_NOT_BAT`, `BOWLED`, `CAUGHT`, `CAUGHT_AND_BOWLED`, `LBW`, `STUMPED`, `RUN_OUT`, `HIT_WICKET`, `HANDLED_BALL`, `OBSTRUCTING_FIELD`, `HIT_BALL_TWICE`, `TIMED_OUT`, `RETIRED_OUT` (counts as a wicket), `RETIRED_NOT_OUT` (retired hurt or ill: **not** a wicket). A caught-behind is `CAUGHT` with the keeper as fielder. Bowler-credited dismissals: `BOWLED`, `CAUGHT`, `CAUGHT_AND_BOWLED`, `LBW`, `STUMPED`, `HIT_WICKET`. A **wicket** is every value except `NOT_OUT`, `DID_NOT_BAT` and `RETIRED_NOT_OUT`.

### `bowling_entry` (our bowlers; belongs to the innings in which the *other* side batted)

| Column | Type | Notes |
|---|---|---|
| `id`, `match_innings_id` | | fk cascade; the innings must be a `REGULAR` innings in which the opposing side batted |
| `result_player_id` | uuid not null | unique with `match_innings_id` |
| `bowling_order` | int null | order they bowled, optional |
| `balls` | int | **balls, never decimal overs** (`100`'s rule; `oversFormat` is the one converter), ≥ 0 |
| `maidens`, `runs`, `wickets` | int | ≥ 0; `wickets` are bowler-credited only |
| `wides`, `no_balls` | int null | runs conceded from each, optional |

### `fielding_entry` (our fielders; same innings as the bowling)

`id`, `match_innings_id`, `result_player_id` (unique pair), `catches`, `stumpings`, `run_outs` (all int, ≥ 0). One row per fielder with at least one credit; a keeper's catches are catches. Not pre-filled from dismissals (opposition dismissals are `102`); the row exists only when the manager credits one.

### `match_award` (player of the match)

| Column | Type | Notes |
|---|---|---|
| `id`, `match_result_id` | | fk cascade |
| `award_type` | varchar | `PLAYER_OF_MATCH` (the official one) / `TEAM_PLAYER_OF_MATCH` (the club team's own) |
| `side` | varchar | for `PLAYER_OF_MATCH` the side the player played for; for `TEAM_PLAYER_OF_MATCH` the side whose team gives it (must be ours) |
| `result_player_id` | uuid null | one of our players |
| `display_name` | varchar null | free text, for an opposition player (no opposition roster exists until `102`) or anyone not on our list; required when `result_player_id` is null |

Constraints: at most one `PLAYER_OF_MATCH` per result (`UNIQUE (match_result_id) WHERE award_type = 'PLAYER_OF_MATCH'`); at most one `TEAM_PLAYER_OF_MATCH` per `(match_result_id, side)` (two in an internal fixture).

### Standouts: computed, overrides stored apart

Suggestions are **computed on read** from the scorecard and the club's thresholds, never stored, so recomputing can never erase an edit. What the manager changes is stored in `result_standout_override` (`match_result_id`, `result_player_id`, `kind` `BATTING` / `BOWLING` / `FIELDING`, `action` `FEATURE` / `HIDE`, `rank` int null; unique on the first three; cascade on result and player). The **effective** list is: suggestions, minus `HIDE`, plus `FEATURE` rows, ordered by `rank` when set, else by the computed order.
- **Suggestion rules** (per `kind`, at most `max_per_kind` each): batting = runs ≥ the batting threshold, ordered by runs descending then fewer balls; bowling = wickets ≥ the bowling threshold, ordered by wickets descending then lower economy (runs per over, from balls); fielding = catches + stumpings + run-outs ≥ the fielding threshold. Guest rows qualify (they performed); an unlinked guest is marked as such.
- **Thresholds live in club settings.** No club settings entity exists today, so 101 adds the first, narrowly: `club_result_settings` (`club_id` pk, `standout_max_per_kind` default 3, `standout_batting_min_runs` default 30, `standout_bowling_min_wickets` default 2, `standout_fielding_min_dismissals` default 3, audit columns). A club with no row uses the defaults in code. These defaults are a proposal (open question 5).
- **Frozen on publish:** `match_result` gains `standout_settings_snapshot jsonb null`, set at publish with the thresholds used and cleared at unpublish; a published result computes its standouts from the snapshot, so a later threshold change never rewrites history.

### `match_result` (altered)

`detail_level` is now set by the server: `OUR_SIDE` when the result has a scorecard (at least one `result_player`), else `SUMMARY`. `FULL` stays `102`'s. New nullable `standout_settings_snapshot jsonb` (above). No other column changes.

### Guests and borrowed players: the recommendation

A guest or borrowed player is a `result_player` row with `player_profile_id = NULL` and a `display_name`. Decisions:

1. **Free-text row, no automatic profile.** Nothing creates a `Person` or `PlayerProfile` behind the manager's back (a profile would appear in rosters, verification statuses (`040`) and the player list, and risks the silent duplicate persons the roadmap's link item exists to fix).
2. **Borrowed from another team of our own club** is not a guest: the swap picker offers "Anyone in the club" (default scope is this team's squad for the match's season), and the row is a real, linked player. Selecting someone outside the squad shows a warning (`PLAYER_NOT_IN_SQUAD`), not a block.
3. **What an unlinked row counts for:** it **is** part of the scorecard, the innings, the team's totals and every reconciliation check (the runs were scored). It **does not feed any player's statistics** (`103` aggregates by `person_id` through `player_profile_id`; no link, no person), and it is not a "match played" for anyone. It can win a standout or the player of the match; both then show the "Guest" tag, and neither counts toward a person's awards until linked.
4. **Linking later** (`POST .../result/players/{id}/link`) sets `player_profile_id` on that one row; every batting, bowling, fielding, standout and award row follows because they point at `result_player`. `display_name` is kept as written. Linking is allowed on a published result (open question 1) because it changes no figure on the scorecard, only who is credited; it is recorded in `updated_by`/`updated_at`.
5. **Duplicate-name risk:** (a) within a match the partial unique index stops two identical guest names on a side; (b) a guest whose name matches a registered club player (case-insensitive, trimmed) raises `GUEST_NAME_MATCHES_PLAYER` offering **Use this player** (one tap converts the row to a linked player); (c) the name field offers previously used guest names for the club (`results/guest-names`), so the same visitor is spelled once; (d) the same name in different matches is **not** assumed to be the same person: only the manager's explicit link says so. Bulk linking of "John" across past matches is deferred (Non-goals) and would need `097`'s preview-and-confirm.
6. **A registered player at another club** is, to this club, a guest until the roadmap's cross-club link exists. When it does, linking a row to a person known at another club is part of that spec, not this one.

## API Contract

Same base, access rules and section narrowing as `100` (`@PreAuthorize("@access.canAccessClub(authentication, #clubId)")`, writes through the existing per-match administrable check; any club manager). All routes below are under `/api/v1/manage/clubs/{clubId}`. Draft-only rules and the 409s of `100` apply unchanged.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /matches/{matchId}/result/scorecard/prefill` | club manager | The proposed line-up per ours side from `MatchSide` / `MatchSidePlayer`: players in batting order (those with a null order after those with one), role, captain, wicketkeeper, 12th man listed as an available substitute, plus `plannedBattingOrder`. Works with or without a result; writes nothing. Empty lists (not an error) when no team was selected |
| `GET /matches/{matchId}/result/scorecard` | club manager | The saved scorecard: `players`, per-innings `extras` breakdown and `nonBowlerWickets`, `batting`, `bowling`, `fielding`, `awards`, `standoutOverrides`. 404 if there is no result; an empty scorecard if the result has none |
| `PUT /matches/{matchId}/result` (existing) | club manager | `ResultDraft` gains an optional `scorecard` section with the same shape. Absent/null = scorecard untouched; present = the whole draft scorecard is replaced in one transaction (players keep their `id` when sent, new rows carry a `clientKey`). Save enforces **structural** validity only (see rules); innings are reconciled in place (see Data Model) |
| `POST /matches/{matchId}/result/validate` (existing) | club manager | Accepts the same `ResultDraft` including the scorecard, so the wizard can check before saving; the scorecard rules below run here and at publish |
| `POST /matches/{matchId}/result/publish` / `unpublish` (existing) | club manager | Publish re-validates the scorecard, requires the acknowledged warnings, and freezes `standout_settings_snapshot`; unpublish clears it |
| `GET /matches/{matchId}/result/standouts` | club manager | The effective standouts and the raw suggestions (with figures: runs, balls, wickets, balls bowled, runs conceded, dismissals) from the **saved** scorecard and the club's (or the frozen) thresholds. Overrides are written through the scorecard `PUT`, not here |
| `POST /matches/{matchId}/result/players/{resultPlayerId}/link` | club manager | Link an unlinked `result_player` to a `player_profile_id` of this club. Allowed on a draft or a published result; 400 if the profile is already in the result or belongs to another club |
| `GET /results/guest-names?teamId=&q=` | club manager | Distinct guest `display_name`s used by the club (most recent first, with a count), for the name field's suggestions. Paged, as in `backend.md` |
| `GET /result-settings` | club manager | The club's standout thresholds (defaults when no row) |
| `PUT /result-settings` | club admin (`canAdministerClub`) | Save the thresholds |
| `GET /matches/{matchId}/result` (existing) | club manager | Gains `hasScorecard`; `detailLevel` is `OUR_SIDE` when there is one |
| `GET /results` list (existing) | club manager | `ResultListItemDto` gains `playerOfTheMatch` (display name or null) for the card |

**Save-time (structural) rules, errors on `PUT`:** all counts ≥ 0; `position` distinct and ≥ 1; `how_out` valid for the table; a row's `result_player` belongs to this result and its `side` matches the innings (batting entries on an innings that side batted; bowling and fielding on an innings the opposing side batted); one batting, bowling and fielding row per player per innings; `result_player` has a profile or a name, a profile belongs to this club, a profile is not on both sides; no entry on a `SUPER_OVER` innings (`SCORECARD_SUPER_OVER_NOT_SUPPORTED`, pointing at `105`); an extras total that disagrees with its components; a scorecard on a result with no innings for that side. A draft may otherwise be incomplete or inconsistent, as in `100`.

**Validation (`ResultValidator`, shared with imports; run by validate and publish).** Errors block publish; warnings are acknowledged at publish with `acknowledgedWarnings`, exactly `100`'s mechanism. None run for an innings that lacks runs or balls, nor for `FORFEIT`/`ABANDONED`/`NO_RESULT`; only regular innings are considered.

*Errors (logically impossible):* a batting row that batted (`how_out` not `DID_NOT_BAT`) with no `runs`; `fours × 4 + sixes × 6` exceeds `runs`; a `DID_NOT_BAT` row with figures; maidens above complete overs bowled; two players claiming the same batting `position`; the same registered player on both sides; official player of the match missing both player and name.

*Warnings (reconciliation; the codes name the rules in code and tests):*

| Code | Rule |
|---|---|
| `BATTERS_OUT_NOT_WICKETS` | Our batting innings: the count of batters with a wicket `how_out` ≠ the innings wickets |
| `NOT_OUT_COUNT` | More than two batters `NOT_OUT` when the innings is not all out, more than one when all out |
| `BATTING_TOTAL_MISMATCH` | Σ batters' runs + extras ≠ innings runs (the message gives both sides of the sum) |
| `BOWLER_BALLS_MISMATCH` | Σ our bowlers' balls ≠ the opposition innings' balls |
| `BOWLING_RUNS_MISMATCH` | Σ our bowlers' runs + byes + leg byes + penalty runs ≠ the opposition innings runs. With no extras breakdown on that innings, only Σ bowlers' runs ≤ innings runs is checked |
| `BOWLER_WICKETS_MISMATCH` | Σ our bowlers' wickets + `non_bowler_wickets` ≠ the opposition innings wickets |
| `FIELDING_EXCEEDS_WICKETS` | Σ catches + stumpings + run-outs credited > the wickets in that innings, or credited run-outs > `non_bowler_wickets` |
| `WIDES_MISMATCH`, `NO_BALLS_MISMATCH` | Σ bowlers' wides (no-balls) differs from the innings' wides (no-balls) when both are entered |
| `BOWLER_OVERS_EXCEED_LIMIT` | A bowler's balls exceed the league's maximum overs per bowler (`LeaguePlayingConditions.maxOversPerBowler`, converted to balls as `100` does for innings) |
| `LINEUP_TOO_LARGE` | More than eleven non-substitute players for a side |
| `PLAYER_NOT_IN_SQUAD` | A linked player is not in that team's squad for the match's season (`TeamSquadMember`), the same test `029` applies to selection |
| `GUEST_NAME_MATCHES_PLAYER` | An unlinked name equals a registered club player's name |

Each warning carries enough context to place it: **this slice proposes adding an optional `code` and `step` (and innings side) to each validation issue** in `ResultValidationDto`, additive in OpenAPI, so the wizard can attach a warning to a row or step and its **Fix** jumps there. This takes up `100`'s roadmap item "stable warning codes" and amends `100`'s "message strings only" (open question 3). `errors` and `warnings` stay as they are for existing callers.

**Exceptions:** none new beyond reusing `InvalidResultException` (structured `errors`/`warnings`) and `ResultPublishedException`. The link route raises `PlayerAlreadyInResultException` (extends `ConflictException`, named per `backend.md`). `OpenAPI`: `backend/openapi/openapi.yaml` regenerated by hand per the repo's practice, additions only (the new `scorecard` section is optional on an existing body).

## UI Requirements

Match the existing Results wizard and the gold-standard patterns: `RecordFormScreen`, `FormSectionHeading`, `InfoCard`, `KeyFigureTile`, `CompactToggleGroup`, `ConfirmDialog`, `BottomSheet`, `CardProgressBar`, `OversInput` and `oversFormat` from `100`, zebra rows via `zebraTint`, `badgeSx` tones. Mobile-first at 375 px; the poll Responses page is the model for dense rows that stay usable on a phone. Per the repo's rule, a mockup of the grid on a phone and a desktop is approved before the build; none is included here.

### Wizard steps

`RESULT_STEPS` (`ResultCapturePage.tsx`) is data-driven; 101 **registers three entries between Scores and Review**, each with an `isApplicable(draft)` predicate (shown only when at least one innings with runs exists, hidden for forfeit, abandoned and no result) and flagged **Optional** in the stepper (a result may be published at summary level; "Skip scorecard" goes straight to Review). The end of the Scores step gains a quiet prompt: **Add our scorecard** (continue) or **Skip to review**. Autosave on step change and **Save draft** behave as in `100`. Order after this slice: Result, Toss and field, Scores, **Our batting**, **Our bowling and fielding**, **Awards**, Review.

An internal fixture (both teams ours) shows a **Home | Away** switch (`CompactToggleGroup`, as the Select team page) in each scorecard step; each side is entered separately.

### Step: Our batting

1. **Pre-fill.** On first open the step calls `scorecard/prefill` and builds the grid locally (nothing is written until a save): rows in the planned batting order, then players without an order, as did-not-bat. A short strip shows where it came from ("From the announced team") with **Reset to selection** (`ConfirmDialog`; adds missing planned players and re-snapshots the planned order, never silently removes entered rows). With no selection, the grid starts empty and the add control is open.
2. **Wicket-driven form.** The innings' **wickets and balls come from the Scores step** and are shown in a meter above the grid (`CardProgressBar`, "Out 4 of 6"). The grid starts with the first `wickets + 2` players as batted (the two at the crease at the end; fewer if the line-up is shorter) and the rest as **Did not bat**. As the manager marks how each batter was out, once the number of dismissals equals the wickets the remaining batted rows become **Not out** automatically (and a row cleared reverts them to undecided); the manager is asked only for dismissals up to the wicket count. Wickets 10 means all out: ten dismissals and the last batter not out (or the eleventh absent). If the manager marks more dismissals than wickets, the meter turns amber with "1 more than the result says" and `BATTERS_OUT_NOT_WICKETS` shows on review; nothing is forced.
3. **The grid.** Columns: `#`, Player, How out, R, B, 4s, 6s. Bowler and fielder for a dismissal sit behind a row **Details** control (collapsed; free text, with the other side's players offered in an internal fixture). Beside the grid, a totals strip reads **Total 148 = 135 off the bat + 13 extras ✓** (or an amber mismatch, `BATTING_TOTAL_MISMATCH`, never a block), and an **Extras** row holds Wides, No-balls, Byes, Leg byes, Penalty, with the sum shown and written to `extras`.
4. **Keyboard-first.** Tab/Shift+Tab and Enter/Shift+Enter move along a row and wrap to the next row's first number cell; Arrow Up/Down move within a column; number cells select their content on focus and use `inputMode="numeric"`; **How out** is a type-ahead (type `c` Caught, `b` Bowled, `l` LBW, `r` Run out, `s` Stumped, `n` Not out, `d` Did not bat; `cb` Caught and bowled; Enter accepts), so a scorer never touches the mouse; **Alt+Arrow Up/Down** moves the row (reorders); `/` opens the player picker on the row; `?` lists the shortcuts. Focus is visible; every cell has an accessible name ("Runs, A. Smith"); the grid is real inputs in a table, not a custom widget.
5. **Phone.** Each batter is a compact card: name, a How-out chip row, and R / B / 4s / 6s steppers on a numeric keypad; the same order and the same auto-marking. Reorder uses a handle and move up/down buttons (the Batting order view's Reorder idea), 44 px targets.
6. **Reordering and swapping.** Moving a row changes `position`; `plannedBattingOrder` is untouched, so the row can show "planned 3". **Swap player** (row menu) opens the `PlayerSlotPicker` (below) and replaces *who* the row is, keeping runs, balls and how-out; the swapped-out selected player is remembered in `replaced_player_profile_id` and shown as "replaced A. Smith". **Remove from XI** deletes the row after confirm. **Add player** appends one.
7. **`PlayerSlotPicker`** (new, shared by every step): a searchable list with three scopes, **This team's squad** (default, this season; the 12th man and unselected squad members first), **Anyone in the club**, and **Guest (name only)** with the club's previous guest names as suggestions. Players already on the list are shown disabled with the reason. Choosing a guest whose name matches a registered player offers **Use this player**. A guest row carries a visible "Guest" chip everywhere (grid, awards, result page).

### Step: Our bowling and fielding

For each innings in which the opposition batted (one panel per innings in an internal fixture, one per side): a **Bowling** table pre-listing the players whose selected role is bowler or all-rounder (and anyone added), columns Bowler, O (`OversInput`, "8.2"), M, R, W, with Wd and Nb behind a **More** control; a **Bowled so far** strip beside it ("Balls 238 of 240 · 2 left", "Runs 131 of 140 conceded incl. 6 extras not charged"); and the **Opposition extras** row: Wides, No-balls, Byes, Leg byes, Penalty (with the one-line note "Byes, leg byes and penalty runs are not charged to a bowler"), plus **Wickets not credited to a bowler** (run-outs and similar), a single number that closes the wickets reconciliation ("5 + 1 = 6 ✓"). A **Fielding** list underneath shows the line-up with three tap-to-increment counters (Catches, Stumpings, Run-outs); only players with a credit are saved. Keyboard behaviour, phone cards, swap, add and the Guest chip are those of Our batting. Bowling order is the row order (move to reorder).

### Step: Awards

Three blocks, as `InfoCard`s in the poll-page style:
1. **Standouts:** the effective list grouped Batting, Bowling, Fielding, each row the player (Guest chip when unlinked) with figures ("62 off 48", "3 for 21 (8.0)", "2 catches"), a **Featured** toggle (hide a suggestion) and move up/down, and **Add standout** (any player on our list, a kind). Suggestions come from `GET .../standouts` after the previous step has saved; a link **Standout thresholds** opens a small dialog (club admins edit; managers see them read-only) backed by `result-settings`.
2. **Player of the match (official):** one pick from our list (with standouts first), or **Someone from the other side** with a name field (labelled with the opposition's team name), or **None**.
3. **Our team's player of the match:** one pick from our list per ours side, or none.

### Review step and result page

Review shows a scorecard line ("Our batting, bowling and fielding entered" or "Summary only"), merges the scorecard warnings into the existing single **Checks** list (each with **Fix** jumping to its step and row via the new `step`), and the card preview gains the player of the match. The result page (`ResultDetailPage`) gains an **Our scorecard** section per innings: batting, bowling and fielding as zebra tables (the whole section scrolls inside its card on a phone, one reduced column set), the extras line, the standouts and the awards; the batting table shows "planned 3" only where it differs. Edit remains disabled on a published result ("Unpublish to edit"); **Link to player** on a Guest row is the single allowed action on a published result.

### New shared pieces (four-file anatomy each)

`ScorecardGrid` (the keyboard-first row/column engine, generic so `102` reuses it for opposition entries), `PlayerSlotPicker`, `HowOutSelect`, `ReconcileStrip` (the "Total 148 = 135 + 13 ✓" and "Out 4 of 6" strips; wraps `CardProgressBar`), `ExtrasFields`. Pure helpers with unit tests: `scorecardPrefill.ts` (selection to rows), `wicketFill.ts` (the auto not-out/did-not-bat rule), `battingTotals.ts`. Dismissal types and their bowler-credited/wicket flags live in one `utils/dismissal.ts` mirrored by the backend enum. The frontend never recomputes standouts or reconciliation as business rules; strips are conveniences, the server's validation is authoritative.

## Test Plan

**Backend unit (JUnit 5):** `ResultValidator` scorecard matrix, one case per code above including the "cannot check" skips (missing runs/balls, no extras breakdown, super-over innings ignored); wicket classification per `DismissalType`; extras: components derive the total, a conflicting client total is rejected, charging rule (wides/no-balls inside bowler runs, byes/leg byes/penalty outside); standout suggestion ordering and thresholds, `HIDE`/`FEATURE`/rank overrides, frozen snapshot used after publish; guest rules (name or profile required, duplicate guest names, name matches a registered player); prefill from `MatchSidePlayer` (order, null orders last, 12th man as substitute, no selection); link route (draft and published, wrong club, already in result); save rejects entries on a super-over innings; `ResultVisibility` still covers every new read.

**Backend integration (Testcontainers, `AbstractIntegrationTest`):** migration `044` applies to a database with `043` data (deferrable sequence constraint, new columns null); **innings reconcile in place keeps scorecard entries across a re-save and across a toss-driven resequence** (the regression `100`'s delete-and-recreate would cause); removing an innings cascades its entries; whole-scorecard replace is atomic and idempotent; all uniqueness constraints; cascade from `result_player`; `guest-names`, `result-settings`, `standouts` queries; tenancy (club A cannot read or link club B's rows); section narrowing as in `100`; service-tier cases run without an ambient transaction (`open-in-view=false` lazy loading, `backend.md`).

**Structural (ArchUnit):** scorecard repositories are touched only by the result services (extends `100`'s rule).

**Contract:** OpenAPI diff, additions only (optional `scorecard`, new routes, `code`/`step` on issues if approved).

**Frontend component (Vitest + Testing Library + Storybook):** `ScorecardGrid` keyboard navigation (Enter/Tab wrap, Arrow keys, Alt+Arrow reorder); `HowOutSelect` type-ahead; `wicketFill` (4 wickets, 10 wickets, line-up shorter than wickets + 2, cleared dismissal reverts); `PlayerSlotPicker` scopes, disabled duplicates, guest and "Use this player"; swap keeps figures; `ReconcileStrip` states; `scorecardPrefill`; the three registered steps appear only when applicable and are skippable; Awards toggles.

**End-to-end (Playwright, mobile and desktop):** golden path extending `100`'s: pick an awaiting match whose team was selected, capture a won-by-runs result, open Our batting (pre-filled), enter the figures with the keyboard on desktop, swap one player and add one guest, fill bowling and fielding, pick a player of the match, see no warnings on review, publish; a second short test with a deliberately mismatched total showing the acknowledgeable warning at publish. Per the working rule, tests and the standards review run **after** the user has browser-checked the function.

## Acceptance Criteria

- Opening **Our batting** for a match whose team was selected lists that team's players in the announced batting order, with players that have no order after them as did-not-bat, without any request writing data; opening it for an unselected team starts empty and lets the manager add players.
- Reordering, swapping, adding and removing players never blocked by the selection; the recorded `position` is the actual batting order and `planned_batting_order` is unchanged by any edit.
- A swap on one row replaces the player and keeps that row's figures; a swapped-out selected player is shown as "replaced".
- A row can hold a free-text name; it is tagged Guest; it counts in the scorecard totals and checks but is documented and tested as excluded from any player's statistics until linked; two identical guest names on a side are refused; a guest name equal to a registered player's offers **Use this player**.
- With wickets = 6 in the result, marking six batters out leaves the rest of the batted rows not out and the remaining line-up did-not-bat without further input; marking seven shows the over-count and, on review, the `BATTERS_OUT_NOT_WICKETS` warning.
- The batters' runs plus extras are compared with the innings total; our bowlers' balls, runs (plus byes, leg byes and penalty runs), wickets (plus non-bowler wickets) and the fielding credits are compared with the opposition innings; each mismatch is a warning, acknowledged at publish, enforced by the shared `ResultValidator` (a unit test drives it with no wizard involved).
- Extras are stored as wides, no-balls, byes, leg byes and penalty runs; `match_innings.extras` always equals their sum; wides and no-balls are in bowlers' runs and byes, leg byes and penalty are not.
- Re-saving the Scores step, or changing the toss, never deletes scorecard entries.
- A full innings can be entered from the keyboard alone on desktop, and on a 375 px viewport with no horizontal page scroll.
- The Awards step shows suggested standouts from the club's thresholds, lets a manager hide, add and reorder them, and recomputing after a scorecard edit keeps those overrides; a published result's standouts do not change when the club's thresholds change.
- An official player of the match (from our list or free text for the other side) and the club team's player of the match can be saved; at most one official award per result.
- A scorecard entry for a super-over innings is rejected, and super-over innings totals from `100` behave as before.
- A guest row can be linked to a registered player, including on a published result, and every row of that guest follows.
- OpenAPI changes are additive; new services have unit tests and new queries integration tests in the same PR.

## Rollout Notes

- **Order:** migration `044`, the in-place innings reconcile (with its regression test), scorecard save/read and prefill, `ResultValidator` rules, standouts and settings, link and guest-names; then `ScorecardGrid` and the picker, Our batting, Our bowling and fielding, Awards, Review and result page. The wizard needs only three registrations in `RESULT_STEPS`.
- **No feature flag.** A result with no scorecard is a valid summary result and behaves exactly as in `100`; the new steps are optional.
- **Super-over spec: `105` (number chosen here: `102` to `104` are taken by `100`'s outline).** Added to `100`'s slice outline and to `docs/roadmap.md` in this change. Open question for `105`: **do super-over runs and wickets count toward player statistics?** Convention in international and franchise records is generally to exclude them from career figures, but that is not confirmed for the leagues this platform serves, and it may need to be a per-league or per-club setting. It decides whether entries on a `SUPER_OVER` innings carry a `counts_for_stats` marker (or are filtered by `match_innings.kind` in `103`'s read model), whether they appear on the printed scorecard separately, and whether bowling rows need their own over limit and extras (a super over is six balls per bowler per side, two wickets).
- **Docs to update with the build:** `docs/roadmap.md` (Active row for 101, "Deferred by `101`", the `105` entry, resolve the `093` "planned versus actual batting order" and "stable warning codes" items as they land), `docs/architecture.md` (Match → MatchResult → ResultPlayer → entries), `docs/standards/frontend.md` (a short Scorecard paragraph: the grid keyboard contract, `dismissal.ts`, overs still via `oversFormat`), `docs/standards/backend.md` (a scorecard row never belongs to a super-over innings in 101; innings are reconciled in place, never deleted and recreated).
- **Changes to `100`'s behaviour** (called out so the human can veto): (1) innings upsert reconciles in place; (2) `detail_level` is server-set; (3) validation issues may gain `code`/`step`; (4) `ResultListItemDto` gains `playerOfTheMatch`.
- **Matches captured before this ships:** unaffected; they stay summary-level and can gain a scorecard by unpublish, edit, publish.
- **Open questions for the human:**
  1. Allow **linking a guest on a published result** (recommended: yes, as the single allowed action, audited) or require unpublish first?
  2. **Create guest profile** is deferred to the player-linking spec (recommended); confirm that no `Person`/`PlayerProfile` is ever created from a scorecard in 101.
  3. Approve **adding `code` and `step` to validation issues** (additive; amends `100`'s "message strings only"; needed to attach warnings to rows). If declined, warnings stay text only and **Fix** goes to the step by message prefix, which is fragile.
  4. **Club settings:** 101 introduces the first club settings table (`club_result_settings`) and a small thresholds dialog on the Awards step. Acceptable, or defaults in code only until a general club settings screen exists?
  5. **Default standout thresholds** (3 per kind; batting 30 runs; bowling 2 wickets; fielding 3 dismissals) are placeholders; confirm or change.
  6. **Captain and wicketkeeper flags** on `result_player` (pre-filled from selection, needed by `103` for keeper stats): keep in 101, or drop?
  7. **Bowler and fielder of a dismissal** on our batters: optional free text behind a Details control (proposed), or omit until `102`?
  8. **Non-bowler wickets** as a single number on the opposition innings (proposed) rather than per-batter rows, until `102` supplies them.
  9. **Retired batters:** `RETIRED_NOT_OUT` is not a wicket and a batter who returns is one row (proposed); confirm.
  10. **Appearance rule for `103`:** every non-substitute `result_player` of a published result is a match played, even with no batting, bowling or fielding. A substitute fielder is not. Confirm.
  11. **Super-over statistics** (the `105` question above) belongs to the human before `105` is written.
  12. Migration number `044` and spec number `105` to be confirmed at plan time.
