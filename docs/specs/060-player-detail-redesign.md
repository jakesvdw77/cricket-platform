# 060 — Player Detail Redesign

**Depends on:** `028-players.md` (`Player` entity and its existing fields, including `medicalAidProvider`/`medicalAidMemberNumber`, `sectionIds` — this spec adds no new field to `Player`, only changes what the detail screen shows), `036-view-first-record-detail-screens.md` (the shared `RecordDetailScreen`/`DetailFieldRow`/`DetailFieldGrid` primitives this spec's own `PlayerDetailPage` stops using, while every other consumer of those primitives is unaffected), `056-club-profile-overview.md` (the "chips under the name, no separate Details section" header posture this spec applies to Player), `057-team-extended-profile.md` (the "bespoke page, shared shell" `TeamDetailPage` rebuild this spec mirrors directly — same header shape, same two-column card grid), `059-record-card-click-to-view.md` (the stretched-link click-to-view pattern the future Stats card will use once it has somewhere real to link to). Approved via an interactive design-canvas mockup reviewed and confirmed by the user this session (Desktop and Mobile artboards) — this spec transcribes that approved design, it does not redesign it.

**Status:** approved.

## Problem & Goals

`PlayerDetailPage.tsx` is the one remaining `/manage` detail screen still built on the generic `RecordDetailScreen` shape: Basic Info, Contact Info, Cricket Info, and Sections render as four full-width `ContentCard`s stacked one under the other, regardless of how much horizontal space is available. This wastes screen width on anything wider than a phone (each card carries at most two field-grid columns inside a full-page-wide box), and gives a player's club section(s) — a single-value, glanceable fact — a whole card of its own at the bottom of the page. `TeamDetailPage` already solved the same problem in `057`: a header with chips under the name for glanceable facts, and a two-column card grid for everything else. `PlayerDetailPage` never got the equivalent pass. Separately, `Player.medicalAidProvider`/`medicalAidMemberNumber` exist on the entity and are editable on `PlayerFormPage`, but are not shown anywhere on the read-only detail screen — a real gap for a club admin trying to check a player's medical aid details without opening the edit form.

**Goals**
- Rebuild `PlayerDetailPage` on the same bespoke header + two-column card grid pattern `TeamDetailPage` uses, replacing its current `RecordDetailScreen` stacked-section layout.
- Move the player's section(s) out of their own full-width "Sections" card and into a chip under the player's name, alongside the header's existing avatar/name/Edit action.
- Surface `medicalAidProvider`/`medicalAidMemberNumber` on the detail screen for the first time, in the Contact Info card.
- Reserve a Stats card in the grid for future cricket performance statistics (matches/runs/wickets/average), shipped now as a genuine, fully laid-out placeholder rather than deferred silently — no performance-stats data source exists yet on `Player` or anywhere else in the schema.

## Non-goals

- **No change to `PlayerFormPage` (the edit screen).** Its own tab structure (Basic Info / Contact Info / Cricket Info / Sections) and all mutation flows are unchanged — this spec is the read-only view screen only.
- **No change to `PlayerList`'s card layout.** The list/grid view's own card shape is a separate concern from this spec's detail-page rebuild and isn't touched here.
- **No new cricket performance-statistics data model or API.** The Stats card added here is a placeholder UI element only (a "Coming soon" state with dashed-out fields) — a real stats data source (however it's eventually computed: from match scorecards, a dedicated aggregate table, etc.) is out of scope and would be its own future spec.
- **No change to the shared `RecordDetailScreen`/`DetailFieldGrid`/`DetailFieldRow` components.** They're reused as-is by every other entity's detail page (Season, Club Contact, Sponsor, League, and others) which keep their current generic stacked-section layout unchanged — this spec makes `PlayerDetailPage` bespoke instead, the same way `057` made `TeamDetailPage` bespoke rather than widening the shared component's contract.
- **No change to `Player`'s data model.** `medicalAidProvider`/`medicalAidMemberNumber`/`sectionIds` all already exist (`028`) — this spec only changes where and how they're displayed.

## User Stories

- As a club admin, opening a player's detail page shows me their section(s) as a chip under their name, without a separate "Sections" card taking up a full row by itself.
- As a club admin, I can see a player's Basic Info, Contact Info, and Cricket Info side by side where there's room, instead of scrolling through four full-width stacked cards.
- As a club admin, I can see a player's medical aid provider and member number on their detail page without opening the edit form.
- As a club admin, I can see that a player-level Stats feature is coming, in a clearly-labelled placeholder card, rather than the feature appearing to not exist at all.

## Data Model Changes

None. `Player.medicalAidProvider`, `Player.medicalAidMemberNumber`, and `Player.sectionIds` all already exist per `028-players.md`; this spec surfaces existing fields on an existing screen, adding no column, entity, or migration.

## API Contract

None. `PlayerDetailPage` already fetches everything this redesign needs via the existing `listPlayers` (client-side find-by-id, matching `036`'s established posture for entities with no single-record `GET`), `listPlayerSections`, and `listSections` calls — no new or changed endpoint.

## UI Requirements

### `ui/src/pages/manage/PlayerDetailPage.tsx` — rebuilt on `TeamDetailPage`'s bespoke pattern

Stops rendering via `RecordDetailScreen`'s `sections` prop; becomes its own bespoke page composed from `PageHeaderBand` (reused unchanged) plus plain `Card`s, mirroring `TeamDetailPage.tsx`'s own structure directly:

- **Header** (`PageHeaderBand`): "Back to Players" link, avatar (`photoUrl`, circular, initials fallback — unchanged from today) + player name (`h6`, bold) + a chip row directly under the name showing the player's section(s) — one outlined chip per tagged section, using the same full breadcrumb path (`sectionPath()`, already computed in the current implementation) as the label, wrapping when there's more than one. The existing `Inactive` badge (`badgeFor(player)`) renders in this same chip row. "Edit" button top-right, same tinted-outlined treatment `RecordDetailScreen`'s header already used (`bgcolor: alpha(primary.main, 0.12)`, `color: primary.dark`) — visually unchanged, just now hand-built in this bespoke header instead of inherited from `RecordDetailScreen`.
- **Body**: a `{ xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }` grid (identical shape to `TeamDetailPage`'s Contacts/Sponsors grid) holding four `Card`s, in this order: **Basic Info**, **Contact Info**, **Cricket Info**, **Stats**. Each keeps the existing `DetailFieldRow`/`DetailFieldGrid` primitives inside it for its own field layout (these are unaffected — still shared, still used by every other detail page) — only the outer per-section `ContentCard`-in-a-vertical-stack wrapper is replaced by these four `Card`s in a two-column grid.
  - **Basic Info**: unchanged fields (Date of birth, Gender, Membership number, Jersey number).
  - **Contact Info**: existing fields (Phone, Email, Alternative contact name, Alternative contact phone) plus two new `DetailFieldRow`s — **Medical aid provider** (`player.medicalAidProvider ?? '—'`) and **Medical aid number** (`player.medicalAidMemberNumber ?? '—'`).
  - **Cricket Info**: unchanged fields (Batting stance, Bowling arm, Bowling type, Wicketkeeper).
  - **Stats** (new): a real placeholder, not a stub. Card header carries a small muted "Coming soon" chip next to the "Stats" title. Body is a `DetailFieldGrid` of four fields — Matches, Runs, Wickets, Average — each rendering a muted `—` value (no data to show, and none invented) instead of a real `DetailFieldRow` value. A muted "Full breakdown" caption with a trailing chevron sits at the card's bottom, signalling — but not yet implementing — that this card becomes a click-through to a full stats breakdown once that feature and its data source exist (tracked as a follow-up item in `docs/roadmap.md`, not built here).
- The "Sections" heading and its Chip-trail content are removed entirely from the body — fully superseded by the header chip row.

**Mobile-first**, per `docs/standards/frontend.md`: the four-card grid drops to one column at `xs`; each card's own `DetailFieldGrid` already drops to one column at `xs` (existing behavior, unchanged); the header's chip row wraps.

### No new shared components

Everything this spec needs already exists (`PageHeaderBand`, `Card`, `DetailFieldRow`, `DetailFieldGrid`, MUI `Chip`) — this is a page-level recomposition, not a new library addition, matching `docs/standards/design-system.md`'s "a screen needing a new visual pattern spins that off as a library addition first" only when the pattern is genuinely new; here it's TeamDetailPage's already-established pattern applied to a second entity.

## Test Plan

| Tier | Coverage |
|---|---|
| Component | `PlayerDetailPage.test.tsx` (new, replacing reliance on generic `RecordDetailScreen` coverage) — header renders the player's section(s) as chips under the name and no separate "Sections" card exists in the body; the Inactive badge renders in the header when the player is inactive; Contact Info renders Medical aid provider/number, each falling back to `—` when unset; Stats card always renders its four fields as `—` with the "Coming soon" chip present; the body grid renders all four cards regardless of a player having zero tagged sections (empty header chip row, not an error) |
| End-to-end | Extends `028`'s golden path: view a player with sections, medical aid details, and full cricket info set — confirm the section chip appears under the name, medical aid fields appear in Contact Info, and the Stats placeholder renders. Not wired into CI, per this repo's existing E2E posture |

No backend tiers apply — this spec makes no backend change.

## Acceptance Criteria

- A player's detail page shows their section(s) as a chip (or chips) directly under their name; there is no separate "Sections" card anywhere on the page.
- Basic Info, Contact Info, Cricket Info, and Stats render as four cards in a two-column grid on desktop (`md` and up) and stack to one column below that.
- Contact Info shows Medical aid provider and Medical aid number, each falling back to `—` when the player has neither set.
- The Stats card always renders — with a "Coming soon" indicator and `—` placeholder values for Matches/Runs/Wickets/Average — never a fabricated number and never omitted.
- A player with no tagged sections, no medical aid details, and no cricket info still renders the full page with no error — every field falls back to `—` or an empty chip row, exactly as today's fallback behavior already does.

## Rollout Notes

- Ships as one PR, frontend-only — no migration, no backend change, no data loss risk.
- Approved design reference: the Claude Design canvas built and confirmed in this session (Desktop and Mobile artboards) — implementers should match its header/grid/card shapes, not re-derive them from this spec's prose alone.
- The Stats card's "Full breakdown" click-through is explicitly not implemented here — a human should log the real stats data-source feature as a new roadmap item (`docs/roadmap.md`) once this ships, so the placeholder doesn't quietly become permanent.
- A human should update `docs/roadmap.md`'s Active table once this ships, same as `057`'s own Rollout Notes required.
