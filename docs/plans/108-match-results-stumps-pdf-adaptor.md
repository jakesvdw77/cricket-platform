# Plan: 108: Match Results: STUMPS PDF Adaptor

Spec: `docs/specs/108-match-results-stumps-pdf-adaptor.md` (approved 2026-10-16, with Apache PDFBox). Backend only; the wizard is catalogue driven, so no screen changes.

## Slices

1. **Dependency and text helper.** Add `org.apache.pdfbox:pdfbox` (3.0.x) to `backend/pom.xml`. `StumpsPdfText` in `service.adaptor`: loads the bytes, refuses a corrupt file, a PDF with no text and one over 30 pages, and returns the numbered lines per page in the library's default reading order. The only class that imports PDFBox. Widen the `service.adaptor` ArchUnit closed list by exactly `org.apache.pdfbox..` for that one class and keep the rule non-vacuous.
2. **Pure parser.** `StumpsReportParser` (lines in, common document out; no PDF knowledge): banner check, the summary page (teams, result, player of the match, overs, venue, date and time, toss, match id), each innings card (header, batter triples, extras, total, fall of wickets skipped, bowling table), stop at the ball-by-ball pages, errors with page and line. Put the mapping rules both CricClubs and STUMPS need into a shared package-private class only where they are used unchanged.
3. **Adaptor.** `AdaptorType.STUMPS_PDF` and its `@JsonSubTypes` entry, `StumpsPdfAdaptor` (format `PDF`, no paste, no AI, no prompt), `read` returns the extracted lines, `transform` parses, provider `STUMPS` with the report's match id as `externalMatchId`.
4. **Masked fixtures.** A test helper builds small PDFs from text templates (placeholder names, fictional figures, the real line structure) with PDFBox; plain-text fixtures for the parser. A privacy test fails if a name from the git-ignored `docs/samples` appears in any test source or resource (skipped when the samples are absent).
5. **Tests.** Parser unit tests (every mapping row and every failure with page, line, code), PDF refusals, adaptor and integration tests through preview and resolve (including re-import of the same match id), the ArchUnit rule, the OpenAPI enum value.
6. **Docs.** Roadmap row, `docs/architecture.md` adaptor list, `docs/standards/backend.md` (the PDFBox rule), a pointer in `104`'s Rollout Notes, a line in `CLAUDE.md` recording the approved dependency.

## Rules for the build

- No other library. No change to the common format, the processor, the matcher or the wizard.
- The three real reports in the git-ignored `docs/samples/stumps/` are read-only inputs and **contain children's names**. Never copy any name, team name, venue or match id from them into any committed file, test, comment or message; never print them to output you keep. Fixtures use placeholders and fictional figures.
- UK spelling, no em dashes, every class documents its spec reference.
- Run backend tests only in a scratch copy (a live backend runs from `backend/`).
