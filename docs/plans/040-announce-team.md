# Plan: 040 — Announce Team

## Context

`docs/roadmap.md` flagged a real, previously-unbuilt gap after `039` shipped: legacy Cricket Legend had a persisted `MatchSide.teamAnnounced` flag an admin could explicitly publish/lock; this codebase has never had an equivalent — `030`/`039`'s "Team not yet announced" copy is just a computed "zero players" placeholder, not a real state. `docs/specs/040-announce-team.md` (approved) closes the admin-facing half of that gap: a real, persisted `MatchSide.announced` boolean, an explicit Announce/Un-announce toggle on that side's own Playing XI tab, automatic un-announcement whenever an already-announced side's XI is edited, and a visible badge on each match's `MatchList`/`SquadPicker` card. Player-facing gating stays out of scope — there's still no player-facing Playing XI view anywhere in this codebase to gate.

This is a full-stack spec: a migration + two new backend action endpoints + a denormalized read-time enrichment on the existing paginated `GET /matches` list, plus a frontend toggle/badge UI. Backend ships first since the frontend depends on the real new field/endpoint shapes.

## Files to touch, in order

### Backend

**1. `backend/src/main/resources/db/changelog/v1/024-add-match-side-announced.sql`** (new)
```sql
-- docs/specs/040-announce-team.md
ALTER TABLE match_side
    ADD COLUMN announced BOOLEAN NOT NULL DEFAULT false;
```
Plus one new line in `backend/src/main/resources/db/changelog/db.changelog-master.xml`, appended after the existing `023-add-availability-polls.sql` include:
```xml
<include file="db/changelog/v1/024-add-match-side-announced.sql" relativeToChangelogFile="false"/>
```

**2. `backend/src/main/java/com/cricketlegend/domain/MatchSide.java`** — add `@Column(name = "announced", nullable = false) private boolean announced;` (defaults to Java's own `false`, matching the DB default — no `@PrePersist` change needed).

**3. `backend/src/main/java/com/cricketlegend/dto/MatchSideDto.java`** — add `boolean announced` as the record's last component.

**4. `backend/src/main/java/com/cricketlegend/mapper/MatchSideMapper.java`** — `toDto(MatchSide side, List<MatchSidePlayer> players)` passes `side.isAnnounced()` through as the new trailing constructor arg. Manual mapper (not MapStruct) — a one-line change.

**5. `backend/src/main/java/com/cricketlegend/repository/MatchSideRepository.java`** — add `List<MatchSide> findByMatchIdIn(Collection<UUID> matchIds);` (Spring Data derived query) — the batched lookup `MatchServiceImpl.list()` needs (item 10 below).

**6. `backend/src/main/java/com/cricketlegend/service/MatchSideService.java`** (interface) — add two new method signatures: `MatchSideDto announce(Authentication authentication, UUID clubId, UUID matchId, UUID sideId);` and `MatchSideDto unannounce(...)` (same signature shape).

**7. `backend/src/main/java/com/cricketlegend/service/impl/MatchSideServiceImpl.java`**:
- `announce(...)`: load match + assert access (same `findMatchOrThrowForClub`/`assertCanAdministerMatch` pair every other method already uses) + load side (`findSideOrThrowForMatch`) → if `matchSidePlayerRepository.countByMatchSideId(sideId) == 0`, throw `ValidationException("Side " + sideId + " has no players to announce")` (400) → else `side.setAnnounced(true)`, save, return `toDto(side)`.
- `unannounce(...)`: same load/assert/load shape, no precondition, `side.setAnnounced(false)`, save, return `toDto(side)`.
- **The one behavioural change to existing methods**: in `updateSide`, `addPlayer`, `updatePlayerRole`, `removePlayer`, and `reorderPlayers` — immediately before each method's own final `matchSideRepository.save(side)` (or, for `updatePlayerRole`/`reorderPlayers`, which don't currently save the `MatchSide` row itself, add a `matchSideRepository.save(side)` call specifically for this side effect) — add:
  ```java
  if (side.isAnnounced()) {
      side.setAnnounced(false);
  }
  ```
  then save `side` (once per method, not per player-row). **Check `updatePlayerRole` and `reorderPlayers` particularly closely** — read them fully first (they act on `MatchSidePlayer` rows via `matchSidePlayerRepository`, and may not currently touch/save the parent `MatchSide` row at all), since they need a *new* `matchSideRepository.save(side)` call added specifically for this un-announce side effect, not just a field-set inserted into an existing save that isn't there yet.

