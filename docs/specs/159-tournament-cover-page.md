# 159: Tournament Cover Page (third style of the printable team sheet)

**Depends on:** `153-printable-team-sheet.md` (the print screen and the Poster style), `154-team-affiliation-and-league-host.md` (affiliation and host), `158-main-sponsor.md` (sponsor order).
**Status:** built 2026-11-17, awaiting the owner's print test. Requested by the owner for the Club Champs: a cover sheet put on top of a team's printed match sheets. Mockup: `docs/mockups/tournament-cover-page-mockup.html`. Decisions made by the owner on 2026-11-17 are marked **Decided**.

## Problem & Goals
The team's printed match sheets need a front page that names the tournament and the team. It must come out of the same print screen as the other sheets, with its options as switches, not a separate tool. **Decided.**

## Non-goals
Nothing is stored; no new data, endpoint or migration. No match list on the cover (the sheets behind it carry the matches). Frontend only.

## The page (A4 portrait, one per team and tournament)
Everything coloured sits at least 7 mm inside the paper edge (printers cannot reach the outer 5 to 6 mm).
1. **Top corners:** the league's affiliation logo (name when it has no logo) top left; our club logo top right (the Club Logo switch).
2. **Hero:** the tournament badge, large, centred, then the tournament name and year (up to two lines), the tournament dates, and a short gold rule.
3. **Team:** the team logo as a large crest, the team name, and section and season beneath.
4. **Write-on lines** (each a switch): **Captain** (on; filled with the team's captain when Pre-Mark Captain is on), **Manager** (off), **Contact** (off), **Notes** (on, two lines).
5. **Footer:** the same fading band as the Poster: the team's affiliation tile, up to three sponsors (four with no affiliation; the team's main sponsor first, spec 158), and the tournament host.

## Where it lives. Decided
A third **Style** in `TeamSheetDialog`: **Plain | Poster | Cover Page**. The cover has no Blank, One Match or All Matches choice (it is the tournament, not a match); when the team plays in more than one league a **League** picker chooses the tournament. Switches: Club Logo, Pre-Mark Captain, Captain Line, Manager Line, Contact Line, Notes Lines. File name `Tournament Cover - VCASA Club Champs - Irene Veterans.pdf`.

## Permissions
Same as the Print Team Sheet entry points (spec 153); no new ones.

## Test Plan
Frontend: the Cover Page style hides the sheet type and sort controls, the League picker appears with more than one league, each line switch adds or removes its row, the captain is filled only with Pre-Mark Captain, one page is made, the file name. Visual check by rendering the PDF and a real print.

## Acceptance Criteria
Choosing Cover Page on the print screen gives a one-page PDF with the tournament badge, name, dates, the team crest and name and the chosen lines; every coloured element is clear of the paper edge on a real printer at 100%.
