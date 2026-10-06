# 078 — Brand Icon Set

**Depends on:** `docs/standards/design-system.md` (this spec amends its "MUI only" icon rule), 076 (role badges in the selection list)
**Status:** draft — the user has approved the look from the mockup (https://claude.ai/artifact/N6SH5sGp5fGV9LSzbVu4Xi) and asked for it to be applied. The user answered the scope questions on 2026-10-06 (see "Decisions").

## Problem & Goals

The app uses `@mui/icons-material` everywhere (about 70 files). They are generic outline glyphs, and the product has no visual identity of its own. The user created a custom set of 27 colour icons in Claude (dark green circular badges with cream, red and gold), plus a favicon set, and added them under `ui/src/icons/`.

Goals:
- A usable, documented home for the icon set, with one shared way to render it.
- The new favicon and app icons in place.
- The new icons on the navigation surfaces and role badges where their size and style work.
- A clear rule for when to use a brand icon and when to keep a MUI glyph, so future screens stay consistent.

## Non-goals

- Replacing every MUI icon. The brand icons are full-colour illustrations that are readable from about 32 px up; small inline icons (button leading icons, menu items, `DetailLine`, status glyphs) keep MUI.
- Theme recolouring. The set is not monochrome and does not use `currentColor`, so it will not follow the club's primary colour.
- Per-club custom icons. Club branding stays logo, favicon, display name and primary colour (see the brand tokens in the design system). Whether the platform favicon should yield to a club's own favicon is deferred.
- Creating new icons. Missing ones are made in Claude web in the same style and added later.

## User Stories

- As a club admin, I see the brand icons on the dashboard cards and in the navigation, so that the product feels designed.
- As a manager, I see role icons (captain, wicketkeeper, batter, bowler, all-rounder) on the team selection list, so that roles are recognisable at a glance.
- As any user, I see the Cricket Legend favicon in the browser tab and on my phone's home screen.

## Data Model Changes

None.

## API Contract

None.

## UI Requirements

**Assets and location**
- Source SVGs live in `ui/src/icons/<group>/<name>.svg`, grouped by how the app uses them: `nav/` (every dashboard and menu destination: upcoming-matches, cricket-leagues, teams, squads, cricket-players, availability-polls, club-structure, match-results, scorecards, photo-gallery, notifications, roles-permissions, and later club-profile and communication), `roles/` (captain, wicketkeeper, batter, bowler, all-rounder), `stats/` (stats-player, stats-team, stats-club, scorecard), `people/` (avatar-male, avatar-female), `actions/` (announce-team), `field/` (field-pitch, field-topdown) and `brand/` (the favicon set). Names inside a group do not repeat the group (for example `roles/captain.svg`). New icons go into the matching group.
- The 128, 256 and 512 px PNG exports are reference copies, not bundled, and live in `ui/design/icon-exports/<group>/`. Only SVGs are imported by code.
- The favicon set, now in `ui/src/icons/brand/` (`favicon.svg`, `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `android-chrome-192x192.png`, `android-chrome-512x512.png`, `site.webmanifest`) is copied to `ui/public/` in the build step and `ui/index.html` is updated with the matching `<link>` tags and the manifest. The existing `public/favicon.svg` is replaced.
- `index.html` has a placeholder `<title>ui</title>`; set a real product title while there.

**One shared component**
- A shared `BrandIcon` component (four-file anatomy: component, test, stories, `index.ts`) takes `name` (a typed union of the icon names, written with their group, for example `nav/teams` or `roles/captain`) and `size`, renders the imported SVG as an `img` with empty alt text when decorative, and takes an `alt` when the icon is the only label. Stories show every icon at 24, 32 and 48 px.
- Icons are imported as URLs through Vite, not inlined into the JS bundle.
- No component imports an icon file directly; everything goes through `BrandIcon`.

**Where brand icons are used (proposed)**
| Surface | Icon |
|---|---|
| Browser tab, home screen | favicon set |
| Manager dashboard cards (`NavTile`) at 40 px | Teams `nav/teams`, Players `nav/cricket-players`, Leagues `nav/cricket-leagues`, Matches `nav/upcoming-matches`, Results `nav/match-results`, Permissions `nav/roles-permissions`, Gallery `nav/photo-gallery`, Notifications `nav/notifications`, Squads `nav/squads`, Availability `nav/availability-polls` |
| Side and bottom navigation, 24 px or more | the same mapping |
| Selection list role badge (`TeamSelectionList`) | `roles/captain`, `roles/wicketkeeper`, `roles/batter`, `roles/bowler`, `roles/all-rounder`; 28 px |
| Person avatar fallback | `people/avatar-male` / `people/avatar-female` where gender is known |
| Announce team | `actions/announce-team` in the confirmation dialog header |
| Club structure page header | `nav/club-structure` |

**Gaps (no icon in the set)**: Club Profile and Communication on the dashboard. These keep their MUI icons until icons are made for them.

**Keep as MUI**: leading icons inside buttons, menu items, `DetailLine` icons, form and status glyphs, and any icon smaller than 32 px, unless a later review shows a brand icon holds up there.

**Design system change**: `docs/standards/design-system.md` and `CLAUDE.md`'s UI library row are amended: MUI remains the only component and styling system; the brand icon set is the one approved addition for illustrative navigation, role and favicon use, rendered through `BrandIcon`.

## Test Plan

Per `docs/standards/testing.md`:
- Component test for `BrandIcon`: renders the right source for each name, honours `size`, empty `alt` by default and a supplied `alt` when given, and the typed names cover every SVG file (a test that lists the icon folder against the name union so an added file cannot be forgotten).
- Existing tests for `NavTile`, the dashboards, `TeamSelectionList` and the shell are updated only where assertions depend on the old MUI icons (for example test ids or role queries).
- Storybook story for `BrandIcon` (all icons, three sizes).
- No Playwright change. A manual check of the favicon in Chrome, Safari and a phone home screen is listed in Acceptance Criteria.

## Acceptance Criteria

- All 27 SVGs are importable only through `BrandIcon`, and the typed name list matches the files.
- The browser tab shows the new favicon in Chrome and Safari, and "Add to Home Screen" uses the new app icon.
- The manager dashboard and navigation use the mapped brand icons; Club Profile and Communication keep MUI icons.
- Role badges on the selection list show the role icons at 28 px without clipping or blurring, on phone and desktop widths, in light and dark.
- No icon file is larger than needed for the bundle (each SVG is about 1 to 2.5 KB today) and no raster image is bundled into the JS.
- `docs/standards/design-system.md` and `CLAUDE.md` describe the brand icon rule.

## Decisions

Answered by the user on 2026-10-06:
- **Scope** as listed in the table above: favicon, dashboard cards, navigation, role badges, avatars, announce dialog, club structure header.
- **Role badge size: 28 px** (20 px was too small). The selection list row is adjusted to fit.
- **Results** uses `match-results`. `scorecards` is kept for a later, separate feature.
- **Avatars**: `avatar-male` / `avatar-female` where gender is recorded; otherwise the current initials circle. Contacts have no gender and **stay on initials**.
- **Favicon**: use the created platform favicon for now. Whether a club's own favicon overrides it is deferred (to be decided later, not part of this spec).
- **Missing icons** (Club Profile, Communication, anything else after review): the user will generate them in Claude web in the same style and add them to `ui/src/icons/nav/`. Until they arrive those screens keep their MUI icons.

## Rollout Notes

Small commits, in order: (1) assets, favicon and `index.html`, with the standards note; (2) `BrandIcon` component with test and story; (3) dashboards and navigation; (4) role badges and avatars. Each step is independently shippable, and MUI icons remain the fallback everywhere the brand set has no icon.
