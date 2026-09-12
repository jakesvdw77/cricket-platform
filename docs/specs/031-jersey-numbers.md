# 031 — Player Jersey Numbers: Standing & Per-Team-Squad

**Depends on:** `028-players.md` (`Person`/`PlayerProfile`, `PlayerDto`, `PlayerServiceImpl` create/update-writes-through-to-`Person` pattern — this spec amends `PlayerProfile`/`PlayerDto`, not `Person`), `029-league-management.md` (`TeamSquadMember`, `TeamSquadService`/`TeamSquadController`, `Season`-scoping — this spec amends `TeamSquadMember` and, explicitly, reverses one piece of `029`'s own stated design; see Problem & Goals), `030-team-sheet-communication.md` (the team-sheet PDF generator and its documented "no shirt number" gap — this spec closes that gap; **see the note at the end of this section**).
**Status:** draft.

> **Note on `030`, resolved before this spec's review.** This spec was drafted while `docs/specs/030-team-sheet-communication.md` (and its `teamSheetPdf.ts`/`TeamSheetSide`/`MatchList.tsx` PDF-export code) was still on an unmerged branch — every reference to it below was written as a forward dependency at the time. `030` has since merged to `master` in full (spec, plan, and code), so those references are now directly verifiable against real files, not forward-looking. No change to this spec's content was needed as a result — the descriptions below already matched what shipped.

## Problem & Goals

`028` gave a player a name, contact info, and cricket-specific info, but no jersey number at all. `029` gave a `Team` a season-scoped squad (`TeamSquadMember`) and a match's playing XI (`MatchSidePlayer`), but neither carries a jersey number either — `029`'s own Rollout Notes for `030` (see above) names this explicitly: a team sheet PDF today "simply omits shirt numbers" because nowhere in the schema is there one to print. This spec adds jersey numbers in the two places a cricket club actually thinks about them: a player's own usual/standing number, and the number they're actually wearing for a specific team's specific season — which are not always the same thing (a player might have a usual "7" but wear "23" for the seconds because a teammate already has "7" that season).

**Goals**
- A club admin can record a player's standing jersey number on their `PlayerProfile` — the number the club thinks of as "their" number, independent of any specific team or season.
- When a player is added to a `Team`'s season squad, that squad membership gets its own jersey number, defaulting from the player's standing number at add-time but stored and editable independently from then on.
- A club admin can correct or change a squad member's jersey number at any time after they've been added, not just at add-time — inline, from the Squad tab they already use to manage that team's roster.
- Two players on the same team's same season squad can never be assigned the same jersey number — enforced server-side.
- The team sheet PDF (`030`) prints each player's actual per-team-squad jersey number next to their name, closing the gap `030` shipped with.

## Non-goals

- **No historical/audit trail of jersey number changes.** Only the current value is stored, on both `PlayerProfile` and `TeamSquadMember` — the same posture as every other mutable field in this codebase (e.g. `PlayerProfile.clubMembershipNumber`, `Team.name`). If "who wore number 7 in 2023" ever becomes a real ask, that's a new, explicit history/audit feature, not assumed here.
- **No jersey-number-based search or filter UI**, anywhere — not on the Players list, not on a team's Squad tab, not on any match screen. This spec is display and data-entry only; `028`'s "search by name" on `PlayerList` and `029`'s existing squad/XI pickers are unchanged.
- **No range validation beyond "a non-negative integer."** No cricket-specific numbering convention (e.g. "1–99," "no 0") is enforced on either `PlayerProfile.jerseyNumber` or `TeamSquadMember.jerseyNumber` — matching this codebase's existing precedent of leaving this kind of business-specific bound undeclared unless a real constraint was named (`029`'s own `CreateLeagueRequest` Javadoc confirms even `minAge`/`maxAge` carry no `@Min`/`@Max` annotation, validated only for `minAge <= maxAge` in the service layer, not against an absolute bound). A negative number is rejected (`ValidationException`, `400`); there is no enforced upper bound.
- **No uniqueness constraint on `PlayerProfile.jerseyNumber` (the standing number).** Two different players at the same club can share the same "usual" number — it's a personal preference/history marker, not an allocation. Uniqueness is enforced only on `TeamSquadMember.jerseyNumber`, scoped to `(team_id, season_id)` — see Data Model Changes.
- **No change to `MatchSidePlayer` (029).** A `Match`'s playing XI still carries no jersey-number column of its own — a `MatchSidePlayer`'s printed number is resolved by joining back to that side's `team_id`'s `TeamSquadMember` row for the match's own `season_id`, reusing the exact join `029`'s `PlayerNotInSquadException` validation already performs (see Data Model Changes). Adding a third copy of the number onto `MatchSidePlayer` itself would let it drift from the squad's own value with no way to tell which is authoritative — not built here.
- **No retroactive rewrite of an existing `TeamSquadMember.jerseyNumber` when `PlayerProfile.jerseyNumber` changes later.** The default-from-standing-number behaviour only ever fires once, at add-time. Changing a player's standing number afterward never touches any `TeamSquadMember` row already created, past or present, per this spec's confirmed two-number model.
- **No bulk/CSV assignment of jersey numbers.** Set one at a time, via the existing Basic Info tab (standing number) or the existing Squad tab (per-squad number) — matching `028`/`029`'s identical "one at a time through the form" cut.

