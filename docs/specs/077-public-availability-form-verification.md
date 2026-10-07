# 077 — Public Availability Form: Find Yourself and Confirm

**Depends on:** 032 (match availability polls, squad poll public page), 063 (section availability rounds, group poll public page), 064 to 067 (unified polls and responses), 028 (players, shirt numbers via 022)
**Status:** draft — design approved by the user from the full-screen mockup https://claude.ai/artifact/LjZ8gyGQV1Rv9CYRMEq7b8 on 2026-10-06, then revised the same day to "verify first, then answer" (see Decisions). Ready to plan once the user has seen the revised mockup. The earlier idea of email and phone confirmation is a later version.

## Problem & Goals

Managers send one public availability link to the whole WhatsApp group each week, replacing a Google form. Today both public pages (`/poll/:pollId` for a squad poll, `/section-availability/:roundId` for a group poll) list every player and let anyone tap any row. Anyone can answer for anyone, by accident or on purpose, and the whole squad is exposed to anyone with the link.

Goals:
- A respondent says who they are by typing their first name, surname and date of birth on one screen. No list is ever shown.
- Nothing about a player is returned or saved before those details match, and only players who belong to this poll can match.
- The date of birth is the only check in this first version.
- A player can change their answer from the same link until the poll closes.
- Parents of several players, and players who share a name, are handled without exposing private data.

## Non-goals

- Two-factor authentication or one-time codes (rejected earlier: configuration burden and the same gap where contact details are missing).
- Email or phone confirmation. This is the planned "more advanced" version; the design must leave room for it (the confirm step is one replaceable check).
- Strong identity. This is a deliberately light control, aimed at accidents and casual pranks. Managers can always change an answer.
- Parent or guardian accounts. When players and parents can log in they will have their own way to answer; this form stays for the group link.
- Changing how polls are created, closed or shared.

## User Stories

- As a player or parent, I type my first name, surname and date of birth and, if I am in this poll, I can set my availability, so that I do not scroll a list of the whole squad and nobody can answer for me by mistake.
- As a player, I can reopen the link and change my answer until the poll closes, so that I can update it when plans change.
- As a parent with several children, I answer for each child in turn, and the device remembers them for next time.
- As a manager, I see which answers came from the public link and I can change any answer, so that a wrong answer is easy to fix.
- As a manager, I see players who have no date of birth, so that I can fix their records and they can use the form.

## Data Model Changes

- **Attempts and lockout:** new table `public_availability_attempt` (migration `NNN-public-availability-attempt.sql`): `player_profile_id`, `failed_count`, `window_started_at`, `locked_until`. Attempts are counted per poll and normalised full name, so a stranger cannot lock a different player out, and a failed verify can never reveal whether a player exists. Decided: 5 wrong tries lock that name in that poll for 15 minutes; a per-address limit applies on top. (Column set to be adjusted in planning: the key is the poll plus the normalised name, not a player id.)
- **Source of an answer:** a `source` column (`MANAGER` or `PUBLIC_LINK`, default `MANAGER`) on `player_availability` and `section_availability_response`, so the Responses pages can show that an answer came from the link. The existing `updated_by` stays null for public answers.
- **Date of birth:** `person.date_of_birth` is currently nullable. It becomes required for new and edited players (API and form validation, plus a sanity check: not in the future, not implausibly old; no `NOT NULL` migration because existing rows are empty), with a "missing date of birth" list for managers. A player without a date of birth can be found but cannot save (see screen behaviour below).
- Shirt number (`player_profile` jersey number, 022) is used for same-name disambiguation; no change.

## API Contract

