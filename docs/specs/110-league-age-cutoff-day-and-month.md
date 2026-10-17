# 110: League Age Cut-off as a Day and Month

**Depends on:** `029-league-management.md` (a league's optional `minAge`, `maxAge` and `ageCutoffDate`), `095-league-edit-gold-standard.md` (the league edit form), `072-league-view-pages.md` (the league view), `093`/`076` (team selection eligibility that uses the age rule).
**Status:** approved by the user 2026-10-16. The user found the design wrong and supplied the real rules (below); existing data does not matter (nothing on a server).

## Problem & Goals

A league's age rule is "age as at a reference date". Today the reference date is one fixed date with a year (`ageCutoffDate`), or, when empty, the start date of the whole club season. A fixed year goes stale every season, and the season-start fallback is wrong for a league that starts mid-season.

The real rules, in South African school-age cricket (user, 2026-10-16):

1. **A club league that runs September to July** judges age as at **31 December of the year it starts**. A player who is under 13 in that calendar year stays eligible all season, even after turning 14 the following year.
2. **A winter league that starts in July** judges age **on the day it starts**: a player is still eligible provided they have not yet turned 14 when it starts. (No cut-off day and month set.)
3. **A cup that follows (for example the Capital Cup)** is strictly the school rule again: **31 December of the year it is played**, so a player must really be under 13 that calendar year.

Goals:

- Store the cut-off as a **day and month** (for example 31 December), not a date with a year, so nothing goes stale.
- Judge ages as at that day **in the calendar year the league starts playing in that season**.
- With no cut-off set, judge ages **on the day the league starts**.
- Show the manager the actual date that applies, so nobody has to work it out.

## Non-goals

- Changing how an age is compared with the limits: a player is eligible when their age on the reference date is within `minAge` and `maxAge`, both inclusive (unchanged).
- A separate rule per team or section, and rules that differ within one league.
- Migrating existing data (the user has none that matters; the old column is dropped).
- Rolling anything forward on "duplicate league": nothing is stored with a year now, so there is nothing to roll.

## User Stories

- As a club manager, I set a league's age limits and a cut-off of 31 December once, and it is right for every season.
- As a club manager, I leave the cut-off empty on a winter league, and ages are judged on the day it starts.
- As a club manager, I see on the league page which date ages are judged on for the current season, so I can check it.
- As a club manager creating a player from a guest on the scorecard, the date of birth box opens in the right range for that league and season.

## Data Model Changes

Migration `049-league-age-cutoff-day-month.sql` (additive then a drop; no data to move):

- `league.age_cutoff_month SMALLINT NULL` and `league.age_cutoff_day SMALLINT NULL`, with a CHECK that both are null or both are set, the month is 1 to 12 and the day is 1 to 31 and valid for the month (February up to 29).
- `ALTER TABLE league DROP COLUMN age_cutoff_date`.

## API Contract

- `LeagueDto`, `CreateLeagueRequest`, `UpdateLeagueRequest`: **`ageCutoffDate` is replaced by `ageCutoffMonth` and `ageCutoffDay`** (nullable integers). Validation (400): both or neither; month 1 to 12; the day must exist in that month (29 February allowed). This is a breaking change to one field, approved by the user.
- New `GET /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/age-reference-date` (club manager): returns `{ referenceDate: "yyyy-MM-dd", source: "CUTOFF" | "LEAGUE_START", leagueStart: "yyyy-MM-dd", leagueStartSource: "FIRST_MATCH" | "SEASON_START" }` (spec 111 adds `"LEAGUE_SEASON_DATES"`, checked first), so screens show and use the same date the server uses. `404` for another club's league or season.
- `openapi.yaml` updated for all of the above.

## The reference date (single rule, in one place)

Let **league start** for (league L, season S) be the date of L's earliest active match in S, or S's start date when L has no match in S yet.

- If L has a cut-off day and month: the **reference date** is that day and month in the **calendar year of the league start**. A 29 February in a year with no 29 February becomes 28 February.
- Otherwise: the reference date is the league start.

One class (`LeagueAgeReference`) computes it; `SelectionEligibility`, the team selection batch rules and the new endpoint all use it, so the rule cannot drift. Eligibility messages that mention a cut-off now say the date used ("as at 31 Dec 2026").

## UI Requirements

- **League form (`components/LeagueForm`):** the "Age cutoff date" date input becomes **Age cut-off (day and month)**: a month select and a day select (or number), both optional, with helper text "Ages are judged on this day in the year the league starts. Leave empty to judge ages on the day the league starts (for example a winter league)." When a Min or Max age is entered and the cut-off is empty and untouched, it is **filled with 31 December** (editable, clearable; never overwrites the manager's own choice). An impossible day (31 April) is refused with a message. A cut-off with no age limits shows a note that it has no effect.
- **League page (view and edit):** a line "Ages are judged on 31 Dec 2026 (current season)" from the new endpoint, with the source ("the cut-off" or "the day the league starts"), shown when the league has an age limit.
- **Date of birth window (New player tab in the Link dialog):** uses the endpoint's reference date for the match's league and season instead of computing a date itself; falls back to today when the lookup fails or the match has no league.
- **View and edit pages** that showed the old date show the day and month.

## Test Plan

- **Backend unit:** `LeagueAgeReference` (cut-off in the start year, a September-start league and a July-start winter league, no cut-off uses the league start, no matches falls back to the season start, 29 February on a non-leap year, the earliest *active* match is used); the eligibility messages; create and update validation (both or neither, month and day ranges, 31 April and 30 February rejected, 29 February accepted); the copy rules carry the day and month.
- **Backend integration (Testcontainers):** migration over a database that had `age_cutoff_date` rows (the column is gone, new columns null); league create and update round trips; the new endpoint for a cut-off league, a no-cut-off league, no matches, another club's league (404); a team selection age check for the three rules in the Problem section (a player eligible all season under rule 1, ineligible under rule 3).
- **Frontend:** helpers (31 December default, day validity per month), the form (default fill, never overwriting, validation, the no-effect note, the stripped old date), the league page line, the date of birth window using the endpoint's date, fallbacks.
- **Contract:** the OpenAPI diff is the planned change only.

## Acceptance Criteria

- [ ] A league stores a cut-off as a day and month; the old date column and field are gone.
- [ ] The three rules in the Problem section give the eligibility the user described.
- [ ] No cut-off set means ages are judged on the league's start day (its first match in that season, else the season start).
- [ ] The league form fills 31 December when an age limit is first entered and the cut-off is empty, and never overwrites the manager's own value.
- [ ] The league page and the New player date of birth window show and use the server's reference date.
- [ ] No new library.

## Rollout Notes

- **Order of work:** the migration, domain, DTOs and `LeagueAgeReference`, then eligibility and the endpoint, then the league form, then the league page line, then the date of birth window (that window lives in PR #126, so it is adapted after that PR merges).
- **Docs to update when built:** `docs/roadmap.md`, `docs/standards/backend.md` (the reference date lives in one class), a pointer in `029`'s Rollout Notes.
