# 065 — Group Poll Responses View

**Depends on:** `064-unified-availability-polls.md` (the unified polls list and `GroupPollCard`), `063-section-availability-and-flexible-squads.md` (`SectionAvailabilityRound`/`Window`, `getRoundResponses`, `getRoundMatches`, `setRoundPlayerStatus`), `036-view-first-record-detail-screens.md` and `059-record-card-click-to-view.md` (detail-screen pattern).
**Status:** approved

## Problem & Goals

A group poll's responses are shown today as an expanding list inside the poll card: one box per player with one chip per time slot ("Sat 3 Oct - Morning: Unavailable", "Sat 3 Oct - Afternoon: No response"). It is hard to read. To answer the question a team manager actually asks, "who is in for Saturday morning?", they have to scan every player's chips. The card also sits in a three-column grid, so the list is cramped.

**Goals**
- A dedicated **Responses page** for one group poll, opened from the card's **Responses** button, replacing the in-card expansion.
- Three views behind a switch at the top: **By time slot** (default), **By player**, **Summary**.
- **By time slot** answers "who is in for this slot": each slot shows its matches, then players grouped by answer: Available, Unsure, Unavailable, No response.
- Admins can still correct a player's answer from the page, exactly as they can today.
- No backend change: every field needed already exists.

## Non-goals

- **Squad (per-match) poll responses.** Those stay on the match's Availability tab (`032`/`033`), unchanged.
- **Any change to how responses are collected** (public page, link, autoclose, reopen rules).
- **Exporting, printing or messaging players who have not responded.** Real follow-ups (a "nudge the non-responders" action ties into the reminders item already open in `docs/roadmap.md`), not built here.
- **Persisting the chosen view.** It resets to By time slot on each visit, matching the project's other list switches.

## User Stories

- As a club admin, I click **Responses** on a group poll card and land on a page for that poll, with the poll's name, section, open/closed state and close time at the top.
- As a club admin, in **By time slot** I see each slot as a section headed by its date and Morning/Afternoon, listing the matches played in it, then three columns of players (Available, Unsure, Unavailable) each with a count, so I can read off who is in for that slot. Players who have not answered sit in a **No response** row below, collapsed to its count by default (a section can have dozens of players) and expandable per slot.
- As a club admin, I can search players by name from the top of the page and the search applies to every view.
- As a club admin, in **By player** I can hide players who have not answered in any slot, to read just the replies.
- As a club admin, in **By player** I see one row per player with their shirt number and one aligned answer column per time slot, to check one person across the whole poll.
- As a club admin, in **Summary** I see, per slot, how many answered each way and how many have not answered, with a proportional bar, for a quick read before drilling in.
- As a club admin, I can tap a player in By time slot or By player and set their answer (Available, Unsure, Unavailable) when the poll is open; it is disabled with a short explanation when the poll is closed.
- As a club admin, I can reach the poll's share link from this page, and go back to the polls list.

## Data Model Changes

None.

## API Contract

No new or changed endpoints. The page composes existing calls:

| Call | Used for |
|---|---|
| `getRoundResponses(clubId, roundId)` | Players (name, `jerseyNumber`), per-slot statuses, per-slot counts, open state, share path |
| `getRoundMatches(clubId, roundId)` | Matches per slot (`windowId`, `dayPart`, team/opponent, date, venue, league) |
| `listRounds(clubId, { sectionId })` | Poll header details not in the responses payload (close time, `autoClose`), or taken from the list cache |
| `setRoundPlayerStatus(...)` | Admin override of one player's answer in one slot |

## UI Requirements

Composes existing pieces only: `ManageScreenHeader` (title and back link), MUI `ToggleButtonGroup` for the view switch, `Chip`/status tones already used by the responses UI, `ConfirmDialog` is not needed (an override is reversible). New page `ui/src/pages/manage/GroupPollResponsesPage.tsx` at `/manage/availability/group/:roundId`.

- **Player search:** a search field beside the view switch, filtering players by first or last name in all three views (Summary counts always stay the full totals).
- **Header:** poll description, section, Open/Closed badge, "Closes <date time>" or "Closes manually", **Share invite** (existing share dialog). Back link to `/manage/availability`.
- **View switch:** `Time slot | Player | Summary`, default Time slot, not persisted.
- **By time slot:** one block per slot, ordered by date then Morning before Afternoon. Block header "Sat 3 Oct · Morning" with small counts. Under it, the slot's matches (team v opponent, time, league). Then three groups in this order: Available, Unsure, Unavailable, each with its count; players are listed with shirt number and name. Three columns from `md`, stacked on mobile. A group with nobody in it shows a quiet "None" so the layout does not jump. Below them a full-width **No response (N)** row with a Show/Hide control, collapsed by default and independent per slot (not persisted); expanded, it lists those players in a multi-column flow. A very long Available/Unsure/Unavailable list scrolls inside its own box (about 12 rows tall) rather than stretching the page. Tapping a player opens a small menu to set their answer.
- **By player:** a table, one row per player (shirt number, name), one column per slot holding that slot's answer as a single status chip, so rows align. Sorted by name. A **Hide players who haven't answered** switch (default off) removes rows with no answer in any slot. Tapping a chip opens the same override menu. On mobile the table scrolls inside its own container.
- **Summary:** one card per slot: matches, a stacked bar (Available / Unsure / Unavailable / No response, theme status colours with text counts, never colour alone), and "N of M answered".
- **Closed poll:** answers are read-only; the override menu is disabled and a line explains why.
- The in-card responses expansion and its row component are removed from `GroupPollCard`; **Responses** navigates to the new route.

## Test Plan

- **Component/page (Vitest + Testing Library):** page renders header and the default By time slot view from mocked `getRoundResponses`/`getRoundMatches`; players land in the correct group per slot (including a player with different answers in the two slots); counts match; empty groups show "None"; No response is collapsed to its count and expands per slot; a long group scrolls inside its box; search filters players in every view while Summary totals stay full; the hide-non-responders switch removes rows in By player; switching to By player shows aligned columns; Summary shows per-slot counts and "N of M answered"; override menu calls `setRoundPlayerStatus` with the right ids and refreshes; override disabled with the explanation when closed; back link and share link work; unknown round shows a clean not-found state.
- **`GroupPollCard`:** **Responses** navigates to the page; the old expansion and its tests are gone.
- **Storybook:** one story for any new shared component extracted (none expected; page-local pieces need no story per `frontend.md`).
- **Playwright:** extend the polls golden path to open Responses and switch views, if the harness can run it.

## Acceptance Criteria

- Clicking **Responses** on a group poll opens its own page; the card no longer expands a responses list.
- By time slot shows, per slot, the matches and players grouped Available / Unsure / Unavailable with counts, plus a No response row collapsed to its count and expandable.
- A section with many players stays readable: No response is collapsed by default, long groups scroll in their own box, and a player search works in every view.
- By player shows one aligned column per slot; Summary shows per-slot counts and a proportional bar.
- A player's answer can be changed from the page while the poll is open, and not when it is closed.
- Status is never conveyed by colour alone.
- No backend or API change.

## Rollout Notes

Frontend only. Ship as a single change after `064`. The "nudge players who have not responded" action (using the No response group) is the obvious next step and belongs with the reminders work already tracked in `docs/roadmap.md`.
