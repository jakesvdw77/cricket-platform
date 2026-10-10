# 097: Import Framework

**Depends on:** `029-league-management.md` (`League`, `Season`, `Match`, `LeagueAffiliation`), `070-league-teams.md` (per league and season `LeagueTeam`, the `lower(name)` uniqueness index, the explicit-checklist copy pattern this framework generalises), `050-league-schedule-and-fixtures.md` (its Non-goal "no bulk fixture import" is what `098` lifts), `051` (Full Schedule PDF, poster and calendar shares, read-only here), `095-league-edit-gold-standard.md` (the Schedule tab entry point), `docs/standards/*.md` (backend layering, exceptions, pagination, frontend anatomy, design system). `096` (duplicate league, confirm and result patterns) is **not present in `docs/specs/` on this branch**; the confirm/result patterns here were taken from the code instead (`ConfirmDialog`, `CopyLeagueTeamsDialog`, the `RemoveLeagueTeamResponse` outcome style). If `096` merges with a conflicting pattern, reconcile in review.
**Status:** draft. First consumer: `098-league-schedule-import.md`.

## Problem & Goals

Clubs hold their data in spreadsheets they did not design: a league's season schedule, a squad list, a sponsor list. Today every record is typed in one at a time (`050`: "Matches are still entered one at a time, by hand"; `070`: "Bulk CSV import" of league teams deferred; `docs/roadmap.md` carries that item). Importing is high risk: one wrong click can create hundreds of wrong rows, duplicate team names (the problem `070` was written to stop), duplicate matches on a second import, or put a whole schedule into the wrong league. There is no import code, no spreadsheet library and no upload path for data files in this repository today (see "What exists today").

This spec defines **one import framework** that every import in the product must use, and the principles that bind it. It builds no consumer by itself; `098` is the first. The aim is that the second, third and tenth import are a template, a parser, a validator and a handler, not a new flow.

**Goals**
- One standard flow (Upload, Parse, Validate, Resolve references, Review and confirm, Commit, Report, Undo or delete) with one backend model and one generic UI wizard.
- Nothing is written before an explicit, server-enforced confirmation.
- Validation first, with plain-English row-level results.
- Reference resolution (link or create) with intelligent proposals, to stop duplicate records.
- Re-import is safe: importing again (a corrected file, a wider scope) never duplicates what already exists.
- A reusable scope option, "mine versus everything", for imports where that makes sense.
- A guarded undo for accidental imports.
- A place for AI that is safe by construction: Phase 1 is prompts that work outside the application, Phase 2 an optional in-application transform that only ever proposes.
- Our own downloadable template per import type, because source files have no standard format.

## The user's binding principles

Principles 1 to 6 are recorded verbatim as the user stated them. They carry over to every future import and may only be changed by amending this spec.

