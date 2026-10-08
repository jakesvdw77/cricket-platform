# 084 — Clickable Counters

**Depends on:** 081 (page counters, whose selectable form this reuses), 083 (filtered counters and the Availability filter model), 079 (Overview key figures), 073 and 074 (availability hub; the Coverage view is now called Match-day cover), 066 and 065 (poll Responses pages)
**Status:** draft — written 2026-10-08 from the user's request ("I like that the cards are clickable; they all should be clickable if possible or makes sense"). No mockup yet and nothing built. The backend contract is an outline to finalise in planning, like 083.

## Problem & Goals

A "Responses view" across all polls was discussed and judged mostly redundant with the Players grid. What the manager actually needs is to chase the people who have not answered, and to get from any number to the thing behind it. Today the counters under the Availability header are plain cards (`counterItems` in `ui/src/pages/manage/availability/AvailabilityHubLayout.tsx` gives only "Open polls" an `active` flag and none an `onSelect`), and none of the four Overview key figures (`KeyFigure` in `ui/src/pages/manage/ManagerOverviewPage.tsx`) is clickable. The numbers say something is wrong but not who or where.

Goals:
- Every counter is either a **drill-down** (navigates, or opens a panel with the detail) or a **quick filter** of the list below it. It is non-clickable only when there is nothing useful to show.
- One mechanism for each kind, both using the existing selectable `PageCounters` card: filter counters set `active` and `aria-pressed`; drill-down counters are buttons (or links) without a pressed state.
- On Availability, a manager can see exactly which players still owe an answer, for which polls, and jump to each poll's Responses page.
- Counters stay consistent with the list below them (the 083 rule) and are keyboard reachable with a visible focus.

## Non-goals

- **No new Responses tab or all-polls Responses page.** The Players grid and the per-poll Responses pages (065) stay the places to read answers.
- **No changes to individual polls or poll cards** (082), and no changes to the Responses pages themselves beyond being a link target.
- **No reminders or nudges** unless the user decides otherwise (see Open Questions). Nothing sends messages today: Communication and Notifications are "Coming soon" placeholders in `ui/src/App.tsx`, and the only mail code is `SubscriptionWelcomeEmailService` (billing). The panel is built so a "Remind" action can be added by the later notifications feature; it ships without one.
- **No counters on pages that have none** (Players, Matches). Those arrive with 081's later slices and follow the rules here when they do.
- **No new counter definitions.** What each figure means is unchanged from 081/083.

## User Stories

- As a manager, I click "Players still to answer" and see each player who owes an answer with the polls they owe, so that I know who to chase.
- As a manager, I click a poll in that list and land on its Responses page, so that I can correct or follow up the answer.
- As a manager, I click "Players responded" and see who has answered, so that I can check a name quickly.
- As a manager, I click "Close in 48 hours" and the poll list narrows to those polls, and click it again to go back.
- As a manager, I click "Open polls" to clear that narrowing and see all the polls again.
- As a manager on the Overview, I click a key figure and arrive at the screen that lets me act on it.
- As a keyboard or screen-reader user, I can reach every clickable counter, and I am told whether it is pressed or what it opens.
- As a section manager, the panel only lists players and polls in my sections.

## Data Model Changes

None.

## Counter behaviour

Two kinds, no third:

| Kind | Looks and behaves like | Used when |
|---|---|---|
| **Filter** | `PageCounters` selectable card: `aria-pressed`, `active` outline, hint "Tap to filter"; click toggles | The counter's figure is exactly the size of a subset of the list below |
| **Drill-down** | Same card, no `aria-pressed`, hint such as "See who" or "View"; click opens a panel or navigates (a router link when it navigates) | The figure counts something that is not a row of the list below (players, matches on another screen) |

**Availability counters (Polls view).**

