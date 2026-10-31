# 127: Return navigation ("go back to where I came from")

**Status:** approved by the owner in chat (2026-10-31), built. First applied to the Leagues pages (the owner wants Leagues 100% before any other page); the same rule then moves across the application page by page.
**Depends on:** `docs/standards/page-anatomy.md` (page skeleton, Back on the top row), `docs/standards/frontend.md`, `126-league-page-actions-and-edit-mode.md` (Manage League menu, row menus), `docs/standards/design-system.md`.

## Problem & Goals
Nothing in the application keeps track of where the user came from. Example from the owner: on a league's Schedule tab, Manage League then Add Match opens the Match form headed "Back to Matches"; Back goes to the Matches list, and saving also lands on the Matches list, not on the league schedule the user started from, so the new match is not shown where they were working. The same happens wherever a page is reached from somewhere other than its default parent.

Today there are several unrelated mechanisms: a few pages pass `{ backTo, backLabel }` in navigation state (the result page, the stats pages, with a guard that the path starts with `/manage/`), the import wizard uses a `?from=view` parameter, and everything else goes back to a fixed list. A mechanism in navigation state is lost on reload and in a new tab.

**Goals**
- One rule, used by every page: a page reached from somewhere remembers it, shows "Back to <where I came from>", and returns there on Back, Cancel and after a successful Save.
- The rule survives a reload and a new tab (it lives in the address).
- It is safe: it can never send the user to another site.
- It is cheap to adopt: a link adds one helper, a page uses one hook.

## Non-goals
- **Breadcrumbs** (a visible trail such as Leagues > TVL Division 1 T20 > Add Match). A separate design decision, listed under "Later". This spec makes the single step back correct; a trail can be built on the same information afterwards.
- Changing the browser's own Back button (it already works and is unaffected).
- Remembering a multi-step history: only the single origin one step back is kept; each hop that goes on sets its own origin.
- Public pages and the Player Hub (`/account`, `/view`) are out of scope here; they have their own back model.

## User Stories
- As a club admin, when I open Add Match from a league's Manage League menu, the page says "Back to TVL Division 1 T20 schedule", Back takes me there, and after I save I land on that schedule with the new match in it.
- As a club admin, when I open a team or a match from a league page and then press Back, I return to that league page on the same tab and season, not to the global list.
- As a club admin, if I reload the page or open it in a new tab, it still knows where I came from.
- As a club admin, if I arrive by typing an address or from a bookmark, the page behaves as it does today (its normal parent), with no error.

