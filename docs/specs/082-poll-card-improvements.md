# 082 — Poll Card Improvements

**Depends on:** 064 to 067 (unified polls, `PollCard`, responses), 073 (availability hub, the editable close time), 081 (plain header and counters)
**Status:** draft — requested by the user on 2026-10-07 after using the polls page on a large screen. Small polish changes, specified so tests and the standards stay in step.

## Problem & Goals

On a large screen the poll cards are many and narrow (the shared card grid adds as many 380 px columns as fit), so text wraps and the cards feel small, while on a laptop they look better. Within a card, the close time sits under the response indicator and is easy to miss, the Matches dialog lists matches that cannot be opened, and Reopen is offered for polls whose matches are long past.

Goals:
- Cards that stay a comfortable size on any screen.
- The close time is read first and stands out, with a live countdown.
- Matches in the Matches dialog are links to the real match.
- Reopen is not offered for polls whose matches are in the past (with a 24 hour grace), in the UI and on the server.

## Non-goals

- Changing the other card grids (Matches, Players, Leagues); they keep today's grid unless the user asks.
- Changing how polls are created, closed automatically or shared.
- Changing the response indicator (progress bar and legend) itself.

## User Stories

- As a manager on a large screen, I see at most three poll cards per row, wide enough that titles and rows do not wrap.
- As a manager, I see when a poll closes before I see the response numbers, highlighted so I notice it, with a countdown that tells me how long is left.
- As a manager, I can open a match from a poll's Matches dialog by clicking it.
- As a manager, I am not offered Reopen for a poll whose matches finished more than a day ago, and the server refuses it too.

## Data Model Changes

None.

## API Contract

No new endpoints. Reopening (`POST` on a squad poll or a group round's open action) is refused with the existing `ReopenWindowPassedException` (409, with a message that the matches have passed) when the latest match of the poll started more than 24 hours ago. The existing rule (no reopen after the automatic close time) stays.

Rule: let `latest` be the start of the poll's latest match (a squad poll has one match; a group round has the matches of its windows; if a window somehow has no match, the end of its window date in the server's zone). Reopen is allowed only while `now <= latest + 24 hours`.

## UI Requirements

- **Grid:** the polls dashboard grid shows at most three columns on wide screens: `repeat(auto-fill, minmax(min(380px, 100%), 1fr))` capped so that no more than three columns are created (for example `repeat(auto-fill, minmax(max(380px, calc((100% - 32px) / 3)), 1fr))`, to be settled in the build), still one column on a phone and two where two fit. The other pages keep the shared `cardGridSx`.
- **Close time row:** in `PollCard` the "Poll closes" line moves above the response indicator block (progress bar, legend, answered text). It is emphasised: larger and bolder than the other detail lines, with a tinted background strip or chip; amber when the poll closes within 24 hours (the existing warning tone), neutral otherwise, and the existing edit pencil stays. A closed poll shows "Closed" with the close time in the neutral tone.
- **Countdown:** the close-time row also shows a live countdown while the poll is open and has a close time: "3 days 4 h left" while more than a day away, "5 h 12 min left" within a day (amber, with the row), and "42 min left" within the last hour, ticking every minute (every second in the last minute). When the time runs out it shows "Closing now" until the card refreshes and then "Closed". It is a small chip beside the close time, `role="timer"` with a full-sentence accessible name (for example "Closes in 5 hours 12 minutes") and no live announcements, so screen readers are not interrupted every minute. A poll without a close time (automatic closing off) or a closed poll shows no countdown. One shared hook (`useCountdown`) drives it, not a timer per card where avoidable, and it stops when the card unmounts or the tab is hidden.
- **Matches dialog:** each match in `PollMatchesDialog` is a link to its match page (`/manage/fixtures/matches/:matchId`), styled as a link with a visible focus state, opening in the same tab.
- **Reopen:** in the card footer, Reopen is disabled with a short explanation ("The matches in this poll are in the past") when the rule above says no, and the Reopen path in `EditCloseTimeDialog` is not reachable. The server rule is the authority; if it still refuses, show its message.

## Test Plan

Per `docs/standards/testing.md`:
- Backend: unit and Testcontainers tests for the rule on both poll kinds (inside the 24 hour grace, exactly at the edge, just outside, a group round with several matches uses the latest one, a future match), and that the existing automatic-close rule still applies; the controller returns 409 with the message.
- Frontend: the countdown wording at each stage (days, hours and minutes, last hour, last minute, expired) with fake timers, no countdown when closed or without a close time, the timer is cleaned up on unmount; `PollCard` tests for the new order (close time before the indicator), the emphasis tones (amber within 24 hours), the disabled Reopen with its reason, and the Matches dialog links; a test or story for the three-column cap; existing tests updated only where they depend on the old order.
- Storybook stories updated for `PollCard`.

## Acceptance Criteria

- On a large screen the polls page shows at most three cards per row; on a laptop it looks as it does today or wider.
- The close time is above the response indicator and visibly highlighted; it turns amber within 24 hours of closing.
- An open poll with a close time shows a live countdown that moves on by itself and turns amber within 24 hours.
- Clicking a match in the Matches dialog opens that match.
- Reopen is unavailable in the UI and refused by the server for polls whose latest match began more than 24 hours ago, and still works inside the grace and for future matches.

## Open Questions

- None blocking. Whether the other card pages should also cap at three columns is left to the user.

## Rollout Notes

One PR: backend rule and tests first, then the frontend changes.
