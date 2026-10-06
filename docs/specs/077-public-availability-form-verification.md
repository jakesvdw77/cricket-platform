# 077 — Public Availability Form: Find Yourself and Confirm

**Depends on:** 032 (match availability polls, squad poll public page), 063 (section availability rounds, group poll public page), 064 to 067 (unified polls and responses), 028 (players, shirt numbers via 022)
**Status:** draft — design approved by the user from the full-screen mockup https://claude.ai/artifact/LjZ8gyGQV1Rv9CYRMEq7b8 on 2026-10-06 (11 phone screens, desktop view and the rules). Open Questions need answers before planning. The earlier idea of email and phone confirmation is a later version.

## Problem & Goals

Managers send one public availability link to the whole WhatsApp group each week, replacing a Google form. Today both public pages (`/poll/:pollId` for a squad poll, `/section-availability/:roundId` for a group poll) list every player and let anyone tap any row. Anyone can answer for anyone, by accident or on purpose, and the whole squad is exposed to anyone with the link.

Goals:
- A respondent finds themselves by typing their first name and surname. No list is ever shown.
- The lookup returns almost nothing about a player, and only players who belong to this poll.
- An answer is saved only after the respondent confirms with their date of birth (first version).
- A player can change their answer from the same link until the poll closes.
- Parents of several players, and players who share a name, are handled without exposing private data.

## Non-goals

- Two-factor authentication or one-time codes (rejected earlier: configuration burden and the same gap where contact details are missing).
- Email or phone confirmation. This is the planned "more advanced" version; the design must leave room for it (the confirm step is one replaceable check).
- Strong identity. This is a deliberately light control, aimed at accidents and casual pranks. Managers can always change an answer.
- Parent or guardian accounts. When players and parents can log in they will have their own way to answer; this form stays for the group link.
- Changing how polls are created, closed or shared.

## User Stories

- As a player or parent, I type my first name and surname and, if I am in this poll, I can set my availability, so that I do not scroll a list of the whole squad.
- As a player or parent, I confirm with my date of birth before my answer is saved, so that nobody can answer for me by mistake.
- As a player, I can reopen the link and change my answer until the poll closes, so that I can update it when plans change.
- As a parent with several children, I answer for each child in turn, and the device remembers them for next time.
- As a manager, I see which answers came from the public link and I can change any answer, so that a wrong answer is easy to fix.
- As a manager, I see players who have no date of birth, so that I can fix their records and they can use the form.

## Data Model Changes

- **Attempts and lockout:** new table `public_availability_attempt` (migration `NNN-public-availability-attempt.sql`): `player_profile_id`, `failed_count`, `window_started_at`, `locked_until`. A lock applies to that one player, not to the poll or the device. Defaults to be fixed in planning (proposal: 5 wrong dates of birth locks that player for 15 minutes).
- **Source of an answer:** a `source` column (`MANAGER` or `PUBLIC_LINK`, default `MANAGER`) on `player_availability` and `section_availability_response`, so the Responses pages can show that an answer came from the link. The existing `updated_by` stays null for public answers.
- **Date of birth:** `person.date_of_birth` is currently nullable. It becomes required for new and edited players (API and form validation, plus a sanity check: not in the future, not implausibly old; no `NOT NULL` migration because existing rows are empty), with a "missing date of birth" list for managers. A player without a date of birth can be found but cannot save (see screen behaviour below).
- Shirt number (`player_profile` jersey number, 022) is used for same-name disambiguation; no change.

## API Contract

