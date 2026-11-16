# 153: Printable Team Sheet (blank or for a match)

**Depends on:** `031-jersey-numbers.md` (the squad shirt number), `057-team-extended-profile.md` (team captain), `095-league-edit-gold-standard.md` and `151-server-test-round-one.md` slice D (league Share), `114-share-result.md` (the shared name form), `150-managers-and-access-grants.md` (permissions), `docs/standards/page-anatomy.md`.
**Status:** built 2026-11-15 (awaiting the owner's print test). Requested by the owner: the tournament has no printing facilities once the side is chosen, so every sheet is printed beforehand. Mockup: `docs/mockups/team-sheet-mockup.html` (blank sheet and match sheet side by side). Decisions made by the owner 2026-11-15 are marked **Decided**.

## Problem & Goals
A team sheet is a paper the captain fills in and hands over before a match. There is no way to print one. The squad is known days before the tournament, the round-robin fixtures (opposition, date, time, venue) are in the system, but the final side is not, so the sheet must list the **whole squad** and leave the choices to be made by hand.

**Goals**
- Print a **blank** team sheet for a team, and a **match** team sheet for a chosen match with the match details filled in.
- Print **every round-robin match of our team in one PDF** (one page per match), so a whole tournament is printed in one go.
- Nothing is stored. Nothing changes in selection. The sheet is a view of the squad and the fixture.

## Non-goals
- A batting order or a selected XI on paper (the sheet is alphabetical and unselected; picking the XI stays in Team Selection).
- The opposing team's sheet (the opposition's squad is not in the system).
- Scoring, signatures stored in the system, or a digital hand-in.

## The sheet (A4 portrait, one team per page)
1. **Header:** league logo (left), the team's logo (right), the word "Team Sheet", the team name in large letters, section and season beneath. A league icon is shown only for a match sheet and for a blank sheet when a league is chosen; with no league the corner stays empty.
2. **Match line** (two rows of write-on boxes): League, Opposition, Date, Start time; Venue, Overs. **Toss won by** and **Elected to** are optional (the sheet is handed in before the game): a switch on the print screen, **Toss And Elected Boxes**, off by default. When they are off, Venue takes their room and is three columns wide. Decided by the owner 2026-11-15. A **match sheet** fills League, Opposition, Date, Start time, Venue and Overs from the match; the toss boxes, when on, are always empty. A **blank sheet** leaves every box empty.
3. **Table:** columns **Playing** (empty tick box), **Shirt**, **First name**, **Surname**, **Capt** (empty tick box), **Keeper** (empty tick box). **Every player in the team's squad for the season is listed**, sorted by surname then first name (case and accents ignored), so no batting order is implied. A shirt number is the squad number, then the player's standing number, else blank. **Capt and Keeper tick columns are optional** (switch **Capt And Keeper Tick Boxes**, on by default). When off, the two columns go, the name columns widen, and **Captain** and **Wicketkeeper** become write-on boxes beside Venue (a third row when the toss boxes are on too); Pre-Mark fills them with the team's captain and wicketkeeper names. Two empty lines at the end for a late or guest player; optional, a switch on the print screen (**Two Lines For Late Or Guest Players**, on by default). At most 20 squad rows fit on the page; a larger squad flows onto a second page with the header repeated.
4. **Footer:** Captain's signature and Umpire's signature lines.
5. **Pre-marking. Decided:** Playing, Captain and Keeper are **empty by default**. A switch on the print screen, **Pre-Mark Captain And Keepers**, fills the Capt box for the team's saved captain and the Keeper box for each player flagged as a wicketkeeper. Playing is never pre-marked.
6. **Names. Decided:** full names always, including junior teams (the owner takes responsibility for printing a junior sheet). This is the one deliberate exception to the initials rule of spec 114; it applies to the sheet only and never to the WhatsApp, Facebook or poster formats. The print screen shows no notice about it (owner decision 2026-11-15).

