# 132 — Match Scheduling Rules for Every Way of Saving a Match

**Depends on:** `097-import-framework.md`, `098-league-schedule-import.md` (the "Validation list" and "Match identity"), `111-league-season-dates.md`, `130-matches-pages-revamp.md`, `docs/standards/backend.md`, `docs/standards/page-anatomy.md` (consistency rule, 2026-10-31)
**Status:** approved 2026-11-01 (owner accepted all proposed answers, see Decisions). Building.

## Problem & Goals

On 2026-11-01 the owner created, through the Add Match form, two matches for one team at 09:30 and 10:00 on the same day, and a duplicate Irene Villagers 1 v Harlequins at 07:30, with no warning. `MatchServiceImpl.create`/`update` check links, sides, league-season dates (111) and access, but none of the scheduling rules the league schedule import applies (`LeagueScheduleValidator`, `LeagueScheduleIdentity`, `ScheduleConstants`). The same job (put a match on the calendar) therefore behaves differently by route, which the consistency rule forbids.

Goals:
- One shared server component runs the same scheduling and duplicate rules for every route that saves a match: manual create, manual edit, import (`createBatch`), and any copy or duplicate action. No route keeps its own copy of a rule.
- Own-team overlap and exact duplicates are blocked with a message naming the other match; softer findings are warnings the manager confirms, enforced by the server through a request flag, never by the UI alone.
- Small UI fix (Part B): the Matches list default never hides a match that still needs action, and a just-created match is always visible.

## Non-goals

- No new rules. Only rules that already exist in 098 are reused; the thresholds (120 min own team, 180 min venue, 14-day window) stay in `ScheduleConstants`. Making them per-club is out.
- Whole-file rules (`TEAM_TWICE_SAME_DATE`, `TEAM_MISSING_ON_DATE`, `MEETINGS_EXCEED`, weekday majority, in-file duplicates) stay import-only: they need a whole schedule.
- No clean-up of existing clashes in the data, no report of them, no retroactive blocking (see Rules, "Only on change").
- No per-club time zone (`project_club_time_zones`): the import's South Africa zone is used, same as today.
- No change to `updateDateTime` semantics beyond running the same checks (it is the reschedule route).
- Opponent/league teams that are not ours are not constrained by own-team overlap (as in 098); only a venue or identity rule can catch them.
- No separate "check only" endpoint in this spec (open question 1).

## User Stories

- As a club manager, I cannot save a match that puts one of my teams in two matches less than 2 hours apart, and the message names the other match.
- As a club manager, I cannot save an exact repeat of a match (same teams, date, time), and I am warned when the same teams already play another day nearby or the same day at another time.
- As a club manager, I am warned when the venue is in use within 3 hours that day, and I can choose Save Anyway.
- As a club manager, editing a match's score link or notes is never blocked by an old clash.
- As a club manager, the Matches list always shows today's matches and past matches still awaiting a result.

## Data Model Changes

None. No migration.

## Part A — The shared rules

### Component

