# Plan: 107: Match Results: CricClubs CSV Adaptor

Spec: `docs/specs/107-match-results-cricclubs-csv-adaptor.md` (approved 2026-10-16). Backend only; the wizard is catalogue driven, so no screen changes.

## Slices

1. **Adaptor skeleton and reader.** `AdaptorType.CRICCLUBS_CSV` plus its `@JsonSubTypes` entry on `AbstractAdaptor`; `CricClubsCsvAdaptor` (`@Component`, format `CSV`, paste allowed, `aiAllowed` false, a short example, no conversion prompt); a package-private line reader (`CricClubsReport` or similar) that splits a line on commas with double-quote support, trims tabs and spaces, and tracks line numbers; decoding override: UTF-8 first (BOM tolerated), Windows-1252 fallback.
2. **Result line and teams line.** Format word (`T20`, `O/N`), tournament words after it, match type glued to the result text (ignored), `won by N Runs/Wickets`, `It is a Tie`, `Forfeited. Winner: X`, `dd/mm/yyyy`, winner found by matching the two team names from line 2 against the text before "won by" (longest wins), `X Vs Y`.
3. **Sections.** Find sections by their title lines (`<Team> Batting`, `<Team> Bowling`, the two column header rows), never by position; batting rows with the dismissal code map from the spec; did-not-bat versus not-out; the extras and total line (innings runs and overs from it, never the bowling total); the bowling table; fall of wickets read only to be skipped; retired batters decided from the stated wickets (not out, out, or a failing line-numbered error); substitute fielder left empty; run-out bowler dropped; caught-and-bowled when fielder equals bowler.
4. **Errors.** Every failure is an `ImportInputValidationException` with a line number in the path and a plain message: unknown dismissal code, unrecognised or missing section, bad number or date, result line not understood, no teams, wickets that do not fit the batters, empty file, not a CricClubs report.
5. **Fixtures and tests.** Anonymised fixtures (invented names, real structure) under `backend/src/test/resources/imports/results/cricclubs/`; adaptor unit tests; integration through preview and resolve; ArchUnit unchanged but must pass; OpenAPI enum addition; UI catalogue test fixture unaffected.
6. **Docs.** `docs/roadmap.md` row, `docs/architecture.md` adaptor list, a pointer in `104`'s Rollout Notes, `docs/standards/backend.md` one line.

## Rules for the build

- No new library. No change to the common format, the processor, the matcher or the wizard.
- The real samples in the git-ignored `docs/samples/cricclubs/` are read-only inputs. **Never copy a real name into a committed file**; fixtures use invented names.
- UK spelling, no em dashes, every class documents its spec reference.
- Run backend tests only in a scratch copy (a live backend runs from `backend/`).
