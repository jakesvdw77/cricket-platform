# 103: Player Statistics (Part 1 of Statistics; Team Statistics are Part 2)

**Depends on:** `100-match-results-core.md` (`match_result`, `match_innings`, the draft / publish gate, `ResultVisibility`, "Statistics decision": stats are computed by link from published rows, never copied), `101-match-results-our-side-scorecard.md` (`result_player`, `batting_entry`, `bowling_entry`, `fielding_entry`, `match_award`; "Guests and borrowed players", "The opposition: who counts for what", the appearance rule, the derby rule, stored versus derived credits), `102-match-results-opposition-scorecard.md` (merged into 101, history only), `104-match-results-import-adaptors.md` (`IMPORTED_NAME_UNCONFIRMED` blocks publish, so an imported guess never reaches a published result), `001-tenancy-identity-model.md` (`Person`, `PlayerProfile`, `UNIQUE (person_id, club_id)`), `028-players.md` and `060-player-detail-redesign.md` (the Stats card placeholder), `088-players-polls-alignment.md` (Player page key figures), `029-league-management.md` (`Match`, `League`, `Season`), `114-share-result.md` (the First names as initials rule and junior lock, for any later public use), `docs/standards/*.md`.
**Status:** draft (2026-10-18). Written from the product owner's list of wanted statistics and the real schema (migrations `043` to `051`). No code is written by this spec. Mockups are needed and must be approved before the build (open question 1).

## Problem & Goals

Managers now capture and publish full scorecards (`101`) and can import them (`104`), but nothing reads those rows back. The Player page still shows a Stats card with a "More coming soon" note and a dash for runs and wickets (`060`), and its only real numbers, "Games this season" and "Games overall", count team **selections** (`MatchSidePlayer`), not matches actually played. A manager who captures every result gets no payoff for it.

This spec is **Part 1 of statistics: player statistics** (batting and bowling, plus fielding, which the data supports cheaply) computed on read from **published** results. **Team statistics are Part 2** (named below, with a data-availability note, not designed). The product owner expects some data to be missing from our results ("they can just be flagged for now") and asked for suggestions of further statistics and of where the data does not exist; both are in this spec, and anything that needs new capture is deferred.

Goals:
- **A. Every statistic the owner listed**, with its exact name and description, either computed or explicitly flagged as not captured yet (the Data availability tables say which, and why).
- **B. One definition of every number**, in one pure class (`PlayerStatsCalculator`, `service.support`), so the screen, a later leaderboard, a later share card and the tests can never disagree.
- **C. Honest by construction:** only published results, only our registered players, no guests, no opposition, each figure carrying how much of the data it is based on, so a manager is never misled by a scorecard that was only half captured.
- **D. Filters:** career (all time within the club), Season, League, Team and Competition (league versus friendly).
- **E. The Player page Stats card goes live** with headline figures and a button to a full breakdown page with Batting, Bowling and Fielding tabs.
- **F. Room for later:** the read model leaves a source/scope dimension free for the roadmap's "Player-recorded games" (separate store, never blended silently), and for Part 2.

## Non-goals

- **Team statistics** (Part 2, see the section below): no endpoint, screen or DTO here.
- **Leaderboards, rankings and "top scorer" lists.** Not in the owner's list. They need qualification rules (minimum innings or balls), tie rules and a decision about ranking children. Deferred (open question 4); the calculator is built so a leaderboard can reuse it unchanged.
- **Player-recorded own games** (roadmap: "Player-recorded games (own records)", timed with the player login flow). Verified club statistics only. The contract carries a `scope` object (always `CLUB_VERIFIED` here) so an `ALL` scope can be added later without a breaking change; no data from any other store is read or blended.
- **Cross-club career statistics.** Statistics are this club's published results only (tenancy). Joining a person's profiles across clubs needs the roadmap's link-a-person flow with the player's or a platform admin's confirmation, and is not built here (see "Which person").
- **Public or player-facing statistics pages, share cards and "season so far" lines on a shared result.** Manager-only here. Any later public or shared use must go through `114`'s First names as initials rule (`utils/share/shareName.ts`) and its junior lock, because many players are children (see "Privacy and data quality").
- **New capture to fill the gaps.** Dot balls faced, boundaries conceded per bowler, partnerships, fall of wickets, catches dropped, direct hits, over-by-over spells, wagon wheels, a wicketkeeper marker per match: all flagged, none captured here. Each is listed in "Deferred by 103" with the change it needs.
- **Super-over runs and wickets.** `101` rejects scorecard entries on super-over innings; `105` owns whether they ever count. The queries still filter `match_innings.kind = 'REGULAR'` so nothing changes silently when `105` lands.
- **Format-aware thresholds and "milestone" intelligence** (for example a fifty meaning something different in a 20-over junior game). The counters the owner listed are fixed (30, 50, 100). Suggested all-round and "good innings" measures need the same relative-threshold work as standouts (`101`, deferred) and are not built.
- **Materialised or cached statistics.** Compute on read (see Architecture). No new table.
- **Per-role access beyond "any club manager of the club".** Section narrowing and player self-service are open questions (5, 6), not built.
- **Changing any scorecard rule.** Everything about what counts is restated from `101`, not altered.
- **Rewriting the Player page key figures strip** (`PlayerKeyFigures`, selection-based "Games this season / overall"). It stays; see open question 9.

## Part 2: Team statistics (named only, not designed)

The owner's team list: Matches Played, Wins, Losses, Ties, No Results, Win Percentage (wins / decisive results x 100), Runs Scored, Wickets Lost, Team Batting Average, Average Runs per Innings, Highest and Lowest Team Total, Highest Successful Chase, Largest Victory by Runs and by Wickets, Team Run Rate, Team Net Run Rate (competition defined), Total Wickets Taken, Team Bowling Average, Team Economy Rate, Partnerships (runs by wicket), Extras Conceded, Average Extras per match.

**Data-availability note.** Team statistics need no scorecard: nearly all are computable from `match_result` and `match_innings` alone (`outcome_type`, `winning_side`, `margin_type`, `margin_value`, `scheduled_balls`, `balls_per_over`; innings `runs`, `wickets`, `balls`, `all_out`, `extras`, the extras breakdown), which exist for **every published result, summary level included**. So Part 2 will cover far more matches than player statistics do. Known caveats for Part 2's own spec: (1) **Partnerships (runs by wicket) are MISSING**: fall of wickets and partnerships are not captured (`101`, Non-goals); (2) **Net Run Rate** is competition defined (all-out innings are usually counted as the full quota of overs, DLS matches use revised targets), so it needs a per-league rule and is not derivable as a single formula; (3) extras and the breakdown are nullable on summary-level results, so Extras Conceded and Average Extras are partial there; (4) the per-team result rule of `100` (a derby gives one team a win and the other a loss; counters count team results) is the model to reuse; (5) Lowest Team Total needs a rule for shortened or unfinished innings (use `all_out` or the full scheduled quota). Part 2 reuses the same filters, the same published-only gate and the same "one calculator class" rule.

## User Stories

