# 084 — Clickable Counters

**Depends on:** 081 (page counters, whose selectable form this reuses), 083 (filtered counters and the Availability filter model), 073 and 074 (availability hub; the Coverage view is now called Match-day cover), 065 and 066 (poll Responses pages)
**Status:** draft — written 2026-10-08 from the user's request ("I like that the cards are clickable; they all should be clickable if possible or makes sense"), revised the same day with the user's answers. Scope is the Availability Polls page only. The mockup (https://claude.ai/artifact/P7LqFQinmqPXFcuRrPhnJS: the counters at rest, the 48-hour filter, the players panel on desktop and phone) was approved by the user on 2026-10-08 ("That looks good"); the spec text has not been reviewed line by line yet. Nothing built. The backend contract is an outline to finalise in planning, like 083.

## Problem & Goals

A "Responses view" across all polls was judged mostly redundant with the Players grid. What the manager needs is to chase the people who have not answered, and to get from a number to the thing behind it. Today the four counters under the Availability header (`counterItems` in `ui/src/pages/manage/availability/AvailabilityHubLayout.tsx`) are plain cards: only "Open polls" is marked `active`, none has an `onSelect`. The numbers say something is wrong but not who.

Goals:
- Every counter on the Polls page is either a **drill-down** (opens a panel) or a **quick filter** of the list below it, and is non-clickable only when there is nothing useful to show.
- A manager can see exactly which players still owe an answer, and for which polls, and jump to each poll's Responses page.
- Counters stay consistent with the list (the 083 rule), are keyboard reachable with a visible focus, and work mobile-first.

## Non-goals

- **No new Responses tab or all-polls Responses page.** The Players grid and the per-poll Responses pages stay the places to read answers.
- **No per-poll changes** (cards, Responses pages) beyond being a link target.
- **No changes to the counters' labels or definitions.** "Players responded N / M" and the other three keep exactly what 081/083 define; this spec only makes them clickable.
- **No reminders or nudges.** Not decided, out of scope for now. Nothing sends messages today (Communication and Notifications are "Coming soon" in `ui/src/App.tsx`; the only mail code is `SubscriptionWelcomeEmailService`, billing). The roadmap (`docs/roadmap.md`) is where it will be picked up with the notifications feature.
- **No other pages.** See "Later (not in this spec)".

## User Stories

- As a manager, I click "Players still to answer" and see each player who owes an answer with the polls they owe, so that I know who to chase.
- As a manager, I click a poll in that list and land on its Responses page, so that I can follow up or correct the answer.
- As a manager, I click "Players responded" and see who has answered and in which polls, so that I can check a name quickly.
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
| Players responded N / M | Drill-down | Opens the players panel on the "Responded" tab |
| Players still to answer | Drill-down | Opens the players panel on the "Still to answer" tab |
| Close in 48 hours | Filter | Toggles the 48-hour filter on the poll list |

A counter whose figure is 0 is not clickable (nothing to show), except the active filter, which stays clickable so the manager can leave it. Each actionable counter shows a short hint ("Tap to filter", "See who").

**The 48-hour filter is a list filter.** It shows polls open and closing within 48 hours (the counter's own definition), appears in the "Showing ..." scope text ("closing within 48 hours"), is counted in the phone Filters badge and shown as a removable chip like any other filter (083), lives in the Filters sheet on a phone, and is cleared by "Clear filters". It is a Polls-only control. **Decided (user): it does not change the counters' own figures** (they keep describing the polls in scope, so "Open polls" stays a meaningful reset card); the user may review this later. The players panel does apply it, so the panel matches the list in front of the manager.

## Players panel

One panel, two tabs: **Responded** and **Still to answer**. Clicking "Players responded" or "Players still to answer" opens it with the matching tab selected; the tabs can then be switched. It describes the polls shown, with the same filters as the counters (league, section, team, type, include closed) plus the 48-hour filter.

- **Responded** lists the distinct players who gave at least one real answer in the polls shown, exactly the counter's N. **Still to answer** lists the distinct players who still owe at least one answer, exactly the counter's figure.
- **Grouped per player, the only mode.** One row per distinct player showing the number of polls; the row expands to the polls (on a phone the polls show beneath the name). On "Still to answer" those are the polls the player owes; on "Responded" the polls they answered. Each poll is a link to its Responses page (`/manage/availability/group/:roundId` or `/manage/availability/squad/:matchId/:pollId`, the routes in `App.tsx`). Sorted by most polls first, then name.
- A search field filters the rows by player name. A footer line repeats the scope ("Showing: Vets › Over 40").
- **Phone:** slides up from the bottom like the Filters sheet (`BottomSheet`, `ui/src/components/BottomSheet`). **Desktop:** a panel that slides in from the right (MUI `Drawer`, anchor right). Both close with Escape, the close button and the backdrop.
- Local UI state only: **not linkable** through the address.

States: **loading** (row skeletons inside the panel, counters unaffected); **empty** ("Everyone has answered." on Still to answer, "No answers yet." on Responded); **error** ("We couldn't load the players." with a retry, counters and list unaffected); **more** ("Show more" loads the next page).

## API Contract (outline, finalised in planning)

The 083 summary returns counts only (`AvailabilitySummaryController`), and no existing endpoint returns the distinct-player breakdown (the Players grid is per season and game; the Responses endpoints are per poll). A new read-only endpoint is proposed, sharing the summary's filter parameters and its section scoping, so panel and counters cannot disagree. The existing summary response is unchanged.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/availability/summary/players?kind=responded\|awaiting&leagueId&sectionId&teamId&type&includeClosed&closingSoon&search&page&size` | `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")`, section-scoped via `AccessService.accessibleSectionIds` | A `Page` of `AvailabilitySummaryPlayerDto { playerProfileId, displayName, polls: [{ kind, id, matchId?, title }] }` (`kind` is SQUAD or GROUP; `matchId` is null for a group poll) |

- `kind` accepts `responded` or `awaiting`, case-insensitively; missing or anything else is a 400 (the same body as other validation errors). A client `sort` is ignored: the order is fixed (most polls first, then name, then player id).
- Pagination per `docs/standards/backend.md` (Page/size, default 25, maximum 100, never unbounded). Paging is done in memory over the bounded poll aggregation, a documented exception (plan decision 3). `totalElements` must equal the matching counter (`playersResponded`, `playersStillToAnswer`) for the same filters; the two share one query/definition in the backend so they cannot drift.
- `closingSoon` exists only on this endpoint (open polls closing within 48 hours, the same definition and constant the summary's `closingSoon` counter uses). The summary and the poll list endpoints do not get the parameter: the Polls page applies the 48-hour filter client-side from the close time the list already carries.
- Fixed query count regardless of data size; `openapi.yaml` additions only (no renames).

## UI Requirements

- **`PageCounters`**: no API change needed (`onSelect`, `active`, `hint` exist). Counters get the hover and pressed affordance of the Overview key-figure card (`keyFigureCardSx`) and the existing focus outline; check hint contrast.
- **New `PlayersPanel`** (four-file anatomy, `ui/src/pages/manage/availability/`): tabs, search, per-player rows, the states above; composed from `BottomSheet`, `Drawer`, `Tabs`, `List` and the shared `Input`.
- **`AvailabilityHubLayout`** owns the panel state and the 48-hour flag next to the other Polls controls (`useAvailabilityHubState`, `hubContext`).
- The panel's query key sits under `['managed-club', clubId, 'availability-summary']` so `invalidateAvailabilityCounters` refreshes it.
- Phone: 44 px minimum row targets, counters stay two by two. Storybook stories for the panel (each state) and the counter variants.

## Test Plan

Per `docs/standards/testing.md`:
- **Frontend:** counters (filter vs drill-down semantics, `aria-pressed`, non-clickable at zero, keyboard); the 48-hour filter (toggle, chip, badge, scope text, clear, reset card, counters unchanged); `PlayersPanel` (pre-selected tab, switching, per-player grouping, links to both poll routes, search, loading/empty/error/more, bottom sheet vs right drawer).
- **Backend:** the players endpoint (a player in two polls appears once with two entries; Responded and Still to answer totals equal the summary counters for the same filters; section-manager scoping; another club 403; paging and size cap; statement count); `closingSoon` on the players endpoint (open polls only, 48 hours); the Polls page's client-side 48-hour filter is covered by the frontend tests.
- **Contract:** `openapi.yaml` diff showing only the new endpoint and parameter.
- **Playwright smoke:** click "Players still to answer", see a player, follow a poll link.

## Acceptance Criteria

- Each Polls counter is a drill-down or a filter, or non-clickable at zero; labels and figures are unchanged.
- Clicking either players counter opens the panel on the matching tab; rows are per player with working links to the Responses pages; the totals equal the counters for the same filters.
- With nothing owed the panel says "Everyone has answered." and the "Players still to answer" counter is not clickable.
- "Close in 48 hours" narrows the list, shows in the scope text and as a chip, adds to the phone badge, is cleared by its counter, "Open polls" or "Clear filters", and leaves the counters' figures unchanged.
- Filter counters expose `aria-pressed`; all clickable counters are reachable by Tab, activated with Enter or Space, and show a visible focus ring.
- A section manager sees only players and polls in their sections; a failed players request leaves the counters and list working.

## Later (not in this spec)

- The Overview key figures (079), counters on Players and Matches (081's later slices), and any Matches list filters they would need ("this week", "not announced"). They will follow the same two-kind rule.
- Reminders or nudges, once the notifications feature exists; a "Copy poll link" per row is a possible cheap interim.

## Open Questions

None.

## Rollout Notes

Next steps: a mockup (counters pressed/hover/focus, the panel on phone and desktop), then a plan. Likely slices, each its own PR:
1. The 48-hour filter (client-side; `closingSoon` exists only on the players endpoint of slice 2) and the clickable filter counters.
2. The players endpoint, then `PlayersPanel` wired to the two players counters.

Decided (user, 2026-10-08): the two-kind counter pattern (filter or drill-down, both through `PageCounters`) becomes the standard for the counters on later pages.
