# 107: Match Results: CricClubs CSV Adaptor

**Depends on:** `104-match-results-import-adaptors.md` (the adaptor framework, the common import format, the Result Processor with its deterministic name matching, the import wizard). This spec adds one adaptor and nothing else to the framework.
**Status:** draft, written 2026-10-16 from six real CricClubs exports the user supplied. Not approved. Contains no AI and sends nothing to any third party.

## Problem & Goals

Many of the club's matches are scored on CricClubs, which can export a result as a CSV. Retyping a scorecard in the capture wizard (`100`, `101`) is slow and error-prone. `104` built the framework that turns any source into one common format; this spec adds the first real source file, so a manager can pick a CricClubs export, check the match and teams, and get a draft to review.

The export is not a clean table. It is a text report written as comma separated lines: a result line, then for each team a batting block, an extras and total line, a bowling block and a fall of wickets block. Names are abbreviated ("Dawid M", "Willem V"). The deterministic matcher from `104` already copes with abbreviated names, so this adaptor only has to read the layout and the dismissal codes reliably.

Goals:

- **One adaptor, `CRICCLUBS_CSV`**, accepting a CricClubs export as an uploaded file or pasted text. No library and no AI.
- **Reliable by construction:** every line is either understood or reported with its line number. Nothing is guessed. An unknown dismissal code or an unrecognised section is a validation error, not a silent default.
- **The same pipeline as every import:** the common format, the preview, the team mapping, the guess flags, the explicit confirm, a draft that is never published.

## Non-goals

- **Other CricClubs exports** (a different layout, the PDF scorecard, an API). Only the report layout in the samples. A different layout is a separate, small change once a sample exists.
- **STUMPS and any other source.** Their own specs.
- **Reading the fall of wickets.** It repeats information already in the batting block, with shortened names and an inconsistent over format ("Over0.5", "1-144Retired"), so it is read only to be ignored.
- **Toss, venue, start time, player of the match, DLS and provider match id.** The files do not contain them. They are left empty; the manager fills them in the wizard.
- **Deduplicating a re-import by provider id.** There is no id in the file. A second import onto a match that has a draft uses the existing "replace the existing draft" tick.
- **A new library.** The format needs a line reader, not a general CSV parser (see Backend design).

## User Stories

- As a club manager, I can choose "CricClubs scorecard (CSV)" as the source and upload the exported file, or paste its text, so that I do not retype the scorecard.
- As a club manager, I see which of the match's teams each side of the file is, and which names were matched, exactly as with any import, so that I stay in control.
- As a club manager, when the file is not one this adaptor understands, I get an error naming the line and what was wrong, and my file is kept, so that I can fix it or report it.
- As the operator, I can add this adaptor with no change to the wizard, because the Source step is built from the catalogue.

## Data Model Changes

**None.** An imported draft records `source = IMPORT:CRICCLUBS` and no `external_id`. No file content is stored (`source_payload` stays null, as in `104`).

## API Contract

Additive only. `AdaptorType` gains `CRICCLUBS_CSV` (one `@JsonSubTypes` entry). The catalogue `GET /api/v1/manage/clubs/{clubId}/results/import/adaptors` lists it with `inputs = [CSV]`, `acceptsPaste = true`, `aiAllowed = false`, no `conversionPrompt` and a short example. The preview and resolve endpoints are unchanged. `openapi.yaml` gains the new enum value only.

## What the file looks like (from six real exports)

```
T20:  LeagueLaudium 4 Caribeans won by 135 Runs (11/10/2026)
                     Laudium 4 Caribeans Vs Soshanguve
,,,<Team> Batting
	BatsMan, How Out, Fielder, Bowler, Runs, Balls, Fours,Sixers
<name>,<code>,<fielder>,<bowler>,<runs>,<balls>,<fours>,<sixes>      (one per batter, 11 or 12 lines)
		Byes: 4 , Leg Byes: 2, Wickets : 8  Wides : 6, No Balls: 1 Penalty : 0,<runs>,<overs>
,,,<Other team> Bowling
	Bowler,Overs,Madiens,Runs,Wickets,Wides,No Balls,Hattricks,Dot Balls
<name>,<overs>,<maidens>,<runs>,<wickets>,<wides>,<no balls>,<hat-tricks>,<dots>
Total, 20 ,0,113,8,6,1,0,69
<Team> Fall of Wickets          (ignored)
,,,<Other team> Batting         (second innings, the same shape)
```

