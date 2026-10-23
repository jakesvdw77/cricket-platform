# 120: Manager Theme Alignment (one product, platform greens and gold, Barlow)

**Depends on:** `001-tenancy-identity-model.md` (White-Labelling: the closed `ClubBranding` set, `withClubBranding`), `006-post-login-home-shells.md` (`AppShell`, `BottomTabShell`), `078-brand-icon-set.md` and `080-brand-icon-surfaces.md` (icon tiles and `iconTileBase`), `079-manager-shell-and-overview.md` (`ManagerShell`, `ShellHeader tone="brand"`, `SideMenu`, `BottomTabBar`, `MenuSheet`, `managerNav`), `081-plain-page-header-and-counters.md` (`PageHeaderBand`, `PageCounters`, `keyFigureStyle`), `119-login-account-journey.md` (the Keycloak login theme and the dark player console: `PageBackdrop`'s `BACKDROP_COLOURS`, `pages/view/myPlayers/hubStyle.ts`'s `HUB`, the bundled Barlow Condensed files and the deliberate token copy in `cricketlegend.css`), `docs/standards/design-system.md`, `docs/standards/frontend.md`.
**Status:** approved, 2026-10-23. The owner approved the "Proposed" look of the mockup (`manager-players-mockup.html`, artifact `WhU19xTjD6QhTefR9412MZ`), made Decisions 1 to 7, and on the same day accepted every recommendation and default that this spec first listed as open questions (Decisions 13 to 22). No open questions remain.

## Decisions

Settled by the owner on 2026-10-23, binding on this spec.

