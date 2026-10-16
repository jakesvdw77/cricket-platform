# 108: Match Results: STUMPS PDF Adaptor

**Depends on:** `104-match-results-import-adaptors.md` (the adaptor framework, the common import format, the Result Processor with its deterministic name matching, the import wizard) and `107-match-results-cricclubs-csv-adaptor.md` (the model for a deterministic reader: line-numbered errors, nothing guessed, a reusable mapper). This spec adds one adaptor and one library.
**Status:** approved by the user 2026-10-16, including Apache PDFBox as a backend dependency. Written from three real STUMPS match reports the user supplied. Contains no AI and sends nothing to any third party.

## Problem & Goals

Many of the club's matches, including the junior sides, are scored in the STUMPS app, which produces a PDF match report. Retyping the scorecard in the capture wizard is slow and error-prone, and the junior reports name children. `104` built the framework and `107` proved the approach on CricClubs; this spec reads the STUMPS PDF so a manager can pick the file, check the match and teams, and get a draft to review.

The PDF is a printed report, not data, but its text is regular: a summary page, then for each innings a batting card (a name line, a dismissal line and a figures line per batter), the extras and total, the fall of wickets and a bowling table, followed by pages of ball-by-ball detail. A deterministic reader of the extracted text is realistic. **The ball-by-ball pages are ignored.**

Goals:

- **One adaptor, `STUMPS_PDF`**, accepting an uploaded PDF only (a PDF cannot be pasted). No AI, no network.
- **Reliable by construction:** every line is understood or reported with its line number. Nothing is guessed. A file that is not a STUMPS match report is refused with a clear message.
- **Richer than CricClubs:** the report carries the toss, the venue, the start time, the player of the match and a **match id**, so a re-import finds its own draft.
- **The same pipeline as every import:** the common format, the preview, the team mapping, the guess flags, the explicit confirm, a draft that is never published.
- **Children's names are handled with care:** no real report is ever committed; the tests use masked patterns.

## Non-goals

- **Ball-by-ball data, over-by-over data, the fall of wickets (read to be skipped) and the over summaries.** Ignored.
- **Other STUMPS exports** (a different report type, an image, a web page). Only the match report PDF in the samples.
- **OCR or scanned PDFs.** The PDF must contain text. A scan is refused.
- **Super overs, abandoned and no-result matches, and forfeits**, until a sample shows how STUMPS writes them (see Open points). They fail loudly, never guessed.
- **Name matching by AI.** Unchanged from `104`: deterministic only.
- **A position-aware layout engine.** The samples read correctly in plain reading order (see Backend design); a position-aware reader is added only if a real file proves it is needed.

## User Stories

- As a club manager, I can choose "STUMPS match report (PDF)" as the source and upload the PDF, so that I do not retype the scorecard.
- As a club manager, I see which of the match's teams each side of the file is, and which names were matched, exactly as with any import, so that I stay in control.
- As a club manager, when the file is not a STUMPS report or is one I cannot read, I get an error naming the page or line and what was wrong, and my file is kept.
- As a club manager, importing the same STUMPS match again finds the draft it already created, so that I do not make a second one by accident.
- As the operator, I can add this adaptor with no change to the wizard, because the Source step is built from the catalogue.
- As a parent's representative, I can be sure no child's name from a real report is stored in the repository or its tests.

## Data Model Changes

**None.** An imported draft records `source = IMPORT:STUMPS` and `external_id` = the report's match id (so the existing unique index and the "replace the existing draft" tick give idempotent re-imports, as designed in `104`). No file content is stored (`source_payload` stays null).

## API Contract

Additive only. `AdaptorType` gains `STUMPS_PDF` (one `@JsonSubTypes` entry). The catalogue lists it with `inputs = [PDF]`, `acceptsPaste = false`, `aiAllowed = false`, no `conversionPrompt` and no example. The preview and resolve endpoints are unchanged. `openapi.yaml` gains the new enum value only. The PDF size cap is the existing binary cap (5 MB).

## What the report looks like (from three real reports, shown here with placeholders)

Page 1, the summary, in reading order:

```
<banner line: "STUMPS - The cricket scoring app ..." repeated at the top of every page>
Match report
<Team A> <age tag?>
<runs>-<wickets> in <overs> overs
<Team B>
<runs>-<wickets> in <overs> overs
Result
<Winner> won by <N> wickets | <Winner> won by <N> runs [ (D/L Method) ]
<Player> Of The Match
...
Playing 11 <n>
Overs <N>
Venue <name, may be empty>
Date & Time <d> <Mon> <yyyy> <hh:mm> <AM|PM>
Toss <Team> <word> To Bat | To Bowl
Scorer <name>
Match ID <letters and digits>
Match Summary
<Team A> <runs>-<wickets> (<overs>)   then the top performers
```

Each innings, on its own pages:

