# 058 — Auto-Select Team Captain in the Playing XI

**Depends on:** `057-team-extended-profile.md` (`TeamSquadMember.isCaptain`, the standing per-team-per-season captain flag this spec reads — not built without it), `033-availability-aware-xi-builder.md` (`PlayingXiBuilder`'s existing `availabilityByPlayerId` prop, the "Unavailable"/"Unsure" tinting this spec's own eligibility check reuses unchanged), `037-match-improvements.md` item 9 (`MatchFormPage.tsx`'s existing "copy from previous match" captain-carry-over logic — a genuinely separate mechanism from this spec's own, see Non-goals).

**Status:** approved.

## Problem & Goals

`MatchSide.captainPlayerId` already exists and is already editable — `PlayingXiBuilder`'s "Captain" `Select` — but every match starts with no captain chosen at all; an admin picks one from scratch, every single match, even though a team usually has the same standing captain match after match. `057` gives a team a real, standing captain (`TeamSquadMember.isCaptain`, season-scoped). This spec makes match-day actually benefit from that: when a fresh side's Playing XI includes the team's own squad captain, pre-select them as the match's captain automatically — unless they're marked unavailable for that specific match, in which case the admin picks one manually, exactly as today.

**Goals**
- When building a match's Playing XI for a team with a defined squad captain, that captain is pre-selected as the match's own captain the moment they're added to the XI — no manual step.
- If the squad captain is marked "Unavailable" for this match (per `033`'s existing availability data), they are never auto-selected — the captain field starts empty, exactly as it does today.
- The auto-selection is a real, saved choice (persisted via the same update path a manual selection already uses), not a UI-only default that vanishes on reload — but it never overrides a captain the admin has already explicitly chosen for this match.

## Non-goals

- **Changing "copy from previous match"'s own captain-carrying-over behavior** (`037` item 9, `MatchFormPage.tsx`'s `copyFromPreviousMatchMutation`) — that already resolves a captain from the *source match's own prior selection*, a different, already-correct mechanism this spec doesn't touch.
- **Auto-selecting a wicketkeeper or twelfth man.** Only the captain, per the explicit request this spec transcribes.
- **Preventing the admin from changing the auto-selected captain.** It's a default, not a lock — `onChangeCaptain` keeps working exactly as it does today, for any player in the XI, including overriding the auto-selection.
- **"Unsure" availability blocking auto-selection.** Only a confirmed "Unavailable" response suppresses the auto-pick — an "Unsure"/no-response captain is still auto-selected, same as any other player with that status is still freely selectable in the XI today (`033`'s own posture: `Unsure` tints, it doesn't disable).
- **Retroactively setting a captain on an already-saved match side that already has one.** Auto-selection only fires when a side's `captainPlayerId` is genuinely still `null` — never overwrites an existing choice, whether it was made manually or by this feature earlier.
- **Any backend change.** `MatchSide.captainPlayerId` and its update endpoint already exist and already work — this spec is a frontend-only default-value behavior on top of them.

## User Stories

- As a club admin, when I open a new match and add my team's usual XI, the captain is already set to my team's defined captain — I don't have to pick them again.
- As a club admin, if my team's captain is unavailable for a specific match, the captain field stays empty when I build that match's XI, so I'm prompted to choose a stand-in rather than the system silently keeping an unavailable player as captain.
- As a club admin, if I've already picked a different captain for a match (deliberately or via copy-from-previous), reopening or re-editing that match never silently resets my choice back to the squad captain.

## Data Model Changes

None — this spec is entirely frontend logic layered on `057`'s `isCaptain` flag and the already-existing `MatchSide.captainPlayerId`.

## API Contract

None — uses the existing `PUT` match-side-captain update path (`updateMatchSide`'s `captainPlayerId` field, already wired to `onChangeCaptain` in `MatchFormPage.tsx`) exactly as a manual selection already does.

## UI Requirements

**`ui/src/pages/manage/MatchFormPage.tsx`** — the page already fetches this team+season's squad (`squadQuery`, feeding `PlayingXiBuilder`'s "Add player" list) and already computes `availabilityByPlayerId` (`033`). Add a `useEffect` (per side, mirroring how `availabilityByPlayerId` itself is already derived per side) that:

1. Resolves the squad's captain: `squadQuery.data?.find((member) => member.isCaptain)` (`057`'s new field — at most one per team+season, per that spec's own DB-level guarantee, so no ambiguity to resolve).
2. Fires only when `side.captainPlayerId` is currently `null` (never touches a side that already has any captain, auto-selected earlier or chosen manually — see Non-goals) **and** the resolved squad captain is present in this side's own current XI (`side.players`, by `playerProfileId`) **and** that player's `availabilityByPlayerId` entry is not `'UNAVAILABLE'` (an `'UNSURE'` or missing entry does not block it, per Non-goals).
3. When all three hold, calls the exact same update path `onChangeCaptain` already uses (`updateSideMutation`/`updateMatchSide` with `captainPlayerId` set to the squad captain's `playerProfileId`) — a real, persisted save, not local-only UI state.

This must re-run correctly as the XI changes (a captain added to the XI after the page first loads should still trigger the auto-select at that point) and as availability data loads in (a captain who's `UNAVAILABLE` should never flash into the field even briefly while that query is still resolving — gate the effect on `availabilityByPlayerId`'s own query having settled, the same "don't act on partial data" posture `033` already established for its own tinting logic).

No change to `PlayingXiBuilder.tsx` itself — it already renders whichever `captainPlayerId` its parent hands it and already calls `onChangeCaptain` on a manual pick; this spec only changes what `MatchFormPage.tsx` does with a still-`null` value before the admin acts.

**Mobile-first**: no new UI surface, nothing to adapt.

## Test Plan

| Tier | Coverage |
|---|---|
| Component | `MatchFormPage.test.tsx` extended: adding the squad captain to a fresh side's XI auto-sets them as captain via the real update call; a squad captain marked `UNAVAILABLE` for this match is never auto-selected, and the field stays empty until the admin picks one; a side that already has a captain (manually set, or from "copy from previous match") is never overwritten by this effect; a team with no defined squad captain (`057`'s field is nullable/absent) behaves exactly as today, no auto-selection attempted; an `UNSURE` captain is still auto-selected. |
| End-to-end | Extends `033`'s existing golden path: build a fresh XI including the team's defined captain, confirm they're pre-selected as match captain; mark them unavailable via the availability poll flow, rebuild the XI, confirm the captain field is empty instead. Not wired into CI. |

## Acceptance Criteria

- Adding a team's defined squad captain to a fresh match XI (captain field currently empty) auto-selects them as the match's captain, saved for real.
- A squad captain marked Unavailable for that specific match is never auto-selected — the admin sees an empty captain field and chooses manually, exactly as before this spec.
- An already-set captain (manual or previously auto-selected) is never silently changed by this feature.
- A team with no defined squad captain behaves identically to today — no auto-selection, no error.

## Rollout Notes

- Ships as its own PR, after `057` (hard dependency on `isCaptain` existing) — frontend-only, no migration, no feature flag.
- Small, isolated change confined to `MatchFormPage.tsx`'s existing per-side effect/query wiring — `PlayingXiBuilder.tsx` itself is untouched.
- A human should update `docs/roadmap.md`'s Active table once this ships.
