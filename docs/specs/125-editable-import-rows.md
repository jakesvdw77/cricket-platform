# 125: Editable import rows and starting without a file

**Status:** approved by the owner in chat (2026-10-30), built. Amends `097-import-framework.md` (one non-goal and the file-only start) and extends `098-league-schedule-import.md`; nothing else in either spec changes.
**Depends on:** `097-import-framework.md` (batch, decisions, token, digest, wizard), `098-league-schedule-import.md` (first consumer), `docs/standards/backend.md`, `docs/standards/frontend.md`, `docs/standards/design-system.md`.

## Problem & Goals
The import treats the spreadsheet as the only source of rows. When a row is wrong (a date, a time, a venue, a misspelt team) the manager must leave the wizard, fix the file and upload it again, or exclude the row. During hand-testing the owner found this too rigid: the file should be a guide, the wizard should load it, and the manager should be able to fix, add and remove rows right there. Because the server already validates, matches teams, detects duplicates, asks for confirmation, writes all or nothing and can delete an import, the wizard can also be a fast way to build a schedule with no file at all.

**Goals**
- Let the manager correct any editable value of a loaded row in the wizard, with the server revalidating immediately.
- Let the manager add rows and remove rows the file did not have or should not have had.
- Let the manager start with an empty schedule (no file) and type the rows.
- Keep every guarantee of `097` unchanged: nothing is written before the confirmation, the token binds the exact reviewed data (now including edits), the commit re-validates, and the import can be deleted.

## Non-goals
- **No general spreadsheet editor.** Only the columns a type declares editable (for the schedule: date, home team, away team, venue, time, notes), only as plain text, no formulas, no multi-cell selection, no import or export of the grid. `097`'s non-goal "No generic spreadsheet editor in the browser" is amended accordingly (below).
- Editing a team's resolution is not part of this: teams are still linked or created in the Match teams step (an edited team name simply appears there as a new name to resolve).
- No offline or autosave-to-draft beyond the existing batch (the batch is the draft, expires after 24 hours).
- No bulk paste of many rows in this spec (listed under Later).
- No new import types; this applies to any type that opts in, the schedule being the first.

## Amendments to earlier specs
- `097`, Non-goals: replace "**No generic spreadsheet editor in the browser.** Fixes are made by excluding rows, choosing resolutions and acknowledging warnings, or by correcting the file and uploading again." with "**No generic spreadsheet editor in the browser.** A type may declare editable columns (`125`); fixes are made by editing those values, excluding rows, choosing resolutions and acknowledging warnings, or by correcting the file and uploading again."
- `097`, "The standard flow", step 1 Upload: the Upload step also offers **Start with an empty schedule** for a type that supports editing (`125`).
- `098`: unchanged apart from gaining this behaviour for `LEAGUE_SCHEDULE`.

## User Stories
- As a club admin, I can click a row in the Check rows step, change its date, time, venue or a team name, and see the row checked again straight away.
- As a club admin, I can add a row the file missed, and remove a row I added.
- As a club admin, I can start with no file, add the fixtures one by one, resolve the teams, confirm and import them, exactly as for a file.
- As a club admin, I can see which rows I edited or added, what a changed value was in the file, and put a row back to the file's values.
- As a club admin, I still must confirm exactly what will be created, and I can still delete the import.

## How it works
**Effective rows.** The batch keeps the file's parsed rows untouched. The manager's changes are decisions. The **effective rows** that every later step uses (validate, propose, plan, digest, commit) are computed in one place by the framework:

`effective rows = file rows with edits applied, plus added rows, minus excluded rows`

- An **edit** replaces one or more of a row's values with the manager's text. The edited text goes through exactly the same parsing and rules as a file cell (`ScheduleDateParser`, `ScheduleTimeParser`, the validator), so a bad date typed in the wizard fails the same way as a bad date in a file, with the same message.
- An **added row** is a row with the same value keys as a file row. It gets a stable row number from 1001 upward (above the 1,000-row file limit, so it can never clash), never reused within the batch, and shown as "New 1", "New 2" in the UI with its position in the list. Its `sourceRef` is empty.
- **Removing** a file row is the existing exclude. Removing an added row deletes it from the decisions.
- Team names changed by an edit change the set of distinct names, so proposals are recomputed after every decisions save (the framework already revalidates on each save; it must now also recompute `propose` from the effective rows, and the wizard shows the new or changed cards). A resolution recorded for a name that no longer appears is dropped silently by the server and reported back in the batch as unused.

**What the token binds.** The digest of the effective import (`097`: "the non-excluded rows as normalised, every resolution, every update opt-in, the list of records to be created") already covers the effective rows, so an edit or an added row changes the digest and invalidates any earlier token. The "creations digest" the manager confirmed likewise follows the new plan. Nothing about the confirm step is weakened: the commit still refuses without a current token, re-validates against live data, and writes all or nothing.

