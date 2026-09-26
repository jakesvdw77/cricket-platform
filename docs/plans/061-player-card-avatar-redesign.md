# Plan — 061: Player Card Redesign & Standardized Avatar Treatment

## Context

Direct user feedback, comparing the current app against the legacy Cricket Legend app's own player card, surfaced two things: (1) every avatar fallback in this codebase (`RecordCard`, `TeamCard`, `RecordDetailScreen`, `RecordIconButton`, `TeamDetailPage`'s `SquadPlayerTile`, `ShellHeader`'s club-logo slot) independently hand-rolls the same light-tint sx block (`alpha(primary.main, 0.14)` + `primary.dark` text) at an inconsistent 40px (list cards) vs 56px (detail headers) — while the account-menu avatar (`AvatarMenu.tsx`) already uses a solid `primary.main` + white-text look the user prefers everywhere; (2) `PlayerList`'s `PlayerCard` is a thin, under-designed `RecordCard` wrapper (two generic fields, a bottom chip row) compared to `TeamCard`'s already-redesigned (`057`) bespoke shape. This plan implements the approved spec `docs/specs/061-player-card-avatar-redesign.md`: one shared `avatarSx` helper rolled out everywhere, and a new bespoke `PlayerCard` component mirroring `TeamCard`'s pattern (jersey chip under the name, section+overflow and Inactive badges sharing the top-right corner, phone/batting/bowling icon rows, each omitted when absent). Approved design reference: the Claude Design canvas's third artboard, "Player card — proposed redesign" (https://claude.ai/artifact/EQA2Kk5HYREcqN5inZg4Gb).

Frontend-only. No backend/data-model change (spec's Data Model Changes / API Contract are both "None").

## Approach

### 1. New shared `avatarSx` helper — `ui/src/components/RecordCard/RecordCard.tsx`

Add, exported alongside the existing `badgeSx`:

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

Every 56px "primary record avatar" site (list cards and detail headers alike) omits `fontSize` and gets the `1.125rem` default — this is what makes list-card and detail-header avatars genuinely identical now, not just the same width/height. Smaller sites pass their own current `fontSize` explicitly.

`RecordCard.tsx`'s own avatar block: `variant`/`src`/children unchanged, `sx={avatarSx(56)}` replaces the current 40px tint block — this single change rolls the new size+color out to every `RecordCard` consumer at once (`ClubContactList`, `SponsorList`, `SponsorContactList`, `LeagueList`, and every `RecordCard` inside `LeagueDetailPage`/`LeagueFormPage`/`LeagueContactDetailPage`/`SponsorContactDetailPage`/`ClubContactDetailPage`/`SponsorDetailPage`).

### 2. Roll `avatarSx` out to every other site (mechanical, same pattern each time: replace the `bgcolor`/`color` pair — and `width`/`height` where the spec calls for a size change — with `sx={avatarSx(size, fontSize)}`, everything else on the `Avatar` unchanged)

| File | Site | Size change | fontSize passed |
|---|---|---|---|
| `RecordDetailScreen/RecordDetailScreen.tsx` | header avatar | none (56px) | omit (default `1.125rem`, matches today) |
| `TeamCard/TeamCard.tsx` | main avatar | **40px → 56px** | omit |
| `TeamCard/TeamCard.tsx` | sponsor-logo row | none (28px) | `'0.6875rem'` |
| `pages/manage/TeamDetailPage.tsx` | header avatar | none (56px) | omit |
| `pages/manage/TeamDetailPage.tsx` | `SquadPlayerTile` avatar | none (40px, per spec Non-goals) | `'0.8125rem'` |
| `pages/manage/PlayerDetailPage.tsx` | header avatar | none (56px) | omit |
| `RecordIconButton/RecordIconButton.tsx` | icon-grid avatar | none (44px) | `'0.8125rem'` |
| `ShellHeader/ShellHeader.tsx` | club-logo slot | none (28/32px, dense-dependent) | `'0.6875rem'` (unchanged today regardless of dense) |
| `AvatarMenu/AvatarMenu.tsx` | account avatar | none (32px) | `'0.75rem'` — migrate onto the shared helper too, so there's exactly one place this treatment is defined (it already matches visually; this just removes the second, independent definition) |

None of these files' props/behavior change — only the `sx` object on an already-existing `Avatar`.

### 2a. `docs/standards/design-system.md`

Update the Record list / create-edit pattern table's `RecordCard` row (and add a short new line) to describe the new solid-fill avatar convention (`primary.main` bg / white text, `avatarSx` helper, 56px for a record's own avatar) in place of the current undocumented tint. Small doc edit, part of the same PR per the spec's own Rollout Notes.