## User Stories

- As a club admin, I can set a player's standing jersey number on their profile (Basic Info tab), leaving it blank if they don't have one yet.
- As a club admin, when I add a player to a team's season squad, their jersey number defaults to their standing number automatically, but I can immediately override it before or after saving.
- As a club admin, I can later edit a squad member's jersey number inline from the team's Squad tab, without re-adding them to the squad.
- As a club admin, I'm blocked (with a clear error) from setting two different players on the same team's same season squad to the same jersey number.
- As a club admin, changing a player's standing jersey number later does not silently change any jersey number they're already assigned on an existing team squad.
- As a club admin viewing a generated team sheet PDF (`030`), I see each player's actual squad number for that team printed next to their name.

## Data Model Changes

**`PlayerProfile` (`028`) gains one field** — the standing/default number, club-scoped like every other field on this entity, no uniqueness constraint:

```
PlayerProfile {
    ...                    -- unchanged, see 028-players.md
    integer  jersey_number -- new, nullable — the player's own "usual" number; no uniqueness
                            -- constraint (see Non-goals) — two players at the same club may share one
}
```

**`TeamSquadMember` (`029`) gains one field** — the per-team-squad number, independently stored from the moment a player is added, and independently editable from then on:

```
TeamSquadMember {
    ...                    -- unchanged, see 029-league-management.md: team_id, season_id,
                            -- player_profile_id, created_at, created_by
    integer  jersey_number -- new, nullable — defaults from PlayerProfile.jerseyNumber at add-time
                            -- (a plain copy, not a live reference — see below), independently
                            -- editable afterward. UNIQUE with (team_id, season_id) — see below.
}
```

