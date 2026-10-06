# 080 — Brand Icon Surfaces

**Depends on:** 078 (brand icon set, `BrandIcon`), 079 (manager shell; the side menu, Menu sheet and bottom bar)
**Status:** draft — look decided by the user on 2026-10-06 from the mockups https://claude.ai/artifact/2HwtCZEBYxToLkuPdM2Vib (no background) and https://claude.ai/artifact/Nv3cxhU3pFsiG3qiJtvSX2 (tile tint). Open Questions remain.

## Problem & Goals

Every brand icon has a dark green circle drawn into the SVG itself, so the icons are green whatever the club colour is, and the green circle next to the side menu rows "does not look great". The user wants the surface an icon sits on to decide its background, so that clubs' own colours show through.

Goals:
- Brand icons become artwork only, with no background drawn into the file.
- One place (`BrandIcon`) draws the tinted tile an icon sits on, so every screen uses the same recipe.
- The side menu uses larger icons (40 px) on a tile tinted at 36% of the club's primary colour, the version the user chose.
- Icons stay readable on every surface they appear on, including a club with a light primary colour.

## Non-goals

- Recolouring the greens inside the artwork per club (the earlier "option C"). Only the background follows the surface; inner greens stay green.
- The favicon, app icons and manifest: they represent the platform, keep their background and are unchanged.
- New icons or redrawing existing artwork.
- Dark mode (the app is light-only).

## User Stories

- As a manager, I see icons that pick up my club's colour as their background, so that the app feels like ours.
- As a manager on a phone or desktop, I can recognise each icon in the side menu, the Menu sheet and the bottom bar, because the artwork keeps its definition against the tile.

## Data Model Changes

None.

## API Contract

None.

## UI Requirements

**Assets.** The 40-odd SVGs under `ui/src/icons/<group>/` have the background rectangle (`fill="#0F5132"`) and the highlight circle (`cx=200 cy=56 r=70 fill="#14633F"`) removed; the circular clip can stay. The originals move to `ui/design/icon-originals/<group>/` (git history keeps the rest). `brand/favicon.svg` is not transformed. The transform is a repeatable script (`ui/scripts/strip-icon-background.mjs`, idempotent) so icons the user adds later in the original style can be converted with one command. A test fails if a non-brand SVG in `src/icons` still contains the old background fill. The PNG exports under `ui/design/icon-exports/` stay as exported (with background) and are reference copies only.

**One tile recipe in `BrandIcon`.** `BrandIcon` gains a `surface` prop, `'tile'` (default) or `'none'`. With `'tile'` the icon is drawn inside a rounded square: padding 6 px, radius about 10 px, background `color-mix(in srgb, <tile base colour> 36%, <surface colour>)`, where the tile base colour comes from the theme, not a hard-coded colour. An `active` state adds a white 2 px ring so the active menu row keeps contrast. `size` stays the icon size, so a 40 px icon renders in a 52 px tile. `surface="none"` is for places that already supply their own background (an `Avatar`).

**Tile base colour for light club colours.** A light primary colour at 36% gives a pale tile and the cream artwork would disappear. The tile base is `primary.main` unless that colour is light (relative luminance above a threshold), in which case it uses `primary.dark`. The threshold is tuned against the cream artwork colour (`#f7f3e8`) and tested with a light club colour.

**Where it applies**
| Surface | Icon | Treatment |
|---|---|---|
| Side menu rows and the collapsed rail (`SideMenu`) | 40 px | tile; active row ring; rows grow to fit |
| Menu sheet tiles (`MenuSheet`) | 40 px | tile |
| Bottom bar (`BottomTabBar`) | 32 px | tile (smaller padding), confirm height still fits the bar |
| Dashboard and overview card headers (`ManagerOverviewPage`, `NavTile` brand variant) | 28 px / 40 px | tile |
| Announce confirmation (`ConfirmDialog` icon) | 40 px | tile |
| Role, Captain and Wicketkeeper chips (`TeamSelectionList`) | 28 px | tile sized to the chip; chip height adjusted |
| Player avatars (`PlayerCard`, `PlayerDetailPage`, `TeamDetailPage`) | avatar size | `surface="none"`: the artwork sits on the avatar's own `primary.main` background (`avatarSx`) |
| Menu glyph disc (`NavItemIcon` menu) | 32 px | unchanged (MUI glyph on a disc) |

**Docs.** The brand icons section of `docs/standards/design-system.md` records the tile recipe, the rule that icons are artwork only, the 36% tint and the light-colour rule.

## Test Plan

Per `docs/standards/testing.md`:
- Component tests for `BrandIcon`: `surface` tile and none, size plus padding, active ring, tile colour from the theme for the default colour and a light club colour (uses `primary.dark`).
- A test that no non-brand SVG in `src/icons` contains the old background fills, and that the strip script is idempotent.
- Existing tests for `SideMenu`, `MenuSheet`, `BottomTabBar`, `NavTile`, `ConfirmDialog`, `TeamSelectionList`, `PlayerCard` and the overview page are updated only where they depend on the icon markup.
- Stories: `BrandIcon` on tile and none, default and light club colours, active.
- Manual check by the user in the browser: side menu, rail, Menu sheet and bottom bar at 375, about 1000 and 1280 px; role chips; avatars; a light club colour.

## Acceptance Criteria

- No brand icon file other than the favicon contains a background rectangle or highlight circle.
- Every place in the table renders its icon on a tile (or an avatar background) and the artwork is clearly visible against it for the default colour and for a light club colour.
- The side menu shows 40 px icons on 36% tinted tiles and the active row stays distinguishable.
- Changing a club's primary colour changes the icon tiles.
- The favicon and app icons are unchanged.

## Open Questions

- Bottom bar: is a tile around a 32 px icon right on a phone, or should the bar use a smaller tile (or a plain icon)? To be judged on a real device.
- Role chips: 28 px icon on a tile makes the chip taller; accept a chip height of about 40 px, or use a 24 px icon on a 30 px tile?
- Avatars: the cream artwork sits on `primary.main`; confirm it reads well, and for a light club colour whether the avatar background should also use the tile base rule.
- Light-colour threshold: to be tuned with real club colours.

## Rollout Notes

One PR on `feature/080-icon-surfaces`: (1) the strip script, originals moved and SVGs converted, (2) `BrandIcon` tile recipe with tests and stories, (3) each surface in the table, (4) docs. The change is visible everywhere icons appear, so the PR lists the screens to check in the browser.