All under the existing public namespace (no login). The poll's own id is still the access boundary for the link. The old endpoints that list every player and accept an unchecked per-player answer are removed.

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/public/polls/{pollId}` and `GET /api/v1/public/section-availability-rounds/{roundId}` | Poll header only: title, open or closed, close time, the match or the match slots (window id, date, day part, teams). **No players, no responses.** |
| `POST .../find` with `{ firstName, lastName }` | Exact, case-insensitive full-name lookup among the players who belong to this poll. Returns a list of `{ playerId, firstName, lastName, shirtNumber (nullable), teamLabel }` and nothing else. Same "not found" answer whether the name does not exist or the player is not in this poll. Rate limited per client address. |
| `GET .../players/{playerId}/answers` | That player's current answers for this poll (per window, or the one match), so the form can prefill when changing a vote. Returns statuses only. See Open Questions. |
| `PUT .../players/{playerId}/answers` with `{ dateOfBirth, answers }` | Saves all of the player's answers in one call after checking the date of birth. Wrong date of birth: 403 with a generic message and the tries left, counted against that player; locked: 423 with when to retry; poll closed: 409; player not in the poll or unknown: 404. |

Belonging to the poll (the rule the server enforces on every call):
- **Group poll (section round):** active players tagged to the round's section (the same audience the Responses page uses).
- **Squad poll (match poll):** players in that match's squad for the poll's team and season (the same audience the poll responses use).
- A player outside that set is never returned and never saved, even with a correct date of birth.

Privacy rules: no date of birth, email, phone, address, photo or section details beyond a short team or section label are ever returned. Date of birth is only ever received, compared server side and not echoed. The same generic error is returned for every failed lookup. Errors never say which part was wrong.

## UI Requirements

Reference: the approved mockup. These pages use no shell (reachable before login), the brand header and the page wash from the theme, are phone first, and keep MUI primitives and theme tokens.

Screens (numbers match the mockup):
1. **Open the link:** poll heading and status chip, "Who are you?", first name and surname fields, "Find me". The remembered players on this device appear above or below as chips.
2. **Name not found:** the generic "could not find that name in this poll" message.
3. **Several players with the same name:** pick yourself from a short list showing shirt number and team or section label. Never shows more than that.
4. **Your answer, group poll:** one row per match slot in the round with Available, Unsure and Unavailable. 4b. **Squad poll:** one question for the match.
5. **Confirm it is you:** a summary of the answers and a date of birth entry (three numeric fields: day, month, year), "Save my answer", "Back".
6. **Wrong date of birth:** a generic message with the tries left, and the hint to check you picked yourself and not someone with the same name.
7. **Locked:** "please try again later" for that player only.
8. **Saved:** confirmation and a summary, "Change my answer" and "Answer for someone else".
9. **Coming back:** the link opened again on the same device shows the remembered players with their last answers; choosing one opens screen 4 prefilled; saving asks for the date of birth again.
10. **Poll closed:** read-only message, no controls. 11. **Link not valid.**

Remembered players: browser local storage only, per poll link and club, as opaque player ids with the last answered time, a "remove" on each and a "forget this device" action; it is a shortcut, not a security control, and the server never trusts it. Every storage read and write is wrapped in try/catch and the form works without it.

A player with no date of birth on record can be found, but screen 5 explains that their manager needs to add it, without revealing anything else.

Manager side: the Responses pages mark answers that came from the public link, and managers can still change any answer (existing manager endpoints and rules, unchanged).

## Test Plan

Per `docs/standards/testing.md`:
- Backend unit and integration (Testcontainers): lookup returns only the allowed fields; players outside the poll's section or squad are never returned or saved (group and squad cases, another club's player, an inactive player); same-name results; exact-match only (no partial); correct and wrong date of birth, case of a missing date of birth, lockout after the limit and unlock after the window, per-player lock; closed poll rejects saves; the old list-everyone endpoints are gone; saving several windows in one call is atomic; `source` is set to `PUBLIC_LINK`; rate limiting on find.
- Frontend component and page tests for each screen above, including remembered players, storage unavailable, prefill on change, and the error states; stories for the new components.
- Playwright smoke: open a link, find a player, answer, confirm, change the answer.

## Acceptance Criteria

- No public endpoint returns a list of players without a full first and surname match.
- A lookup never returns a date of birth, contact details or any other field than id, first name, surname, shirt number and team label.
- A player outside the poll's section or squad can never be found or have an answer saved through the link.
- An answer is saved only after a matching date of birth; wrong attempts are counted per player and lock that player for a while.
- A player can change their answer until the poll closes, and cannot after it closes.
- Players with the same name can be told apart by shirt number and team or section label.
- Managers can see which answers came from the link and can change them.
- The form works on a phone without any stored state.

## Open Questions

- **Prefill versus privacy:** to prefill a vote being changed, the server returns that player's current statuses before the date of birth is entered, so anyone who knows a name could read that player's availability. Accept for the first version (low sensitivity), or move the date of birth before showing current answers?
- **Twins:** twins in the same team with the same birthday and no shirt numbers cannot be told apart by either check. Options: managers add shirt numbers, or the parent is told to ask the manager. Preference?
- **Lockout numbers:** 5 wrong tries and 15 minutes are proposals.
- **Missing dates of birth:** how soon should date of birth become required, and do you want a one-off report first?
- **Manager view:** is the "via link" marker on the Responses pages enough, or do managers also want a list of recent public changes?

## Rollout Notes

Slices, each shippable: (1) date of birth required for new and edited players, plus the missing-date report, so the data is ready; (2) backend: header-only poll endpoints, find, answers get and put, attempts table, source column, and removal of the old list-everyone endpoints together with the frontend that uses them (they must change in the same release); (3) the new public pages for both poll types and the remembered-players shortcut. Slice 2 and 3 ship together because the old pages cannot work against the new endpoints. Spec before code: this needs the open questions answered, then `/plan-feature`.