### 3. Extract player enum label maps — new `ui/src/utils/playerLabels.ts`

`PlayerDetailPage.tsx` currently declares `GENDER_LABEL`/`BATTING_STANCE_LABEL`/`BOWLING_ARM_LABEL`/`BOWLING_TYPE_LABEL` as private consts. The new `PlayerCard` needs the same batting/bowling label lookups for its "Bat: ..."/"Bowl: ..." rows — duplicating these verbatim in two files is exactly the kind of small-but-real duplication worth extracting once a second consumer needs it. Move all four consts to `ui/src/utils/playerLabels.ts` (plain exported objects, no logic change), update `PlayerDetailPage.tsx` to import them from there instead of declaring its own, and have the new `PlayerCard.tsx` import `BATTING_STANCE_LABEL`/`BOWLING_ARM_LABEL`/`BOWLING_TYPE_LABEL` from the same place.

### 4. New `ui/src/components/PlayerCard/PlayerCard.tsx` (+ `index.ts`) — bespoke card, four-file anatomy

Mirrors `TeamCard.tsx`'s structure and conventions directly (same outer `MuiCard` shell — `height: '100%'`, flex column, `viewTo`-driven hover halo and stretched-link title per `059`, footer `CardActions` with Edit only):

```ts
export interface PlayerCardProps {
  player: Player
  sectionNames: string[]      // already resolved client-side by the caller, same as today
  badge?: RecordCardBadge     // caller computes via badgeFor(player), same as TeamCard receiving badge from its callers — PlayerCard must not import from pages/manage/PlayerList.tsx (dependency-cruiser: components/** may not import pages/**)
  viewTo: string
  editTo: string
}
```

