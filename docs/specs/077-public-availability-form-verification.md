# 077 — Public Availability Form: Light Verification

**Depends on:** 023 (availability polls), 028 (players), 064–067 (poll screens and responses)
**Status:** draft — design agreed in discussion on 2026-10-04, not yet reviewed against the current public form code. Read how the existing public availability form works before planning.

## Problem & Goals

Managers send one public availability link to the whole WhatsApp group each week, replacing a Google form. A form that lists everyone lets a respondent tap the wrong player by accident, and anyone with the link can answer for anyone. The platform wants some control without two-factor authentication, which needs messaging configuration and fails where a player has no email or phone on file.

Goals:
- A respondent finds one player by typing a full first name and surname, with no browsable list.
- Before an answer is saved, the respondent confirms with a birthday, email or phone number matching the player's record.
- Parents and players on the same device get remembered suggestions so the weekly routine is quick.
- Date of birth becomes a required player field, because eligibility already depends on it.

## Non-goals

- Two-factor authentication or one-time codes (rejected: configuration and management burden, and the same gap when contact details are missing).
- Strong identity. This is a deliberately light control, aimed at accidents and casual pranks; managers can always override an answer.
- Parent or guardian accounts and logins. When players and parents can log in, they will have their own way to mark availability, which sits alongside this form.
- A guardian-to-player link, one email returning all siblings. Parents of twins repeat the flow once per child.

## User Stories

- As a parent or player, I can type a player's first name and surname and, if found, set availability, so that I don't scroll a list of the whole squad.
- As a parent or player, I confirm my answer with a birthday, email or phone number on file, so that nobody is marked by accident.
- As a parent of twins, I run the flow once per child, and the form suggests both on later visits from the same device.
- As a manager, I see which answers came from the public form and can change any of them, so that a wrong answer is easy to fix.
- As a manager, I can switch off a poll's public link and send a new one, so that a leaked link can be stopped.
- As a manager, I see players missing a date of birth, email or phone, so that I can complete the records.

## Data Model Changes

None required for the core flow. Existing fields used:
- `player_profile.email`, `player_profile.phone`, `player_profile.alt_contact_phone`: free text, optional, not unique (shareable between siblings).
- `person.date_of_birth`: currently nullable (`020-add-player.sql`).

Not used for lookup: `person.email` (unique and identity-bound).

To decide in planning:
- Marking an answer as coming from the public form (a source field or marker on the response, plus a time), if not already present.
- Per-player counters for failed confirmations, and the lock window.
- A public-link token per poll that a manager can revoke and replace, if the current link does not already have one.

Date of birth becomes required in the API validation and the player forms (not a database `NOT NULL`, since existing rows are empty), with a sanity check: not in the future, not implausibly old.

## API Contract

To be defined in planning. Required behaviours:

| Behaviour | Notes |
|---|---|
| Find a player by full first name and surname | Exact match only, no prefix search and no list. Same generic "couldn't find that" for no match. Disambiguate same-name players by team or section name. Returns only the player's display name and team, never a date of birth or contact details. |
| Submit an answer with a confirmation value | Saves only if the supplied birthday, email or phone matches the record (email case-insensitive and trimmed; phone normalised, so `+27…` and a leading `0` are equal). A mismatch saves nothing and returns one generic error. |
| Resolve remembered players | Takes the opaque identifiers from the device and returns display names, silently dropping any that are no longer valid. |

Phone normalisation happens at lookup time on both sides, without changing stored data. Failed confirmations are limited per player: after a few failures, that player's public form is locked for a while. A device-level limit alone is not enough.

## UI Requirements

Flow:
1. Search: first name and surname inputs. "Your players" appears first for players remembered on this device.
2. Availability page: shows only the player's name, with the availability control.
3. Confirm step: enter a birthday, email or phone number. Wording makes clear that nothing is saved until this passes.

Remembered players:
- Stored in the browser's local storage only, as opaque player identifiers for this club, never birthdays or contact details. A device-only helper, not a security control.
- The confirm step is not skipped for a remembered player.
- Each suggestion has "Not you? Remove", and there is a "Forget this device" link.
- Per club, with an expiry of a few months refreshed on use. Every storage read and write is wrapped in try/catch, and the form works normally when storage is unavailable.

Manager side:
- Public answers are marked on the Responses page, and a manager can change them.
- A "missing details" report lists players without a date of birth, email or phone, and flags placeholder-looking birthdays (for example the same date on many players, as with the Over 40 test data).

Compose from the existing poll screens (specs 064–067, the UI gold standard) and shared components; no new component system.

## Test Plan

To be fleshed out in planning against `docs/standards/testing.md`. Must cover:
- Backend: exact-match lookup, generic errors, confirmation matching (date of birth, email case-insensitive, phone normalisation, `alt_contact_phone`), per-player lockout, same-name disambiguation, no private data in any response, date-of-birth validation on player create and update.
- Frontend: search, confirm and error states; remembered suggestions, removal and forget-this-device; storage unavailable; twins flow.
- Smoke test of the full public flow end to end.

## Acceptance Criteria

- The public form never shows a list of players and never reveals a date of birth or contact details.
- An answer is saved only after a matching birthday, email or phone is supplied.
- A failed lookup and a failed confirmation each return the same generic message regardless of the reason.
- After a few failed confirmations for one player, that player's public form is locked for a while.
- A parent can answer for two children one after another, and both show as suggestions on the same device next time.
- Clearing site data or using private browsing leaves the form fully usable, only without suggestions.
- Players cannot be created or edited without a date of birth.
- Managers can see which answers came from the public form and can override them.

## Open Questions

- Should phone be mandatory for players? Options discussed instead: prompt "add your phone for next time" after a successful answer (creating a suggestion a manager approves, never writing straight to the record), require one of phone or email, or a soft requirement with a missing-details report. No decision yet.
- Is a revocable per-poll link token wanted, and does the current link already have one?
- Lock duration and number of failed attempts before lockout.
- Whether to add a "send me my link" personal link per player later, for parents who find typing a birthday annoying.

## Rollout Notes

- Enforce required date of birth first, with the missing-details report, so the data is ready before the form relies on it. Existing players without one cannot be confirmed by birthday until fixed, but can still be confirmed by email or phone if present.
- Check local counts of players missing a date of birth, email or phone before planning, to size the cleanup.
- Spec before code: needs review and approval, then a mockup, then `/plan-feature`.
