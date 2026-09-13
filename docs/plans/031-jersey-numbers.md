# Plan: 031 — Player Jersey Numbers: Standing & Per-Team-Squad

## Context

`docs/specs/031-jersey-numbers.md` (already written, committed on `feature/031-jersey-numbers`) adds two related things a real club admin needs and doesn't have today: a player's own "usual" jersey number (`PlayerProfile.jerseyNumber`), and a separate, independently-editable number for each team-squad membership (`TeamSquadMember.jerseyNumber`, defaulting from the standing number only once, at add-time). This also closes a documented gap in the just-merged spec 030 — the team-sheet PDF currently omits shirt numbers because nowhere in the schema had one to print.

This is a real cross-cutting change: it gives `TeamSquadMember` its first mutable attribute and therefore its first-ever update endpoint (a deliberate, spec'd reversal of 029's "unlink-only" design for that one entity), and it changes `GET .../squad`'s response shape from bare `PlayerDto[]` to a new `TeamSquadMemberDto[]` — touching every current consumer of that call.

This plan turns the approved spec into a concrete build. It does not redefine anything the spec fixed (the two-number model, the DTO shape, the endpoint route, uniqueness scope). A few implementation-level judgment calls the spec's prose left open are called out in **Flags for your review**.

## Backend — `backend-builder`

### 1. Migration
`backend/src/main/resources/db/changelog/v1/022-add-jersey-numbers.sql` (register in `db.changelog-master.xml` after the `021` line) — exactly the spec's own SQL:
```sql
ALTER TABLE player_profile ADD COLUMN jersey_number INTEGER;
ALTER TABLE team_squad_member ADD COLUMN jersey_number INTEGER;
CREATE UNIQUE INDEX ux_team_squad_member_jersey_number
    ON team_squad_member (team_id, season_id, jersey_number)
    WHERE jersey_number IS NOT NULL;
```
No `CHECK` constraint (spec's own decision — service-layer validation only, matching 029's `minAge <= maxAge` precedent).

### 2. Entities
- `PlayerProfile.java` — add `@Column(name = "jersey_number") private Integer jerseyNumber;`, matching the existing field style exactly.
- `TeamSquadMember.java` — add the same `jerseyNumber` column. **Do not add `updatedAt`/`updatedBy`** — see Flag #1.

### 3. New exception
`exception/DuplicateSquadJerseyNumberException.java extends ConflictException` — single `String message` constructor, mirroring `DuplicateSlugException.java` exactly. The "not currently in that season's squad" 404 reuses the base `NotFoundException` directly (this codebase has no `NotFoundException` subclasses at all — don't create one here either, matching `TeamSquadServiceImpl.remove()`'s existing pattern).

