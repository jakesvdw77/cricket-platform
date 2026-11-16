# 156: Team Selection Analysis

**Depends on:** `093-team-selection-hub.md`, `137-team-selection-revamp.md`, `docs/standards/page-anatomy.md`.
**Status:** built 2026-11-16, awaiting the owner's review. Requested by the owner: a way to see how often each player is picked, so nobody plays a lot more (or never plays) without the selectors noticing. Mockup: `docs/mockups/team-selection-analysis-mockup.html` (approved by the owner 2026-11-16).

## Problem & Goals
Team Selection shows one match at a time. Nothing shows the spread across the games, so a player picked in every game, or in none, is only noticed by eye.

**Goals:** one read-only dialog, **Selection Analysis**, with a horizontal bar per player for how many of the games they were picked for, sorted most picked first.

## Non-goals
No stored data, no backend change, no share or print, no edits from the dialog.

## Behaviour
- A secondary **Selection Analysis** button in the Team Selection header, on all four tabs.
- **Games In View** (default) uses the matches the tab is showing now (the hub's season, league, section, team and View Entire Season). **Whole Season** reads the season's matches (every match, past and future) with the same league, section and team filters.
- **All Selections** counts every saved pick, drafts included; **Announced Only** counts only announced teams.
- There are no filters of its own: the page's League, Section and Team filters decide what is counted, so one team can be looked at within one league or tournament (owner, 2026-11-16).
- Per player: playing picks, 12th man picks (hatched part of the bar), and "of N" = the games they said they were available for (or were picked for). The gold line is the average picks per player. A player clearly above average is tagged **Above Average**; a player with no picks is listed last and tagged **Not Picked**.
- Figures: Players, Average Picks, Not Picked Yet.
- Phone: full-screen dialog, shortened first names.
- Names are full inside the manager screens; the dialog is never shared or printed, so the initials rule of spec 114 does not apply.

## Data
Computed in the browser from the existing team selection overview (`matches`, their sides' `picks`, and each player's per-match `cells`). `analyseSelection` in `ui/src/pages/manage/teamSelection/selectionAnalysis.ts` is the one place the rules live. If the overview is `truncated`, the dialog says so.

## Tests
Unit tests for `analyseSelection` (counts, 12th man, announced only, team filter, availability denominator, average, tags, sort) and a dialog test (rows, toggles, Not Picked).
