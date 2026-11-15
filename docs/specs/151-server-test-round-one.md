# Server Test Round One: Player Roles and Squad Analysis (spec 151)

Status: draft 2026-11-14. Slice A built; slice B built after the owner approved `docs/mockups/squad-analysis-mockup.html` (2026-11-14). This spec grows as the owner's first-round findings from the live server arrive (the full list is in the owner's notes and the project memory). The first slice is the one with a deadline: the tournament starts in five days, so **slice A (player batting position and part-time bowler) and slice B (squad Analysis)** are specified and built first. Fields, league teams, the schedule poster, editing every league match and the player-section prompt follow as slices C onward and are added here before they are built.

## Slice A: Player cricket information

**Problem.** A player records a batting stance, bowling arm, bowling type and whether they keep wicket. Nothing says where they bat or whether they bowl a little. A manager cannot see the shape of a side.

**Adds** two fields on the player's Cricket information (migration `066-player-batting-position.sql`):
- `batting_position`, optional: `OPENER`, `TOP_ORDER`, `MIDDLE_ORDER`, `LOWER_ORDER`. Labels: Opener, Top Order, Middle Order, Lower Order.
- `part_time_bowler`, boolean, default false: "Part-time bowler".

**Rules.** Both are optional and never required. A player with a bowling type and `part_time_bowler` false is a **main bowler**; with `part_time_bowler` true a **part-time bowler**; with no bowling type and the flag false, not a bowler. The flag with no bowling type is allowed (a part-timer may not have recorded a style). The Cricket card on the player page and the player form show both. Both travel in `PlayerDto`, `TeamSquadMemberDto`, the create and update requests, `openapi.yaml` and `ui/src/api/playerApi.ts`. Player import (097) is unchanged: columns for these fields are a later item.

## Slice B: Squad Analysis

**Where.** The Team page title row gets a secondary **Squad Analysis** button between View Stats and Manage Team (page anatomy: one filled button, secondary buttons before it). It opens `/manage/teams/:id/analysis`, a page that Back returns from. Nothing is stored and there is no new endpoint: the page reads the team's squad for the chosen season (the squad list the Team page already loads) and computes everything in the browser.

**Page.** Header with the team and season; counters, then sections of cards. A player appears in every group that applies. Players with missing information are listed under "Information Missing" (no batting position, no batting stance, no date of birth) so the manager can fix them, never silently dropped. A pure batter is indistinguishable from a bowler whose style was never entered, so missing bowling information is not reported.

1. **Balance.** Counts: Batters, Main Bowlers, Part-Time Bowlers, All-Rounders, Wicketkeepers. A batter is a player who is not a main bowler. An all-rounder is a main bowler who bats Opener, Top Order or Middle Order. The squad size is shown beside the counts.
2. **Batting Order.** Four columns: Opener, Top Order, Middle Order, Lower Order, with the players in each, and "Not Set".
3. **Bowling.** Main bowlers grouped Pace (Fast, Fast Medium, Medium Fast), Medium, Spin (Off Break, Leg Break, Orthodox, Wrist Spin) and Other, then part-timers. Left-arm and right-arm counts. An overs check: "Main bowlers cover N of the overs in a full innings" using the league's match length when known, else a plain count.
4. **Hands.** Left-hand and right-hand batters (stance), left-arm and right-arm bowlers, for planning.
5. **Experience.** Average age and the number of juniors and seniors, from date of birth. Match counts come later from player stats.
6. **Gaps.** Plain sentences, each shown only when true: "No wicketkeeper", "No opener set", "Fewer than 5 bowling options (main and part-time)", "No spin bowler", "No left-hand batter", "Squad has fewer than 11 players", "N players have no batting position".

**Page anatomy.** Title row with Back; compact `PageCounters` for the balance figures; cards in a grid (at most three per row); no toolbar. Every button is the shared compact `Button`. Empty state when the squad has no players, with a link to the squad.

