# 102 — Match Results: Opposition Scorecard (full scorecard, dismissal bowler and fielder)

**Depends on:** `101-match-results-our-side-scorecard.md` (the base: `result_player`, `batting_entry` / `bowling_entry` / `fielding_entry`, `match_award`, `DismissalType`, `ScorecardGrid`, `HowOutSelect`, `ExtrasFields`, `ReconcileStrip`, the name display toggle, the reorder pieces extracted from `TeamSelectionList`, the wizard step registration with `isApplicable`, the shared `ResultValidator` with `code` / `step` / `side` issues, the Home | Away derby switch), `100-match-results-core.md` (`match_result`, `match_innings`, draft/publish gate, `detail_level`), `001-tenancy-identity-model.md` (`Person`, `PlayerProfile`), `097-import-framework.md` (confirm-before-write), `docs/standards/*.md`.
**Status:** draft — written 2026-10-14 from the user's requirements for slice 102 of `100`'s roadmap. Extends `101`; it does not redefine anything `101` fixed. Where it changes a `101` decision, the change is listed under Rollout Notes ("Changes to 101") for the human to veto. Numbering: `101` is built on `feature/101-our-side-scorecard`; this spec assumes `101` as merged. Migration `045` (`044` is `101`'s; nothing later exists today, confirm at plan time).

## Problem & Goals

`101` records who batted, bowled and fielded for **our** side only. The opposition's innings is a set of totals, an extras breakdown and one number (`non_bowler_wickets`), and the dismissals of our own batters say how they were out but not who bowled or caught. Many managers do have the full paper or app scorecard, and want it kept in one place, but the opposition's players are not our players: they must never become `Person` or `PlayerProfile` rows, must never feed statistics, and must be quick to type because they are only names.

Goals:
- **A. An optional, opt-in opposition scorecard** next to ours: batting, bowling and fielding for the other side, entered as **text names only**, independent of whether ours is as detailed (but not available on its own, see Detail level).
- **B. Typing-first entry, once, on an Opposition team step** (the pattern of `101`'s Our team, decision 21): the manager types or pastes the opposition's names one per line (Enter adds a row), reorders them and marks substitutes. Opposition batting and Opposition bowling and fielding then use only that list, with the wicket-driven form of `101` filling the rest.
- **C. Dismissal detail:** the **bowler and fielder of each dismissal**, for both innings (`101` deliberately left these out). Where we bowl, they are picked from **our** bowlers and fielders, and our wickets, catches, stumpings and run-outs are then **derived** as suggestions. Where we bat, they are picked from the opposition's names.
- **D. Detail level `FULL`** when both sides have a scorecard.
- **E. Reconciliation across both sides,** enforced in the shared `ResultValidator` (so `104` imports get it), as acknowledgeable warnings with `code`, `step` and `side` (`101`'s issue shape).
- **F. The result page shows both scorecards,** and the official player of the match can be picked from the opposition list.

## Non-goals

- **Statistics for opposition players, or any record of them as people** (`103` and the player-linking work). An opposition `result_player` has a name and nothing else: no profile, no `Person`, no link route, no "match played", no award that counts for anyone. Only **our** side's rows feed statistics (stated again in Data Model so `103` filters on it).
- **A guests concept for the opposition.** They are just names; no Guest chip, no `GUEST_NAME_MATCHES_PLAYER`, no "Use this player".
- **Standouts for the opposition.** None are computed, no star toggle is shown, and the server refuses a `featuredOverride` on an opposition entry. Standouts are our players' recognition (`101`).
- **An opposition-only scorecard.** Disallowed: it needs ours (dismissal bowlers and fielders are our players, and the cross-checks compare both sides). See Detail level.
- **A derby opposition scorecard** (both sides ours): not applicable. Both sides already use the registered flow of `101` (own list, own selection, Home | Away switch). **In a derby there is no opposition switch, no opposition step and no opposition row**, and the server rejects one.
- **Bowler and fielder of a dismissal in a derby.** The model could carry them between the two registered lists with no schema change, but the derby wiring (and deriving the other team's wickets and catches) is not built here. Open question below.
- **An opposition player directory** and remembering names between fixtures (the roadmap's "Opposition player directory"). The data allows it later (opposition rows keyed by the fixture's opposing team); not built. Open question below.
- **Free-text bowler or fielder on a dismissal.** A dismissal points at a `result_player` of the right side; typing a new name in the dismissal control creates that opposition player (it is not a loose string). One representation, so a rename or a removal cannot leave stray text behind.
- **Importing a pasted scorecard with figures** ("J Smith c X b Y 23 (18)"). Pasting a **list of names** is supported; reading figures out of text is `104`'s and the AI-suggest work, behind a confirm step.
- **Ball-by-ball detail, fall of wickets, partnerships, minutes, dropped catches:** unchanged non-goals from `101`.
- **Substitute fielders on the opposition as a statistic.** An opposition row may be marked substitute (a display marker on the Opposition team step, decision 6 below); it carries no appearance or statistics meaning, since no opposition row ever does. An unlisted opposition fielder is simply another name added on Opposition team.
- **Super-over scorecards:** still `105`.
- **Public or player-facing views of the opposition names:** results stay manager-only until that work exists (see the minors question).

## User Stories

- As a club manager, I can choose **Add the opposition scorecard too** when I start a scorecard, so that I record theirs only when I have it.
- As a club manager, I can type the opposition's names once on **Opposition team**, one per row pressing Enter for the next, or paste a list and get the rows in batting order, reorder them and mark a substitute, so that entering eleven names takes seconds and the later steps only pick from the list.
- As a club manager, I am asked for dismissals only for as many opposition batters as wickets fell, and the rest become not out or did not bat, so that I do the minimum (the `101` wicket-driven form).
- As a club manager, I can say which of **our** bowlers took each opposition wicket and which of our fielders caught, stumped or ran out the batter, so that our bowling and fielding credits follow.
- As a club manager, I can see our bowlers' wickets, and our fielders' catches, stumpings and run-outs, filled in from those dismissals and marked "from dismissals", and I can type over them when the scorecard I copied says otherwise.
- As a club manager, I can name the opposition bowler and fielder on each of **our** batters' dismissals by typing their names, so that their scorecard is complete.
- As a club manager, I can enter the opposition's bowling figures and fielding credits, and see them checked against our innings.
- As a club manager, I am warned (never blocked) when the opposition scorecard does not add up against the result or against our scorecard, and I can acknowledge it at publish.
- As a club manager, I can pick the official player of the match from the opposition list, so that the name is spelled once.
- As a club manager, I can reorder the opposition batters and bowlers exactly as I reorder ours, so that a late correction is cheap.
- As a club manager, I can remove the whole opposition scorecard, so that I can go back to totals only without leaving stray data.
- As a coach or player later, I can open a result and read both scorecards (their batting, bowling and fielding as well as ours), with dismissals written as "c Smith b Jones".

## Data Model Changes

Migration sketch: `backend/src/main/resources/db/changelog/v1/045-match-results-opposition-scorecard.sql` (`044` is `101`'s; confirm at plan time). All additive; existing rows are unchanged. Tenancy is still `match_result.club_id`.

### `result_player` (altered): opposition rows

`101` anticipated this: "`102` will add opposition rows to this table with free-text names", and the rule "must be a side that is ours" is relaxed here. The opposition list is created on the **Opposition team** step and is the only way opposition rows come into being: batting, bowling, fielding and dismissal pickers only reference rows already on it.

| Column | Type | Notes |
|---|---|---|
| `opposition` | boolean not null default false | true for a player of the side that is **not** ours (the side without a team of this club). Set by the client on save and **validated by the server against the match**: `opposition = true` only on the non-ours side of a match with exactly one ours side; `opposition = false` only on an ours side |

Constraint: `CHECK (NOT opposition OR (player_profile_id IS NULL AND display_name IS NOT NULL AND planned_batting_order IS NULL AND replaced_player_profile_id IS NULL AND linked_by IS NULL))`. An opposition row is a **name, a side and an optional substitute marker, nothing else** (`substitute` is allowed here as a display marker only; it is never a match played or a statistic). The `101` per-side guest-name unique index (`lower(display_name)` where `player_profile_id IS NULL`) already stops two identical opposition names on one side; the UI reuses an existing row when a name already on the list is typed again (case-insensitive, trimmed), so "J Smith" typed as a bowler is the same player as the batter "J Smith".

**Who counts for what (rule for `103`, fixed here):** only rows with `opposition = false AND player_profile_id IS NOT NULL` feed any player's statistics. Opposition rows are never a "match played", never a standout, never a player's award. The `101` appearance rule applies to ours only.

### `batting_entry` (altered): the dismissing bowler and fielder

| Column | Type | Notes |
|---|---|---|
| `bowler_result_player_id` | uuid null | fk `result_player`, **on delete set null**; the player credited with the dismissal. Must be a player of the **fielding side of that innings** (the side that did not bat) |
| `fielder_result_player_id` | uuid null | fk `result_player`, on delete set null; the catcher, the keeper who stumped, or the fielder credited with the run-out. Same side rule |

Both are indexed. Both are optional always (a manager may know only the bowler), and both are written **only for our batters when the opposition scorecard is in use** and for opposition batters (always, since the opposition scorecard exists then); with no opposition scorecard the controls are not shown and the columns stay null, exactly the `101` behaviour.

**Which dismissal takes which (structural rule, save error `DISMISSAL_DETAIL_NOT_ALLOWED`; the client clears a field when `how_out` changes):**

| `how_out` | Bowler | Fielder | Credit it produces (derived, see below) |
|---|---|---|---|
| `BOWLED`, `LBW`, `HIT_WICKET` | allowed | not allowed | bowler: wicket |
| `CAUGHT` | allowed | allowed (the catcher; the keeper for a caught-behind) | bowler: wicket; fielder: catch |
| `CAUGHT_AND_BOWLED` | allowed (the bowler, who also took the catch) | not allowed | bowler: wicket **and** catch |
| `STUMPED` | allowed | allowed (the keeper) | bowler: wicket; fielder: stumping |
| `RUN_OUT` | **not allowed** (no bowler is credited, as `101` fixed) | allowed (the fielder who broke the wicket or made the throw; one name, the other is not recorded) | fielder: run-out; a non-bowler wicket |
| `HANDLED_BALL`, `OBSTRUCTING_FIELD`, `HIT_BALL_TWICE`, `TIMED_OUT`, `RETIRED_OUT` | not allowed | not allowed | non-bowler wicket, no credit |
| `NOT_OUT`, `DID_NOT_BAT`, `RETIRED_NOT_OUT` | not allowed | not allowed | none |

(Obstructing the field, handled ball and hit ball twice follow `101`: they are not bowler-credited.) The side rule is a save-time error (`DISMISSAL_PLAYER_WRONG_SIDE`).

### `bowling_entry` and `fielding_entry` (altered): derived or manual

`101` makes `wickets`, `catches`, `stumpings` and `run_outs` plain numbers typed by the manager. When the dismissals say who took each wicket, those numbers can be **derived**. To keep "a manual value overrides" explicit and testable (and not guessed from whether the two numbers happen to match), each row says where its numbers come from:

| Table | Column | Type | Notes |
|---|---|---|---|
| `bowling_entry` | `wickets_source` | varchar not null default `MANUAL` | `MANUAL` / `DERIVED` (CHECK). Applies to `wickets` |
| `fielding_entry` | `credits_source` | varchar not null default `MANUAL` | `MANUAL` / `DERIVED`. One flag for the row's three counters |

- `wickets`, `catches`, `stumpings`, `run_outs` stay the **stored effective values** (what `103` and every check read). A `DERIVED` row's stored values are **recomputed by the server on every scorecard save, in the same transaction**, from the dismissals; a `MANUAL` row's are never touched. The client's numbers on a `DERIVED` row are ignored on save (the server writes the derivation). One shared pure class, `DismissalCredits` (unit tested), serves the save, the validator and, later, the imports.
- **Derivation, per innings, from the batting entries of the innings the fielding side fielded in:** a bowler's `wickets` = batters with a bowler-credited `how_out` whose `bowler` is that player. A fielder's `catches` = `CAUGHT` with that fielder, plus `CAUGHT_AND_BOWLED` where that player is the bowler. `stumpings` = `STUMPED` with that fielder. `run_outs` = `RUN_OUT` with that fielder.
- A `DERIVED` `fielding_entry` is created when the derivation gives a player at least one credit and removed when it falls to zero (`101`: a fielding row exists only with a credit). A `DERIVED` `bowling_entry` is **never created** by the derivation: a dismissal's bowler must already have a bowling row (it carries balls and runs, which a dismissal cannot supply); see `DISMISSAL_BOWLER_NOT_IN_BOWLING_LIST`.
- **Default:** a row created while the opposition scorecard is in use starts `DERIVED`; a row created without it starts `MANUAL` (`101`). Typing in a derived field switches the row to `MANUAL` (client, and the PUT carries it); **Use from dismissals** switches it back. Rows are never switched automatically, so existing `MANUAL` rows keep their typed numbers when an opposition scorecard is added later (a confirmed bulk "Use dismissals for all" is offered, see UI).
- Existing `101` rows migrate as `MANUAL`.

### `match_innings` (altered behaviour, no new column)

`non_bowler_wickets` (`101`: a single typed number, derived only when the innings is one of ours batting) is now **also derived for an innings where the opposition batted and at least one opposition batting entry exists**: the count of opposition batters with a wicket `how_out` that is not bowler-credited (run-out, handled ball, obstructing the field, hit ball twice, timed out, retired out). The server writes the derived value into the existing column on every save (so removing the opposition scorecard leaves the last derived value as the starting manual one), and the manual input on Our bowling and fielding becomes a read-only line ("1 from the opposition scorecard"). With no opposition batting entry the field behaves as in `101`.

### `match_award` (altered behaviour)

`result_player_id` may now reference an **opposition** `result_player` (the official `PLAYER_OF_MATCH` only; `TEAM_PLAYER_OF_MATCH` stays ours). The server **always copies the player's name into `award.display_name` on save** (and refreshes it on every save), so the award keeps its name if the opposition row is later removed (`result_player_id` becomes null, `display_name` remains, which satisfies `101`'s "name required when no player"). With no opposition scorecard the free-text path is unchanged.

### `match_result.detail_level` (server-set, extended)

- `SUMMARY`: no `result_player`.
- `OUR_SIDE`: at least one **ours** `result_player` and no opposition rows (always the case in a derby).
- `FULL`: at least one ours `result_player` **and** at least one opposition `result_player`.
- **Opposition rows without any ours row** (for example our rows deleted afterwards) are a publish error `OPPOSITION_WITHOUT_OUR_SCORECARD`; on a draft save they are allowed so the manager can edit freely. Decided as the answer to "what is an opposition-only scorecard": **it cannot be published**; the wizard never offers it (the opposition steps exist only once ours is opted in).

### Not changed

`match_innings` extras columns (the batting side's extras, entered once and shown on both the batting step of that side and the bowling step of the other, same data); `ux_match_innings_sequence`; `featured*` columns (stay null and refused on opposition entries); the in-place innings reconcile.

## API Contract

No new routes. Everything extends the `101` scorecard shapes (the same `ResultDraft.scorecard` section on `PUT .../result`, the same `GET .../result/scorecard`, `validate`, `publish`). Base path and access rules as in `100`/`101`.

| Endpoint | Access | Change |
|---|---|---|
| `PUT /matches/{matchId}/result` (existing) | club manager | `scorecard.players[]` gains `opposition` (boolean; opposition rows carry `side`, `displayName`, `substitute`, `clientKey`/`id` only). `scorecard.batting[]` entries gain `bowlerPlayerId` and `fielderPlayerId` (an `id` or a `clientKey` of a player in the same body, or null). `scorecard.bowling[]` gains `wicketsSource`; `scorecard.fielding[]` gains `creditsSource`. Whole-scorecard replace as in `101`, then the server recomputes `DERIVED` rows and `non_bowler_wickets` in the same transaction |
| `GET /matches/{matchId}/result/scorecard` (existing) | club manager | Players carry `opposition`. Entries carry the new fields. Each bowling entry also carries read-only `derivedWickets`, each fielding entry `derivedCatches` / `derivedStumpings` / `derivedRunOuts` (always computed, so the UI can offer **Use from dismissals** and show "dismissals say 2" on a `MANUAL` row). Each innings carries `nonBowlerWicketsDerived` (boolean). Opposition entries have `featuredOverride`, `featured` and `suggested` null |
| `GET /matches/{matchId}/result` (existing) | club manager | `hasScorecard` stays; gains `hasOppositionScorecard`; `detailLevel` can be `FULL` |
| `POST /matches/{matchId}/result/validate` and `publish` (existing) | club manager | Run the extended rules below; issues use `101`'s `code` / `step` / `side` / `severity` shape. New `step` values `OPPOSITION_BATTING`, `OPPOSITION_BOWLING` |
| `POST .../result/players/{id}/link` (existing) | club manager | Refuses an opposition row (new `OppositionPlayerNotLinkableException extends ValidationException`, 400) |
| `GET /results` list (existing) | club manager | `playerOfTheMatch` may now be an opposition name; unchanged shape |

`GET /results/guest-names` is unchanged and never returns opposition names. No route is added for remembered opposition names (deferred).

**Save-time (structural) rules added, errors on `PUT`:** `opposition` only on the non-ours side of a one-ours-side match, never in a derby (`OPPOSITION_NOT_ALLOWED`); an opposition row has a name, no profile and no link/swap fields (a `substitute` marker is allowed); batting, bowling and fielding entries for opposition players follow `101`'s side rules exactly (batting on an innings that side batted; bowling and fielding on the innings the other side batted); a dismissal bowler or fielder is a player of the **fielding side** of that innings (`DISMISSAL_PLAYER_WRONG_SIDE`) and only where the table above allows (`DISMISSAL_DETAIL_NOT_ALLOWED`); `featuredOverride` on an opposition entry (`OPPOSITION_NO_STANDOUTS`); `wicketsSource` / `creditsSource` valid values. A draft may otherwise be incomplete or inconsistent, as in `100`.

**Validation (`ResultValidator`, shared with imports).** `101`'s rules are stated per side of the scorecard; 102 makes them apply to **either side's** entries, with the `side` of the issue naming the side the entries belong to (the batting or bowling side). So the existing codes `BATTERS_OUT_NOT_WICKETS`, `NOT_OUT_COUNT`, `BATTING_TOTAL_MISMATCH`, `BOWLER_BALLS_MISMATCH`, `BOWLING_RUNS_MISMATCH`, `BOWLER_WICKETS_MISMATCH`, `FIELDING_EXCEEDS_WICKETS`, `WIDES_MISMATCH`, `NO_BALLS_MISMATCH`, `BOWLER_OVERS_EXCEED_LIMIT` and `LINEUP_TOO_LARGE` now also run for the opposition's batters, bowlers and list, with `step` `OPPOSITION_BATTING` / `OPPOSITION_BOWLING`. Concretely (all the same as `101`, restated for the opposition): the opposition batters out equal the opposition innings wickets (retirement rules unchanged); batters' runs plus extras equal the innings runs; **their bowlers'** balls, runs (plus our byes, leg byes and penalty runs), wickets (plus the derived non-bowler wickets of our innings) and wides / no-balls equal **our** innings; credited run-outs do not exceed the non-bowler wickets. The errors of `101` (batted with no runs, boundaries exceed runs, did-not-bat with figures, maidens above complete overs, duplicate batting position) also apply to opposition entries. The skip rules ("cannot check" when runs or balls are missing, no extras breakdown, forfeits, super-over innings) are unchanged. Rules that do **not** apply to opposition rows: `PLAYER_NOT_IN_SQUAD`, `GUEST_NAME_MATCHES_PLAYER`, `PLAYER_ON_BOTH_SIDES`, `GUEST_ON_BOTH_SIDES`, standouts.

*New errors:*

| Code | Rule |
|---|---|
| `OPPOSITION_WITHOUT_OUR_SCORECARD` | Opposition players exist but the result has no ours `result_player` (publish only) |

*New warnings (acknowledgeable at publish):*

| Code | Rule |
|---|---|
| `DISMISSAL_BOWLER_NOT_IN_BOWLING_LIST` | A dismissal names a bowler who has no bowling row in that innings (either side). The wickets cannot be credited to anyone's figures |
| `BOWLER_WICKETS_DIFFER_FROM_DISMISSALS` | A `MANUAL` bowling row's `wickets` differs from the wickets the dismissals credit to that player. **Checked only when every bowler-credited dismissal of that innings names a bowler** (otherwise it cannot be known, and nothing is raised) |
| `FIELDING_DIFFERS_FROM_DISMISSALS` | A `MANUAL` fielding row's catches, stumpings or run-outs differ from the dismissals' credit to that player. Checked per counter, and only when every dismissal that counter depends on names a fielder (`CAUGHT` for catches, `STUMPED` for stumpings, `RUN_OUT` for run-outs); a `CAUGHT_AND_BOWLED` always names its bowler |

A `DERIVED` row cannot trigger the "differ" warnings (it equals the derivation by construction). A derived total that falls short because bowlers were not named still shows up through the existing `BOWLER_WICKETS_MISMATCH` (Σ wickets + non-bowler wickets against the innings wickets), which is the intended nudge to finish naming bowlers.

**Standouts:** none computed or stored for opposition entries (stated, enforced by `OPPOSITION_NO_STANDOUTS`). `StandoutRules` reads the stored (effective) `wickets` and credits of **our** rows, so derived values flow into our suggestions with no extra code.

**Exceptions:** reuse `InvalidResultException`; add `OppositionPlayerNotLinkableException extends ValidationException`. `backend/openapi/openapi.yaml` regenerated by hand per the repo's practice, additions only.

## UI Requirements

Composed from the `101` pieces; nothing re-implemented: `ScorecardGrid`, `HowOutSelect`, `ExtrasFields`, `ReconcileStrip`, `PlayerName` (name toggle), `InfoCard`, `CompactToggleGroup`, `CompactSwitch`, `ConfirmDialog`, `BottomSheet`, `useReorderableRows` and `PlayerRowMenu` (extracted in `101` from `TeamSelectionList`), `OversInput`, `oversFormat`, `wicketFill`, `battingTotals`. **Mockup rule:** a mockup of each new surface on a phone (375 px) and a desktop is approved before the build; none is included here. Boards needed, to be added to the scorecard mockup artifact of `101` (https://claude.ai/artifact/2QZZKDccNRVoJ7TeyHsjyT) or a new "Opposition scorecard" artifact: (1) the Toss prompt with the opt-in; (2) **Opposition team** (the paste/type empty state, a filled list with reorder and substitute marking); (3) Our batting with the dismissal control (fielder and bowler); (4) Our bowling and fielding with "from dismissals" markers and the read-only non-bowler wickets; (5) Opposition batting, rows from the list, with a filled grid; (6) Opposition bowling and fielding; (7) Awards with the opposition pick; (8) Review with the opposition status and checks; (9) the result page showing both scorecards.

### Prompt and wizard order

The Toss step's prompt keeps its text: "Want to record who batted, bowled and fielded? It is optional, and the scores are worked out from it." with the buttons **Add our scorecard** and **Skip to scores**. Added beneath the text, in the same quiet style: a `CompactSwitch` **Add the opposition scorecard too** with a one-line helper "Names only, typed in. Nothing is created for these players and they never count for statistics." Off by default; shown only when the match has exactly one ours side (hidden in a derby, where it does not apply). **Skip to scores** ignores it. **Add our scorecard** goes to Our team (`101`, decision 21); if the switch is on, the opposition steps are registered and visible.

New wizard order (`RESULT_STEPS`, three more data entries, nothing else in the wizard changes): **Result, Toss and field, Our team, Our batting, Our bowling and fielding, Opposition team, Opposition batting, Opposition bowling and fielding, Awards, Scores and margin, Review.** Ours first, then theirs, then Awards. The same team-first pattern as `101`: **Opposition team** confirms the names once, and Opposition batting and Opposition bowling and fielding use only that list. The three new steps are flagged **Optional** in the stepper.

`isApplicable` for all three: the `101` scorecard predicate (match was played; hidden for forfeit, abandoned and no result) **and** exactly one ours side **and** (the opposition opt-in is on **or** the draft already has opposition players). The opt-in is wizard state in `ResultCapturePage`, initialised from the draft (opposition players present means on); it is not stored on its own (an opt-in with nothing entered is lost on reload, deliberately, at no cost). Beyond the prompt, two other entry points set it: a quiet **Add the opposition scorecard** button at the foot of Our bowling and fielding (a natural hand-off, shown while it is off; it opens Opposition team), and the same on Review. **Remove the opposition scorecard** (a header action on the three opposition steps, `ConfirmDialog`: "This removes their batting, bowling and fielding entries and the dismissal bowlers and fielders on our batters") deletes the opposition rows, clears the references, sets the opt-in off, and our `MANUAL` and `DERIVED` rows keep their stored numbers.

Opposition batting and Opposition bowling and fielding each show the **Innings card** (runs, wickets, overs) of the innings it concerns, editing the same draft innings as everywhere else, and the name display toggle at the top (as the other scorecard steps). No Home | Away switch (not a derby).

### Step: Opposition team (type or paste the names once)

Decision 7 below (2026-10-14, aligned with `101` decision 21: team confirmation first). This step replaces free-name row entry on Opposition batting: **the names are typed here, once, one per line**, and the two later opposition steps and the dismissal controls on Our batting only pick from this list.

- **Rows, in batting order.** The list is the opposition side's `result_player` rows, shown in the order typed (the likely batting order). **Enter** in the last row adds a row below and focuses it; **reorder** by the drag handle on desktop and, on every device, by the name popup (**Move up**, **Move down**, **Position**); **Mark as substitute** (and back) is in the same popup, next to **Remove** (`ConfirmDialog`, clears references to the row). No Swap and no Link (not registered players). Names are edited in the cell, and a rename follows everywhere.
- **Empty state:** a large multi-line "Type or paste their names, one per line" field with **Add names**, and an **Add a row** button.
- **Add later:** names missing once Opposition batting or bowling is open are added here (those steps show a **Not listed? Add them on Opposition team** link); there is no inline Add name on the later steps.
- The Opposition team step has the name display toggle and no Home | Away switch (not a derby). Row-entry rules below (Enter, paste, duplicates, the 15-name cap, `parseNameList`) apply to this step.

### Name entry (rules of the Opposition team step)

- A row's **Name** cell is a plain text input. **Enter** in the name cell of the last row adds a new row below and focuses its name cell; Enter on an empty last row does nothing (so the last Enter does not leave a blank row). **Tab** and the `101` grid keys behave as in `ScorecardGrid`.
- **Paste a list:** pasting text containing line breaks into any name cell splits it into names (one per line), trims each, drops blank lines, strips a leading list marker ("1.", "1)", "-", "•"), puts the first into the current row and **creates the following rows in order**, so the batting order is the paste order. At most 15 names are taken at once (a notice says so). Duplicate names (case-insensitive) already on the list are skipped with a notice, not added twice. The parser is one pure helper, `parseNameList` in `ui/src/utils/`, unit tested.
- A phone shows the same inside the card.
- **Wicket-driven form (on Opposition batting):** exactly as `wicketFill` in `101`, on the Opposition team list: the first `wickets + 2` rows are batted and later rows (and substitutes) are Did not bat; once the dismissals equal the wickets the remaining batted rows become Not out. The meter reads "Out 4 of 6".
- **One player, one row:** a name appears once on the Opposition team list, so the same person is one `result_player` across batting, bowling and fielding; the bowling table and the dismissal controls pick from that list (no new names are created there). Typing an existing name on this step reuses the row. Renaming a row renames it everywhere (everything points at the row), and removing a row asks first and clears the references to it.
- **Name toggle:** free-text opposition names go through `PlayerName` and `playerDisplayName` with the same first-name and surname-tag rules as guests (`101` decision 17). One addition (changes `101`'s helper, listed below): when a name's first word is a single initial ("J Smith", "J. Smith") first-name mode shows the whole typed name, because an initial cannot be shortened further.
- Reorder follows the Team Selection pattern (`101`): a drag handle on desktop, and the name popup (**Move up**, **Move down**, **Position**) on every device; on Opposition batting the popup has **Batting position** and on Opposition bowling **Bowling position**, and never Swap, Link or Remove (those, and Mark as substitute, are on Opposition team). The name itself is edited on Opposition team.

### Step: Opposition batting

The grid lists the opposition team list in its order (innings where they batted; the rows are the Opposition team players, substitutes as Did not bat; no name entry here): `#`, Name, **Dismissal**, R, B, 4s, 6s, with the totals strip ("Total 140 = 128 off the bat + 12 extras", `ReconcileStrip`, `BATTING_TOTAL_MISMATCH`) and the shared **Extras** row (the same fields shown on Our bowling and fielding, so editing either edits the same innings). The **Dismissal** cell is the `HowOutSelect` followed by, where the type allows them, a **Fielder** and a **Bowler** control that read like a scorecard line ("caught [fielder] b [bowler]"). Both are small type-ahead selects: **Fielder** lists all of **our** players of the match (the Our team list, including substitutes and 12th man) and **Bowler** lists **our bowlers** of that innings (the rows of Our bowling and fielding, in bowling order). Tab order is how out, fielder, bowler, then R. Controls that the type does not allow are absent (not disabled), so a run-out shows only a fielder and a bowled shows only a bowler. A phone batter card shows the same as chips under the how-out row. Our players are shown through `PlayerName`, so the toggle applies. Nothing in the dismissal cell is required.

### Step: Opposition bowling and fielding

A **Bowling** table for the innings in which **we** batted: Bowler (a select over the **Opposition team list** only, with a **Not listed? Add them on Opposition team** link), O (`OversInput`), M, R, W, with Wd / Nb behind **More**, and the **Bowled so far** strip against **our** innings ("Balls 238 of 240", "Runs 131 of 140 incl. our 6 extras not charged"). **W** shows a **from dismissals** marker while the row is `DERIVED` and is derived from our batters' dismissals (Our batting step); typing in it makes the row manual and the cell shows "our batters' dismissals say 2" with **Use 2**. **Our extras** (the shared Extras row, editing the same fields as Our batting) and **Wickets not credited to a bowler** (read-only "1 from our batters' dismissals", the `101` derivation for ours batting). A **Fielding** list below holds the opposition fielders (from the Opposition team list) with three counters, derived the same way from the dismissal fielder of our batters and marked "from dismissals"; only names with a credit appear unless added from the team list. Reorder as on Our bowling; adding a bowler picks from the Opposition team list.

### Our steps change only where the opposition scorecard is in use

- **Our batting:** the Dismissal cell gains the **Fielder** and **Bowler** controls described above, with options drawn from the **Opposition team list** only (fielder: any name on it; bowler: the opposition bowlers of that innings, i.e. the rows of Opposition bowling and fielding), with a **Not listed? Add them on Opposition team** link at the bottom of each list; there is no inline Add name. Without the opposition scorecard these controls are not rendered at all and the step is exactly `101`'s.
- **Our bowling and fielding:** **W**, **Catches / Stumpings / Run-outs** show **from dismissals** while `DERIVED`, with the same override and **Use N** behaviour. **Wickets not credited to a bowler** becomes the read-only derived line. When the opposition scorecard is added after these were typed, a banner on Opposition batting says "Our bowling and fielding figures were typed in. Use the dismissals for all?" with a `ConfirmDialog` bulk action (overwrites typed numbers, so it asks) and a per-row **Use N** otherwise.

### Awards, Review and the result page

- **Awards:** the official player of the match block's "Someone from the other side" becomes a picker over the **opposition list** when one exists (labelled with the opposition's team name, rendered through `PlayerName`), with a last option **Someone not listed...** for free text; with no opposition scorecard it is the free-text field of `101`. Standouts and the team award are untouched (ours only).
- **Review:** the scorecard line gains an opposition line ("Opposition: batting and bowling entered" / "partial" / "none", same status vocabulary as `101`'s per-side status). The Checks list merges the opposition issues (prefixed "Opposition batting" / "Opposition bowling", **Fix** jumps to the new steps via `step`). Info and warnings render as in `101`.
- **Result page (`ResultDetailPage`):** the **Our scorecard** section stays; a second section, **<Opposition team name> scorecard**, shows their batting, bowling and fielding as the same zebra tables (scrolling inside the card on a phone), the extras line and no standouts. Dismissals are written as a scorecard line by one pure helper, `dismissalText` in `utils/dismissal.ts` (mirrored tests): "c Smith b Jones", "c & b Jones", "st Smith b Jones", "b Jones", "lbw b Jones", "run out (Smith)", "hit wicket b Jones", "retired out", and so on; when a needed name is missing the helper falls back to the plain word with whatever names are known ("caught b Jones"). Our batters' dismissals use the same helper once names exist. Every label goes through `PlayerName` and follows the toggle.

### New shared pieces

`parseNameList` (utils), `DismissalFields` (the fielder and bowler selects, a small component with the four-file anatomy), `OppositionNameCell` (the typing cell with Enter-adds-row and paste, used on the Opposition team step only), `DerivedMarker` ("from dismissals" / "Use N" pair, shared by W and the three credits), `dismissalText` and the dismissal-to-credit table in `utils/dismissal.ts` (mirrors the backend `DismissalCredits` for display and tests; the **server is authoritative**: the client may pre-compute derived numbers for responsiveness but the saved values are the server's). Reuse, not rebuild: the grid engine, picker popup, reorder hook, `wicketFill`.

## Test Plan

**Backend unit (JUnit 5):** `DismissalCredits` matrix, one case per `DismissalType` (including `CAUGHT_AND_BOWLED` giving the bowler a wicket and a catch, `RUN_OUT` giving a fielder run-out and no bowler wicket, `STUMPED`, retired and the non-bowler kinds), grouping per player, a `DERIVED` fielding row created at 1 credit and removed at 0, a `MANUAL` row never touched; `non_bowler_wickets` derivation (with and without opposition batting entries, `RETIRED_OUT` counted, written to the column); the save-time rules (bowler not allowed on `RUN_OUT`, fielder not allowed on `BOWLED`, dismissal player on the wrong side, `opposition` row on an ours side, in a derby, with a profile, `featuredOverride` on an opposition entry, link refused); `detail_level` (`SUMMARY` / `OUR_SIDE` / `FULL`, a derby is never `FULL`, opposition without ours is a publish error); award name snapshot and refresh; the validator for each new code and for every `101` code run on the opposition side (with `side`/`step` on each issue), including the complete-attribution skip for `BOWLER_WICKETS_DIFFER_FROM_DISMISSALS` and `FIELDING_DIFFERS_FROM_DISMISSALS`, the rules that do not apply to opposition (guest, squad, both-sides), and the statistics filter rule helper used by `103` (opposition never counted).

**Backend integration (Testcontainers):** migration `045` applies to a database with `044` data (new columns defaulted, existing rows `MANUAL`); the `opposition` CHECK; opposition players cascade with the result and clear dismissal references (`on delete set null`) and keep the award name; whole-scorecard replace with opposition rows is atomic and idempotent, and the recompute of `DERIVED` rows is in the same transaction and idempotent; re-saving the Scores step or a toss resequence keeps opposition entries (in-place innings reconcile); tenancy (club A cannot read club B's opposition rows); service-tier cases run without an ambient transaction (`open-in-view=false`).

**Structural (ArchUnit):** the existing scorecard-repository rule covers the new queries; no new layer.

**Contract:** OpenAPI diff, additions only (`opposition`, `bowlerPlayerId`, `fielderPlayerId`, the two source fields, the derived read fields, `nonBowlerWicketsDerived`, `hasOppositionScorecard`, new issue codes and steps).

**Frontend component (Vitest + Testing Library + Storybook):** `parseNameList` (line breaks, numbering and bullets, blanks, duplicates, the 15-name cap); `OppositionNameCell` on the Opposition team step (Enter adds a row and focuses it, Enter on an empty last row does not add, paste creates rows in order, Add names from the empty state, reorder by the name popup, Mark as substitute, Remove clears references); Opposition batting and Opposition bowling and fielding show only the Opposition team list (no name entry, a Not listed? Add them on Opposition team link, no inline Add name); `wicketFill` on the Opposition team list (wickets 6 with 11 names gives 8 batted and 3 did-not-bat; dismissals reaching the wickets make the rest not out); `DismissalFields` (shows only the controls the type allows, clears a field when the type changes, option sets: fielder = our players or the Opposition team names, bowler = the fielding side's bowling rows, no inline Add name, only the link to Opposition team); `DerivedMarker` (derived, typed over, Use N, bulk confirm); `dismissalText` (every type, missing names); `playerDisplayName` single-initial rule and free-text opposition names collisions; the three registered steps' `isApplicable` (opt-in on or off, rows present, derby hidden, forfeit hidden), the stepper order, the prompt switch (hidden in a derby, ignored by Skip to scores); Awards opposition picker and the free-text fallback; Review's opposition line and Fix; reorder via the name popup without Swap or Link; `TeamSelectionList` and the `101` tests stay green.

**End-to-end (Playwright, mobile and desktop):** golden path extending `101`'s: on the Toss prompt turn on the opposition switch, add our scorecard (starting at Our team), finish ours, then on Opposition team paste eleven names and mark one substitute, on Opposition batting mark dismissals with our bowlers and fielders, see our bowling W and fielding counters appear marked "from dismissals", type over one and see it become manual, enter Opposition bowling and fielding, pick an opposition player of the match, publish with no warnings, and open the result page showing both scorecards with dismissals as "c Smith b Jones"; a second short test with a deliberately inconsistent opposition card showing the acknowledgeable warnings; a derby test showing no opposition switch or steps. Per the working rule, tests and the standards review run after the user has browser-checked the function.

## Acceptance Criteria

- The Toss prompt keeps its copy and its two buttons and adds **Add the opposition scorecard too**, off by default, hidden in a derby; **Skip to scores** ignores it; the opposition steps (Opposition team, Opposition batting, Opposition bowling and fielding, in that order, after Our bowling and fielding and before Awards) appear only when it is on or opposition players exist, and only for a match with one ours side.
- Opposition players are `result_player` rows on the non-ours side with a name only; no `Person` or `PlayerProfile` is created, they cannot be linked, they are never a standout and never counted in any statistic or "match played", and the rule is unit tested.
- Opposition names are entered **once, on the Opposition team step**, as text: Enter on the last row adds a row, pasting a list creates rows in order (capped at 15, blanks and list markers dropped), a name typed again reuses the same player, and rows can be reordered and marked substitute. Opposition batting and Opposition bowling and fielding use only that list and have no name entry; the bowler and fielder pickers for dismissals are drawn from it, with a Not listed? Add them on Opposition team link.
- Each dismissal can name a bowler and a fielder where the type allows (table above); a run-out never has a bowler; a caught-and-bowled has only the bowler; where we bowl the options are our bowlers and fielders, where we bat they are the Opposition team names.
- Where the opposition scorecard is in use, our bowlers' wickets and our fielders' catches, stumpings and run-outs are derived by the server from the dismissals, marked "from dismissals", recomputed on every save for `DERIVED` rows and never touched on `MANUAL` rows; typing over one makes it manual and **Use N** returns it; a `MANUAL` value that differs from complete dismissals raises an acknowledgeable warning, and an incomplete attribution raises none.
- `non_bowler_wickets` is derived from the opposition batters' dismissals whenever the innings has opposition batting entries, and is read-only in the UI then; with none it is the `101` manual input.
- `detail_level` is `FULL` when both an ours and an opposition scorecard exist; an opposition-only scorecard cannot be published; a derby never has opposition rows and is never `FULL`.
- The opposition batters' totals, wickets and not-outs, and their bowlers' balls, runs, wickets, extras and fielding, are checked by the shared `ResultValidator` with `code`, `step` (`OPPOSITION_BATTING` / `OPPOSITION_BOWLING`) and `side`, as acknowledgeable warnings; a unit test drives it with no wizard involved.
- The official player of the match can be picked from the opposition list (name snapshotted, surviving removal of the row), with free text still available; free text is the only path when there is no opposition scorecard.
- The result page shows our scorecard and the opposition's, with dismissals written as "c Smith b Jones" through one helper, and the Full name / First name toggle applies to every opposition name.
- Reordering opposition players works by drag handle on desktop and by the name popup everywhere (Opposition team, Batting position, Bowling position); the popup offers no Swap or Link.
- Removing the opposition scorecard deletes its rows, clears the dismissal references and leaves our stored numbers as they were.
- Adding or removing the opposition scorecard never deletes anything in our scorecard; with no opposition scorecard every screen behaves exactly as `101` (no new controls, no new checks).
- OpenAPI changes are additive; new services have unit tests and new queries integration tests in the same PR.

## Rollout Notes

- **Order:** migration `045`, `result_player.opposition` and its structural rules, the dismissal columns and `DismissalCredits` (derivation and recompute in the save transaction), `non_bowler_wickets` derivation, the validator extensions and the three new warnings, award snapshot, `detail_level`; then `parseNameList`, `OppositionNameCell`, `DismissalFields`, `DerivedMarker`, the two opposition steps and the prompt switch, the Our-step changes, Awards, Review and the result page.
- **No feature flag.** The opposition scorecard is opt-in per result. A result without it behaves exactly as `101`. Matches captured earlier are unaffected (existing rows `MANUAL`).
- **Docs to update with the build** (by the caller / build, not this spec): `docs/roadmap.md` (Active row for 102; resolve "`102` reuses ..." and the `101` deferrals for bowler/fielder and `non_bowler_wickets`; keep the opposition player directory and the minors question), `docs/architecture.md` (opposition `ResultPlayer`), `docs/standards/frontend.md` (the opposition steps, `parseNameList`, `dismissalText`), `docs/standards/backend.md` (a derived row is recomputed in the save transaction, a manual row never; opposition rows never reach statistics).
- **Mockups first:** the eight boards listed under UI Requirements, phone and desktop, approved before the build.

### Changes to 101 (for the human to veto)

1. **Wizard order and prompt:** three steps (Opposition team; Opposition batting; Opposition bowling and fielding) are inserted between Our bowling and fielding and Awards (after `101`'s Our team step is in front of Our batting), and the Toss prompt gains the opt-in switch. The prompt copy and buttons are unchanged.
2. **`result_player` side rule relaxed:** `101` says rows must be on "a side that is ours"; 102 allows rows on the non-ours side with the new `opposition` flag and a stricter CHECK. Ours is unchanged.
3. **Bowler and fielder on dismissals:** `101` decided (2026-10-14) that none exist until 102; 102 adds the two columns, **only used when the opposition scorecard is in use**, so Our batting only gains the controls then.
4. **`non_bowler_wickets` is derived on our-bowling innings** when the opposition has batting entries (101: always a typed number there); the input becomes read-only in that case.
5. **Our bowling and fielding numbers can now be derived:** new `wickets_source` / `credits_source` columns; with the opposition scorecard, new rows start `DERIVED` and the server recomputes them. `101` rows and all rows without the opposition scorecard stay manual.
6. **Reconciliation codes generalised to the opposition side** (no new codes for the shared rules; `side` and `step` tell them apart), plus three new warnings and one publish error. `LINEUP_TOO_LARGE` applies to the opposition list too.
7. **`detail_level` gains `FULL`;** `OUR_SIDE` now means "ours only" (as `101` already effectively meant).
8. **Official player of the match** can reference an opposition player (name always snapshotted); `101`'s "name field labelled with the opposition's team name" remains as the fallback and the no-card path.
9. **Result page and Review:** both gain an opposition section/line; our batters' dismissals read as "c Smith b Jones" when names exist.
10. **`playerDisplayName`:** a first word that is a single initial keeps the whole typed name in first-name mode (also affects guests; fixes "J" showing alone).
11. **Standouts and the guest rules** are stated as not applying to the opposition (no behaviour change for ours).
12. **Link route** now refuses an opposition row.

### Decisions made in this spec (to confirm)

1. Opposition steps appear only after ours is opted in; opposition-only is disallowed (publish error), not silently allowed.
2. A dismissal's bowler and fielder are **references to a `result_player`**, never free text; typing a new name in a dismissal control creates an opposition player.
3. Derived counts are **suggestions stored as effective values** with an explicit `MANUAL` / `DERIVED` flag (per bowling row, and per fielding row for all three counters); manual always wins; mismatches are acknowledgeable warnings only when the dismissals are fully attributed.
4. In a run-out only a fielder is recorded (one name); a caught-and-bowled credits the bowler with a wicket and a catch; a keeper's catches are catches (`101`).
5. The opt-in is wizard state, not stored.
6. Opposition standouts: none.
7. **Team first, as in `101` decision 21 (2026-10-14):** a new **Opposition team** step comes before Opposition batting. The names are typed or pasted once (one per line, Enter adds a row), reordered and marked substitute there; Opposition batting and Opposition bowling and fielding, and the bowler and fielder pickers for dismissals, use only that list. This replaces free-name rows entered on Opposition batting and the inline Add name on dismissal and bowler controls. Consequence: the opposition `result_player` CHECK allows the `substitute` display marker. Mockup: a new board for the Opposition team step.

### Open questions for the human

1. **Remembering opposition names between fixtures** (later improvement): suggest the last fixture's list against the same league team as one-tap suggestions or a prefilled list; the data supports it (opposition rows keyed through the match's opposing team). Wanted as a follow-up, or in 102?
2. **What happens when a name changes:** this spec renames in place (every dismissal, bowling row and award follows, since they point at the row). Across matches there is no identity. Is that enough?
3. **Derby bowler/fielder:** should a derby's dismissals also name the other team's registered bowlers and fielders (deriving their credits)? The model allows it without a schema change; not built here.
4. **Per-row or per-counter "derived" flag** for fielding: one flag per row (this spec) is simpler; per counter lets a manager type only catches and still derive stumpings.
5. **Official player of the match:** keep the free-text fallback beside the opposition picker (this spec), or restrict to the list when it exists?
6. **`LINEUP_TOO_LARGE` for the opposition:** junior games sometimes have more than eleven a side. It is only a warning; fine, or exempt the opposition?
7. **Minors' names:** opposition names are often children. Results are manager-only today, so there is no exposure, but the public and player-facing results views (deferred in `100`) will need a decision (hide surnames, show initials) before they show these names.
8. **Bulk paste scope:** only a list of names is parsed here. Is reading figures from a pasted scorecard text wanted, or left to the import adapters (`104`) behind a confirm step?
9. **"Use dismissals for all" bulk action** when the opposition scorecard is added after our figures were typed: kept as an explicit confirm (this spec); drop it if per-row **Use N** is enough?
10. **Confirm the migration number `045`** at plan time (another branch may take it).