```
<ordinal> Innings Scorecard                       (1st, 2nd)
<Team> R B 4s 6s SR                               (column header)
<batter name>                                     one line per batter
<dismissal>                                       b <Bowler> | c <Fielder> b <Bowler> | c & b <Bowler>
                                                  | lbw <Bowler> | runout (<Fielder>) | not out
<runs> <balls> <fours> <sixes> <strike rate>      the figures line
... (repeated per batter)
Extras
( B <n> | [LB <n> |] WD <n> | NB <n> )
<extras total> Overs <overs>
Total
<runs>/<wickets>
Run Rate <x>
Fall Of Wickets
<runs>-<n> (<Name>, <over>), ...                  (wraps over several lines; ignored)
Bowler O M R W Econ 0s 4s 6s Wd NB                (column header)
<bowler name> <O> <M> <R> <W> <Econ> <dots> <4s> <6s> <Wd> <NB>
```

After the second innings come pages of ball-by-ball detail (`Over <n>` blocks), which are ignored. A line the reader does not recognise before that point is an error, not something to skip.

## Mapping to the common format

| From the report | Becomes |
|---|---|
| `Match ID` | `source.externalMatchId`; provider `STUMPS` |
| `Date & Time` | `match.date` and `match.startTime` (12-hour clock, `d Mon yyyy`) |
| `Venue` | `match.venue`; empty when the report has none |
| Teams | `teams[A]` and `teams[B]` in the order of the summary page; the age tag (`U15`, `O11`) stays part of the name as written |
| `Toss <Team> <word> To Bat/Bowl` | `toss.wonBy`, `toss.decision` (BAT or BOWL); the team is matched to one of the two teams |
| `<Winner> won by N wickets / runs` | `result.outcome = WON`, `winner`, `margin {WICKETS or RUNS, N}`; the winner is matched to one of the two teams. A result line may wrap onto a second line |
| `(D/L Method)` | `result.decidedBy = DLS`; no target or revised overs are written when the report does not state them |
| `Overs <N>` | `result.scheduledOvers` |
| `<Player> Of The Match` | `awards.playerOfMatch.name` (the team is left empty; the manager sees it in Review) |
| Innings headers | `innings[]` in order, each with its `battingTeam` from the card header |
| Name line, dismissal line, figures line | one `batting[]` row: `player`, `howOut`, `bowler`, `fielder`, `runs`, `balls`, `fours`, `sixes` |
| `b <Bowler>` | `BOWLED` with the bowler |
| `c <Fielder> b <Bowler>` | `CAUGHT` with fielder and bowler |
| `c & b <Bowler>` | `CAUGHT_AND_BOWLED` with the bowler, no fielder |
| `lbw <Bowler>` | `LBW` with the bowler |
| `runout (<Fielder>)` | `RUN_OUT` with the fielder |
| `not out` | `NOT_OUT` |
| Extras line | `extras` (byes, leg byes, wides, no balls; penalty is not in the report and stays empty) |
| `Total <runs>/<wickets>` and `Overs <overs>` | the innings `runs`, `wickets`, `overs` |
| Bowling rows | `bowling[]` (overs, maidens, runs, wickets, dots, wides, no balls; economy and boundaries ignored) |
| Fall of wickets, ball-by-ball pages, top performers | ignored |

Names are passed to the processor exactly as written; the existing matcher resolves them against the squads. A dismissal wording the adaptor does not know (stumped, hit wicket, retired, timed out and so on) **is not guessed**: the import fails with the page and line and the wording, so a new form is added deliberately, with a masked sample. A report that lists batters who did not bat is not expected (none of the samples did); players absent from the batting cards are simply not on the scorecard.

## UI Requirements

None new. The Source step shows a tile "STUMPS match report (PDF)" from the catalogue with the Upload file tab only (no Paste, no Other tab). Errors use the existing problem alert, and the file is kept. A re-import onto a match that already has the draft uses the existing "replace the existing draft" tick.

## Backend design

