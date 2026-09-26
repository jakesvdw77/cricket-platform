# 061 — Player Card Redesign & Standardized Avatar Treatment

**Depends on:** `057-team-extended-profile.md` (the `TeamCard` "bespoke card, shared shell" precedent this spec's new `PlayerCard` mirrors directly), `060-player-detail-redesign.md` (the immediately-preceding Player-screen redesign this follows on from), `028-players.md` (`Player`'s existing fields — `jerseyNumber`, `phone`, `battingStance`, `bowlingArm`, `bowlingType`, `sectionIds` — all reused unchanged), `036-view-first-record-detail-screens.md` (`RecordDetailScreen`'s shared header avatar, one of the sites this spec re-styles), `059-record-card-click-to-view.md` (the stretched-link click-to-view convention the new `PlayerCard` reuses for View). Approved via the same interactive design-canvas mockup session as `060` (third artboard, "Player card — proposed redesign") — this spec transcribes that approved design plus two explicit follow-up decisions confirmed directly with the user (see UI Requirements), it does not redesign it.

**Status:** approved.

## Problem & Goals

Two related gaps, both surfaced by direct user feedback comparing the current app against the legacy Cricket Legend app's own player card:

**1. Every avatar in the app hand-rolls the same styling, independently, in ten-plus places** — `RecordCard`, `TeamCard`, `RecordDetailScreen`, `RecordIconButton`, `TeamDetailPage`'s `SquadPlayerTile`, and `ShellHeader`'s club-logo slot all duplicate an identical `bgcolor: alpha(theme.palette.primary.main, 0.14)` + `color: 'primary.dark'` light-tint sx block — exactly the kind of duplicated styling `docs/standards/frontend.md`'s 70%-duplication reuse rule exists to catch. The one outlier is the account/profile-menu avatar (`AvatarMenu.tsx`), styled with a solid `primary.main` fill and white text — a look the user explicitly prefers and wants applied everywhere. List-card avatars (40px) are also visibly smaller than detail-page header avatars (56px) for the same kind of record, with no reason for the difference.

**2. `PlayerList`'s `PlayerCard` is under-designed relative to `TeamCard`'s already-redesigned (`057`) bespoke shape.** It's a thin `RecordCard` wrapper showing only two generic fields (DOB, membership number) and the player's sections as a plain bottom chip row — no jersey number, no phone, no cricket info, nothing matching the density and usefulness of the legacy app's own player card (avatar, name, jersey-number chip, and icon rows for section/phone/batting/bowling).

**Goals**
- Extract one shared `avatarSx(size, fontSize?)` helper (co-located with `RecordCard.tsx`'s existing exported `badgeSx`) and apply it everywhere an avatar/logo/initials fallback renders, replacing every hand-rolled tint sx block with the same solid `primary.main` + white-text treatment.
- Grow every list-card avatar from 40px to 56px, matching the size already used on detail-page headers — one avatar size for "this record's own avatar," not two.
- Rebuild `PlayerCard` (`PlayerList.tsx`) as its own bespoke component, mirroring `TeamCard`'s structure: jersey-number chip under the name, section (+ overflow) and Inactive badges in the top-right corner, and icon rows for phone/batting/bowling, each omitted when its data is absent.

## Non-goals

- **No change to `PlayerDetailPage.tsx`'s content or layout beyond its header avatar picking up the new `avatarSx` treatment.** `060` already redesigned this screen; this spec only touches its avatar styling as part of the universal rollout, nothing else on that page.
- **No change to `PlayerFormPage.tsx`, `TeamCard`'s own field content, or any other entity's card/detail *content*.** This spec is a `PlayerCard` content redesign plus a purely visual (color + size) avatar-treatment change everywhere else — no other entity's information architecture changes.
- **`RecordIconButton` (contact/sponsor quick-view grids, 44px), `TeamCard`'s sponsor-logo row (28px), and `ShellHeader`'s club-logo slot (28-32px) keep their current sizes.** Only their color treatment changes to the new solid-fill style — these are smaller, denser "icon button" contexts, not a record's own primary avatar, and growing them isn't part of this spec's ask.
- **`TeamDetailPage`'s `SquadPlayerTile` keeps its current 40px size, recolored only.** It's a dense grid of many player tiles inside a Team's detail page, not the primary "record avatar" context `RecordCard`/`RecordDetailScreen`/`TeamCard`/`PlayerCard`/detail headers share — resizing it is a separate, unconfirmed design call this spec doesn't make.
- **No new cricket-stats data or change to `PlayerDetailPage`'s Stats placeholder card** (`060`'s own scope, unaffected here).
- **The real initials bug** (`initialsFromName` producing "BR" for "Brain Best" instead of "BB") **was found and fixed separately**, in `fix/initials-multi-word-names` — not part of this spec.
- **No change to which fields a player can have, or to `Player`'s data model at all.** Every field this spec surfaces on the new `PlayerCard` (`jerseyNumber`, `phone`, `battingStance`, `bowlingArm`, `bowlingType`) already exists per `028-players.md`.

## User Stories

- As a club admin, every avatar I see across the app — Player, Team, Club Contact, Sponsor, League — uses the same solid green-and-white treatment, at a consistent, legible size.
- As a club admin scanning the Players list, I can see a player's jersey number, phone number (if on file), batting stance, and bowling style at a glance, without opening the player.
- As a club admin, I can see which section a player belongs to (and that there's more than one, if so) without it consuming a whole row of the card.
- As a club admin, a player with no phone number, no jersey number, or no cricket info recorded yet still sees a clean card — missing fields are omitted, never shown empty or as an error.

## Data Model Changes

None. Every field this spec surfaces (`jerseyNumber`, `phone`, `battingStance`, `bowlingArm`, `bowlingType`, `sectionIds`) already exists on `Player` per `028-players.md`.

## API Contract

None. `PlayerList.tsx` already fetches everything the new `PlayerCard` needs via its existing `listPlayers`/`listSections` calls and `sectionNamesFor` join — no new or changed endpoint.

## UI Requirements

### `ui/src/components/RecordCard/RecordCard.tsx` — new shared `avatarSx` helper

A new exported function, alongside the existing `badgeSx`:

```ts
export function avatarSx(size: number, fontSize?: string) {
  return {
    width: size,
    height: size,
    flex: 'none' as const,
    fontSize: fontSize ?? '1.125rem',
    fontWeight: 600,
    bgcolor: 'primary.main',
    color: 'primary.contrastText',
  }
}
```

`RecordCard`'s own avatar block adopts it at `avatarSx(56, '0.8125rem')` (56px, keeping today's list-card font size proportionate — implementer's judgment call if a slightly larger font reads better at the new size, per `docs/standards/design-system.md`'s existing type scale) — this single change rolls the new avatar size and color out to every `RecordCard` consumer at once: `PlayerList` (superseded by the new bespoke `PlayerCard` below, but any other RecordCard-based list keeps benefiting), `ClubContactList`, `SponsorList`, `SponsorContactList`, `LeagueList`, and every `RecordCard` used inside `LeagueDetailPage`/`LeagueFormPage`/`LeagueContactDetailPage`/`SponsorContactDetailPage`/`ClubContactDetailPage`/`SponsorDetailPage`.

### Every other avatar site adopts the same helper, at its own existing size

Replacing each hand-rolled `bgcolor: alpha(theme.palette.primary.main, 0.14)` / `color: 'primary.dark'` block with `sx={avatarSx(<size>, <existing fontSize>)}`:

| Site | Size | Change |
|---|---|---|
| `RecordDetailScreen.tsx` header avatar | 56px (unchanged) | tint → solid |
| `TeamCard.tsx` main avatar | 40px → **56px** | tint → solid, size up |
| `TeamDetailPage.tsx` header avatar | 56px (unchanged) | tint → solid |
| `PlayerDetailPage.tsx` header avatar | 56px (unchanged) | tint → solid |
| `RecordIconButton.tsx` | 44px (unchanged) | tint → solid |
| `TeamCard.tsx` sponsor-logo row | 28px (unchanged) | tint → solid |
| `ShellHeader.tsx` club-logo slot | 28/32px dense-mode (unchanged) | tint → solid |
| `TeamDetailPage.tsx`'s `SquadPlayerTile` | 40px (unchanged, see Non-goals) | tint → solid |
| `AvatarMenu.tsx` | 32px (unchanged) | already solid — migrate its inline sx to call `avatarSx(32, '0.75rem')` too, so there's exactly one place this treatment is defined, not two that happen to agree |

`docs/standards/design-system.md`'s token table/Record list pattern description should be updated by a human once this ships to describe the new solid-fill avatar convention and the `avatarSx` helper, replacing its current (undocumented-but-de-facto) tint description.

### `ui/src/components/PlayerCard/PlayerCard.tsx` (new) — bespoke card, replacing `PlayerList.tsx`'s inline `PlayerCard` function

Four-file anatomy (`docs/standards/frontend.md`) since this is now a genuinely reusable shared component, not a page-local helper — mirrors `TeamCard.tsx`'s structure and conventions directly (same outer `MuiCard` shell: `height: '100%'`, flex column, hover halo via `viewTo`, same stretched-link title pattern per `059`):

- Avatar (`player.photoUrl`, circular, `initialsFromName(fullName(player))` fallback, `avatarSx(56, ...)`) + name (stretched-link `viewTo`, same as today) on the left.
- **Jersey-number chip directly under the name** — `player.jerseyNumber != null` renders a small chip (e.g. `#16`); omitted entirely when unset.
- **Top-right corner**: the player's first tagged section's name as an outlined chip, plus a `+N` overflow chip when tagged to more than one section (confirmed decision — not every section named, not a bare count alone). The existing `badgeFor(player)` Inactive chip (imported from `PlayerList.tsx`, unchanged logic) stacks in the same corner, below/alongside the section chip (confirmed decision, matching `TeamCard`'s own "badge plus other top-right elements share the corner" convention). No section tagged → corner shows only the Inactive chip if applicable, or nothing.
- **Icon rows**, each omitted entirely when its data is absent (same convention as `TeamCard`'s `IconRow`, reused/mirrored here as a local helper the same way `TeamCard.tsx` keeps its own):
  - Phone (`player.phone`) — a phone icon + the raw value, no label prefix (matches the legacy card's own unlabelled phone row).
  - Batting — `"Bat: " + BATTING_STANCE_LABEL[player.battingStance]`, omitted when `battingStance` is null.
  - Bowling — `"Bowl: " + BOWLING_ARM_LABEL[player.bowlingArm] + ", " + BOWLING_TYPE_LABEL[player.bowlingType]`, condensed onto one row (unlike `PlayerDetailPage`'s separate arm/type rows — a card has less room than a full detail page); omitted when both are null, partially rendered (just the arm, or just the type) when only one is set.
- Footer: Edit action only (`editTo`), View via the stretched-link title — same as `TeamCard`'s current footer.

`PlayerList.tsx` drops its inline `PlayerCard` function and imports this new component instead, passing `player` and `sectionNames`/`taggedSections` (whichever shape the new component's props need — implementer's call, consistent with how `sectionNamesFor` already resolves names client-side today).

**Mobile-first**, per `docs/standards/frontend.md`: the corner chip(s) wrap under the avatar/name row at narrow widths rather than overflowing, same `flexWrap`/`useFlexGap` pattern every other card on this codebase already uses.

## Test Plan

| Tier | Coverage |
|---|---|
| Component | New `PlayerCard.test.tsx` + `.stories.tsx` (required by the four-file anatomy now that this is a real shared component): jersey chip renders only when `jerseyNumber` is set; section corner shows the first tagged section plus `+N` when there's more than one, and just the Inactive chip (or nothing) when untagged; Inactive chip renders alongside the section chip when both apply; each icon row (phone/batting/bowling) renders only when its data is present, individually and in combination; View/Edit navigation targets unchanged from today's `PlayerList` behavior. `RecordCard.test.tsx` extended: avatar renders at the new size/color via `avatarSx`. `AvatarMenu.test.tsx`, `ShellHeader.test.tsx`, `TeamCard.test.tsx` (or equivalent) spot-checked that avatar styling didn't regress functionally (initials still render, image `src` still passes through) — visual color/size is not something these tests assert pixel values for, matching this codebase's existing testing posture (component tests check behavior/content, not computed styles). `PlayerList.test.tsx` updated to reflect the new `PlayerCard` import/props shape. |
| End-to-end | Extends `028`'s golden path: view the Players list, confirm a player with a jersey number, phone, and two tagged sections shows the jersey chip, phone row, and section-chip-plus-overflow; confirm a sparse/inactive player's card renders cleanly with fields omitted rather than empty. Not wired into CI, per this repo's existing E2E posture. |

## Acceptance Criteria

- Every avatar/logo/initials-fallback in the app (Player, Team, Club Contact, Sponsor, League, the account menu, club logos) renders with a solid `primary.main` background and white text, via the single shared `avatarSx` helper — no remaining hand-rolled tint sx block for this purpose anywhere in `ui/src`.
- Every list-card avatar (`RecordCard`, `TeamCard`, the new `PlayerCard`) renders at 56px, matching detail-page header avatars.
- `RecordIconButton`, `TeamCard`'s sponsor row, `ShellHeader`'s club logo, and `SquadPlayerTile` keep their existing sizes, recolored only.
- The Players list shows each player's jersey number (when set) as a chip under their name, phone number (when set) as an icon row, batting/bowling info (when set) as condensed icon rows, and their section(s) as a top-right corner chip with `+N` overflow for more than one — every one of these omitted cleanly, with no empty state or error, when its underlying data is absent.
- A player with none of jersey number, phone, cricket info, or tagged sections set still renders a clean, non-broken card (avatar, name, Edit action only).

## Rollout Notes

- Ships as one PR, frontend-only — no migration, no backend change, no data-loss risk.
- Approved design reference: the Claude Design canvas from `060`'s session, third artboard "Player card — proposed redesign" (https://claude.ai/artifact/EQA2Kk5HYREcqN5inZg4Gb) — implementers should match its layout/spacing, not re-derive it from this spec's prose alone.
- Because `avatarSx` centralizes styling for `RecordCard` and `RecordDetailScreen`, this PR is a genuinely wide visual change — every entity using either shared component (Player, Club Contact, Sponsor, Sponsor Contact, League, and League's cross-linked Team/Contact cards) changes avatar size and color in the same PR, not staggered per entity. This mirrors `057`'s own "ship shared infrastructure changes in one pass, not staggered" rationale.
- A human should update `docs/standards/design-system.md`'s avatar/token description once this ships, per the UI Requirements note above.
- A human should update `docs/roadmap.md` once this ships — this closes out part of the existing `TeamCard`/`SquadPlayerTile`/`NavTile`-vs-`RecordCard` duplication entry (avatar styling specifically; the broader card-shell duplication it names remains open) and should be cross-referenced there.