What each part means, as seen in the samples:

- **Result line** (line 1): `<format>:  League<result text> (dd/mm/yyyy)`. "League" is the literal word, glued to the result text, not a competition name. The result text is one of `<Team> won by N Runs`, `<Team> won by N Wickets`, `It is a Tie`, or `Forfeited. Winner: <Team>`. The format prefix (`T20`) gives the scheduled overs (T20 is 20).
- **Teams line** (line 2): `<Team A> Vs <Team B>`. Team A is the key `A`, Team B is `B`. Which team batted first comes from the order of the batting blocks, not from this line.
- **Dismissal codes seen:** `b` bowled, `ct` caught, `ctw` caught by the wicketkeeper, `lbw`, `st` stumped, `ro` run out, `rtno` retired not out. A blank code means not out, or did not bat.
- **Batters:** the first block lists the whole squad that was named, including players who did not bat (blank code and 0 balls).
- **Extras and total line:** wides, no balls, byes, leg byes and penalty, then the innings runs and overs. The overs on this line can differ in form from the bowling table (a full innings is "11" where the over-by-over data says 10.6); it is read as the total overs.
- **A forfeit** has empty batting and bowling blocks and zero totals.
- **Substitute fielders** appear as the literal fielder name `Substitute`.

## Mapping to the common format

| From the file | Becomes |
|---|---|
| Result line date `dd/mm/yyyy` | `match.date`. No time, venue or competition. |
| `won by N Runs / Wickets` | `result.outcome = WON`, `winner`, `margin {RUNS or WICKETS, N}` |
| `It is a Tie` | `outcome = TIE` |
| `Forfeited. Winner: X` | `outcome = FORFEIT`, `winner = X`, no innings |
| Format prefix `T20` | `scheduledOvers = 20`. Any other prefix is left empty and reported as a note until a sample shows how it is written. |
| `b` | `BOWLED` with the bowler |
| `ct` | `CAUGHT` with fielder and bowler. When the fielder and the bowler are the same person: `CAUGHT_AND_BOWLED`, no fielder. |
| `ctw` | `CAUGHT`, the fielder is the keeper |
| `lbw` | `LBW` with the bowler |
| `st` | `STUMPED` with fielder and bowler |
| `ro` | `RUN_OUT` with the fielder. A bowler written on a run-out is dropped (a run-out has no bowler credit). |
| `rtno` | `RETIRED_NOT_OUT` |
| blank code, balls faced or runs > 0 | `NOT_OUT` |
| blank code, 0 balls and 0 runs | `didNotBat` |
| fielder `Substitute` | fielder left empty (the catch is kept; no player is invented) |
| Bowling table | `bowling[]` (overs, maidens, runs, wickets, wides, no balls, dots; hat-tricks ignored) |
| Extras and total line | `extras`, the innings `runs`, `wickets` and `overs` |
| Fall of wickets | ignored |

Names are passed to the processor exactly as written. The processor already resolves "Dawid M" or "Willem V" against the other side's list with its closed-world rule, and a name it cannot place stays a guest or an opposition name for the manager to fix.

A dismissal code the adaptor does not know is **not guessed**: the import fails with an error giving the line and the code (for example "line 17: unknown dismissal code 'rtd'"), so a new code is added deliberately, with a sample, rather than turning into a wrong scorecard.

## UI Requirements

None new. The Source step shows a tile "CricClubs scorecard (CSV)" from the catalogue, with the Upload file and Paste tabs (there is no Other tab, because there is no prompt). Errors use the existing problem alert with line numbers, and the file and the paste are kept.

## Backend design

