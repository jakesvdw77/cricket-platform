# 006 — Post-Login Home Shells

**Depends on:** `002-realm-subdomain-auth.md` (role claims — `platform_admin` flat role is real today; club-scoped roles depend on `001`'s model, not yet built), `004-landing-page.md`, `005-admin-login.md` (`AdminHome.tsx` placeholder this spec evolves into the admin shell's landing view, `ui/src/auth/keycloak.ts`).
**Status:** draft.

## Problem & Goals

The only authenticated screen that exists today is `AdminHome.tsx` — a bare identity-confirmation card built as an intentional placeholder in `005-admin-login.md`. There is no reusable page shell (navigation, avatar/logout menu, footer) for any of the platform's three personas — System Administrator, Club/Team Manager, Player — even though every future feature spec for those personas will need to render inside one. This spec builds those three shells as layout/navigation scaffolding only, with placeholder content standing in for the real functionality that later, per-module specs will build out one at a time.

**Goals**
- Each persona gets one home page after login, at a stable route, with a navigation pattern suited to how that persona actually uses the app: a desktop-console sidebar for System Admin, a grid-card dashboard for Club/Team Manager, a mobile bottom-tab bar for Player.
- All three share the same `AvatarMenu` (profile placeholder + logout) and the same `Footer` (copyright line) components — one implementation, not three copies.
- Placeholder nav items/cards name the real functionality this persona will eventually get, so later specs slot into an already-agreed information architecture instead of inventing page layout piecemeal.
- All three are responsive down to 375px per `docs/standards/frontend.md`; the Admin and Manager shells still read as a web app above `md`, not a phone app stretched wide.

## Non-goals

