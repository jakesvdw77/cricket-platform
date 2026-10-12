# 098: League Schedule Import

**Depends on:** `097-import-framework.md` (the flow, batch model, token, endpoints, wizard, undo rules, scope option and re-import principles this spec uses unchanged; read it first), `029-league-management.md` (`League`, `Season`, `Match`, `LeagueAffiliation`), `050-league-schedule-and-fixtures.md` (lifts its "no bulk fixture import" Non-goal; `Match` logos, `LeagueFixtures`), `051` (Full Schedule PDF, poster and calendar shares), `070-league-teams.md` (per league and season `LeagueTeam`, `lower(name)` uniqueness including inactive rows, `Match` side rules, "Must not change" sites, `CopyLeagueTeamsDialog`), `091-leagues-gold-standard.md` and `095-league-edit-gold-standard.md` (the league page and edit page Schedule tabs). `096` is not present in `docs/specs/` on this branch (see `097`).
**Status:** approved (open questions resolved with their defaults, 2026-10-10); not planned or built. First consumer of the framework; also its proof (`097` Rollout slice 3).

## Problem & Goals

A league publishes a whole season's schedule as a spreadsheet, in its own layout, and a club admin has to type each fixture into `MatchForm` one at a time (about 90 to 130 matches for a ten-team league). Team names in these sheets rarely match the system's names (upper case, abbreviations, "VETERANS" for "Vets"), so careless typing or a careless import creates duplicate teams, and a second import can duplicate matches.