**8. `backend/src/main/java/com/cricketlegend/controller/MatchSideController.java`** — two new endpoints, mirroring `MatchController`'s existing `deactivate`/`reactivate` shape exactly (`@PreAuthorize("@access.canAccessClub(authentication, #clubId)")`, matching every other endpoint already in this controller):
```java
@PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/announce")
public ResponseEntity<MatchSideDto> announce(Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID matchId, @PathVariable UUID sideId) {
    return ResponseEntity.ok(matchSideService.announce(authentication, clubId, matchId, sideId));
}
```
(and the `unannounce` mirror).

**9. `backend/src/main/java/com/cricketlegend/dto/MatchDto.java`** — add two new `boolean` record components, `homeSideAnnounced` and `awaySideAnnounced`, inserted right after `active` (exact order: `..., venue, active, homeSideAnnounced, awaySideAnnounced, createdAt, updatedAt, updatedBy`).

**10. `backend/src/main/java/com/cricketlegend/mapper/MatchMapper.java`** — this is a MapStruct interface doing flat auto-mapping from `Match` directly; `homeSideAnnounced`/`awaySideAnnounced` don't exist on `Match`, so MapStruct can't infer them. Add:
```java
@Mapping(target = "homeSideAnnounced", ignore = true)
@Mapping(target = "awaySideAnnounced", ignore = true)
MatchDto toDto(Match entity);
```
so it still compiles — both fields get filled in by `MatchServiceImpl` afterward (item 11).

**11. `backend/src/main/java/com/cricketlegend/service/impl/MatchServiceImpl.java`**:
- Add `MatchSideRepository matchSideRepository` as a new constructor-injected dependency (not currently present in this service).
- Add one new private helper:
  ```java
  private Page<MatchDto> enrichAnnounced(Page<MatchDto> page) {
      List<UUID> matchIds = page.getContent().stream().map(MatchDto::id).toList();
      Map<String, Boolean> announcedByKey = matchSideRepository.findByMatchIdIn(matchIds).stream()
              .collect(Collectors.toMap(s -> s.getMatchId() + "|" + s.getTeamId(), MatchSide::isAnnounced));
      return page.map(dto -> new MatchDto(
              dto.id(), dto.clubId(), dto.homeTeamId(), dto.homeTeamName(), dto.awayTeamId(), dto.awayTeamName(),
              dto.leagueId(), dto.seasonId(), dto.matchDate(), dto.venue(), dto.active(),
              dto.homeTeamId() != null && announcedByKey.getOrDefault(dto.id() + "|" + dto.homeTeamId(), false),
              dto.awayTeamId() != null && announcedByKey.getOrDefault(dto.id() + "|" + dto.awayTeamId(), false),
              dto.createdAt(), dto.updatedAt(), dto.updatedBy()));
  }
  ```
- Wrap **every one of the 5 `return ....map(matchMapper::toDto);` statements inside `list()`** with this helper (`return enrichAnnounced(matchRepository.xxx(...).map(matchMapper::toDto));`) — a mechanical, minimal-diff change to each branch; `list()`'s own branching logic (section-scoping, `upcomingOnly`) is otherwise untouched. This keeps the enrichment to exactly one extra query per page, regardless of which branch runs.

### Frontend

**12. `ui/src/api/matchSideApi.ts`** — `MatchSide` interface gains `announced: boolean`. Two new functions mirroring `matchApi.ts`'s own `deactivateMatch`/`reactivateMatch` naming and shape: `announceMatchSide(clubId, matchId, sideId): Promise<MatchSide>` (`POST .../sides/{sideId}/announce`), `unannounceMatchSide(clubId, matchId, sideId): Promise<MatchSide>` (`POST .../sides/{sideId}/unannounce`).

**13. `ui/src/api/matchApi.ts`** — `Match` interface gains `homeSideAnnounced: boolean` and `awaySideAnnounced: boolean` (same field order as the backend DTO, right after `active`). No new API function — existing calls already return the enriched shape.

