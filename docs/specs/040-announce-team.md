# 040 — Announce Team

**Depends on:** `029-league-management.md` (`Match`, `MatchSide`, `MatchSidePlayer` — every entity this spec extends, none redefined here), `030-team-sheet-communication.md` (`TeamSheetCommunicationDialog`'s own, unrelated "Team not yet announced" placeholder copy — see Non-goals for why this spec doesn't touch it), `037-match-improvements.md` (`MatchFormPage`'s Playing XI tabs / `MatchSideTab`, `PlayingXiBuilder` — the screen this spec's toggle lives on), `038-move-deactivate-to-edit-screen.md` (`RecordStatusToggle` — the precedent this spec's own toggle mirrors in shape, not a literal reuse).
**Status:** draft.

## Problem & Goals

`029` built Playing XI selection but never gave a side any real "this is final, share it" state — every `MatchSide` is either being actively built or not, with no way for an admin to mark it done. `030`/`039` print/share a side's XI freely the moment it has at least one player, which is correct for those specs' own purpose (an admin drafting a team sheet needs to be able to preview/share a draft), but it means there's no persisted signal anywhere in this codebase for "this side's team has actually been announced to the team," unlike the legacy Cricket Legend app's real `MatchSide.teamAnnounced` flag — flagged as a real, deferred gap in `docs/roadmap.md` after `039` shipped, not previously spec'd.

This spec closes that gap: a persisted `announced` flag per `MatchSide`, an explicit toggle to set/clear it from the Playing XI screen, and a visible indicator on each match's card in `MatchList` (and, by reuse, `SquadPicker`) — for whichever side(s) are real Teams, top-right, next to the existing Active/Inactive badge.

**Goals**
- `MatchSide` gets a real, persisted `announced: boolean` column (default `false`) — a genuine state, not a computed placeholder.
- A club admin can mark a side's Playing XI as "Announced" (or clear that back to "Not Announced") from that side's own Playing XI tab in `MatchFormPage`.
- Editing an already-announced side's XI in any way (add/remove a player, change a role, reorder, change captain/wicketkeeper/twelfth-man) automatically reverts it to "Not Announced" — matching legacy's own behaviour, so a stale, already-shared team sheet can never silently keep reading as "final" after it's changed.
- Each match's `RecordCard` in `MatchList`/`SquadPicker` shows, top-right, whether its real-`Team` side(s) have been announced — at a glance, without opening the match.

## Non-goals

- **Any player-facing gating.** This flag is admin-facing only in this pass — there is still no player-facing view of a `Match`'s Playing XI anywhere in this codebase (confirmed absent when this gap was first logged in `docs/roadmap.md`), so there is nothing for `announced` to actually hide from a player yet. Wiring a future player-facing team-sheet view to check this flag before rendering a side's XI is real, obvious future work for whichever spec builds that view — not decided or half-built here. This spec's entire value today is the admin's own "is this locked in yet" signal.
- **Gating `030`/`039`'s "Print as PDF"/"WhatsApp" options on `announced`.** Those specs' own "printable"/"shareable" concept (`isSidePrintable`: real `Team` + `MatchSide` exists + at least one player) is deliberately independent of this new flag — an admin can still preview/share a draft XI before formally announcing it, exactly as `030`/`039` already allow. **Naming collision, called out explicitly so it's never mistaken for the same thing:** the PDF/WhatsApp templates' own "Team not yet announced" copy (for a side with zero players) is unrelated prior art with the same words, not backed by this spec's flag — untouched by this spec, and not renamed here to avoid a bigger, unrelated diff over wording alone.
- **A confirmation dialog before announcing or un-announcing.** Legacy wraps both actions in a confirm dialog, partly because it had real, immediate consequences for player visibility. Since nothing currently reads this flag except an admin-only badge, a plain, immediate toggle (matching `RecordStatusToggle`'s own no-confirm precedent for Deactivate/Reactivate) is enough for this pass. **Real, flagged future work:** once a player-facing view consumes this flag (see above), revisit whether un-announcing (which could yank a team sheet a player is already looking at) deserves a confirm step then.
- **Any notification, email, or WhatsApp/PDF re-share triggered by announcing.** Still exactly as deferred as `029`'s own "Announce Team lock/notify/email workflow" Non-goal always said. This spec builds the lock, not the notify.
- **A minimum-completeness check before allowing "Announce"** (e.g. requiring a captain, a wicketkeeper, or a full XI up to the league's cap). The only gate is "at least one player" (see UI Requirements) — matching how loosely `030`/`039` already treat "has anything to show." A stricter completeness gate is a real, separate future decision, not decided here.
- **Any change to `029`'s cap/age-eligibility/squad-membership business rules**, or to `030`/`031`/`032`/`037`/`039`'s own shipped behaviour beyond the one net-new "editing an announced side un-announces it" side effect this spec adds to `029`'s existing mutation endpoints.
- **A generic, reusable "announced/published" toggle component.** This spec's toggle is new, purpose-built JSX inside `PlayingXiBuilder` (one call site, both home/away tabs share the same component instance) — not a new shared component. `RecordStatusToggle` itself was only extracted after eight *identical* call sites existed (see its own Javadoc); one conceptually-similar-but-differently-labelled toggle doesn't meet that bar.

## User Stories

- As a club admin, I can mark a side's Playing XI as "Announced" from that side's Playing XI tab, once it has at least one player in it.
- As a club admin, I can clear an announced side back to "Not Announced" from the same screen, at any time.
- As a club admin, if I add, remove, reorder, re-role, or change the captain/wicketkeeper/twelfth-man of an already-announced side, it automatically reverts to "Not Announced" — I have to explicitly re-announce it, so I never mistake a since-edited team sheet for the one I actually shared.
- As a club admin scanning the Matches (or Squads) list, I can tell at a glance, per match, whether each real-`Team` side has been announced yet — without opening the match — via a small badge on that match's card, top-right.
- As a club admin, a match where neither side is a real `Team` (both free-text opponents) shows no announced badge at all — there's nothing to announce.
- As a club admin using a screen reader or a 375px viewport, the Announce/Un-announce toggle and the card's announced badge(s) are both fully accessible — a toggle button with a clear accessible name, not a bare icon, and a badge with real text, not colour alone.

## Data Model Changes

**`match_side` gains one new column** — `backend/src/main/resources/db/changelog/v1/024-add-match-side-announced.sql`:

```sql
-- docs/specs/040-announce-team.md
-- Whether a club admin has marked this side's Playing XI as final/shared. Defaults false for
-- every existing row and every newly created side — matching MatchSide's own "starts empty,
-- built up" lifecycle (029). No player-facing consumer of this flag exists yet (040 Non-goals).
ALTER TABLE match_side
    ADD COLUMN announced BOOLEAN NOT NULL DEFAULT false;
```

`com.cricketlegend.domain.MatchSide` gains a matching `private boolean announced;` field (default `false`, no special persistence lifecycle beyond the existing `@PreUpdate`).

**No new column on `match` itself.** `MatchDto` (the list-screen read shape, see API Contract) gains two *derived*, non-persisted fields resolved at read time from `match_side.announced` — not a second, redundant source of truth. `MatchSideDto` (the sides endpoint's own real detail shape) gains the real `announced` field directly, 1:1 with the entity.

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `POST /api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/announce` | `@access.canAccessClub` (same as every other `MatchSideController` endpoint today) | Sets `announced = true` on that side. 404 if the side doesn't exist for this match; no other validation beyond "at least one player" (see UI Requirements — enforced client-side by disabling the control, and, per this repo's own defensive-backend convention, also re-checked server-side as a 400 `ValidationException` if a side with zero players is announced anyway). |
| `POST /api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/unannounce` | same | Sets `announced = false`. Always succeeds if the side exists — no precondition. |
| `GET /api/v1/manage/clubs/{clubId}/matches/{matchId}/sides` (`029`, unchanged route) | same | `MatchSideDto` now includes `announced: boolean`. |
| `GET /api/v1/manage/clubs/{clubId}/matches` (`029`, unchanged route) | same | `MatchDto` now includes `homeSideAnnounced: boolean` and `awaySideAnnounced: boolean` — `false` when that side isn't a real `Team` or has no `MatchSide` row yet, exactly like `announced`'s own column default. |

**Mirrors `MatchController`'s existing `deactivate`/`reactivate` shape exactly** (`029`) — a dedicated action endpoint per direction, not a generic `PATCH { announced: boolean }` — this repo's own established convention for a two-state toggle (see `docs/standards/backend.md`'s "one shape per concern" rule as applied by that precedent), not a new pattern invented here.

**The `GET /matches` list must resolve `homeSideAnnounced`/`awaySideAnnounced` via one batched query per page, not a per-row lookup.** `MatchServiceImpl.list()` already returns a `Page<MatchDto>` mapped from a page of `Match` rows; whoever implements this spec fetches every relevant `MatchSide` for that page's own match ids in a single `matchSideRepository.findByMatchIdIn(pageMatchIds)` call, groups the results in memory by `(matchId, teamId)`, and enriches each `MatchDto` from that map — never one `MatchSide` query per `Match` row. A page of (up to) `size` matches must cost exactly one extra query for this feature, not up to `2 × size`.

**Every existing `MatchSideService` mutation that changes a side's players/captain/keeper/twelfth-man now also un-announces it, as a side effect, when it was previously announced** — `updateSide`, `addPlayer`, `updatePlayerRole`, `removePlayer`, `reorderPlayers` (all five, `029`'s existing methods) each set `side.setAnnounced(false)` before saving, but only when `side.isAnnounced()` was already `true` (so an already-unannounced side's `updated_at` isn't churned by a no-op field write on every edit). This is the one behavioural change this spec makes to `029`'s own already-shipped endpoints — everything else about them (cap/age-eligibility/squad-membership validation, response shape) is unchanged.

## UI Requirements

**`ui/src/components/PlayingXiBuilder/PlayingXiBuilder.tsx`** (existing, edited) — gains a new header row, above the existing Captain/Wicketkeeper/Twelfth-man grid, shown only when the caller passes the new props below (so this stays additive, not a breaking change to `PlayingXiBuilder`'s own existing test/story coverage that doesn't pass them):
- New optional props: `announced?: boolean`, `onToggleAnnounced?: () => void`, `togglingAnnounced?: boolean`.
- A small `Chip` on the left reading "Announced" (`tone="positive"`-equivalent styling, i.e. filled/primary-tinted) or "Not Announced" (outlined/neutral) — mirroring `RecordCard`'s own two of three existing badge tones, for the same at-a-glance-status reason.
- A `Button` on the right: "Announce Team" (primary/contained) when `!announced`, disabled whenever the side has zero players (`orderedXi.length === 0`, the same value this component already computes for its own progress bar); "Un-announce" (ghost/secondary) when `announced`, never disabled. Pending-label swap while `togglingAnnounced` (`"Announcing…"`/`"Un-announcing…"`), matching `RecordStatusToggle`'s own established label-swap convention.

**`ui/src/pages/manage/MatchFormPage.tsx`'s `MatchSideTab`** (existing, edited) — the only new caller of the props above:
- New mutation: `announceMutation`/`unannounceMutation` (React Query, `onSuccess: invalidateSides` — the same cache-invalidation shape every other mutation in this component already uses), calling the two new API functions below.
- Passes `announced={side?.announced ?? false}`, `onToggleAnnounced={() => (side?.announced ? unannounceMutation.mutate() : announceMutation.mutate())}`, `togglingAnnounced={announceMutation.isPending || unannounceMutation.isPending}` into `PlayingXiBuilder`.

**`ui/src/api/matchSideApi.ts`** (existing, edited):
- `MatchSide` interface gains `announced: boolean`.
- Two new functions, mirroring `ui/src/api/matchApi.ts`'s existing `deactivate`/`reactivate` shape: `announceMatchSide(clubId, matchId, sideId): Promise<MatchSide>` (`POST .../sides/{sideId}/announce`) and `unannounceMatchSide(clubId, matchId, sideId): Promise<MatchSide>` (`POST .../sides/{sideId}/unannounce`).

**`ui/src/api/matchApi.ts`** (existing, edited) — `Match` interface gains `homeSideAnnounced: boolean` and `awaySideAnnounced: boolean`, read straight off the now-enriched `MatchDto` response; no new API function needed (both existing `listMatches`-equivalent calls already return `Match`).

**`ui/src/components/RecordCard/RecordCard.tsx`** (existing, edited) — today's `badge?: RecordCardBadge` is a single slot, already used by `MatchList`'s own `badgeFor()` for "Inactive." This spec needs up to two more badges to coexist with it (one per real-`Team` side). **Decision, mirroring `030`'s own `secondaryAction`/`secondaryActions` precedent exactly:** a new, optional `badges?: RecordCardBadge[]` prop, rendered in the same top-right `Stack` immediately after the existing singular `badge` (if both are present), wrapped (`flexWrap: 'wrap'`) so two or three small chips never force horizontal overflow at 375px. `badge` itself is unchanged, byte-for-byte, and every one of `RecordCard`'s other current call sites (Sponsors, Teams, Players, Sections, Leagues, Seasons, Subscriptions, and the rest) continues to pass at most a single `badge`, completely unaffected.

**`ui/src/pages/manage/MatchList.tsx`** (existing, edited) — `MatchCard` gains a new `announcedBadges(match, teamsById): RecordCardBadge[]` helper (co-located with the existing `badgeFor`/`sideName` helpers, same file, for the same "`SquadPicker` reuses this card shape" reason `030`'s `matchFields`/`badgeFor` already are):
- For each of home/away: skip entirely if that side isn't a real `Team` (`homeTeamId`/`awayTeamId` is null).
- Otherwise push one badge: label `"Announced"` (tone `positive`) if that side's `homeSideAnnounced`/`awaySideAnnounced` is `true`, else `"Not Announced"` (tone `neutral`) — prefixed with the side's own resolved team name (via the existing `sideName()` helper) only when **both** sides are real Teams (so a two-real-Team match reads unambiguously, e.g. "Riverside 1st XI: Announced" / "Coastal CC: Not Announced"), and left unprefixed (just "Announced"/"Not Announced") when there's exactly one real-`Team` side, since the card's own title already names both teams and a second team-name prefix would be pure noise for the overwhelmingly common one-real-side case.
- Returns an empty array (no badges rendered) when neither side is a real `Team`.
- `<RecordCard ... badge={badgeFor(match)} badges={announcedBadges(match, teamsById)} .../>` — both props passed side by side, `badgeFor`'s existing "Inactive" badge is completely unchanged.

**Mobile-first:** the `PlayingXiBuilder` header row (badge + toggle button) stacks to two lines at 375px if needed (`flexWrap`/`Stack` with `direction={{ xs: 'column', sm: 'row' }}`) rather than truncating either the chip's text or the button's label — matching `docs/standards/frontend.md`'s baseline.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | Backend: `MatchSideServiceImplTest` (or equivalent) — `announce`/`unannounce` set the flag correctly and 404 for an unknown side; `announce` on a zero-player side throws a 400 `ValidationException`; each of `updateSide`/`addPlayer`/`updatePlayerRole`/`removePlayer`/`reorderPlayers` un-announces a previously-announced side as a side effect, and leaves an already-unannounced side's `announced`/`updatedAt` untouched (no spurious write). `MatchServiceImplTest` — `list()`'s `homeSideAnnounced`/`awaySideAnnounced` resolve correctly for a real-Team-announced side, a real-Team-not-yet-announced side, a free-text-opponent side (`false`), and a real-Team side with no `MatchSide` row yet (`false`) — and exercises the batched-lookup path with more than one match on a page to catch an accidental per-row-query regression. |
| Component | `PlayingXiBuilder.test.tsx`/`.stories.tsx` (extended) — the Announced/Not Announced chip and toggle button render only when the new props are passed (existing call sites/tests untouched); "Announce Team" is disabled with zero players and enabled with at least one; clicking either button calls `onToggleAnnounced`; the pending-label swap shows while `togglingAnnounced`. `RecordCard.test.tsx` (extended) — `badges` renders every entry in order, alongside an existing `badge`, and on its own, without touching any existing assertion in that file. `MatchList.test.tsx` (extended) — `announcedBadges()` returns the right label/tone/prefix combination for: one real-Team side, two real-Team sides (both orderings of announced/not), and zero real-Team sides (empty array). |
| Contract | New endpoint contract coverage for `POST .../sides/{sideId}/announce` and `.../unannounce` (success + 404 + the zero-player 400), and `MatchDto`'s two new fields, per this repo's existing OpenAPI-schema-diff convention. |
| End-to-end | Extends `029`'s existing golden path (already extended once by `030`/`039`): after building a side's Playing XI, click "Announce Team," assert the Playing XI tab's chip reads "Announced" and the match's own card (back on the Matches list) now shows the "Announced" badge; add one more player to that same side, assert the tab's chip reverts to "Not Announced" and the badge follows on the list. Not wired into CI, same precedent as every prior `/manage` spec's own e2e coverage. |

## Acceptance Criteria

- A club admin can mark a side with at least one player as "Announced," and clear that back to "Not Announced," from that side's own Playing XI tab.
- Editing an announced side's XI in any way automatically reverts it to "Not Announced" — the admin must explicitly re-announce after any change.
- Each match's card in `MatchList`/`SquadPicker` shows an accurate "Announced"/"Not Announced" badge, top-right, for every side that's a real `Team` — none at all when neither side is.
- The list endpoint's per-page announced-status resolution costs one additional query per page, not one per match row.
- `030`'s "Print as PDF" and `039`'s "WhatsApp" options continue to behave exactly as shipped — neither gated on, nor changed by, this new flag.
- Every other existing `RecordCard`/`PlayingXiBuilder` call site continues to compile and behave exactly as before, unmodified by this spec's additive `badges`/`announced` props.

## Rollout Notes

- **This spec ships as its own PR on top of `029`/`030`/`037`/`038`/`039`** (all already merged) — one migration, two new backend action endpoints, one denormalized read field on the existing list endpoint, and a frontend-only UI addition otherwise.
- **The player-facing gating this flag ultimately exists to enable is still real, deferred future work** — this spec only builds the admin-facing lock, exactly as its own Non-goals say. A human should update `docs/roadmap.md`'s existing "Announce Team" entry once this ships: mark the admin-facing half (persisted flag, toggle, card badge) resolved by this spec's number, and keep the player-facing-view half open, cross-referenced to whichever future spec eventually builds real player login/a player-facing team-sheet view.
- **The "Announce" naming collision with `030`/`039`'s unrelated "Team not yet announced" placeholder copy is a known, accepted rough edge**, not fixed here — see Non-goals. If it causes real confusion once both are live, a future small spec can rename one side of it without touching the other's actual behaviour.
- **No confirm dialog and no minimum-completeness gate beyond "at least one player"** are both deliberate scope cuts for this first pass, not oversights — see Non-goals for the reasoning behind each, and revisit once this flag has a real downstream consumer.