- As a club manager, I can open a player and see headline figures (matches, runs, batting average, strike rate, wickets, economy) on the Stats card, so that I get value from the results I capture without leaving the Player page.
- As a club manager, I can open a full breakdown of a player's batting, bowling and fielding, so that I can answer questions about a player's season or career.
- As a club manager, I can filter the breakdown by Season, League, Team and Competition (league or friendly), so that I can compare seasons or look at one team's games.
- As a club manager, I see how many published results the figures are based on, how many had a batting card and a bowling card, and a note where a figure is partial, so that I am never misled by half-captured scorecards.
- As a club manager, I see which statistics are not captured yet and why, so that I know what the club's capture does not yet support, instead of a zero that looks real.
- As a club manager, I see a player with no published results shown as an empty state that explains what will make figures appear, not as a page of zeros.
- As a club manager, I can see how a player has been dismissed and how many of each dismissal a bowler has taken, so that I can spot patterns in a player's game.
- As a club manager, I see a player's recent form (last five innings, last five bowling figures), their player of the match awards and their team's results while they played, so that the page tells a story, not only totals.
- As a club manager, I know that unpublishing a result or linking a guest to a player changes the statistics immediately and correctly, with nothing to refresh by hand.
- As the product owner, I can see exactly which of my requested statistics the data supports today and what each missing one needs, so that I can decide what to capture next.

## Data Model Changes

**None. No migration.** Statistics are computed on read from the existing tables (the Architecture section explains why). The existing indexes cover the queries (see Rollout Notes). Every table and column below was read from migrations `043` to `048` and the entities `ResultPlayer`, `BattingEntry`, `BowlingEntry`, `DismissalType`, `Match` and `League`; items marked **not verified** were not read.

### What counts (rules fixed by `101`, restated, not changed)

A **counted appearance** is a `result_player` row `rp` where **all** of these hold:

| Rule | Column / source | Why |
|---|---|---|
| The result is **published** | `match_result.status = 'PUBLISHED'` | Drafts never count (`100`, `ResultVisibility`). Unpublish removes a result from every figure at once |
| The match was **played** | `match_result.outcome_type IN ('WON','TIE','DRAW')` | `101`: a list on a match later recorded as `FORFEIT`, `ABANDONED` or `NO_RESULT` is never an appearance. The same filter applies to every batting, bowling, fielding and award row of that match, so a player never has figures in a match that is not a match played (open question 7: a no-result match with play) |
| The row is **ours** | `result_player.opposition = false` | Opposition rows are names only, never statistics (`101`) |
| The row is **linked to a registered profile** | `result_player.player_profile_id IS NOT NULL` | A guest (`NULL`) counts for nobody until linked (`101`, "Guests and borrowed players") |
| The row is **not a substitute** | `result_player.substitute = false` | `101`'s appearance rule. A 12th man who bats, bowls or fields is promoted to `substitute = false` when his first row is saved, so he counts. A substitute fielder's catch is therefore not credited (open question 8) |
| The row is **not an unconfirmed import guess** | `result_player.import_match IS NULL` | Defensive only: `104` blocks publishing while any row carries it, so a published result has none |
| The result belongs to **this club** | `match_result.club_id = :clubId` | Tenancy |
| Entries are on **regular** innings | `match_innings.kind = 'REGULAR'` | `101` rejects super-over entries; the filter is defensive and keeps `105`'s decision explicit |

- **Matches (a match played)** is the count of **distinct** `match_result_id` over counted appearances. A player on both sides of a derby (two `result_player` rows, `PLAYER_ON_BOTH_SIDES`) counts **one** match; all of their rows from both sides still count in full for their innings, bowling and fielding (`101`, Derby rule 6).
- A **batting, bowling or fielding row counts** when its `result_player_id` is a counted appearance. Only rows reached through a counted appearance are read, never the entry tables on their own.
- **Stored effective values are used as they are.** Bowler `wickets` and fielder `catches`, `stumpings`, `run_outs` are read from `bowling_entry` and `fielding_entry` whether their source is `DERIVED` or `MANUAL`; the calculator never recomputes a credit from the dismissals (`101`: "stay the stored effective values (what `103` and every check read)").
- **Edits after publishing.** A published result cannot be edited; it must be unpublished first, and then it no longer counts. The one edit allowed on a published result is **linking a guest to a player**, which changes only `player_profile_id`; because statistics are computed on read, a link changes the figures on the next read with no refresh step (this is a main reason for compute-on-read).
- **Deactivated players** keep their statistics (disable, never delete); the page is reachable from the Player page as today.

### Which person (aggregation key)

`result_player.player_profile_id` points at this club's `PlayerProfile`, and `UNIQUE (person_id, club_id)` means **one profile per person per club**. Within a club, grouping by `player_profile_id` and grouping by `person_id` give the same answer, so **the aggregation key is the profile (`playerId` in the URL, the same id the other `/players/{playerId}` routes use; confirm at plan time)**. The facts query joins `player_profile` and carries `person_id` so a later cross-club roll-up changes one group-by, not the calculator. A person with profiles at two clubs sees each club's own figures only; combined career figures wait for the roadmap's cross-club link (a Person-linking spec, plus consent), and a duplicate `Person` inside one club is fixed by the roadmap's in-club merge (results move to the kept profile). This is proposed, not confirmed (open question 2). Specs `015` and `018` were **not read**; the key rests on `001`, `PlayerProfile` and `101`.

### Data availability: the owner's batting statistics

Legend: **Available** = a stored value is read directly; **Derivable** = computed from stored columns (named); **MISSING** = the data does not exist. "Optional" means a nullable column a manager may leave blank, where `NULL` means "not on the scorecard", never 0 (`101`); such a statistic is Available or Derivable **only for the innings that recorded it**, and the response says how many innings that is (`coverage`).

| # | Statistic | Status | Source and note | Until the data exists |
|---|---|---|---|---|
| 1 | Matches | Derivable | Distinct `match_result_id` over counted appearances (`result_player`) | n/a |
| 2 | Innings | Derivable | `batting_entry` rows with `how_out <> 'DID_NOT_BAT'` on an innings that has a batting card (see "Card captured") | n/a |
| 3 | Not Outs | Derivable | `how_out IN ('NOT_OUT','RETIRED_NOT_OUT')` | n/a |
| 4 | Runs | Available | `batting_entry.runs` (required once the row batted; publish enforces it) | n/a |
| 5 | Highest Score | Derivable | max `runs`, with a not-out star | n/a |
| 6 | Batting Average | Derivable | runs / dismissals (`DismissalType.isWicket()`) | dash when no dismissals |
| 7 | Balls Faced | Available (optional) | `batting_entry.balls`, nullable | summed over innings that recorded it; `coverage` note |
| 8 | Strike Rate | Derivable (optional inputs) | runs / balls x 100 over innings with balls | dash when no innings has balls |
| 9 | Centuries | Derivable | `runs >= 100` | n/a |
| 10 | Half-Centuries | Derivable | `runs` 50 to 99 | n/a |
| 11 | Fours | Available (optional) | `batting_entry.fours`, nullable | sum of recorded; `coverage` note |
| 12 | Sixes | Available (optional) | `batting_entry.sixes`, nullable | sum of recorded; `coverage` note |
| 13 | Ducks | Derivable | dismissed with `runs = 0` | n/a |
| 14 | Golden Ducks | Derivable (optional input) | duck with `balls = 1`; an innings with `balls` null is a duck but not provably golden | shown with a "from innings with balls" note |
| 15 | 30+ Scores | Derivable | `runs >= 30` | n/a |
| 16 | 50+ Scores | Derivable | `runs >= 50` (includes centuries) | n/a |
| 17 | 100+ Scores | Derivable | `runs >= 100` (equals Centuries; listed because the owner asked for both) | n/a |
| 18 | Boundary Percentage | Derivable (optional inputs) | (4 x fours + 6 x sixes) / runs, over innings with both `fours` and `sixes` recorded | dash when none |
| 19 | Dot Ball Percentage (batting) | **MISSING** | No per-ball data; `batting_entry` holds runs, balls, fours, sixes only. Needs per-ball capture or a batter "dots" figure (a `batting_entry.dots` column, as `bowling_entry.dots` was added in `045`), entered or imported | **Not captured yet** (listed in the panel, no tile) |
| 20 | Balls per Boundary | Derivable (optional inputs) | balls / (fours + sixes), over innings with `balls`, `fours` and `sixes` recorded | dash when no boundaries |
| 21 | Dismissal Mode | Derivable | count of `batting_entry.how_out` per `DismissalType` over dismissals, plus Not out | n/a |