All under the existing public namespace (no login). The poll's own id is still the access boundary for the link. The old endpoints that list every player and accept an unchecked per-player answer are removed.

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/public/polls/{pollId}` and `GET /api/v1/public/section-availability-rounds/{roundId}` | Poll header only: title, open or closed, close time, the match or the match slots (window id, date, day part, teams). **No players, no responses.** |
| `POST .../verify` with `{ firstName, lastName, dateOfBirth }` | Checks the three values together, exact and case-insensitive for the name, against the players who belong to this poll. On a match returns `{ playerId, firstName, lastName, token, expiresAt }` where the token is a short-lived (about 30 minutes) signed value scoped to this poll and this player. On no match returns one generic 404-style failure (never saying which part was wrong) with the tries left, or 423 when locked. If more than one player matches (same name and same birthday) it returns the candidates `{ playerId, shirtNumber, teamLabel }` for a pick, nothing else. Rate limited per client address. |
| `GET .../players/{playerId}/answers` | With the token: that player's current answers for this poll (per window, or the one match) so the form can prefill when changing a vote. |
| `PUT .../players/{playerId}/answers` with `{ answers }` | With the token: saves all of the player's answers in one call. Closed poll: 409; missing, expired or wrong-scope token: 401; player not in the poll: 404. |

Belonging to the poll (the rule the server enforces on every call):
- **Group poll (section round):** active players tagged to the round's section (the same audience the Responses page uses).
- **Squad poll (match poll):** players in that match's squad for the poll's team and season (the same audience the poll responses use).
- A player outside that set is never returned and never saved, even with a correct date of birth.

Privacy rules: before a successful verify the server returns nothing about any player. After it, only the verified player's name, their own current answers and, in the rare same-name-same-birthday case, shirt numbers and team labels for a pick. Date of birth, email, phone, address and photo are never returned; the date of birth is only received, compared server side and never echoed. Every failed verify gives the same generic error.

## UI Requirements

Reference: the approved mockup. These pages use no shell (reachable before login), the brand header and the page wash from the theme, are phone first, and keep MUI primitives and theme tokens.

Screens (numbers match the revised mockup):
1. **Say who you are:** poll heading and status chip, first name, surname and date of birth (three numeric fields: day, month, year), "Continue". Remembered players on this device appear as chips; tapping one fills the name so only the date is asked (7b).
2. **Details do not match:** one generic message with the tries left. 3. **Locked:** "please try again later".
4. **Your answer:** after verifying, the player is shown as confirmed with "Not you?". Group poll: one row per match slot with Available, Unsure and Unavailable. 4b. **Squad poll:** one question for the match.
5. **Changing a vote:** the same screen prefilled with the current answers and the last answered time; stays usable for the token's lifetime without asking for the date again.
6. **Saved:** confirmation and a summary, "Change my answer" and "Answer for someone else" (asks for that player's name and date of birth).
7. **Coming back on the same device:** remembered players with their last answered time.
8. **Same name and same birthday (rare):** a pick screen showing only shirt number and team label.
9. **No date of birth on record:** explains that the manager needs to add it, shown only after the full name matched a player in this poll.
10. **Poll closed:** read-only message. 11. **Link not valid.**

Remembered players: browser local storage only, per poll link and club, as opaque player ids with the last answered time, a "remove" on each and a "forget this device" action; it is a shortcut, not a security control, and the server never trusts it. Every storage read and write is wrapped in try/catch and the form works without it.

Manager side: the Responses pages mark answers that came from the public link, and managers can still change any answer (existing manager endpoints and rules, unchanged).

## Test Plan

Per `docs/standards/testing.md`:
- Backend unit and integration (Testcontainers): verify returns nothing before a match and only the allowed fields after it, and the same generic failure for a wrong name, a wrong date and a player outside the poll; players outside the poll's section or squad are never returned or saved (group and squad cases, another club's player, an inactive player); same-name results; exact-match only (no partial); correct and wrong date of birth, case of a missing date of birth, lockout after the limit and unlock after the window, per-player lock; closed poll rejects saves; the old list-everyone endpoints are gone; saving several windows in one call is atomic; `source` is set to `PUBLIC_LINK`; rate limiting on find.
- Frontend component and page tests for each screen above, including remembered players, storage unavailable, prefill on change, and the error states; stories for the new components.
- Playwright smoke: open a link, find a player, answer, confirm, change the answer.

## Acceptance Criteria

- No public endpoint returns anything about a player before the name and date of birth match, and none returns a list of players.
- A verify never returns a date of birth, contact details or any other field than id, first name, surname, shirt number (same-name case only), team label and the player's own current answers.
- A player outside the poll's section or squad can never be found or have an answer saved through the link.
- An answer is saved only after a matching date of birth; wrong attempts are counted per player and lock that player for a while.
- A player can change their answer until the poll closes, and cannot after it closes.
- Players with the same name can be told apart by shirt number and team or section label.
- Managers can see which answers came from the link and can change them.
- The form works on a phone without any stored state.

## Decisions

Answered by the user on 2026-10-06:
- **Verify first, then answer.** The date of birth is asked together with the name on the first screen, and nothing is shown or saved until they match. After a match the player can answer and change the answer for the token's lifetime without being asked again. (This also removes the question of showing current answers before verifying.)
- **Same name:** the date of birth separates players with the same name automatically; only same name plus same birthday needs a pick screen. Twins have different first names, so they are separated by name. The unresolvable case (same full name and birthday) is left to managers, who can give those players shirt numbers.
- **Lockout:** 5 wrong tries and 15 minutes are accepted.
- **Token lifetime:** about 30 minutes is accepted.
- **Remembered players (device only):** after a successful save the device remembers the player automatically (names only, never the date of birth or the token), kept per club, at most 10 players, expiring after about a year of not being used, with a visible "Not your device? Forget" link on the Saved screen and a remove on each chip. The server never trusts it. (Automatic remembering is the assumed default; the user was asked automatic or tick-box and had not answered yet.)
- **Manager view:** a "via link" marker on the Responses pages is enough for now (assumed).
- **Date of birth required first:** yes. Slice 1 makes it required for new and edited players, with the missing-date report, before the form depends on it.

## Open Questions

- **Remember automatically or with a tick-box:** see Decisions (automatic is assumed until the user says otherwise).

## Rollout Notes

Slices, each shippable: (1) date of birth required for new and edited players, plus the missing-date report, so the data is ready; (2) backend: header-only poll endpoints, verify, answers get and put, attempts table, source column, and removal of the old list-everyone endpoints together with the frontend that uses them (they must change in the same release); (3) the new public pages for both poll types and the remembered-players shortcut. Slice 2 and 3 ship together because the old pages cannot work against the new endpoints. Spec before code: this needs the open questions answered, then `/plan-feature`.