## Where it starts. Decided
- **Team page:** the Manage Team menu gets **Print Team Sheet** (Share-group neighbour, before Share). It opens the print screen with a choice **Blank** or **For A Match** (a picker of the team's matches in the season, soonest first).
- **League page:** the league's Manage menu gets **Print Match Sheets**. The print screen asks which of our teams (when more than one plays in the league), shows the matches that team plays (all selected, each can be unticked), a switch for the pre-marking, and produces **one PDF with a page per match**, in date order. A league with no matches for the team says so.
- The match menu on the Matches list and the match page also gets **Print Team Sheet** (a shortcut to the single-match case).
- All entries use the same print screen (`TeamSheetDialog`), the shared share shell, and the shared compact `Button`; one filled button (**Print**), **Download PDF** secondary. A paper-style preview of the first page is shown (as for the Squad Analysis PDF).

## Permissions (spec 150)
`TEAMS_VIEW` for the team's section and `PLAYERS_VIEW`. A match sheet also needs `MATCHES_VIEW`. The buttons are hidden without them.

## Data and API
No migration, no new endpoint. The sheet reads the squad (`TeamSquadMemberDto`: names, `squadJerseyNumber`, `isCaptain`, `isWicketKeeper`), the team (name, logo, section), the league (name, logo, format) and the match (date, time, venue, opposition) that the Team, League and Match pages already load. The PDF is built in the browser with jsPDF (`ui/src/utils/share/teamSheetPdf.ts`, beside `matchPdf.ts`), reusing the logo loading in `logoLayout.ts`. Overs come from the league format (T20 = 20).

## UI Requirements
Print screen on the shared share shell: Step 1 chooses Blank or For A Match (or, from the League page, the matches); Step 2 is the PDF screen with the preview, the pre-mark switch, **Download**, **Print** (the browser print dialog on the PDF) and **Share** where the browser can. File name `Team Sheet - Irene Veterans - Midlands CC - 2026-11-19.pdf` (blank: `Team Sheet - Irene Veterans (blank).pdf`; bundle: `Team Sheets - VCASA Club Champs - Irene Veterans.pdf`). Empty state when the squad has no players, with a link to the squad.

## Test Plan
Frontend: the sort (surname, first name, accents, "Van der" and "Du" prefixes), the squad-number fallback, every squad player listed (inactive players excluded), the 20-row page break, pre-marking only when the switch is on, the blank sheet's empty match boxes, the match sheet's filled boxes and overs from the format, the bundle's one page per match in date order, hidden buttons without the permission, full names on a junior team. Pure functions for rows and pages tested as tables; the PDF function tested for page count and text content. Playwright is not needed.

## Acceptance Criteria
From the Team page I can download a blank sheet and a sheet for the Delta CC match; each lists every player of the squad alphabetically with shirt numbers and empty Playing, Capt and Keeper boxes. From the league page I can download one PDF with a page for each of Irene Veterans' round-robin matches, each showing its opposition, date, time and venue. Both open and print cleanly on A4 black and white (the header colours drop out and the tick boxes stay readable).

## Rollout Notes
Frontend only, so a deploy is an image pull. Print black-and-white check on a real printer before the tournament. Open items for later: a Poster or image format; adding the opposition's players when a league shares squads; a "Batting order" version for after selection (Team Selection already holds it); a club-level letterhead.

## Addendum 2026-11-15: Match Poster style (second template) and the league host. Draft, mockup `docs/mockups/team-sheet-poster-mockup.html`
A second **Style** on the print screen, **Poster**, beside the **Plain** sheet above. Same data and switches; the whole squad is listed and the **Playing** tick box stays. Decided by the owner: whole squad with tick boxes; the layout of the header from the example the owner was sent.
- **Header:** the **team's affiliation logo** top left; the **league's affiliation logo** (VCASA) top right (its name when it has no logo); the **league's own logo** above the league name in the centre; in the centre the **league name and year** large, then the tournament dates (first to last match of the league in the season).
- **Crests row:** our team logo, "vs", the opposition's crest (a league team's logo, else the name alone); the date and start time large beneath.
- **Table:** Playing tick box, "First SURNAME", shirt, a **W/K** column only (the wicketkeeper, from Pre-Mark; the captain is the Captain line, so there is no captain tag), optional **Players: Bat Pos and Bowl** columns (a grouped header, to write the batting position and the bowling order) and a Comment column; **Captain** (pre-filled with Pre-Mark) and **Sign** write-on lines under the table with room above them.
- **Footer band:** the club tagline, the team's sponsor logos, and **HOST** with the host's logo and name, in a fading band.
- **League host (new data, owner 2026-11-15):** the tournament host (for example Boland Veterans) is set on the **League**: two new optional fields, **Host name** and **Host logo**, in the league edit form beside the league logo. The Poster footer shows them; with none set the HOST block is left out. This needs a migration (`host_name`, `host_logo_url` on `league`, nullable), the League DTOs and requests, `openapi.yaml`, the league form and tests, so it is built as its own slice before the Poster style.
- **Blank match (owner 2026-11-15):** the Poster style also has **Blank** beside **One Match** and **All Matches**, for play-offs where the opposition, date, time and venue are unknown until the day. The header, host, sponsors and squad print as usual; the opposition crest is an empty frame, and the opposition name is a bare write-on line under the crest frame (no "Opposition" label, the whole line is for writing), and **Date**, **Time** and **Venue** are labelled write-on lines. Pre-Mark fills the Captain line and the W/K column if the owner switches it on.
- **The print screen opens on the Poster style (owner 2026-11-15); Plain is one click away.** **Built 2026-11-15, defaults chosen where the owner had not answered (change if wrong):** the vertical banner reads **TEAM SHEET**; the footer shows the team's sponsor logos (the first four); **Bat Pos And Bowl Columns** and **Comment Column** are two switches, both **on** by default (owner 2026-11-15; Pre-Mark off, Two Lines For Late Or Guest Players on); the colours are a fixed green and gold; the tournament dates are the league's saved start and end date for the season (spec 111, set on the league's season dates), falling back to our team's first to last match in the league when none is saved; no S/N column; the W/K column is text, pre-marked only with Pre-Mark. The opposition crest comes from the match's side logo (a league team's logo or the opponent's own) and is an empty frame when there is none. Code: `ui/src/utils/share/teamSheetPosterPdf.ts`, `TeamSheetPosterPreview.tsx`, the **Style** choice in `TeamSheetDialog`.

## Addendum 2026-11-15: Selected Side (Poster style). Built. Mockup `docs/mockups/team-sheet-selected-side-mockup.html`
A fourth sheet type on the print screen, **Selected Side**, available only in the Poster style (switching to Plain falls back to One Match). It prints the side saved in Team Selection for the ticked matches (`GET .../matches/{id}/sides`, no new endpoint), not the whole squad. **Decided by the owner 2026-11-15.**
- **Players:** only the selected XI plus the twelfth man last. Names and shirt numbers come from the season squad (squad number, then standing number), else from the side itself.
- **Order option:** **Batting Order** (the order set in Team Selection, a player with no position after those with one) or **Alphabetical** (surname). The twelfth man is last either way. No order number is printed; only the row order changes.
- **Table:** no Playing tick box and no empty lines (the side is chosen). Columns: Player, Shirt, **C / W/K** (C for the captain, W/K for the keeper, **12th** for the twelfth man, always shown, no Pre-Mark needed), optional Bat Pos and Bowl, optional Comment.
- **Captain line:** filled from the saved side. **Banner:** PLAYING XI, or PLAYING XII when a twelfth man is selected.
- **Matches without a saved side:** skipped (listed under the preview as "Skipped, no side selected yet"). When none of the ticked matches has a side the screen says so and links to Team Selection; the PDF is not offered.
- **Code:** `sidePlayers` in `ui/src/utils/teamSheet.ts`, `selectedSide` on `TeamSheetSpec`, the Selected Side layout in `teamSheetPosterPdf.ts` and `TeamSheetPosterPreview.tsx`, the mode and order control in `TeamSheetDialog`.