**14. `ui/src/components/PlayingXiBuilder/PlayingXiBuilder.tsx`** — new optional props `announced?: boolean`, `onToggleAnnounced?: () => void`, `togglingAnnounced?: boolean`. When `announced`/`onToggleAnnounced` are passed, render a new header `Stack` (`direction={{ xs: 'column', sm: 'row' }}`, `justifyContent: 'space-between'`) as the very first thing inside the component's returned `Box`, above the existing `errorMessage`/Captain-Wicketkeeper-Twelfth-man grid:
- Left: a `Chip` — `label="Announced"` (filled, primary-tinted, matching `RecordCard`'s own `positive` tone styling) when `announced`, else `label="Not Announced"` (outlined/neutral).
- Right: a `Button` — "Announce Team" (primary/contained, `disabled={orderedXi.length === 0}` — reuse the component's own existing `orderedXi` memo, don't recompute) when `!announced`; "Un-announce" (ghost/secondary) when `announced`. Label swaps to `"Announcing…"`/`"Un-announcing…"` while `togglingAnnounced`, and the button is `disabled` while that's true too (mirroring `RecordStatusToggle`'s own pending-disable convention).
- Whole block omitted entirely when `announced`/`onToggleAnnounced` are both undefined — every existing `PlayingXiBuilder` call site/test/story that doesn't pass them is completely unaffected.

**15. `ui/src/pages/manage/MatchFormPage.tsx`'s `MatchSideTab`** — two new mutations alongside the existing ones (`announceMutation`/`unannounceMutation`, both `onSuccess: invalidateSides`, same shape as every mutation already in this component), and three new props passed into `<PlayingXiBuilder>`:
```tsx
announced={side?.announced ?? false}
onToggleAnnounced={() => (side?.announced ? unannounceMutation.mutate() : announceMutation.mutate())}
togglingAnnounced={announceMutation.isPending || unannounceMutation.isPending}
```

**16. `ui/src/components/RecordCard/RecordCard.tsx`** — new optional `badges?: RecordCardBadge[]` prop, rendered in the same top-right `Stack` immediately after the existing singular `badge` (both can coexist), with `flexWrap: 'wrap'` added to that `Stack` so up to 3 chips never force horizontal overflow at 375px. `badge` itself and every other prop/existing call site is untouched.

> **Flag for your review before this file is touched — see "Flags for your review" below.** `RecordCard.tsx` currently has real, *uncommitted* local changes already sitting in the working tree (unrelated card-background/shadow styling, present since before the `039` session started) — not from any spec, not yet committed. `frontend-builder` needs to build its `badges` addition on top of whatever is actually on disk at build time, not the version quoted in this plan or in `040`'s own spec text (both were read before those local edits, and independently — read the live file fresh before editing).

**17. `ui/src/pages/manage/MatchList.tsx`** — new `announcedBadges(match: Match, teamsById: Map<string, Team>): RecordCardBadge[]` helper, co-located with the existing `badgeFor`/`sideName` helpers:
- Skip a side entirely if it isn't a real `Team` (`match.homeTeamId`/`match.awayTeamId` is `null`).
- For each real-`Team` side: push `{ label: 'Announced', tone: 'positive' }` or `{ label: 'Not Announced', tone: 'neutral' }`, reading `match.homeSideAnnounced`/`match.awaySideAnnounced`. Prefix the label with that side's resolved team name (via the existing `sideName()` helper, e.g. `"Riverside 1st XI: Announced"`) **only when both sides are real Teams** (both `homeTeamId` and `awayTeamId` set) — unprefixed when there's exactly one real-`Team` side.
- Wire into `MatchCard`'s existing `<RecordCard ... badge={badgeFor(match)} .../>` call: add `badges={announcedBadges(match, teamsById)}` alongside it.

## Agent assignment