1. **Per-club white-labelling stays, but only on the body.** `withClubBranding` still tints primary buttons, links, focus rings, selected counters, chips and accents per club. The header, side menu, bottom bar, Menu sheet and footer use the **fixed platform greens and gold for every club**. Consequences: (a) a club's primary colour no longer colours the header, so the club's identity on the chrome is its name and logo only (Decision 18); (b) a club with a light or clashing primary colour (gold, yellow, red) now sits on a cream body next to a dark green frame, so contrast must be proved, not assumed: club `primary.main` as text must meet **4.5:1** and as a UI edge **3:1** on both the white card and the cream ground, handled by the fallback in Decision 22; and gold selected text on the dark menu must meet 4.5:1 (`#E8B83D` on `#0a2e1d`).
2. **Fonts: Barlow Condensed 600 and 700 (display) and Barlow 400, 500, 600 (body), self-hosted.** `woff2` files committed under `ui/public/fonts/`, declared with `@font-face` and `font-display: swap`, the two Latin display weights preloaded from `ui/index.html`, with the system fallback stack `"Arial Narrow", "Roboto Condensed", sans-serif` for the display face and `system-ui, sans-serif` for body. **No CDN, no new npm dependency.** The SIL Open Font Licence text sits beside the files (`ui/public/fonts/OFL-Barlow.txt`). The Keycloak theme already bundles `barlow-condensed-latin-600/700-normal.woff2` and OFL files (`keycloak/themes/cricketlegend/login/resources/fonts/`, spec `119`): the **same files are used** (copied byte for byte, never re-subset, checked by a hash comparison in the font test). New files: the three Barlow body weights, plus the Latin Extended files (Decision 21).
3. **One set of tokens for the manager chrome and the player console.** A single module, `ui/src/brandTokens.ts`, exports the platform brand constants (greens `#0B3D26`, `#0a2e1d`, `#0F5132`, `#14633F`, ink `#06241A`, gold `#E8B83D`, sand `#E2D5B0`, cream `#F7F3E8`, the cream-ground gradient stops, the display and body font stacks). `BACKDROP_COLOURS` (`PageBackdrop`), `HUB` (`hubStyle.ts`) and `theme.ts` import or re-export from it, so there is one copy of each green and of the gold in `ui/`. The values in `HUB` and `BACKDROP_COLOURS` do not change. The Keycloak CSS block stays a deliberate hand-kept copy (design-system.md, "Keycloak login theme tokens").
4. **The player console stays as built.** No visual change to `AccountShell`, `HubFrame`, the chooser or "My players". Their only change is that they import tokens from the shared module and render their display text in the real condensed face instead of the fallback.
5. **Accessibility is part of the look.** Visible focus on every chrome control (a 2px cream or gold outline with 2px offset on dark surfaces, the existing primary ring on the light body); 4.5:1 for all text and 3:1 for icons and control edges; animation off under `prefers-reduced-motion` (including the Menu sheet slide and any hover transition added here); the phone bottom bar and the Menu sheet are also dark; state is never colour alone (the selected item keeps `aria-current` and bold, not just tint); chrome text stays legible at 200 percent zoom and 375 px width.
6. **Tests and stories move with the shells.** The shell tests are updated (new colours, `aria-current`, focus), a contrast test is added (Test Plan), and Storybook stories are added or updated for `ShellHeader`, `SideMenu`, `BottomTabBar`, `ManagerShell` and `AppShell` (a long-name club, a club with a light primary colour, no logo, collapsed rail, badges).
7. **`docs/standards/design-system.md` changes in the same change set, and the Claude Design project is synced.** Tokens table, Type section (it currently says "no separate display face", which this spec reverses), Shape (radius), the chrome rules in "Manager shell and header" and "Brand icons", the avatar rule and the default primary. The `design-token-sync` skill is run against the Claude Design project at checkpoint C, or recorded in `docs/roadmap.md` as a follow-up if the project is unreachable.
8. **Look to build (from the approved mockup).** Header `#0B3D26` with cream `#F7F3E8` text; side menu `#0a2e1d` with cream labels, selected row gold `#E8B83D` text on `rgba(232,184,61,.16)`; page ground a cream gradient (`#e9efe6` to `#f4f1e6` to `#f7f4ea`, 170 degrees) behind white cards with a `#d8dfd2` border; `theme.shape.borderRadius` 6; page titles at 40 px (32 px on a phone) in Barlow Condensed 700 uppercase with 0.05em tracking; menu labels 17 px Barlow Condensed 600 uppercase with 0.06em tracking and group headings 11 px uppercase at 0.12em; counter numerals 40 px Barlow Condensed 700 in `#0B3D26`, counter labels uppercase 12 px at 0.1em; card names and `RecordCard` titles in Barlow Condensed (about 21 px uppercase); avatar discs gold (a `#f4d676` to `#E8B83D` radial) with `#0B3D26` Barlow Condensed initials. Layout, spacing, filters, buttons (size, order, labels), dialogs, tables and forms are unchanged in structure.
9. **`avatarSx` changes for every avatar** (the shared helper in `RecordCard.tsx`): gold disc with dark green initials, not per-club `primary.main`. Photos and logos are unchanged. Confirmed everywhere in Decision 19.
10. **`pageBackgroundGradient` becomes the fixed cream ground**, no longer tinted by `primary`. Every shell `<main>` uses it. A club's colour still appears on buttons, links, counters and chips, so the body keeps its club identity.
11. **`ShellHeader tone="brand"` becomes the platform chrome** (dark green, cream text, a white logo tile, a gold avatar disc in `AvatarMenu onBrand`). `AppShell` (platform admin) and `BottomTabShell` move to it as well (confirmed in Decision 17); `tone="plain"` is removed once no caller uses it (a grep gate in checkpoint C), not kept as dead code.
12. **Count badges** keep `error.main` with a cream 1.5px ring so the badge edge meets 3:1 against `#0a2e1d`; the badge feature itself is unchanged (no new menu badges, `119` Decision 26).
13. **Brand icons on the dark chrome sit on a cream rounded tile** (owner, 2026-10-23). The icon artwork is dark green and would vanish on `#0a2e1d`, so the side menu, bottom bar and Menu sheet draw the existing rounded tile with a cream base (`iconTileBase` gains an `onDark` option). Sizes, padding and the tile radius from `080` are unchanged.
14. **Overview `NavTile` and `KeyFigureTile` icon tiles stay as they are** (owner). Only their numerals and headings take the display face, through `keyFigureValueSx` and the shared heading pieces.
15. **The platform default `primary.main` moves from `#2f6e4f` to `#14633F`** (owner), closer to the console. `primary.dark` is re-tuned by hand to keep the same relationship (`#0F5132` unless the contrast test asks for darker) and `contrastText` stays white. `withClubBranding` keeps its "default colour returns the base theme" shortcut against the new value. A club with a stored colour keeps it unchanged; only clubs on the platform default see the new green. The token table, the Keycloak CSS copy and every test or story fixture that hard-codes `#2f6e4f` are updated.
16. **The mockup's roomier card density is accepted** (owner): 40 px counter numerals, larger card names, the extra card height on Players, Teams, Matches and Leagues. No other spacing change.
17. **The platform admin `AppShell` takes the dark chrome too** (owner), header and drawers (selected row gold, display-face labels), so the whole signed-in app is one product.
18. **The club logo is always shown on a white rounded tile on the dark header** (owner). The tile radius is 6 px; a logo that is white on transparent is therefore never shown bare. With no logo, the initials fallback sits on the same white tile.
19. **Gold avatars everywhere an avatar appears** (owner), including `RecordIconButton`, the `TeamCard` sponsor row, `AvatarMenu`, `ShellHeader` and detail-page headers (the sizes in `design-system.md` are unchanged).
20. **The Keycloak login theme moves its form text from Inter to Barlow** (owner). The three Barlow body files (and their Latin Extended pair, Decision 21) are copied into `keycloak/themes/cricketlegend/login/resources/fonts/`, `cricketlegend.css` swaps its `@font-face` and body stack, the Inter files and `OFL-Inter.txt` are removed once nothing references them, `OFL-Barlow.txt` is added, and `keycloak/README.md` and its font list are updated. It stays plain CSS with no third-party request, and the token block stays a hand-kept copy; the new default primary (Decision 15) is copied into it if it uses the green.
21. **Fonts include Latin Extended** (owner). Each of the five weights ships a Latin file and a Latin Extended file, with `unicode-range` splits so the browser fetches the extended file only when a glyph needs it; only the two Latin display files are preloaded. Player names with diacritics therefore render in Barlow.
22. **A club colour that fails contrast falls back to `primary.dark` for text; it is not rejected at save** (owner). Anywhere `primary.main` is used as text or a thin control edge on a white or cream ground (links, outlined buttons, text buttons, selected counter text, active tab text), a shared theme helper picks `primary.main` when it meets 4.5:1 (3:1 for edges) on that ground and otherwise `primary.dark`, as the charts already do (`117`). Fills (contained buttons, chips, tints) keep the club colour with `getContrastText` text. The save-time rule in `001` ADR-05 is unchanged. If `primary.dark` also fails on a very light colour, the helper darkens it until it passes, so no accepted colour can produce unreadable text.