### Data availability: the owner's bowling statistics

| # | Statistic | Status | Source and note | Until the data exists |
|---|---|---|---|---|
| 1 | Matches | Derivable | as batting | n/a |
| 2 | Innings Bowled | Derivable | `bowling_entry` rows with `balls > 0` or `runs > 0`, on an innings that has a bowling card | n/a |
| 3 | Overs | Derivable | Σ `bowling_entry.balls`, shown through `oversFormat` with the match's `match_result.balls_per_over` | when counted innings mix over lengths, Balls Bowled is shown and Overs shows "mixed over lengths" |
| 4 | Balls Bowled | Available | `bowling_entry.balls` (legal deliveries: `101` reconciles Σ bowlers' balls to the innings balls) | n/a |
| 5 | Runs Conceded | Available | `bowling_entry.runs` (includes wides and no-balls, excludes byes, leg byes, penalty: `101`'s charging rule) | n/a |
| 6 | Wickets | Available | `bowling_entry.wickets`, the stored effective value (`wickets_source` `DERIVED` or `MANUAL`), bowler-credited only | n/a |
| 7 | Bowling Average | Derivable | runs / wickets | dash when no wickets |
| 8 | Economy Rate | Derivable | runs / overs, overs taken per match with its own `balls_per_over` | dash when no balls |
| 9 | Strike Rate | Derivable | legal balls / wickets | dash when no wickets |
| 10 | Best Bowling | Derivable | per innings: most wickets, then fewest runs | dash when no bowling innings |
| 11 | Maiden Overs | Available | `bowling_entry.maidens` | n/a |
| 12 | Five-Wicket Hauls | Derivable | innings with `wickets >= 5` | n/a |
| 13 | Four-Wicket Hauls | Derivable | innings with `wickets = 4` | n/a |
| 14 | Wides | Available (optional) | `bowling_entry.wides`, nullable (runs from wides, as the extras breakdown counts them) | sum of recorded; `coverage` note |
| 15 | No-Balls | Available (optional) | `bowling_entry.no_balls`, nullable | sum of recorded; `coverage` note |
| 16 | Dot Balls | Available (optional) | `bowling_entry.dots` (added in `045`; nullable; `0 <= dots <= balls`; typed by the manager behind **More** on the Bowling step; whether each import adaptor fills it is **not verified**) | sum of recorded; `coverage` note |
| 17 | Boundaries Conceded | **MISSING** | `bowling_entry` has no fours or sixes conceded. Batters' fours and sixes belong to the whole side, not to a bowler. Needs a per-bowler `fours_conceded` and `sixes_conceded` (a `bowling_entry` change in a later scorecard spec, entered or imported), or ball by ball | **Not captured yet** |
| 18 | Dismissal Mode (by this bowler) | Derivable, partial | count of `batting_entry.how_out` (bowler-credited values: `BOWLED`, `CAUGHT`, `CAUGHT_AND_BOWLED`, `LBW`, `STUMPED`, `HIT_WICKET`) where `bowler_result_player_id` is this player's row. The bowler on a dismissal is optional, so the modes may add up to fewer than Wickets: the difference is shown as "Not recorded" | `coverage` note |

### Data availability: fielding and the suggestions

| Statistic | Status | Source and note |
|---|---|---|
| Catches, Stumpings, Run-outs | Available | `fielding_entry.catches`, `stumpings`, `run_outs` (stored effective; a keeper's catches are catches; a caught-and-bowled gives the bowler a catch) |
| Fielding dismissals, per match | Derivable | Σ of the three; divided by Matches |
| Wicketkeeper dismissals (caught behind) | **MISSING** | No wicketkeeper marker on the scorecard (`101` dropped it, decision 2026-10-14). `match_side.wicket_keeper_player_id` (migration `021`) is the **planned** selection, not who kept on the day; stumpings are keeper-only but catches cannot be separated. Needs the roadmap's captain and wicketkeeper markers taken from the selection |
| Catches dropped, direct hits, run-out assists | **MISSING** | Not captured (`101`, Non-goals). A run-out records one fielder only |
| Player of the match awards | Available | `match_award` (`PLAYER_OF_MATCH` official, `TEAM_PLAYER_OF_MATCH` the club team's own) where the award's `result_player_id` is a counted appearance; free-text and opposition winners count for nobody |
| Team result while the player played | Derivable | `match_result.outcome_type`, `winning_side` against the row's `side`; a derby match is counted separately as internal (no win or loss) |
| Recent form | Derivable | last five batting innings and last five bowling innings by `match.match_date` |
| Innings by batting position | Derivable | `batting_entry.position` (actual order; `NULL` for did not bat) |

### Card captured, partial figures and summary results

A published result may be **summary level** (no `result_player` at all), or have a team list but no batting or bowling card, or a card with optional columns left blank. The calculator therefore works from **what was captured**, with these rules (each is a unit-test case):

- **Card captured.** For a counted appearance, the player's **batting card is captured** when the innings in which the player's side batted has at least one `batting_entry`; the **bowling card is captured** when the innings in which the other side batted has at least one `bowling_entry`. Batting statistics (Innings and everything built on it) use only innings with a captured batting card; bowling statistics only innings with a captured bowling card. Without this rule, a team list with no batting card would make every player look like they did not bat. A player on a captured card with **no row** is treated as did not bat (or did not bowl), which is how the scorecard itself reads.
- **Matches** counts the appearance regardless of cards (a team list alone proves a match played, `101`).
- **Optional columns.** `balls`, `fours`, `sixes`, bowling `wides`, `no_balls` and `dots` are `NULL` when not captured. A statistic built on them uses only the innings where **every column it needs** is non-null, and the response reports `coverage` (innings used out of innings counted). A batting row with `balls = 0` and `runs > 0` is treated as `balls` not recorded (a batter cannot score off no balls faced; scorers sometimes enter 0 for unknown).
- **Summary-level results** have no player rows and cannot count for any player. The page says so (see "UI Requirements", the basis line).

## Precise definitions

All figures are computed once, in `PlayerStatsCalculator`, from per-innings fact rows. Rounding is `RoundingMode.HALF_UP` applied **once at the end**, never between steps. A statistic with no valid denominator is `null` in the API and a dash in the UI, **never infinity, never 0, never NaN**.

### Batting

| Term | Definition |
|---|---|
| **Innings** | A counted batting row whose `how_out` is anything except `DID_NOT_BAT`, on an innings with a captured batting card. A row with `how_out` null (a draft-only state; publish refuses it) is ignored |
| **Dismissal** | An innings whose `how_out` has `DismissalType.isWicket() = true`: `BOWLED`, `CAUGHT`, `CAUGHT_AND_BOWLED`, `LBW`, `STUMPED`, `RUN_OUT`, `HIT_WICKET`, `HANDLED_BALL`, `OBSTRUCTING_FIELD`, `HIT_BALL_TWICE`, `TIMED_OUT` and **`RETIRED_OUT`** (a tactical retirement is a wicket in `101`, so it is a dismissal; open question 3) |
| **Not out** | An innings that is not a dismissal: `NOT_OUT` and `RETIRED_NOT_OUT` (retired hurt is not a dismissal, `101`). Always `Innings = Dismissals + Not outs` |
| **Runs** | Σ `runs` over innings |
| **Highest Score** | The largest `runs`; shown "87*" when that innings was not out. On equal scores the not-out innings is the higher (so 50 and 50* shows 50*) |
| **Batting Average** | Runs / Dismissals, 2 decimals. No dismissals: dash |
| **Balls Faced** | Σ `balls` over innings with `balls` recorded (and not the `balls = 0, runs > 0` case) |
| **Strike Rate** | Σ runs / Σ balls x 100, 2 decimals, **over the same innings that recorded balls** (runs from innings without balls never inflate it). Σ balls = 0: dash |
| **Centuries** | Innings with `runs >= 100` (exclusive count: not the 50s) |
| **Half-Centuries** | Innings with `runs` from 50 to 99 (exclusive: a century is not also a half-century) |
| **30+ / 50+ / 100+ Scores** | Cumulative and **inclusive**: innings with `runs >= 30`, `>= 50`, `>= 100`. So 50+ includes every century, and 100+ equals Centuries. Shown as listed by the owner; the overlap is by design |
| **Fours / Sixes** | Σ over innings that recorded them |
| **Ducks** | Dismissals (not `RETIRED_OUT`) with `runs = 0` |
| **Golden Ducks** | Ducks where `balls = 1`. A duck whose `balls` is null is a duck but is not counted as golden (not provable). `TIMED_OUT` (0 balls) is a duck but never golden |
| **Boundary Percentage** | (4 x fours + 6 x sixes) / runs x 100, 1 decimal, over innings with both `fours` and `sixes` recorded. Σ runs = 0: dash |
| **Balls per Boundary** | Σ balls / Σ (fours + sixes), 1 decimal, over innings with `balls`, `fours` and `sixes` recorded. No boundaries: dash |
| **Dismissal Mode** | One count per dismissal type (caught, bowled, LBW, run out, stumped, hit wicket, caught and bowled, other: handled the ball, obstructing the field, hit the ball twice, timed out, retired out), plus a Not out count. Read from `how_out` as stored |
| **Dot Ball Percentage** | Not defined: not captured (see the table) |

### Bowling

| Term | Definition |
|---|---|
| **Innings Bowled** | A counted `bowling_entry` with `balls > 0` or `runs > 0` on an innings with a captured bowling card. A listed bowler with nothing bowled is not an innings |
| **Balls Bowled** | Σ `balls` (legal deliveries) |
| **Overs** | `oversFormat.ballsToOvers(balls, ballsPerOver)` when every counted bowling innings has the same `match_result.balls_per_over`. When they differ the API returns `overs = null` and `mixedOverLengths = true`; the UI shows Balls Bowled with "Mixed over lengths" (a sum of "overs" across 5-ball and 6-ball matches would be meaningless). The conversion is done in the UI by `oversFormat` only (frontend standard); the API carries balls |
| **Runs Conceded** | Σ `runs` (wides and no-balls charged to the bowler are in it; byes, leg byes and penalty runs are not) |
| **Wickets** | Σ `bowling_entry.wickets` as stored (never recomputed) |
| **Bowling Average** | Runs Conceded / Wickets, 2 decimals. No wickets: dash |
| **Economy Rate** | Runs Conceded / Σ (balls / ballsPerOver of that match), i.e. runs per over where an over is **that match's** number of balls, 2 decimals. For all-six-ball data this is runs x 6 / balls. No balls: dash. Intermediate overs use at least 10 decimal places; rounding happens once |
| **Strike Rate** | Balls Bowled / Wickets, 1 decimal (balls per wicket, independent of over length). No wickets: dash |
| **Best Bowling** | The innings with the most wickets; ties broken by **fewest runs**, then **most balls bowled**, then the most recent match. Shown "4/17". No bowling innings: dash |
| **Four-Wicket Hauls / Five-Wicket Hauls** | Innings with exactly 4 wickets; innings with **5 or more** wickets (so a 6-wicket innings is a five-wicket haul and not a four-wicket haul). Exclusive/inclusive choice is the common convention and is open question 3 |
| **Maiden Overs** | Σ `maidens` |
| **Wides / No-Balls** | Σ `wides`, Σ `no_balls` over innings that recorded them |
| **Dot Balls** | Σ `dots` over innings that recorded them. **Dot Ball Percentage (bowled)**, a suggestion: Σ dots / Σ balls of the same innings x 100, 1 decimal |
| **Dismissal Mode (bowler)** | Counts of batters out `BOWLED`, `CAUGHT`, `CAUGHT_AND_BOWLED`, `LBW`, `STUMPED`, `HIT_WICKET` where the dismissal's `bowler_result_player_id` is this player's row, plus `Not recorded = max(0, Wickets - Σ modes)` so the table always reconciles to Wickets |

### Fielding

Catches, Stumpings, Run-outs: Σ of the stored `fielding_entry` values over counted appearances. **Dismissals** = their sum. **Dismissals per match** = Dismissals / Matches, 2 decimals (dash when no matches). A row exists only for a fielder with at least one credit, so Matches (not rows) is the denominator.

### Awards and results

**Player of the match** = count of the official award; **Team player of the match** = count of the club team's own award. **Record while playing** = for each counted match (not a derby): won if `outcome_type = WON` and `winning_side` is the player's `side`, lost if `WON` and the other side, tied for `TIE`, drawn for `DRAW`. A match between two of the club's own teams is counted under **Internal matches** and gives no win or loss to the player (`100`'s per-team rule would give one team each, which says nothing about a player on both or either side).

### Form and positions

**Recent form**: the five most recent batting innings (by `match.match_date`, newest first: runs, star if not out, balls if known) and the five most recent bowling innings (wickets/runs, overs). **Innings by batting position**: per `batting_entry.position` the innings, runs and average (a position with no dismissals shows a dash).

## Filters and scope

All filters narrow the **appearances** (and so every figure) and are applied in the query, never in the browser.

| Filter | Query parameter | Source | Notes |
|---|---|---|---|
| Career (default) | none | whole club history | "All time, within this club" |
| Season | `seasonId` | `match.season_id` (required on a match, `029`) | Existing `FilterBar` Season, with "All seasons" |
| League | `leagueId` | `match.league_id` (optional) | Existing League filter |
| Team | `teamId` | the row's side: `(match.home_team_id = :teamId AND rp.side = 'HOME') OR (match.away_team_id = :teamId AND rp.side = 'AWAY')` | The player's games **for that club team**. In a derby, only the row on that team's side counts |
| Competition type | `competition` = `LEAGUE` or `FRIENDLY` | `match.league_id IS NOT NULL` is a league match; `NULL` is a friendly (`029`: "a standalone friendly with no League") | Supported cleanly. A finer **format** split (T20, T50...) is **not** supported: `League.format` is an optional descriptive tag with no cross-check (`053`), so it cannot be relied on; deferred |
| Section | none | | Not offered: the owner asked for Season, League, Team; a section is reachable through Team |

**Verified club statistics only.** The response `scope` is always `CLUB_VERIFIED`. The roadmap's "Player-recorded games" will add an `ALL` scope shown side by side and labelled unverified, never blended silently; nothing here blocks that.

## Architecture proposal (a decision for the owner)

**Proposal: compute on read, no materialised table.** Flagged as a proposal (open question 10).

| | Compute on read (proposed) | Materialised table, refreshed on publish and unpublish |
|---|---|---|
| Data volume | One player has a few hundred scorecard rows over a career, a club tens of thousands over many years; every query starts from `ix_result_player_profile`, so reading one player is a few indexed lookups | Faster reads, but the volume does not call for it |
| Edited after publish | A link of a guest to a player, an unpublish, a delete of a result, a player merge all change the answer; computed on read, they are correct by construction | Each of these must trigger a refresh. A missed trigger shows a wrong number silently, the exact "stats go stale" risk `100`'s Statistics decision avoided |
| Definitions | One place: the pure calculator over fact rows | Definitions would also have to live in the refresh SQL, or the calculator would run in a job |
| Standards | One service skeleton, `@Transactional(readOnly = true)`, DTO out; no job, no new table, no migration | New table, entity, refresher, backfill, migration and tests |
| Cost of being wrong | Revisit when a measured, seeded run of a 200,000-row club exceeds a budget (propose 300 ms p95 for one player, as a plan-time check); then add a disposable cache table rebuilt per player on publish, unpublish, link and merge (as `100` allowed) | Same, but paid up front |

**Shape of the read** (so the definitions stay in one place):
1. `PlayerStatsRepository` (a new repository, touched only by `PlayerStatsServiceImpl`; ArchUnit rule to add) runs a small number of JPQL or native **fact-row queries** for one `playerId` in one club with the filters above: appearances (one row per `result_player`: match id, side, outcome, winning side, `balls_per_over`, date, plus `EXISTS` flags for "batting card captured" and "bowling card captured"), batting facts (one row per `batting_entry`), bowling facts, fielding facts, dismissals credited to this bowler, awards. All of them include the fixed predicates of "What counts".
2. `PlayerStatsCalculator` (pure, `service.support`, no Spring, no repository) folds the fact rows into the DTO's counters and derived fields. The service only loads facts, calls the calculator and maps to the DTO (MapStruct for the plain parts, per `backend.md`).
3. **No pagination:** the result is one player's rows, bounded by their career (an exception in the manner of the Players roster, which `frontend.md` calls "an unpaginated, bounded list"). A defensive cap (propose 20,000 fact rows per query, a 400 `ProblemDetail` above it) protects the server.
4. **The publish gate.** `backend.md` says only the result services touch `MatchResultRepository`, and `ResultVisibility` is a `Specification<MatchResult>`, which a join query cannot use. The stats queries therefore contain the fixed predicate `status = PUBLISHED` (a named constant shared with `ResultVisibility`, not a re-typed string) and a **test that a draft and an unpublished result never appear**. `backend.md`'s sentence must be amended in the same PR to name `PlayerStatsRepository` as the second permitted reader and its ArchUnit rule (see Rollout Notes).

A later leaderboard reuses step 2 over one club-wide stream of fact rows grouped by player in memory (a club's rows are small), so no definition is ever duplicated in SQL.

## API Contract

Base `/api/v1/manage/clubs/{clubId}`; `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")` like the other player routes (any club manager). One controller, `PlayerStatsController`; `PlayerStatsService` interface plus `PlayerStatsServiceImpl` with `@Transactional(readOnly = true)`; DTOs only (`backend.md`). A wrong-club or unknown player is 404 (`NotFoundException`).

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /players/{playerId}/stats?seasonId=&leagueId=&teamId=&competition=` | club manager (`canAccessClub`) | One player's statistics from published results, with the filters of "Filters and scope". Every parameter optional; no parameters is career. An unknown `seasonId`, `leagueId` or `teamId` for this club is 404; `competition` other than `LEAGUE` / `FRIENDLY` is 400 (`ValidationException`). A player with no counted appearance returns 200 with zero counters and `basis.matchesCounted = 0` (not 404), so the empty state is a normal read |

**Response (`PlayerStatsDto`):**

| Field | Content |
|---|---|
| `playerId`, `scope` | `{ kind: "CLUB_VERIFIED", seasonId, leagueId, teamId, competition }` echoing the filters |
| `basis` | `matchesCounted`, `resultsWithBattingCard`, `resultsWithBowlingCard`, `resultsWithoutTeamList` (published results for the player's teams in this scope with no team list, shown as a caution; open question 11) |
| `batting` | raw counters (`matches`, `innings`, `notOuts`, `dismissals`, `runs`, `ballsFaced`, `fours`, `sixes`, `ducks`, `goldenDucks`, `thirtyPlus`, `fiftyPlus`, `hundredPlus`, `centuries`, `halfCenturies`, `highestScore { runs, notOut }`, `dismissalModes { type: count }`, `positions[]`) and derived (`average`, `strikeRate`, `boundaryPercentage`, `ballsPerBoundary`), nullable decimals already rounded, plus `coverage { inningsWithBalls, inningsWithBoundaries, inningsCounted }` |
| `bowling` | `inningsBowled`, `ballsBowled`, `ballsPerOver` list and `mixedOverLengths`, `runsConceded`, `wickets`, `maidens`, `wides`, `noBalls`, `dots`, `fourWicketHauls`, `fiveWicketHauls`, `best { wickets, runs }`, `dismissalModes { type: count, notRecorded }`, derived `average`, `economy`, `strikeRate`, `dotBallPercentage`, and `coverage { inningsWithWides, inningsWithNoBalls, inningsWithDots, inningsCounted }` |
| `fielding` | `catches`, `stumpings`, `runOuts`, `dismissals`, `dismissalsPerMatch` |
| `awards`, `record` | `playerOfTheMatch`, `teamPlayerOfTheMatch`; `won`, `lost`, `tied`, `drawn`, `internal` |
| `form` | `batting[]` and `bowling[]`, up to five each, newest first, with the match id and date |
| `notCaptured` | the fixed catalogue of statistics the data does not support, each `{ code, label, reason }` (batting dot ball percentage, boundaries conceded, wicketkeeper dismissals, partnerships and fall of wickets, catches dropped, direct hits); one list in the calculator so removing an item when capture lands is a one-line change |

The frontend never recomputes any figure (`frontend.md`: "No business rules in the client"); it formats (`oversFormat` for overs, a dash for `null`).

**Not in Part 1:** a list or leaderboard endpoint (`GET /players/stats`); deferred with a justification in Non-goals and open question 4. `openapi.yaml` is regenerated by hand per the repo's practice, additions only. New exceptions: none beyond the existing 404 and 400.

**Who may read it.** Any manager who passes `canAccessClub` (the same as the Player page). A section-scoped manager (`035`) passes that gate and would see a player's club-wide figures, which include games for teams outside their sections; whether to narrow to the manager's sections (as `101`'s name suggestions do) is open question 5. **Players cannot read their own statistics in Part 1**: there is no player login flow yet (open question 6). **Draft visibility:** statistics read published results only, by the fixed predicate and the test above; a draft is never read, counted or even detected.

## UI Requirements

Mobile-first at 375 px, MUI v5 through existing components only (`docs/standards/design-system.md`, `frontend.md`). Per the repo's rule, a mockup of each new surface, on a phone and a desktop, is approved before the build (open question 1).

### The Stats card on the Player page (replaces the placeholder)

`PlayerDetailPage` currently renders `<InfoCard title="Stats" note="More coming soon" fields=[Games this season, Games overall, Runs (dash), Wickets (dash)]>`. It becomes the same `InfoCard` with **six headline figures** (career, no filters): **Matches**, **Runs**, **Batting average**, **Strike rate**, **Wickets**, **Economy**, each a dash where the calculator returns `null` or there is no data, and **no "coming soon" note**. A real, outlined, 44 px **View full breakdown** button with an icon sits in the card's `actions` slot, the same slot the Contact info card uses for Call and Email (the cross-link rule: a card, an icon and an outlined button, never a bare text link) and routes to `/manage/players/:playerId/stats`. The card is fed by `GET .../stats` with no filters (a React Query read in `ui/src/api/playerStatsApi.ts`, keyed under `['managed-club', clubId, 'players', playerId, 'stats', ...]`). While loading it shows the card's usual skeleton; on a failure it shows the figures as dashes with a quiet retry, never an error page for a card. The key figures strip (`PlayerKeyFigures`, selection-based Games) is untouched (open question 9).

### The full breakdown page (`/manage/players/:playerId/stats`)

A manager page that follows the record-detail standard (`PageHeaderBand` with Back, the player's name and the status chip as on the Player page, no Edit button here), in this order:

1. **Tab strip** Batting, Bowling, Fielding, using `utils/viewTabs.ts` (`VIEW_TABS_PROPS`, `viewTabsSx`, `viewTabSx`) bound to `?tab=batting|bowling|fielding` (default Batting; an unknown value is Batting), each tab a router link that keeps the other parameters, the pattern of `LeagueEditTabs`.
2. **`FilterBar`** in compact density with Season (with "All seasons"), League and Team from the existing club lookups, and a **Competition** select (All competitions, League, Friendlies) through its `extraSelects`. `usePersistedListFilters('playerStats:filters:<clubId>')` saves Season and League; Team and Competition are per visit (the Matches list convention). A phone gets the shared filters sheet. Defaults: All seasons, so a first visit is career.
3. **A basis line** (an `InfoCard`-style note or the `ContentControlsLine`, whichever the mockup confirms), always visible, for example "Based on 18 published results with this player on the team list: 14 with a batting card, 12 with a bowling card." and, when `resultsWithoutTeamList > 0`, "7 published results for this player's teams have no team list, so they are not counted." Where a figure is partial a quiet caption sits under it ("from 9 of 14 innings that recorded balls", from `coverage`).
4. **Headline `KeyFigureTile` strip** (2-up on a phone, 4-up on desktop), per tab. Batting: Runs, Batting average, Strike rate, Highest score. Bowling: Wickets, Bowling average, Economy rate, Best bowling. Fielding: Catches, Stumpings, Run-outs, Dismissals per match. (`PageCounters` is a quick-filter component and is not used for plain display.)
5. **Detail** as equal-height `InfoCard`s with `fields` rows (label and value), in two columns from `md`: Batting has **Scoring** (Matches, Innings, Not outs, Runs, Highest score, Average, Balls faced, Strike rate, Fours, Sixes, Boundary percentage, Balls per boundary), **Milestones** (30+, 50+, 100+, Half-centuries, Centuries, Ducks, Golden ducks), **How dismissed** (one row per dismissal type with a count, Not out last), **Innings by batting position** and **Recent form**. Bowling has **Bowling** (Matches, Innings bowled, Overs, Balls bowled, Runs conceded, Wickets, Average, Economy, Strike rate, Best bowling, Maidens, Four- and five-wicket hauls, Wides, No-balls, Dot balls and Dot ball percentage), **Wickets by type** (the modes, with "Not recorded") and **Recent form**. Fielding has the three counts and the total, then **Awards** and **Record while playing** (on the Fielding tab or as an Overview card: the mockup decides). Counts are plain integers, averages and rates to the stated decimals, `null` is a dash.
6. **Flagged missing statistics: a single "Not captured yet" panel at the bottom of each tab, not dash tiles.** The panel (an `InfoCard`) lists the missing statistics for that tab by name with the reason in one line ("Dot ball percentage: the scorecard does not record dot balls faced"), driven by the response's `notCaptured`. **Recommendation, with its reason:** a tile showing a dash with a note on every missing statistic fills a phone screen with empty boxes and invites the question "why zero?"; a short list is honest, still shows the owner exactly what is not supported yet, and shrinks by itself as capture arrives. Statistics that are available but **partial** (balls, fours, sixes, wides, dots) stay in their normal place with a coverage caption. This choice is open question 12 (the owner may prefer dash tiles).
7. **Empty states** through `EmptyState`: a player with no published results at all: "No published results yet. Statistics appear here once a published result has this player on its team list." (with a quiet pointer to the Results page); filters that match nothing: "No published results match these filters." with a **Clear filters** action; a player with appearances but no batting card yet: the Batting tab shows Matches and a note "No batting card has been captured for these results", never zeros.

Hooks, data and API live in `ui/src/api/playerStatsApi.ts` and a `usePlayerStats` hook; page-level parts in `ui/src/pages/manage/playerStats/` (not reusable components, no four-file anatomy needed). **No new shared component is proposed**; if a mockup needs one (for example a stat table), it follows the four-file anatomy, a story and a test. Names are shown in full (manager screens; see Privacy).

**Mockups needed (not built here):** (1) the Player page with the live Stats card on a phone and a desktop, including loading, empty and error states; (2) the breakdown page Batting tab on a phone and a desktop with the filter sheet open; (3) the Bowling tab; (4) the Fielding tab with awards and record; (5) the empty and partial-data states (no published results; appearances without a card; a coverage caption); (6) the "Not captured yet" panel (versus dash tiles) for the owner to choose.

## Privacy and data quality

- **Privacy.** Part 1 is manager-only: no public player pages, no player login, no share output. Manager screens already show full names (`101`). Many players are children, so **any later public or shared statistic must use `114`'s First names as initials rule (`utils/share/shareName.ts`) and its junior lock**, which does not apply inside the manager screens. A leaderboard of children is a separate decision (open question 4).
- **Draft results are excluded**, unpublished results disappear at once.
- **Imported results with guessed names are excluded until confirmed**, because publishing is blocked while any row carries `IMPORTED_NAME_UNCONFIRMED` (`104`); the `import_match IS NULL` predicate is only a belt-and-braces guard.
- **Guests and opposition names never count** until a guest is linked.
- **Summary-level results** (no scorecard) give no player rows, so figures are only as complete as the scorecards captured. The basis line says so on every view.
- **Partial scorecards** (balls, fours, sixes, wides, no-balls, dots left blank; a bowler's dismissals not attributed) are reported through `coverage` and "Not recorded", never silently treated as zero.
- **Overs of different lengths** are handled by `balls_per_over` per match (economy) and the mixed-length rule (overs).
- **Super-overs** are excluded (no entries exist; the filter is defensive).
- **Two "games" numbers.** The Player page key figures count selections; the Stats card counts matches played from published results. They answer different questions and can differ; the card labels its figure "Matches" with the basis line on the full page (open question 9).

## Suggested additional statistics

### (a) Available or derivable now (proposed in Part 1 unless noted)

| Suggestion | Where | Status in this spec |
|---|---|---|
| Recent form (last five innings, last five bowling figures) | Batting and Bowling tabs | **Proposed in** (cheap, managers ask for it) |
| Innings by batting position (innings, runs, average) | Batting tab | **Proposed in** (the data exists for the roadmap's rotation item) |
| Dot ball percentage bowled (dots / balls) | Bowling tab | **Proposed in** (follows from the owner's Dot Balls) |
| Fielding: total dismissals and per match | Fielding tab | **Proposed in** |
| Player of the match and team player of the match counts | Fielding or overview card | **Proposed in** |
| Team results while the player played (won, lost, tied, drawn, internal) | same | **Proposed in** |
| Not-out percentage, average runs per match, boundary runs, wickets per match, extras per over | none | **Not proposed:** each is a rewording of figures already shown; padding |
| All-rounder performances (for example 30 runs and 2 wickets in one match) | none | **Deferred:** needs format-aware thresholds (as standouts, `101`); a fixed club-wide number would be wrong for juniors |
| Wicketkeeper dismissals | none | **Not available** (see MISSING table), deferred |

### (b) Not capturable today (needs new capture, deferred)

| Statistic | Capture change needed | Roadmap suggestion |
|---|---|---|
| Dot balls faced (and batting dot ball percentage) | `batting_entry.dots` (one optional number per batter, the model `bowling_entry.dots` already follows) or ball by ball; scorecard step, validator (`dots <= balls`) and adaptors | **Deferred by 103** |
| Boundaries conceded per bowler | `bowling_entry.fours_conceded`, `sixes_conceded` (optional, each at most `runs`) or ball by ball | **Deferred by 103** |
| Partnerships and fall of wickets | A fall-of-wickets capture (score, batter, over at each wicket); STUMPS and CricClubs adaptors read it today and drop it (`107`, `108`); this also unblocks Part 2's partnerships | **Deferred by 103** (shared with `114`'s deferral) |
| Wicketkeeper dismissals, matches as wicketkeeper or captain | The roadmap's captain and wicketkeeper markers on the result (taken from the selection, `match_side.captain_player_id`, `wicket_keeper_player_id`); the selection is the plan, not the day | **Deferred by 103** (links to `101`'s deferred markers) |
| Catches dropped, direct hits, run-out assists | New fielding counters; low value for clubs, not requested | **Deferred**, only if the owner asks |
| Bowling spells, over-by-over, phase economy, wagon wheel | Ball-by-ball capture; this is not a scoring app (`100`) | **Deferred**, probably never in this product |

## Test Plan

Per `docs/standards/testing.md`. The calculator tier carries the bulk, in the same PR as the service.

**Backend unit (JUnit 5, no Spring), `PlayerStatsCalculatorTest`:** one case per definition above with its boundary cases: innings excludes `DID_NOT_BAT`; not out includes `RETIRED_NOT_OUT`; `RETIRED_OUT` is a dismissal but not a duck; `Innings = Dismissals + Not outs`; average with zero dismissals is null (never infinity); highest score star and the 50 versus 50* tie; 99, 100, 49, 50, 29, 30 boundaries for half-century, century and the 30+/50+/100+ counters (50+ includes centuries; 100+ equals Centuries); duck, golden duck (`balls = 1`), duck with unknown balls not golden, timed out never golden; strike rate only over innings with balls (runs without balls do not inflate it), and the `balls = 0, runs > 0` case treated as unrecorded; boundary percentage and balls per boundary with partial coverage; dismissal mode counts including "other"; bowling average, strike rate and economy with zero wickets and zero balls (null); economy with **unequal balls per over** (a 5-ball and a 6-ball match in one scope; hand-computed expectation) and rounding at .005 (half up, once at the end); overs null with `mixedOverLengths` when over lengths differ; best bowling ties (fewer runs, then more balls, then most recent); four-wicket (exactly 4) versus five-wicket (5 or more, including 6); stored effective wickets used as given for `DERIVED` and `MANUAL` rows; maidens, wides, no-balls and dots coverage; dismissal modes by bowler with "Not recorded"; fielding totals and per-match denominator; awards; record while playing including a derby counted as internal; recent form ordering; positions; **a derby player on both sides counts one match** and both sides' rows count in full; **a substitute row, an opposition row and a guest row are never counted** (the fact rows the repository would never return are also covered at the integration tier); an innings with no batting card does not make a player "did not bat"; a summary-level result adds nothing.

**Backend integration (Testcontainers, `AbstractIntegrationTest`), `PlayerStatsRepositoryIntegrationTest` and the service without an ambient transaction (`open-in-view=false`):** a seeded club with published and **draft** results (the draft never appears), a result **unpublished later** (disappears), a guest **linked after publishing** (their rows appear on the next read), two seasons and two leagues plus a friendly (every filter), a derby, a forfeit, an abandoned and a no-result match carrying a team list (never an appearance), an opposition row and a substitute row (excluded), a result with a team list but no cards, a summary-level result, a super-over innings row (excluded by `kind`), another club's player and results (tenancy: 404 and never counted), and the index use at build time (an `EXPLAIN` on a seeded 200,000-row set, recorded in the PR, to confirm no new index is needed).

**Controller (tenancy and access):** `canAccessClub` required (403 otherwise), a player of another club is 404, an unknown season, league or team of this club is 404, a bad `competition` is 400, a player with no appearances returns 200 with zero counters, the response never changes when only a draft exists. Section-narrowing tests are added if open question 5 resolves to narrowing.

**Structural (ArchUnit):** `PlayerStatsRepository` is touched only by `PlayerStatsServiceImpl`; `PlayerStatsCalculator` depends on no Spring, repository or entity class; the `LayeringRulesTest` sentence about `MatchResultRepository` is updated, and the rule is proven non-vacuous by a deliberate break once (as for earlier rules).

**Contract:** OpenAPI diff, additions only (the route, `PlayerStatsDto` and its parts).

**Frontend component (Vitest + Testing Library, stories for any new shared component):** the Stats card (six figures, dashes for null, the View full breakdown button is a real button and links to the page, loading and error states, no "coming soon" text); the breakdown page (tabs bound to `?tab=`, filters sent as parameters, persisted Season and League, Team and Competition per visit, the basis line, coverage captions, the "Not captured yet" panel driven by `notCaptured`, mixed over lengths showing Balls Bowled, a dismissal table ending in Not out, empty states: no results, filters match nothing with Clear filters, appearances without a card); `PlayerDetailPage.test.tsx` is updated (its Stats card assertions, near lines 138 and 270, change). A new shared component, if any, gets its story and test.

**End-to-end (Playwright, mobile and desktop), one golden path:** a published result with a scorecard exists for a player; open the Player page, see the headline figures, press View full breakdown, change the Season filter, see the Batting then Bowling tab, and see the basis line. Per the working rule, tests and the standards review run **after** the owner has browser-checked the function.

## Acceptance Criteria

- A manager can open a player and see headline figures (Matches, Runs, Batting average, Strike rate, Wickets, Economy) on the Stats card, with dashes where a figure has no valid denominator, and a real **View full breakdown** button.
- The full breakdown has Batting, Bowling and Fielding tabs and shows every statistic marked Available or Derivable in the Data availability tables, with the exact names and descriptions the owner gave.
- Every statistic marked MISSING (batting dot ball percentage, boundaries conceded) is **not** shown as a number; it is listed under "Not captured yet" with its reason, together with the other not-captured items, and the list is driven by one catalogue in the calculator.
- Only **published** results of **this club** with outcome won, tie or draw count; a draft, an unpublished result, a forfeit, an abandoned and a no-result match never contribute (integration tested).
- Only counted appearances count: our registered, non-substitute rows; guests, opposition rows and unconfirmed import guesses never do. A guest linked after publishing counts from the next read. A player on both sides of a derby counts one match.
- All figures come from `PlayerStatsCalculator`; the client only formats. Every definition in "Precise definitions" has a unit test, including: average is a dash with no dismissals; 50+ includes centuries; Centuries and Half-centuries are exclusive; a golden duck needs `balls = 1`; `RETIRED_NOT_OUT` is not a dismissal and `RETIRED_OUT` is; economy uses each match's own balls per over; mixed over lengths show Balls Bowled instead of Overs; best bowling ties break as defined; stored effective wickets and credits are never recomputed.
- Optional figures (balls, fours, sixes, wides, no-balls, dots, dismissal bowler) are computed only over innings that recorded them, and a coverage caption says how many; a missing figure is never treated as 0.
- An innings with no captured card never makes a player look as if they did not bat or bowl; a summary-level result adds nothing.
- Season, League, Team and Competition (league or friendly) filter the figures through backend parameters; Season and League persist per club, Team and Competition per visit; the default is career.
- The page always shows the basis ("Based on N published results ... N with a batting card, N with a bowling card"), and a player with no published results sees an explanatory empty state, not zeros.
- The endpoint is guarded by `canAccessClub`; another club's player is 404; the response is a DTO; the service is `@Transactional(readOnly = true)`; no entity crosses the controller boundary.
- No migration and no new table; no new dependency; the OpenAPI changes are additive.
- `backend.md`, `frontend.md`, `docs/roadmap.md` and `docs/architecture.md` are updated in the build PR (see Rollout Notes).
- Team statistics, leaderboards, cross-club statistics, public pages and own-record scopes are **not** present.

## Rollout Notes

- **Order of work:** (1) approve mockups; (2) `PlayerStatsCalculator` and its unit tests (the bulk of the work, no database); (3) `PlayerStatsRepository` fact queries with the integration tests; (4) service, controller, DTOs, OpenAPI; (5) the Stats card on the Player page; (6) the breakdown page, filters, empty states; (7) tests, the standards review and the PR, after the owner's browser check.
- **No feature flag.** A club with no scorecards simply shows an empty state; nothing existing changes except the Stats card's contents.
- **Migration: none.** Indexes already present cover the queries: `ix_result_player_profile` (partial, `player_profile_id IS NOT NULL`), `ix_result_player_result`, `ux_batting_entry_player` and `ix_batting_entry_result_player`, `ix_bowling_entry_result_player`, `ix_fielding_entry_result_player`, `ix_batting_entry_bowler` (partial, `bowler_result_player_id`), `ix_match_result_club_status`, the unique `match_result(match_id)`, `ux_match_innings_sequence (match_result_id, sequence)`, `ix_match_season`, `ix_match_league`, `ix_match_home_team`, `ix_match_away_team`. The plan confirms with an `EXPLAIN` on a seeded 200,000-row dataset; a new index is added by a migration only if that shows a scan (candidates: `match_award(result_player_id)`, not verified to exist; `match_innings(match_result_id, kind)`).
- **Docs to update with the build:** `docs/roadmap.md` (Active row 103, "Deferred by 103", and the Stats-card item near the end of the roadmap, which this spec resolves; `114`'s "Stats lines after 103" becomes buildable); `docs/standards/backend.md` (a "Statistics (spec 103)" section: computed on read from published results, the calculator is the only place a figure is defined, `PlayerStatsRepository` is the second permitted reader of results with the fixed published predicate and its ArchUnit rule, stored effective credits are never recomputed, guests and opposition never count); `docs/standards/frontend.md` (a "Player statistics" paragraph: route, `?tab=`, persisted key `playerStats:filters:<clubId>`, "no figure is computed in the client"); `docs/architecture.md` (statistics read model over Match, MatchResult, ResultPlayer and the entries); a pointer in `docs/specs/060-player-detail-redesign.md` (the placeholder is replaced).
- The roadmap row and the "Deferred by 103" list below are added to `docs/roadmap.md` when this spec is merged.

### Deferred by `103`

- **Part 2: Team statistics** (the owner's team list above), from `match_result` and `match_innings`, with the Net Run Rate rule per competition and Partnerships blocked on fall-of-wickets capture.
- **Leaderboards and rankings** (qualification minimums, ties, children), reusing the calculator.
- **Capture changes** (each its own scorecard spec): batter dots (`batting_entry.dots`), per-bowler boundaries conceded, fall of wickets and partnerships, wicketkeeper and captain markers on the result.
- **Format-aware milestones and all-round performances** (relative thresholds, with the standout work).
- **A finer competition split by league format** (`League.format` is an optional tag today).
- **A player's own view of their statistics**, with the player login flow.
- **Player-recorded games (own records)** as a second `scope`, shown side by side and labelled unverified.
- **Cross-club career statistics**, with the person-linking spec and consent.
- **Public or shared statistics lines**, through `114`'s initials rule and junior lock.
- **Section narrowing of statistics for section-scoped managers**, if the owner wants it (open question 5).
- **Materialised statistics**, only if the measured budget is exceeded.
- **Super-over statistics**, with `105`.

### Open questions for the product owner

1. **Mockups first:** approve the six mockups listed in UI Requirements (card, Batting, Bowling, Fielding, empty and partial states, "Not captured yet") before the build?
2. **Aggregation key:** statistics group by the club's player profile (one per person per club). Agree, with cross-club combined statistics left until the person-linking flow exists?
3. **Defaults I chose that you may want to change:** (a) `RETIRED_OUT` is a dismissal (counts in the average) but is not a duck; `RETIRED_NOT_OUT` is a not out and not a dismissal; (b) four-wicket hauls are exactly 4 and five-wicket hauls are 5 or more; (c) Highest Score on a tie prefers the not-out innings; (d) a substitute's innings and catches are not credited (open question 8); (e) 100+ Scores equals Centuries and is shown twice because you listed both.
4. **Leaderboards in Part 1 or later?** Recommended later: they need a minimum-innings rule, tie rules and a decision about ranking children. If now, which lists (top runs, top wickets) and what qualification?
5. **Section-scoped managers:** a manager restricted to one section can open any player they can see; the figures include games for teams outside their sections. Narrow to their sections, or leave club-wide as the Player page's games count is?
6. **Players seeing their own statistics:** not possible until the player login flow; confirm manager-only for Part 1.
7. **A "no result" or abandoned match with play** (innings were batted before rain): today it counts for nothing, following `101`'s appearance rule. Should runs and wickets from such a match count, with the match itself not counted as played?
8. **A substitute fielder's catch:** credited to no one today (`101`: a substitute is not a match played). Credit the catch to the substitute if they are a linked player, or keep as is?
9. **Two "games" numbers:** the key figures strip counts selections ("Games this season / overall"); the Stats card counts matches from published results. Leave the strip alone, or switch it to results once clubs capture results (and relabel it "Selected")?
10. **Compute on read (proposed) or a materialised table:** confirm compute on read, revisited only if a measured run of a large club is slow.
11. **The "results without a team list" caution** ("7 published results for this player's teams have no team list") can overstate for a player who joined mid-season. Keep it as a caution, or show only the counted results?
12. **How to show statistics that are not captured:** a single "Not captured yet" panel (recommended) or a dash tile for each (dot ball percentage, boundaries conceded)?
13. **Which suggested statistics to keep in Part 1:** recent form, innings by batting position, dot ball percentage bowled, fielding dismissals per match, awards and team results are proposed in; strike any you do not want.
14. **Super-overs:** until `105` decides, they never count. Confirm.
15. **Filters:** is Season, League, Team and Competition (league or friendly) enough for Part 1, with a format split and a Section filter left out?
