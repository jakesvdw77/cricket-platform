# 066 — Poll Close Time and Unified Poll Cards

**Depends on:** `064-unified-availability-polls.md` (the polls list, squad and group polls, Autoclose, scheduler, reopen rule), `065-group-poll-responses-view.md` (the Responses page and its Summary view, which this reuses), `032-match-availability-polls.md` and `063-section-availability-and-flexible-squads.md` (the two poll kinds and their admin answer override).
**Status:** approved

## Problem & Goals

Hands-on use of `064`/`065` found three gaps:

1. **A manager cannot set or change when a poll closes.** Autoclose picks "24 hours before the first match" at creation and nothing lets the manager move it. The only way to extend a poll is a database edit, and after the close time passes a poll cannot be reopened at all (`064`'s reopen rule).
2. **The two kinds of poll card look and behave differently side by side.** Different fields, different date formats, different footer buttons in different places, and unequal heights in a row. The Summary view built in `065` (a bar per time slot plus counts) is clearer than either card's current body.
3. **A closed poll's answers cannot be corrected.** A player who phones in after the deadline cannot be recorded by the manager.

**Goals**
- A manager can set the close date and time when creating a poll, edit it afterwards, and reopen a closed poll by choosing a new close time. The default stays the rule from `064`: 24 hours before the earliest match.
- Both poll kinds use one card layout built on the Summary concept, with the same buttons in the same places, and every card in a row is the height of the tallest.
- A manager can correct a player's answer on an open or a closed poll; the public link stays closed to players once the poll is closed.

## Non-goals

- **Reminders to players before a poll closes** (still the roadmap's open item) and a "nudge non-responders" action.
- **Changing which matches a poll covers** after creation (still out of scope from `063`/`064`).
- **Recomputing a poll's close time when a match is rescheduled.** The stored close time stays as set; the manager can edit it.
- **A close time after the first match's kickoff** (a poll that closes after its own match has started is rejected, see the rules below).
- **Closed-poll answer changes by players.** Only managers; the public response page stays read-only once a poll is closed.

## User Stories

- As a club admin creating a poll, I see its close time as an editable date and time, pre-filled with 24 hours before the earliest match, and I can switch Autoclose off.
- As a club admin, I can edit an open poll's close time or switch Autoclose off, from the poll card and from the Responses page.
- As a club admin, I can **Reopen** a closed poll by choosing a new close time in the future (or turning Autoclose off), even after the old close time has passed.
- As a club admin, I see group and squad polls drawn the same way: same header, same slot summaries, same footer buttons in the same places, same date format.
- As a club admin, I see every card in a row at the height of the tallest, with the footer pinned to the bottom.
- As a club admin, I can set or correct a player's answer on a closed poll, with a clear note that the poll is closed.

## Data Model Changes

None. `section_availability_round` and `match_availability_poll` already hold `auto_close` and `scheduled_close_at`.

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `PUT /api/v1/manage/clubs/{clubId}/section-availability-rounds/{roundId}/close-time` | `canAccessClub` + `assertCanAdministerSection` | **New.** Body `{ autoClose: boolean, scheduledCloseAt: ISO instant \| null }`. Sets the close time of an open or closed group poll. Does not by itself open or close it. |
| `PUT /api/v1/manage/clubs/{clubId}/matches/{matchId}/polls/{pollId}/close-time` | same section-scoped gate as the poll's other admin endpoints | **New.** Same body and rules for a squad poll. |
| `POST …/open` on both kinds (`064`) | unchanged gate | Reopen is allowed when `autoClose` is false, or the stored `scheduledCloseAt` is in the future. Unchanged; the UI sets a future close time first. |
| `PUT …/section-availability-rounds/{roundId}/players/{playerProfileId}` and `PUT …/matches/{matchId}/polls/{pollId}/players/{playerProfileId}` | unchanged gates | **Changed:** the admin answer override is now accepted on a closed poll. The public (no-login) response endpoints keep refusing writes to a closed poll. |

**Close-time rules (both kinds, `400`/`409` via the existing exception types):**
- `autoClose = false` stores `scheduledCloseAt = null`; `autoClose = true` requires a `scheduledCloseAt`.
- `scheduledCloseAt` must be in the future, and no later than the earliest covered match's kickoff (`400`, a clear message).
- The default the UI proposes is `AutoCloseSchedule` (earliest match minus 24 hours); when that is already in the past (a match less than a day away) the UI proposes "1 hour before the match" for a poll that is still open or being reopened, and the manager can change it.
- A closed poll keeps its state when only its close time is edited; **Reopen** is a separate action.

## UI Requirements

Composes existing components. Approved-for-review design page: https://claude.ai/artifact/2w92HN7t12sxyHecAMK3Y2 (icons in the mockup are approximate; real ones are MUI icons). New page-local pieces live in `ui/src/pages/manage/availability/`; the card sits on `RecordCard`.

- **One poll card for both kinds** (`PollCard`, replacing `SquadPollCard` and `GroupPollCard`'s bodies):
  - **Header:** avatar, title (group: the description with a pencil; squad: "Team v Opponent"), badge row (**Squad poll** / **Group poll**, **Open** / **Closed**, Home/Away for squad), delete bin in the top-right corner.
  - **Subtitle:** group: section name and "N matches"; squad: date and time and venue, in the same date style as everywhere else (e.g. "Sat 15 Oct, 10:37 · Venue TBC"), never the raw locale string.
  - **Body:** one **slot summary** per time slot, the `065` Summary concept in compact form: slot heading, a stacked bar (Available / Unsure / Unavailable / No response), a text legend with the four counts, and "N of M answered". A squad poll has one slot (its match's date and Morning/Afternoon); a group poll has one per slot. Status is never colour alone.
  - **Closes row:** "Closes <date time>" or "Closes manually", with a pencil that opens the **Edit close time** dialog; for a closed poll it reads "Closed <date>" and the dialog is titled **Reopen**.
  - **Footer, same buttons in the same order on both kinds:** **Close** (or **Reopen**), **Matches**, **Responses**, **Share**, laid out as four equal columns with each button an icon above a short caption (not a long single-line label), so no button is ever clipped or wrapped at any card width, including a 375px phone and the 2- and 3-column desktop grids. The tooltip/aria-label of Share is "Share invite". **Matches** opens a small dialog listing the poll's matches (one for a squad poll, with a link to the match). **Responses** opens the `065` page for a group poll and the match's Availability tab for a squad poll. **Share invite** opens the existing share dialog for either kind.
- **Equal heights:** the list grid stretches every card to the tallest in its row; the summary area grows and the footer is pinned to the bottom, so buttons line up across cards.
- **Edit close time dialog** (used from the card and from the Responses page header): an Autoclose switch and a date-and-time field, pre-filled with the current close time (or the default rule when there is none), inline validation messages for the rules above, **Save**. On a closed poll the primary action is **Reopen**, which saves the close time then reopens.
- **New poll screens (`064`):** the group card and each squad row show the close time as an editable date-and-time field (default per the rule) next to the Autoclose switch, instead of a read-only line.
- **Responses page (`065`):** the header's "Closes …" line gets the same pencil/dialog; on a closed poll the answer menu stays enabled for managers with the note "This poll is closed. Changes are recorded as a manager correction." instead of "answers can't be changed".

## Test Plan

- **Backend unit/integration:** both close-time endpoints (valid save; autoClose false clears the time; past time `400`; time after the earliest kickoff `400`; autoClose true without a time `400`; closed poll keeps closed; section-scope `403`/`404`); reopen after editing a past close time to the future succeeds; admin answer override accepted on a closed poll for both kinds and the public endpoints still `409`; existing tests updated for the override change.
- **Frontend (Vitest/RTL):** one `PollCard` for both kinds (header, subtitle format, slot summaries with correct counts and bar widths, closes row, identical footer buttons and order); Matches dialog; Responses destination per kind; Edit close time dialog (default, validation, save payload, autoClose off, Reopen path on a closed poll); New poll close-time fields default and send the chosen values; Responses page keeps the override enabled with the new note on a closed poll; grid rows stretch (card container has the stretch/height styles and the footer is pinned); the footer renders four equal-width buttons with a visible caption and an accessible name each. Clipping itself is checked in the browser at 375px, 2-column and 3-column widths.
- **Storybook:** a story for any new shared component (the slot summary, if extracted to `components/`).
- **Playwright:** extend the polls golden path to edit a close time, if the harness can run it.

## Acceptance Criteria

- A manager can set the close time when creating a poll, edit it later, and reopen a closed poll by choosing a future close time.
- The default close time is 24 hours before the earliest match (or 1 hour before if that is already past).
- A close time in the past, or after the first match's kickoff, is rejected with a clear message.
- Group and squad cards share one layout, the same buttons in the same positions, and one date format; cards in a row are the same height with the footer aligned.
- **No footer button is cut off or wrapped** at 375px, in the 2-column grid, and in the 3-column grid (verified in a real browser at those widths, not only in unit tests).
- A manager can change a player's answer on a closed poll; players still cannot on the public link.

## Amendments during build

Decisions made while building, none of which change what the spec fixes:

- **The create endpoints also accept an optional `scheduledCloseAt`** (group and squad), validated by the same rule as the PUTs; when absent the default (earliest match minus 24 hours) applies. This avoids a create-then-edit two-step that could leave a poll with the wrong close time.
- **`SectionAvailabilityRoundDto` gains `firstMatchKickoff`** (the exact earliest kickoff, an instant) so the UI can compute the default close time and the "before the first match starts" check for a group poll; the existing `firstMatchDate`/`lastMatchDate` are dates only.
- **Card grid:** cards are never narrower than 320px (`auto-fill, minmax(320px, 1fr)`), which is what guarantees the four footer columns fit; the footer captions are Close (Reopen), Matches, Responses and Share.
- **Wording:** the closed-poll dialog is titled **Reopen this poll** (primary action **Reopen**); a squad card title reads "Home vs Away".
- **Group description editing** is a small dialog opened from the title pencil, not an inline panel, so a card never changes height on its own.
- **Morning/Afternoon for a squad poll's slot is computed in the browser's local time** (before 12:00 is Morning), mirroring the server rule, which uses the server's zone; the two agree whenever the manager's browser is in the server's time zone.

## Rollout Notes

Backend first (two endpoints and the override change), then frontend. `OpenAPI` is regenerated by hand as in `064`. The respondent avatars the squad card used to show are replaced by the counts and bar; the names remain one click away on the Responses page.