## Problem & Goals

The signed-in manager screens (club-colour header, white side menu, white-to-tint wash, system font) and the new dark player console (deep greens, gold, cream, condensed Barlow) look like two different products to the owner, although one person is often both a manager and a parent (`119` Decision 7). A manager who also has players moves between the two in one session. The manager screens are dense data, so the fix is not to make them dark: it is to share the console's colour and type identity in the chrome and the page-level touches, and leave the light body alone.

Goals:
- The manager header, side menu, bottom bar, Menu sheet and footer read as the same product as the player console (colour, font, gold selected state).
- Page titles, menu labels, counter numerals, card names and avatar initials use the condensed display face; body copy uses Barlow.
- One source of brand tokens for both views, one copy of the font files in `ui/`.
- Per-club colour continues to work on the body, with readable contrast guaranteed for every club colour (Decision 22).
- No behaviour, layout, filter or button change; no regression in accessibility.

## Non-goals

- **No dark manager body.** Tables, forms, dialogs, scorecards and charts stay light (the owner's choice: dense data reads better light). A dark body is not on the roadmap.
- **No "game mode"** (the console's cricket-scene backdrop, glass panels, dark fields). Not borrowed.
- **No layout, filter, button or copy change.** The Players list stays Cards | List with the same filters and the same buttons. Only card density changes (Decision 16).
- **No change to the player console** beyond importing shared tokens (Decision 4).
- **No change to club branding fields.** `ClubBranding` stays the closed set (logo, favicon, display name, primary colour). No "header colour" field is added, and no new save-time rejection (Decision 22).
- **No per-club header colour option.** Rejected for now (Decision 1); revisit only if a club asks and the contrast cost is understood.
- **No Keycloak change beyond the font swap and the token copy** (Decision 20): no layout, copy or flow change on the login pages.
- **No new npm dependency, no CDN, no icon system change.** Brand icon artwork is not redrawn (Decision 13 only changes what it sits on).
- **No redesign of Overview tiles, `KeyFigureTile` or `NavTile`** (Decision 14).
- **No time zone, dark-mode (OS preference) or theme switcher.** The mockup's `prefers-color-scheme` demo block is not part of the product.

## User Stories

- As a club manager who is also a parent, I see the same greens, gold and type in the manager view and in "My players", so it feels like one product.
- As a club manager on a phone, the bottom bar and Menu sheet match the header, with the current page clearly marked in gold.
- As a club admin with a light primary colour (for example gold), my buttons and counters keep my colour, my links and outlined text stay readable on the cream body, and my club name and logo are readable on the dark header.
- As a user who relies on keyboard or screen reader, every header and menu control has a visible focus ring and a name, and the selected page is announced.
- As a user on a slow connection, the page does not jump when the display font loads (preload plus swap with a similar-width fallback) and no request goes to a third-party font host.
- As a parent whose child has a name with diacritics, the name renders in Barlow, not a fallback face.

## Data Model Changes

None. No migration, no `ClubBranding` field.

## API Contract

None. No endpoint changes; `openapi.yaml` is untouched.

## UI Requirements

Composed from existing pieces; the change is tokens and chrome, not new components.

**Tokens (`ui/src/brandTokens.ts`, `ui/src/theme.ts`).**
- `brandTokens.ts` (new, Decision 3). `theme.ts` reads it for: `typography.fontFamily` (Barlow stack), a custom `typography.fontFamilyDisplay` (module augmentation, like `purple`), `shape.borderRadius: 6`, `background.default` cream ground colour, `primary` (Decision 15), and a `chrome` palette key (`header`, `menu`, `menuLine`, `text`, `selected`, `selectedBg`) augmented onto `Palette` and never varying per club.
- `withClubBranding` is unchanged in what it overrides (primary only). A new theme helper (for example `readablePrimary(theme, ground, kind)`) implements Decision 22 and is used by the shared link, text-button, outlined-button and counter styles.
- `pageBackgroundGradient` returns the fixed cream gradient (Decision 10). Its signature stays so the three shells need no call-site change.
- Headings: only the page-title, section-title and card-name usages named in Decision 8 take the display face (through shared pieces: `PageHeaderBand`, `RecordFormScreen`, `ManageScreenHeader`, `RecordCard` title, `keyFigureValueSx`, `avatarSx`, `InfoCard` heading). `h1` to `h6` and body variants are otherwise unchanged. Tabular numerals (`font-variant-numeric: tabular-nums`) are checked against the Barlow files (standings, scorecards); if a file lacks `tnum`, checkpoint C either keeps the feature in the subset or sets those figures in the fallback body face.

**Fonts.** `ui/public/fonts/barlow-condensed-{latin,latin-ext}-{600,700}-normal.woff2`, `barlow-{latin,latin-ext}-{400,500,600}-normal.woff2`, `OFL-Barlow.txt`; `@font-face` in the app's global stylesheet with `unicode-range` per subset; `<link rel="preload" as="font" type="font/woff2" crossorigin>` for the two Latin display weights in `ui/index.html`.

**Shell chrome.**
- `ShellHeader` (tone brand): `#0B3D26`, cream text, brand name in the display face (19 px), the club logo on a white 6 px tile (Decision 18), bell and `AvatarMenu` with a gold disc and dark green initials. The `AvatarMenu` dropdown reuses `darkMenuProps` from the console (moved beside the tokens).
- `SideMenu`: `#0a2e1d`, right border `rgba(247,243,232,.14)`, 232 px and the 64 px rail unchanged; labels 17 px display face uppercase; group headings 11 px uppercase; selected row gold text on `rgba(232,184,61,.16)` with `aria-current="page"` and bold, hover `rgba(247,243,232,.08)`, cream focus ring; icons on a cream tile (Decision 13). Badges per Decision 12.
- `BottomTabBar`: dark bar, cream labels in the display face, selected tab gold, cream icon tiles, safe-area padding unchanged.
- `MenuSheet` (on `BottomSheet`): dark paper, cream handle and close button, group headings and tile labels in the display face, tiles as dark raised panels with a gold outline when current. `BottomSheet` takes a `tone` prop (`light` default, `dark`) so the light Filters sheet is unaffected.
- `Footer`: `#0B3D26`, cream 12 px text, no top border.
- `AppShell` and `BottomTabShell`: per Decisions 11 and 17.

**Page-level touches (checkpoint B).** Counter numerals and labels (`keyFigureValueSx`, `PageCounters`); `RecordCard`, `PlayerCard`, `TeamCard` and detail-page titles and avatars; `PageHeaderBand` titles; the tab strip (`utils/viewTabs.ts`) and `segmentedSwitchSx` text in the display face where the mockup shows it, selected state still the club primary tint; card border `#d8dfd2` and 6 px radius via the theme. Nothing else is restyled.

**Responsive.** Mobile-first at 375 px; chrome heights stay (56 px phone, 64 px from `md`); display titles 32 px on a phone, 40 px from `md`; the rail, full menu and bottom bar breakpoints (`md`, `lg`) are unchanged.

## Test Plan

Per `docs/standards/testing.md`, a UI-only change needs the frontend tiers; no backend or contract test.

- **Unit (Vitest, Testing Library):**
  - `theme.test.ts`: `fontFamilyDisplay`, `shape.borderRadius` 6, default `primary.main` `#14633F`, `chrome` tokens exist and do not change under `withClubBranding`; `pageBackgroundGradient` is club independent.
  - **Contrast test** (extends the pattern of `PageCounters.test.tsx`): for the platform default and a set of club colours (the existing branding fixtures plus gold `#F2C94C`, red, navy, near-white), assert `readablePrimary` yields 4.5:1 text and 3:1 edges on white and on the cream ground (falling back to `primary.dark`, and darkening further if needed), contained-button text via `getContrastText` meets 4.5:1, gold on `#0a2e1d` meets 4.5:1, cream on `#0B3D26` and `#0a2e1d` meets 4.5:1, the cream-ringed badge edge meets 3:1, and the cream icon tile against `#0a2e1d` meets 3:1.
  - `ShellHeader`, `SideMenu`, `BottomTabBar`, `MenuSheet`, `Footer`, `ManagerShell`, `AppShell`, `BottomTabShell` tests updated: `aria-current` on the active item, focus-visible outline present, rail tooltips and `aria-label`, badge names, bell link, no `tone="plain"` caller left.
  - `brandTokens.test.ts`: `BACKDROP_COLOURS` and `HUB` equal the shared module values (one copy), and the Keycloak CSS block's hex values match (reads the CSS file; fails if they drift).
  - Font test: the shared Barlow files in `ui/public/fonts` are byte-identical to the Keycloak theme's copies; every `@font-face` URL resolves to a committed file; `index.html` preloads exactly the two Latin display weights; no `fonts.googleapis.com` or `gstatic` string under `ui/` or `keycloak/` (an `rg` gate in CI or a test); the Keycloak CSS no longer references Inter.
- **Storybook:** stories per Decision 6, viewports 375, 768, 1280, checked with the a11y addon; light-primary-club and long-name variants included.
- **E2E (Playwright, existing tier):** one smoke run of the manager shell at 375 and 1280: header, menu (or bottom bar and sheet), a list page; assert no request to a third-party host, the active item exposes `aria-current`, Tab reaches the menu and shows a focus ring, and a `prefers-reduced-motion` context opens the Menu sheet without animation. Not run by default in this repo (noted in earlier specs); to be run once before merge.
- **Manual:** screenshot sweep of Overview, Players (cards and list), Matches, Availability hub, Result wizard, Club profile, Access, Fields, a dialog and a Filters sheet at 375 and 1280 for a platform-default club, a gold club and a red club; compare with the mockup's Proposed look and the console; check the Keycloak login page in Barlow.

## Acceptance Criteria

1. On `/manage` at 1280 px for any club, the header is `#0B3D26`, the side menu `#0a2e1d`, the footer `#0B3D26`, whatever the club's primary colour; the club's colour appears on primary buttons, links and selected counters only.
2. The current menu item shows gold text on the gold tint, has `aria-current="page"` and is bold; gold on the menu meets 4.5:1 (asserted in a test).
3. Page titles, menu labels, counter numerals, card names and avatar initials render in Barlow Condensed from `ui/public/fonts`; body text renders in Barlow; the network log shows no request to a font CDN and the two Latin display weights are preloaded; a name with diacritics (for example "Zoë Müller", "Łukasz") renders in Barlow.
4. With the files blocked, the page renders with the fallback stack with no broken text.
5. At 375 px the bottom bar and the Menu sheet are dark with the same type and gold current state; the Filters sheet and other `BottomSheet`s stay light.
6. Avatars everywhere are gold with dark green initials; photos and logos are unchanged.
7. The page ground behind cards is the cream gradient for every club; cards stay white with a 6 px radius.
8. `HUB`, `BACKDROP_COLOURS` and `theme.ts` read the greens, gold, cream and font stacks from `ui/src/brandTokens.ts`; no hex for these colours is declared a second time in `ui/src` (grep gate), and the player console renders unchanged apart from the real condensed face.
9. A club with a light primary colour (gold) has readable links, text buttons and outlined buttons on white and cream (text falls back to `primary.dark`), keeps its colour on contained buttons and chips, and no save-time rejection is added.
10. Every header and menu control has a visible focus ring at 3:1 or better, and `prefers-reduced-motion` stops the sheet and hover animation.
11. No layout, filter, button label or route changes on any page (existing page tests pass unmodified apart from colour, font and role queries).
12. `AppShell` and `BottomTabShell` use the new chrome; `tone="plain"` no longer exists.
13. Brand icons in the side menu, bottom bar and Menu sheet are visible on a cream rounded tile; Overview `NavTile` and `KeyFigureTile` icon tiles are unchanged.
14. A club on the platform default sees `#14633F` buttons; a club with a stored colour is unchanged.
15. The Keycloak login pages render in Barlow and Barlow Condensed, load no Inter file and make no third-party request.
16. `design-system.md` documents the tokens, type, shape, chrome, avatar and primary rules in the same PR, and `CLAUDE.md`'s tech stack row mentions the self-hosted Barlow files as an approved addition (fonts, not a UI library).
17. `package.json` gains no dependency; the font files are the only added binary assets.

## Rollout Notes

No feature flag: a theme change ships whole per checkpoint, behind the normal PR. The look changes for all clubs on release; tell club admins in the release note that header colour is now fixed and their colour applies to buttons and accents. Rollback is a revert (no data change). No deferred item arises from this spec, so `docs/roadmap.md` is not changed (the dark-body and per-club-header-colour ideas are Non-goals, not planned work).

**Implementation outline by checkpoint** (build first, tests and review after the owner has looked, per the standing working rule):

- **A: tokens, font, header, menu, footer chrome.** Add `brandTokens.ts` and repoint `BACKDROP_COLOURS`/`HUB`; add the font files (Latin and Latin Extended), licence, `@font-face`, preload; update `theme.ts` (typography, shape, `chrome`, cream ground, new default primary and the `readablePrimary` helper); restyle `ShellHeader`, `AvatarMenu onBrand`, `SideMenu`, `Footer`, `AppShell` (header and drawers); `NavItemIcon` cream tile on dark; `ManagerShell` wiring. Result visible at desktop width on `/manage`; owner checks.
- **B: bottom bar, Menu sheet and page-level touches.** `BottomTabBar`, `MenuSheet`, `BottomSheet tone`, `BottomTabShell`; `avatarSx` (gold, everywhere), `PageHeaderBand` and form titles, `keyFigureValueSx`/`PageCounters`, `RecordCard` and sibling card titles and density, tab strip and switch text, card border and radius, shared link and button styles through `readablePrimary`; the Keycloak font swap (Decision 20). Owner checks phone and the Players page against the mockup.
- **C: contrast and responsive pass, tests, stories, docs.** Contrast test; tabular-figure check on standings and scorecards; 200 percent zoom and 375 px sweep; reduced motion; stories (Decision 6); test and fixture updates for the new default primary; Playwright smoke; `design-system.md`, `CLAUDE.md` tech row; remove `tone="plain"`; run `design-token-sync` and the Claude Design project push (or log the follow-up in `docs/roadmap.md`).

## Open questions

None, all answered 2026-10-23 (Decisions 13 to 22).