- Header row: avatar (`player.photoUrl`, circular, `initialsFromName(fullName(player))` fallback, `sx={avatarSx(56)}`) + stretched-link name (`viewTo`) on the left, matching `RecordCard`/`TeamCard`'s existing stretched-link markup exactly (copy, don't reinvent — same `position: static` link inside an `h3`, same `MuiCard` `position: relative`).
- Directly under the name: jersey-number chip (`player.jerseyNumber != null` → `Chip size="small" variant="outlined" label={`#${player.jerseyNumber}`}`), omitted when `jerseyNumber` is null.
- Top-right corner (own `Stack`, mirrors `TeamCard`'s badge/social corner): `sectionNames[0]` as an outlined chip when `sectionNames.length > 0`, plus a `+N` chip (`sectionNames.length - 1`) when there's more than one; `badge` (Inactive) chip stacked in the same `Stack`, using `badgeSx(badge.tone)` — both independently optional, corner renders nothing if neither applies.
- Icon rows (local `IconRow` helper, same shape as `TeamCard`'s own — icon + text, omitted row-by-row when data is absent):
  - Phone: `player.phone` — icon + raw value, no label prefix (matches the legacy card).
  - Batting: `player.battingStance` → `"Bat: " + BATTING_STANCE_LABEL[...]`, omitted when null.
  - Bowling: condensed one row — `player.bowlingArm`/`player.bowlingType` → `"Bowl: " + arm + (arm && type ? ", " : "") + type`, omitted only when *both* are null (partial render — just arm, or just type — when only one is set).
- Footer: Edit only (`editTo`), same as `TeamCard`.

### 5. `ui/src/pages/manage/PlayerList.tsx`

- Remove the inline `PlayerCard` function; import `PlayerCard` from `../../components/PlayerCard`.
- Keep `fullName`/`badgeFor` exports (still used by `PlayerDetailPage.tsx`) and the existing `sectionNamesFor`/data-fetching entirely unchanged — only the JSX in the map callback changes, from the old inline component to `<PlayerCard key={player.id} player={player} sectionNames={sectionNamesFor(player)} badge={badgeFor(player)} viewTo={...} editTo={...} />`.
- Drop the now-unused `playerRecordFields` import.

### 6. Delete `ui/src/utils/playerRecordFields.ts` (and its test file, if one exists)

Grep confirms `PlayerList.tsx` is its only caller; once step 5 removes that call site, this file is fully dead code — delete rather than leave orphaned, per this repo's own "delete what's unused" convention.

## Files touched

**frontend-builder:**
- `ui/src/components/RecordCard/RecordCard.tsx` (add `avatarSx`, update its own avatar)
- `ui/src/components/RecordDetailScreen/RecordDetailScreen.tsx`
- `ui/src/components/TeamCard/TeamCard.tsx` (both avatar sites)
- `ui/src/pages/manage/TeamDetailPage.tsx` (header + `SquadPlayerTile`)
- `ui/src/pages/manage/PlayerDetailPage.tsx` (header avatar + switch to `playerLabels.ts`)
- `ui/src/components/RecordIconButton/RecordIconButton.tsx`
- `ui/src/components/ShellHeader/ShellHeader.tsx`
- `ui/src/components/AvatarMenu/AvatarMenu.tsx`
- `ui/src/utils/playerLabels.ts` (new)
- `ui/src/components/PlayerCard/PlayerCard.tsx`, `index.ts` (new)
- `ui/src/pages/manage/PlayerList.tsx`
- `ui/src/utils/playerRecordFields.ts` (delete)
- `docs/standards/design-system.md` (doc update)

**test-writer** (after the above lands):
- `ui/src/components/PlayerCard/PlayerCard.test.tsx`, `.stories.tsx` (new — jersey chip presence/absence, section+overflow corner, Inactive alongside section, each icon row present/absent individually and in combination, View/Edit link targets)
- `ui/src/pages/manage/PlayerList.test.tsx` (update to the new `PlayerCard` import/props shape)
- Re-run (and fix only if genuinely broken, not pre-emptively rewrite) `RecordCard.test.tsx`, `TeamCard.test.tsx`, `TeamDetailPage.test.tsx`, `RecordIconButton` call sites' tests, `ShellHeader.test.tsx`, `AvatarMenu.test.tsx`, `PlayerDetailPage.test.tsx` — these are styling-only or pure-refactor changes on the production side, so existing content/behavior assertions should still hold; fix any that assert something styling-adjacent that's no longer true.
- Delete `ui/src/utils/playerRecordFields.test.ts` if it exists (matching the source-file deletion).

## Verification

1. `cd ui && npm run lint && npm run build` — no unused imports (`playerRecordFields`'s removal, `alpha` becoming unused in files that no longer call it directly, etc.), no TypeScript errors.
2. `npx vitest run` (full suite) — confirm no regression beyond the files this touches; cross-check any new failure against a file in the "Files touched" list before treating it as expected.
3. Manual smoke test: view `/manage/players` and confirm a player with a jersey number, phone, two tagged sections, and full cricket info shows the jersey chip, phone row, section+`+1` corner chip, and condensed Bat/Bowl rows; confirm a sparse/inactive player's card renders cleanly with fields omitted. Spot-check that Team cards, Club Contact/Sponsor/League cards, and the account-menu avatar all now render at the new solid green/white treatment with no visual regression elsewhere.