- **Real functionality behind any nav item/card.** Every destination this spec creates is either an `EmptyState` placeholder or (System Admin's Dashboard item only) the existing `GET /api/v1/platform/me` identity check carried over from `005`. Club onboarding, whitelisting, invoices, leagues, configuration, sections/teams/players, results capture, communication, availability polls, and the player's own profile/results/fixtures views are each a future spec.
- **Club-member / team-manager / player authorization.** `001`'s `RoleAssignment`/`Section`/`Team` model doesn't exist in code yet (per `005`'s own non-goals). The Manager and Player shells therefore render without a real backend-verified role gate — System Admin keeps the one real gate that already exists (`platform_admin`). A follow-up spec wires real auth for the other two once `001` lands.
- **Card-level permission filtering logic.** This spec fixes the full Manager card catalogue and visually groups it by scope (club-manager vs team-manager), but which cards actually hide for a given viewer is real authorization logic, deferred to the spec that implements `001`'s role model.
- **New design tokens.** Uses the existing palette/type/spacing/shape from `docs/standards/design-system.md` unmodified — no new colours, radii, or breakpoints.

## User Stories

- As a platform admin, after logging in I land on a dashboard with a persistent sidebar listing every admin function (club onboarding, whitelisting, subscriptions & invoices, leagues, configuration), a top bar showing my avatar, and a way to log out — not the bare identity card `005` shipped as a placeholder.
- As a club or team manager, after logging in I see a grid of cards grouped by function (sections, teams, players, fixtures & results, team managers & permissions, squads, communication, availability polls), so I can jump straight to the area I need without hunting through a side menu.
- As a player, after logging in on my phone I see a bottom tab bar (Fixtures, Results, Availability, Profile) — the primary mobile navigation pattern, not a hamburger menu or sidebar squeezed onto a small screen.
- As any authenticated user in any of the three shells, I can open my avatar to see a profile placeholder and log out, and I see a copyright footer — identical behaviour and identical components across all three.

## Data Model Changes

None.

## API Contract

None new. The System Admin shell reuses `GET /api/v1/platform/me` from `005`. The Manager and Player shells render placeholder content with no backend call — there's no real identity source for those roles until `001`'s model exists (see Non-goals).

## UI Requirements

New shared components, composed from existing `Card`/`Nav`/`EmptyState`/`Button` primitives per `docs/standards/design-system.md`, each getting the standard four-file anatomy:

| Component | Used by | Shape |
|---|---|---|
| `AppShell` | System Admin | Top bar (logo, page title, `AvatarMenu`) + collapsible left drawer. Drawer collapses to a hidden drawer behind a menu button below `md`. |
| `AvatarMenu` | All three | Avatar (initials fallback) → dropdown: "Profile" (placeholder route), "Log out" (`keycloak.logout()`). One implementation, shared. |
| `Footer` | All three | Shared copyright line, e.g. `© {year} Cricket Legend Platform`. |
| `GridNavShell` | Club/Team Manager | Top bar (logo, `AvatarMenu`), no sidebar — responsive card grid below it. |
| `BottomTabShell` | Player | Minimal top bar (logo, `AvatarMenu`) + MUI `BottomNavigation` fixed to the viewport bottom; content scrolls between them. |

Pages:
- **`ui/src/pages/admin/AdminHome.tsx`** (rewritten) — `AppShell` with sidebar items: Dashboard (today's `005` identity-card content, now the default view), Club Onboarding, Whitelisting, Subscriptions & Invoices, Leagues, Configuration. All but Dashboard render `EmptyState` ("Coming soon").
- **`ui/src/pages/manage/ManagerHome.tsx`** (new) — `GridNavShell`. Card groups, club-manager scope: Sections & Age Groups, Teams, Players, Fixtures & Results, Team Managers & Permissions. Team-manager scope: Squads, Communication, Availability Polls. (Both scopes render together in this spec — see Non-goals on filtering.) Every card navigates to an `EmptyState` placeholder.
- **`ui/src/pages/view/PlayerHome.tsx`** (new) — `BottomTabShell`. Tabs: Fixtures (default landing tab), Results, Availability, Profile. Fixtures/Results/Availability render `EmptyState`; Profile shows a minimal placeholder with the authenticated user's name.

**Mobile-first, per `docs/standards/frontend.md`.** All three authored at 375px first. `AppShell`'s sidebar and `GridNavShell`'s grid both collapse to a single column / hidden drawer at `xs`/`sm` without adopting the Player shell's bottom-tab pattern — above `md` they read as a web app, not a phone app stretched wide.

**Claude Design pass precedes implementation** (this spec's Step 2 per `docs/workflow.md`): hand-authored static HTML/CSS previews for all five components above, matching the real token set, pushed to the "Cricket Legend Platform" project's new "Screens" group before any `.tsx` is written.

## Test Plan

| Tier | Coverage |
|---|---|
| Component | `AppShell`, `AvatarMenu`, `Footer`, `GridNavShell`, `BottomTabShell` each get a Storybook story at 375/768/1280 and a component test: renders its nav items, avatar menu opens, "Log out" calls `keycloak.logout()`. |
| E2E | One golden path for System Admin only (Playwright, reusing `005`'s seeded `platform_admin` test user): log in, land on the sidebar shell, open a non-Dashboard item and see `EmptyState`, open the avatar menu, log out. Manager/Player E2E is deferred until real auth exists (per Non-goals) — covered by component/Storybook tests only in this spec. |

## Acceptance Criteria

- All three home pages render their persona-appropriate navigation pattern (sidebar / grid / bottom tabs) and are usable down to 375px with no horizontal scroll.
- `AvatarMenu` and `Footer` are the same components, rendering identically, across all three shells.
- System Admin's Dashboard item shows the same identity content `005`'s `AdminHome` showed today, now inside the sidebar shell.
- Every other nav item/card renders `EmptyState`, not a broken route, blank page, or console error.
- No new backend endpoint, no new database migration.

## Rollout Notes

- Ship the System Admin shell first — it's the only one with a real backend-verified identity check to build against (`005`'s `/api/v1/platform/me`). Manager and Player shells ship as visual scaffolding only, ahead of `001`'s role model.
- Next specs that build on this one: one per admin module (club onboarding, whitelisting, invoices, leagues, configuration); `001`'s role/section/team model (a hard prerequisite for real Manager/Player auth); then one per manager/player module (squads, results capture, communication, availability polls, player profile).
- The Claude Design pass (previews for `AppShell`, `AvatarMenu`, `Footer`, `GridNavShell`, `BottomTabShell`) happens next, before any component is coded — see UI Requirements above.