1. The flow must ALWAYS have an explicit confirmation step. It must NEVER blindly import anything. Nothing is written before the final confirm; the server enforces it (the preview returns a token tied to the exact reviewed data; the commit refuses without it and re-validates).
2. Validation is at the forefront of every import: everything is validated before the user can confirm; errors block, warnings must be acknowledged; row-level status (OK, warning, error) with plain-English reasons and a filter for problems only.
3. Reference resolution, link or create: for league schedule import the user must be able to either CREATE teams or just LINK them. If the league already has teams the user links them in this step. If a name in the sheet is not found, ALL teams from the current AND previous seasons (the club's own teams, the league's league teams across seasons, and other leagues' league teams of the club) are searched with some intelligence (normalisation, abbreviations and acronyms like PHSOB or CBCOB, 'VETERANS' vs 'VETS', numeric suffixes, token similarity, previously accepted aliases) to propose a link, ranked with a confidence and the reason. This is a CRUCIAL verification step to avoid duplicate team names. If the user is convinced there is no linkable team they may create the team as a LEAGUE team; CREATING teams always requires an explicit confirmation step (list of what will be created).
4. There must be a way to DELETE an imported schedule if no match in it has a poll or a result, for accidental mistakes (for example imported into the wrong league). Define precisely what blocks deletion, how the blockers are reported, whether deletion is all-or-nothing, and how deleting created league teams is handled (only those created by the import and not used by other matches).
5. The process must cater for an AI step, even if for now it is only instructions and prompts that guide the user how to convert his file into the correct template format (AI outside the application). A later phase adds an in-application transform with a preview, using the Claude API; it must plug into the same preview, validation and confirm pipeline, AI never writes data and only proposes, suggestions are marked as suggested until accepted. The user does not want AI used much inside the application as a first step.
6. Source files have NO standard format (various leagues, various layouts), so v1 defines OUR OWN downloadable template (Excel with an instructions sheet and an example row; also accept CSV in the same columns); a template made per league and season can include the club's teams, the league's teams and known venues on a lookup sheet with drop-down data validation to reduce spelling mismatches.

Two further binding principles were added by the user in later instructions (stated here in the spec's words, same force as the six above):

7. **Scope option, mine versus everything.** Where an import can cover either "only the records that involve the club" or "everything in the file", the user chooses, on both the template export and the import. Records outside the chosen scope are never silently ignored: they are shown in the preview as "Skipped, not ours" with a count and an expandable list, and the confirm screen states how many were skipped. The scope used is recorded on the import batch.
8. **Re-import must never create duplicates.** An import can be repeated (a corrected file, a wider scope, the same file again). Every import type defines a record identity rule and compares each row against ALL existing records of that scope, whoever created them (an earlier import or a person), by resolved identity rather than text. An identical existing record is skipped and shown, never created. Anything that nearly matches is shown for the user to decide. Changing existing records is opt-in only, per row or in bulk, and is itself confirmed.

Principle 4 is written for the schedule; for any other import the same rule applies in the form "delete is possible only while nothing created by the import has been depended on", with the type's own blocker list (see "Undo and delete").

## What exists today (honest baseline)

- **No import code.** `backend/pom.xml` has no Apache POI, no CSV library, no Spring AI or Anthropic client (searched for `poi`, `opencsv`, `commons-csv`, `spring-ai`, `anthropic`). `ui/package.json` has `jspdf` (approved for PDFs, `CLAUDE.md`) and no `xlsx`, `papaparse` or similar.
- **Uploads.** `MediaController` (`POST /api/v1/manage/media`, `/platform/media`) is a generic multipart image upload (`MediaServiceImpl.ALLOWED_CONTENT_TYPES`, images only); `LeaguePlayingConditionsController` adds a PDF multipart upload (`050`). `application.properties` sets `spring.servlet.multipart.max-file-size=5MB` and `max-request-size=5MB`. The UI uploads through `ui/src/api/mediaApi.ts` (`FormData`, `multipart/form-data`) and `components/DocumentUpload`.
- **No match delete.** `MatchController` exposes create, update, `deactivate` and `reactivate` only; `MatchServiceImpl` has no delete. The codebase rule is "disable, never delete" (`Match.active`; `LeagueTeam` is deactivated instead of deleted once referenced, `070`). Undo of an import is therefore a **deliberate, narrow exception**, see "Undo and delete".
- **No results.** `Match` has no score, outcome or status columns. `OverviewResultDto` is a placeholder ("Results do not exist yet"). The Results module is a future, separate module (`docs/roadmap.md`, deferred by `093`).
- **Matches without our team are an existing shape.** `Match` allows both sides to be league teams or free text (`070`); `ui/src/pages/manage/league/leagueFixtureFilters.ts` has `isOurMatch` (a side has a `teamId`) and the league Schedule view has an "Only our matches" switch. `ClubMatchScope` and the unscoped club-admin matches list include such matches.
- **Confirm and result patterns exist** in `ui/src/components/ConfirmDialog` (title, description, `destructive`, `pending`, `acknowledgeOnly`) and `CopyLeagueTeamsDialog` (checklist, nothing sent until Confirm, result toast "Copied 7, skipped 2"). `RowActions`, `LeagueEditPanel`, `PageCounters`, `FilterBar`, `ContentControlsLine`, `CompactSwitch`, `CompactToggleGroup`, `SidePanel`, `BottomSheet` and `zebraTint` (all in `docs/standards/design-system.md`) are the building blocks for the wizard.
- **Access.** `@access.canAdministerClub(authentication, #clubId)` (club admin, `platform_admin` superset) is the league-management gate (`029`, `070`); `canAccessClub` adds section-scoped managers for matches.
- **Legacy AI (for Phase 2 only).** `/Users/jaco/Development/cricketlegend/.../service/AiService.java` uses Spring AI's Anthropic chat model; the API key and default model are resolved per call from an admin-configured `AiSettings` entity (falling back from a per-call override), every call is logged by `AiUsageService.log(feature, model, usage)` (`AiUsageLog` with a `feature` name), and it supports text and image or PDF attachments. **The `AiSettings.apiKey` column is plain text and must not be copied** (see "AI in the import flow"). The usage-log-per-feature idea is worth keeping.

## Non-goals

- **No consumer here.** League schedule import is `098`; league-teams bulk import, players, squads, contacts, sponsors and results imports are future specs that reuse this framework (see "Reuse").
- **No in-application AI in this spec's build.** Phase 1 (prompts, outside the app) ships; Phase 2 is designed here so the pipeline does not need to change, but it is not built (Rollout slice 5, behind its own approval).
- **No parsing of arbitrary source layouts.** The product reads only its own template (and CSV with the same columns). Merged cells, multi-block layouts, PDFs and images are the human or AI conversion step's job, never the parser's.
- **No automatic or scheduled imports, no sync with external systems** (CricClubs and similar stay deferred, `050`).
- **No bulk "overwrite" of existing records.** The framework supports a per-record **opt-in update** of named attributes (principle 8), never a blanket replace, and never a delete-and-recreate. Which attributes a type may update is that type's decision.
- **No general-purpose delete of imported records outside the batch.** The only hard delete this spec introduces is "delete import" through the batch.
- **No generic spreadsheet editor in the browser.** Fixes are made by excluding rows, choosing resolutions and acknowledging warnings, or by correcting the file and uploading again.
- **No cross-club import** and no platform-level import UI in v1 (`/manage` only; `platform_admin` already passes `canAdministerClub`).

## User Stories

- As a club admin, I can download the template for an import, fill it in or have an AI assistant convert my own file into it, and upload it, so I do not retype a spreadsheet.
- As a club admin, I can choose whether the template and the import cover only my club's records or everything in the file.
- As a club admin, I see every row checked before anything is saved, with errors, warnings and plain-English reasons, and I can filter to problems only.
- As a club admin, I decide for every name the system does not recognise whether to link it to something that exists or create it, with proposals ranked by confidence and the reason for each.
- As a club admin, I can import the same file or a wider scope again and be certain nothing that already exists is duplicated.
- As a club admin, I must explicitly confirm a summary (what will be created, skipped, updated and excluded) and acknowledge every warning before any record is written.
- As a club admin, I get a report after the import with a link to the imported data.
- As a club admin, I can delete an import I made by mistake while nothing in it has been depended on, and I am told precisely what blocks deletion when something has.
- As a club admin, I can copy a ready-made prompt that helps an AI assistant turn my own file into the template.
- As a developer, I can add a new import by implementing one handler and one template, without writing a new wizard or batch model.

## The standard flow

Every import is these steps, in this order. The wizard shows a stepper (a "Step 3 of 6" caption on a phone) over the steps that need the user; Parse and Validate happen server-side as part of Upload.

| # | Step | What the user sees | What the server does | Writes data? |
|---|---|---|---|---|
| 1 | **Upload** | Download template (with the scope choice for its lookup sheet); "Convert with AI" help panel; the **import scope** choice where the type offers it; drop zone (`.xlsx`, `.csv`); file limits shown. | `POST preview`: accepts the file, hashes it, checks it against earlier imports of the same file, stores nothing but the batch. | No (a `PREVIEW` batch only) |
| 2 | **Parse** | A progress state, then either a file-level error ("This is not the league schedule template", "Merged cells are not supported") or the rows. | Reads the file into normalised rows (row number, cell reference, typed values). File-level problems end here with a clear message and no batch rows. | No |
| 3 | **Validate** | Counters (Rows, OK, Warnings, Errors), a **Problems only** switch, the issue table: row, status chip, the values, plain-English reason, per-row **Exclude** action. | Runs every deterministic rule of the type (own and cross-row rules, record identity against existing data). Stores issues on the batch. | No |
| 4 | **Resolve references** | For a type with a scope option, first **Identify what is ours** (see "Scope option"); then one card per distinct unrecognised value (for example a team name) with ranked proposals (confidence, reason chips), plus **Link**, **Create** and **Skip these rows** choices; a "Remember this match" tick. | Computes proposals (type specific matcher) and, on each decision change, re-validates and returns the new state. | No |
| 5 | **Review and confirm** | A summary: will create N, update N (opt-in), skip N (already exist), skipped not ours N, excluded N; **the list of everything that will be created**; every warning grouped by kind with an acknowledgement tick; the Confirm button, disabled until zero errors and every warning acknowledged. | Issues the **confirmation token** only when the saved decisions leave zero errors and every warning acknowledged. | No |
| 6 | **Commit** | A pending state on the button ("Importing..."). | Verifies the token, takes the lock, re-validates against the live data **including record identity**, writes everything in **one transaction** (all or nothing). | **Yes** |
| 7 | **Report** | What was created, updated, skipped (duplicates and not ours), excluded (with a downloadable "rows not imported" CSV), warnings acknowledged, time taken, the batch id, a button to the imported data, and **Delete import**. | Returns the committed batch. | No |
| 8 | **Undo or delete** | From the report and from the import history: a check ("Can this be deleted?") and a guarded destructive confirm; blockers listed with links when it cannot. | Re-checks blockers inside the delete transaction. | Deletes (guarded) |

A batch can be left at any point before step 6 and resumed from import history until it expires. Closing the browser never writes anything.

## Scope option: "mine versus everything" (principle 7)

A **reusable framework option**, offered by any type whose handler declares an "ours" notion (`098` is the first; players of "our squads versus every name in a league sheet", sponsors and contacts do not need it).

- **Two places, one concept.**
  - *Template export*: `templateScope = OURS_ONLY | OURS_AND_OTHERS`. It decides what the template's lookup sheet and drop-downs contain (for `098`: "Our teams only" or "Our teams and the league's teams, current and previous seasons"). Server-built, a query parameter on the template endpoint.
  - *Import*: `scopeMode = OURS_ONLY | ALL`. In `OURS_ONLY` only rows involving "ours" are imported; every other row gets the action `SKIPPED_NOT_OURS`.
- **Never silently ignored.** A skipped row is a real row in the preview with the status chip **Skipped, not ours** (a fourth neutral chip beside OK, Warning, Error; it is not a problem and does not block), counted in its own counter, listed in an **expandable "Skipped, not ours (N)" section** of the Validate and Review steps, included in the downloadable "rows not imported" CSV, and stated on the Confirm screen ("42 of 90 rows do not involve your teams and will not be imported").
- **An early step decides what is ours.** For `OURS_ONLY` the flow inserts **Identify what is ours** before reference resolution: the distinct values that could be "ours" (for `098`, every distinct team name in the file) are listed with a suggested link to the club's own records (fuzzy match, remembered aliases, same engine as principle 3), and the user confirms which are ours. Only then is the scope applied. Fewer references need resolving afterwards (for `098`, only the opponents of our matches), which is the main practical benefit of this mode.
- **Validation depends on scope.** Each rule of a type declares whether it applies in `ALL` only, or in both (see `098`). Whole-set rules (completeness, once per round) apply only in `ALL`; rules about our own records apply in both.
- **Recorded.** `scopeMode` and `templateScope` are stored in `import_batch.scope`, shown in the history ("Ours only" or "All matches" chip) and in the report, and included in the confirmation digest.
- **The default and the trade-off** are a recommendation (R20) and are decided per type.

## Re-import and record identity (principle 8)

The framework requires every handler to implement `identityKey(row)` and `findExisting(scope, keys)`: the type's definition of "the same record", evaluated against **all existing records of that scope, regardless of who or what created them** (a person, this batch's predecessors, another import type). Identity compares **resolved references, never text**: two rows that name the same team differently are the same record once resolved.

Outcomes the framework recognises for every row (the type maps its own rules onto them; the chips and counters are generic):

| Outcome | Meaning | Default action | Blocks confirm? |
|---|---|---|---|
| **NEW** | No existing record with this identity and nothing close. | Create | No |
| **DUPLICATE** | An identical record exists (same identity, same other attributes). | **Skip**, shown, never created | No (shown as OK, "Already exists") |
| **DIFFERS** | Same identity, but some non-key attribute differs (for the schedule: time or venue). | **Skip** | No, but needs a decision shown; update is opt-in |
| **POSSIBLE DUPLICATE** | Not the same identity but suspiciously close (type defined). | Create is held until the user decides; shown as a **warning** to acknowledge | Warning |
| **SKIPPED_NOT_OURS** | Outside the chosen scope. | Skip | No |

- **Duplicates within the file itself** are detected by the same identity key and are an **error** (exclude one), not a duplicate skip, because the file contradicts itself.
- **Whole-file check.** The batch stores the file's SHA-256 and a hash of its normalised rows. If either matches an earlier `COMMITTED` batch for the same scope (not `DELETED`), the Upload step warns "You imported this file on 12 Oct 2026 (Jaco): importing it again will skip every row that already exists" and the preview shows exactly what would happen (normally all DUPLICATE).
- **Updating existing records is opt-in and rare.** A `DIFFERS` row can be switched, per row or in bulk, to **Update**, listing the exact attributes that will change (old to new). Update is a confirmed action in the Review step and is blocked or warned by the type when the existing record has dependants (for the schedule: polls, selections, results). An update never changes which batch created the record: `import_batch_entity` gets a second row with `action = UPDATED` and the previous values, so the history shows both (see data model).
- **Delete is never confused by re-import.** Deleting a batch deletes only records **that batch created** (`action = CREATED`). It never deletes a record it skipped as a duplicate, a record an earlier batch created, or a record created by a person. An update made by the batch can be reverted only while the record has no dependants; otherwise the update is reported as "left as changed".
- **Races.** Duplicate detection is repeated inside the commit transaction under the scope lock, so two concurrent confirms cannot both create the same record. Whether the database also needs a unique key is a per-type decision (for the schedule: no, see `098`).
- **Re-import after a scope change** (ours only, then all) is the standard case the design must make boring: the first batch's records show as DUPLICATE, only the additions are NEW, references created by the first batch are linked (not recreated) through the link step, remembered aliases and exact-name matches.

## Server design

### Batch lifecycle

```
(no batch) --preview--> PREVIEW --commit--> COMMITTED --delete--> DELETED
                           |  \--discard--> DISCARDED
                           \----expiry----> EXPIRED
```

- **Preview** creates an `import_batch` in `PREVIEW` state holding the normalised rows, issues and proposed resolutions (in a `payload` jsonb), the file name, hash and size, the scope options, the time zone used, and an `expires_at` (24 hours after the last change, constant `IMPORT_PREVIEW_TTL`).
- **Decisions.** The client submits decisions (our-ness confirmations, resolutions, exclusions, update opt-ins, warning acknowledgements, type options) with `PUT .../decisions`. The server re-validates the rows **with the decisions applied** and returns the new state. Each accepted change bumps `revision` and invalidates any earlier token.
- **Confirmation token.** When the saved decisions leave zero errors and every warning acknowledged, the response carries a `confirmationToken`: `HMAC-SHA256(secret, batchId | revision | digest | userId | issuedAt)`, base64url, where `digest` is the SHA-256 of the canonical JSON of the **effective import** (type, scope and scope mode, template version, time zone, the non-excluded rows as normalised, every resolution, every update opt-in, and the list of records to be created). The server also stores `confirmation_digest` and `token_issued_at` on the batch. The secret is `app.imports.token-secret`, supplied by environment, never committed. The token is valid for 30 minutes (`IMPORT_TOKEN_TTL`) and is bound to the issuing user.
- **Commit** carries `batchId`, `revision`, `confirmationToken` and `confirmedCreationsDigest` (the digest of the "will be created and updated" list the user saw). The server: loads the batch (must be `PREVIEW`, not expired); checks the token (signature, user, age, revision, digest recomputed from stored state); checks the creations digest; takes the type's lock (below); **re-validates against the live database, including record identity**, because data may have changed since preview (a new match, a team renamed, another import committed); and if re-validation yields any error, any unacknowledged warning, a newly appeared duplicate, or a different effective import, answers `409` with the fresh review state and writes nothing. Otherwise it writes in one transaction.
- **All or nothing.** The commit is a single `@Transactional` method; any failure rolls back everything, the batch stays `PREVIEW` with `last_error` set, and the user can retry or fix. Rows **excluded or skipped during review** are decisions, not failures: the commit is all-or-nothing over the effective rows.
- **Idempotent.** A repeated commit of an already committed batch with the same token returns the stored report (`200`), so a double click or a retry after a lost response cannot import twice. A different token on a `COMMITTED` batch is `409`.
- **Concurrency.** The commit takes `pg_advisory_xact_lock(hash(clubId, type, scopeKey))`, so two imports into the same scope (for example the same league and season) serialise; the second re-validates after the first committed and sees its rows as DUPLICATE (`409` with the refreshed review, the user confirms again). The batch row also has an optimistic `version`.
- **Expiry and cleanup.** A scheduled job marks `PREVIEW` batches past `expires_at` as `EXPIRED` and nulls their `payload`; metadata rows are kept 90 days (`IMPORT_BATCH_RETENTION`). `COMMITTED` batches keep their summary and entity ids indefinitely and their `payload` for 30 days after commit (so the report can still list rows), then it is nulled. The original file is **not stored** (R4).

### Type handler (the extension point)

One interface, one implementation per import type, registered as a Spring bean (backend skeleton, `docs/standards/backend.md`):

```java
interface ImportTypeHandler {
    String type();                                   // "LEAGUE_SCHEDULE"
    int templateVersion();
    boolean supportsOursScope();                      // principle 7
    byte[] buildTemplate(ImportScope scope, TemplateScope templateScope, TemplateFormat format);
    String aiPrompt(ImportScope scope);               // versioned text, see AI section
    ParsedImport parse(ImportFile file, ImportScope scope, ImportOptions options);
    ValidationResult validate(ParsedImport parsed, ImportScope scope, ImportDecisions decisions);
    List<ReferenceProposal> propose(ParsedImport parsed, ImportScope scope);
    Object identityKey(ResolvedRow row);              // principle 8, over resolved references
    ExistingMatches findExisting(ImportScope scope, Collection<Object> keys);   // all records, any creator
    List<PlannedChange> plannedChanges(EffectiveImport effective);              // creations and opt-in updates
    CommitOutcome commit(Authentication auth, EffectiveImport effective);       // writes, via existing services
    DeletionCheck checkDeletion(ImportBatch batch);
    void delete(Authentication auth, ImportBatch batch);                        // guarded, all or nothing
}
```

Rules: `commit` and `delete` write **only through the existing services** (for example `MatchService`, `LeagueTeamService`), never directly through repositories, so every business rule of the normal create path applies (`docs/standards/backend.md`: shared logic in one place). The generic `ImportService` owns the batch, token, locking, expiry, history and audit; handlers own the type's rules. `ImportService` is the only caller of a handler.

### Row and issue shape (generic)

```
ImportRow   { rowNumber, sourceRef ("Sheet1!C14"), values{...},
              status OK|WARNING|ERROR|SKIPPED_NOT_OURS,
              outcome NEW|DUPLICATE|DIFFERS|POSSIBLE_DUPLICATE|SKIPPED_NOT_OURS,
              action CREATE|SKIP|UPDATE|EXCLUDED, issueCodes[], existingRef? }
ImportIssue { code (stable, machine), severity ERROR|WARNING, rowNumbers[], field, message (plain English), hint }
Decision    { identifiedAsOurs[], excludedRows[], resolutions[{key, kind LINK|CREATE|SKIP_ROWS, target..., remember}],
              updates[{rowNumber, attributes[]}] | updateAllDiffering, acknowledgedWarnings[{code, scope: ALL | rowNumbers[]}], options{} }
```

Severity semantics (principle 2): **ERROR** blocks confirm until fixed, resolved or the row excluded; **WARNING** does not block but must be acknowledged (per code, in one tick for all rows of that code, with the rows listed); **OK** needs nothing; **SKIPPED_NOT_OURS** is informational. A row's status is its worst issue. Messages are written for a club admin ("Team 'POLICE 1' is on two matches on 20 Sep 2026"), never a stack trace or a code.

## Data Model Changes

New tables, generic across import types. Migration `backend/src/main/resources/db/changelog/v1/041-add-import-framework.sql` (latest existing on this branch is `040-player-verification-status.sql`; use the next free number at build time), registered in `db.changelog-master.xml`. Entities in `com.cricketlegend.domain`, `ddl-auto=validate`, MapStruct DTOs.

**`import_batch`**

```sql
CREATE TABLE import_batch (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id              UUID NOT NULL REFERENCES club(id),
    type                 VARCHAR(64)  NOT NULL,           -- 'LEAGUE_SCHEDULE', ...
    template_version     INT          NOT NULL,
    source               VARCHAR(24)  NOT NULL DEFAULT 'TEMPLATE_FILE',  -- TEMPLATE_FILE | AI_TRANSFORM (phase 2)
    status               VARCHAR(16)  NOT NULL,           -- PREVIEW, COMMITTED, DISCARDED, EXPIRED, DELETED
    scope_key            VARCHAR(255) NOT NULL,           -- e.g. 'league:<id>|season:<id>', for history, locking, identity
    scope                JSONB        NOT NULL,           -- the type's parameters incl. scopeMode and templateScope
    scope_mode           VARCHAR(16),                     -- OURS_ONLY | ALL (null when the type has no scope option); mirrored for the history list
    time_zone            VARCHAR(64),                     -- IANA, used to read local times
    file_name            VARCHAR(255) NOT NULL,
    file_sha256          CHAR(64)     NOT NULL,
    rows_sha256          CHAR(64),                        -- hash of the normalised rows, for the whole-file re-import check
    file_size_bytes      BIGINT       NOT NULL,
    payload              JSONB,                           -- normalised rows, issues, proposals; nulled on expiry / retention
    decisions            JSONB        NOT NULL DEFAULT '{}',
    revision             INT          NOT NULL DEFAULT 0,
    counts               JSONB        NOT NULL DEFAULT '{}',  -- rows, ok, warnings, errors, created, updated, duplicates, skippedNotOurs, excluded
    confirmation_digest  CHAR(64),
    token_issued_at      TIMESTAMPTZ,
    last_error           VARCHAR(1000),
    created_by           UUID NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at           TIMESTAMPTZ,
    committed_by         UUID,
    committed_at         TIMESTAMPTZ,
    deleted_by           UUID,
    deleted_at           TIMESTAMPTZ,
    version              BIGINT NOT NULL DEFAULT 0       -- optimistic lock
);
CREATE INDEX ix_import_batch_club_type ON import_batch(club_id, type, status);
CREATE INDEX ix_import_batch_scope ON import_batch(club_id, scope_key, created_at DESC);
CREATE INDEX ix_import_batch_file ON import_batch(club_id, type, file_sha256);
CREATE INDEX ix_import_batch_rows ON import_batch(club_id, type, rows_sha256);
```

**`import_batch_entity`** (what a committed batch created or updated: the basis of undo, history and audit)

```sql
CREATE TABLE import_batch_entity (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id     UUID NOT NULL REFERENCES import_batch(id),
    entity_type  VARCHAR(48) NOT NULL,     -- 'MATCH', 'LEAGUE_TEAM', 'IMPORT_ALIAS', ...
    entity_id    UUID NOT NULL,
    action       VARCHAR(16) NOT NULL DEFAULT 'CREATED',   -- CREATED | UPDATED
    row_number   INT,                      -- the source row, for the report
    previous     JSONB,                    -- for UPDATED: the old values, so the update is visible and revertible
    detail       JSONB,                    -- e.g. {"copiedFrom": "<leagueTeamId>"} for a team copied from another season
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_import_batch_entity_batch ON import_batch_entity(batch_id);
CREATE INDEX ix_import_batch_entity_entity ON import_batch_entity(entity_type, entity_id);
```

"Which batch created this record" is always the `CREATED` row; there is at most one per entity. An update adds an `UPDATED` row (any number, from any batch) and never changes the creator. No column is added to `match` or `league_team`: the join table keeps core tables untouched and works for every future entity type. (Cost: "was this match imported?" is a join, acceptable for a rare question.)

**`import_alias`** (remembered reference matches, generic reference memory)

```sql
CREATE TABLE import_alias (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id           UUID NOT NULL REFERENCES club(id),
    kind              VARCHAR(32)  NOT NULL,          -- 'TEAM' (098); other kinds later
    scope_key         VARCHAR(255) NOT NULL,          -- 'league:<id>' for teams: an alias never leaks across leagues
    alias_normalised  VARCHAR(255) NOT NULL,          -- normalised sheet text
    alias_original    VARCHAR(255) NOT NULL,          -- as typed, for display
    target_kind       VARCHAR(32)  NOT NULL,          -- 'OWN_TEAM' | 'LEAGUE_TEAM_NAME'
    target_team_id    UUID,                           -- when OWN_TEAM
    target_name       VARCHAR(255),                   -- the canonical league team NAME (league teams are per season, so a name, not an id)
    created_by        UUID NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_batch  UUID REFERENCES import_batch(id),
    active            BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX ux_import_alias ON import_alias(club_id, kind, scope_key, alias_normalised) WHERE active;
```

An alias is a **proposal source, never an automatic decision** (R14). A phase 2 `ai_usage_log` table is described in "AI in the import flow" and is not part of this migration.

## API Contract

All under `/api/v1/manage/clubs/{clubId}/imports`, access `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")` unless stated. New `ImportController` / `ImportService` + `ImportServiceImpl` / `ImportBatchRepository` / `ImportBatchEntityRepository` / `ImportAliasRepository` / `ImportMapper` (MapStruct) / flat DTOs. Every read is `@Transactional(readOnly = true)`, writes `@Transactional`. A `clubId` that is not the caller's, or a batch of another club, is `404`.

| Endpoint | Purpose | Errors |
|---|---|---|
| `GET /imports/types` | The import types the club can use (type, label, template version, supported formats, limits, `supportsOursScope`). Lets the UI render entry points generically. | none |
| `GET /imports/{type}/template?format=xlsx\|csv&templateScope=OURS_ONLY\|OURS_AND_OTHERS&<scope params>` | Downloads the template for the scope (for `LEAGUE_SCHEDULE`: `leagueId`, `seasonId`; the lookup sheet follows `templateScope`). `Content-Disposition` named after the type and scope. | `400` bad scope, `404` scope of another club |
| `GET /imports/{type}/ai-help?<scope params>` | The versioned prompt text and plain-English steps for the "Convert with AI" panel, optionally with this scope's names to paste (see AI section). | as above |
| `POST /imports/{type}/preview` | Multipart: `file` plus `scope` (JSON part, including `scopeMode`) and optional `timeZone`. Parses and validates, creates the `PREVIEW` batch, returns `ImportBatchDto` (counts, first page of rows, proposals, earlier-import warning). | `400` file rejected (`ImportFileRejectedException`: type, size, row cap, wrong template, unreadable); `409` limit reached (open previews) |
| `GET /imports/{batchId}` | The batch: status, counts, scope and scope mode, who and when, proposals, planned changes, file warnings. | `404` |
| `GET /imports/{batchId}/rows?status=&outcome=&page=&size=&sort=` | **Paginated** rows with issues; `status=ERROR,WARNING` is the "Problems only" filter and `outcome=SKIPPED_NOT_OURS` feeds the expandable skipped list, both applied on the server (`docs/standards/backend.md` pagination rule). | `404`, `409` if payload expired |
| `PUT /imports/{batchId}/decisions` | Body: `{revision, decisions}`. Re-validates with the decisions applied, bumps `revision`, returns the batch and, when committable, the `confirmationToken` and `creationsDigest`. | `409` `ImportBatchStateException` (not `PREVIEW`) or revision conflict; `409` `ImportBatchExpiredException` |
| `POST /imports/{batchId}/commit` | Body: `{revision, confirmationToken, confirmedCreationsDigest}`. See "Commit". Returns the committed batch with the report. | `409` `ImportConfirmationInvalidException` (missing, wrong, expired or stale token); `400` `ImportValidationFailedException` (errors, unacknowledged warnings or new duplicates on re-validation; body carries the fresh state); `409` expired or not `PREVIEW` (an already committed batch with the same token returns `200`) |
| `POST /imports/{batchId}/discard` | Ends a `PREVIEW`. Idempotent. | `409` if `COMMITTED` |
| `GET /imports?type=&scopeKey=&status=&page=&size=` | **Paginated** import history, newest first, each with its scope mode. | none |
| `GET /imports/{batchId}/deletion-check` | Can this import be deleted? `{deletable, blockers[], willDelete{...}, willKeep{...}}`. Never writes. | `404` |
| `POST /imports/{batchId}/delete` | Body `{confirm: true}`. All or nothing. Re-checks inside the transaction. Returns the `DELETED` batch with what was removed and kept. A `POST` action, matching `remove`/`deactivate` precedent. | `409` `ImportDeletionBlockedException` carrying `blockers[]`; `409` already deleted or not `COMMITTED` |

`ImportBatchDto` never exposes `payload` raw: rows come only through `.../rows`. The OpenAPI schema (`openapi.yaml`) gains the paths, `ImportBatchDto`, `ImportRowDto`, `ImportIssueDto`, `ImportDecisionsDto`, `ReferenceProposalDto`, `PlannedChangeDto`, `DeletionCheckDto` and `DeletionBlockerDto` (additions only, updated by hand per the standing process).

**New named exceptions** (`com.cricketlegend.exception`, `docs/standards/backend.md`): `ImportFileRejectedException`, `ImportValidationFailedException` (extend `ValidationException`, 400); `ImportBatchNotFoundException` (extends `NotFoundException`); `ImportBatchStateException`, `ImportBatchExpiredException`, `ImportConfirmationInvalidException`, `ImportDeletionBlockedException` (extend `ConflictException`, 409). The two that carry a body (`ImportValidationFailedException` and `ImportDeletionBlockedException`, with `issues[]` and `blockers[]`) need `GlobalExceptionHandler` to map their extra properties into the `ProblemDetail`. `backend.md` currently allows extra properties only for the four public-availability exceptions, so **this spec amends the `backend.md` exceptions section** to say a named subclass of an existing base may carry structured detail; no new base type or status is introduced.

## Generic frontend: `ImportWizard`

Everything below is generic; a consumer supplies configuration, not layout.

**Shared components** (`ui/src/components/`, four-file anatomy each, Storybook story and test required, `docs/standards/frontend.md`):

| Component | Role |
|---|---|
| `ImportWizard` | The shell: stepper, step routing, footer buttons (Back, Next, Confirm), `ManageScreenHeader`-style title with a Back link to the entry page, the resume-from-history behaviour. Props: `type`, `scope`, `title`, `columns` (how a row is shown), `renderProposalExtras`, `describeChange`, `resultLinks`. |
| `ImportUploadStep` | Template download buttons (Excel, CSV) with the template scope choice, the import **scope choice** (`CompactToggleGroup`, for a type with `supportsOursScope`), the earlier-import warning, the `ConvertWithAiPanel`, the drop zone with limits, a clear file-level error state (`Alert`). |
| `ImportIssueTable` | The Validate step: `PageCounters` (Rows, OK, Warnings, Errors; Warnings and Errors are `kind: 'filter'`), a **Problems only** `CompactSwitch`, a zebra table (the shared `zebraTint`) with a status chip (OK, Warning, Error, Skipped not ours, plus the outcome words New, Already exists, Differs, Possible duplicate: icon plus word, never colour alone), the values, the reason, and a per-row **Exclude / Include** action (`RowActions`), and an expandable **Skipped, not ours (N)** section. Rows come from the paginated rows endpoint, 50 per page. On a phone each row is a stacked card with the reason under the values. |
| `ReferenceResolver` | The Resolve step: one card per unrecognised value, "N of M resolved" progress, each card showing the value, the rows it affects, ranked proposal rows (name, where it comes from, confidence chip, reason chips such as "VETERANS = VETS", "same name last season", "remembered from an earlier import", "created by an earlier import"), and the actions **Link to this**, **Create new**, **Skip these rows**, plus a "Remember this match" tick. Nothing is preselected except an exact match or an alias the user already confirmed once (still shown, still counted). The same component renders **Identify what is ours** (confirm which values are ours). Creation is confirmed once, on the Review step, not here. |
| `ImportConfirmPanel` | The Review step: counts (including skipped duplicates, skipped not ours, updates), the "will be created" and "will be updated (old to new)" lists, the warnings grouped by code each with its own acknowledgement tick and the rows listed, an `Alert` stating that nothing has been saved yet, and the primary **Confirm and import** button, disabled with the reason beside it until it is allowed. |
| `ImportResultReport` | The Report step: created, updated, skipped (already exist, not ours), excluded counts as `KeyFigureTile`s, acknowledged warnings, a link to the imported data, a "Download rows not imported" CSV, the batch reference, and the destructive outlined **Delete import** which opens the deletion check in a `ConfirmDialog` (`destructive`) or an `acknowledgeOnly` blockers list. |
| `ImportHistoryPanel` | A `SidePanel` listing batches for a scope (status chip, scope mode chip, who, when, counts) with **Open report**, **Resume** (for `PREVIEW`) and **Delete import** as `RowActions`. |
| `ConvertWithAiPanel` | The help panel (see AI section): numbered steps, the prompt in a read-only block with a **Copy prompt** button, a **Download template** button, a privacy line. Phase 2 adds a second tab here. |

**Pages** are thin compositions per consumer (for `098`, `pages/manage/leagueImport/`). A generic resume route `/manage/imports/:batchId` opens any batch in the right step (a `PREVIEW` resumes where decisions stand; a `COMMITTED` shows the report). The import API client is one file, `ui/src/api/importApi.ts`, with React Query keys under `['managed-club', clubId, 'imports', ...]`; commit and delete invalidate the keys of the data they changed (the consumer passes them).

**Mobile-first.** 375 px first: the issue table becomes cards, the resolver is a vertical stack of cards with 44 px tap targets, the confirm panel's primary button is full width and sticky at the bottom. No horizontal scroll at any step. The wizard holds its state in the batch on the server (not in browser memory), so a reload resumes.

**Design pass.** `ImportIssueTable`, `ReferenceResolver` and `ImportConfirmPanel` are new visual patterns: a Claude Design pass is required before build (`docs/workflow.md` Step 2), mirroring the poll screens' density.

## Template generation and parsing

**Recommendation: server-side, with Apache POI (`poi-ooxml`) for `.xlsx` and Apache Commons CSV for `.csv`** (neither is in `pom.xml` today; this spec approves adding both, as `CLAUDE.md` requires a spec decision for a new library).

Why server-side:
- The **same code must run on the server anyway** for validation and the confirm re-check, so parsing in the browser would mean two parsers that can disagree; a client-only parse cannot satisfy principle 1 (the server cannot trust a client's rows).
- **Templates need server data** (the lookup sheet of the club's teams, the league's teams, known venues) and Excel **data validation** and a hidden metadata sheet, which POI writes and a browser library does not do well.
- The cost of server-side parsing is small at our sizes (a few hundred rows, 2 MB cap; milliseconds to a second). Its real costs are memory per request and a larger dependency surface, handled by the limits below.
- The common browser option, the `xlsx` (SheetJS) package, is not a good fit: its npm distribution is stale with known advisories, and it would add a second parser.

Alternatives considered: Fastexcel/`excel-streaming-reader` (lighter reads, but weak template writing), CSV-only (no drop-downs, no instructions sheet; rejected by principle 6), client-side parsing with a preview echoed to the server (rejected above).

**Generation.** `ImportTypeHandler.buildTemplate` returns bytes. The workbook has: the data sheet (header row, formats, drop-down data validation set to **warn, not stop**, so an unknown name can still be typed and then resolved), an **Instructions** sheet (purpose, one paragraph per column with accepted formats, a worked **example row**, "do not merge cells, one row per record", how names are matched), a **Lookups** sheet for the scope and template scope, and a hidden **`_meta`** sheet (`template=<type>`, `version=<n>`, scope ids, template scope, generated at). CSV templates carry the header only (a CSV cannot hold the rest; the Instructions text is shown in the UI instead).

**Parsing.** Reads the first sheet named like the data sheet (else the first visible sheet), requires the header row, matches header names case-insensitively with a small alias list, rejects unknown template versions, rejects merged regions with an explicit file-level error, reads each cell by type (text, numeric date, time fraction, formula result, never the formula), trims, and drops fully blank rows (they are not errors). CSV: UTF-8 (BOM tolerated), comma or semicolon auto-detected from the header, RFC 4180 quoting. Every row keeps its `sourceRef` so messages can say "row 14".

**Hardening.** `.xlsx` and `.csv` only (reject `.xls`, `.xlsm`, `.xlsb`; macros are never read); the file's magic bytes are checked, not only its name; POI's `ZipSecureFile` limits (compression ratio, entry size) on; external entities disabled; formulas are never evaluated; a cell over 1,000 characters is truncated with a warning.

## File limits and rate limits

Constants in one `ImportLimits` class, documented in the template's Instructions sheet and returned by `GET /imports/types`:

- File size: **2 MB** (below the global 5 MB multipart limit in `application.properties`; no change to the global value).
- Rows: **1,000** data rows per file for schedule-like types (a type may lower it); cell text up to 1,000 characters.
- Open previews: **5** per user and **20** per club; previews per club: **30 per hour** (`409` with a plain message, no new HTTP category).
- Preview expiry 24 hours; confirmation token 30 minutes.
- AI (Phase 2) has its own per-club daily cap (see AI section).

## Permissions and audit

- Every import endpoint is `canAdministerClub` (club admin; `platform_admin` passes as elsewhere). This is **stricter than `Match` create/update** (`canAccessClub` with section scoping) on purpose: an import touches a whole league at once, across sections. A section manager cannot import or delete. See R13.
- A batch is visible to every club admin of the club (history), but only its creator can change its decisions and commit it while it is `PREVIEW`; any club admin can delete a committed import (deletion is protected by blockers, not by authorship). See Open Question 4.
- Audit: `import_batch` records creator, created, committed by and at, deleted by and at, the file name, hash and size, the scope and scope mode, the counts and the exact created and updated entity ids with previous values (`import_batch_entity`). Application logs (SLF4J, no personal values) record preview, commit and delete with batch id and club id. Row values live in `payload` for 30 days after commit; after that the batch keeps counts and entity ids only.

## Undo and delete (principle 4 as a framework rule)

The generic mechanism; the schedule's exact blockers are in `098`.

- **Eligibility.** Only a `COMMITTED` batch with `import_batch_entity` rows can be deleted. A batch is deleted **as a whole or not at all** (all or nothing, one transaction).
- **What is deleted.** Only entities recorded with `action = CREATED` for that batch, and only if the type's `checkDeletion` finds **no dependants**. Never a record the batch skipped as a duplicate, never one an earlier batch or a person created (principle 8). Entities created by the batch that are still **referenced elsewhere** (for example a league team that another match now uses) are **kept**, and reported as kept. Updates made by the batch are reverted from `previous` where the record has no dependants, otherwise reported as "left as changed".
- **Dependants are structural, not remembered.** Each type's blockers are computed from the live data, by querying everything that references the created entities. A framework integration test asserts that every foreign key into a created entity's table is either covered by a registered blocker or explicitly listed as "deleted together with the entity"; adding a table that references `match` without registering it fails the build (this is how a future Results module cannot be forgotten).
- **Blockers reported** as `DeletionBlockerDto { entityType, entityId, label, reasons[] (stable codes), detail (plain English), link }` so the UI can list each blocked record with a link. The `deletion-check` endpoint returns them without writing; `delete` returns them in the `409`.
- **Race.** The delete locks the affected rows, re-runs the check inside the transaction, and maps a foreign-key violation (a poll created a moment ago) to the same `409 ImportDeletionBlockedException`.
- **Why a hard delete.** The codebase rule is "disable, never delete". Deactivating imported matches would leave ghost fixtures that still appear in counts and make a corrected re-import see them as existing. The undo therefore hard-deletes, but **only through this batch path, only while nothing depends on the records**, and the `import_batch` row stays forever as the audit record (`DELETED`, who, when, what). There is still no general match delete endpoint.
- Aliases remembered by the batch are deactivated on delete (R14).

## AI in the import flow

**Principle 5 in two phases. The pipeline is the same in both: AI can only produce a template-shaped file, and that file goes through preview, validation, resolution and confirm exactly like a file a person made.**

### Phase 1 (ships with the framework): AI outside the application

- `ConvertWithAiPanel` on the Upload step. It shows: a short explanation ("Your file does not match our template? An AI assistant can reshape it. Nothing is sent from this application."), numbered steps (download the template; open your AI assistant; paste this prompt; attach your own file; ask for the result as a CSV or Excel file in the template columns; read it through yourself; upload it here), a **Copy prompt** button and a privacy line ("Only share files you are allowed to share; the schedule has no personal data, other imports may").
- The **prompt text is versioned per import type and served from one place**: classpath resources `backend/src/main/resources/imports/prompts/<type>/v<templateVersion>.md`, returned by `GET .../ai-help`. The template version and the prompt version move together. The UI never hard-codes prompt text. The endpoint can append the scope's lookup lists (this league's team names and known venues, following the template scope) so the user's assistant can use the system's spellings; for types with personal data it never appends data. The prompt for `098` is written out in that spec.
- Prompt rules every type follows: state the exact header and column order; one row per record, no merged cells, no blank separator rows; ISO dates (`yyyy-mm-dd`) and 24-hour times (`HH:mm`); copy names exactly as in the source (do not "correct" them, the application resolves names); leave a cell empty rather than guess; add an optional `Notes` column for anything uncertain; never invent rows; report anything it could not read.
- No AI dependency, no key, no cost, no tier gating in Phase 1.

### Phase 2 (designed here, built later): in-application transform

An optional tab on the Upload step: the user uploads their **own** file, the application asks Claude to produce the template rows, and the result is shown as a preview of proposed rows next to the original cell references, then flows into the normal Validate step.

- **AI never writes data and only proposes.** It returns rows in the template shape (text only, **never entity ids**, it is never shown ids). Every AI-derived row is `source = AI_SUGGESTED` and shows a "Suggested" chip until the user accepts it (per row or "Accept all shown"); an unaccepted suggestion cannot be confirmed. Every AI row carries the source cell range it came from, shown beside it, so the user can check against their file. The deterministic validators, matcher and identity check then run unchanged on the accepted rows. The `import_batch.source` is `AI_TRANSFORM` and the batch stores the usage reference.
- **Plugs into the same pipeline** through an `ImportSource` step before `parse`: `TEMPLATE_FILE` (parser) or `AI_TRANSFORM` (model call producing a template file in memory, then the same parser). Nothing after that point knows the difference.
- **Model and key.** Model name from configuration (`app.ai.import.model`), defaulting to a small, fast tier because this is structured extraction; choose by running the fixture set against candidates and recording cost and accuracy. API key from the **environment or a secret manager** (`ANTHROPIC_API_KEY`), never in a database column, never logged, never returned by any endpoint. **The legacy `AiSettings.apiKey` plain-text column is not carried over.** If an admin-editable key is ever required it must be encrypted at rest (envelope encryption with a key from the environment) and write-only in the API.
- **Client library.** Spring AI's Anthropic starter (as the legacy app) or Anthropic's Java SDK; pick when building, behind one `AiClient` interface so the choice is replaceable and tests use a fake.
- **Usage logging.** An `ai_usage_log` table (club, user, feature `IMPORT_TRANSFORM:<type>`, model, input and output tokens, batch id, created at), following the legacy `AiUsageService.log(feature, model, usage)` idea, to support cost visibility and per-club caps. Not in the `041` migration; added with Phase 2.
- **Cost.** A schedule or squad list is a few thousand tokens in and out; expect cents per import. Hard caps: per-club daily call limit and per-call size limit (the 2 MB file limit applies, and large files are rejected rather than chunked in v1).
- **Privacy.** File contents leave the platform to the model provider. Show explicit consent text before the first use per club, store the consent (who, when), never send files for types containing personal data (players, contacts) until the club has accepted a data-processing term and the operator has confirmed the provider's retention terms (POPIA applies to South African clubs). Schedules contain no personal data.
- **Feature toggle by subscription tier.** The platform has `Subscription` and `Product` (`004`), but no per-feature entitlement mechanism exists in the code today. Phase 2 therefore needs a small entitlement check (a `Product` feature flag read through the club's active subscription), plus a platform-level kill switch (`app.ai.import.enabled`). This is part of Phase 2's own spec, not this one.
- The user does not want AI used much inside the application as a first step: Phase 2 is explicitly last (Rollout slice 5) and is only worth building if Phase 1 plus our template proves too hard for users (R15).

## Reuse by future imports

Each is a new handler and template on this framework, with its own short spec stating only what is type specific (columns, identity key, rules, resolution, blockers, whether it offers the scope option):

- **League teams bulk import** (the roadmap item): name, abbreviation; resolution against the club's other leagues and seasons; the creation list is the whole point; identity is `lower(name)` within league and season. Also the natural second consumer to prove the framework's genericity.
- **Players**: personal data, identity matching (duplicate people), verification status; the strictest on AI and retention. Likely offers an "ours" scope when the file is a whole league's registrations.
- **Squads** (players into a team and season): reference resolution of players and teams.
- **Contacts and sponsors**: duplicate detection by email or name.
- **Results** (once the Results module exists): rows that update existing matches, so it uses the opt-in update semantics of principle 8 and plugs a result into the schedule import's deletion blockers.
- **A schedule update import** (reschedules): after `098`, building on the DIFFERS and Update outcomes.

## Test Plan

Per `docs/standards/testing.md`.

| Tier | Coverage |
|---|---|
| Unit (backend) | `ImportServiceImplTest`: state transitions; token issued only at zero errors and all warnings acknowledged; **no commit without a valid token** (missing, tampered, wrong user, expired, stale revision, digest mismatch all rejected, and nothing written in each case, asserted by a repository count); creations digest mismatch rejected; commit re-validates against changed live data (including a newly appeared duplicate) and answers `409` with fresh state; idempotent repeat commit returns the stored report; discard; expiry job; scope mode and template scope are part of the digest; a skipped-not-ours row is never written. `ImportTokenTest`: HMAC round trip, binding to user and revision. `ImportLimits` and file sniffing (magic bytes, extension mismatch, zip bomb sample, `.xlsm` rejected). Every `@Service` method with a rule has a unit test (`backend.md`). |
| Fixture-based parser and validator tests | A directory `backend/src/test/resources/imports/<type>/` of real example files from users, each with an expected-results JSON (parsed rows, issue codes and outcomes per row, proposals). **Every real sheet a user supplies becomes a fixture** (first: `098`'s test example 1), added with its expected output; a parameterised test runs all fixtures on every build. Fixtures are anonymised before commit when they carry personal data. |
| Integration | Testcontainers (`AbstractIntegrationTest`): migration applies cleanly; end-to-end preview, decisions, commit through real HTTP with a real `CLUB_ADMIN`; another club's admin gets `404`; a section-scoped manager gets `403`; `platform_admin` passes; concurrent commits into one scope serialise and the second is `409`; a rollback leaves no entity and no `import_batch_entity` rows; **re-import safety with the dummy handler** (same file twice writes nothing the second time; a record created by hand is treated as existing; two concurrent confirms create each record once); deleting a batch never deletes records it skipped, records of an earlier batch or manual records; the **structural dependants test**; services called without an ambient test transaction (`backend.md`, the lazy-field rule). |
| Contract | OpenAPI additions listed above, additions only. |
| Component (Vitest, Testing Library, Storybook) | `ImportWizard` step flow; `ImportIssueTable` (Problems only filter sends `status`, Exclude toggles, the Skipped not ours section expands and lists rows, phone card layout); `ReferenceResolver` (proposals ordered by confidence, nothing preselected except exact or confirmed alias, resolved count, Create does not write, Identify what is ours mode); `ImportConfirmPanel` (Confirm disabled until zero errors and every warning ticked, the creation and update lists are shown, the skipped-not-ours count is stated, the nothing-saved notice); `ImportResultReport` (Delete import opens check; blockers list); `ConvertWithAiPanel` (prompt from the API, Copy puts the exact text on the clipboard); `importApi` invalidation. |
| End-to-end (Playwright) | One golden path in `098` (upload, resolve, confirm, report, delete). The framework adds none of its own. Not run in CI until Keycloak is available in CI (`095` note). |
| Browser check | Phone, tablet and wide: each step has no horizontal scroll or clipped button. |

## Acceptance Criteria

- No endpoint writes a domain record (match, team, player, ...) before `commit`; `preview` and `decisions` write only the batch row.
- `commit` without a valid, current, same-user confirmation token is refused and writes nothing; so is a token for a different revision of the decisions, and a creations digest that does not match what was shown.
- `commit` re-validates against live data, including record identity; if the data changed in a way that matters it answers `409` with the new review and writes nothing.
- A commit either writes every effective row and every planned creation and update, or nothing.
- A club admin sees every row's status (OK, Warning, Error, Skipped not ours) with a plain-English reason, can filter to problems only (server-side), and cannot confirm while any error exists or any warning is unacknowledged.
- In a type with the scope option, choosing "ours only" imports only rows involving the club's records, lists every other row under "Skipped, not ours" with a count, states that count on the Confirm screen, and records the scope mode on the batch and in the history.
- Every proposal shows a confidence and the reason, and no creation happens that is not in the confirmed creation list.
- Importing the same file twice, or a wider scope after a narrower one, creates nothing that already exists; identical existing records are shown as skipped, never created, whoever created them.
- A second commit of the same batch does not import twice. Two simultaneous imports into the same scope cannot both create the same record.
- Updating an existing record happens only after an explicit per-row or bulk opt-in shown in the Confirm step with old and new values.
- A committed import can be deleted as a whole only when nothing created by it is depended on, and deletion removes only records that batch created; otherwise the response lists every blocker with a link and nothing is deleted. The structural dependants test fails the build when a new foreign key into a created entity's table is not covered.
- A section-scoped manager and another club's admin cannot preview, commit, list or delete a club's imports.
- Files over the limits, of the wrong type, with merged cells or the wrong template version are rejected with a specific message and create no batch rows.
- The "Convert with AI" panel serves the prompt text from the backend, versioned with the template.
- No API key, token secret or file content appears in logs or responses.

## Recommendations and challenges

Each point is labelled; **R** is a recommendation, with my recommended default and the alternative. These are candid and open to being overruled.

- **R1. The token must bind the exact data, not just the batch.** Recommended: the HMAC over a digest of the effective import (as designed), plus single revision. Alternative: a plain random token stored on the batch (simpler, but a later decision change could reuse it unless revoked). The digest design makes principle 1 true by construction, not by discipline.
- **R2. All-or-nothing commit while rows can be excluded in review.** Recommended: yes, as designed: exclusion is an explicit, visible, pre-confirm decision; the commit is all or nothing over what remains; excluded rows are downloadable. Alternative: commit "as many rows as valid" with a per-row result. Rejected as the default because it makes "what exactly was imported" depend on timing and defeats principle 1's "the exact reviewed data".
- **R3. Server-side parsing.** Recommended (justified above). Alternative: parse in the browser for instant feedback; rejected because the server must still validate and the template needs server data. A hybrid (browser reads the file only to show "this looks like an Excel file with N rows") is possible later.
- **R4. Store the original file?** Recommended default: **no**; keep name, SHA-256, size and, for 30 days after commit, the normalised rows. Reason: files can hold personal data, storage today is local disk (`MediaServiceImpl`, not multi-instance safe, noted in `012`), and the normalised rows are what the audit needs. Alternative: store files for 90 days for schedules only to help support; revisit when media storage moves off local disk.
- **R5. Preview retention.** Recommended 24-hour preview expiry and 30-day payload retention after commit. Alternative: keep payload forever (simplest audit, grows `import_batch`, keeps personal data).
- **R6. Concurrent imports.** Recommended: advisory lock per `(club, type, scope)` plus re-validation (as designed). Alternative: refuse a second `PREVIEW` for the same scope while one is open (simpler, but blocks a user who abandoned one).
- **R7. Idempotency.** Recommended: a repeated commit of a committed batch with the same token returns the stored report. Alternative: strict `409`; worse for double clicks and flaky mobile networks.
- **R8. Partial failures and side effects.** Recommended: all writes in one transaction; any later side effect (emails, notifications) runs after commit through a separate, retryable step, never inside it. v1 has none.
- **R9. Template versioning.** Recommended: an integer `templateVersion` per type in the hidden `_meta` and the header set; the parser supports the current and previous version for one release, and an old template gets a clear "download the new template" message. Alternative: reject anything but current. Never infer a version from column guessing.
- **R10. Limits.** Recommended as in "File limits". Challenge: a large league's season is about 130 rows, so 1,000 is generous; a lower cap (300) reduces risk with no real downside. Keep the global 5 MB multipart limit unchanged.
- **R11. Time zones.** The platform has no club time zone today: times are interpreted in `ZoneId.systemDefault()` on the server (`MatchSlots`, `ServerClock`, `OverviewPolls`) and in the browser's zone on entry (`MatchForm`'s `fromDatetimeLocal`). Recommended: the preview takes an IANA `timeZone` (the browser's `Intl` zone, default the server zone), shown on the confirm step and included in the digest; nonexistent or ambiguous local times are errors. Longer term, add a club time zone setting (roadmap). Alternative: always the server zone.
- **R12. Audit.** Recommended: columns on `import_batch` plus `import_batch_entity` (as designed). Alternative: an `import_batch_event` table for a full timeline; add if support asks.
- **R13. Permissions.** Recommended: club admin only for import and delete (a schedule crosses sections). Challenge: a section manager cannot import their own section's fixtures; a later per-type rule (allowed when every affected record is in the caller's sections) needs the roles model (`035`).
- **R14. Remembered aliases can be wrong, and a wrong one is sticky.** Recommended: an alias is only a **proposal source** (ranked first, preselected only on exact normalised equality of the sheet text, still visible in review); scoped to `(club, league)`; created **only** when the user ticks "Remember this match" (default on for links, off for creates); stores the **canonical name** (league teams are per season) not an id; shows who and when; deactivated when the batch that created it is deleted; and a small "Remembered names" list with delete belongs in the league's Teams tab (after the first slice; until then deletion is by deleting the import or via support). Alternative: no aliases (safe, tedious). Middle path if in doubt: remember, never preselect.
- **R15. Ship Phase 1 and the deterministic matcher first; make Phase 2 earn its place.** The unreliable part of imports is not column mapping, it is **names**, which is solved deterministically. Challenge: an in-app LLM transform adds cost, privacy and key-management work for a step users can do in their own AI assistant today. A deterministic "map your columns" step for plain tables is an alternative, but it would not help the first real sheet (merged date block with four-column groups); Phase 1's prompt must be good and tested on that sheet.
- **R16. Deletion is a deliberate exception to "disable, never delete".** Recommended: only via the batch and only with no dependants. Alternative: deactivate imported matches instead; rejected for ghost fixtures, wrong counts and corrupting duplicate detection.
- **R17. Keep the batch payload as jsonb, not a row table.** Recommended for v1. Alternative: an `import_batch_row` table; move to it if a type has tens of thousands of rows.
- **R18. Tier gating only for AI.** Recommended: the framework is available to every club; only Phase 2's model calls are tier and cap controlled because they cost money.
- **R19. Prevent the "wrong place" mistake, not only cure it.** The wizard names the target on every step ("Importing into: Northern Premier League, 2026/27"), the confirm screen repeats it, and the template's `_meta` scope is compared with the chosen scope (`098`).
- **R20. Default for the scope option: "All matches" or "Ours only"?** Recommended default for a league schedule: **All matches in the file**, with "Ours only" one click away. Why: (a) the league page, the Full Schedule PDF, poster and calendar shares (`051`) and the "Only our matches" switch all show non-ours fixtures, so an ours-only import leaves a **partial league schedule** that looks complete but is not; (b) completeness checks (each team once per round) only work with all matches; (c) the cost of "All" is more teams to link or create, but that is exactly the verification the user wants and the aliases make the second season cheap. Alternative: default "Ours only" for less setup (far fewer league teams to resolve, only opponents of our matches) which suits a club that only needs its own fixtures and polls. Because re-import is safe (principle 8), a club can start ours-only and widen later; the default therefore matters less than showing the consequence in plain words on the choice: "Ours only: your fixtures only. League schedule shares will show only your matches." Challenge to the user: if most clubs only ever need their own fixtures, default to Ours only and flip the default per club in a later setting.
- **R21. Updating existing records (DIFFERS) in v1?** Recommended: build the **outcome and the detection** in v1 (the user must see "this exists but the time differs"), default action **Skip**, and the **opt-in Update in v1 but narrow**: only named non-key attributes (for the schedule, time and venue), per row or in bulk, shown old to new in the confirm step, blocked when the existing record has dependants that the change could invalidate (a poll or selection exists for a match whose time changes). Alternative: defer Update entirely and make DIFFERS "skip and tell the user to edit the match by hand" (smaller, safer, but forces 90 manual edits when a league reissues a time table). Alternative 2: default DIFFERS to Update (rejected: the first import may be the correct one and the file the wrong one).
- **R22. Database unique key to stop duplicate records?** Recommended: **no migration**; use the scope advisory lock and the in-transaction identity re-check. Reason: the identity of a match is over resolved sides (own team or league team) and a local-time date derived from an `Instant` and a time zone, which cannot be expressed as a simple unique index without a generated, zone-dependent column; and a unique key would also reject legitimate manual cases (a rescheduled or replay fixture on the same day, existing data). Residual risk: a person creating the same match by hand at the instant an import commits; low and visible. Alternative: a partial unique index on `(league_id, season_id, home_side, away_side, local_date)` for active matches, justified only if duplicates appear in practice.

## Open Questions

Each has a proposed default; unresolved until the user confirms.

1. **Preview expiry and retention** (24 hours, 30 days). Proposed default: as stated.
2. **Is club-admin-only right for import in v1?** Proposed default: yes (R13).
3. **Do we keep original files?** Proposed default: no (R4).
4. **May another club admin continue someone else's `PREVIEW`?** Proposed default: view yes, change and commit no (creator only).
5. **Remembered aliases: on by default?** Proposed default: ticked on for links, off for creates, never auto-applied (R14).
6. **Library approval and versions** (POI, Commons CSV). Proposed default: approved here; pin versions and add the OWASP dependency check to CI.
7. **Resume route** `/manage/imports/:batchId`. Proposed default: yes.
8. **Platform-level import** (a platform admin importing for any club). Proposed default: no.
9. **Phase 2 provider terms and POPIA review** before any personal-data AI. Proposed default: schedules only in Phase 2's first release.
10. **Scope option default** (R20). Proposed default: All matches.
11. **Update in v1** (R21). Proposed default: detect and show DIFFERS, default Skip, narrow opt-in Update in v1 with the dependants block.
12. **Persist the chosen scope mode as a club preference?** Proposed default: remember the last choice per club in the browser only.

## Rollout Notes

Slices, each shippable and each behind the approved spec. The framework is built and proven by the first consumer, so slices 1 to 3 are normally one branch of two PRs with `098`.

1. **Framework backend** (`041` migration, entities, `ImportService`, controller, token and limits, expiry job, history, identity and re-import mechanics, scope mode, `deletion-check` and `delete` mechanics, exceptions, `GlobalExceptionHandler` mapping and the `backend.md` amendment, `openapi.yaml`, unit and integration tests, the structural dependants test, a **dummy test handler** used only in tests so the framework is proven without a consumer).
2. **Framework UI** (`importApi.ts`, `ImportWizard` and its shared components with stories and tests, after the Claude Design pass; a Storybook fake handler).
3. **First consumer: `098`** (handler, template, matcher, schedule rules, entry points, the user's example sheet as the first fixture, E2E golden path). Slice 3 of `098` is where the framework is declared done.
4. **Phase 1 AI help** ships inside slice 3 (the panel and the prompt resource), no extra work after it.
5. **Phase 2 in-app AI transform**: its own spec (entitlement, consent, `ai_usage_log`, `AiClient`, cost caps, privacy), only if Phase 1 proves insufficient (R15).
6. **Next consumers**: league teams bulk import first (smallest, exercises creation lists and aliases without matches), then players and squads.

**`docs/roadmap.md` entries needed** (a human updates the living index when this is approved; this spec does not edit it):
- Replace the `070` line "**Bulk CSV import** of league teams" with a pointer: resolved as a future consumer of `097` (second consumer after `098`), and add a "Deferred by `097`" section: Phase 2 in-app AI transform; players, squads, contacts, sponsors and results imports; schedule update import; remembered-names management screen; per-club default for the scope option; import history as a cross-club platform view; storing original files once media storage moves off local disk; per-type section-scoped import rights once roles exist.
- Note under the future Results module: it must register a `MatchResult` blocker with the schedule import's delete (the structural test will fail until it does).
- Under the Match and Matches items: a club time zone setting; a "matches involving our teams" default for the club-admin matches list if league-wide imports clutter it (`098` R3).

`docs/architecture.md` is not affected (no change to Person, Contact, RoleAssignment, Club or auth relationships). `docs/standards/backend.md` gains the exception-detail amendment above; `docs/standards/frontend.md` gains a short "Imports" paragraph naming the routes and shared components once built.