New `MatchScheduleRules` (interface + impl in `service/`, per `docs/standards/backend.md`), the only place that evaluates scheduling rules for a single match. It wraps the existing pure classes (`LeagueScheduleValidator`'s own-team, venue and identity logic, `LeagueScheduleIdentity`, `ScheduleRule`, `ScheduleConstants`); the own-team and venue passes are extracted from the private `Run` into package-visible pure functions so the validator and this service call the same code. `ScheduleWorldLoader` is the one mapper from `Match` to `ExistingMatch`; it gains a `loadForCandidate(clubId, date, teams, venue)` entry.

Signature (sketch): `ScheduleCheck check(clubId, CandidateMatch candidate, UUID excludeMatchId)` returning findings; `void enforce(check, Set<String> acknowledgedCodes)` throws `ScheduleRuleException`. `MatchServiceImpl.create`, `update`, `updateDateTime` and `createBatch` all call it after their existing validation and before saving. `createBatch` also treats the batch itself as existing (later items see earlier ones). ArchUnit: only `MatchScheduleRules` may call the extracted pure rule functions outside the import validator (so a future route cannot bypass it).

### Rules applied to manual create/edit (codes reused from `ScheduleRule`)

| Code | Condition | Result |
|---|---|---|
| `OWN_TEAM_OVERLAP` | One of our teams (`homeTeamId`/`awayTeamId`) has another active match the same local date less than 120 min apart | ERROR, blocked. Message: "Riverside U13 already plays Harlequins at 09:30 on 1 Nov 2026, less than 2 hours from 10:00." |
| `DUPLICATE_MATCH` (the import's `ALREADY_EXISTS`, which is a note there, becomes an error on manual routes) | Same league, season, unordered pair, local date and the same time | ERROR, blocked, names the existing match |
| `DUPLICATE_SAME_DAY` (the import's `DIFFERS` outcome) | Same key as above, different time or venue or sides swapped | WARNING, confirmable |
| `POSSIBLE_DUPLICATE_NEARBY` / `POSSIBLE_DUPLICATE_FREE_TEXT` | Same pair on another date within 14 days; similar free-text opponent | WARNING, confirmable |
| `OWN_TEAM_SAME_DATE` | Our team has another match that day at least 120 min away | WARNING, confirmable |
| `VENUE_TIME_CLASH` | Same normalised venue, same date, less than 180 min apart (blank venue never clashes) | WARNING, confirmable |

Identity uses the 098 key `(league, season, unordered pair of resolved sides, local date)`; a free-text side matches by normalised name, similar names raise the free-text warning only. A match with no league is compared only with other no-league matches of the same season. `SAME_CLUB_DERBY` is not applied manually (a manager picking both own teams is deliberate).

An inactive match is ignored in every comparison. On edit, the match being edited (`excludeMatchId`) is excluded from "existing", so saving an unchanged match is never a clash with itself.

### Only on change

The check runs on `update` only when the stored match's local date, start time, home side, away side or venue differ from the request (after normalising the venue as in 098). Otherwise it is skipped, so existing clashes never block editing an unrelated field, and `createBatch`/create always run it. `updateDateTime` always changes the time, so it always runs it. Reactivate (`reactivate`) runs it too, since it puts a match back on the calendar; a clash blocks it with the same message.

## API Contract

| Endpoint | Access | Change |
|---|---|---|
| `POST /api/clubs/{clubId}/matches` | as today | Body gains optional `acknowledgedWarnings: string[]` (rule codes). May answer 409 with findings |
| `PUT /api/clubs/{clubId}/matches/{id}` | as today | Same body field and 409 |
| `PUT .../matches/{id}/date-time`, `POST .../matches/{id}/reactivate` | as today | 409 only (no body flag on reactivate: warnings do not apply, only errors) |
| `POST .../matches/batch` (internal to import) | as today | Same rules; import already acknowledges through its own decisions, which are passed through as `acknowledgedWarnings` |

Error shape: `ScheduleRuleException` (extends `ConflictException`, handled by its own `GlobalExceptionHandler` method like `DuplicateFieldException`, per `backend.md`), status 409, `ProblemDetail` with property `findings`: `[{ code, severity: "ERROR" | "WARNING", message, field: "time" | "date" | "venue" | "teams", otherMatchId }]` and `needsConfirmation: true` when it contains only warnings. Any ERROR finding means blocked whatever `acknowledgedWarnings` holds. When every WARNING code returned is in `acknowledgedWarnings`, the save proceeds; a code not acknowledged returns 409 again (so a new warning created by a second edit is never silently accepted). `otherMatchId` lets the UI link to the other match.

OpenAPI: `openapi.yaml` is regenerated (by hand, `feedback_dont_build_under_live_backend`): new request field (backward compatible, optional), new 409 response with a `ScheduleFindingsProblem` schema on the four operations. The contract diff must show only additive changes plus the new 409 responses.

## UI Requirements

Add Match and Edit Match (`MatchFormPage`, the existing `RecordFormScreen`), no new layout:
- ERROR findings: shown inline under the field named by `field` (time, date, venue, teams) as helper error text, with the message and a link to the other match; Save stays disabled until the field changes. The form also shows an error alert at the top with the same text for phone widths where the field is off-screen.
- WARNING findings only: a warning banner (the existing alert component, see the import step's warnings and the publish-warnings dialog) above the actions listing each message, with a "Save Anyway" button next to Save per the compact button rule (`page-anatomy.md`). Save Anyway resends the same body with `acknowledgedWarnings` set to the returned codes. Changing any of date, time, teams or venue clears the banner and re-checks on the next save.
- The same findings handling is used wherever the UI calls these endpoints (reschedule dialog from the card menu, reactivate) via one shared helper in `ui/src/api/` plus one shared presentational piece, not per-screen copies.
- Import wizard unchanged (it already shows these findings).

## Part B — Matches list default (small)

- The default (upcoming only) filter becomes: match date today or later in the club's zone, **or** active, past, with no published result (status `NONE`/`DRAFT`). `upcomingOnly=true` is redefined server-side accordingly (`MatchRepository` query and the summary counters, which must keep asking the list's exact filters per 130). The counter label stays "Upcoming Matches" only if nothing else is changed in 130; the label wording becomes "Upcoming and Awaiting Result" if the owner agrees (open question 2).
- View Entire Season still shows everything, unchanged.
- After a successful create or edit, the user returns to the list (127 return navigation). If the saved match would be hidden by the current filters (a past match with a published result, an older season selection, a search), the list opens with View Entire Season on and the saved match highlighted. The existing `showAll=1` mechanism in `MatchFormPage` is extended to every origin of the Matches list, not only the league Schedule.

## Test Plan

Per `docs/standards/testing.md`:
- Backend unit (`MatchScheduleRulesTest`, plus the existing `LeagueScheduleValidatorTest` unchanged and green, proving the extraction): each code at its boundary (119, 120 and 121 min; 179, 180 and 181 min), swapped sides, free-text names, blank venue, inactive match ignored, the edited match excluded, no-league matches, acknowledged and unacknowledged warning codes, an error that acknowledgement cannot override, unchanged-fields skip.
- Backend integration (Testcontainers): the owner's three cases reproduced through `POST /matches` (09:30 then 10:00 same team is 409 ERROR; repeated 07:30 is 409 ERROR; same pair other time is 409 warning then 201 with acknowledgement); edit of an unrelated field on a seeded clashing match returns 200; `createBatch` blocks an in-batch overlap; reactivate into a clash is 409; club isolation.
- ArchUnit: the bypass rule above.
- OpenAPI contract diff: additive only, new 409s present.
- UI (Vitest): inline error under the right field with the other-match link, banner with Save Anyway resends acknowledged codes, field change clears banner, phone width; list default includes today and past awaiting-result matches and excludes past published ones; View Entire Season unchanged; create of a hidden match opens the list with it visible and highlighted.
- Playwright: one journey, create two clashing matches, see the block, change the time, save; not required to run in CI until the suite is run (see roadmap note).

## Acceptance Criteria

- The same fixture saved by manual create, manual edit, reschedule, import and batch produces the same findings (one shared test fixture asserts this).
- Creating a second match for one of our teams less than 2 hours from another active match is refused with a message naming that match, by the API, not only the form.
- A repeat of an existing match (same teams, date, time) is refused; the same teams the same day at another time, or within 14 days, warn and save only with the acknowledgement.
- A venue within 3 hours of another match that day warns; Save Anyway saves it; a direct API call without `acknowledgedWarnings` fails with 409.
- Editing the notes, scoring link or logo of a match that already clashes succeeds.
- Editing a match never clashes with itself; inactive matches never cause a finding.
- `docs/` lists no second implementation of an own-team, venue or identity rule (ArchUnit enforces).
- The Matches default list shows today's matches and past matches without a published result; View Entire Season shows all; a created match that the filters would hide is visible on return.

## Rollout Notes

One PR, backend first (extraction with `LeagueScheduleValidatorTest` green before any behaviour change), then the form, then the list change. No feature flag. Existing data is untouched; the owner's three bad matches are removed by hand (delete empty match, 109). Update `docs/roadmap.md` and the 098 spec's rule table (a one-line pointer to this spec: rules now shared) in the same change. Record the "warning banner with Save Anyway" pattern in `page-anatomy.md` when built.

## Decisions (owner, 2026-11-01)

1. The form checks on Save only; the server enforces everything.
2. The list counter "Upcoming Matches" is renamed to include awaiting-result matches.
3. A same-day rematch of the same pair at a different time is a warning.
4. OWN_TEAM_OVERLAP applies across leagues for the same team.
5. A past match with only a draft result stays visible in the default view until the result is published.
