# 067 — Squad Poll Responses Page

**Depends on:** `065-group-poll-responses-view.md` (the Responses page and its three views), `066-poll-close-time-and-unified-cards.md` (the unified `PollCard`, `EditCloseTimeDialog`, manager corrections on closed polls), `032-match-availability-polls.md` (the squad poll and its responses).
**Status:** approved (the user asked for "the same page for both"; the page design is `065`'s, unchanged)

## Problem & Goals

The group poll card's **Responses** button opens a dedicated page (`065`), but the squad poll card's **Responses** button jumps to the match edit screen's Availability tab. Same button, same place on the card, different destination and a different layout. A manager moving between poll kinds loses their bearings.

**Goals**
- A squad poll's **Responses** button opens the **same Responses page** a group poll uses, with the same three views (By time slot, By player, Summary), player search, header, share invite, close-time pencil and manager answer override.
- A squad poll is shown as a poll with **one time slot** (its match). Nothing about the page changes shape.
- The match edit screen's Availability tab stays exactly as it is, reachable from an **Open match** link on the page.
- No backend or API change.

## Non-goals

- **Changing the match screen's Availability tab.** It keeps its own layout (the user explicitly wants that).
- **Any change to the group poll's page.** `065`'s behaviour is untouched.
- **New response data.** Only what `getPollResponses`, `getMatch` and `listPolls` already return is used.

## User Stories

- As a club admin, I click **Responses** on a squad poll card and land on the same Responses page a group poll opens, for that poll.
- As a club admin, on that page I see the poll's title ("Team vs Opponent"), its badges (Squad poll, Open/Closed, Home/Away), its section-less subtitle (match date, time, venue), its "Closes …" line with the pencil, and **Share invite**.
- As a club admin, I can switch between By time slot (one block for the match), By player (one answer column) and Summary (one card), and search players.
- As a club admin, I can change a player's answer, on an open or closed poll, from the same menu.
- As a club admin, I can follow an **Open match** link from the page to the match's edit screen (its Availability tab).

## Data Model Changes

None.

## API Contract

No new or changed endpoints. The page composes existing calls:

| Call | Used for |
|---|---|
| `getPollResponses(clubId, matchId, pollId)` | Players (name, `squadJerseyNumber`), their answers, the four counts, `open`, `publicPath` |
| `listPolls(clubId, matchId)` (find by `pollId`) | `autoClose` and `scheduledCloseAt` for the Closes line and the close-time dialog |
| `getMatch(clubId, matchId)` | Match date and time, venue, home/away team names (title, subtitle, slot heading, Open match link) |
| `setPlayerStatus(...)` | Manager answer override (already accepted on closed polls since `066`) |
| `updatePollCloseTime` / `openPoll` (via `EditCloseTimeDialog`) | Edit close time and Reopen, as on the card |

## UI Requirements

Reuses `065`'s page and views; no new visual pattern. The route for a squad poll is `/manage/availability/squad/:matchId/:pollId` (the group route `/manage/availability/group/:roundId` is unchanged).

- **One page, two data sources.** The page's views read a small normalised model (title, badges, header details, slots with counts, player rows with one answer per slot, open flag, share, override, close-time dialog binding). A group poll fills it from `getRoundResponses`/`getRoundMatches`/`listRounds`; a squad poll fills it from `getPollResponses`/`getMatch`/`listPolls` with **one slot**: heading from the match date and its Morning/Afternoon (the same client rule as the card), counts from the poll. The three views, search, hide-non-responders, the collapsed No response row and the scroll boxes are shared unchanged.
- **Header for a squad poll:** title from the match ("Home vs Away"), badge row Squad poll / Open or Closed / Home or Away, subtitle "Sat 15 Oct, 10:37 · Venue", the Closes line with the pencil (`EditCloseTimeDialog` in squad mode), **Share invite** (the existing `PollShareDialog`), and an **Open match** link to `/manage/fixtures/matches/:matchId/edit?tab=availability&side=home|away`. Back link to `/manage/availability`.
- **Override:** each player row/chip opens the same menu; the call is the squad `setPlayerStatus`; the closed-poll note is the same ("This poll is closed. Changes are recorded as a manager correction.").
- **Squad `PollCard`:** **Responses** now navigates to the new route instead of the match tab. Everything else on the card is unchanged.
- Loading, not-found (poll or match missing) and not-authorized states follow the group page.

## Test Plan

- **Page/component (Vitest + RTL):** a squad poll opens the page with the right header (title, badges, subtitle, Closes line, Open match link); the three views show the single slot with correct groups, counts and "N of M answered"; search and hide-non-responders work; the override calls `setPlayerStatus` with the right ids and updates the page, on open and closed polls; the close-time pencil opens the dialog in squad mode and Reopen saves then opens; not-found for a missing poll or match; the group page's existing tests stay green.
- **`PollCard`:** a squad card's Responses navigates to `/manage/availability/squad/:matchId/:pollId`.
- **Normalisation:** pure-function tests for the squad and group adapters (one slot for squad, brackets for group, counts, player name/number, Morning/Afternoon heading).
- **Playwright:** extend the polls golden path to open a squad poll's Responses page, if the harness can run it.

## Acceptance Criteria

- A squad poll's **Responses** opens the same page and views as a group poll's, with one time slot.
- The page shows the squad poll's title, badges, subtitle, Closes line with pencil, Share invite and an Open match link.
- Managers can change answers on open and closed squad polls from the page.
- The match screen's Availability tab is unchanged.
- No backend or API change; the group page behaves exactly as before.

## Rollout Notes

Frontend only. Refactors `GroupPollResponsesPage` so its views take a normalised model; the group page must keep passing its existing tests unchanged in behaviour.
