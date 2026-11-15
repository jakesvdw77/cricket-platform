# 152: Club Time Zone (every time is read in the right zone)

**Depends on:** `001-tenancy-identity-model.md` (the club), `037-match-improvements.md` (the one server-clock helper), `097-import-framework.md` (R11, imports read the browser zone), `151-server-test-round-one.md` slice H (the stopgap this replaces).
**Status:** draft 2026-11-15. Not urgent: every club is in South Africa today. Requested by the owner after slice H fixed the live server with a server-wide `TZ`, which they called a hack. The proper design is one zone per club, set once, used as the default for every new match, changeable per match, and always applied when a time is shown.

## Problem & Goals

**Problem.** The system stores match times as instants (correct) but reads the time of day in whatever zone the code happens to run in. The server uses `ZoneId.systemDefault()` (about 35 uses; `ServerClock`, `MatchSlots`, the schedule import, availability, reopen windows, the clash check, emails), the manager screens use the browser's zone, and the Player Hub mixes both. A server in UTC showed every Hub time two hours early (2026-11-14); slice H pinned the server to `Africa/Johannesburg`, which is only right while every club is South African, and wrong for a club in Namibia, Zimbabwe or abroad, and for a visitor reading a South African club's match from another zone.

**Goals**
- A club has a **time zone** (an IANA id such as `Africa/Johannesburg`), set at onboarding and editable on the Club Profile.
- A match's **venue clock**: new matches default to the club's zone; the manager may change it on a match (an away tour in another zone). The match keeps the instant; the zone says how its wall-clock time is read.
- **Everyone sees the match in the match's zone** (Hub, ticker, shares, emails, exports), labelled when it differs from the viewer's own zone ("09:30 SAST"). No screen reads the server's or the browser's zone for a match time.
- The server's own zone becomes irrelevant: it runs in UTC, and no code calls `ZoneId.systemDefault()` for a business rule (an ArchUnit rule enforces it).

## Non-goals
- Automatic detection of the zone from the field's coordinates (a later suggestion only).
- A per-user display preference ("always show my local time"); the viewer's zone only appears as a second line when it differs.
- Recurring daylight-saving edge cases beyond what `java.time` and `Intl` do correctly.

## Rules
1. `club.time_zone` is required, an IANA id from a fixed list (the zones offered in the picker; South Africa first). Existing clubs migrate to `Africa/Johannesburg`.
2. `match.time_zone` is nullable; null means "the club's zone". A new match is created with the club's zone filled in and shown in the form (**Time Zone**, a compact select beside the time; collapsed to a small "SAST" label until opened, so the common case stays one field).
3. A match's date and time are entered and shown in the match's zone. The stored instant is `local date + local time + zone`. Changing the zone on an existing match keeps the **wall-clock time** the manager sees and moves the instant (with a confirm line: "Start moves to 09:30 Windhoek time"), unless they choose "keep the same moment".
4. Day boundaries ("today", "next 7 days", availability rounds, reopen windows) use the **club's zone**, never the server's.
5. The schedule import reads the file's times in the **league's club zone** (replacing 097's browser-zone default, R11); a column or a header note may name another zone per row later.
6. The clash check and the overlap rules compare instants, and name times in the match's zone.
7. Texts, emails and shares print the time with the zone abbreviation when the zone is not the viewer's club zone; the club's own matches print plainly.

## Data Model Changes
Migration `069-club-time-zone.sql` (next free number, confirm at build time): `club.time_zone VARCHAR(64) NOT NULL DEFAULT 'Africa/Johannesburg'`, `match.time_zone VARCHAR(64) NULL`. No existing match changes. Entities, `ClubDto`, `MatchDto`, the create and update requests, `openapi.yaml`.

## API Contract
No new endpoint. `time_zone` travels on the club read and update, and on match create, update and read (including the Player Hub rows, which also carry the resolved zone so the UI never guesses). Invalid ids are a 400.

## UI Requirements
- Club Profile (Club Details card): **Time Zone** select. Onboarding asks it with the country.
- Match form: the small zone label described in rule 2; the shared date and time helpers (`ui/src/utils/dateTime.ts` or the existing one) take the zone as a parameter so no component formats a match time without one (a dependency-cruiser rule).
- Hub, ticker, share texts and posters: format with the match's zone; show "(SAST)" style suffix only when it differs from the viewer's browser zone.

## Test Plan
Backend: `ZoneRules` helper under a UTC default and a non-South-African default give the same results; day-boundary and clash tests for a Windhoek and a London club; import reads times in the club zone; an ArchUnit rule forbids `ZoneId.systemDefault()` outside the one clock class; migration keeps existing clubs on `Africa/Johannesburg`. Frontend: formatting table (DST change, zone differs from viewer, null zone); the match form defaults to the club's zone and moves the instant on change; the Hub shows the match zone. The slice H `TZ` setting is removed at the same time and the server runs in UTC.

## Acceptance Criteria
A South African club sees no change. A test club set to `Europe/London` creates a 09:30 match and every screen, text and email shows 09:30 (BST or GMT), and a South African viewer sees it labelled. Removing `TZ` from the deployment changes nothing.

## Rollout Notes
Replaces the stopgap in slice H of spec 151 and the "Club time zone" items in `docs/roadmap.md` (097 R11, the known-gap line). Order: the clock helper and ArchUnit rule, migration and club field, the match zone, the import, then the UI formatting sweep, then drop the `TZ` setting. Decided by the owner 2026-11-15: the zone is set **per match only**, defaulting from the club (a league has no zone of its own), because a tour is the real case.
