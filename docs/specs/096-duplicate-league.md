# 096: Duplicate League

**Depends on:** `029-league-management.md` (`League`, `LeagueAffiliation`, `Season`, `Match`, the `/api/v1/manage/clubs/{clubId}/leagues` endpoints, the club-owned `League` decision), `050-league-schedule-and-fixtures.md` (the schedule is `Match` rows carrying `league_id`/`season_id`; Playing Conditions PDF storage), `052-league-playing-conditions.md` (`LeaguePlayingConditions`, one row per `(league, season)`, with the PDF `documentUrl` and the structured points and bonus fields), `053-league-extended-profile.md` (`League` format, logo, phone, website, email, social links), `054-league-contacts.md` (`LeagueContact`), `055-league-season-config.md` (approved, not built: moves the playing XI size and age rules onto `LeaguePlayingConditions`, see Data Model Changes), `062-league-detail-redesign.md` and `072-league-view-pages.md` (the league page and its header), `070-league-teams.md` (`LeagueTeam` and the `CopyLeagueTeamsDialog` copy action, a different action, see Problem & Goals), `091-leagues-gold-standard.md` (the Leagues list, card, and league page header this spec adds one button to), `094-club-structure-and-seasons.md` (seasons, and the deferred "Season rollover" item this spec is deliberately not). The League edit page is expected to have the tabs Details, Teams, Schedule, Playing conditions and Contacts (spec `095`, built on another branch and not assumed beyond that tab list).
**Status:** draft, written 2026-10-10 from the user's request: "a duplicate league season, for instance we have a Division 1 and 2, they have the same playing conditions, same affiliation, just teams and schedule differ. So it would be nice to just duplicate my current league and call it Division 2 and start capturing teams and matches."

## Problem & Goals

A club often runs several leagues that are identical in setup and differ only in who plays and when: Division 1 and Division 2 of the same competition share the same format, playing conditions, points system, contacts, logo and website, but have different opponent teams and a different fixture list. Today the only way to start Division 2 is to create an empty league and retype everything: the profile on the Details tab, every field of the Playing conditions for each season, the contacts, and the club's own team entries. That is slow, error-prone, and the cost grows with every season the league has run.