| Counter | Kind | Action |
|---|---|---|
| Open polls / Polls shown | Filter (the reset) | Active by default. Clicking it clears the 48-hour quick filter. Not pressable off: with nothing narrowed it is simply active. |
| Players responded N / M | Drill-down | Opens the players panel on its "Responded" tab |
| Players still to answer | Drill-down | Opens the players panel on its "Still to answer" tab |
| Close in 48 hours | Filter | Toggles `closingSoon` on the poll list (open polls whose close time is within 48 hours, the counter's own definition) |

When the counter figure is 0, "Close in 48 hours" and "Players still to answer" stay non-clickable (nothing to show); "Players responded" is clickable whenever the audience is non-empty. A zero counter that is the *active* filter stays clickable so the manager can leave it.

**The 48-hour filter is a real list filter**, not a counter-only state. It is named in the "Showing ..." scope text ("closing within 48 hours"), counted in the phone Filters badge and shown as a removable chip like any other filter (083), saved with the other Polls view-specific controls, and cleared by "Clear filters". It is a Polls-only control, so it does not appear on Players or Match-day cover. Because the summary counters describe the list, the filter does not change the counters' own figures (they keep describing the polls in scope, otherwise "Open polls" would shrink to the closing-soon count and the reset card would lose its meaning). **To confirm:** see Open Questions.

**Overview key figures (079)** — none is clickable today. Proposed:

| Key figure | Kind | Goes to |
|---|---|---|
| Matches this week | Drill-down | `/manage/fixtures/matches` (the Matches list, upcoming) |
| Teams not announced | Drill-down | `/manage/fixtures/matches` narrowed to matches with an unannounced own side, if the list can express that; else the same page with the "Upcoming matches" card as the landing point. A real match-list filter is out of scope here and is raised in Open Questions. |
| Poll answers awaited | Drill-down | `/manage/availability`, which shows the Players still to answer figure and panel. See Open Questions: the Overview figure is a sum that counts a player once per poll, while Availability says "players", so the labels disagree. |
| Active players | Drill-down | `/manage/players` |

They use the same drill-down card as `PageCounters` (the Overview keeps its grid; `KeyFigure` is replaced by `PageCounters` items so one component styles both), rendered as router links so middle-click and "open in new tab" work.

## Players panel (Availability)

One panel with two tabs, **Still to answer** (default when opened from that counter) and **Responded**, for the polls shown (the same filters as the counters: league, section, team, type, include closed; the 48-hour filter is applied too, so the panel matches the list the manager is looking at).

- **Still to answer:** one row per distinct player, with the number of polls owed, sorted by most polls owed then name. A row expands (or on a phone shows underneath) to the polls they owe, each a link to that poll's Responses page (`/manage/availability/group/:roundId` or `/manage/availability/squad/:matchId/:pollId`, the routes in `App.tsx`; the same links `ManagerOverviewPage.pollLink` builds).
- **Responded:** one row per distinct player with how many of the polls they have answered, same expansion. Read-only.
- A search field filters the rows by player name.
- Footer line repeating the scope ("Showing: Vets › Over 40") so the list's reach is clear.

The panel reuses `BottomSheet` (`ui/src/components/BottomSheet`, 083) on a phone and a right-hand `Drawer` (or the existing dialog pattern) from `md`. It is local UI state, not in the address, **except** that opening it from a link elsewhere (the Overview figure) needs a way in; proposed `?panel=awaiting` on `/manage/availability`, which the hub layout reads once and clears. To confirm in planning.

States: **loading** (rows skeleton inside the panel, the counter itself unaffected); **empty** ("Everyone has answered." with no list, for Still to answer; "No answers yet." for Responded); **error** ("We couldn't load the players. Try again." with a retry button, the counters and list unaffected); **capped** (see API: a "Show more" button loads the next page).

## API Contract (outline, finalised in planning)

The 083 summary returns counts only (`ui/src/api/availabilitySummaryApi.ts`, `AvailabilitySummaryController`), and no existing endpoint returns the distinct-player breakdown: the Players grid response (068) is per season and per game, and the poll Responses endpoints are per poll. A new read-only endpoint is proposed, reusing the summary's filter parameters and its section scoping (`AccessService.accessibleSectionIds`), so the panel and the counters cannot disagree:

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/availability/summary/players?kind=awaiting\|responded&leagueId&sectionId&teamId&type&includeClosed&closingSoon&search&page&size` | `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")`, section-scoped like the summary | A `Page` of `AvailabilitySummaryPlayerDto { playerProfileId, displayName, polls: [{ pollKind, pollId, matchId?, title, answered }] }`. For `awaiting`, `polls` are the polls the player still owes; for `responded`, the ones they answered. Sorted as above. |

- Pagination per `docs/standards/backend.md` (Page/size, default size 25, maximum 100, never unbounded).
- The filter parameters are shared with the summary through one request object so the definitions live in one place; the `size`-capped list's `totalElements` must equal the counter figure (`playersStillToAnswer`, `playersResponded`).
- `closingSoon=true` is also added to the summary and to the Polls list endpoints (`.../availability-polls/open` and `.../section-availability-rounds`, as 083 did for league), or the 48-hour filter is applied client-side to the already loaded list if planning finds the list always carries `scheduledCloseAt`. Decide in planning; the backend route is preferred so counters and list share one definition of "within 48 hours".
- Fixed number of queries regardless of data size; `openapi.yaml` additions only.

## UI Requirements

- **`PageCounters`** gains: a `href`/`to` option so a drill-down can render as a router link (the Overview), and no other API change; `onSelect` and `active` already exist. The hint text is shown for any actionable counter ("Tap to filter" on filter counters, "See who" or "View" on drill-downs). Hover (a slightly stronger shadow) and pressed affordances come from the existing `keyFigureCardSx`; focus uses the existing `Mui-focusVisible` outline. Check contrast of the hint on the card.
- **New `PlayersAwaitingPanel`** (four-file anatomy, `ui/src/pages/manage/availability/`): tabs, search, rows, states above. Composed from `BottomSheet`, MUI `Drawer`, `Tabs`, `List` and the shared `Input`; no new styling system.
- **`AvailabilityHubLayout`** owns the panel state and the 48-hour flag next to the other Polls controls (`useAvailabilityHubState`, `hubContext`); `FilterBar`'s Polls controls gain the quick filter, which on a phone lives in the Filters sheet beside the type toggles (083).
- **`ManagerOverviewPage`**: the four `KeyFigure` cards become `PageCounters` drill-down items; the `warn` tone logic is kept.
- **Invalidation:** the panel's query key sits under `['managed-club', clubId, 'availability-summary']` so `invalidateAvailabilityCounters` refreshes it after any answer change.
- **Mobile-first:** the panel is a bottom sheet at phone width with 44 px minimum row targets; counters keep the two-by-two grid.
- Storybook stories for the new `PageCounters` link form and `PlayersAwaitingPanel` (loading, empty, error, populated, capped).

## Test Plan

Per `docs/standards/testing.md`:
- **Frontend:** `PageCounters` (drill-down versus filter semantics: `aria-pressed` only on filters, link form, hint, non-clickable at zero, focus and keyboard activation); the 48-hour filter (toggle, chip, badge count, scope text, clear, the reset card, counters unchanged by it); `PlayersAwaitingPanel` (tabs, grouping, links to both poll routes, search, loading/empty/error/capped, phone sheet versus desktop drawer); Overview cards link to the right routes; a section manager sees only their data (backend-driven, asserted in the panel with a mocked response).
- **Backend:** the players endpoint: unit tests for the awaiting and responded definitions (a player in two polls appears once with two entries; total equals the summary counter for the same filters), Testcontainers integration (200 shape, another club 403, section-manager scoping, paging and the size cap), statement-count guard, and the `closingSoon` parameter if added.
- **Contract:** `openapi.yaml` diff for the new endpoint and parameter.
- **Playwright smoke:** click "Players still to answer", see a player, follow a poll link to its Responses page.

## Acceptance Criteria

- Every Availability counter and every Overview key figure is a drill-down or a filter, except those at zero that have nothing to show.
- "Players still to answer" opens a panel listing exactly the distinct players the counter counts, each with the polls owed and a working link to that poll's Responses page; its total equals the counter figure for the same filters.
- With nothing owed the panel says "Everyone has answered." and the counter is not clickable.
- "Close in 48 hours" narrows the poll list, shows in the scope text and as a chip, adds to the phone badge, and is cleared by its counter, "Open polls" or "Clear filters".
- Filter counters expose `aria-pressed`; drill-down counters do not; all are reachable by Tab, activated with Enter or Space, and show a visible focus ring.
- A section manager sees only players and polls in their sections.
- If the players request fails, the panel shows a retry and the counters and list still work.
- The Overview key figures navigate as specified and open in a new tab with a modified click.

## Open Questions

1. **Reminders.** Out of scope as drafted. Should the panel eventually have a per-player or "remind all" action, and through which channel (email, WhatsApp, share the public poll link)? Nothing sends today; this waits for the notifications/communication feature in `docs/roadmap.md`. A cheaper interim option is a "Copy poll link" per row, using the existing Share invite link, if the user wants it now.
2. **Does the 48-hour filter change the counters?** Drafted: no (the counters keep describing the polls in scope). Alternative: yes, so "Open polls" reads the filtered count and the reset card clears it. Which does the user expect?
3. **Panel shape on desktop:** right-hand drawer (drafted) or a centred dialog? And should the panel be linkable in the address (`?panel=awaiting`, drafted for the Overview link)?
4. **Players responded**: is a drill-down panel wanted, or should it stay a plain figure? Drafted as drill-down because the user asked for everything clickable; it is the least useful of the four.
5. **Overview "Poll answers awaited"** counts poll answers (a player twice if in two polls); Availability counts players. Rename the Overview figure to "players still to answer" (and use the same definition), or keep it and link as drafted?
6. **Teams not announced / Matches this week** link targets: does the Matches list have (or should it get) filters for "this week" and "not announced"? A real filter is a Matches-page change, not part of this spec.
7. **Grouping in the panel:** per player (drafted) is the default; also offer a per-poll grouping toggle?
8. Whether the pattern (filter versus drill-down counters) also becomes the standard for Players and Matches counters when 081's later slices arrive (drafted: yes).

## Rollout Notes

Next steps: the user's answers to the open questions, a mockup of the Availability counters (pressed, hover, focus), the panel on phone and desktop, and the Overview cards, then a plan. Likely slices, each its own PR:
1. `PageCounters` link/drill-down form, the Overview key figures as links, and the "Close in 48 hours" quick filter with its chip, scope text and badge (frontend, plus the `closingSoon` list parameter if backend-side).
2. The players endpoint with its tests and `openapi.yaml`.
3. `PlayersAwaitingPanel` wired to the two Players counters, with all states.
4. Roadmap entry for the reminder/nudge follow-up once the notifications feature has a home (`docs/roadmap.md`, `docs/architecture.md` untouched: no entity or auth change).