- **`CricClubsCsvAdaptor extends AbstractAdaptor`**, format `CSV`, text based, strict UTF-8 (a byte order mark and Windows line endings are tolerated). `AbstractAdaptor.importFrom` still does the size checks, the source stamp (`provider = CRICCLUBS`) and the common-format validation.
- **A line reader, not a CSV library.** The report mixes free text, tabs and rows of different widths, so a general CSV parser would not help. A small internal reader splits a line on commas, honours double quotes (a name containing a comma), trims tabs and spaces, and tracks the line number for errors. **No new dependency.**
- **Sections** are found by their title lines (`<Team> Batting`, `<Team> Bowling`, the column header rows), never by position, so a missing or reordered block is reported instead of misread.
- **Checks the adaptor makes itself** (reported with line numbers): the result line parses, two team names are found, each batting block names a team from the teams line, the bowling block belongs to the other team, every dismissal code is known, numbers are numbers.
- **The rest is the processor's.** Totals against scorecard rows, wickets against dismissals and margin against scores are the existing validator's warnings, not the adaptor's.
- **ArchUnit.** The adaptor lives in `service.adaptor` and needs nothing outside the allowed list; the existing isolation tests cover it.

## Test Plan

- **Fixtures.** Anonymised copies (invented names, same shape) of the six real files, stored under `backend/src/test/resources/imports/results/cricclubs/`: a normal chase, a win by runs with a retired-not-out batter and a substitute fielder, a tie, a forfeit, and two edited variants. The real files stay in the git-ignored `docs/samples/`.
- **Adaptor unit tests.** The result line in each form (runs, wickets, tie, forfeit), the date, T20 to 20 overs, every dismissal code, caught and bowled, run-out with a stray bowler, did-not-bat versus not-out, the substitute fielder, the extras line, the bowling table, BOM and CRLF, a quoted name with a comma, pasted text, and every failure: an unknown code, a missing section, a bad number, a bad date, an empty file, a file that is some other CSV. Each asserts the line number and message.
- **Integration.** Each fixture through preview and resolve to a draft with the matcher and the validator, asserting the draft's innings, scores, wickets, dismissals and that nothing is published; a forfeit and a tie produce the right outcome.
- **Contract.** The enum addition only.
- **Manual.** The user imports a real export of each kind into a real match.

## Acceptance Criteria

- [ ] The six sample kinds import to a draft with the correct innings, runs, wickets, overs, extras, batting and bowling rows.
- [ ] Outcomes: won by runs, won by wickets, tie and forfeit are read correctly, with the margin.
- [ ] Every dismissal code in the table maps as shown; an unknown code fails with its line number and is never guessed.
- [ ] Abbreviated fielder and bowler names are resolved by the existing matcher; unresolved names stay for the manager.
- [ ] A forfeit produces an outcome with no innings.
- [ ] No new library; OpenAPI change is the new enum value only.
- [ ] A file that is not a CricClubs report is refused with a clear message and is kept in the screen.

## Rollout Notes

- **Open points to confirm against more samples** (each is a small, separate fix): the dismissal codes for retired out, hit wicket, timed out, handled ball and obstructing; how a format other than `T20` is written; how no result, abandoned and draw read; a DLS or reduced-overs result; a super over; two players sharing one abbreviation; a team with fewer than 11 named; a competition whose header carries a real league name.
- **Order of work:** the line reader and result line first, then the batting and bowling sections, then fixtures and integration, then docs, review and the PR.
- **Docs to update when built:** `docs/roadmap.md`, `docs/architecture.md` (the adaptor list), a pointer in `104`'s Rollout Notes.
- **Deferred:** other CricClubs layouts, bulk import of many files, reading the fall of wickets, a Remembered names screen (all already in `104`'s deferred list).

### Decisions

- **No AI and no library** for this adaptor (2026-10-16): the format is regular enough for a deterministic reader.
- **Unknown codes fail loudly** rather than falling back to a guess.
- **A substitute fielder keeps the dismissal but no fielder**, rather than inventing a player. (To confirm with the user.)
