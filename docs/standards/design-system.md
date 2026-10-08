# Design System

Screens are composed from a library, not invented per page — the mechanical fix for "screens aren't mobile-friendly and UX isn't consistent." Built on **Material UI (MUI) v5** — the same library the original Cricket Legend app used (`ui/src/theme.ts`, `createTheme`) — not a hand-rolled utility-CSS system. See `docs/standards/frontend.md` for component anatomy and `docs/specs/001-tenancy-identity-model.md`'s White-Labelling section for how per-club branding layers on top of this.

## Workflow

1. **Tokens** — colour, type scale, spacing unit, and breakpoints, defined once in `ui/src/theme.ts` via MUI's `createTheme()`. This is the single source both Claude Design and the app read from.
2. **Component library** — Button, Input, Card, Nav, EmptyState first; Table, Modal, and loading states next — thin wrappers around `@mui/material` primitives with our variants locked in, built once against the theme, before any real screen.
3. **Storybook** — every component gets a story with the viewport addon at 375/768/1280. Mobile-friendliness is visible per-component, not discovered on a phone after ship.
4. **Screens** — composed only from the library. A screen needing a new visual pattern spins that off as a library addition first, spec'd on its own.
5. **Record** — tokens + component specs checked into this file; the `design-token-sync` skill keeps it and the code in lockstep.

*(Tokens and the first five components are done — see below and `ui/src/components/`. Table, Modal, and loading states are next.)*

## Record list / create-edit pattern

**Every screen that lists records and/or creates/edits one uses this pattern — not a per-screen layout.** Established via `docs/specs/008-product-catalog.md`'s Products screens (the reference implementation) after manual review found ad-hoc list screens inconsistent (no search/sort, inline "add" tiles cluttering record grids, no Back action, forms stuck at mobile width on desktop). Three components, `ui/src/components/`:

| Component | Use |
|---|---|
| `ListToolbar` | Header above any record list/grid: search (debounced into a backend query, never client-filtered), a sort control (backend-driven — selecting an option re-fetches with a new `sort` param, never client-side re-order), and the primary "Add `<Record>`" action. The create action lives here, never as a tile inside the record grid. |
| `RecordCard` | Grid unit for a record list. Fixed slot order: an optional leading avatar (photo/logo, falling back to initials or a fixed icon — `circular` for a person-shaped record, `rounded` for an organisation/named-thing a logo belongs to) + title + status badge, a required description (2-line clamp), a row of key fields, an optional row of attribute chips, then a footer edit action. The card itself carries a light ~5% `primary`-tinted background (`alpha(theme.palette.primary.main, 0.05)`) rather than plain white, and its footer Edit/secondary actions render a leading icon (e.g. `EditOutlined`, `ToggleOff`/`ToggleOn` for deactivate/reactivate, `LinkOff` for unlink) — real user feedback that an all-white card grid with text-only footer actions read as bland and easy to miss. `NavTile` (dashboard nav cards) uses the same tint plus an icon tile for the same reason. Every avatar/logo/initials-fallback across the app — this card's own avatar, `RecordDetailScreen`'s header, `TeamCard`, the new `PlayerCard`, `RecordIconButton`, `ShellHeader`'s club logo, and `AvatarMenu` — renders with a solid `primary.main` background and white (`primary.contrastText`) text via the shared `avatarSx(size, fontSize?)` helper exported from `RecordCard.tsx` (alongside `badgeSx`), not a per-site hand-rolled tint. A record's own primary avatar (a list-card avatar or a detail-page header avatar alike) is always 56px — one size for both contexts, not two; smaller "icon button" contexts (`RecordIconButton`'s quick-view grid, `TeamCard`'s sponsor-logo row, `ShellHeader`'s club logo, `AvatarMenu`, `TeamDetailPage`'s dense `SquadPlayerTile` grid) keep their own smaller sizes, recolored only. |
| `RecordFormScreen` | Wrapper for any create/edit screen: a visible Back action above the title (plain header on the page wash, title in the Overview greeting's `h5`/700 style — 081), a responsive field grid (single column at `xs`, two columns from `md`, long-form fields spanning both), and an actions bar below a divider. Desktop uses the available width instead of staying a centered mobile-width column. |
| `ManageScreenHeader` | Header for any `/manage` screen that is a bare list or other non-form layout — i.e. NOT already wrapped in `RecordFormScreen` (which bundles its own back-action-plus-title). Renders the page-title `<h1>` `RecordFormScreen` uses (plain header on the page wash — no band, accent line or shadow; 081), plus a Back action only when `backTo` is passed (079), so every `/manage` screen carries a title whether or not it happens to be a form. |

### Card building blocks (`docs/specs/071-league-card-redesign.md`)

Extracted from the Match card (`069`) so the League card and any later card reuse them:

| Component | Use |
|---|---|
| `DetailLine` (`ui/src/components/DetailLine`) | One stacked detail line inside a `RecordCard` body: small icon, fixed-width label, value. `value` is a `ReactNode` (text, or text plus a non-interactive badge); `labelWidth` defaults to 56 (Match card), the League card passes 78; `muted` renders a secondary-colour regular-weight placeholder such as "Not scheduled yet". Stack lines with `Stack spacing={1.25}`. |
| `CardProgressBar` (`ui/src/components/CardProgressBar`) | The 10px rounded `grey.400` track with a `primary.main` fill and `role="progressbar"` (`value`, `max`, `ariaLabel`, `valueText`); `value` is clamped to `0..max`, `max` 0 renders empty. Used by the Match card's Selection block and the League card's "Matches played" block. |

Sorting/search are backend-driven, consistent with pagination's existing rule below — a list screen never filters or sorts a fetched page client-side. New list/CRUD screens (Subscriptions, Discounts & Promotions, Invoicing, System Settings, and manager-side screens) compose from these three directly; a genuinely new visual need gets a library addition first, per the Workflow step above — not a fork of this pattern.

**Every `/manage` screen must render a page title — no exceptions by omission.** `ManageScreenHeader` exists specifically because `ClubContactList.tsx` and `SponsorList.tsx` each independently hand-rolled just the Back button and silently dropped the title, while `ManageClubProfilePage.tsx` (built on `RecordFormScreen`) had one for free — the inconsistency was only caught by a user screenshot, not review. A screen wrapped in `RecordFormScreen` already satisfies this via that component; every other bare `/manage` screen (list, tree/org-chart editor, dashboard-adjacent view) renders `ManageScreenHeader` instead of a local back button. Do not hand-roll a Back button/title pair — extend `ManageScreenHeader` if it doesn't fit rather than duplicating it a fourth time.

## Manager shell and header (`docs/specs/079-manager-shell-and-overview.md`)

- **`ShellHeader tone="brand"`** is an opt-in club-colour header: solid `primary.main`, `primary.contrastText` text, the club logo on a white (`background.paper`) tile, and `AvatarMenu onBrand` (a translucent `primary.contrastText` disc, since the default avatar is the same colour as the header). Only the manager shell opts in; the admin and player shells keep the default white header with a divider. `withClubBranding()` derives `light`/`dark`/`contrastText` for a club colour (so a light club colour gets dark header text); the platform default keeps its hand-tuned values.
- **`ManagerShell`** (`components/ManagerShell`) lays out the header, `SideMenu` (232 px from `lg`; a 64 px icons-only rail from `md` with tooltips and `aria-label`; absent below `md`), the `<main>` with `pageBackgroundGradient`, and the `Footer`. Below `md` it renders `BottomTabBar` (Home, Matches, Polls, Players, Menu) and `MenuSheet` (a bottom `SwipeableDrawer`, grouped tiles with 40 px `BrandIcon`s, closes on choosing a destination) instead.
- **One nav config**: `components/ManagerShell/managerNav.ts` feeds the side menu, bottom bar, Menu sheet and the Overview tile grid. The active item is resolved by route prefix (first match in menu order), so a nested route such as a match edit page keeps Matches highlighted. Menu icons are bare 36 px brand icons (no tile) in the side menu, 40 px tiled icons in the Menu sheet and 32 px tiled icons in the bottom bar (078 + 080 rules); Overview uses a MUI home glyph on a primary disc until `nav/overview.svg` exists.
- **Back links**: `ManageScreenHeader` has no default `backTo`; no `backTo` means no back link (the persistent menu replaces "Back to Dashboard"). Pass `backTo`/`backLabel` only for a meaningful parent (a parent record or the Club Profile).

**Page header (`PageHeaderBand`, `docs/specs/081-plain-page-header-and-counters.md`, amends 046).** `PageHeaderBand` is a plain container used by `RecordDetailScreen`, `RecordFormScreen`, `ManageScreenHeader` and the detail pages: title left, page actions right, directly on the page wash, with only a small bottom gap (`mb` 2/3). No band background, top accent line, shadow, rounded corners, negative bleed margins or border. Titles match the Overview greeting (`variant="h5"`, `fontWeight` 700). `headerBandShadow` was removed from `theme.ts`.

**Page counters (`PageCounters`, `ui/src/components/PageCounters`, `docs/specs/081-plain-page-header-and-counters.md`).** A row of key-figure cards directly under a page header, for the few numbers a manager needs before reading the list (first use: the Availability Polls view). Use it for at most four counters; a counter that needs attention takes `tone: 'warning'` (the theme warning colour on the value, always paired with its label), the one the list below is filtered to takes `active` (a subtle `primary` outline), and a counter that also filters passes `onSelect` (and a `hint` such as "Tap to filter"), which renders it as a real button with a visible focus ring (a toggle with `aria-pressed` for `kind` `'filter'` and `'reset'`, see below). Layout is two by two below `md`, four across from `md`; `density="compact"` (085, the Availability Polls page) renders one-line cards about 44 px tall with a 6 px gap, `comfortable` stays the default; `loading` renders four skeleton cards of the same size, so nothing jumps. The card style is the Overview key-figure card, defined once in `components/PageCounters/keyFigureStyle.ts` (`keyFigureCardSx`, `keyFigureValueSx`) and used by both `ManagerOverviewPage`'s `KeyFigure` and `PageCounters`, so the two cannot drift. A page hides the row if its summary request fails rather than showing an error. **Kinds of selectable counter (`docs/specs/084-clickable-counters.md`).** `kind: 'filter'` (the default) narrows the list below: a toggle button with `aria-pressed`, a small uppercase "filter" tag top right (0.66rem), and `active` while on. `kind: 'reset'` is the same toggle without the tag, for the card that clears the filters (hint "Show all"). `kind: 'drill'` opens something else (e.g. a list of players): a plain button with a `›` top right and no `aria-pressed`. The tag and chevron are decorative (`aria-hidden`); the `hint` ("Tap to filter", "Show all", "See who") is kept for assistive technology and visually hidden. All lift (shadow) and tint 5% towards `primary` on hover (hover-capable pointers only; `selectableCardSx` and `hoverTintColor` in `keyFigureStyle.ts`). Zero rule: a selectable counter whose figure is 0 ("0", "0 / 24") renders as a plain card (no marker, not a button) unless it is the active filter, which stays a pressed button so it can be switched off. `PageCounters.test.tsx` asserts `primary.main` clears 4.5:1 against the card colour and against the hover-tinted card colour computed from the theme.

**Players panel (`PlayersPanel`, `ui/src/pages/manage/availability/PlayersPanel`, `docs/specs/084-clickable-counters.md`).** The list behind the Availability Polls page's two players counters. A `BottomSheet` below `sm`, the repo's first right-anchored MUI `Drawer` (420 px, Escape, backdrop, close button, focus trap, focus back on the counter) from `sm`. Two tabs, "Responded · N" and "Still to answer · N" (N = the counter figures, which the 48-hour filter does not change, so with that filter on the list is narrower than N and the scope line says "closing within 48 hours"; pre-selected by the clicked counter), a debounced name search, one row per player (name, poll count; the poll links sit under the name on a phone with 44 px targets, and expand on demand on desktop), each poll a link to its Responses page via `utils/pollRoutes.ts`, a "Show more" button (25 per page), and the page's own "Showing: ..." scope line. Loading is skeleton rows inside the panel; empty reads "Everyone has answered." / "No answers yet."; an error reads "We couldn't load the players." with Retry and leaves the counters and list alone. Open state and tab are local state in `AvailabilityHubLayout`, not in the address. Reuse it for other counter drill-downs by adding a prop rather than copying it.

**Filter bar (`FilterBar`, `ContentControlsLine`, `docs/specs/083-availability-filters-and-toolbars.md`).** The toolbar of the Availability views. `FilterBar` shows the shared filters whose options are passed, always in the order League, Section (`SectionTreeSelect`, `allowClear`), Team, then search, in the `filterPanelSx` card. Below `sm` (`useMediaQuery(..., { noSsr: true })`) the card shrinks to search plus a "Filters" button with a count badge (`aria-expanded`, name "Filters, N active"); the button opens the shared `BottomSheet` (`components/BottomSheet`: a bottom `SwipeableDrawer` with rounded top corners, handle, optional title and close button, also used by `MenuSheet`) holding the same fields stacked full width, the view's own controls through `viewControls`, "Clear all" and "Done" and active choices show as removable chips under the card (outlined `Chip`, `small`, `background.paper` fill, `primary.dark` bold text, border `alpha(primary.main, 0.35)`; `extraChips` adds view-specific ones, e.g. "Group polls only"). `ContentControlsLine` is the line above a view's content: scope text ("Showing ...") on the left, the view's toggles on the right (`components/CompactSwitch`: a small `Switch` with a caption-size label, the one toggle style of the Availability pages (085); the sheet's view-controls row is at least 44 px high on a phone), and `SortLink` ("soonest first" with an arrow) as a quiet text link inside the scope text; below `sm` only the scope text and `pinned` controls remain, the rest being in the sheet. **Players view layouts (`docs/specs/085-availability-polish.md`).** From `sm` the Players view is the grid (`AvailabilityGrid`), sized to the window by `hooks/useFillViewportHeight` so the page does not scroll with it, the one-row `Legend` above it, and Jump to today as the hub header's action (registered by the view through `hubContext`'s `jumpToToday` slot, rendered by `AvailabilityHubLayout`). Below `sm` it is `PlayersPhoneLists`: a By game | By player switch (`segmentedSwitchSx`), By game first, opening on the first game of the next game day, with arrows and swipe (`hooks/useSwipe`), answer chips that filter, and 44 px rows; By player shows a `CellMark` per game for the next four games and expands to all of a player's games, with the legend ("No poll" wording) under the switch. The Responses pages show a `ResponseGauge` in the header instead of a Summary tab. 

