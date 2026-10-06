# Plan 079 — Manager Shell and Overview Dashboard

Implements `docs/specs/079-manager-shell-and-overview.md` (draft; look approved from the mockup https://claude.ai/artifact/1D1H5h8YJVkKhAewoQXniN; decisions recorded in the spec's Decisions section). Branch: `feature/079-manager-shell` (holds the spec). Depends on 078 (merged: `BrandIcon`, icons).

## Context

Managers move between many sections but the dashboard is a launcher grid, so every switch goes back through it, and 18 pages carry a "Back to Dashboard" header. The spec replaces the manager's top-bar-only shell with a club-colour header, a persistent side menu (icons-only on tablets), a phone bottom bar with a Menu sheet, and an overview page that shows what needs the manager, scoped to the sections they administer.

## What the code looks like today (findings)

- `pages/manage/ManagerHome.tsx` renders `GridNavShell` (header + `<main>` with `pageBackgroundGradient` + footer) around `<Outlet context={{ clubId }} />`; `GridNavShell` is used only here (and referenced in comments elsewhere). `ShellHeader` (white, divider, club logo slot, `AvatarMenu`) is shared with the admin and player shells, so the green header must be an opt-in variant, not a change to the shared default.
- `pages/manage/ManagerDashboard.tsx` holds the card list (`GROUPS`, headings "Club manager" and "Team manager", brand icons already wired through `NavTile`) and is the `/manage` index route (`App.tsx` line ~140).
- `ManageScreenHeader` (back link default `backTo='/manage'`, "Back to Dashboard") is used by 14 pages (lists, `ClubStructure`, the availability hub, the poll response pages). Detail and edit pages use `RecordFormScreen`/`RecordDetailScreen`, which have their own back buttons.
- Backend scoping already exists: `AccessService.accessibleSectionIds(authentication, clubId)` returns `Optional<Set<UUID>>` (empty means unrestricted), `canAdministerSection`, `sectionAndDescendantIds`; `MatchServiceImpl.list` already filters by it and supports `upcomingOnly`; `OpenAvailabilityPollDto` carries per-status respondent counts and `scheduledCloseAt`. There is no dashboard or overview endpoint, Notifications, Results, Gallery and Communication are "Coming soon" placeholders, and `ManagerHome` only knows `clubAdminClubIds` (no per-person rights on the frontend).

## Flags where the spec and the code disagree (need your decision)

1. **Menu items that exist today but are not in the spec's menu**: Club structure (`/manage/sections`), Seasons, Sponsors and Club contacts. Today they are reached from the Club Profile page (`ClubOverviewPage`), not from dashboard cards. **Plan: keep that, no menu entries**; they stay one click from Club profile.
2. **"Message the squad" quick action leads to a "Coming soon" page** (Communication is a placeholder). **Plan: include it as you chose**, linking to `/manage/communication`; say if you would rather hide it until Communication exists.
3. **Notifications badge has no data** (Notifications is a placeholder). **Plan: badge shows only for open polls**; the Notifications badge is added when that feature exists.
4. **Quick-action visibility needs the caller's rights, which the frontend does not have.** **Plan: the overview endpoint returns the four booleans** (`createMatch`, `createPoll`, `addPlayer`, `messageSquad`), computed with the same `AccessService` rules as the matching endpoints' `@PreAuthorize`; the frontend only renders what is allowed.
5. **The spec's "Overview" icon does not exist yet** (`nav/overview.svg`). **Plan: Slice 1 ships with a MUI home glyph for that one row**, and switches to the brand icon when you add the file (registry list in `brandIcons.ts` plus its test updated then).
6. **Results card**: no results data exists, so the card is an empty state and the endpoint returns an empty list, as decided.

## Slicing (each its own PR, in this order)

**Slice 1: shell, header, menus, back-link rule, Overview page with today's content (frontend-builder, then test-writer).**
- Shared navigation config: new `ui/src/pages/manage/managerNav.ts` (or in `components/ManagerShell/`): the grouped menu (Overview; Matches: Matches, Leagues, Results; People: Teams, Players, Squads; Availability: Polls, Communication; Club: Club profile, Gallery, Notifications, Managers) with route, brand icon name and prefix patterns for active matching (for example `/manage/fixtures/matches/**` highlights Matches, `/manage/availability/**` and `/manage/player-availability` highlight Polls, Overview matches `/manage` exactly). `ManagerDashboard`'s `GROUPS` is derived from or replaced by it so there is one source.
- New components, each with the four-file anatomy, MUI primitives and sx only: `ManagerShell` (replaces `GridNavShell` in `ManagerHome`: header, layout grid, `<main>` with `pageBackgroundGradient`, `Footer`), `SideMenu` (full from `lg` up, icons-only rail at `md` to `lg` with tooltips and `aria-label`, hidden below `md`; active tint, badge slot), `BottomTabBar` (below `md`: Home, Matches, Polls, Players, Menu), `MenuSheet` (MUI `SwipeableDrawer anchor="bottom"`, so Escape, focus trap and swipe-down come with it; grouped tile grid with `BrandIcon` at 40 px and a badge slot; closes on choosing a destination).
- Header: add an opt-in `tone="brand"` to `ShellHeader` (solid `primary.main`, `primary.contrastText`; logo tile on a white background; `AvatarMenu` gets a matching `onBrand` look because its default avatar is the same green). Admin and player shells keep today's white header. MUI computes readable text for light club colours; add a test with a light primary.
- Menu icons are 32 px (078 rule); the Overview row uses a MUI home glyph for now.
- `ManageScreenHeader`: no default `backTo` any more; no `backTo` means no back link. List and top-level pages stop showing "Back to Dashboard"; pages with an explicit `backTo` (the group and squad poll response pages, `ResponsesPageShell`, the availability hub as needed) keep theirs. Detail and edit screens are unchanged. Update `ManageScreenHeader` tests and any list-page tests that assert the old link.
- Routes: `/manage` index renders an `ManagerOverviewPage` that, in this slice, shows the existing `NavTile` grid (content moved, not redesigned), so nothing is lost while Slice 2 builds the real cards. `ManagerHome` swaps `GridNavShell` for `ManagerShell`; `GridNavShell` stays only if another consumer needs it, otherwise it is removed with its tests and story.
- Docs: update `docs/specs/006-post-login-home-shells.md` with an "Amended by 079" note (the Manager nav decision changes) and `docs/standards/design-system.md` shell/header notes.
- Tests: `SideMenu` (groups, active item by route prefix, collapsed rail tooltips, badge), `BottomTabBar` and `MenuSheet` (opens, closes by button, backdrop, Escape, navigates and closes), `ShellHeader` brand tone (club colour, light colour text, logo fallback), `ManagerShell` layout at three widths (matchMedia stubs), `ManageScreenHeader` with and without `backTo`, the nav config (every route exists in `App.tsx`; every icon name is in `BRAND_ICON_NAMES`). Stories for each new component. Update `ManagerHome.test.tsx` and the dashboard tests.

**Slice 2: overview endpoint, cards and quick actions (backend-builder, frontend-builder, test-writer).**
- Backend (follow `docs/standards/backend.md`; build and test only in an rsync'd scratch copy): `GET /api/v1/manage/clubs/{clubId}/overview`, `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")`. New `ManagerOverviewController` -> `ManagerOverviewService` + `ManagerOverviewServiceImpl` (`@Transactional(readOnly = true)`), flat record DTOs (`ManagerOverviewDto` with week counts, key figures, upcoming matches, open polls, empty results list and the four quick-action booleans). Scope with `AccessService.accessibleSectionIds`; reuse the match section-resolution used by `MatchServiceImpl.list` rather than reimplementing it (extract a shared helper if it is private), the `playingXiSize`/`SelectionLimitsResolver` batch form for "selected of maximum" and the existing match side data for announced status, and the open-poll repository queries behind `OpenAvailabilityPollDto` plus the group-poll round queries for group polls. One query per kind of data, no per-row lookups; a guard test on statement count like the leagues-list N+1 guard. Week boundaries use the club's configured zone the same way `MatchSlots` does (`ZoneId.systemDefault` today); stated in the DTO docs. `openapi.yaml` edited by hand, additions only.
- Frontend: `ui/src/api/overviewApi.ts` (React Query key `['managed-club', clubId, 'overview']`), `ManagerOverviewPage` with the greeting, key-figure row, "Upcoming matches", "Needs an answer", "Recent results" (empty state) and the quick-actions row, phone stacking as in the mockup, and designed empty states for a new club. Reuse `CardProgressBar`, `DetailLine`, `badgeSx`/pills, `RecordCard` card styling and `cardGridSx` conventions; no new styling system.
- Tests: backend unit for scoping (section manager versus club admin versus other club), week edges, empty club; Testcontainers integration for the endpoint (200, 403 for another club, scoped totals) and the statement-count guard; frontend component tests for each card (data, empty, scoped) and quick-action visibility; smoke test of the endpoint against a running app.

**Slice 3: menu badges (frontend-builder, test-writer).** Open-poll count badge on Polls from the Slice 2 response, shown in the side menu, the collapsed rail (dot with count) and the Menu sheet; no Notifications badge yet (flag 3).

## Reuse (do not rewrite)
`ShellHeader`, `AvatarMenu`, `avatarSx`, `NavTile`, `BrandIcon` (`components/BrandIcon`), `pageBackgroundGradient`/`headerBandShadow` (`theme.ts`), `PageHeaderBand`, `CardProgressBar`, `DetailLine`, `AccessService.accessibleSectionIds`/`canAdministerSection`, `MatchServiceImpl` section resolution, `SelectionLimitsResolver`, `OpenAvailabilityPollDto` queries.

## Out of scope
Admin and player shells and `Nav`, roles and permissions screens, results data, notifications data, per-club favicon, dark mode, redesign of inner pages, the Overview brand icon itself.

## Verification
- Frontend (Node 22 via nvm): `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm run build`, vitest `--project unit --testTimeout=30000` on the touched areas then `pages/manage` and `components` once.
- Backend (scratch copy only, never mvn in `backend/`): full `./mvnw -o clean test` in a fresh rsync.
- Manual (the user, in a browser, 375 px, ~1000 px (icons rail), 1280 px; several club colours including a light one): header and logo, menu active state on nested routes (a match edit page highlights Matches), Menu sheet, back links on a list page versus a detail page, overview numbers for a club admin and for a section-scoped manager, empty club.

## Commits and PRs
Per slice: `feat(ui)` shell and menus, `feat(ui)` back-link rule, `docs` notes, `test`; Slice 2 adds `feat(backend)`. Each slice is a draft PR; no merge until you say so.