**Uniqueness — `TeamSquadMember`, not `PlayerProfile`.** A partial unique index on `(team_id, season_id, jersey_number)` where `jersey_number IS NOT NULL` (Postgres unique indexes already treat `NULL` as distinct from any other value, so any number of squad rows can leave the number unset without colliding — same technique `028`'s `ux_person_email_lower` already relies on for `Person.email`). Enforced at the service layer first for a clean `409`, with the index as the real backstop — the same "DB constraint + pre-check for a clean message" pattern `021`'s `ux_club_contact_primary` and `028`'s `ClubMembership` reactivation check both already established.

**Default-at-add-time, not a live reference.** When `TeamSquadService.add(...)` creates a new `TeamSquadMember` row, `jerseyNumber` is initialized by copying `PlayerProfile.jerseyNumber`'s current value (which may itself be `null`) into the new row. From that point on the two fields are completely independent — editing `TeamSquadMember.jerseyNumber` never writes back to `PlayerProfile`, and editing `PlayerProfile.jerseyNumber` later never touches any existing `TeamSquadMember` row, exactly per this spec's confirmed two-number model.

**A `MatchSidePlayer`'s printed jersey number is resolved by join, not stored a third time.** Given a `MatchSidePlayer` row, its number is `TeamSquadMember.jerseyNumber` for `(match_side.team_id, match.season_id, match_side_player.player_profile_id)` — the identical `(team_id, season_id, player_profile_id)` lookup `029`'s `MatchSideServiceImpl` already performs to validate `PlayerNotInSquadException`, reused here for display rather than re-implemented. No new column on `match_side_player`.

**Migration** (next sequential file after `029`'s `021-add-league-management.sql`):

```sql
-- backend/src/main/resources/db/changelog/v1/022-add-jersey-numbers.sql

ALTER TABLE player_profile
    ADD COLUMN jersey_number INTEGER;

ALTER TABLE team_squad_member
    ADD COLUMN jersey_number INTEGER;

CREATE UNIQUE INDEX ux_team_squad_member_jersey_number
    ON team_squad_member (team_id, season_id, jersey_number)
    WHERE jersey_number IS NOT NULL;
```

A `ck_..._non_negative` `CHECK` constraint is deliberately not added at the DB level for either column — the "non-negative integer" rule (Non-goals) is enforced once, in the service layer (`ValidationException`, `400`), matching `029`'s own choice not to encode `minAge <= maxAge` as a DB `CHECK` either (see `CreateLeagueRequest`'s Javadoc) — service-layer validation is this codebase's established place for a business rule that isn't also a structural invariant the database itself needs to protect.

## API Contract

**Architectural note — `TeamSquadMember` gains its first-ever update endpoint, reversing one specific piece of `029`'s own stated design.** `029`'s Non-goals explicitly named `TeamSquadMember` (alongside `LeagueAffiliation`) as "unlink-only... a join row carries no independent business meaning," which is why `029` built only `add`/`remove`, no `update`. A jersey number is exactly the kind of independent business meaning that Non-goal was written before this feature existed to anticipate — once a join row carries its own mutable, independently-editable attribute, "unlink-only" no longer accurately describes it, and this spec adds a real update endpoint rather than forcing an admin to remove-then-re-add a squad member just to fix a typo'd number (which would also needlessly risk tripping the uniqueness check against the very state being corrected). This is a deliberate, documented reversal of that one specific piece of `029`'s design, not an oversight — `029`'s own `LeagueAffiliation` stays exactly as unlink-only as it always was; nothing about affiliations changes here.

**Route shape, chosen to match an existing precedent already in this exact feature area.** `029` itself already made an almost-identical move once without calling it out: `MatchSidePlayer` — also originally framed as a bare join — got a `PUT /api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players/{playerProfileId}` endpoint (`MatchSideController.updatePlayerRole`) to let its own one mutable attribute, `role`, be edited after the fact, without an action-word suffix — a plain `PUT` straight to the join row's own resource path. This spec's new endpoint mirrors that shape exactly, appended onto `029`'s existing squad path:

| Endpoint | Access | Purpose |
|---|---|---|
| `PUT /api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}` | `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")` | Updates that squad member's `jerseyNumber` only — nothing else about the row is editable (mirrors `updatePlayerRole`'s "updates the one mutable field, nothing else" shape). Body: `{jerseyNumber: Integer \| null}`. `404` if `teamId`/`seasonId` isn't real or doesn't belong to `clubId`, or if the player isn't currently in that season's squad (same `NotFoundException` `029`'s own `remove` already throws for "not currently in that season's squad"); `400` (`ValidationException`) if `jerseyNumber` is negative; `409` (new `DuplicateSquadJerseyNumberException extends ConflictException`) if another player is already assigned that number on this team's squad for this season |

**Existing endpoints, amended:**

| Endpoint | Change |
|---|---|
| `POST /api/v1/manage/clubs/{clubId}/players` / `PUT .../players/{playerId}` (`028`) | `CreatePlayerRequest`/`UpdatePlayerRequest` gain `jerseyNumber: Integer` (nullable); `PlayerDto` gains `jerseyNumber` in its response. No uniqueness check (Non-goals) — only the negative-number `400` applies |
| `POST .../teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add` (`029`) | Response changes from `PlayerDto` to the new `TeamSquadMemberDto` (see below) — the newly-created row's `jerseyNumber` is pre-populated from the player's current `PlayerProfile.jerseyNumber` (may be `null`). Still `409` if already in that season's squad (unchanged); the default-copy happens silently, it is never itself a source of a `409` even if the copied value happens to collide with another squad member's number — a collision here is a pre-existing data state (two players who already share a standing number are both added, one bringing that number over as its squad default) and is corrected via this spec's new `PUT`, not rejected at add-time, to avoid surprising an admin who did nothing wrong with a `409` on a plain "add to squad" click |
| `GET .../teams/{teamId}/seasons/{seasonId}/squad` (`029`) | Response changes from `PlayerDto[]` to `TeamSquadMemberDto[]` — see the dedicated note below for exactly what this DTO shape is and why |

**The `TeamSquadMemberDto` shape — a real breaking change to `listSquad`'s existing return type, decided and traced in full.** Before this spec, `GET .../squad` returned `PlayerDto[]` directly — there was no squad-membership-specific DTO at all, since a `TeamSquadMember` carried no data of its own worth exposing. That's no longer true. Two shapes were weighed:

1. A nested wrapper, `{player: PlayerDto, jerseyNumber: Integer}` — keeps `PlayerDto` itself clean of any per-team-context field, but forces every current consumer to rewrite every `player.firstName` access to `player.player.firstName`, and doesn't match this codebase's own established precedent for "a club admin never thinks of this as two records" composition (`PlayerDto` itself, `028`'s own Architecture note, is a flat composition of `Person` + `PlayerProfile` for exactly this reason).
2. **A flat `TeamSquadMemberDto`, chosen** — every field `PlayerDto` already carries (including `PlayerDto.jerseyNumber`, the player's *standing* number, left in place for context/comparison — e.g. so a UI could someday flag "this player's squad number differs from their usual one" without a second fetch) **plus one new, distinctly-named field, `squadJerseyNumber: Integer`** (nullable) — the per-team-squad number this spec adds. The two numbers are deliberately never given the same field name on this one DTO, specifically to avoid the ambiguity of two same-named `jerseyNumber` fields meaning different things on the same object. `TeamSquadMemberDto.id` is the `TeamSquadMember` row's own id (needed by the new `PUT` above, and by any future per-row action), not the `PlayerProfile.id` — callers needing the player's id use the already-present `personId`/player-identity fields carried over from `PlayerDto`, same as today.

```java
public record TeamSquadMemberDto(
        UUID id,                    // the TeamSquadMember row's own id
        UUID playerProfileId,
        UUID personId,
        UUID clubId,
        String firstName,
        String lastName,
        LocalDate dateOfBirth,
        Gender gender,
        String photoUrl,
        String clubMembershipNumber,
        String medicalAidProvider,
        String medicalAidMemberNumber,
        String phone,
        String email,
        String altContactName,
        String altContactPhone,
        BattingStance battingStance,
        BowlingArm bowlingArm,
        BowlingType bowlingType,
        boolean isWicketKeeper,
        boolean active,
        List<UUID> sectionIds,
        Integer jerseyNumber,        // the player's standing number (PlayerProfile.jerseyNumber)
        Integer squadJerseyNumber) { // this squad membership's own number (TeamSquadMember.jerseyNumber)
}
```

Chosen over overloading `PlayerDto` itself with `squadJerseyNumber` because that field has no meaning outside a specific team+season context — `PlayerDto` (returned by `028`'s player CRUD endpoints, where there is no team/season in scope at all) stays exactly as it was plus its own new standing `jerseyNumber` field only.

**Every current consumer of `listSquad`'s old `Player[]` shape, identified and updated by this spec:**

| Consumer | Change needed |
|---|---|
| `ui/src/pages/manage/TeamFormPage.tsx` (Squad tab, `SquadPlayerCard`) | Typed against `TeamSquadMemberDto`/`SquadMember` instead of `Player`; gains the new inline jersey-number edit (see UI Requirements) |
| `ui/src/pages/manage/MatchFormPage.tsx` (`MatchSideTab`) | `squadQuery` now resolves `SquadMember[]`, passed through to `PlayingXiBuilder` unchanged in shape (prop renamed/retyped, not restructured) |
| `ui/src/components/PlayingXiBuilder/PlayingXiBuilder.tsx` | `squad: Player[]` prop becomes `squad: SquadMember[]`; every place that resolves a name via `squadById.get(...)` now also has `squadJerseyNumber` available and displays it (see UI Requirements) — a real, in-scope display improvement, not just a type-only change, since Non-goals explicitly allows display (only search/filter is excluded) |
| `ui/src/pages/manage/MatchList.tsx` (`MatchCard`) | Consumes `listSquad` to assemble `TeamSheetSide[]` for `030`'s team-sheet PDF — see the dedicated `030` closure note in Rollout Notes |

**`ui/src/api/teamSquadApi.ts`** — `listSquad`/`addToSquad` return types both become `TeamSquadMemberDto`-shaped (frontend type: `SquadMember`, see UI Requirements); a new `updateSquadJerseyNumber(clubId, teamId, seasonId, playerId, jerseyNumber)` wraps the new `PUT`.

## UI Requirements

Composes entirely from existing primitives — no new shared component. `RecordCard`'s `fields` prop already accepts a `ReactNode` per field (`RecordCardField.value: ReactNode`, `ui/src/components/RecordCard/RecordCard.tsx`), which is reused directly for the inline edit rather than adding a new prop to `RecordCard` itself, per `docs/standards/frontend.md`'s "extend before you invent" rule.

- **`ui/src/components/PlayerForm/PlayerForm.tsx`** — Basic Info tab gains a "Jersey number" numeric `Input`, placed alongside the existing "Club membership number" field, optional, left blank by default — same tab, same styling, no new tab.
- **`ui/src/pages/manage/TeamFormPage.tsx`'s `SquadPlayerCard`** — gains an inline-editable jersey number, rendered as one of `RecordCard`'s existing `fields` (label "Squad #"), whose `value` is a small numeric `Input` (not a separate submit button — commits on blur or Enter, matching the low-friction inline-edit feel of `PlayingXiBuilder`'s own per-row role `Select`, which also commits immediately with no separate save step) wired to the new `updateSquadJerseyNumber` mutation, scoped per-card exactly like `SquadPlayerCard`'s existing `remove` mutation (its own isolated `useMutation`, so one card's pending/error state never leaks onto a sibling's). A `409` from the server (another player already holds that number this season) surfaces as an inline `RecordCardFeedback`-style error message on that card (`RecordCard` already supports this via its existing `feedback` prop), not a page-level toast.
- **`ui/src/components/PlayingXiBuilder/PlayingXiBuilder.tsx`** — every place a squad member's name is currently rendered (`fullName(player)`, in the ordered XI list, the "Add player" `Autocomplete`, and the Captain/Wicketkeeper/Twelfth Man `Select`s) is prefixed with that player's `squadJerseyNumber` when set, e.g. `"#7 J. Smith"` falling back to plain `"J. Smith"` when the squad member has no number assigned — a small, self-contained formatting helper (e.g. `squadDisplayName(member: SquadMember)`), not a new component. This is display only, matching this spec's Non-goals — no new sort/filter-by-number control is added to the Autocomplete or anywhere else in this component.
- **`ui/src/api/teamSquadApi.ts`** — `SquadMember` type (`Player` plus `id: string` for the `TeamSquadMember` row and `squadJerseyNumber: number | null`), new `updateSquadJerseyNumber` wrapper, `listSquad`/`addToSquad` retyped to return `SquadMember`/`SquadMember[]`.
- **`ui/src/api/playerApi.ts`** — `Player`/`PlayerPayload` both gain `jerseyNumber: number | null`.
- **`ui/src/utils/teamSheetPdf.ts`** (`030`) — its `resolveRoster` function prints each `TeamSheetSide` player's `squadJerseyNumber` next to their name, sourced from the same `listSquad` call `030`'s `MatchCard` already makes to assemble a side's roster — no second network call, just consuming the field this spec's `TeamSquadMemberDto` now provides where `030` previously had nothing to print.

**No Claude Design pass needed** — every change here is either a plain numeric `Input` in an already-styled form/card, or a text-formatting change inside an existing component; nothing introduces a new visual pattern.

**Mobile-first**, matching every prior `/manage` screen — the inline jersey-number `Input` on `SquadPlayerCard` stays a compact, fixed-width field that doesn't force the card's existing field row to wrap awkwardly at 375px, mirroring the width discipline `PlayingXiBuilder`'s own per-row role `Select` (`sx={{ width: 160, flex: 'none' }}`) already establishes for a small inline control inside a flex row.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `PlayerServiceImplTest` extended — create/update persist `jerseyNumber` (including `null`), negative value rejected (`400`), no uniqueness check applied; `TeamSquadServiceImplTest` extended — `add` copies the current `PlayerProfile.jerseyNumber` into the new row's `jerseyNumber` at creation time and never again; a new `update` (jersey-number-only) test group: happy path, `404` for a player not currently in that season's squad, `400` for a negative number, `409` (`DuplicateSquadJerseyNumberException`) when another squad member already holds that number for the same `(team_id, season_id)`, and confirms editing one squad member's number never touches `PlayerProfile.jerseyNumber` or any other season's `TeamSquadMember` row for the same player |
| Integration | `PlayerProfileRepositoryTest`/`TeamSquadMemberRepositoryTest` (Testcontainers) — migration `022-add-jersey-numbers.sql` applies cleanly against existing `028`/`029` tables; `ux_team_squad_member_jersey_number` rejects a duplicate `(team_id, season_id, jersey_number)` at the DB level but allows any number of `NULL` rows for the same team/season; `PlayerControllerIntegrationTest`/`TeamSquadControllerIntegrationTest` extended — real HTTP round-trip for `jerseyNumber` on player create/update, the new `PUT .../squad/{playerId}` endpoint's `200`/`400`/`404`/`409` cases, cross-club `404` isolation for the new endpoint (same posture as every existing squad endpoint) |
| Contract | `PlayerDto`/`CreatePlayerRequest`/`UpdatePlayerRequest`'s new `jerseyNumber` field, the new `TeamSquadMemberDto` response shape (replacing `PlayerDto` on `GET`/`POST .../squad/{playerId}/add`), and the new `PUT .../squad/{playerId}` endpoint all documented in the checked-in OpenAPI schema |
| Component | `PlayerForm.test.tsx` extended — the new Jersey number field renders/validates and round-trips through `initialValues`; `TeamFormPage.test.tsx` extended — `SquadPlayerCard`'s inline jersey-number edit commits on blur, surfaces a `409` as inline card feedback, and doesn't affect the card's existing remove action; `PlayingXiBuilder.test.tsx` extended — a squad member's `squadJerseyNumber` renders next to their name in the ordered list, the Autocomplete, and all three Captain/Wicketkeeper/Twelfth-Man `Select`s, falling back to plain name when unset |
| End-to-end | Extends `029`'s existing golden path rather than a new standalone one: after adding a player to a team's squad (jersey number defaults from their standing number), edit that squad member's number inline from the Squad tab, attempt to set a second squad member to the same number (blocked, `409` surfaced inline), reload and confirm the change persisted and the player's own standing number on their Players-list profile is unaffected. Not wired into CI, same precedent as every prior `/manage` spec |

## Acceptance Criteria

- A club admin can set, clear, and edit a player's standing jersey number from the Players screen, with no uniqueness enforced against it.
- Adding a player to a team's season squad copies their current standing number into that squad membership as a one-time default; the two values are independent from that point on.
- A club admin can edit a squad member's jersey number at any time from the team's Squad tab, inline, without removing and re-adding them.
- A club admin is blocked, with a clear `409`, from assigning a jersey number to a squad member that another player already holds on that same team's squad for that same season.
- Changing a player's standing number after they've already been added to one or more team squads never changes any of those existing squad numbers.
- The `PlayingXiBuilder` (squad selection, playing-XI builder, captain/keeper/twelfth-man pickers) displays each squad member's jersey number next to their name wherever their name already appears.
- Every prior consumer of `listSquad`'s old `Player[]` return shape (`TeamFormPage`'s Squad tab, `MatchFormPage`'s `MatchSideTab`, `PlayingXiBuilder`) works correctly against the new `TeamSquadMemberDto`/`SquadMember` shape.
- A club admin for club X gets `403`/`404` attempting the new `PUT .../squad/{playerId}` endpoint against club Y's `teamId`/`seasonId`.

## Rollout Notes

- **This spec reverses one specific piece of `029`'s stated design** — `TeamSquadMember` is no longer unlink-only; it now has a real, independently mutable attribute and its first-ever update endpoint. `029`'s own Non-goals entry naming it as unlink-only should be read as superseded by this spec for `TeamSquadMember` specifically — `LeagueAffiliation`, the other join `029` named in that same sentence, is completely unaffected and stays unlink-only.
- **A real, direct follow-on to `030`, folded into this spec rather than deferred to a later one.** `030`'s own documented gap — "neither `Player` (`028`) nor `MatchSidePlayer` (`029`) has a shirt-number field... the PDF simply omits shirt numbers" — is closed by this spec: the team sheet PDF now prints each side's players with their actual per-team-squad number (`TeamSquadMemberDto.squadJerseyNumber`), resolved via the same `listSquad` call `030` already makes, not a new endpoint. **A human should give `docs/specs/030-team-sheet-communication.md` a small follow-up edit once this ships** — updating that spec's own Non-goals/API Contract sections to remove the now-resolved "PDF omits shirt numbers" limitation — not done as part of this spec's own file changes (spec-authoring convention: a spec documents its own intent to close another spec's gap, the actual editing of that other spec's file happens once the work ships, per this project's own precedent of specs referencing and later updating each other's Rollout Notes).
- **`030` is merged to `master`** (resolved since this spec was drafted — see the note under Depends on) — the teamsheet-PDF-rendering piece of this spec's UI Requirements is unblocked and can ship in the same PR as the rest of this spec's work, not deferred.
- **Why `TeamSquadMemberDto` keeps the player's standing `jerseyNumber` field alongside the new `squadJerseyNumber`, rather than dropping it**: no functional requirement needs both today (Non-goals rules out any UI diffing the two), but keeping both costs nothing (it's already part of the underlying `PlayerDto` shape this DTO is otherwise identical to) and avoids a future spec needing to widen this DTO again the next time someone wants to show "this differs from their usual number" — a plausible near-future ask given this spec's own two-number model, flagged here rather than silently designed around.
- Ships as its own PR, on top of `028`'s already-built `PlayerProfile`/`PlayerDto` and `029`'s already-built `TeamSquadMember`/`TeamSquadService`/`PlayingXiBuilder`.
- A human should update `docs/roadmap.md` once this ships — `030`'s own gap-closure note (once `030` itself is indexed there) should point at this spec as the resolution, and this spec's own two Non-goals items with real forward-reference potential (jersey-number history/audit; the "differs from their usual number" UI idea above) should be added as new, explicitly open items rather than re-derived from scratch later.
