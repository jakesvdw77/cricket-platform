# 083 — Availability Filters and Toolbars

**Depends on:** 073 (availability hub), 074 (coverage), 081 (page counters), 043 (persisted list filters), 082 (poll card)
**Status:** draft — design proposal only, written 2026-10-07 from the user's list. No mockup yet and nothing built. Starts with the Availability pages; whether the pattern becomes the standard for every list page is decided afterwards.

## Problem

The three Availability views (Polls, Players, Coverage) each have their own toolbar with their own filters, and they do not agree with each other:
- **The counters ignore the filters.** The four counters under the header always cover every open poll in the manager's scope, while the list below is filtered by section, type and the closed toggle. The numbers look stale and cause confusion.
- **"Answers awaited" is unclear.** (See "What the counters mean" below.)
- **The toolbars differ.** Polls has Search, Type, Section, a Show closed toggle and a sort arrow. Players has Season, Section, Team, League, Search, Show past games and Hide players with no answers. Coverage has Season, Section, League and Show past slots.
- **Selections are not shared.** Each view saves its own filters under its own key, so choosing a section on Polls and then switching to Players starts again.
- **Polls has no League filter**, while the other two do.
- **Type as a dropdown wastes space** for three values (All, Group, Squad).
- **The phone version** is inconsistent. Players has a "Filters" button that only hides two of its fields and does not show whether filters are set.

## What the counters mean today

- **Open polls**: the number of open polls (group and squad) the manager can see.
- **Players responded (5 / 18)**: distinct players in the audience of any open poll who have given at least one real answer, out of distinct players in any open poll.
- **Answers awaited (16)**: for each open poll, the players in its audience who have not fully answered, added up across polls. In the example, one group poll with 13 not yet answered plus one squad poll with 3 gives 16. A player who is in two polls counts twice, which is why it does not equal 18 minus 5.
- **Close in 48 hours**: open polls whose close time is within the next 48 hours.

## Goals

- One filter model for all three views: the choices that mean the same thing (League, Section, Team where it applies) are shared and remembered as you move between Polls, Players and Coverage.
- The counters always describe what the list shows.
- A League filter on Polls, and a compact control for the poll type.
- One toolbar layout on all three views, desktop and phone.
- A phone pattern that collapses the filters behind one button with a badge showing how many are set.

## Non-goals

- Changing other list pages now (Matches, Players, Leagues and so on). The components are built so they can be reused later.
- Changing what each view shows apart from filtering (cards, grid, coverage cells).

## Proposed design

**Decision (user, 2026-10-07): Season is not a toolbar filter.** Seasons are not important for the Polls view (polls are about what is open now; a history option can come later), so Season leaves the toolbars. Players and Coverage still need a season to work (rosters and squads are per season), so they keep one: a small clickable label beside the page title ("2026 season ▾", default the current season, shared and remembered across Players and Coverage) that opens a list of seasons. Polls shows no season control. This frees a field of space on every toolbar.

**1. Shared filters, remembered across the three views.** League, Section and Team (Players only) live in one shared state owned by the hub layout, saved per club in one place (`usePersistedListFilters`, one key), and mirrored in the page address (for example `?section=...&league=...`) so the back button and shared links keep the same view. Switching tabs keeps them; "Clear filters" clears all. Where a filter does not apply to a view (Team on Polls, for example) it is simply not shown there, but its value is kept for when the manager returns.

**2. View-specific controls stay with their view, on the line above the content.**
- Polls: search, type, show closed, sort.
- Players: search, show past games, hide players with no answers.
- Coverage: show past slots.

**3. One toolbar layout.**
- Desktop: the toolbar card holds the shared filters in a fixed order (League, Section, Team where it applies) and search, the same on every view. The view-specific controls sit on a line directly above the content, on the right, sharing it with a "Showing ..." scope text on the left. The Poll type becomes a small three-way toggle (All, Group, Squad) there, instead of a dropdown.
- Phone: one row with search and a "Filters" button. The button shows a badge with the number of active filters; it opens a bottom sheet with all the filters of the current view (shared and view-specific) and "Clear all" and "Done". Active filters also show as removable chips under the toolbar.

**4. Counters follow the filters.** The Availability summary endpoint (081) takes the same filter values (league, section, poll type, include closed) and returns the figures for exactly what the list shows. A short line under the counters says what they cover when filters are set ("Showing: Vets › Over 40, League X"). With "Show closed polls" on, the first counter reads "Polls shown" instead of "Open polls".

**5. Clearer counter wording.** Replace "Answers awaited" (a sum that double-counts players) with **"Players still to answer"**: distinct players who still owe at least one answer in the polls shown (13 in the example, which matches 18 minus 5 when one audience covers everyone). The total of missing answers per poll stays visible on each poll card. To be confirmed by the user.

**6. Components.** A shared `FilterBar` (desktop two-row layout and the phone sheet with the badge and chips) and a `useAvailabilityFilters` hook in the hub layout, written generically enough to adopt on other list pages later. The old `ListToolbar` stays for the pages that do not move yet.

## API Contract (outline, finalised in planning)

- `GET .../availability-polls/open`, `.../closed` and `.../section-availability-rounds` gain an optional `leagueId` filter (polls are matched through their matches' league), alongside the existing section filter; no season parameter for polls.
- `GET .../availability/summary` gains `seasonId`, `leagueId`, `sectionId`, `type` and `includeClosed` parameters and returns the distinct "players still to answer" figure.

## Test Plan (outline)

Filter model (shared across tabs, address sync, persistence, clear), `FilterBar` (desktop and phone sheet, badge count, chips, accessibility), each view's controls, summary endpoint with filters (definitions, scoping, query count), and the poll list filters on the backend.

## Decisions (user, 2026-10-07)

- **Season** is not a toolbar filter (a small label beside the title on Players and Coverage; none on Polls).
- **"Players still to answer"** replaces "Answers awaited" (distinct players still owing an answer in the polls shown).
- **Polls gets a Team filter**, as well as League and Section: teams are easier for managers. Squad polls filter by their team; group polls by the teams of the matches in their slots.
- **The poll type toggle sits above the cards**, on a line it shares with the "Showing ..." scope text (no row of its own). The same pattern applies to the other views: each view's own toggles (Show closed and sort on Polls, Show past games and Hide players with no answers on Players, Show past slots on Coverage) sit on the line above its content; the toolbar card holds only the shared filters and search.

## Open Questions

- Whether a "history" option for Polls (older polls and seasons) is wanted later.
- On a phone the type toggle moves into the Filters sheet (as in the mockup); confirm that is acceptable.

## Rollout Notes

Next steps: a mockup of the three views on desktop and phone (including the filter sheet), the user's decisions on the open questions, then a plan. Likely slices: (1) shared filter state and the unified toolbar on the three views, (2) filtered counters and the new wording with the backend changes, (3) the League filter and poll type toggle on Polls with their backend parameters.