1. **`backend-builder`** — items 1–11 (migration, `MatchSide`/`MatchSideDto`/`MatchSideMapper`/`MatchSideRepository`/`MatchSideService`+Impl/`MatchSideController`, then `MatchDto`/`MatchMapper`/`MatchServiceImpl`). Explicitly instruct it to **read `updatePlayerRole` and `reorderPlayers` fully before editing them** — per item 7's own note, they may not currently persist the parent `MatchSide` row at all, so the un-announce side effect needs a *new* save call added, not just a field-set folded into an existing one.
2. **`frontend-builder`** (after backend-builder) — items 12–17. Explicitly instruct it to re-read the live `ui/src/components/RecordCard/RecordCard.tsx` and `ui/src/pages/manage/MatchList.tsx` from disk before editing (per item 16's flag) — both may carry unrelated, uncommitted local changes from before this feature started; build `badges`/`announcedBadges` on top of whatever's actually there.
3. **`test-writer`** (after both builders) — compares `040`'s own Test Plan table against what's actually on disk, then fills gaps: backend `MatchSideServiceImplTest`/`MatchServiceImplTest` additions (announce/unannounce success + 404 + zero-player 400; each of the 5 mutating methods un-announcing a previously-announced side and *not* spuriously re-saving an already-unannounced one; the batched-announced-resolution path with 2+ matches on one page); `PlayingXiBuilder.test.tsx`/`.stories.tsx` (chip + toggle render only when props passed, disabled-at-zero-players, pending-label swap); `RecordCard.test.tsx` (`badges` array rendering, alongside and independent of `badge`); `MatchList.test.tsx` (`announcedBadges()`'s label/tone/prefix matrix: one real side, two real sides in both announced states, zero real sides); an OpenAPI contract-diff check for the two new endpoints + `MatchDto`'s two new fields; and an e2e extension.
   - **E2e insertion point, precise**: in `ui/e2e/manager-league-management.spec.ts`, right after the existing `await expect(page.getByRole('combobox', { name: 'Add player' })).toBeDisabled();` line (end of the persisted-Playing-XI-after-reload block, before the "Availability poll" section begins) — click "Announce Team", assert the chip reads "Announced", reload, assert it's still "Announced" post-reload, then reuse the *already-exercised* "Move up" reorder button (no need to add/remove a player — the cap is already reached at 2/2) to trigger a mutation and assert the chip reverts to "Not Announced". Separately, back on the Matches list (the existing "Back to Matches"/`matchCard` section further down, before the "Communicate Team Sheet" block), assert the card now shows the right badge for whichever announced-state the home side is actually in at that point in the test.

## Flags for your review

- **`RecordCard.tsx` and `MatchList.tsx` both currently carry real, uncommitted local changes** (unrelated card-background/shadow styling work, sitting in the working tree since before `039`'s own session) that predate this spec and this plan. Neither builder agent has any memory of that — both must re-read the live file from disk before editing rather than trusting any version described in this plan or in `040`'s spec text, so their diff lands on top of the actual current file, not a stale mental model of it.
- **`updatePlayerRole`/`reorderPlayers` may need a *new* `matchSideRepository.save(side)` call**, not just a field-set added to an existing one — flagged in item 7 and the backend-builder brief, since getting this wrong (setting the field but never persisting it) would silently ship a no-op un-announce path for two of the five mutation endpoints.
- **No new decision beyond what `040`'s spec already fixed** — this plan is pure mechanics for the entities/endpoints/UI shapes the spec already settled (batched-query requirement, `RecordCardBadge` reuse, no confirm dialog, no completeness gate beyond "≥1 player").

## Verification

- Backend: `cd backend && ./mvnw test` — new/edited `MatchSideServiceImplTest`/`MatchServiceImplTest` cases pass; existing `029`/`037` tests for the 5 mutating methods still pass unchanged (their own assertions about cap/age/squad-membership are untouched by this spec).
- Frontend: `cd ui && npm run build && npm run lint && npm run test && npm run test:storybook`.
- Manual smoke test (`claude-in-chrome`, per `docs/workflow.md` step 8, once built): build a side's Playing XI, click "Announce Team," confirm the chip and the match's own list-card badge both read "Announced"; edit the XI (reorder or add/remove a player) and confirm both revert to "Not Announced"; confirm a match with only a free-text opponent side shows no announced badge at all; confirm `030`'s "Print as PDF" and `039`'s "WhatsApp" options still work exactly as before, regardless of announced state.
