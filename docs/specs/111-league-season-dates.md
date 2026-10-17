# 111: League Season Dates, and Matches Honouring Them

**Depends on:** `110-league-age-cutoff-day-and-month.md` (the age reference date uses a league's start date in a season), `029-league-management.md`, `050-league-schedule-and-fixtures.md`, `095-league-edit-gold-standard.md` (the league page and its Season select), `098-league-schedule-import.md` (matches created by a schedule import).
**Status:** approved by the user 2026-10-16 ("We could add a mandatory start and end date to make it clearer" and "Matches should honour that").

## Problem & Goals

A league is tied to a season only indirectly: its teams, league teams and playing conditions each carry a season, but nothing says when the league actually runs in that season. `110` had to guess a league's start from its first match. A manager cannot see or set when a league starts and ends, and nothing stops a match being scheduled outside the league's period.

Goals:

- Each league has a **start date and an end date for each season** it runs in, **required** when the season is set up for the league.
- **Matches in that league and season must fall within those dates.**
- The age rule (`110`) uses the league's explicit start date.

## Non-goals

- Blocking matches in a league season that has **no dates yet** (older data): the league page shows a banner asking for the dates, but nothing else is blocked. A stricter "no dates, no matches" rule is a one-line follow-up if the user wants it.
- Date rules for friendlies (matches with no league).
- Multiple phases or rounds inside one league season.

## User Stories

- As a club manager, I set when a league starts and ends for a season, so that everyone can see it and age rules use it.
- As a club manager, I cannot schedule or move a match outside its league's dates, and I am told what the dates are.
- As a club manager, I cannot shrink a league's dates so that an existing match falls outside them, and I am told which matches.
- As a club manager, I see a banner on a league season that has no dates yet, so I know to set them.

## Data Model Changes

Migration `050-league-season-dates.sql`:

- New table `league_season`: `id`, `league_id` (FK league), `season_id` (FK season), `start_date DATE NOT NULL`, `end_date DATE NOT NULL`, the usual `created_at`, `updated_at`, `updated_by`; unique `(league_id, season_id)`; CHECK `start_date <= end_date`.
- No data migration (nothing on a server worth keeping).

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/dates` | club manager | `{startDate, endDate}`, or `404` when none are set yet. |
| `PUT /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/dates` | club manager | Create or replace the dates. `400` when `startDate` is after `endDate` or a date is missing. **`409` when an active match of this league in this season would fall outside the new range**, naming how many and the earliest and latest match dates. |

- **Matches honour the dates:** match create, update and reactivate (a match deactivated outside the dates cannot come back; deactivating is never checked), and a future bulk or schedule-import path per fixture, reject, with `400` and a code `MATCH_OUTSIDE_LEAGUE_DATES`, a match whose league and season have dates and whose local match date is outside them. The message names the dates ("This league runs from 1 Sep 2026 to 31 Jul 2027."). A league season with no dates is not checked.
- **`110`'s age reference date** (`LeagueAgeReference`, the `age-reference-date` endpoint) takes the league start from these dates first, then the first match, then the season start; the endpoint's `leagueStartSource` gains `LEAGUE_SEASON_DATES`.
- `openapi.yaml` updated for all of this.

## UI Requirements

- **League page:** a "Season dates" block above the season-scoped tabs for the selected Season: **Start date** and **End date**, both required, saved with the league's other changes or with their own Save; an amber banner "Set the start and end date for 2026/2027." when none exist; an error shows the server's message when the range would exclude existing matches.
- **Match form** (`MatchForm`): when the chosen league and season have dates, the date and time input shows them as its allowed range (so the calendar opens inside it), and an out-of-range value shows "This league runs from 1 Sep 2026 to 31 Jul 2027." before saving. The server's refusal is shown if it still happens.
- **League page "Ages are judged on ..." line** (`110`) shows the source "the league's start date" when the dates exist.
- **Import's Match step** is unaffected.

## Test Plan

- **Backend:** upsert validation (start after end, missing); the 409 when a match would fall outside (counts and dates in the message); match create and update inside, on the boundary days, and outside the range; no check when the league season has no dates, or for a friendly; the schedule import reports out-of-range fixtures as row errors; `LeagueAgeReference` prefers the explicit start; another club's league is 404; the migration.
- **Frontend:** the Season dates block (required, save, the 409 message, the banner), the match form's range and message, the age line's source.
- **Contract:** additions and the one new error code only.

## Acceptance Criteria

- [ ] A league season can have a required start and end date, set on the league page.
- [ ] A match outside those dates is refused (create and update, and by the schedule import), with the dates in the message.
- [ ] The dates cannot be changed to exclude an existing active match.
- [ ] A league season with no dates shows a banner and is otherwise unaffected.
- [ ] The age reference date (`110`) uses the explicit start.
- [ ] No new library.

## Rollout Notes

- **Order of work:** after `110`'s backend is committed: migration and entity, endpoint and the match checks, then the reference date change, then the league page block and the match form range.
- **Known limits:** there is a narrow race between a match create or update and a concurrent `PUT` of the dates (no lock; acceptable for now). The browser's range check and the server's check share a time zone assumption (the club time zone gap).
- **Docs to update when built:** `docs/roadmap.md`, `docs/standards/backend.md`, pointers in `029` and `050`.