There is no season control on any availability view: Players and Coverage always use the default season. `ListToolbar` is unchanged and stays for other list pages.

## Brand icons (`docs/specs/078-brand-icon-set.md`)

The product's own colour icon set (dark green circular badges) lives in `ui/src/icons/<group>/<name>.svg` (`nav`, `roles`, `stats`, `people`, `actions`, `field`, `brand`). It is an approved addition alongside MUI, not a second icon system.

- **Use the set at 32 px and larger**: dashboard nav tiles (`NavTile`'s `brandIcon`), role badges, player avatars with a recorded gender and no photo, and dialog headers. Icons under 32 px (buttons, chips, inline `DetailLine` icons, menus) stay `@mui/icons-material`.
- **Render only through `components/BrandIcon`** (`<BrandIcon name="nav/teams" size={40} />`). Nothing else imports from `src/icons`, and SVG markup is never inlined in JS. `BrandIconName` is derived from the files via `import.meta.glob`, so a new SVG is available automatically.
- Decorative by default (empty `alt`, `aria-hidden`); pass `alt` only when the icon is the sole label.
- **Artwork only, tile drawn by the component** (`docs/specs/080-brand-icon-surfaces.md`): the SVGs carry no background circle or highlight, so `BrandIcon` draws one rounded tile (radius 10 px) behind each icon by default (`surface="tile"`; `surface="none"` gives the bare image). Tile outer size is `size + 2 x padding` (padding default 4, so 40 px icon on a 48 px tile). Surfaces: Menu sheet 40 px, role chips 28 px with 3 px padding (chip height 40), bottom bar 32 px with 3 px padding, overview card headers 28 px with 4 px padding, `NavTile` and announce dialog 40 px. `active` adds an optional 2 px white ring. Avatars are not tiled; they use `avatarSx`.
- **Side menu has no tile** (option C, chosen 2026-10-06): bare `surface="none"` icons at 36 px (rows about 44 px). The panel itself carries a solid tint, `alpha(primary.main, 0.09)` laid over white (not transparent over the page wash), with its right border kept; the active row is `alpha(primary.main, 0.16)`, bold, `primary.dark` text, no ring; hover is 0.08. The collapsed rail is 64 px.
- **Cropped artwork**: the nav, roles, stats and actions SVGs have built-in empty margin, so `viewBox` is `24 24 208 208` (people, field and brand keep `0 0 256 256`). The strip script applies the crop.
- **Tile colour** is `alpha(base, 0.36)` over the surface, where `base` is the club's `primary.main`, or `primary.dark` when `getContrastText(primary.main)` is not white (the same rule that turns the header text dark, so light club colours such as gold keep the artwork visible). Helper: `components/BrandIcon/iconTileBase.ts`.
- **Adding or converting an icon**: originals with the baked-in background are kept in `ui/design/icon-originals/<group>/`; run `npm run icons:strip` (or `node scripts/strip-icon-background.mjs <file>`) on a new SVG to remove the background rect and highlight circle and crop the viewBox (restore from `icon-originals` first to re-derive). It is idempotent and skips `src/icons/brand/`. The PNG exports in `ui/design/icon-exports/` keep the old background and are reference copies only.
- The favicon set in `ui/src/icons/brand/` is the source; copies live in `ui/public/` and are linked from `ui/index.html`.

## Two token layers

Per-club white-labelling means the token system has two layers, not one:

| Layer | Set at | Varies per club? | Examples |
|---|---|---|---|
| Structural tokens | Build time, `ui/src/theme.ts` | Never | Type scale, spacing unit, breakpoints, semantic colours, shape |
| Brand tokens | Runtime, per request | Always | Logo, favicon, display name, primary colour — the closed `ClubBranding` field set |

**Brand tokens stay a closed set.** The alternative — a club admin pasting in custom CSS — trades away everything this system is for: consistent components, accessible contrast, one shape per concern. A brand colour that fails contrast against the base neutrals is rejected at save time, not shipped.

**Runtime override mechanism:** `ui/src/theme.ts` exports `withClubBranding(primaryColor)`, which calls `createTheme(baseTheme, { palette: { primary: { main: primaryColor } } })` — MUI deep-merges this over the base theme, so every component styled through `theme.palette.primary` (which is all of them, via MUI's own theming) picks up the club's colour automatically. No CSS variable injection needed; this is MUI's own supported composition pattern.

## Token table

Source of truth: `ui/src/theme.ts`. Browsable in Claude Design (see below) and this table — the `design-token-sync` skill keeps all three in agreement.

### Colour (`theme.palette`)

| Token | Value | Use |
|---|---|---|
| `text.primary` | `#14231C` | Primary text |
| `text.secondary` | `#52655C` | Secondary text, captions |
| `background.default` / `background.paper` | `#FFFFFF` | Page / card background |
| `divider` | `#DEE6E1` | Hairlines, card borders |
| `primary.main` | `#2F6E4F` | Platform default brand colour — **the one token `ClubBranding` overrides at runtime** via `withClubBranding()`, everything else here never varies per club |
| `primary.dark` | `#234F39` | Primary hover/active state (MUI derives this automatically unless overridden) |
| `success.main` | `#0E7C66` | Confirmations, positive results |
| `warning.main` | `#B7791F` | Non-blocking warnings |
| `error.main` | `#B0402E` | Destructive actions, validation errors |
| `info.main` | `#2563AC` | Neutral informational states |
| `purple.main` / `purple.dark` | `#7B5CC4` / `#5B3D99` | Structural token (custom palette key, never varies per club) for the league `format` badge tone only: fill `alpha(purple.main, 0.10)`, border `alpha(purple.main, 0.5)`, text `purple.dark` |

Semantic colours are deliberately a different hue family from `primary` so brand and state never read as the same signal.

`RecordCard` badge tones (`RecordCardBadgeTone`) are always paired with their text label, never colour alone. Beside the general tones and the poll tones (`squadPoll`, `groupPoll`, `open`, `closed`, `side`, `noPoll`), the league badges add `format` (purple, above), `season` (warning tint) and `active` (success tint); the team-count badge reuses `side` and Inactive reuses `muted`.

### Type (`theme.typography`)

Single UI-optimised system font stack for both headings and body — no separate display face. This is a dense, stats-heavy product (scorecards, tables of overs/runs/wickets) read mostly on a phone; legibility at small sizes wins over a distinctive display face.

`fontFamily`: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`

MUI's default type scale (`h1`–`h6`, `body1`/`body2`, `caption`) is used unmodified rather than redefined — a deliberate decision not to fight the library's own well-tested scale. Tabular figures (scores, averages) use `font-variant-numeric: tabular-nums` via `sx`, e.g. the mono score display pattern in `UpcomingMatches`.

### Spacing & breakpoints

MUI's default spacing function (`theme.spacing(n)` = `n × 8px`) and default breakpoints (`xs` 0 / `sm` 600 / `md` 900 / `lg` 1200 / `xl` 1536) are used unmodified — matching the original Cricket Legend app's theme and avoiding a fight with the library's own scale. 375px remains the mobile-first *design baseline* — author unprefixed / `xs` styles at this width first per `docs/standards/frontend.md` — even though it isn't one of MUI's named breakpoints itself.

### Shape

`theme.shape.borderRadius: 8` — a single radius value applied across components by default (MUI multiplies it per-component as needed, e.g. `Chip` renders fully rounded). No separate custom radius tokens.

### Elevation

MUI's built-in `theme.shadows` (25-step array, used via the `elevation` prop) rather than custom shadow tokens. Our `Card` wrapper defaults to `variant="outlined"` (bordered, flat) rather than elevated — a deliberate flat, data-dense aesthetic; reach for `elevation` explicitly only where something genuinely floats above the page (menus, dialogs).

### Claude Design

Pushed to the "Cricket Legend Platform" design-system project for visual browsing, two groups:
- **Foundations** — Colour, Type, Spacing & Shape (values only; kept in sync via the `design-token-sync` skill whenever tokens change).
- **Components** — Button, Input, Card, Nav, EmptyState — static previews matching what's actually built in `ui/src/components/`, not just described. Push a matching preview for every new shared component alongside its `.stories.tsx` (`new-ui-component` skill), so this pane never drifts ahead of or behind the real library.
