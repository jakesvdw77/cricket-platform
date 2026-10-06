# Plan 080 — Brand Icon Surfaces

Implements `docs/specs/080-brand-icon-surfaces.md` (draft; look decided by the user from https://claude.ai/artifact/2HwtCZEBYxToLkuPdM2Vib and https://claude.ai/artifact/Nv3cxhU3pFsiG3qiJtvSX2: no baked-in background, 36% tinted tile, 40 px icons in the side menu). Branch `feature/080-icon-surfaces` (holds the spec). Frontend only; one PR. All work is `frontend-builder`, which also writes the tests and stories as in 078 and 079.

## Context

Every brand SVG has a dark green circle and a highlight circle drawn into it, so icons are green whatever the club colour is. The spec removes them from the artwork and has `BrandIcon` draw one tinted tile behind each icon, with the tile colour taken from the club's primary colour, so every screen shares one recipe.

## Findings (what the code looks like today)

- `components/BrandIcon/BrandIcon.tsx` renders only an `<img>` (`size`, optional `alt`); registry in `brandIcons.ts` (`brandIconUrls` from a `?no-inline` glob, typed `BRAND_ICON_NAMES`, `playerAvatarSrc`, `genderAvatarIcon`).
- Consumers: `NavItemIcon` (wraps `BrandIcon`, plus the MUI menu glyph disc) used by `SideMenu` (32 px), `MenuSheet` (40 px), `BottomTabBar` (32 px); `ManagerOverviewPage` card headers (28 px); `NavTile` brand variant (40 px); `ConfirmDialog` icon slot (announce, 40 px); `TeamSelectionList` role, Captain and Wicketkeeper chips (28 px); avatars use `playerAvatarSrc` as an `Avatar` image on the solid `avatarSx` background (`PlayerCard`, `PlayerDetailPage`, `TeamDetailPage`), not `BrandIcon`.
- Every icon SVG has the same two background elements: `<rect width="256" height="256" fill="#0F5132"/>` and `<circle cx="200" cy="56" r="70" fill="#14633F"/>` inside a circular `clipPath`; `brand/favicon.svg` has its own different structure and must not be touched.
- `withClubBranding` now builds the club palette with `augmentColor` (079), so `primary.dark` and `getContrastText` are valid for any club colour.
- Slice 3's badge slots already exist in `SideMenu`, `MenuSheet` and `BottomTabBar` (`badges` prop); nothing here changes them.

## Decisions made while planning (flag if you disagree)

1. **Tile colour is `alpha(base, 0.36)` over the surface**, not `color-mix(...)` in `sx`. Compositing an alpha colour over a surface is the same blend as mixing it with the surface colour, it is theme-native, and it can be asserted in tests. No visible difference from the mockup you chose.
2. **"Light club colour" rule:** the tile base is `primary.main`, except when `theme.palette.getContrastText(primary.main)` is not white (the same rule that turns the header text dark), in which case it is `primary.dark`. One rule for header and icons, no new threshold to tune.
3. **Role chips (spec open question):** 28 px icon on a tile with 3 px padding (34 px tile), chip height raised from 34 to 40 px. Easy to change to 24 px if it looks heavy.
4. **Bottom bar:** 32 px icon on a tile with 3 px padding, tile height 38 px; checked that the bar still fits.
5. Avatars stay on their own `primary.main` background (no tile): the artwork sits on it directly.
6. The PNG exports under `ui/design/icon-exports/` keep the old background (reference copies); the converted SVGs in `src/icons` are the source of truth for the app.

## Steps (single PR, commits in this order)

**1. Assets (frontend-builder).**
- New `ui/scripts/strip-icon-background.mjs` (Node, no dependency, idempotent): for every `ui/src/icons/<group>/*.svg` except `brand/`, remove the background `<rect>` and highlight `<circle>` (matched by their exact fill and geometry, case-insensitive), keep the clip path; supports a path argument so a newly added original can be converted alone; prints what it changed.
- Copy the current SVGs to `ui/design/icon-originals/<group>/` first, then run the script on `src/icons`. Add a one-line `npm run icons:strip` script to `ui/package.json`.
- Test (`ui/src/icons` content test, in `components/BrandIcon/`): no SVG outside `brand/` contains `#0F5132` or `#14633F` background elements; the script is idempotent (run on a sample string twice, same result).

**2. `BrandIcon` tile (frontend-builder).**
- `BrandIcon` gains `surface?: 'tile' | 'none'` (default `'tile'`), `padding?: number` (default 6) and `active?: boolean` (white 2 px ring via `boxShadow`/outline), `size` stays the icon size. The tile is a `Box` (display inline-flex, `borderRadius: 1.25`, `bgcolor: (theme) => alpha(iconTileBase(theme), 0.36)`), the `<img>` inside; `surface="none"` renders the bare `<img>` as today.
- `iconTileBase(theme)` helper in `components/BrandIcon/` implementing decision 2; exported for tests only.
- Tests: tile versus none, outer size = size + 2 × padding, active ring, tile colour for the default colour (`primary.main` at 0.36) and for a light club colour (`primary.dark`), `aria-hidden`/alt behaviour unchanged. Story: tile, none, active, default and light club colour.

**3. Surfaces (frontend-builder), per the spec's table.**
- `NavItemIcon`: pass `size`, `padding`, `active` through; the menu glyph disc unchanged.
- `SideMenu`: icon 40 px (tile 52), `active` ring on the active row, row padding adjusted so rows stay tidy; the collapsed rail uses the same tile (rail width adjusted from the tile size, tooltip and badge positions re-checked). `MenuSheet`: icon in a tile (40 px icon) inside the existing white card tile. `BottomTabBar`: 32 px with padding 3 and the bar height checked.
- `ManagerOverviewPage` card headers (28 px, padding 4) and `NavTile` brand variant (40 px) use the default tile. `ConfirmDialog` announce icon (40 px) uses the default tile. `TeamSelectionList` chips: 28 px icon, padding 3, chip `height: 40`, `aria-label`s unchanged.
- Avatars: no code change; verify visually that the stripped artwork reads on `avatarSx`.
- Update only the existing tests that depend on the old icon markup (the `<img>` is now nested in a tile `Box`; queries by role or test id should still work).

**4. Docs (frontend-builder).** `docs/standards/design-system.md` brand icon section: artwork-only icons, the tile recipe, the 36% tint, the light-colour rule, the strip script. Amendment note in `docs/specs/078-brand-icon-set.md`.

## Reuse (do not rewrite)
`BrandIcon`/`brandIcons.ts`, `NavItemIcon`, `theme.ts` (`withClubBranding`, `augmentColor` result), MUI `alpha`, existing story and test patterns of the touched components.

## Out of scope
Recolouring inner greens per club, the favicon and app icons, new or redrawn icons, dark mode, Slice 3 badge logic.

## Verification
- `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm run build`, `npx vitest run --project unit --testTimeout=30000 src` (full unit suite), and `--project=storybook` on the touched stories (`BrandIcon`, `SideMenu`, `MenuSheet`, `BottomTabBar`, `ManagerShell`, `NavTile`, `ConfirmDialog`, `TeamSelectionList`). Node 22 via nvm; one heavy command at a time.
- Manual (you, in the browser): side menu, collapsed rail (about 1000 px), Menu sheet and bottom bar at 375, 1000 and 1280 px; the overview card headers; the announce dialog; Home XI role chips and their height; player avatars; and the whole app with a light club colour (for example `#e0b53a`) and a dark one (navy), checking the artwork stays visible on every tile.

## Commits and PR
`chore(ui)` icon originals, strip script and converted SVGs; `feat(ui)` BrandIcon tile; `feat(ui)` icon surfaces; `docs` standards; `docs(plan)`. Draft PR listing the screens to check; no merge until you say so.
