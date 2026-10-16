# 110: League Age Cut-off Date: Default and Year Check

**Depends on:** `029-league-management.md` (a league's optional `minAge`, `maxAge` and `ageCutoffDate`; players are age-checked as at the cut-off date, or the season's start date when there is none), `095-league-edit-gold-standard.md` (the league edit form).
**Status:** approved by the user 2026-10-16 as a requirement ("when setting up a league and changing the max age, set the cut-off date to the end of 31 December if it is not set, adjust the year automatically, and when saving, if it does not add up, block or warn the user"). The details below are the builder's reading of it; the user may adjust them.

## Problem & Goals

A league's age rule is "age as at the cut-off date", and the cut-off date is one fixed date on the league, not one per season. A manager who sets a maximum age usually leaves the date empty (so the season's start date is used, which is not what most leagues mean) or types a date whose year goes stale when the next season starts. A U15 league with a cut-off of 31 Dec 2025 quietly misjudges every player in the 2026/27 season.

Goals:

- **A sensible default:** when a manager sets an age limit and there is no cut-off date, the form fills in **31 December of the season's year**, so the common rule needs no typing.
- **The year follows the season:** the year used is the year the league's current season starts in.
- **A year check on save:** when age limits are set and the cut-off date's year is not the season's year, the manager is told, with a one-tap fix, before the league is saved.

## Non-goals

- **A cut-off per season.** The model stays one date per league. Moving the date forward each season is still a manual save (this spec makes the stale year visible and easy to fix).
- **Changing how ages are judged** (`SelectionEligibility`, the batch overview). Unchanged.
- **Server-side blocking.** The server still accepts any valid date; the check is a form safeguard.
- **Rolling the date when a league is duplicated for a new season** (`096`): a possible follow-up, not built here.

## User Stories

- As a club manager, when I enter a maximum or minimum age on a league that has no cut-off date, the cut-off date fills in as 31 December of the season's year, so I do not have to work it out.
- As a club manager, I can still change or clear the date, and my own date is never overwritten.
- As a club manager, when I save a league with age limits and a cut-off date in the wrong year for its season, I am warned and can fix it with one tap or save anyway.

## Data Model Changes

None. No API change.

## API Contract

None.

## UI Requirements

In the league form (`components/LeagueForm`, used by the league edit page and the add page):

- **Season year.** The form is given the club's seasons. The league's season year is the start year of the season that contains today, else of the latest season by start date, else the current calendar year.
- **Default.** When the manager enters a value in Min age or Max age and the cut-off date is empty **and has not been touched by the manager in this edit**, the cut-off date is set to `31 December <season year>` and a helper line says "Set to 31 December of the season's year. Change it if your league uses another date." Clearing the age limits does not clear a date the form filled in only while it is still the form's own default; a date the manager typed is never changed.
- **Year check on save.** When at least one age limit is set and a cut-off date is set whose year differs from the season year, saving shows an amber, non-blocking panel above the buttons: "The cut-off date is in <its year> but the current season starts in <season year>. Ages are judged as at the cut-off date." with two buttons, "Use 31 December <season year>" (sets the date and saves) and "Save anyway" (saves as typed). Nothing is saved until one is pressed. A cut-off date that is not a real date is refused by the date input as today.
- **No age limits, no check.** A league with no age limits shows no helper and no panel.
- The age fields' other rules (min must not exceed max) are unchanged.

## Test Plan

- Unit tests for the pure helpers (season year choice; default date; mismatch rule): a season containing today, today between seasons, no seasons, a season that starts in one year and ends in the next, an empty cut-off, a typed cut-off, a cut-off in the right year.
- Form tests: entering Max age fills the date and shows the helper; entering Min age does too; a typed date is not overwritten; clearing the limits keeps a typed date; saving with a stale year shows the panel and saves nothing; "Use 31 December" fixes and saves; "Save anyway" saves as typed; no panel when the year matches or there are no limits; the add page and the edit page both behave the same.
- Story for the form with the stale-year panel.

## Acceptance Criteria

- [ ] Entering an age limit on a league with no cut-off date fills in 31 December of the season's year, with a helper line.
- [ ] A date the manager typed is never overwritten.
- [ ] Saving with age limits and a cut-off year that differs from the season's year shows the warning and saves only after the manager chooses.
- [ ] No server or contract change; no new library.

## Rollout Notes

- Possible follow-ups: roll the cut-off year forward when a league is duplicated for a new season, and a server warning when a league's cut-off year is stale.
- Docs to update when built: `docs/roadmap.md`, a pointer in `029`'s Rollout Notes.
