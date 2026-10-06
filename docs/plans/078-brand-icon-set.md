# Plan 078 — Brand Icon Set

Implements `docs/specs/078-brand-icon-set.md` (draft, scope answered by the user 2026-10-06; look approved from https://claude.ai/artifact/N6SH5sGp5fGV9LSzbVu4Xi). Branch: `feature/078-brand-icon-set` (already holds the assets, the organised folders and the spec). Frontend only, no backend, API, data or migration change. All work is `frontend-builder` (code) and `test-writer` (tests and stories).

## Context

The app uses generic MUI outline icons everywhere. The user created 29 colour icons (dark green circular badges) plus a favicon set. The spec makes them the product's identity on navigation tiles, role badges, avatars, the announce dialog and the browser tab, while MUI stays for small inline icons. Assets are already in `ui/src/icons/<group>/` (nav, roles, stats, people, actions, field, brand) with PNG exports in `ui/design/icon-exports/`.

## Flags where the spec and the code disagree (need your decision)

1. **"Side and bottom navigation" has nothing to apply to for managers.** The manager shell (`GridNavShell`) has no menu; the dashboard cards are the navigation. The only menus are `Nav` (used by `AppShell` for platform admin and `BottomTabShell` for the player view), they are text-only today, and their items (admin: Dashboard, Club Onboarding, Whitelisting, Subscriptions, Leagues, Configuration; player: Fixtures, Results, Availability, Profile) mostly have no icon in the set. A bar where some tabs have icons and some do not looks broken. **Plan: leave `Nav` untouched in this PR** and cover navigation through the dashboard cards only. Adding an optional `icon` to `NavItem` can follow when a menu exists whose items all have icons.
2. **No "club structure page header" exists.** There is no dedicated page to put `nav/club-structure` on (sections only appear inside tree pickers). **Plan: skip that row**; the icon stays in the library until such a page exists. Platform admin Configuration cards (Products, Email, ...) also have no icons in the set and keep MUI.
3. **Role badges: the spec's five role icons do not map one to one.** The stored role is only `BATSMAN`, `BOWLER` or `ALL_ROUNDER` (`api/matchSideApi.ts`); Captain and Wicketkeeper are separate flags shown as their own badges, and a player can be both. **Plan:** role badge uses `roles/batter`, `roles/bowler`, `roles/all-rounder`; the Captain badge uses `roles/captain`; the Wicketkeeper badge uses `roles/wicketkeeper`. All at 28 px as the leading icon of the existing clickable chips, so the badge row gets taller.

## Order of work (small commits, each shippable)

**Step 1 — Assets, favicon and `index.html` (frontend-builder).**
- Copy the favicon set from `ui/src/icons/brand/` to `ui/public/` (`favicon.svg` replaces the current one; `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `android-chrome-192x192.png`, `android-chrome-512x512.png`, `site.webmanifest`). Keep the originals in `brand/` as the source. Check `site.webmanifest` paths and name resolve from `/`.
- `ui/index.html`: replace the single `<link rel="icon">` with the svg, ico, 32 and 16 png, apple-touch-icon and manifest links; set a real `<title>` (the platform name) instead of `ui`.
- Standards text: amend `docs/standards/design-system.md` (new "Brand icons" subsection: when to use the set, MUI for icons under 32 px, `BrandIcon` only) and the UI-library row in `CLAUDE.md`, as the spec requires.

**Step 2 — `BrandIcon` component (frontend-builder, then test-writer).**
- New `ui/src/components/BrandIcon/` four-file anatomy (`BrandIcon.tsx`, `.test.tsx`, `.stories.tsx`, `index.ts`). Reuse `components/Avatar`-style conventions from a neighbour such as `NavTile`/`ConfirmDialog` for file shape.
- Icon registry: one module (`brandIcons.ts` inside the component folder) built with Vite's `import.meta.glob('../../icons/**/*.svg', { eager: true, query: '?url', import: 'default' })`, giving a typed `BrandIconName` union written as `group/name` (for example `nav/teams`, `roles/captain`). The glob means a newly added SVG is picked up automatically; the typed union is derived from the file list so the type and files cannot drift (the spec's "name list matches the files" criterion, enforced by a test that lists the folder with the same glob).
- `BrandIcon` renders an `<img>` (MUI `Box component="img"`, sx only) with `size`, empty `alt` and `aria-hidden` by default, an `alt` prop when the icon is the only label, `draggable={false}`. Exports a small helper `genderAvatarIcon(gender)` returning `people/avatar-male` or `people/avatar-female` or null.
- Only `components/BrandIcon` imports from `src/icons`; nothing else does (checked by a dependency-cruiser rule if cheap, otherwise a lint/grep note in the standards text).
- Tests (Vitest/RTL): each registered name resolves a source; `size`; default decorative alt versus supplied alt; the glob lists every file in `src/icons` (excluding `brand/` non-SVG); `genderAvatarIcon` for MALE, FEMALE, null. Story: every icon at 24, 32 and 48 px grouped by folder.

**Step 3 — Dashboard cards (frontend-builder).**
- `components/NavTile/NavTile.tsx`: its 34 px icon tile has a tinted background and a 19 px glyph sized for MUI. Add an optional `brandIcon?: BrandIconName` prop beside `icon`; when set, render `BrandIcon` at 40 px with no tinted tile (the badge is already a coloured circle), otherwise the current MUI tile. Keep `icon` for the admin Configuration cards.
- `pages/manage/ManagerDashboard.tsx`: map cards to icons per the spec (Club Profile `nav/club-profile`, Teams `nav/teams`, Players `nav/cricket-players`, Leagues `nav/cricket-leagues`, Matches `nav/upcoming-matches`, Results `nav/match-results`, Team Managers & Permissions `nav/roles-permissions`, Gallery `nav/photo-gallery`, Notifications `nav/notifications`, Squads `nav/squads`, Communication `nav/communication`, Availability `nav/availability-polls`); remove the MUI icon imports that become unused.
- Tests: update `NavTile.test.tsx` and the dashboard test only where they depend on the old icon; add a case for `brandIcon`. Story: add a `NavTile` brand-icon story.

**Step 4 — Role badges, avatars and the announce dialog (frontend-builder, then test-writer).**
- `components/TeamSelectionList/TeamSelectionList.tsx`: give the role, Captain and Wicketkeeper chips a leading `BrandIcon` at 28 px (`Chip`'s `avatar`/`icon` slot), adjust the chip height and row spacing so the right-aligned badge group still wraps cleanly on a phone; keep the `aria-label`s unchanged.
- Avatars: where a player has no photo and a recorded gender, use the gender icon as the avatar image instead of initials. Consumers (found by grep): `components/PlayerCard/PlayerCard.tsx`, `pages/manage/PlayerDetailPage.tsx`, the squad tile in `pages/manage/TeamDetailPage.tsx`. `ClubContact*` stays on initials. Implement once by reusing `avatarSx` and passing `src={photoUrl ?? genderAvatarIcon(gender)}` through a tiny shared wrapper only if three call sites would otherwise repeat the logic (otherwise inline).
- `components/ConfirmDialog/ConfirmDialog.tsx`: optional `icon?: ReactNode` rendered at the start of the title row; `MatchFormPage.tsx`'s Announce confirmation passes `<BrandIcon name="actions/announce-team" size={40} />`. Update `ConfirmDialog.test.tsx` and its story.
- Tests: `TeamSelectionList.test.tsx` role-badge assertions (icon present, label and menu behaviour unchanged); player card / detail avatar with and without gender and photo; `MatchFormPage.test.tsx` announce dialog still opens with the same copy.

## Reuse (do not rewrite)
`avatarSx`/`badgeSx` (`components/RecordCard`), `ConfirmDialog`, `NavTile`, `TeamSelectionList` chips, `PlayerCard`, the test setup in `src/test/setup.ts` (no change expected for `?url` SVG imports under Vitest; confirm).

## Out of scope
`Nav` menus, club structure header, admin Configuration cards, `scorecards`/`stats-*`/`field-*` icons (kept in the library, no consumer yet), per-club favicon override, any backend.

## Verification
- `npm run lint`, `npx tsc -p tsconfig.app.json --noEmit`, `npm run build` (check the build output: the 29 SVGs are emitted as assets, none inlined into the JS bundle beyond Vite's size threshold), `npx vitest run --project unit --testTimeout=30000` on `components/BrandIcon`, `NavTile`, `ConfirmDialog`, `TeamSelectionList`, `PlayerCard`, `pages/manage` once; Storybook build if cheap.
- Manual (the user, in the browser, at 375 px and desktop, light and dark): favicon in the tab and "Add to Home Screen"; manager dashboard cards; Home XI role badges at 28 px (no clipping, wrapping OK); player avatars with and without gender; the Announce confirmation.
- Node 22 via nvm for every `ui` command; no backend work.

## Commits
(1) `chore(ui)` favicon and index.html, (2) `docs` standards note, (3) `feat(ui)` BrandIcon with tests and story, (4) `feat(ui)` dashboard cards, (5) `feat(ui)` role badges, avatars, announce dialog, (6) `docs` plan record. Draft PR, no merge until the user says so.