### 4. DTOs
- `PlayerDto`, `CreatePlayerRequest`, `UpdatePlayerRequest` — add `Integer jerseyNumber` (nullable, no `@Min`/`@NotNull`).
- New `TeamSquadMemberDto` record — exactly the shape the spec lays out in its API Contract section (every `PlayerDto` field, plus `id` — the `TeamSquadMember` row's own id — plus `squadJerseyNumber`). Copy the spec's record declaration verbatim.
- New `UpdateTeamSquadMemberJerseyNumberRequest(Integer jerseyNumber)` — single-field record, no `@NotNull` (nullable body field), mirroring `UpdateMatchSidePlayerRequest`'s shape.

### 5. Mapping
Add a `toSquadMemberDto(Person, PlayerProfile, TeamSquadMember, List<UUID> sectionIds)` method to the existing `PlayerMapper` (not a new mapper class) — **build it by calling the existing `toDto(...)` first, then composing `TeamSquadMemberDto` from that result plus `TeamSquadMember.getId()`/`getJerseyNumber()`**, rather than re-copying all ~19 person/profile fields a second time. Keeps the field-copy logic in exactly one place, per `docs/standards/backend.md`'s "shared logic lives in one place."

### 6. `TeamSquadRepository`
Add `boolean existsByTeamIdAndSeasonIdAndJerseyNumberAndIdNot(UUID teamId, UUID seasonId, Integer jerseyNumber, UUID excludeId);` — a derived query, for the update-time uniqueness pre-check (excluding the row being updated, so re-submitting an unchanged number never self-conflicts).

### 7. `TeamSquadService` / `TeamSquadServiceImpl`
- `list`/`add` return `TeamSquadMemberDto`/`List<TeamSquadMemberDto>` instead of `PlayerDto`/`List<PlayerDto>`. `add()`'s builder gains `.jerseyNumber(profile.getJerseyNumber())` (copying the already-fetched profile's current standing number — a plain value copy, not a reference). **`add()` does not check jersey-number uniqueness** — a collision here is corrected later via `update`, never rejected at add-time (the spec is explicit about this: don't add a uniqueness check to `add()`).
- New `update(clubId, teamId, seasonId, playerId, jerseyNumber)`: find the `TeamSquadMember` row for `(teamId, seasonId, playerId)` (404 via the same message/pattern `remove()` already uses if absent), reject a negative number (`ValidationException`, 400), check `existsByTeamIdAndSeasonIdAndJerseyNumberAndIdNot(...)` for a positive (non-null) number and throw `DuplicateSquadJerseyNumberException` (409) if taken, otherwise set and save, return the mapped DTO.
- `PlayerServiceImpl.create`/`update` — add `.jerseyNumber(request.jerseyNumber())` / `profile.setJerseyNumber(...)`, plus a negative-number `ValidationException` check in both (no uniqueness check here — the spec is explicit that the standing number has none).

### 8. `TeamSquadController`
- Retype `list`/`add`'s `ResponseEntity` generics to `TeamSquadMemberDto`/`List<TeamSquadMemberDto>`.
- New endpoint, exactly mirroring `MatchSideController.updatePlayerRole`'s shape:
```java
@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
@PutMapping("/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}")
public ResponseEntity<TeamSquadMemberDto> update(
        @PathVariable UUID clubId, @PathVariable UUID teamId,
        @PathVariable UUID seasonId, @PathVariable UUID playerId,
        @Valid @RequestBody UpdateTeamSquadMemberJerseyNumberRequest request) {
    return ResponseEntity.ok(teamSquadService.update(clubId, teamId, seasonId, playerId, request.jerseyNumber()));
}
```

### 9. Tests (same PR, per `docs/standards/backend.md`)
- `PlayerServiceImplTest` extended: create/update persist `jerseyNumber` including `null`, negative rejected, no uniqueness check.
- `TeamSquadServiceImplTest` extended: `add` copies the profile's current number at creation time only; a new `update` group — happy path, 404 (not in squad), 400 (negative), 409 (duplicate), and confirms editing one row never touches `PlayerProfile` or another season's row.
- `PlayerControllerIntegrationTest` / `TeamSquadControllerIntegrationTest` extended: real HTTP round-trips for the new field and the new `PUT` (200/400/404/409, cross-club 404/403), following the existing Testcontainers/`grantClubAdmin` boilerplate already in these files.
- Regenerate `backend/openapi/openapi.yaml` (run the app, re-export `/v3/api-docs.yaml`, commit the diff) — same manual step used for every prior backend spec's schema update.

## Frontend — `frontend-builder`

### 10. Shared numeric-input helper (new, small)
Extract `numberToInput`/`inputToNumber` (string ↔ `number | null`, currently inline and unexported in `ui/src/components/SectionDetailPanel/SectionDetailPanel.tsx`) into `ui/src/utils/numberInput.ts`, and switch `SectionDetailPanel.tsx` to import it. This spec needs the identical conversion in two more places (`PlayerForm`'s new field, `SquadPlayerCard`'s inline edit) — extracting now, on the third/fourth use, is the right side of `docs/standards/backend.md`'s (and the equivalent frontend) "shared logic lives in one place, extracted before the second use" rule, not premature. See Flag #2.

### 11. API layer
- `ui/src/api/playerApi.ts` — `Player`/`PlayerPayload` gain `jerseyNumber: number | null`.
- `ui/src/api/teamSquadApi.ts` — new `SquadMember` type (`Player` plus `id: string` and `squadJerseyNumber: number | null`); `listSquad`/`addToSquad` retyped to return `SquadMember`/`Promise<SquadMember>`; new `updateSquadJerseyNumber(clubId, teamId, seasonId, playerId, jerseyNumber): Promise<SquadMember>` wrapping the new `PUT`.

### 12. `PlayerForm.tsx`
Basic Info tab — new "Jersey number" `Input` (`type="number"`) next to "Club membership number", using the new shared `numberToInput`/`inputToNumber` helpers for the string↔number-or-null round trip through `FormState`/submit payload.

### 13. `TeamFormPage.tsx` — `SquadPlayerCard`
- Retype `player: Player` → `member: SquadMember` (and the squad-tab's `squadQuery`/`alreadyInSquadIds` accordingly — `linkablePlayers`/the add dialog stay `Player[]`, unaffected).
- Add a "Squad #" entry to `RecordCard`'s existing `fields` array, whose `value` is a compact numeric `Input` (small, fixed-width, no visible label of its own since `RecordCard` already renders the "Squad #" caption) holding local draft state, committing on blur (mirroring `SectionDetailPanel`'s blur-commit pattern) via its own isolated `useMutation` calling `updateSquadJerseyNumber` — same per-card isolation `remove` already has. A `409` surfaces via `RecordCard`'s existing `feedback` prop (`{ message: '...', tone: 'error' }`); on success, invalidate the squad query (reusing the existing `invalidateSquad`/`onRemoved`-style callback already threaded through). See Flag #3 on verifying this renders acceptably.

### 14. `MatchFormPage.tsx`
`MatchSideTab`'s `squadQuery` now resolves `SquadMember[]` — passed through to `PlayingXiBuilder` unchanged in shape, no restructuring (confirmed: this file needs no logic changes, only the inferred type changes).

### 15. `PlayingXiBuilder.tsx`
- `squad: Player[]` prop → `squad: SquadMember[]`; `squadById`/`captainOptions`/`twelfthManOptions` retype accordingly.
- New local, unexported `squadDisplayName(member: SquadMember): string` — `fullName`-equivalent, prefixed with `#<squadJerseyNumber> ` when set, falling back to the plain name. Replace all 5 existing `fullName(...)` call sites (ordered XI list row, "Add player" Autocomplete's `getOptionLabel`, and the Captain/Wicketkeeper/Twelfth-Man `Select`s' `MenuItem` labels) with it.

### 16. `ui/src/utils/teamSheetPdf.ts`
- `TeamSheetSide.squad: Player[]` → `SquadMember[]`.
- `RosterEntry` gains `squadJerseyNumber: number | null`, sourced the same way `resolveRoster` already resolves `isCaptain`/`isWicketKeeper` (via `squadById.get(entry.playerProfileId)`).
- The printed row text gains a `#<N> ` prefix when set — matching `PlayingXiBuilder`'s own `#N` convention for visual consistency across the two surfaces, e.g. `#7 John Smith (C)`. Leave `resolveTwelfthMan`'s line unnumbered (spec only calls out `resolveRoster`) — see Flag #4.
- `ui/src/pages/manage/MatchList.tsx` needs **no changes at all** — its `listSquad` calls flow straight into `TeamSheetSide.squad` untouched; only the type flowing through changes.

### 17. Tests (same PR)
- `PlayerForm.test.tsx` extended — new field renders/validates/round-trips.
- `TeamFormPage.test.tsx`'s existing Squad `describe` block extended — inline edit commits on blur, a mocked 409 surfaces as card feedback, doesn't disturb the existing remove test.
- `PlayingXiBuilder.test.tsx` extended — `#N` prefix appears in the list row, Autocomplete option, and all three Selects; falls back to plain name when unset.
- `teamSheetPdf.test.ts` extended — a squad member with a number prints `#N <name>`; one without prints the plain name (no stray `#`).

## `test-writer` (after both builders)

Compare the spec's Test Plan against what actually landed, then fill gaps — expected to mainly be:
- Backend integration-tier coverage the builder didn't get to (cross-club isolation for the new `PUT`, the partial-unique-index DB-level rejection via a `TeamSquadMemberRepositoryTest`).
- The E2E extension: extend `ui/e2e/manager-league-management.spec.ts` again (same file 030 already extended) — after building a squad, edit a squad member's jersey number inline, attempt a duplicate (blocked), reload and confirm persistence, confirm the player's own standing number on the Players screen is unaffected. Not CI-wired, same precedent as every prior `/manage` spec.

## Flags for your review

1. **`TeamSquadMember` stays without `updatedAt`/`updatedBy`.** The spec's own migration SQL doesn't include audit columns for this entity's first mutable field, even though most other mutable entities in this codebase carry them. Recommendation: don't add them — stick to exactly what the approved spec's Data Model Changes section specifies. Flagging in case you'd rather add basic audit columns now while the migration's already touching this table.
2. **Extracting `numberToInput`/`inputToNumber` into a shared util, touching `SectionDetailPanel.tsx` (spec 025's file, already shipped).** Low-risk (pure extraction, same logic, one new import), but it's a file outside 031's own spec. Recommendation: do it — three near-identical inline copies of the same conversion would be a real, cheap-to-avoid duplication. Flagging since it's a small edit to already-shipped code.
3. **The inline `Input` living inside a `RecordCard` field's `value: ReactNode` slot is a UI shape this codebase hasn't used before** (every existing `fields` entry today is static text). It should work per `RecordCard`'s actual rendering code, but needs a real look in the browser (not just a component test) to confirm it doesn't look cramped inside the existing caption/value `Stack`. Flagging for extra attention at the manual-smoke-test step, not proposing a different approach.
4. **The team-sheet PDF's twelfth-man line stays unnumbered.** The spec's UI Requirements only names `resolveRoster` for the jersey-number addition; `resolveTwelfthMan`'s separate callout line isn't mentioned. Recommendation: leave it as-is for consistency with the spec's literal scope — flagging in case a numbered twelfth-man line is actually wanted too (cheap to add if so).

## Verification

- Backend: `cd backend && ./mvnw test` (unit + Testcontainers integration), confirm the OpenAPI diff is intentional and re-exported.
- Frontend: `cd ui && npm run build && npm run lint && npm run test && npm run test:storybook`.
- Manual smoke test (per `CLAUDE.md`'s UI rule, real dev servers + real Postgres): set a player's standing number on their profile; add them to a team's squad and confirm it defaults; edit the squad number inline and confirm it persists on reload without touching the player's standing number; attempt a duplicate squad number and confirm the inline `409`; confirm `PlayingXiBuilder`'s Autocomplete/Selects/ordered list all show `#N`; generate a team-sheet PDF and confirm the printed number matches the squad number, not the standing one.
- `npm run test:e2e` locally for the extended golden path.