This spec adds **Import schedule** for a league and season: a club admin downloads our template (or has an AI assistant convert the league's sheet into it, outside the application), uploads it, resolves every team name by **linking or creating league teams** with confidence-ranked proposals, reviews a fully validated preview, confirms, and gets a report. A mistaken import can be deleted again while nothing in it has a poll, selection or result. Importing again, with a corrected file or a wider scope, never duplicates matches.

**Goals**
- Import a season's fixtures into one league and season in one reviewed, confirmed, all-or-nothing step.
- Let the user choose, on the template and on the import, **"our teams only"** or **everything in the file**.
- Resolve every team name to an existing team (ours or a league team, current or previous seasons) before offering to create one; creating is always confirmed.
- Never create a duplicate match, whoever created the existing one.
- Provide a guarded delete of an import (matches it created, and the league teams it created if unused).
- Provide the AI-outside-the-application prompt for converting league sheets (Phase 1, `097`).

## Non-goals

- **Parsing the league's own layout.** The merged date cell, blank separator rows and four-column match blocks of the user's sample sheet (test example 1) are not read by the parser. Reshaping them into the template is the human or AI conversion step (see "Layout problems that belong to the conversion step").
- **Importing results, scores, standings.** No such data exists (`Match` has no result fields).
- **Creating anything but matches and league teams.** No `Team` (our own team), no `LeagueAffiliation`, no season, no league, no venue records, no polls, no sides, no playing XI. Linking to one of our own teams never affiliates it (a warning says so).
- **Free-text opponents.** The import never creates a free-text-name side (`070`'s "Other"); an unrecognised name must be linked or created as a league team. Allowing free text would reintroduce the duplicate-name problem this exists to prevent (R13).
- **A venue entity.** `Match.venue` is a free-text string today; venues stay text. Spelling help is a suggestion only (R12; roadmap for a venue list).
- **Time zone setting for the club.** Times are read in an explicit zone chosen at preview (`097` R11).
- **Importing into several leagues or seasons from one file.** One league and one season per import.
- **Bulk update of existing matches.** Only the narrow, opt-in update of time and venue described below (R7).
- **Deleting individual matches or a general match delete.** Delete exists only for a whole import batch.
- **Section-manager access.** Club admin only (`097` R13).
- **Round or matchday numbers.** The template has no Round column; rounds are inferred from dates only for checks (R8). A Round column is a possible template version 2.

## User Stories

- As a club admin on a league's Schedule tab, I can download a template for this league and season, choosing whether its drop-downs list only our teams or also the league's teams.
- As a club admin, I can upload the filled template (Excel or CSV), and see every row checked before anything is saved.
- As a club admin importing only my own fixtures, I can tell the system which team names in the file are ours, so the matches between other teams are skipped, listed and counted, and only my opponents need to be linked or created.
- As a club admin, I am shown, for every team name the system does not recognise, the most likely existing teams with a confidence and the reason, so I link instead of creating a duplicate.
- As a club admin, I must confirm the exact list of league teams that will be created before they are.
- As a club admin, I can import the same file again, or the full schedule after an own-teams-only import, and only new matches are created.
- As a club admin, I get a report of what was created, skipped as already existing, skipped as not ours, updated and acknowledged.
- As a club admin who imported into the wrong league, I can delete that import if none of its matches has a poll, selection, announced team or result, and I am told exactly which matches block it otherwise.

## What exists today (relevant facts, with files)

- `Match` (`backend/.../domain/Match.java`): `clubId`, `leagueId` (optional), `seasonId` (required), `matchDate` (an `Instant`), `venue` (free `String`), `active`, side fields per `070`: each side is a `*TeamId` (own team) or a `*TeamName` (named opponent, with `*LeagueTeamId` null for free text or set for a league team). Name and logo of a league-team side are copied onto the match by `MatchServiceImpl` and kept in step by propagation on league-team edit. There is no match status or result column.
- `MatchServiceImpl.create` validates sides, logo, league and season belong to the club, league-team league/season equals the match's, no inactive league team newly selected, no same league team on both sides, and `accessService.assertCanAdministerAnySection`. A match with no own-team side resolves no section and is reachable only by a club-scope admin. `deactivate`/`reactivate` exist; **there is no delete**.
- `LeagueTeam` (`70`): per `(league, season)`, `name`, `abbreviation`, `logoUrl`, `active`; unique `lower(name)` per league and season **including inactive rows** (`ux_league_team_name`); `LeagueTeamService` has create, update, deactivate, reactivate, remove (delete or deactivate), copy (checklist, duplicates skipped).
- `LeagueAffiliation`: which of our `Team`s play in a league in a season. The matches endpoint does **not** require an own team to be affiliated.
- `Season`: `label`, `startDate`, `endDate` (`LocalDate`), `active`.
- **What references a match** (migrations `021`, `023`, `032`, `034`, `038`): `match_availability_poll` (`MatchAvailabilityPoll`, one per match and own team; its own poll answers hang off it), `match_side` (`MatchSide`: one per match and own team; captain, wicketkeeper, 12th man, `announced`), `match_side_player` (the selected players, via the side), `match_squad_member` (per-fixture squad pool for group polls, `032`), `section_availability_window_match` (a match covered by a group availability window, `032`/`034`, unique on match). **Communications are not persisted anywhere** (team sheets and schedules are shared through generated PDFs and links by `ShareScheduleDialog`, `TeamSheetCommunicationDialog`; there is no log), so "a communication was sent" cannot be detected.
- **"Has a result" today:** nothing. `OverviewResultDto` is an empty placeholder; no `ResultService`. The rule below is a seam the future Results module plugs into.
- **UI:** `ui/src/pages/manage/leagueEdit/LeagueEditScheduleTab.tsx` (a `ContentControlsLine` with outlined **Share** and filled **Add match** in `pinned`, then `LeagueFixturesTable`, no filters); `ui/src/pages/manage/league/LeagueScheduleView.tsx` (the league page Schedule view: `FilterBar`, a content line with Only our matches and View entire season, no action buttons; Share schedule lives in the header of `LeagueViewLayout`); `leagueFixtureFilters.ts` (`isOurMatch`: a side has a `teamId`); `ConfirmDialog`; `CopyLeagueTeamsDialog`. Routes in `ui/src/App.tsx`: `fixtures/leagues/:leagueId/{schedule,teams,conditions}` and `.../edit`. Uploads use `ui/src/api/mediaApi.ts` (`FormData`). Spring's multipart limit is 5 MB (`application.properties`).
- **Libraries:** none for Excel or CSV in `pom.xml` or `package.json` (`097` approves Apache POI and Commons CSV).

## Entry points and routes

- **Edit page Schedule tab** (`LeagueEditScheduleTab`): in the `pinned` slot, order **Share**, **Import schedule** (outlined, `UploadFileOutlined` icon), **Add match** (filled). Beside the scope text, an **Imports** text-button with a count opens `ImportHistoryPanel` (a `SidePanel`) filtered to this league and season (`scopeKey = league:<id>|season:<id>`), where each import can be opened (report) or deleted. On a phone the three actions follow the existing wrap rules (full width stack) and Imports moves into the content line.
- **League page Schedule view** (`LeagueScheduleView`): the same outlined **Import schedule** and **Imports** controls in a `pinned` slot of its `ContentControlsLine` (there is no Add match on this view today; the button does not add one). The season comes from the page's Season pill.
- **Wizard route:** `/manage/fixtures/leagues/:leagueId/schedule/import?seasonId=<id>` (page `pages/manage/leagueImport/LeagueScheduleImportPage`, composing the generic `ImportWizard`, `097`). Resume and report: the generic `/manage/imports/:batchId`. Both under `/manage`, so the manager shell and expired-session rules apply. Back returns to the originating Schedule tab (`?tab=schedule` on the edit page).
- Disabled with a tooltip when the club has no season ("Create a season first", the existing wording) or the league is inactive.

## The template

**Template version 1** (`templateVersion = 1`, type `LEAGUE_SCHEDULE`). Excel (`.xlsx`) is primary; a CSV with the same header is accepted. Download: `GET /api/v1/manage/clubs/{clubId}/imports/LEAGUE_SCHEDULE/template?format=xlsx|csv&leagueId=&seasonId=&templateScope=OURS_ONLY|OURS_AND_OTHERS` (`097` API).

**Sheets (xlsx):**

1. **Schedule** (the data sheet): one header row, then one row per match. No merged cells, no blank separator rows (blank rows are ignored, not meaningful).
2. **Instructions**: a short purpose line, a paragraph per column (accepted formats), the rules ("one row per match; do not merge cells; copy team names as they appear in your source; you will check every team name in the next step"), the limits (1,000 rows, 2 MB), the template version, and a formatted **example row**. The example is on this sheet and **not** on the data sheet, so it can never be imported by accident (R11).
3. **Lookups**: columns for the chosen template scope (below).
4. **`_meta`** (very hidden): `template=LEAGUE_SCHEDULE`, `version=1`, `clubId`, `leagueId`, `seasonId`, `templateScope`, `generatedAt`. Used only to warn on a scope mismatch; never trusted for access.

**Columns of the Schedule sheet** (order follows the user's source layout, team, team, venue, time, so conversion is closest):

| Col | Header | Required | Meaning and format |
|---|---|---|---|
| A | `Date` | Yes | The match day. Cell formatted `yyyy-mm-dd`. |
| B | `Home team` | Yes | The first-named team, as written in the source. |
| C | `Away team` | Yes | The second-named team. |
| D | `Venue` | No (a warning when blank) | The ground, as written in the source. |
| E | `Time` | Yes | Local start time, `HH:mm`. |
| F | `Notes` | No | Free text for the human or AI converter ("time unclear in source"). Shown in the preview next to the row, never saved on the match. |

**Template scope (`templateScope`)** decides the Lookups sheet and the drop-downs:

- **`OURS_ONLY` ("Our teams only")**: a column **Our teams** (the club's active teams affiliated to this league and season; if none are affiliated, all the club's active teams), and a column **Known venues**. Drop-downs on Home team and Away team offer Our teams; Venue offers Known venues.
- **`OURS_AND_OTHERS` ("Our teams and the league's teams, current and previous seasons")**: the above plus **League teams this season** (active `LeagueTeam`s of this league and season), **League teams from previous seasons** (names that exist in this league's earlier seasons and not in this season, de-duplicated by `lower(name)`, each with its season label), and **Known venues** from this club's matches across leagues.

All drop-downs are **list validations that warn rather than stop** (`showErrorBox` off in POI, with an informational prompt): a name that is not in the list is accepted silently, so the template reduces mismatches without blocking anyone. Drop-down sources are named ranges on the Lookups sheet (an inline list is limited to 255 characters).

**Template versioning:** the parser accepts version 1; a file declaring another version (hidden `_meta`, or for CSV a differing header set) is rejected with "This template is from a different version. Download the latest template." (`097` R9). Header matching is case-insensitive with a small alias list (`Home`, `Team 1`, `Away`, `Team 2`, `Ground`, `Start`).

## Parsing rules

All applied by the server (`097` "Template generation and parsing"). Anything unparseable is a row **Error** with the cell reference, never a silent guess.

**Dates** (column `Date`):
- A real Excel date cell is read as is (including a numeric Excel serial in a cell whose format is a date; a bare number between 20000 and 80000 in a text-formatted or CSV cell is read as a 1900-system serial and flagged as a warning "read as an Excel date number").
- Text accepted: ISO `2026-09-13`; day-first `13/09/2026`, `13-09-2026`, `13.09.2026`, `13/9/26`; day-month-name `13 Sep 2026`, `13-Sep-26`, `13 September 2026`, **`13-Sept-26`**. Month names are matched case-insensitively on the first three letters (so `Sep`, `Sept`, `SEPT`, `September` and the other months' usual variants such as `Mar`, `Marc`) and full English names.
- **Two-digit years** are read as `20yy` (`26` is 2026). The Validate step shows one file-level note "Two-digit years were read as 20yy" (not a warning, not acknowledged); a resulting date outside the season is an error as below.
- **Numeric dates are day-first only** (South African convention). `07/09/2026` is 7 September. If a file contains numeric dates where both orders are possible for every such row, one warning "Dates were read day first; check 07/09/2026 is 7 September" is raised once for the file.
- Month-first forms (`09/13/2026`) fail to parse unless the day is greater than 12 and the month cannot be read day-first, and are then an error ("month cannot be 13"), never reinterpreted.
- Weekday names in the cell (`Sun 13 Sep`) are accepted and ignored for parsing, then used only by the weekday check.

**Times** (column `Time`): `HH:mm`, `H:mm`, `HH.mm`, `HHhmm` (`14h30`), `HH:mm:ss` (seconds dropped), 12-hour `2:30 pm`, and an Excel time fraction. `08:00`, `8:00`, `8.00` are all 08:00. Blank, text that is not a time, or a value of 24:00 or more is an **Error** (no silent default time). Seconds and a date part on the time cell are ignored.

**Time zone:** the local time is combined with the date and converted to `Match.matchDate` (an `Instant`) in the IANA zone sent with the preview (browser zone by default, `097` R11), shown on the Confirm screen. A local time that does not exist or is ambiguous at a daylight-saving change is an Error.

**Teams:** trimmed, internal whitespace collapsed, case preserved for display; never altered before resolution. **Venues:** trimmed text; stored as typed unless the user accepts a suggested existing spelling.

**Blank and merged cells:** the template is one row per match, so blank cells are simply missing values (an Error for required columns, a warning for Venue), fully blank rows are dropped, and **merged regions are rejected** as a file-level error with the range, "Merged cells are not supported; unmerge and repeat the value on every row".

## Scope: "our teams only" versus "all matches"

On the Upload step the user chooses (a `CompactToggleGroup`, `097` principle 7):

- **All matches in the file** (`scopeMode = ALL`).
- **Only matches involving our teams** (`scopeMode = OURS_ONLY`).

The chosen mode and the template scope are stored in `import_batch.scope` and `scope_mode` and shown in the history and report.

**Identify our teams in this file** (the early step, `OURS_ONLY` only; in `ALL` mode the same linking happens inside normal resolution):
- The server lists the **distinct team names in the file** (counted, with the rows each appears in).
- Each name gets a suggested link to one of **the club's own teams** (`Team` of this club, active), using the matcher below and remembered aliases (confidence, reason). Exact normalised matches and previously confirmed aliases are shown ticked as "ours"; everything else is unticked. The user ticks which names are ours and picks the club team each links to (a name can only be ours if linked to one of our teams).
- Rows where neither side is one of ours get `outcome = SKIPPED_NOT_OURS`.

**What the user sees for skipped rows:** a **Skipped, not ours (N)** counter and an expandable section on the Check and Review steps listing every skipped row (date, teams, venue, time) and a count on the Confirm screen ("42 of 90 rows do not involve your teams and will not be imported; 48 matches will be created"). They are also in the "rows not imported" CSV. Nothing is hidden.

**The benefit** (stated on the choice, in plain words): in "ours only" only the **opponents of our matches** need to be linked or created as league teams, typically 9 or fewer in a ten-team league instead of every team, so there is far less to resolve and fewer league teams are created. The trade-off, also stated on the choice: league schedule shares and the league page will show only your matches (R3, R10).

**Which validations apply in which mode** (the column "Mode" in the validation table): rules about the whole round or the whole league (each team once per date, a bye or missing team on a date, whole-league completeness) apply **only in `ALL`**; they are skipped in `OURS_ONLY` because the rows needed are deliberately absent (the file is still scanned, but findings about teams that are not ours are not raised). Rules about our own teams (an own team on two matches at overlapping times, an own team twice on one date, our venue clashes, same-club derbies, weekday, dates, times) apply in both. Venue clashes in `OURS_ONLY` consider our matches in the file and **all existing matches** (any creator) at that venue.

## Match identity, duplicates and re-import (`097` principle 8)

**Identity key** (for duplicate detection against **all existing matches of the same league and season**, created by earlier imports or manually, active or inactive):

`(leagueId, seasonId, unordered pair of side identities, local date)`

- **Side identity** is compared by **resolved identity, never text**: an own team is its `teamId`; a league team is its `leagueTeamId`; an existing match whose side is **free text** (a manual match typed by hand, `*LeagueTeamId` null) is compared by the normalised name of the side against the normalised name of the resolved team (exact match after normalisation and remembered aliases counts as the same side; a merely similar free-text name raises POSSIBLE DUPLICATE, not DUPLICATE). A manual match is therefore an existing duplicate.
- **The date is in the key** because in a double round-robin the same pair legitimately meets again on another date. The date is the **local date** in the import's zone.
- **The key is the unordered pair**, not (home, away). This is a deliberate refinement of the "league, season, home, away, date" proposal: a sheet or an earlier manual entry that lists the same fixture the other way round must not create a second match. Which team is home is a **non-key attribute** (shown as DIFFERS "home and away swapped"; not updatable in v1, R7).
- **Time and venue are non-key attributes.** The same pair on the same date with a different start time or venue is **DIFFERS**, not NEW: two matches between the same teams on the same date is almost always a correction, and a true same-day replay is rare enough to be handled by hand. Time compares to the minute in the import's zone; venue compares after normalisation (case, spaces, punctuation).

**Per-row outcomes shown in the preview** (generic chips from `097`):

| Outcome | Rule | Default action | Confirm effect |
|---|---|---|---|
| **NEW** | No existing match with this key and no near match. | Create | none |
| **DUPLICATE** | Existing match with the same key and the same time and venue. | **Skip**; shown as "Already exists" (the existing match is linked), never created | none (not a warning) |
| **DIFFERS** | Existing match with the same key but a different time and/or venue (or home/away orientation). The row shows old and new values. | **Skip** | Needs a visible decision only if the user opts in to update; otherwise no acknowledgement |
| **POSSIBLE DUPLICATE** | Not the same key, but: (a) the same pair already plays within `windowDays` (default **14**, adjustable 1 to 60 on the Upload step) of the row's date (this also catches a rescheduled fixture); or (b) the same pair now meets more times in the season (existing plus this file) than the most meetings of any pair in the file (for example a third meeting in a double round-robin); or (c) a similar free-text opponent name on an existing manual match. | Held: **Warning** to acknowledge ("These teams already play on 20 Sep 2026"); the row is created unless the user excludes it | Warning must be acknowledged |

**The rescheduled-fixture case:** a rescheduled fixture (same pair, a different date) cannot be told from a second-round fixture by data alone. It is therefore shown, never decided silently: the nearby-date and extra-meeting warnings above list the other date(s) and let the user decide (keep both, or exclude this row). The user can later correct the date by editing the match.

**Duplicates within the file itself** (same key twice): **Error** `DUPLICATE_ROW_IN_FILE` when identical in time and venue, `CONFLICTING_ROW_IN_FILE` when the key matches but time or venue differs; the message names both rows; the user excludes one (the wizard proposes excluding the later one).

**Updating existing matches (opt-in, narrow, R7):** a DIFFERS row can be switched to **Update**, per row or with "Update all N differing matches" in bulk, only for **time and venue**. The Review step lists each update old to new and it is part of the confirmation digest. **Blocked** (the opt-in is disabled with the reason) when the time would change and the match has any dependant (poll, group-poll coverage, squad pool, selection, announced team, result), because polls, slots and selections are tied to the time; a **venue-only** change on a match with polls or an announced team is allowed but raises a Warning ("this match has a poll; players are not told about the venue change"). The update goes through `MatchService.update` (so all normal validation applies) with the existing values for every other field. `import_batch_entity` records an `UPDATED` entry with the previous values; **the batch that created the match is unchanged**.

**Whole-file check:** if the file's SHA-256 or its normalised-rows hash matches an earlier `COMMITTED` (not `DELETED`) batch for this league and season, the Upload step warns "You imported this file on 12 Oct 2026 (Jaco). Importing it again skips every row that already exists", and the preview shows exactly the outcome per row (normally all DUPLICATE and nothing NEW). A different league or season with the same file is also flagged ("This file was imported into another league").

**Re-import after a scope change** (ours only, then all): the first batch's matches are DUPLICATE (same key); only the additional matches are NEW. Teams created by the first batch are **linked, not recreated**: in the second import's resolution step an exact-name match to a league team created earlier is the top proposal (confidence "Exact: created by an earlier import"), and remembered aliases from the first import (if the user ticked Remember) rank first; nothing is preselected except an exact normalised match or a confirmed alias. If the user ignores the proposal and chooses Create, the name collision error (`lower(name)` index) stops it.

**Concurrency and the commit re-check:** two imports for the same league and season at once serialise on the scope advisory lock (`097`); the second's commit re-validates duplicates against freshly committed rows inside its transaction, finds them as DUPLICATE and answers `409` with the new review (nothing written), so a race cannot create duplicates. **No database unique key and no migration for this** (`097` R22): the identity is over resolved sides and a zone-dependent local date, which a unique index cannot express without a generated column, and a unique index would also reject legitimate manual cases. A service-level check under the lock is enough; the residual risk is a person creating the identical match by hand during the commit.

**Deleting a batch and re-import:** deletion removes only matches **that batch created** (`CREATED`), never matches it skipped as duplicates, never matches of an earlier batch and never manual ones; see "Deleting an imported schedule".

## Validation list

Every rule is deterministic, runs on the server, and gives a plain-English message with the row (and cell) reference. **Mode**: `B` both modes, `A` only in `ALL`. Severity: **Error** blocks confirm until fixed, resolved or the row excluded; **Warning** must be acknowledged (one tick per code, rows listed); **Note** is informational.

| Code | Severity | Mode | Rule and message |
|---|---|---|---|
| `FILE_REJECTED` | Error (file) | B | Not `.xlsx` or `.csv`, over limits, unreadable, wrong or unknown template version, missing required header, merged cells. Creates no batch rows. |
| `LEAGUE_OR_SEASON_INVALID` | Error (file) | B | League inactive, or not this club's, or season not found. |
| `TEMPLATE_SCOPE_MISMATCH` | Warning | B | The template was generated for another league or season ("This template was made for X, 2025/26"). |
| `FILE_IMPORTED_BEFORE` | Warning | B | Same file or same rows imported before (above). |
| `DATE_INVALID` | Error | B | Missing or unreadable date, month 13, day 31 of a 30-day month. |
| `DATE_OUTSIDE_SEASON` | Error | B | Date outside the season's start and end ("13 Sep 2026 is outside 2026/27, 1 Oct 2026 to 31 Mar 2027"). If more than half the rows are outside, one file-level Error suggests the wrong season was chosen. The row can be excluded; fix the season dates if the season is wrong (R8). |
| `TIME_INVALID` | Error | B | Missing, unreadable, or non-existent local time. |
| `TEAM_MISSING` | Error | B | Home or away blank. |
| `TEAM_UNRESOLVED` | Error | B | A team name is not yet linked to or created as a team (cleared by the resolution step). |
| `TEAM_SAME_BOTH_SIDES` | Error | B | After resolution both sides are the same team ("Team plays itself"), including two different sheet names resolved to the same team. |
| `TEAM_NAME_COLLISION` | Error | B | A team chosen to be created clashes (case-insensitive) with an existing league team of this league and season, active or inactive ("A league team called 'Brits Vets 1' already exists (inactive): link it or reactivate it first"). |
| `TEAM_INACTIVE` | Error | B | The linked league team is inactive (`070` forbids newly selecting it): reactivate it in the Teams tab first, or choose another. |
| `DUPLICATE_ROW_IN_FILE` / `CONFLICTING_ROW_IN_FILE` | Error | B | Same match twice in the file (above). |
| `OWN_TEAM_OVERLAP` | Error | B | One of our teams has two matches (in this file or any existing match in any league) whose start times are less than **120 minutes** apart on the same date (`OWN_TEAM_MIN_GAP_MINUTES`, constant). |
| `OWN_TEAM_SAME_DATE` | Warning | B | One of our teams has more than one match on the same date (further apart than the gap above). |
| `TEAM_TWICE_SAME_DATE` | Warning | A | Any team (not only ours) appears on more than one row of a date, "each team once per round" ("PRETORIA 1 plays twice on 13 Sep"). |
| `TEAM_MISSING_ON_DATE` | Warning | A | A date at which at least half the file's teams play and a team does not ("no match for SINOVILLE 1 on 20 Sep: bye or a missing row?"). Raised once per team and date, shown in a date-level list. |
| `VENUE_TIME_CLASH` | Warning | B | Two matches at the same venue (normalised) on the same date whose start times are less than **180 minutes** apart (`VENUE_MIN_GAP_MINUTES`), including identical times, counting existing matches of any creator. In `OURS_ONLY` only clashes involving a match we would create. The user's sample (08:00, 11:00, 14:30 at one venue) passes. |
| `WEEKDAY_MISMATCH` | Warning | B | When at least 60% of the file's dates fall on one weekday, a row on another weekday is flagged ("Most matches are on Sundays; 15 Sep is a Tuesday"). Computed over all file rows, raised on rows we would create. Weekday words in the cell are checked against the date. |
| `SAME_CLUB_DERBY` | Warning | B | Both sides are our own teams, or the two sheet names share a base name with different numeric suffixes (LAUDIUM 1 v LAUDIUM 2, POLICE 1 v POLICE 2): "Possible same-club match, check this is intended". Shown for review, never an error. |
| `OWN_TEAM_NOT_AFFILIATED` | Warning | B | A linked own team is not affiliated to this league this season. The import does not affiliate it. |
| `VENUE_MISSING` | Warning | B | No venue. |
| `VENUE_SPELLING` | Note | B | The venue differs only by case, spacing or punctuation from an existing venue; the existing spelling is applied (listed in the Review summary). A similar but different spelling is a suggestion in the resolver, never applied silently. |
| `POSSIBLE_DUPLICATE_NEARBY` / `MEETINGS_EXCEED` / `POSSIBLE_DUPLICATE_FREE_TEXT` | Warning | B | See the identity section. |
| `ROW_DIFFERS` | Note (Warning when an update is chosen on a match with polls and a venue-only change) | B | See the identity section. |
| `ALREADY_EXISTS` | Note | B | Identical match exists; skipped. |
| `SKIPPED_NOT_OURS` | Note | `OURS_ONLY` | Row involves none of our teams; not imported. |
| `DATE_TWO_DIGIT_YEAR` / `DATE_DAY_FIRST` | Note / Warning | B | See parsing rules. |
| `TWO_NAMES_ONE_TEAM` | Warning | B | Two different sheet names were resolved to the same team ("POLICE 1 and POLICE ONE both link to Police 1"). |

Whole-league completeness (every team present on every round) is the combination of `TEAM_TWICE_SAME_DATE` and `TEAM_MISSING_ON_DATE` and is `ALL` only. Severity choices and the two gap constants are recommendations, revisited in R8.

## Team resolution

The core of principle 3. Resolution works on the **distinct normalised team names** in the file (10 decisions for the user's sample, not 30), not per row, and applies to every row that name appears in. In `OURS_ONLY` it runs only for the opponents of our matches.

### Normalisation and matching (deterministic, no AI)

A `TeamNameMatcher` (a `@Component` in `service.support`, unit-tested to exhaustion) produces ranked candidates for a name:

1. **Normalise:** fold diacritics, upper-case for comparison, replace `&` with AND, strip punctuation, collapse whitespace; split the name into a **base** and a **suffix** (a trailing number, ordinal such as `1st`, or a single letter team marker `A`/`B`).
2. **Synonyms and abbreviations** from a maintained table (`team-name-synonyms.yml`): `VETERANS = VETS = VETERAN`, `CC = CRICKET CLUB`, `OB = OLD BOYS`, `HS = HIGH SCHOOL`, `UTD = UNITED`, `SPORTS CLUB = SC`, and similar; tokens equal after synonym expansion score as exact with the reason "VETERANS = VETS".
3. **Acronyms and initialisms:** a sheet token of 3 to 8 capital letters (for example `PHSOB`, `CBCOB`) matches a candidate whose significant tokens, in order, start with those letters (`PHSOB` = **P**retoria **H**igh **S**chool **O**ld **B**oys), ignoring stop words (`OF`, `THE`, `AND`); the reverse (a candidate that is an acronym) also matches. Reason: "PHSOB = initials of Pretoria High School Old Boys".
4. **Numeric suffix rule (hard):** if both names have a suffix and the suffixes differ (`POLICE 1` and `POLICE 2`), the candidate is **never proposed as the same team** (shown only as a "sister team" hint with no Link action, because two teams of one club are different teams). A suffix on one side only (`PRETORIA` and `PRETORIA 1`) is proposed at medium confidence with the reason "no team number in the sheet".
5. **Token similarity** (Jaccard over tokens, then Jaro-Winkler or edit distance for typos) for what remains; each contributes a reason ("one letter different").
6. **Remembered aliases** first (below).

**Confidence bands** shown as a chip with the numeric score: **Exact** (100, normalised equal or an alias), **High** (90 to 99: synonym or acronym equal), **Medium** (70 to 89), **Low** (below 70, listed but collapsed). Only Exact and alias candidates are preselected; every other proposal needs an explicit click ("nothing is linked on the user's behalf"). Each candidate lists its **reasons** as chips ("VETERANS = VETS", "acronym", "same team name last season", "remembered from an import on 5 Oct 2026", "created by an earlier import").

### Where candidates come from

Searched in this order and shown grouped, so the user sees where each lives:

1. **Remembered aliases** for this club and league.
2. **Our teams affiliated to this league and season.**
3. **League teams of this league and season** (active, and inactive shown disabled with the reason).
4. **League teams of this league in previous seasons.**
5. **League teams of the club's other leagues, all seasons.**
6. **Our other teams** (not affiliated to this league), with the `OWN_TEAM_NOT_AFFILIATED` warning if chosen.

### The user's choices per name

- **Link to one of our teams** (source 2 or 6): the match side becomes an own-team side (`homeTeamId`/`awayTeamId`). Implication stated in the card: own-team sides are the ones that get polls, selection and section access.
- **Link to an existing league team of this league and season** (source 3): the side uses that `LeagueTeam`.
- **Link to a team from a previous season or another league** (sources 4 and 5): because league teams are **per league and season** (`070`), "linking" means **copying that league team into this league and season** as a new `LeagueTeam` (name, abbreviation and logo reference), exactly the `070` copy semantics, shown on the Confirm screen as "Will be copied from 2025/26" (R4). The card says so before the user clicks.
- **Create as a league team**: pre-filled with a **tidied name** (editable): case folded to title case except tokens with no vowels or short all-capital tokens that stay as typed (`PHSOB`, `CBCOB`), numerals kept; an optional abbreviation; a duplicate check against `lower(name)` for this league and season shown live (`TEAM_NAME_COLLISION`). **Creating never happens at this step**: it is recorded as a decision and listed on the Review step for explicit confirmation.
- **Skip these rows** (exclude every row containing the name).
- The user can tick **Remember this match** (default on for links, off for creates, `097` R14).

A name with an Exact proposal and no other candidates is shown pre-resolved but still listed with its link, so the user sees and can change every resolution ("10 of 10 teams resolved").

### Confirming creation (principle 3)

Everything that will be created is one explicit list on the Review step, grouped: **New league teams** (name, abbreviation), **Teams copied from another season or league** (with the source, for example "Brits Vets 1, copied from 2025/26"), each row with a tick-free "Edit" back to the resolver. The Confirm button text includes the count ("Confirm and create 6 teams and 90 matches"). The commit refuses unless `confirmedCreationsDigest` equals the digest of exactly that list (`097`).

### Remembered aliases

Stored in `import_alias` (`097`): kind `TEAM`, scoped to `(club, league)`, mapping the normalised sheet text to an **own team id** or to a **canonical league team name** (names, because league teams are per season, so the alias keeps working next season by resolving the name to that season's row, or copying it). Never auto-applied (R5).

## How matches are created

`LeagueScheduleImportHandler.commit` runs inside the framework's single transaction, in this order, **only through existing services**:

1. Create league teams: new ones through `LeagueTeamService.create`; copies through the shared copy path of `070` (`LeagueTeamService`; the handler never writes `league_team` directly). Record each in `import_batch_entity` as `LEAGUE_TEAM`, `CREATED`, with `detail.copiedFrom` where relevant.
2. Create matches through a new `MatchService.createBatch(authentication, clubId, List<CreateMatchRequest>)` that runs the same validation as `create` per item (so `070`'s rules apply: league and season belong to the club, the league team belongs to this league and season, not inactive, not the same on both sides) without re-fetching shared lookups per row. Fields per match:
   - `clubId` the acting club; `leagueId` and `seasonId` the import's; `active = true`.
   - **Home** = the first (`Home team`) column's team, **away** = the second. An own-team side sets `homeTeamId`/`awayTeamId` (`*LeagueTeamId` null, name null); a league-team side sets `*LeagueTeamId`, and the service fills `*TeamName` and `*TeamLogoUrl` from the league team (`070`). No free-text side.
   - `matchDate` = local date plus time in the import's zone, as an `Instant`.
   - `venue` = the (possibly spelling-normalised) text or null.
   - `scoringUrl`, `streamingUrl` null. **No `MatchSide` rows, no polls, no squad rows, no playing XI**: those are created later by the normal flows, so an imported match starts with no dependants.
3. Apply opted-in updates through `MatchService.update` (time and venue only).
4. Record `import_batch_entity` rows (`MATCH` `CREATED` with `row_number`; `MATCH` `UPDATED` with `previous`), and `IMPORT_ALIAS` rows for ticked aliases.

Access: the whole import is club admin, so a match with no own-team side (a league-wide fixture) is allowed (`assertCanAdministerAnySection` passes for a club-scope admin). Verify in the integration tests that creating a match whose date falls in an existing group-poll window does not alter that window's polls (a risk to confirm, not an assumption).

## The Confirm screen

Generic `ImportConfirmPanel` (`097`) showing, for this type:

- The target, repeated: "Importing into **Northern Premier League, 2026/27**. Times read as **Africa/Johannesburg**. Scope: **Only matches involving our teams**."
- Counts: rows in file, **will create** N matches, **will update** N, **already exist, skipped** N, **skipped, not ours** N (expandable), **excluded by you** N.
- **Will be created**: league teams (new) and teams copied from another season or league, with names.
- **Will be updated** (old to new time and venue), if any were opted in.
- Warnings grouped by code with the rows, each with an acknowledgement tick; the earlier-import warning at the top when relevant.
- An alert: "Nothing has been saved yet."
- The primary button, disabled until zero errors and every warning is ticked, with the reason beside it.

## The result report

`ImportResultReport` shows **created** (matches and league teams), **skipped as already existing**, **updated** (with old and new values), **skipped, not ours**, **excluded**, and **warnings acknowledged** (code, count), the elapsed time, the batch reference, the scope mode, a button **View schedule** (the league Schedule view for the season, `?seasonId=`), **Download rows not imported** (CSV of skipped, excluded and not-ours rows with the reason), and **Delete import**. Query keys invalidated on commit: the league's matches, league teams (`leagueTeamsQueryKey`) and the leagues summary (`['managed-club', clubId, ...]`).

## Deleting an imported schedule (principle 4)

**Entry:** **Delete import** on the report and in the history panel. It first calls `GET .../imports/{batchId}/deletion-check`; if deletable it opens a destructive `ConfirmDialog` ("Delete this import? 48 matches and 3 league teams it created will be permanently deleted. Matches it skipped as already existing, and anything created by another import or by hand, are not touched."); if not, an `acknowledgeOnly` dialog lists the blockers. `POST .../delete` repeats the check inside the transaction.

**What is deleted (all or nothing):**
- Matches with a `MATCH`, `CREATED` entry for this batch, **only if none of them is blocked** (below). If any match is blocked the **whole delete is refused** and nothing is deleted (R1).
- Their **empty** `match_side` rows (no players, no captain or wicketkeeper or 12th man, not announced); an own-team side that has any of these is a blocker.
- **League teams created by this batch** (`LEAGUE_TEAM`, `CREATED`, including copies) are deleted only if, after the matches are removed, **no other match references them** (home or away) and they were **not edited since the import** (name, abbreviation, logo equal to what the import wrote; `detail` stores the snapshot) and are still active. Otherwise they are **kept** and listed ("Kept: Brits Vets 1 (used by 2 other matches)"). This is why a league team created by a first (ours-only) import and used by the second (full) import survives the first import's deletion.
- Aliases created by this batch are deactivated.
- Never deleted: matches skipped as duplicates, matches of any other batch, manual matches, league teams not created by this batch, own teams, affiliations.
- Updates made by this batch (time and venue) are reverted from `previous` for matches the batch did **not** create when they still have no dependants; otherwise reported as "left as changed". A match this batch updated but did not create is never deleted by it.

**Blockers (a match is blocked if any of these exists), the rule "no poll or result" made precise:**

| Reason code | Detected by | Today |
|---|---|---|
| `POLL` | A `match_availability_poll` row for the match, open or closed (any answers on it). | Exists |
| `GROUP_POLL` | A `section_availability_window_match` row for the match (covered by a group availability window). | Exists |
| `SQUAD_POOL` | A `match_squad_member` row for the match (per-fixture group-poll squad). | Exists |
| `SELECTION` | A `match_side` for the match with at least one `match_side_player`, or a captain, wicketkeeper or 12th man set. | Exists |
| `ANNOUNCED_TEAM` | A `match_side` with `announced = true`. | Exists |
| `RESULT` | A `MatchResultGuard` finds a recorded result for the match. | **No Results module exists, so this never blocks today**; the guard returns false |
| (future) | Any new table that references `match` registers its own blocker. | enforced by the structural test below |

**The seam for results:** the blockers are provided by a Spring list of `MatchDeletionBlockerProvider` beans (one per reason above, batched by match id so a 130-match check is a handful of queries, not 130). The future Results module adds `MatchResultBlockerProvider` and nothing else changes. An integration test reads `information_schema` for every foreign key referencing `match(id)` and fails unless each referencing table is covered by a provider or is on an explicit "deleted with the match" list (`match_side` with its empty-side rule); this makes it impossible for a new module to silently weaken the rule (`097`).

**Non-blocking notes** shown in the check (never stop deletion): matches **edited since import** (updated at later than the batch and different from the imported values), matches **already in the past** with no result, matches **deactivated**. "No result" is the only thing that matters about the past until Results exist (R2).

**Reporting blockers:** the `409` and the check return `blockers[]`, one per blocked match: label ("13 Sep 2026, 08:00, Irene Villagers 1 v Brits Vets 1"), `reasons[]` (codes above), a plain sentence ("Has an availability poll with 12 responses; announced team"), and `link` (the match page). The dialog lists them (first 10 with "and N more"), the counts per reason, and the guidance: "To keep this schedule, deactivate matches instead; to start again, remove the polls and selections first, or ask for help." The UI never offers to delete only the unblocked matches (R1).

**Race handling:** inside the delete transaction the matches are locked (`SELECT ... FOR UPDATE`), blockers are re-queried, and a foreign-key violation from a poll created at that instant maps to the same `409`.

**After delete:** the batch is `DELETED` (who, when, counts of removed and kept); the file hash no longer triggers the earlier-import warning; the history shows it struck through. Deleting the batch of an ours-only import leaves a later full import's matches untouched (they belong to the later batch).

## API

Uses the `097` endpoints unchanged (`/api/v1/manage/clubs/{clubId}/imports...`, `canAdministerClub`), with `type = LEAGUE_SCHEDULE`. Consumer-specific:

- **Scope JSON** for `preview` and the history `scopeKey`: `{"leagueId": "...", "seasonId": "...", "scopeMode": "ALL|OURS_ONLY", "templateScope": "OURS_ONLY|OURS_AND_OTHERS", "windowDays": 14}`; `scopeKey = league:<id>|season:<id>`. A `leagueId` or `seasonId` that is another club's is `404`; an inactive league is a file-level Error, not an HTTP error.
- **Decisions** carry `identifiedAsOurs[{sheetName, teamId}]`, `resolutions[{sheetName, kind: LINK_OWN_TEAM|LINK_LEAGUE_TEAM|COPY_LEAGUE_TEAM|CREATE_LEAGUE_TEAM|SKIP_ROWS, ...}]` and `updates`.
- **Proposals** (`ReferenceProposalDto`): `{sheetName, rows[], candidates[{kind, id, name, source: ALIAS|OWN_AFFILIATED|LEAGUE_THIS_SEASON|LEAGUE_PREVIOUS_SEASON|LEAGUE_OTHER|OWN_OTHER, seasonLabel?, leagueName?, confidence, band, reasons[]}], suggestedCreateName}`.
- **Backend additions outside the framework:** `MatchService.createBatch`, an `LeagueTeamService` bulk create and copy entry used by the handler, `MatchDeletionBlockerProvider` and implementations, `MatchService.deleteForImport` (package-private to the import module; the only match delete in the product), `TeamNameMatcher`, `ScheduleFileReader`, `ScheduleTemplateWriter`, `ScheduleDateParser`. All follow the one skeleton (`docs/standards/backend.md`), with `@Transactional(readOnly = true)` on reads.
- **OpenAPI:** the `097` additions plus the typed scope and decision schemas above, additions only.

## UI

Composed from the shared `097` components; **no new shared component is introduced by this spec**.

- **Pages:** `pages/manage/leagueImport/LeagueScheduleImportPage` (the wizard configuration: columns Date, Home, Away, Venue, Time, Notes, status; the Identify-our-teams step; the resolver's candidate renderer; the confirm and report link targets). A Claude Design pass for the three new `097` patterns is required first (`docs/workflow.md` Step 2).
- **Wizard steps for this type:** 1 Upload (template download with the template scope choice, the scope choice, window days under "Advanced", the AI help panel, the drop zone), 2 Check (issue table), 3 **Our teams** (only in `OURS_ONLY`), 4 Teams (resolver), 5 Review and confirm, 6 Done (report). A phone shows "Step 4 of 6".
- **Header and target:** `ManageScreenHeader`-style title "Import schedule" with the league and season names on every step ("Northern Premier League, 2026/27") and a Back link to the tab it came from (R9 of `097`).
- **Copy of the scope choice** (plain words): "All matches in the file: the whole league schedule, every team is checked. Only matches involving our teams: only your fixtures are imported, other matches are listed and skipped, and only your opponents need linking. League schedule shares will show only your matches."
- **Mobile:** issue rows are cards (date and time, "Home v Away", venue, then the status and reason), the resolver is a stack of cards, buttons are 44 px, no horizontal scroll at 375 px.
- **API client:** `ui/src/api/importApi.ts` (generic, `097`); a thin `leagueScheduleImport.ts` helper builds the scope JSON.

## Test example 1: the user's first real sheet

**The source** (as supplied, not a template): **no header row**; a **merged date cell** on the left such as `13-Sept-26` (note `Sept` and a two-digit year) spanning **five rows**; then **four columns per match**: first team, second team, venue, time (`08:00`); **blank separator rows** between dates; team names in **UPPER CASE** and not identical to the system's; ten teams (IRENE VILLAGERS 1, BRITS VETERANS 1, PHSOB VETERANS 1, CBCOB VETERANS 1, PRETORIA 1, SINOVILLE 1, POLICE 1, POLICE 2, LAUDIUM 1, LAUDIUM 2), each appearing exactly once per date; venues BRITS OVAL, IRENE COUNTRY CLUB, HOFMEYER PARK A, LAUDIUM OVAL, ALOE PARK, PRETORIA A; several matches at one venue on one date at different times (08:00, 11:00, 14:30, or 10:00, 14:00); dates **13, 20 and 27 September 2026**, all Sundays (checked: 13 Sep 2026 is a Sunday).

**What it contains after conversion** (illustrative pairings and venues; the real file is added as the fixture with its own expected output, anonymisation not needed as there is no personal data): 3 dates x 5 matches = **15 rows**, 10 distinct team names, 6 venues.

| Date | Home team | Away team | Venue | Time |
|---|---|---|---|---|
| 2026-09-13 | IRENE VILLAGERS 1 | BRITS VETERANS 1 | BRITS OVAL | 08:00 |
| 2026-09-13 | PHSOB VETERANS 1 | CBCOB VETERANS 1 | BRITS OVAL | 11:00 |
| 2026-09-13 | PRETORIA 1 | SINOVILLE 1 | BRITS OVAL | 14:30 |
| 2026-09-13 | POLICE 1 | LAUDIUM 1 | HOFMEYER PARK A | 10:00 |
| 2026-09-13 | POLICE 2 | LAUDIUM 2 | HOFMEYER PARK A | 14:00 |

**Expected behaviour on the converted template (`ALL` mode, season covering the dates):**
- Parsing: `13-Sept-26` becomes 2026-09-13 (as ISO or text); `Sept` read as September; two-digit year note shown once; times 08:00 etc. read; all 15 rows parse; weekday check passes (100% Sundays); no `WEEKDAY_MISMATCH`.
- Validation: each team once per date (no `TEAM_TWICE_SAME_DATE`, no `TEAM_MISSING_ON_DATE`); venue clash none (BRITS OVAL 08:00 to 11:00 is exactly 180 minutes, 11:00 to 14:30 is 210); `SAME_CLUB_DERBY` Warning for any `LAUDIUM 1 v LAUDIUM 2` or `POLICE 1 v POLICE 2` pairing; unknown teams go to the resolver.
- Resolution proposals (examples to assert, against fixture system names chosen for the test): `PHSOB VETERANS 1` proposes a team whose name begins with the initials-expansion "Pretoria High School Old Boys" and contains "Vets 1" (acronym plus `VETERANS = VETS`, High); `CBCOB VETERANS 1` the same pattern; `BRITS VETERANS 1` proposes "Brits Vets 1" (synonym, High); `POLICE 1` never proposes `Police 2` as a link (suffix rule); `IRENE VILLAGERS 1` Exact against `Irene Villagers 1` after case folding.
- A scenario with the club owning "Laudium 1" (affiliated): `OURS_ONLY` identifies LAUDIUM 1 as ours, imports only the matches involving it, lists the other rows under Skipped, not ours, and asks to resolve only its opponents.

**Layout problems that belong to the conversion step, not the parser:** the merged date cell and its spill over five rows (the date must be repeated on every row); the four-column repeating match blocks and blank separator rows; the absent header; text dates with `Sept` and two-digit years are fine for the parser, but a layout where the date and the match are in different rows is not; abbreviated or truncated team names that mean different teams in different leagues (the parser never guesses); venue columns that sometimes hold the time, notes in match rows, "BYE" or "TBC" rows, a header repeated per page, matches continued over two pages. These are exactly what the Phase 1 AI prompt (appendix) and the template's instructions address.

## Test Plan

Per `docs/standards/testing.md`; framework-level tests are in `097`. Specific here:

| Tier | Coverage |
|---|---|
| Unit (backend) | `ScheduleDateParserTest` (every accepted format including `13-Sept-26`, `13 September 2026`, `13/9/26`, Excel serial, weekday prefix, day-first only, month 13 error, two-digit year pivot); time parser (`8.00`, `14h30`, `2:30 pm`, fraction, 24:00 error, DST gap error); `TeamNameMatcherTest` (exact after case, synonym `VETERANS`/`VETS`, acronyms `PHSOB`, `CBCOB`, suffix rule `POLICE 1`/`POLICE 2` never linked, missing suffix medium, typo similarity, alias first, ordering by source and band, reasons text); `LeagueScheduleValidatorTest` (every code in the validation table, each in `ALL` and `OURS_ONLY` mode: round rules skipped in `OURS_ONLY`, own-team rules still raised; `OWN_TEAM_OVERLAP` against an existing match in another league; venue clash threshold at exactly 180 minutes passes; weekday threshold; derby; collision with an inactive league team); **identity tests** (`LeagueScheduleIdentityTest`: same pair, same date, home and away swapped is the same key; time differs gives DIFFERS; same pair on another date is NEW but warns inside `windowDays` and when meetings exceed the file's maximum; a manual free-text match is treated as existing; similar free-text gives POSSIBLE DUPLICATE; duplicates within the file); `LeagueScheduleImportHandlerTest` (commit order, only existing services used, no `MatchSide` or poll created, own-team side vs league-team side, copied team recorded with `copiedFrom`, update only time and venue, update blocked with a dependant); deletion (`LeagueScheduleDeletionTest`: each blocker reason blocks and the whole delete is refused, nothing deleted; empty sides removed with the match; league team kept when another match uses it or when edited; skipped-duplicate and earlier-batch and manual matches never deleted; updated-but-not-created match never deleted; results guard seam). |
| Fixture-based parser tests | `backend/src/test/resources/imports/league-schedule/`: `example-1-converted.xlsx` and `.csv` (the user's sheet converted to the template, 15 rows) with expected rows, codes and proposals; `example-1-source-merged.xlsx` (the raw layout) which must be **rejected with the merged-cells message**, proving layout problems are not silently parsed; plus fixtures for each date format, a duplicate-row file, an outside-season file and an old template version. Every future user sheet is added the same way (`097`). |
| Integration | Testcontainers: preview, resolve, confirm, commit through real HTTP with a real `CLUB_ADMIN`; the whole flow in `ALL` and in `OURS_ONLY` (skipped rows counted and listed, only opponents created); **re-import scenarios** (below); concurrent confirms; `createBatch` rolls back entirely on one bad row; creating a league team through the import hits the `lower(name)` index and is caught as a collision before commit and as `409` if raced; the structural dependants test over `match`; a match created in a date range covered by an existing group-poll window leaves that window unchanged; another club's admin `404`, a section manager `403`, `platform_admin` passes; service tests run without an ambient transaction. |
| **The ten re-import and race cases** | (1) Importing the same file twice yields zero new matches the second time (all DUPLICATE, report says so, `FILE_IMPORTED_BEFORE` shown). (2) Ours-only then full: the full import creates only the additional matches, the first batch's matches show DUPLICATE, and the first batch's created league teams are linked, not recreated. (3) A changed time on one row shows DIFFERS, creates nothing, and updates only when the opt-in is given and the match has no dependants (blocked with a poll). (4) A manual match (own team v free-text opponent) is treated as an existing DUPLICATE; a manual match with a different time is DIFFERS. (5) Two concurrent confirms for the same league and season create each match once (the second gets `409` with fresh review). (6) Deleting the first batch after the second deletes only the first batch's matches, keeps teams the second batch uses, and never touches matches the first batch skipped. (7) A race against a manual create is documented, not asserted. (8) Duplicates inside the file are errors. (9) Reversed home and away in the file is a DUPLICATE or DIFFERS, never a second match. (10) A rescheduled fixture shows `POSSIBLE_DUPLICATE_NEARBY` with the other date, creating only after acknowledgement. |
| Contract | Typed scope and decision schemas; `MatchService` has no new public endpoint (no match delete endpoint exists). |
| Component (Vitest, Testing Library) | `LeagueScheduleImportPage`: scope choice wording, template scope choice triggers the right download parameter, Identify-our-teams step appears only in `OURS_ONLY`, skipped section expands, the Confirm screen states the skipped count and the creation list, Create does nothing until Confirm, resolver proposals and nothing preselected except Exact. Entry points: `LeagueEditScheduleTab` shows Share, Import schedule, Add match in that order and the Imports history opens; `LeagueScheduleView` shows the button; disabled with no season. |
| End-to-end | One golden path (`ui/e2e`): download template, upload the example 1 conversion, resolve teams, confirm, see the report, delete the import. Not run in CI until Keycloak is available (`095`). |
| Browser check | 375 px, tablet and wide: every wizard step, the resolver, the confirm screen and the blockers dialog. |

## Acceptance Criteria

- A club admin can download a template for a league and season, with the lookup sheet and drop-downs set to "Our teams only" or "Our teams and the league's teams (current and previous seasons)", and the drop-downs warn rather than reject unknown names.
- Uploading the converted example 1 sheet shows 15 rows parsed (`13-Sept-26` read as 13 September 2026), all validations of the table evaluated, and the ten team names in the resolver with proposals, reasons and confidence; nothing is written until Confirm.
- Uploading the raw example 1 layout (merged date cell) is rejected with a clear merged-cells message.
- In `OURS_ONLY` mode, rows that do not involve one of the identified teams are not imported, are shown as "Skipped, not ours" with a count and an expandable list, are counted on the Confirm screen, and only the opponents of our matches are resolved; round and whole-league checks are not raised, own-team checks are.
- The scope mode and template scope are recorded on the batch and visible in the history and report.
- Every unrecognised name is offered ranked candidates from our teams, this league's teams this season, previous seasons and other leagues, with confidence and reason; `POLICE 1` is never offered `Police 2` as a link; nothing is linked or created without the user's click; creating league teams appears in one explicit list and the commit refuses without that exact confirmation.
- Importing the same file twice creates no match the second time; an ours-only import followed by a full import creates only the additional matches and links, not recreates, the first import's teams; a manual match is treated as an existing duplicate; a changed time shows DIFFERS and updates nothing unless opted in and not blocked.
- Duplicate detection is by resolved team identity, unordered pair and local date across all matches of the league and season, whoever created them.
- Two simultaneous confirms for one league and season never create the same match twice.
- The report lists created, skipped as already existing, updated, skipped not ours, excluded and acknowledged warnings, with a link to the schedule and a Delete import action.
- Delete import removes the batch's created matches (and its unused, unedited created league teams) all or nothing, is refused with every blocking match listed (reason and link) when any match has a poll, group-poll coverage, squad pool, selection, announced team or a result, never deletes matches it skipped or that belong to another batch or were made by hand, and keeps league teams that other matches use.
- The entry points exist on the League edit Schedule tab (between Share and Add match) and on the league page Schedule view, with an Imports history; a section manager cannot import or delete.

## Recommendations and challenges

Labelled **R**, each with a recommended default and the alternative. `097`'s R1 to R22 apply as well.

- **R1. Should deletion also be possible when only some matches have polls?** Recommended default: **no, all or nothing** for a batch, with the full blocker list. The accident this feature guards against (the wrong league) is caught within minutes, before polls exist; a half-deleted schedule is harder to reason about than a refused delete. Alternative: a second, clearly separate action **"Delete the N matches that have nothing attached"** with its own stricter confirmation, leaving the blocked matches (still attributed to the batch, batch becomes `PARTIALLY_DELETED`). Worth adding only if users hit it in practice. A third route that already works: deactivate the blocked matches individually (`Match.deactivate`).
- **R2. Is "no poll and no result" enough?** Not quite. Recommended: the blocker set in the table: **poll, group-poll coverage, squad pool, selection, announced team, result (seam)**. Reasons: a selection or an announced team has been told to players even without a poll; squad pool and group coverage are poll data under another name. Also recommended **not** to block on "match date is in the past" or "edited after import" (shown as notes). Communications cannot be checked because they are not recorded; challenge: once the platform sends anything (share links, notifications), record it, and add a `COMMUNICATION` blocker provider (roadmap). Alternative: block on any non-null `updatedAt` after import (too strict, a typo fix would lock the import).
- **R3. A league-wide import fills the club's Matches list with fixtures that are not ours, and ours-only gives a partial league schedule.** Verified in code: `Match` allows sides with no own team, `isOurMatch` and the "Only our matches" switch exist because such matches already occur, and the club admin matches list and `/matches/summary` are unscoped for a club-scope admin, so 90 league-wide matches would appear next to our 15 (counters "Matches this week" for leagues included). The Full Schedule PDF, poster and calendar shares (`051`) and the league page show non-ours matches, so an ours-only import makes those outputs show only our matches. Recommended: **default "All matches"** (see R10 and `097` R20) **and** a follow-up spec adding an "Our matches" default to the Matches list so league-wide fixtures do not drown the club's own (until then the Matches list needs a manual check in the integration tests). Alternative: default "Ours only" for the smallest setup and cleanest Matches list, accepting incomplete league outputs; mitigated because a wider re-import is safe.
- **R4. "Linking" to a previous season's team is really copying a league team into this season.** Because `LeagueTeam` is per league and season (`070`), the safe and cheap approach is: show it honestly ("Will be copied from 2025/26"); copy through the existing `070` copy path (name, abbreviation, logo reference, no file duplication, no history); list every copy in the confirmation; record `copiedFrom` in `import_batch_entity.detail`; delete it again on undo only if unused and unedited. Cheap: one click per name, remembered next time via aliases. Challenge: this does not give a team a stable identity across seasons; the real fix is a club-level opponent identity that league teams point at (roadmap; `070` deferred "tidy-up or merge"). Until then the alias plus exact-name search is the safety net. Alternative: show previous-season teams as suggestions only (no Link), forcing a Create; worse, it recreates exactly the duplicate risk.
- **R5. Remembered aliases can be wrong.** Recommended: as `097` R14, plus here: an alias maps a normalised sheet name to our team id or to a canonical league team name, scoped to this league; shown in the resolver with who and when; never auto-applied except as the top, preselected Exact-style candidate when the sheet text is identical; removed when its batch is deleted; a "Remembered names" list in the Teams tab is a follow-up. Risk to name: someone accepts `POLICE 2` for `POLICE 1` once and ticks Remember; the suffix rule prevents the matcher proposing it, but a user can still pick it from a list; mitigation is the `TWO_NAMES_ONE_TEAM` warning and the same-team error. Alternative: no aliases.
- **R6. Match identity key.** Recommended: (league, season, **unordered** pair of resolved side identities, local date); time, venue and home/away are non-key. Alternatives: the proposed ordered (home, away, date) key (creates a second match when a sheet lists the same fixture reversed); date and time in the key (turns every time correction into a NEW duplicate, which is the very failure to prevent). The double round-robin is handled because the date is in the key, the rescheduled fixture by warning only.
- **R7. Updating existing matches in v1?** Recommended: **detect and show DIFFERS in v1, default Skip, with the narrow opt-in Update (time and venue) in v1** because a league re-issuing times is the commonest reason to re-import, and the alternative is dozens of manual edits; guarded by the dependants block and the confirm. Alternative: defer Update (DIFFERS becomes "edit by hand"), which is smaller and safer but leaves the re-import story incomplete. Not recommended: DIFFERS defaulting to Update.
- **R8. Thresholds are guesses.** `OWN_TEAM_MIN_GAP_MINUTES` 120, `VENUE_MIN_GAP_MINUTES` 180, the 60% weekday rule, `windowDays` 14, and "at least half the teams" for a missing team on a date are defaults to tune with real sheets; they are constants in one class, shown in messages, and the fixtures pin them. A 50-over league needs a larger own-team gap (a team cannot play twice in a day), a T20 league does not; a later improvement reads the league's overs from playing conditions (`027`). `DATE_OUTSIDE_SEASON` is an Error (the row can be excluded): the alternative, a Warning, lets a wrong season choice slip through; the file-level "most rows are outside" error covers the common mistake.
- **R9. Template columns versus the user's own layout.** Our template follows the user's order (team, team, venue, time) to ease conversion, but the date is a repeated column rather than a merged cell. Challenge: if most leagues send the same block layout, a deterministic **block-layout reader** for exactly that shape (merged date plus repeating four-column groups) would remove the conversion step for them; defer until a second league confirms the shape, since we have one sample. Until then Phase 1 AI plus the template.
- **R10. Default scope mode.** See R3: recommended **All matches** by default, with the plain-words explanation of ours-only; alternative default Ours only. Also challenge: in `ALL` mode, users must resolve every team in a ten-team league on the first import (10 decisions, then remembered); I judge that acceptable, and it is the principle-3 verification the user called crucial.
- **R11. Example row placement.** The user asked for an example row. Recommended: on the **Instructions** sheet, not the data sheet, so it cannot be imported; alternative: a grey example row on the data sheet that the parser ignores when its Date cell reads `EXAMPLE` (visible to users in place, but one slip imports it).
- **R12. Venues stay text.** Recommended: suggestions from existing spellings, no venue entity now. Challenge: a venue entity (name, address, map, section for clash checks) would give exact clash detection and clean data, and is a natural follow-up (roadmap); until then clash detection relies on normalised text, so `HOFMEYER PARK A` and `HOFMEYER PARK B` are different venues and `PRETORIA A` is a venue, not a team.
- **R13. No free-text fallback for unresolved names.** The `MatchForm` allows "Other" free text; the import deliberately does not, because it would reintroduce misspelt duplicates. Alternative: offer "Keep as free text (not recommended)" for a club that never wants league teams; if requested, add as a resolution kind with its own warning.
- **R14. Own-team link consequences.** Linking a name to one of our teams changes what the match is (a poll and selection target, section access), so the resolver states it. Recommended: never auto-affiliate (`OWN_TEAM_NOT_AFFILIATED` warns). Alternative: offer "affiliate this team to the league" as a confirmed creation (a new `LeagueAffiliation`); deferred as scope growth.
- **R15. Past dates.** A mid-season import contains played fixtures. Recommended: import them (no special handling; a Note counts them) since results do not exist yet and polls are not created for them. Alternative: a "skip matches before today" option (offered in review, default off).
- **R16. Preview data size and performance.** A 130-row file with ten names resolves in milliseconds; the matcher searches the league teams of the club across leagues and seasons (hundreds of rows) in memory per name, so it is loaded once per preview (one batched query per source), not per name. No N+1 (`backend.md` pagination and batching rules); the identity check is one batched query by league, season and date range.

## Open Questions

**Resolved 2026-10-10: the user accepted every proposed default below** ("yes to all"). Question 11 in `098` is still to be verified in the integration test, as its default says.

1. **Default scope mode** (R3, R10). Proposed default: All matches.
2. **Update in v1** (R7). Proposed default: yes, narrow (time and venue), blocked by dependants.
3. **Matches list default** to "our matches" so league-wide imports do not clutter (R3). Proposed default: a separate follow-up spec; verify the current list behaviour in the build.
4. **Threshold constants** (R8: 120, 180, 60%, 14 days). Proposed default: as stated, tune on real files.
5. **Should an Error ever be downgradable** (for example `DATE_OUTSIDE_SEASON` when the season dates are known to be wrong)? Proposed default: no; exclude the row or fix the season.
6. **Free-text fallback** (R13). Proposed default: not offered.
7. **Affiliation on link to own team** (R14). Proposed default: not created, warning only.
8. **Alias management screen** timing (R5). Proposed default: after the first slice.
9. **Skip past matches option** (R15). Proposed default: off, offered later.
10. **Which user can delete**: any club admin or only the importer. Proposed default: any club admin (the batch blockers protect data).
11. **Does a new match in an open group-poll window get auto-attached to it** (`032`/`034`)? Unknown from reading; proposed default: verify in the integration test and, if it does, import must create matches in a way that does not touch polls, or the blocker list must treat it as a dependant.
12. **Is the first real file's date column ever ambiguous** (numeric `03/09/26`)? Proposed default: day first, flagged once.

## Appendix A: Phase 1 AI prompt, `LEAGUE_SCHEDULE` template version 1

Served by `GET /imports/LEAGUE_SCHEDULE/ai-help` from `backend/src/main/resources/imports/prompts/LEAGUE_SCHEDULE/v1.md` (the text below is the content; `{{...}}` placeholders are filled by the endpoint from the league and season, and may be omitted by the user).

```
You are helping me convert a cricket league's fixture list into a CSV file with an exact layout. I will attach the league's file (it may be a spreadsheet, a PDF or a photo, with merged cells, a date written once above several matches, blank lines between dates and no header).

Produce a CSV with exactly this header row, in this order:
Date,Home team,Away team,Venue,Time,Notes

Rules, please follow every one:
1. One row per match. Repeat the date on every row. Never merge, skip or leave blank separator rows.
2. Date as yyyy-mm-dd. The season runs from {{seasonStart}} to {{seasonEnd}}; day comes before month in the source (South African style). Read short forms like "13-Sept-26" as 2026-09-13.
3. Time as 24-hour HH:mm (for example 08:00, 14:30). If a match has no time in the source, leave Time empty and say so in Notes.
4. Home team is the team named first, Away team the team named second. Copy team names EXACTLY as written in the source, including upper case and numbers (for example "POLICE 1" and "POLICE 2" are different teams). Do not expand, shorten, translate or correct names; my system matches names for me.
5. Venue is the ground as written in the source, copied exactly. Leave it empty if there is none.
6. Never invent, merge or guess a match. If something is unclear (a missing time, a team that appears twice on one date, "BYE", "TBC", a cut-off page), still output what you can and put a short reason in Notes. Do not output BYE rows as matches.
7. Output only the CSV, in a code block, with no commentary. After it, list anything you could not read, in plain sentences.

Names the system already knows for this league (use them only to check your reading, do not rewrite names):
Our teams: {{ourTeams}}
League teams: {{leagueTeams}}
Known venues: {{venues}}
```

Instructions shown above the prompt in the panel: download the template (to see the layout), open your AI assistant, paste the prompt, attach the league's file, check the CSV it gives you against the original (especially dates and times), save it as a `.csv`, and upload it here; you will check every row again before anything is saved. Nothing is sent from this application.

## Rollout Notes

Slices (the first two are `097` slices 1 and 2; they are shown here for sequencing):

1. **Framework backend then framework UI** (`097` slices 1 and 2), proven with a dummy handler.
2. **Consumer backend:** `ScheduleDateParser`, `ScheduleFileReader`, `ScheduleTemplateWriter` (POI and Commons CSV added to `pom.xml`, `ZipSecureFile` limits), `TeamNameMatcher` and the synonym table, `LeagueScheduleValidator`, identity and outcomes, `LeagueScheduleImportHandler`, `MatchService.createBatch` and the `LeagueTeamService` bulk and copy entry, `MatchDeletionBlockerProvider`s and the structural test, `MatchService.deleteForImport`, fixtures and tests, `openapi.yaml`. Safe to ship alone (no UI uses it).
3. **Consumer UI:** Claude Design pass, `LeagueScheduleImportPage`, the entry points on `LeagueEditScheduleTab` and `LeagueScheduleView`, the history panel wiring, the AI help prompt resource, component tests, the E2E golden path. Slice 3 completes the framework (`097`).
4. **Follow-ups** in this order of value: the Matches list "our matches" default (R3), the Remembered names screen (R5), block-layout reader (R9), venue entity (R12), communication log and its blocker, `Round` column (template v2), "skip past matches" option.

**Roadmap entries needed** (a human updates `docs/roadmap.md`): resolve the `050` Non-goal "bulk fixture import" and the `070` "Bulk CSV import" pointer; add under "Deferred by `098`": the Matches list default, the Remembered names screen, the block-layout reader, a venue entity, a club-level opponent identity across seasons (R4), a communication log feeding delete blockers, a `Round` column, league-teams bulk import as the next consumer, and a note for the future Results module to register its blocker.

**`docs/standards/frontend.md`** gains a short "Imports" paragraph (routes `/manage/fixtures/leagues/:leagueId/schedule/import` and `/manage/imports/:batchId`, the persisted choice if any, the shared components) when built. **`docs/standards/backend.md`** gains the exception-detail amendment (`097`). `docs/architecture.md` is unaffected.
