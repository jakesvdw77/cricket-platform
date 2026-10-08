# 084 — Clickable Counters

**Depends on:** 081 (page counters, whose selectable form this reuses), 083 (filtered counters and the Availability filter model, whose summary counters this changes), 073 and 074 (availability hub; the Coverage view is now called Match-day cover), 065 and 066 (poll Responses pages)
**Status:** draft — written 2026-10-08 from the user's request ("I like that the cards are clickable; they all should be clickable if possible or makes sense"), revised the same day with the user's answers. Scope is the Availability Polls page only. No mockup yet and nothing built. The backend contract is an outline to finalise in planning, like 083.

## Problem & Goals

A "Responses view" across all polls was judged mostly redundant with the Players grid. What the manager needs is to chase the people who have not answered, and to get from a number to the thing behind it. Today the four counters under the Availability header (`counterItems` in `ui/src/pages/manage/availability/AvailabilityHubLayout.tsx`) are plain cards: only "Open polls" is marked `active`, none has an `onSelect`. The numbers say something is wrong but not who.

Goals:
- Every counter on the Polls page is either a **drill-down** (opens a panel) or a **quick filter** of the list below it, and is non-clickable only when there is nothing useful to show.
- A manager can see exactly which players still owe an answer, and for which polls, and jump to each poll's Responses page.
- "Players responded" becomes "Players available", which is the figure a manager planning a team actually wants.
- Counters stay consistent with the list (the 083 rule), are keyboard reachable with a visible focus, and work mobile-first.

## Non-goals

- **No new Responses tab or all-polls Responses page.** The Players grid and the per-poll Responses pages stay the places to read answers.
- **No per-poll changes** (cards, Responses pages) beyond being a link target.
- **No reminders or nudges.** Not decided, out of scope for now. Nothing sends messages today (Communication and Notifications are "Coming soon" in `ui/src/App.tsx`; the only mail code is `SubscriptionWelcomeEmailService`, billing). The roadmap (`docs/roadmap.md`) is where it will be picked up with the notifications feature.
- **No other pages.** See "Later (not in this spec)".
- **No change to the other counters' definitions** ("Open polls / Polls shown", "Players still to answer", "Close in 48 hours" mean what 081/083 say).

## User Stories

- As a manager, I click "Players still to answer" and see each player who owes an answer with the polls they owe, so that I know who to chase.
- As a manager, I click a poll in that list and land on its Responses page, so that I can follow up or correct the answer.
- As a manager, I click "Players available" and see who said they can play and for which polls, so that I can plan.
- As a manager, I click "Close in 48 hours" and the poll list narrows to those polls, and click it again to go back.
- As a manager, I click "Open polls" to clear that narrowing.
- As a keyboard or screen-reader user, I can reach every clickable counter and am told whether it is pressed or what it opens.
- As a section manager, the panel only lists players and polls in my sections.

## Data Model Changes

None.

## Counter behaviour

Two kinds, using the existing `PageCounters` selectable card (ButtonBase, `aria-pressed`, `active` outline). Filter counters set `active` and `aria-pressed`; drill-down counters are buttons without `aria-pressed`.

| Counter | Kind | Action |
|---|---|---|
| Open polls / Polls shown | Filter (the reset) | Active by default; clicking it clears the 48-hour filter |
| Players available N / M | Drill-down | Opens the players panel on the "Available" tab |
| Players still to answer | Drill-down | Opens the players panel on the "Still to answer" tab |
| Close in 48 hours | Filter | Toggles the 48-hour filter on the poll list |

A counter whose figure is 0 is not clickable (nothing to show), except the active filter, which stays clickable so the manager can leave it. Each actionable counter shows a short hint ("Tap to filter", "See who").

