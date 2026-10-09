# 090 — Polls List View, and Close / Reopen From the Poll Page

**Depends on:** 064–066 (unified availability polls, `PollCard`), 073 (availability hub), 082 (poll card improvements, Reopen rules), 083–085 (`FilterBar`, `ContentControlsLine`, polls panel and `PollPanelRow`), 087–089 (Matches and Players: list-view standard in `docs/standards/frontend.md`, `ListViewToggle`, `useListViewPreference`, `MatchTable`)
**Status:** draft — written 2026-10-09 from the user's request ("Let do Polls", then "there is no Close Poll option on the poll info page, so there is no way of closing it from the list view"). The mockup canvas (https://claude.ai/artifact/QeNoz9wedBN3iRHXnMoKdE: Polls list view desktop and phone, the poll page header open, and closed with the confirmation) was **approved by the user on 2026-10-09** ("Ok great, lets go"); the spec text has not been reviewed line by line.

## Problem & Goals

Players and Matches have a Cards | List switch; Polls, the page the pattern started from, does not. And a poll can be closed or reopened only from its card: the poll page (Responses) has no Close poll, so a manager who works in a list view has no way to close a poll without switching back to cards.

Goals:
- **A. List view:** a Cards | List switch on the Polls view of the Availability hub, with a compact zebra `PollTable`, using the shared pieces from 088.
- **B. Close / Reopen on the poll page:** a **Close poll** button (and **Reopen poll** once closed) in the header of both the squad and the group poll page, with the same confirmation and rules as the card.

## Non-goals

- No new data, endpoints or migrations: both parts are frontend only, reusing the lists the Polls page already loads and the existing close, reopen and close-time calls.
- No row actions in the table (Close, Reopen, Matches, Share, Delete stay on the cards); a row opens the poll page, where Close and Reopen now exist. Delete stays on the card only.
- No change to the counters, the polls panel, the filters, sorting, the Players and Match-day cover views, or what a poll is.

## User Stories

- As a manager, I can switch the Polls view between Cards and List and have the app remember my choice, so that I can scan many polls at once.
- As a manager, I can see in the list each poll's type, status, when it closes and how many have answered, so that I know which polls need chasing.
- As a manager, I can close an open poll from its page, and reopen a closed one, so that I never have to go back to the cards to do it.

## Data Model Changes

None.

## Polls list view (A)

Follows the list-view standard (mockup boards 1 and 2):

- The Cards | List switch (`ListViewToggle`) sits on the content line beside Group polls, Squad polls and Show closed polls; first control in the Filters sheet on a phone. The choice is remembered per page (`useListViewPreference('pollList:view')`).
- **Columns (desktop):** Poll (title, with "Squad poll · Home · Thu 15 Oct" or "Group poll · <section>" under it), Type chip (Squad / Group), Status chip (Open / Closed), Closes (date and time, the live countdown under it, amber within 24 hours; "Closes manually · No auto-close" when auto-close is off; "Closed <date>" once closed), Answered (a small bar and "10 of 14", with "(best slot)" for a group poll with several slots, the figure the polls panel already uses) and a chevron. Zebra rows; the whole row opens that poll's Responses page, as the card does.
- **Columns (phone):** Poll (title, the Type and Status chips under it, then the closing time), Answered ("10/14") and the chevron.
- Rows are in the same order as the cards; counters, filters, search, the type switches and Show closed apply identically to both views; empty and loading states are the card list's.

## Close / Reopen from the poll page (B)

Mockup boards 3 and 4. On the squad and group poll pages, the header actions gain a button beside Open match / Share invite:

- **Open poll:** **Close poll** (outlined, lock icon). It opens the same confirmation as the card ("Close this poll?", `closePollTitle` / `closePollDescription`) and calls the same close request; the page then shows the closed state (status chip, Share invite disabled with its reason).
- **Closed poll:** **Reopen poll** (outlined, unlock icon). It opens the same close-time dialog the pencil opens (`EditCloseTimeDialog` with `reopen`), and is disabled with the existing reason (`REOPEN_PAST_REASON`) when the matches are in the past (`canReopen` false).
- After either action the poll data, the counters and the Polls list are refreshed through the same invalidation the card uses.

## UI Requirements

Composes from: `ListViewToggle`, `useListViewPreference`, `ContentControlsLine`, `FilterBar` (`viewControls` for the sheet), `CompactSwitch`, `Countdown` / `useCountdown`, `badgeSx`, `zebraTint`, `ConfirmDialog`, `EditCloseTimeDialog`, `closePollTitle` / `closePollDescription`, and the `PollPanelRow` builders (`squadPollRow`, `groupPollRow`, `answeredText`) for the Answered figure. New: `PollTable` (next to `PollCard`, under `pages/manage/availability/`) and a small shared hook for the close / reopen behaviour so the card and the two poll pages cannot drift (extracted from `PollCard`). The list-view paragraph in `docs/standards/frontend.md` and the roadmap item are updated.

## Test Plan

- **Frontend unit:** `PollTable` (columns, chips, amber closes within 24 hours, manual close, closed text, answered figures incl. best slot, whole-row link, desktop-only cells), `AvailabilityPollsDashboard` (switch, remembered preference, counters and filters apply to the table, row opens the poll), the close / reopen hook, and both poll pages (Close poll with confirmation and cancel, Reopen poll opening the dialog, disabled with the reason when it cannot reopen). Existing tests adjusted to the new markup, not weakened.
- **Storybook:** a story for `PollTable`.
- No backend tests.

## Acceptance Criteria

- The Polls view has a Cards | List switch; the choice survives a reload; the table respects the counters, filters, search, type switches, Show closed and the sort, and a row opens the poll page.
- A squad or group poll can be closed from its page after confirming, and reopened (when allowed); the card, the counters and the list agree afterwards.
- No filter, counter, permission or poll rule changes.

## Open Questions

- Whether to add row actions to the table later (a Close poll action in the row); not needed now that the poll page has it.

## Rollout Notes

Two slices, one branch (`feat/087-slice-1-shared-pieces`, PR #106): (1) Close / Reopen on the poll page with the shared hook; (2) the list view. Update `docs/roadmap.md` (remove the Polls list-view item) when slice 2 lands.