## The rule (contract)
- **The origin travels in the address** as two query parameters on the destination: `returnTo` (the origin's path and query, URL-encoded) and `returnLabel` (a short plain-text name for the origin, for example `TVL Division 1 T20 schedule`). Both optional; `returnTo` alone is valid (the label then comes from the route's default label table, else "Back").
- **Trust:** `returnTo` is accepted only if, after decoding, it is an in-app path that starts with `/manage/` or `/admin/` (for the areas those prefixes cover), contains no scheme or host, does not start with `//`, contains no backslash, no control characters and is at most 512 characters; anything else is ignored as if absent. `returnLabel` is plain text, at most 60 characters, rendered only as text (never as markup) and ignored if it contains control characters. No personal data goes in either parameter.
- **A link that leads to a page it is not the default parent of** builds its destination with the shared helper `withReturnTo(destination, { to, label })`, where `to` is the current location (path and query) of the page the link is on. Example: the league Schedule tab's Add Match item links to `/manage/fixtures/matches/new?leagueId=…&seasonId=…&returnTo=%2Fmanage%2Ffixtures%2Fleagues%2F…%2Fschedule%3FseasonId%3D…&returnLabel=TVL%20Division%201%20T20%20schedule`.
- **The destination page** reads it with `useReturnTo()` (validated `{ to, label }` or null) and uses it three ways: the Back control (`ManageScreenHeader` and any page header: label "Back to {label}", target `to`), Cancel, and the navigation after a successful Save or Delete (`useAfterSave(defaultTo)` returns a function that navigates to `to` when present, else to the page's own default). The page keeps its default Back target and label for when there is no `returnTo`.
- **Hops that go on:** a page reached with a `returnTo` that links to a further page sets the new `returnTo` to itself (the current location), so Back always goes exactly one step back. It does not copy its own `returnTo` forward.
- **Legacy mechanisms** (`{ backTo, backLabel }` in navigation state, `?from=view`) are still read as a fallback by `useReturnTo()` until the page that uses them is migrated; new links use `returnTo` only.
- **After Save, the origin must show the result.** The origin page already refreshes through the existing query invalidation; where the new record could be hidden by a filter (for example a past match on a schedule that shows upcoming matches only), the Save navigation may add the origin's own "show all" parameter; decided per page when it is adopted (Phase 1: the league Schedule tab, see below).

## UI Requirements
- **Shared code:** `ui/src/utils/returnTo.ts` (`safeReturnTo(value)`, `withReturnTo(destination, origin)`, `currentOrigin(location)`), `ui/src/hooks/useReturnTo.ts` (`useReturnTo`, `useBackLink(defaultTo, defaultLabel)`, `useAfterSave(defaultTo)`), and `ManageScreenHeader`'s Back using `useBackLink` automatically when the page passes no explicit `backTo` of its own (a page that still passes one keeps working; the returnTo overrides it when valid).
- **Back control:** the existing top-row Back link; label "Back to {label}" (Title Case is not applied to the origin's own name); keyboard and touch rules unchanged.
- **No new visible chrome** in this spec (no breadcrumb row).

## Phase 1: Leagues (the owner's priority)
Adopt `returnTo` on every link that leaves the league pages, and on the pages they open:
- **From the league page** (`/manage/fixtures/leagues/:leagueId/...`): Manage League items (Add Match, Edit League Details, Edit Conditions, Add Team opens within the same page and needs nothing, Import Schedule), the edit pencil, schedule row links and row menu items (Open Match, Edit Match, Select Team, and so on), Teams tiles (Open Team, Edit League Team), the Conditions PDF if it navigates. The origin is the current league page location (tab and `seasonId` included).
- **From the Leagues list** (`/manage/fixtures/leagues`): row and card menu items and the card click-through to the league (Open League, Open Schedule, Open Teams, Open Conditions, Edit League Details, Add Match, Import Schedule), with the origin the list location (filters are not saved in the address, so the list returns with its remembered filters as today).
- **Destinations that must honour it:** the Match form page (create and edit: Back, Cancel, after Save), the Match detail page, the Team detail page, the League edit page (Back, Cancel, after Save and after Deactivate), and the import wizard (already returns to the schedule; make it read `returnTo` and drop `?from`).
- **Add Match from the league Schedule tab, after Save:** returns to the origin with the schedule showing the new match: because the Schedule tab defaults to upcoming matches only, the Save navigation to a league Schedule origin adds `showAll=1` when the saved match is in the past (and the Schedule tab honours `showAll`), so a newly added match is always visible.

## Later (not in this spec)
- Breadcrumb trail on detail pages; a "Recently visited" list; keeping filters in the address for lists; migrating every other page (done page by page as each page is reviewed against `page-anatomy.md`).

## Test Plan
Written after the owner's hand-check. Unit: `safeReturnTo` (accepts `/manage/…` with query, rejects `https://evil`, `//evil`, `/\evil`, `javascript:`, `/other`, an over-long value, control characters, double-encoded variants), `withReturnTo` round trip, `useReturnTo` (valid, invalid, absent, legacy state fallback), `useAfterSave`. Component: `ManageScreenHeader` shows "Back to {label}" and the right target; Match form Back, Cancel and Save with and without `returnTo`; league Manage items and row menus build the right destination with the current tab and season; League edit Save returns to the origin; the Schedule `showAll` behaviour. Playwright golden path (skipped in CI): Manage League, Add Match, Save, lands on the schedule showing the match; reload keeps the Back label.

## Acceptance Criteria
1. Opening Add Match from a league's Manage League shows "Back to {league} schedule"; Back goes there; Save goes there and the new match is visible in the schedule.
2. The same for Edit League Details, the edit pencil, Open Team, Open Match, Edit Match from the league page and the Leagues list menus.
3. Reloading the destination, or opening it in a new tab, keeps the origin.
4. A `returnTo` that is external, malformed, over-long or outside `/manage/` and `/admin/` is ignored and the page behaves as before; it never navigates off-site.
5. A page reached with no `returnTo` behaves exactly as today.

## Rollout Notes
Phase 1 (Leagues) is a UI-only change: no backend, no migration. Add the rule to `docs/standards/page-anatomy.md` ("Navigation": origin travels in `returnTo`; Back, Cancel and Save return there) when this spec is approved, and a roadmap entry for the sweep and the breadcrumb idea. The page-by-page review checklist gains one line: "links that leave this page carry `returnTo`; pages reached from elsewhere honour it".

## Decisions
- The origin lives in the **address**, not in navigation state, so it survives reloads and new tabs.
- Only the **single origin** is kept; there is no history stack.
- Breadcrumbs are a **separate later decision**, not part of this fix.