**Sharing** (added 2026-11-14 at the owner's request). The Squad Analysis page title row gets the standard outlined **Share** button (only when the squad has players). It opens the same two-step journey as the other pages: Format tiles, then the format's screen on the shared share shell. Formats: **WhatsApp** (message text, editable, sent or copied through the shared actions), **Facebook** (post text, Copy Text) and **PDF** (one A4 page: heading, figures, Things To Check, Batting Order, Bowling, Hands, Experience; Share where the browser can, Download and Print). A Poster image is not offered yet. **Names:** the shared analysis uses the shared name form of spec 114: a junior team (the section's age cap, or the section cannot be read) is always shared with first names as initials, an adult team follows the club default and the user's own switch, and two players who show as the same shortened name are flagged. Emoji is a switch on the texts. No club-level format switch exists for it yet (Share Formats settings carry only Result and League).

**Permissions** (spec 150). The page needs `TEAMS_VIEW` for the team's section and `PLAYERS_VIEW`; the button is hidden without them.

## Slice C: Fields

1. **Contact person and contact number** (both optional, 100 and 30 characters) and a **photo** on a field: migration `068`, the create and update request, the response and the platform view. The form has a "Contact and photo" section; the field page shows the contact on the Details card and the photo across the top.
2. **Street address on the card.** The field card gains an Address row (number and street) above City; "-" when none is on file.
3. **Player view.** The Hub field card shows the photo when there is one. The contact person and number are manager-only and never reach the player view.
4. **Provinces.** When the country is South Africa (the code `ZA` or the name) the Province field is a dropdown of the nine provinces, on every address form that uses the shared address fields (fields, club profile). An older free-text value that is not one of them stays selectable so nothing is lost.
5. **Duplicate Field** on the field's menu (row and page, managers). It opens the add form with everything copied (address, location, contact, photo, type, owner) and the name moved to the next letter ("Oval A" to "Oval B", "Carltonville CC (A)" to "Carltonville CC (B)", any other name gets " B"). A note says what was copied. It saves a new field, so a later change of address is made on each.

## Slice F: Our Fields on the Club Profile

Added 2026-11-14 at the owner's request. The Club Profile page gains an **Our Fields** card beside Club Details, Contacts and Sponsors: the club's home fields (name, street and town, each opening the field's page). With Matches Edit the card header has **Link A Field**, which opens a search of the whole directory (name or town, 20 results, fields already linked left out); **Add** links a field and the dialog stays open so several can be added, **Done** closes it. Each listed field has a small remove button (removing only takes it off the shortlist; matches keep the field). When nothing matches the search the dialog offers **Create New Field**. No new endpoint: it reuses the field list and the existing home-link and unlink calls.

## Slice D: Leagues and league teams

1. **Add Team** is its own filled button on the league Teams tab, left of the white Manage Teams menu; it is no longer inside the menu. Hidden without `LEAGUES_EDIT`. The chooser (Our Team, Opponent Team, Copy Teams) is unchanged.
2. **Add Another.** The opponent form gets a secondary **Save And Add Another** (add mode only): it saves, says "<name> was added. Add the next team.", and starts a fresh empty form. Adding one of our own teams keeps its dialog open after each link (the linked team leaves the list) and the close button reads **Done**.
3. **League team notes.** A `notes` column on `league_team` (migration `067`, up to 2000 characters, optional), on the create and update requests, the response and the form (multi-line "Notes"). The tile shows the first two lines; Copy Teams copies notes.
4. **Schedule poster.** A poster is a square snapshot, so when the fixtures do not all fit it is headed **Next N Matches** and the "and 12 more" line is gone. The PDF and the texts still carry the whole schedule.
5. **One team's share.** Step 1 of Share League has a **Team** picker (All Teams, our teams, league teams). The schedule and results then show only matches that team plays; the poster, PDF and text carry the team's name, and the file name includes it.
6. **Every match is actionable on the Schedule tab.** Every row, ours or not, has the kebab with **Edit Match** (Matches Edit) and **Share Match**; **Open Match** stays for our matches only. A match between two other clubs has no section, so under spec 150 only a club-wide Matches Edit holder can change it.

## Slice G: The schedule import links venues to fields

Added 2026-11-15 from the owner's second round on the live server. **Problem.** The schedule import (097) stores only the typed venue text and leaves the match's field empty (`LeagueScheduleImportHandler.matchRequest` passes a null `playingAreaId`). On the server all 20 imported matches have no field, although the fields existed before the import. A match with no field has no Get Directions, no weather and no field page in the Player Hub. Spec 099's "never auto-link" rule was written for strangers' fields and left the import with no way to link at all. The template's "known venues" list also comes from earlier matches' text, not from the Fields directory.

1. **Suggestion, never silent.** For each row the preview proposes a field from the club's own fields (home links) and the directory, shown in a **Field** column beside the typed venue. Matching ignores case, brackets, spaces and punctuation, so "Durbanville CC (A)" proposes "Durbanville CC A". Only an exact match after that clean-up is proposed; two candidates propose nothing and the row says "Pick a field".
2. **Confirm step.** The user may accept, change (a field picker) or clear each proposal, in bulk or per row, before the final confirm (imports always confirm). An unmatched venue shows a warning with **Pick Field** and **Create Field** (opens the add-field form with the name filled). Rows with no field still import, as today, with the warning.
3. **Commit.** The match is created with the chosen `playingAreaId`; the typed text stays in `venue` as the source text. Undo of a batch is unchanged. The DIFFERS check for venue compares the field, not the text, when the existing match has a field.
4. **Template.** The lookup sheet's venues and the AI help list the club's field names (and the text of earlier matches only when no field list exists).
5. **Existing data.** One reviewed update on the server links matches whose venue text matches exactly one field after the same clean-up (owner approves the preview first). No migration.

**Tests.** Unit: the clean-up and matching table (brackets, case, two candidates, merged and rejected fields skipped). Integration: preview proposes, commit saves the field, clearing leaves it empty, undo, DIFFERS by field. UI: the Field column, bulk accept, Pick Field and Create Field.

## Slice H: Time zone on the server

Added 2026-11-15. **Problem.** The backend container runs in UTC and the code reads the time of day with the server's own zone (`ServerClock`, 35 uses of `ZoneId.systemDefault()`). Instants are stored correctly, so the manager screens (which convert in the browser) show 09:30, while the Player Hub, the ticker, the poster texts, the clash check ("Irene is already playing at 7:30") and day boundaries use UTC and show 07:30. That is a two-hour error for every South African club on the live server; it never showed locally because the developer's machine is in South Africa.

1. **Fix, configuration only.** Set `TZ=Africa/Johannesburg` on the backend service in `deploy/docker-compose.prod.yml` (and the same in the dev compose files), so the server zone is the club zone the whole system already assumes (the known "club time zones" gap stays: a per-club zone is a later change).
2. **No data change.** Stored match times are instants and stay as they are.
3. **Guard.** A backend test runs the time helpers and the clash check under a UTC default zone and a South African one and asserts the same wall-clock result; a startup log line states the zone in use.
4. **Deploy.** Recreating the backend container only; the two-hour difference disappears on the next request, including emails and reminders.

## Later slices (added when written)

C Fields (built 2026-11-14, see Slice C below; contact person, contact number, address on the card, photo, South African provinces, and **Duplicate Field**: the owner's case is one venue with an A and a B field at the same location, so a duplicate copies every detail (address, location, contact, photo) and asks only for the new name, with the next letter suggested; a true venue-with-fields grouping is a larger later change). D Leagues and league teams (built 2026-11-14, see Slice D below). E Player form: section emphasised and always asked.

## Test plan

Backend: migration over existing rows keeps defaults; player create, update and read round-trip both fields; invalid batting position is a 400. Frontend: the analysis calculations as pure functions with a table of squads (empty, no keeper, all-rounders, part-timers, missing data); the page renders each group and the gap sentences; the button is hidden without the permission; the player form saves both fields.

## Open decisions for the owner

1. All-rounder rule above (main bowler who bats Opener, Top Order or Middle Order). Alternative: a separate "All-Rounder" role picker. Recommended: derive, no new field.
2. Analysis is computed in the browser from the squad, not stored. Recommended for the five-day deadline.