**Starting without a file.** A blank batch is a normal `PREVIEW` batch with source `MANUAL` and no file rows. Because `import_batch` requires a file name, hash and size, a blank batch stores the placeholder name "Typed in the wizard", the SHA-256 of empty input and size 0. The `source` check constraint added in `058` (`ck_import_batch_source`) must allow `MANUAL`, so migration `059-import-batch-source-manual.sql` replaces it. The whole-file "imported before" check is skipped for `MANUAL` batches. Everything else (limits, open-preview caps, expiry, scope, history, report, delete) is identical.

**Audit and report.** `import_batch.counts` gains `edited` and `added`. Each `import_batch_entity` row's `detail` records `rowOrigin` (`FILE`, `EDITED` or `ADDED`) so the history and report can say "3 rows typed in, 2 edited". The batch's file hash still describes the uploaded file, not the edits; the whole-file check compares the file as uploaded.

## Data Model Changes
One small migration, `059-import-batch-source-manual.sql`: it drops and re-adds the `ck_import_batch_source` check constraint of `import_batch` so `source` may be `MANUAL` (the column is `VARCHAR(24)`, but `058` constrained its values). Otherwise additive JSON only: `import_batch.decisions` gains `rowEdits` and `addedRows` (the column is `jsonb`); `import_batch.counts` gains `edited` and `added`.