- **`StumpsPdfAdaptor extends AbstractAdaptor`**, format `PDF`, binary. It overrides `read` to extract the text and returns a content object holding the numbered lines; `validate` checks the STUMPS banner and the section markers; `transform` parses. `AbstractAdaptor.importFrom` still does the size check, the source stamp and the common-format validation.
- **Library: Apache PDFBox 3.x** (Apache 2.0), used only to extract text in `service.adaptor`, in one small class (`StumpsPdfText`). **Approved by the user 2026-10-16.** It is used with no JavaScript, no embedded files and no network access; the page count is capped (a report is about 7 pages; more than 30 is refused) and the existing 5 MB upload cap applies. The `service.adaptor` isolation rule gains exactly the library's package for that one class.
- **Reading order, not positions.** The three samples extract cleanly in the library's default reading order: each batter is three consecutive lines, and the tables are one row per line. A name that wraps across two lines is joined using the figures line as the end marker. If a real file proves the plain order is not enough, a position-aware reader is a separate, small change.
- **A pure parser.** `StumpsReportParser` works on the list of lines and knows nothing of PDFs, so every rule is unit tested with plain text and no PDF at all. It reports problems with the page and line.
- **A shared mapper where the rules are shared.** The winner and margin, the toss and the dismissal-to-`howOut` mapping follow the `107` pattern; common pieces move into a shared package-private class only where both adaptors use them unchanged.
- **Errors.** Every failure is an `ImportInputValidationException` with a path `page N, line M` (or `summary`), a stable code and a plain message, such as `NOT_A_STUMPS_REPORT`, `NO_TEXT_IN_PDF`, `UNKNOWN_DISMISSAL`, `UNRECOGNISED_LINE`, `BAD_NUMBER`, `TOO_MANY_PAGES`, `WINNER_NOT_FOUND`, `TOSS_NOT_UNDERSTOOD`.
- **No logging of content.** A name or a line of the report is never logged; messages quote the wording of a dismissal (a keyword) and never a person's name.

## Test Plan

- **Masked fixtures only.** No real STUMPS PDF is ever committed. A test helper builds small PDFs with PDFBox from text templates that follow the real line structure but use placeholder names (`Player 1`, `Team A U15`) and fictional numbers, plus plain-text fixtures for the pure parser. Each template is a pattern, not a copy of any report.
- **Parser unit tests (no PDF).** Every row of the mapping table: each dismissal form, the result in each form (wickets, runs, `D/L Method`, a wrapped result line), the toss, the date and time (AM and PM, 12 o'clock), an empty venue, the extras with and without leg byes, partial overs, the bowling table, a name that wraps, a missing section, an unrecognised line, an unknown dismissal wording, a bad number, a result winner that is neither team. Each failure asserts page, line, code and message.
- **PDF tests.** The text helper round-trips a generated PDF; a PDF with no text, a PDF that is not a STUMPS report, a PDF over the page cap, a corrupt PDF and a non-PDF file are each refused with a clear message.
- **Integration.** Generated PDFs through preview and resolve to a draft: the toss, venue, start time, player of the match and match id are set; abbreviated or full names are matched by the existing matcher; a second import of the same match id finds the draft and needs the replace tick; nothing is published.
- **Privacy check.** A test fails if any file under the adaptor's test resources or any test source contains a name from the git-ignored samples (a name list loaded from `docs/samples` when present, skipped when it is not).
- **Architecture and contract.** The adjusted isolation rule, proven non-vacuous; the enum addition only.
- **Manual.** The user imports a real STUMPS report of each kind into a real match.

## Acceptance Criteria

- [x] The user has approved Apache PDFBox as a dependency (2026-10-16).
- [ ] The three sample reports (an ordinary win by wickets, a DLS win by runs, a large win by runs) import to a draft with the correct teams, toss, venue, start time, overs, result, margin, innings, batting and bowling rows, player of the match and match id.
- [ ] Every dismissal form in the table maps as shown; any other wording fails with its page and line and is never guessed.
- [ ] A second import of the same match finds the draft and needs the replace tick.
- [ ] A scanned or empty PDF, a PDF that is not a STUMPS report, a corrupt file and an over-long PDF are refused with a clear message and the file stays in the screen.
- [ ] The ball-by-ball pages are ignored and cannot cause an error.
- [ ] No real report and no real name is in the repository, its fixtures or its tests.
- [ ] No other new library; OpenAPI change is the new enum value only.

## Rollout Notes

- **Open points to confirm against more masked samples** (each is a small, separate fix): how STUMPS writes a stumping, a hit wicket, a retirement and a timed-out; a super over; a tie, an abandoned or no-result match and a forfeit; how a batter who did not bat is shown, if ever; a long name that wraps; a report with no result yet; the `D/L Method` text when the revised target is given; `Overs N` when the match was reduced (the DLS sample shows the reduced figure); a captain or wicketkeeper marker beside a name.
- **Order of work:** the approval of PDFBox, the text helper and the masked fixture builder, then the pure parser (summary page, batting cards, bowling table), then the adaptor and the PDF refusals, then integration, docs, review and the PR.
- **Docs to update when built:** `docs/roadmap.md`, `docs/architecture.md`, `docs/standards/backend.md` (the PDFBox rule), a pointer in `104`'s Rollout Notes.
- **Deferred:** other STUMPS exports, a position-aware reader, super overs, bulk import of several reports, reading the ball-by-ball detail.

### Decisions

- **No AI and no network** (user, 2026-10-16): the report is regular enough to parse directly.
- **Ball-by-ball is ignored** (user, 2026-10-16).
- **Children's names are never committed**; tests use masked patterns (user, 2026-10-16).
- **PDFBox is the only new library** (approved by the user 2026-10-16, backend only).
