# 113: Registered Players on a Result Must Belong to the Team's Section and Meet the League's Age Rule

**Depends on:** `101-match-results-our-side-scorecard.md` (result players, the Teams step, `ScorecardRules`), `104-match-results-import-adaptors.md` (import candidates), `110-league-age-cutoff-day-and-month.md` (`LeagueAgeReference`, `SelectionEligibility.ageProblems`), `035-section-scoped-access.md` (players belong to sections; a section includes its descendants).
**Status:** approved by the user 2026-10-17 ("I was able to add players from other sections in the club. It should not be allowed" and "yes, add the server rule too").

## Problem & Goals

In the capture wizard the Add player dialog's Club tab listed every player in the club, and nothing on the server stopped a registered player from another section, or one too old for the league, being added to a team's scorecard. Today the server only **warns** (`PLAYER_NOT_IN_SQUAD`).

Goals:

- A registered player can only be on one of **our** sides of a result when they **belong to the section of that side's team** (or one of its descendant sections) **and**, when the match is in a league with an age rule, **meet that rule** on the league's reference date.
- The rule is enforced on the **server** (saves are refused, the Review step reports it, publishing is blocked), and the screens only offer eligible players.

## Non-goals

- Guests (no registered player) and the opposition: never checked.
- Players already on a stored or published result: existing data is not changed; a draft that already holds a violation can still be edited (only **newly added** players are refused on save), and Review reports every violation so it must be fixed before publishing. A published result is never touched.
- Squad membership (`PLAYER_NOT_IN_SQUAD` stays a warning: a squad is season-scoped and optional).
- An override for exceptions: a player outside the rule is added as a **guest** instead.
- Changing the age rule itself (`110`).

## User Stories

- As a club manager, I only see players of the right section (and age) when I add or link a player, so that I cannot pick the wrong one.
- As a club manager, if a wrong player gets in some other way (an old draft, an import, a direct call), saving or publishing is refused with a clear message naming the player and the reason.
- As a club manager, an import never links a player of another section or outside the age rule: such a name becomes a guest for me to resolve.

## Data Model Changes

None. No migration.

## API Contract

Additive: two new error codes only, no new endpoint.

- **`PLAYER_NOT_IN_SECTION`** and **`PLAYER_AGE_INELIGIBLE`** (issue codes, severity ERROR, step TEAMS, with the side): "<Name> is not in the <Section name> section." and the existing age message from `SelectionEligibility` ("<Name> is 12, below this league's minAge of 14 as at 1 Sep 2026", or "no recorded date of birth; required for this league's age rule").
- **Save-time refusal:** `POST/PUT` of a scorecard (the wizard's save, `replace`) and the import's `replaceImported`, and linking a guest to a registered player (`linkResultPlayer`), reject with 400 (the existing `InvalidResultException` with these issues) when a **newly added** registered player of one of our sides fails either check. Players already stored on the result are not re-checked at save.
- **Validation and publish:** the validate endpoint and publish report **every** registered player of our sides who fails either check as an ERROR (so Review lists them and publishing is blocked).
- `openapi.yaml`: the two codes are documented on the validation issue code description and on the 400 responses.

## The rule (one place)

A new class `ResultPlayerEligibility` (in `service/support`) decides, for a match and a set of registered player ids per our side:

1. **Section:** the side's team's `sectionId`; the allowed sections are that section and all its descendants; the player must have a `PlayerSection` row in one of them.
2. **Age:** when the match has a league with `minAge` or `maxAge`, `SelectionEligibility.ageProblems` (spec 110's reference date) must report no problem for the player (this includes "no date of birth").
3. Matches with no league skip the age check; a side whose team has no section is not checked (should not occur); guests and opposition are never checked.

It is the single source for the save check, the validation issues and the import candidate filter, and uses batch queries (one for memberships, one for the age problems), never a query per player.

## Imports

`ImportCandidateLoader` keeps only candidates that pass `ResultPlayerEligibility`, so a name that would match an ineligible squad member resolves as a guest/unresolved (with the usual note) instead of linking, and the import still creates its draft. Remembered aliases that point at an ineligible player are ignored the same way.

## UI Requirements

The Club tab of the player picker already shows only players of the team's section who meet the age rule (done in the same release as this spec: `PlayerSlotPicker` `clubScope`). The Teams step and Review show the two new codes as errors with the player's name and a plain reason. The server's 400 message is shown where a save fails (existing error display).

## Test Plan

- **Unit** (`ResultPlayerEligibility`): in the section, in a descendant, in a parent only (refused), in another section, two sections one matching, no section rows; age rule on, age off, no date of birth, a player who passes section but fails age; a league-less match; batch query count.
- **Service:** `replace` refuses a newly added violating player and accepts the same player when already stored; `replaceImported` and `linkResultPlayer` the same; guests and opposition never checked; validation and publish report violations as errors.
- **Import:** a squad member of another section or too old resolves as a guest with a note; an eligible one still links; an alias pointing at an ineligible player is ignored.
- **Integration** (Testcontainers): the wizard save path, the import path and the link path against real data; existing result tests updated for the fixtures.
- **Frontend:** Review shows the new errors; save errors display the server message.

## Acceptance Criteria

- [ ] A registered player outside the team's section (or its descendants) cannot be added to a result, and the message says why.
- [ ] A registered player outside the league's age rule (or without a date of birth when the rule applies) cannot be added.
- [ ] Existing drafts with violations can still be edited, Review lists the violations as errors, and publishing is blocked until fixed. Published results are untouched.
- [ ] An import never links an ineligible player; the name becomes a guest.
- [ ] Guests and the opposition are never checked; no new library.

## Rollout Notes

- Existing result fixtures and tests that add registered players without section membership or a date of birth need updating (a helper to create an eligible player is part of the work).
- Docs to update when built: `docs/roadmap.md`, `docs/standards/backend.md` (the rule lives in `ResultPlayerEligibility`), a pointer in `101`'s Rollout Notes.