## API Contract
All additive, under `/api/v1/manage/clubs/{clubId}/imports`, `canAdministerClub`, no other access change.
- `ImportDecisionsDto` gains `rowEdits: [{ rowNumber, values: { <columnKey>: string } }]` (only the changed keys; a value equal to the file's value is dropped by the server) and `addedRows: [{ rowNumber, values: { <columnKey>: string } }]`. Null lists mean empty. `ImportDecisionsRequest` already carries the whole decisions object, so no new route is needed for edits; they use `PUT .../decisions` with the batch `revision` as today.
- `ImportRowDto` gains `origin` (`FILE`, `EDITED`, `ADDED`) and `fileValues` (the file's original values for an edited row, absent otherwise).
- `ImportTypeDto` gains `editable` (boolean) and `editableColumns: [{ key, label, kind: TEXT|DATE|TIME }]` (the handler's declaration; the UI renders the inputs from it, never hard-coded).
- `POST /imports/{type}/blank` (body: the scope JSON and optional `timeZone`, as `preview` minus the file): creates the blank `MANUAL` batch and returns `ImportBatchDto`. `400` when the type is not `editable`; the same limits and `409` open-preview caps as `preview`.
- Validation (server, one place): unknown column keys, edits to rows that do not exist, duplicate row numbers in `addedRows`, row numbers below 1001 in `addedRows`, a total effective row count over the type's cap (1,000 for the schedule) and a value over the 1,000-character cell limit are each `400` with a plain message. Values are text only and are never interpreted as markup anywhere.
- `ImportTypeHandler` gains `List<EditableColumn> editableColumns()` (default empty, meaning the type is not editable). Nothing else is added to the interface: edits are applied to row `values` by the framework before `validate`, `propose` and `plannedChanges`, and the handler already works from `values`.
- `openapi.yaml`: additions only.

## UI Requirements
Composed from the existing `097` and `098` components; the only new pattern is the editable row, designed against the existing issue table.
- **Check rows (`ImportIssueTable`):** each row has an **Edit** action beside Exclude. Choosing it turns that row into inputs (one per editable column: a text field, a date field showing `yyyy-mm-dd` and accepting what the parser accepts, a time field), with **Save** and **Cancel** and, for an edited file row, **Reset to file values**. Save sends one decisions update and the table shows the revalidated row. Several rows can be edited in turn; nothing is saved per keystroke. An edited row shows an "Edited" chip and "was: <file value>" under the changed value; an added row shows an "Added" chip.
- **Add row:** a compact **Add row** button above the table (and at the end of it). The new row opens in edit mode with date and venue copied from the previous row (a convenience the manager can overwrite), Save adds it; Remove deletes an added row.
- **Upload step:** beside the drop zone, a secondary **Start with an empty schedule** button (only when the type is `editable`). It creates the blank batch and goes to Check rows, where the table shows an empty state "No rows yet. Add the first match."
- **Phone:** a row's card switches to stacked inputs (44 px targets), Save and Cancel full width at the bottom of the card; no horizontal scroll.
- **Keyboard and accessibility:** every input labelled with its column and row number, Enter saves, Escape cancels, focus returns to the row's Edit button.
- **Wording and layout rules:** compact buttons (32 px, 44 px touch below md), UK spelling, no em dashes, MUI components and theme tokens only (no grid library, no raw hex). The wizard step names are unchanged.
- **Report and history:** the report and history rows state how many rows were typed in or edited ("3 typed in, 2 edited"); a `MANUAL` batch shows "Typed in the wizard" instead of a file name.

## Amendment 2026-10-30: team choice without a separate step (owner feedback)
Hand-testing showed the Match teams step is too hard to understand for a typed schedule: the manager picks "Irene Villagers 2" from a list of their own teams and is then told it is "not linked to a team yet". Rules (this relaxes `098` "A name with an Exact proposal and no other candidates is shown pre-resolved but still listed"; nothing else in `098` changes):
- **Picking a known team in the row editor settles it.** The Home team and Away team type-aheads carry each option's identity (own team or league team, with its id). Choosing an option records the resolution immediately (`LINK`, `targetKind OWN_TEAM` or `LEAGUE_TEAM`, `targetId`), keyed by the name as shown, in the same save as the row edit. A name typed freely (not chosen from the list) is an ordinary unresolved name.
- **The team step (and the Our teams step) appear only when a name needs a decision**, that is, when at least one proposal has no resolution after the exact-match and alias seeding. When every name is settled, Check rows goes straight to Review.
- **Review shows a quiet summary line** ("Teams: 10 matched, 2 new") with a **Change teams** action that opens the team step on demand. Teams to be created are still listed in full before Confirm (principle 3 of `097` is unchanged: creating always needs the explicit confirmation).
- **Plain wording.** The button that links a name to a team is just **Link** with a tooltip explaining it ("Use this existing team for the name in your file"); **Create** has its own tooltip ("Add it as a new league team"); no "resolve" or "not linked yet" wording on rows, which instead say what will happen ("Pick the team" or "Team to be added").

## Test Plan
Written once everything is built and hand-checked, per the standing rule.
- **Backend unit:** the framework's effective-rows computation (edit applies and drops a no-op edit, added row numbering and uniqueness, removal, excluded wins over edit, edit of a missing row rejected, unknown column rejected, caps and value length); digest changes when an edit or added row changes and is stable when it does not; proposals recomputed from effective rows and a stale resolution dropped; blank batch creation (placeholders, `MANUAL`, whole-file check skipped, rejected for a non-editable type).
- **Handler tests (schedule):** an edited date, time and team name flow through the existing parsers and validator with the same codes and messages as a file value; an added row can be created and deleted like a file row; `rowOrigin` recorded.
- **Integration:** blank batch to confirm to commit to report to delete through HTTP; edit then commit creates the edited value, not the file's; a token issued before an edit is refused after it; a second edit after the token invalidates it; another club's admin and a section manager refused; row caps; cleanup in `@AfterEach`.
- **UI component tests:** edit mode and Save sends one update with only the changed keys, Cancel sends nothing, Reset to file values, the Edited and Added chips and "was" text, Add row copies date and venue, Start with an empty schedule appears only for an editable type and lands on the empty state, phone layout, keyboard (Enter, Escape, focus return).
- **E2E golden path (extension of `098`'s):** start empty, add two fixtures, resolve teams, confirm, see the matches, delete the import. Skipped in CI until Keycloak is available.
- **Browser check:** 375 px, tablet and wide for the edit row, the empty state and the report wording.

## Acceptance Criteria
1. A row's date, time, venue, team text or notes can be corrected in the wizard, and the server revalidates it with the same rules and messages as a file value.
2. Rows can be added and added rows removed; a file row is removed by Exclude as before.
3. An import can be started with no file, completed and deleted exactly like a file import.
4. Editing or adding a row after a token was issued invalidates the token; the commit writes the edited values, never the file's, and writes nothing without a current token.
5. Team names changed or added by an edit appear for resolution in the Match teams step.
6. The history and report show how many rows were typed in or edited, and a blank batch reads "Typed in the wizard".
7. No endpoint writes a domain record before the commit, and no existing `097` or `098` guarantee is weakened.

## Rollout Notes
- **Step 1:** effective-rows computation, `rowEdits` and `addedRows`, the editable row UI, Add row, report wording. Fixes the case that prompted this spec.
- **Step 2:** `POST .../blank` and the Start with an empty schedule button, the empty state.
- **Later (not in this spec):** paste many rows at once, "add a round" (one date for several fixtures), copy a previous season's schedule shifted by a date, and a **schedule grid editor** (owner idea, to be scoped later): one view that shows the league and season's current schedule as an editable grid, where matches can be added and edited in place and saved through the same checks and confirmation. There is deliberately no second "Create schedule" button: "Start with an empty schedule" inside Import schedule is the only no-file start for now. Add them to `docs/roadmap.md` when this is approved.
- Migration `059` (the source check constraint) only. `docs/standards/frontend.md` and `backend.md` gain a short note when built.

## Decisions
- Edits are decisions on the batch, not changes to the stored file rows, so the original is always available ("was ...", Reset to file values) and the digest covers the effective rows.
- Added rows are numbered from 1001 so they never clash with a file's rows and keep a stable identity while others are added or removed.
- A blank batch uses placeholder file metadata instead of a migration.
- The wizard stays one flow for files and typed schedules; only the Upload step and the Check rows step gain controls.