This spec adds a **Duplicate league** action. It creates a **new** league (new name, required) from an existing one in a single step, copying the setup that is the same across divisions, and deliberately not copying what differs (the league's opponent teams and the schedule). It then takes the manager straight to the new league's Teams tab so they can start capturing teams and matches.

This is a different action from two existing ones:
- **`CopyLeagueTeamsDialog` (`070`)** copies chosen opponent teams (`LeagueTeam` rows) from one league and season into an **existing** league and season. Duplicate league never touches league teams; it is the step before it. After duplicating, the manager can still use that dialog on the new league's Teams tab if some opponents carry over (for example a team promoted or relegated between divisions).
- **Season rollover** (`094`'s deferred item, and `docs/roadmap.md`): copying teams, squads and league affiliations into a **new season** of the **same** league. Duplicate league copies into a **new league** for the **same season(s)**. They share one rule (how a league's own team entries are copied), so if rollover is built later it should reuse the affiliation copy helper introduced here rather than a second one.

**Goals**
- A club admin can duplicate a league from the league page, or from the league edit page, in one dialog and one request.
- The new league is a faithful copy of the source's profile (format, XI size, age rules and cutoff, logo, phone, website, email, social links), with the new name.
- The manager chooses, with all options on by default, whether to also copy the club's own team affiliations, the playing conditions (including the points and bonus rules and the uploaded conditions PDF) and the league contacts, for the chosen season or seasons.
- The whole copy is atomic: one transaction, a fixed number of queries, nothing half-copied on failure.
- On success the manager lands on the new league's edit page, Teams tab, ready to add its teams.

## Non-goals

- **No copying of league teams (opponents).** They differ by division by definition; the manager adds them next, or brings some across with the existing `CopyLeagueTeamsDialog` (`070`).
- **No copying of the schedule.** Matches, fixtures, results, scores, match sides, selections, availability polls and anything hanging off a `Match` are never copied. The new league has no matches.
- **No copying of share outputs.** The schedule PDF, poster and calendar are generated on demand from matches, so there is nothing to copy; the new league's outputs start empty.
- **No season rollover.** This does not create seasons, move a league into a new season, or carry matches or squads forward (`094` deferred item, roadmap). It copies per-season setup into the **same** seasons for a different league.
- **No cross-club copy.** The source league and every chosen season must belong to the club in the path; a league cannot be duplicated into another club.
- **No linking between source and copy.** The copy is fully independent from the moment it is created: no "duplicated from" reference, no inherited updates, no sync. Editing Division 1's points system later does not change Division 2's. (A "duplicated from" label would be a data model addition with no user need today.)
- **No new league-name uniqueness rule on create or update.** League names are not unique today (no constraint, no service check). This spec adds a uniqueness check on the duplicate endpoint only, for the reason in Data Model Changes; retrofitting it to create and update is an Open Question.
- **No copying of inactive contacts**, and **no copying of a league's `active` flag**: the new league always starts active.
- **No bulk duplicate** (several leagues at once) and **no duplicate from the Leagues list row or card** (see UI Requirements for why).
- **No change to access rules, to the share outputs, or to what a league, a season or the playing conditions are.**

## User Stories

- As a club admin with a Division 1 league, I can choose Duplicate league, name the copy "Division 2", and get a new league with the same format, playing conditions, contacts, logo, website and social links, so I do not retype them.
- As a club admin, I can choose which parts to copy (own team entries, playing conditions, contacts) with everything ticked by default, so the common case is one click and the unusual case is one untick.
- As a club admin, I can choose which season or seasons the per-season setup (playing conditions, own team entries) is copied for, defaulting to the season I am looking at, so I do not drag in old seasons I no longer need.
- As a club admin, I am taken to the new league's Teams tab on success, so the next thing I do is add its teams.
- As a club admin, I am stopped, with the message on the name field, if another league of my club already has that name, so I do not end up with two indistinguishable "Division 2" cards.
- As a club admin, I can be sure the copy did not bring over any teams of Division 1's opponents or any of its matches, so Division 2 starts clean.
- As a club admin of club X, I cannot duplicate club Y's league, or use club Y's seasons, even by guessing ids.

## Data Model Changes

**None: no new entity, column, index or migration.** The feature writes rows into existing tables only: `league`, `league_social_link`, `league_affiliation`, `league_playing_conditions`, `league_contact`.

### Exactly what is copied

The league's own profile is always copied (that is what makes the result a duplicate). The three optional groups are controlled by the request flags.

| Group | Copied | Notes |
|---|---|---|
| **League profile** (always) | `source`, `format`, `maxPlayingXiSize`, `minAge`, `maxAge`, `ageCutoffDate`, `logoUrl`, `phone`, `website`, `email`, every `socialLinks` entry | New `name` from the request. `active = true` regardless of the source. New `id`, `createdAt`, `updatedAt`; `updatedBy` is the acting user as for create. The logo is shared by URL reference to the same stored file, the same posture `070` takes for league team logos (media files are never deleted, so sharing is safe). The age cutoff date is copied verbatim, not advanced (the copy runs in the same seasons; advancing is `055`'s next-season concern) |
| **Playing conditions** (`copyPlayingConditions`) | For each chosen season that has a row for the source league: every structured field (match format overs, powerplay, per bowler, fielding notes, substitutions, points for win, loss, draw, no result, forfeit win, the bonus points switch and both thresholds, additional notes) and the uploaded PDF reference (`documentUrl`, `uploadedAt`, `uploadedBy`) | One new `league_playing_conditions` row per chosen season that has a source row; the unique `(league, season)` key cannot clash because the new league has no rows. The PDF is **shared by reference** (the same stored file URL on both rows), not re-uploaded. Reasoning: the user's case is "same playing conditions", the document is the same document; nothing in the codebase deletes stored files, so two rows pointing at one file are safe; and a copy of the file would only add storage and a second upload path. Re-uploading on either league afterwards replaces only that league's own row (`052`'s existing upsert behaviour), so the two cannot interfere. `055`'s "no copy-forward of the PDF" refers to carrying a season's document into the **next** season's form; here it is the same season, so the contrary default is right |
| **Own team entries** (`copyAffiliations`) | For each chosen season: every `league_affiliation` row of the source league becomes a row for the new league (same `team_id`, same `season_id`) | The club's own `Team` rows are not copied or touched; only the entry (the join row) is. `createdBy` is the acting user. A team can be entered in several leagues (the unique key includes `league_id`), so there is no clash. See Open Question 1: whether a club's own teams usually play in both divisions |
| **Contacts** (`copyContacts`) | Every **active** `league_contact` of the source: name, email, phone, role, primary flag | Contacts are league-wide, not per season, so the season choice does not apply. At most one active primary exists on the source, so the copy satisfies the partial unique index `ux_league_contact_primary` unchanged. Inactive contacts are retired and are not carried over |

### Explicitly not copied

`league_team` (opponents), `match` (and every table hanging off a match), results, `LeagueContact` rows that are inactive, anything audit-related, and any share output. The new league's schedule, Teams opponent list and match count start at zero.

### Interaction with spec `055` (approved, not built in this tree)

`League` still carries `maxPlayingXiSize`, `minAge`, `maxAge` and `ageCutoffDate` today (confirmed in `League.java`), so they are copied as profile fields. If `055` lands before this spec is built, those four fields live on `LeaguePlayingConditions` and the profile group shrinks accordingly while they ride along in the playing conditions group: the **rule** (copy wherever those values live) stays; only the implementation location changes. The builder must re-check `League.java` and `LeaguePlayingConditions.java` at build time, and a test asserts all four values arrive on the copy whichever side of that move the code is on. A consequence under `055`: with `copyPlayingConditions` off, the new league's XI size and age rules would be unset (the 11-player, no age restriction fallback), so the dialog's help text for that checkbox must say it includes the XI size and age rules once `055` is in place.

### Name rule (decision)

The name is trimmed, required, and at most 255 characters (the `league.name` column width). Names are **not** unique today, and `create` and `update` do not check. For this endpoint a name that equals (case-insensitive, trimmed) the name of **any** league of the same club, active or inactive, is rejected with `409` via a new `DuplicateLeagueNameException extends ConflictException` (a named subclass per `docs/standards/backend.md`). Reasoning: the whole point of the action is to produce a second league that must be told apart from the first on every card and picker, and the prefilled default `"<name> (copy)"` makes accidental clashes on a second duplicate easy. The check is service-level only (no unique index) so it adds no migration and does not break existing clubs that already have duplicate names. Whether to apply the same rule to create and update is Open Question 3.

## API Contract

One new endpoint, on the existing `LeagueController`, `LeagueService` and `LeagueServiceImpl` (the copy is a league-level operation; it reuses the league, affiliation, playing conditions and contact repositories, so no new controller or repository is needed, and no cross-service call is made in the middle of the transaction).

| Endpoint | Access | Purpose |
|---|---|---|
| `POST /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/duplicate` | `@access.canAdministerClub(authentication, #clubId)` (club admin, `platform_admin` superset, as every league endpoint) | Creates a new league from `leagueId` and copies the chosen setup, all in one transaction. `201` with `DuplicateLeagueResponse`. |

**Request, `DuplicateLeagueRequest`:**

```
{
  name: string,                 // required, trimmed, 1 to 255 characters
  seasonIds: UUID[],            // the seasons whose playing conditions and own team entries are copied;
                                // may be empty only when both copyAffiliations and copyPlayingConditions are false
  copyAffiliations: boolean,    // default true when omitted
  copyPlayingConditions: boolean, // default true when omitted
  copyContacts: boolean         // default true when omitted
}
```

The three flags are `Boolean` in the record with the service treating `null` as `true`, so a client that sends only `name` and `seasonIds` gets the all-on default.

**Response, `DuplicateLeagueResponse`** (the pattern of `CopyLeagueTeamsResponse`: a result object, not just the entity):

```
{
  leagueId: UUID,               // the new league
  name: string,                 // as saved (trimmed)
  seasonsCopied: number,        // distinct chosen seasons
  affiliationsCopied: number,
  playingConditionsCopied: number,   // rows (a chosen season with no source row copies nothing)
  contactsCopied: number
}
```

The UI uses the counts for the success message ("Division 2 created: 3 teams entered, playing conditions for 1 season, 2 contacts"). It does not return the full `LeagueDto`: the page navigates to the new league's edit page, which loads it through the existing queries.

**Errors**

| Status | When |
|---|---|
| `404` | `leagueId` does not exist or belongs to another club. Any `seasonIds` entry does not exist or belongs to another club (the same `LeagueSeasonAccessValidation` rule as every nested league and season endpoint: a mismatch reads as not found, not `400` or `403`; this is a deliberate alignment with precedent rather than a `400` for an invalid season) |
| `400` (`ValidationException`) | Blank name; name longer than 255 characters; `seasonIds` empty while `copyAffiliations` or `copyPlayingConditions` is true |
| `409` (`DuplicateLeagueNameException`) | Another league of the club already has this name (see Name rule) |
| `401`/`403` | Not authenticated, or not an administrator of the club (existing `@PreAuthorize` behaviour) |

Duplicate ids inside `seasonIds` are de-duplicated silently.

**Transaction and query count.** `@Transactional` on the service method. Reads are a fixed set, independent of how many seasons, teams or contacts exist: the source league (1), the name check over the club's league names (1), the chosen seasons by id in one `findAllById` (1), the source's affiliations for the chosen seasons in one query (1, only when copying them), the source's playing conditions for the chosen seasons in one query (1), the source's active contacts in one query (1), and the lazy social-link collection (1). Writes are the new league row, its social links, and one insert per copied row via `saveAll` (so inserts grow with the number of rows copied, but never trigger a per-row select). A query-count integration test guards both (see Test Plan). Any failure rolls the whole copy back.

**OpenAPI.** `openapi.yaml` gains, by hand per the standing process and additions only: the new path, `DuplicateLeagueRequest` and `DuplicateLeagueResponse`. No existing schema changes, so the contract diff is purely additive.

## UI Requirements

Follows the design system's dialog and record-action patterns (`docs/standards/design-system.md`) and mirrors the structure of `CopyLeagueTeamsDialog` and `useLeagueTeamMutations` (a page-level dialog plus a mutation hook). No new shared component and no new visual pattern is expected, so no Claude Design pass is required; a mockup of the dialog is welcome but not a gate.

### Where the action lives (confirmed against the real code)

- **League page header (`ui/src/pages/manage/league/LeagueViewLayout.tsx`): yes.** The top row on the right already holds the Season pill, the outlined **Share schedule** button and the filled **Edit** button. **Duplicate** is added as an outlined button with a copy icon (`ContentCopyOutlined`) between Share schedule and Edit, so Edit stays the filled primary action (`091`, E). On a phone the row already wraps; Duplicate joins the wrap, and the label may drop to the icon with an accessible name "Duplicate league" below `sm` if the row is too tight. The dialog is mounted in this layout, so it works from every tab (Schedule, Teams, Conditions).
- **League edit page (`ui/src/pages/manage/LeagueFormPage.tsx`): yes, edit mode only.** The page actions bar already has Cancel, Save changes and `RecordStatusToggle`. **Duplicate** goes beside the status toggle as an outlined button, shown only when `isEdit` and the league has loaded (never on Add League). It is available on every tab, because the actions bar is outside the tab content. The dialog component is shared with the league page.
- **League card (`LeagueCard.tsx`) and `LeagueTable` rows: no.** The card has no overflow menu; its footer is already four icon-over-caption buttons (Schedule, Teams, Conditions, Edit) and the whole card is a link. Adding a fifth button or inventing an overflow menu for one action is a new pattern with a real cost on a phone, and the manager is one click from the league page (the card opens it) where Duplicate sits in the header. Revisit if card overflow menus are ever introduced (Open Question 5).

### `DuplicateLeagueDialog`

New component `ui/src/pages/manage/leagues/DuplicateLeagueDialog.tsx`, same placement as `CopyLeagueTeamsDialog` is under `leagueTeams/`, mounted only while open (so state resets), full-screen on a phone (`useMediaQuery(theme.breakpoints.down('sm'))`), built from the shared `Input`, `Button`, MUI `Dialog`, `Checkbox`, `Alert`. Props: `open`, `clubId`, the source `league` (id, name), `seasons` (the club's seasons, already loaded by both mount points), `defaultSeasonId` (the page's selected season), `onClose`. The dialog owns its mutation through a small `useDuplicateLeague(clubId)` hook (see Reused versus new) and navigates on success; the parents pass nothing else.

Content, top to bottom:
1. **Title** "Duplicate league", one line of help: "Creates a new league with the same setup. Its teams and matches start empty."
2. **New league name** (required, shared `Input`), prefilled `"<source name> (copy)"`, focused with the text selected on open so typing replaces it. Trimmed on submit. Client check for blank and over 255; the server `409` is shown against this field ("A league named X already exists").
3. **What to copy** group of checkboxes, all ticked by default:
   - **Playing conditions** (help: "Match format, points and bonus rules, and the conditions PDF").
   - **Own team entries** (help: "The club's own teams entered in this league. You can change them on the Teams tab afterwards").
   - **Contacts** (help: "Active league contacts").
   - A non-interactive line "Always copied: format, playing XI size, age rules, logo, phone, email, website and social links."
   - A non-interactive line "Not copied: opponent teams, matches and results."
4. **Seasons** checklist (shown only while Playing conditions or Own team entries is ticked): every club season, newest first, each with its label and dates; **defaults to the season currently selected on the page only**, with Select all and Select none. If the club has no seasons, the section is replaced by a note and the two season-bound checkboxes are disabled and unticked.
5. **Actions:** Cancel, and a primary **Duplicate league** button, disabled while the name is blank, while pending, or while a season-bound option is ticked with no season chosen (with an inline hint "Choose at least one season, or untick the options that need one").

Nothing is created until Duplicate league is clicked; opening and cancelling are free.

**On success:** invalidate `['managed-club', clubId, 'leagues']` (which covers the list and the summary keys under it, as `LeagueFormPage` does after a save) and the new league's own keys by simply leaving them cold; close the dialog; navigate to `/manage/fixtures/leagues/{newLeagueId}/edit?tab=teams&seasonId={firstCopiedSeasonId or the default season}`; show the result as a toast or snackbar using the shared mechanism the Copy dialog uses, with the counts ("Division 2 created. 3 teams entered, playing conditions for 1 season, 2 contacts. Add its teams next."). On failure the dialog stays open with the error: `409` on the name field, anything else as an `Alert` at the bottom.

### Deep link into the Teams tab (small addition)

`LeagueFormPage` currently keeps its tab in local state (`useState(0)`) and has no deep link (this is the `?tab=` item `docs/roadmap.md` lists under `070`). This spec adds the minimum needed: on mount the page reads `?tab=` (`details | teams | schedule | conditions | contacts`, anything else means `details`) as the initial tab and `?seasonId=` as the initial selected season when it is one of the club's seasons. Changing tabs does not write the URL (no routed tabs; that is a larger change). If spec `095` has by then made the edit page's tabs routable, the navigation target changes to its Teams route and this addition is dropped; the behaviour (land on Teams) is the requirement, the query string is the mechanism. The same query string also resolves the roadmap's "`?tab=` deep link into the league's Teams tab" item for this entry path.

### Reused versus new

| Concern | Reused | New |
|---|---|---|
| Dialog shell, full-screen on phone, Cancel and primary footer, season and league pickers' look | `CopyLeagueTeamsDialog`'s structure and MUI `Dialog`, `Input`, `Button`, `Checkbox`, `Alert` | `DuplicateLeagueDialog` itself (different fields) |
| Season list and the "default season" | `listSeasons` and its query key, `pickDefaultSeasonId`, the page's selected season | none |
| Mutation and cache invalidation | the `useLeagueTeamMutations` pattern, `queryClient.invalidateQueries` on the league keys | `useDuplicateLeague(clubId)` hook and `duplicateLeague` function in `ui/src/api/leagueApi.ts` (one file per resource) |
| Entry buttons | `LeagueViewLayout` header actions (outlined `MuiButton`, as Share schedule), `LeagueFormPage` actions bar | the two Duplicate buttons |
| Backend league lookup, cross-club rule | `LeagueServiceImpl.findOrThrowForClub`, `LeagueSeasonAccessValidation.assertSeasonBelongsToClub` | `LeagueService.duplicate`, `DuplicateLeagueRequest`, `DuplicateLeagueResponse`, `DuplicateLeagueNameException` |
| Copying rows | `LeagueAffiliationRepository`, `LeaguePlayingConditionsRepository`, `LeagueContactRepository` (existing finders, plus a finder by league and season ids where one is missing); the builder style `LeagueTeamServiceImpl.copy` uses | a small support class `LeagueCopyRules` in `service.support` holding the pure "which rows, with what values" logic, so it is unit-testable and reusable by a future season rollover |
| Deep link into the edit page | `LeagueFormPage` | reading `?tab=` and `?seasonId=` on mount |

Any new repository method (for example affiliations by league and season ids, contacts active by league) is a custom query and gets a Testcontainers test.

**Mobile first (375 px first):** the dialog is full-screen, one column; checkboxes and the season list are single column with 44 px touch rows; footer buttons stack or fill the width; no horizontal scroll.

## Test Plan

Per `docs/standards/testing.md`.

| Tier | Coverage |
|---|---|
| Unit (backend) | `LeagueServiceImplTest` (duplicate) and `LeagueCopyRulesTest`: the profile fields (including social links and, whichever side of `055` the code is on, XI size, age rules and cutoff) land on the copy; `active` is true even when the source is inactive; the name is trimmed and the source name is not reused; each of the three flags off copies nothing of that group; the three flags default to true when null; a chosen season with no source playing conditions row copies nothing for it; the PDF reference (`documentUrl`, `uploadedAt`, `uploadedBy`) is copied by reference and the structured fields match exactly, including bonus thresholds null when bonus is off; only active contacts are copied and the primary flag survives; no league team, no match is created; blank name `400`, over 255 `400`, empty `seasonIds` with a season-bound flag `400`, empty `seasonIds` with both off is allowed; duplicate name `409` case-insensitively, including against an inactive league and with surrounding spaces; another club's league `404`; another club's or unknown season `404`; duplicate season ids de-duplicated. |
| Integration (Testcontainers, `AbstractIntegrationTest`) | A `LeagueDuplicateIntegrationTest` over real Postgres with a source league that has two seasons of affiliations and playing conditions, three contacts (one inactive, one primary), social links, league teams and matches: the new league has exactly the expected rows and counts match the response; the source league, its league teams and its matches are unchanged; the new league has zero matches and zero league teams; the unique `(league, season)` and `(league, team, season)` keys and the partial primary-contact index are satisfied. Transaction rollback: force a failure mid-copy (for example an invalid season in the list after valid ones) and assert nothing was created. **Query-count guard** (like `LeagueListQueryCountIntegrationTest`): the number of `SELECT` statements is the same for a source with 1 season and 2 teams as for 3 seasons and 20 teams, and no per-row select occurs on insert. Controller integration tests through real HTTP: real `CLUB_ADMIN` success `201`; another club's admin gets `403` or `404`; `platform_admin` superset; `404`, `400` and `409` cases; lazy-collection mapping runs without an ambient test transaction (`docs/standards/backend.md`). Any new repository finder gets its own repository test. |
| Contract | `openapi.yaml` gains the endpoint and the two DTOs; the diff is additions only, no breaking change. |
| Component (Vitest and Testing Library) | `DuplicateLeagueDialog`: opens with the name prefilled "`<name> (copy)`", focused and selected; blank name disables the primary button; all three options ticked and only the default season ticked on open; unticking an option sends the flag false; season list hidden when neither season-bound option is ticked and the button not blocked by seasons then; ticking a season-bound option with no season disables the button with the hint; no request is sent until Duplicate league is clicked and Cancel sends nothing; the request body carries the trimmed name, the chosen `seasonIds` and the flags; success navigates to `/manage/fixtures/leagues/{id}/edit?tab=teams&seasonId=...` and invalidates the league keys; a `409` shows on the name field and keeps the dialog open; another error shows an alert; no seasons disables the season-bound options. `LeagueViewLayout`: the header shows Duplicate between Share schedule and Edit and Edit remains the filled button; clicking opens the dialog on any tab. `LeagueFormPage`: Duplicate shown in edit mode only (not on Add League); `?tab=teams` and `?seasonId=` select the Teams tab and season on load, and an unknown value falls back to Details. `LeagueCard` and `LeagueTable`: no Duplicate control (regression). |
| Browser check | Phone, two-column and wide: the dialog, the header row with the extra button, and the edit page actions bar have no horizontal scroll or clipped buttons. |
| End-to-end | None new: the action is covered by the unit, integration and component tiers; it is not one of the project's golden paths. |

## Acceptance Criteria

- A club admin can open Duplicate league from the league page header (every tab) and from the league edit page (edit mode only), and cannot from the Leagues card or list row.
- The dialog prefills "`<source name> (copy)`" in the required name field, focused with the text selected, and offers Playing conditions, Own team entries and Contacts (all ticked) and a season checklist defaulting to the page's selected season.
- Confirming creates exactly one new, **active** league in the same club with the source's format, playing XI size, age rules and cutoff, logo, phone, email, website and social links, under the new name, and returns the new league's id and the counts copied.
- With the options ticked, the new league has the playing conditions of each chosen season that had them (all structured fields, points system and bonus rules, and the conditions PDF shared by reference), the source's own team entries for each chosen season, and the source's active contacts with the primary flag preserved.
- Unticking an option copies nothing of that group; seasons not chosen get no playing conditions or team entries on the new league.
- The new league has no league teams (opponents), no matches, and no results; the source league, its league teams and its matches are unchanged.
- A name already used by another league of the club (case-insensitive, including inactive leagues) is refused with `409` and the message appears on the name field.
- Another club's league or season returns `404`; a blank or over-long name, or no season chosen while a season-bound option is on, returns `400`.
- A failure part-way copies nothing (one transaction), and the query count does not grow with the number of seasons, teams or contacts.
- On success the manager lands on the new league's edit page, Teams tab, with the chosen season selected, and sees the result message.
- The two leagues are independent afterwards: editing the new league's playing conditions or contacts does not change the source's.
- `openapi.yaml` changes by additions only; no migration is added.

## Open Questions

Each has a proposed default the spec is written to; changing one is a small edit.

1. **Do the club's own teams enter both divisions?** The request says "same affiliation", but in this model an affiliation (`LeagueAffiliation`) is a club team entered in a league for a season. A club's 1st XI in Division 1 and its 2nd XI in Division 2 would make copying the entries wrong, and the manager would have to remove them. **Proposed default: Own team entries is ticked by default**, following the stated intent, with help text that says what it copies so it is easy to untick; the Teams tab removes entries one by one. If "affiliation" meant something the model does not have (for example the governing body the league belongs to), that is a separate small field, not this action. Please confirm which is meant; if the usual case is different teams per division, flip the default to unticked.
2. **Which seasons are copied.** **Proposed default: only the season the manager is looking at**, with Select all for "every season". Reasoning: the person duplicating Division 1 into Division 2 is starting the current season; copying every historical season's conditions and entries would pollute Division 2 with old rows the manager must then understand and clean. An "all seasons that have data" shortcut is therefore an explicit tick, not the default. Alternative if the user prefers: default to all seasons that have playing conditions.
3. **League name uniqueness.** **Proposed default: enforce case-insensitive uniqueness within the club on duplicate only** (409), no change to create and update. Open: apply the same rule to create and update (needs a check that existing clubs have no duplicate names, and a decision on inactive leagues) as a separate small spec.
4. **Should the new league start inactive** so it does not show on public or manager views until ready? **Proposed default: active**, matching create (`active = true` always). A league with no teams and no matches already surfaces in "Need attention" on the Leagues page (`091`), which is the intended nudge.
5. **Card or list-row entry.** **Proposed default: none**, because the card has no overflow menu and a fifth footer button crowds a phone. Revisit if an overflow menu is ever introduced for league cards.
6. **Name collision default.** If "`<name> (copy)`" already exists (a second duplicate), the server returns `409`. **Proposed default: leave it to the manager to edit the name**, with the error on the field; a smart suffix ("(copy 2)") is deferred as polish.
7. **Copying inactive contacts.** **Proposed default: no**, only active contacts, since inactive ones are retired by the manager. Say if a division should inherit the full history.

## Rollout Notes

Two slices, one branch, ordered so the backend is safe to ship alone (nothing in the UI calls it until slice B).

- **Slice A: backend.** `DuplicateLeagueRequest`, `DuplicateLeagueResponse`, `DuplicateLeagueNameException`, `LeagueCopyRules` (support), `LeagueService.duplicate` and its implementation, the controller endpoint, any new repository finders, `openapi.yaml` additions, and the unit, integration (including rollback and query count), repository and contract tests. No migration.
- **Slice B: UI.** `duplicateLeague` in `ui/src/api/leagueApi.ts`, `useDuplicateLeague`, `DuplicateLeagueDialog`, the header button in `LeagueViewLayout`, the edit page button and the `?tab=` and `?seasonId=` initial-state reading in `LeagueFormPage`, with the component tests. Storybook is not required (the dialog is page-level, not a shared component; `docs/standards/frontend.md`).
- **Before building:** re-read `League.java` and `LeaguePlayingConditions.java` for whether `055` has landed (the four XI and age fields), and re-check the League edit page's tabs against spec `095` once it is merged (the deep link mechanism may become a route).
- **Docs to update with the build PR:** `docs/roadmap.md` (a "Deferred by `096`" entry listing: league-name uniqueness on create and update, a card or row entry if overflow menus arrive, a smarter default name suffix, a "duplicated from" reference if a need appears, and a note that season rollover should reuse `LeagueCopyRules`; also mark the "`?tab=` deep link" item under `070` as resolved for this path) and `docs/standards/design-system.md` only if the dialog establishes a pattern worth recording. `docs/architecture.md` is not affected (no new relationship).
- **Relationship to other specs, for the reviewer:** this spec does not change `070`'s copy action or its dialog, does not build `094`'s deferred season rollover, and does not implement `055`; it is written so each of those can land before or after it.