**The 48-hour filter is a list filter.** It shows polls open and closing within 48 hours (the counter's own definition), appears in the "Showing ..." scope text ("closing within 48 hours"), is counted in the phone Filters badge and shown as a removable chip like any other filter (083), lives in the Filters sheet on a phone, and is cleared by "Clear filters". It is a Polls-only control. **Decided (user): it does not change the counters' own figures** (they keep describing the polls in scope, so "Open polls" stays a meaningful reset card); the user may review this later. The players panel does apply it, so the panel matches the list in front of the manager.

## Change to 083's counters: "Players responded" becomes "Players available"

083 left the second counter as "Players responded N / M" (distinct players with any real answer, out of distinct players in the audience). It becomes **"Players available N / M"** (keep the N / M format):
- **N** = distinct players who answered Available in at least one of the polls shown.
- **M** = distinct players in the audience of the polls shown (unchanged).

Migration note: this is a rename plus a definition change, touching all four layers. Backend: `AvailabilitySummaryDto` and `AvailabilitySummaryServiceImpl` rename `playersResponded` to `playersAvailable` and count Available answers instead of any real answer; `playersInAudience` is kept; unit and integration tests are updated to the new definition. `openapi.yaml` is regenerated and the contract diff approved as a breaking rename (the only consumer is the Polls page; the Overview uses its own endpoint). Frontend: `AvailabilitySummary` in `ui/src/api/availabilitySummaryApi.ts`, `counterItems`, and the tests and stories that use the field. Spec 081's API table and 083's counter text are annotated "renamed in 084", not rewritten.

## Players panel

One panel, two tabs: **Available** and **Still to answer**. Clicking "Players available" or "Players still to answer" opens it with the matching tab selected; the tabs can then be switched. It describes the polls shown, with the same filters as the counters (league, section, team, type, include closed) plus the 48-hour filter.

- **Grouped per player, the only mode.** One row per distinct player showing the number of polls; the row expands to the polls (on a phone the polls show beneath the name). On "Still to answer" those are the polls the player owes; on "Available" the polls they said Available for. Each poll is a link to its Responses page (`/manage/availability/group/:roundId` or `/manage/availability/squad/:matchId/:pollId`, the routes in `App.tsx`). Sorted by most polls first, then name.
- A search field filters the rows by player name. A footer line repeats the scope ("Showing: Vets › Over 40").
- **Phone:** slides up from the bottom like the Filters sheet (`BottomSheet`, `ui/src/components/BottomSheet`). **Desktop:** a panel that slides in from the right (MUI `Drawer`, anchor right). Both close with Escape, the close button and the backdrop.
- Local UI state only: **not linkable** through the address.

States: **loading** (row skeletons inside the panel, counters unaffected); **empty** ("Everyone has answered." on Still to answer, "Nobody has said they are available yet." on Available); **error** ("We couldn't load the players." with a retry, counters and list unaffected); **more** ("Show more" loads the next page).

## API Contract (outline, finalised in planning)

The 083 summary returns counts only (`AvailabilitySummaryController`), and no existing endpoint returns the distinct-player breakdown (the Players grid is per season and game; the Responses endpoints are per poll). A new read-only endpoint is proposed, sharing the summary's filter parameters and its section scoping, so panel and counters cannot disagree:

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/availability/summary/players?kind=available\|awaiting&leagueId&sectionId&teamId&type&includeClosed&closingSoon&search&page&size` | `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")`, section-scoped via `AccessService.accessibleSectionIds` | A `Page` of `AvailabilitySummaryPlayerDto { playerProfileId, displayName, polls: [{ pollKind, pollId, matchId?, title }] }` |

- Pagination per `docs/standards/backend.md` (Page/size, default 25, maximum 100, never unbounded). `totalElements` must equal the matching counter (`playersAvailable`, `playersStillToAnswer`) for the same filters.
- `closingSoon` is added to the summary, this endpoint and the poll list endpoints so one backend definition of "within 48 hours" serves all; applying it client-side is the fallback if planning finds the list already carries the close time.
- Fixed query count regardless of data size; `openapi.yaml` additions plus the rename above.

## UI Requirements

- **`PageCounters`**: no API change needed (`onSelect`, `active`, `hint` exist). Counters get the hover and pressed affordance of the Overview key-figure card (`keyFigureCardSx`) and the existing focus outline; check hint contrast.
- **New `PlayersPanel`** (four-file anatomy, `ui/src/pages/manage/availability/`): tabs, search, per-player rows, the states above; composed from `BottomSheet`, `Drawer`, `Tabs`, `List` and the shared `Input`.
- **`AvailabilityHubLayout`** owns the panel state and the 48-hour flag next to the other Polls controls (`useAvailabilityHubState`, `hubContext`).
- The panel's query key sits under `['managed-club', clubId, 'availability-summary']` so `invalidateAvailabilityCounters` refreshes it.
- Phone: 44 px minimum row targets, counters stay two by two. Storybook stories for the panel (each state) and the counter variants.

## Test Plan

Per `docs/standards/testing.md`:
- **Frontend:** counters (filter vs drill-down semantics, `aria-pressed`, non-clickable at zero, keyboard); the 48-hour filter (toggle, chip, badge, scope text, clear, reset card, counters unchanged); `PlayersPanel` (pre-selected tab, switching, per-player grouping, links to both poll routes, search, loading/empty/error/more, bottom sheet vs right drawer); updated "Players available" label and field.
- **Backend:** the new definition of `playersAvailable` (a player Available in one of two polls counts once; Not available or no response does not); the players endpoint (a player in two polls appears once with two entries; totals equal the counters; section-manager scoping; another club 403; paging and size cap; statement count); `closingSoon`.
- **Contract:** `openapi.yaml` diff showing the rename and the new endpoint, approved.
- **Playwright smoke:** click "Players still to answer", see a player, follow a poll link.

## Acceptance Criteria

- Each Polls counter is a drill-down or a filter, or non-clickable at zero.
- "Players available N / M" counts distinct players Available in at least one poll shown, out of distinct players in the audience of the polls shown.
- Clicking either players counter opens the panel on the matching tab; rows are per player with working links to the Responses pages; the totals equal the counters for the same filters.
- With nothing owed the panel says "Everyone has answered." and the "Players still to answer" counter is not clickable.
- "Close in 48 hours" narrows the list, shows in the scope text and as a chip, adds to the phone badge, is cleared by its counter, "Open polls" or "Clear filters", and leaves the counters' figures unchanged.
- Filter counters expose `aria-pressed`; all clickable counters are reachable by Tab, activated with Enter or Space, and show a visible focus ring.
- A section manager sees only players and polls in their sections; a failed players request leaves the counters and list working.

## Later (not in this spec)

- The Overview key figures (079), counters on Players and Matches (081's later slices), and any Matches list filters they would need ("this week", "not announced"). They will follow the same two-kind rule.
- Reminders or nudges, once the notifications feature exists; a "Copy poll link" per row is a possible cheap interim.

## Open Questions

1. **Definition of "Players available":** N = distinct players Available in **at least one** poll shown (drafted), or Available in **all** polls shown? "At least one" answers "who can I pick from", "all" is stricter and shrinks fast with several polls.

## Rollout Notes

Next steps: the user's answer, a mockup (counters pressed/hover/focus, the panel on phone and desktop), then a plan. Likely slices, each its own PR:
1. The "Players available" rename and definition change across backend, `openapi.yaml`, UI and tests.
2. The 48-hour filter (with `closingSoon` on the backend) and the clickable filter counters.
3. The players endpoint, then `PlayersPanel` wired to the two players counters.

Decided (user, 2026-10-08): the two-kind counter pattern (filter or drill-down, both through `PageCounters`) becomes the standard for the counters on later pages.
