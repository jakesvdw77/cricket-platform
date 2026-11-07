# 147 Not captured: the catalogue of figures the scorecard cannot yet provide

**Status:** reference document for `147-player-hub-stats.md` (Amendment 2, item 11, 2026-11-07). It replaces the "Not captured yet" panel that used to close the Player Stats, Team Stats and Leaderboards pages. A doc, not a page element.

The API still sends `payload.notCaptured` (`{ code, label, reason }` items, one catalogue in the calculator, `103`); the Hub types keep the field, and the pages simply no longer draw it. A card whose data is only partly captured stays on the page and is tinted with a "Some data missing" cue (Amendment 2, item 8). A figure listed here has no card at all until its data exists.

Results capture does not change for now (`103`, decision 3 and the Non-goals: decided 2026-10-18). Every row below waits for a named, future **scorecard capture** spec, unless a row says otherwise.

## The catalogue

| Figure | Why the scorecard cannot give it today | What it needs first |
|---|---|---|
| Worm chart and run rate by phase (powerplay, middle, death) | No ball-by-ball or per-over data | Ball-by-ball or per-over capture (a scorer app or a per-over entry step); `103` Deferred "scorecard capture" spec |
| Partnerships (runs by wicket), fall of wickets | Neither is stored; the STUMPS and CricClubs adaptors read the fall of wickets today and drop it (`107`, `108`) | A fall-of-wickets and partnership capture (both batters and runs at each wicket); also unblocks team Partnerships (`103` Part 2) |
| Wagon wheel and scoring zones | No shot direction | Shot direction per scoring shot; ball-by-ball capture |
| Boundaries conceded (bowler) | `bowling_entry` has no fours or sixes conceded; a batter's fours and sixes belong to the whole side, not to a bowler (`103` MISSING row 17) | Per-bowler `fours_conceded` and `sixes_conceded` on `bowling_entry`, or ball-by-ball |
| Batter dot-ball percentage | No per-ball data; `batting_entry` holds runs, balls, fours and sixes only (`103` MISSING row 19) | A `batting_entry.dots` column (as `bowling_entry.dots` was added in `045`), or ball-by-ball |
| Wicketkeeper dismissals (caught behind) | No wicketkeeper marker per match (`101` dropped it, decision 2026-10-14). `match_side.wicket_keeper_player_id` (migration `021`) is the planned selection, not who kept on the day; stumpings are keeper-only but catches cannot be separated | A wicketkeeper marker per match on the scorecard |
| Dropped catches, direct hits, run-out assists | Not captured (`101` Non-goals); a run-out records one fielder only | Capture of those events per fielder |
| League position and points table | `122` and `123` left standings out | A points-table read for the league, then a Team stats card |
| Percentile rankings | A product decision, not data: Open question 4 of `147`, age handling, and the club switch | The Open question 4 decision |
| Share a card as an image | Not a data gap | A new spec obeying the rule in `147` UI section 7 (first name, own figures only, `shareName`, junior lock) |

Also held back, though the data exists: the **Player of the match awards** card (`awards` exist; a card file only, held back from this set by the owner's list).

## Keeping it current

When a capture spec lands, delete the row here, add the card (one file plus one registry line, `147` section 3) and shrink the calculator's `notCaptured` catalogue in the same change.
