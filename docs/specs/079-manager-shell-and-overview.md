# 079 — Manager Shell and Overview Dashboard

**Depends on:** 006 (post-login home shells, whose "Manager nav: top bar only" decision this spec changes), 078 (brand icons, `BrandIcon`), 076 (selection status), 073 and 074 (availability), 070 to 072 (leagues)
**Status:** draft — the look and feel was approved by the user from the interactive mockup (https://claude.ai/artifact/1D1H5h8YJVkKhAewoQXniN) on 2026-10-06. The user answered the main open questions on 2026-10-06 (see "Decisions").

## Problem & Goals

Managers move between many sections (Matches, Availability, Squads, Players and more), but today the dashboard is a grid of 12 cards that only launch pages. Switching sections means going back to the dashboard each time, the dashboard shows no information, and on a wide screen the grid wastes space. Every manager page also carries a "Back to Dashboard" header.

Goals:
- A persistent, grouped side menu on wide screens and a bottom bar plus a Menu sheet on phones, so any section is one tap away.
- A header in the club's own primary colour, carrying the club logo and name and the user menu.
- An overview dashboard that answers "what needs me today?": this week's matches, teams not yet announced, polls awaiting answers, recent results, and key numbers.
- A look the club is proud to show: the approved mockup is the visual reference.

## Non-goals

- Platform admin and player shells (`AppShell`, `BottomTabShell`) and the `Nav` component: unchanged here.
- Roles and permissions screens. The overview must be built so its numbers can be scoped per person (see Data and scoping), but no new role model is added.
- Per-club favicon override, club-defined menu order, dark mode (the app is light-only).
- Redesigning the inner pages. They keep their own layout and headers, rendered inside the new shell.

## User Stories

- As a manager on a desktop, I see a side menu on every page, so that I can reach any section in one click.
- As a manager on a phone, I see a bottom bar and a Menu button that opens every section as tiles, so that I can reach any section with my thumb.
- As a manager, I open the app to an overview of what needs me (matches this week, teams not announced, polls awaiting answers, recent results), so that I know what to do first.
- As a junior or section manager, I only see numbers and items for the sections I manage, so that the overview is relevant to me.
- As a club, my header uses my own colour and logo, so that the app feels like ours.

## Data Model Changes

None for the shell. Any aggregation for the overview is read-only and computed from existing tables.

## API Contract

New read-only overview endpoint(s), scoped to the caller. The exact shape is defined in planning; at minimum it returns:

| Data | Source today |
|---|---|
| Matches this week and the next few upcoming, with selection status (selected of maximum, announced or not) | matches, match sides (076) |
| Teams not yet announced for matches this week | match sides |
| Open availability polls with replied of total and the close time | availability polls, responses (064 to 067, 073, 074) |
| Recent results (win or loss and margin) | not available yet; the card shows an empty state and the endpoint returns an empty list until Results exists |
| Counts for the menu badges (open polls, unread notifications) | polls, notifications |
| Key numbers (active players and similar) | players |

No such endpoint exists today. Rules: the club comes from the managed-club context as elsewhere; every figure is limited to the sections the caller can administer (`AccessService.canAdministerSection` and the section tree, as 076 does); no N+1 queries (batched, one query per kind of data).

## UI Requirements

Reference: the interactive mockup above. Tokens come from `ui/src/theme.ts`; no hard-coded colours.

**Header.** Solid `primary.main` background with `primary.contrastText` text (MUI picks readable text for light club colours automatically), club logo (white tile fallback with initials) and club name at the left, the avatar menu at the right. This replaces today's white header with a divider for the manager shell and is a visible change.

**Wide screens.** From 1200 px a persistent side menu of about 232 px; between about 900 and 1200 px the same menu collapsed to an icons-only rail of about 64 px (brand icons at 32 px, label as tooltip and `aria-label`, badges kept as small dots with counts). The full menu is: grouped: Overview; Matches (Matches, Leagues, Results); People (Teams, Players, Squads); Availability (Polls, Communication); Club (Club profile, Gallery, Notifications, Managers). Each row has its brand icon at 32 px (per the 078 rule), the active row is tinted and bold, and rows can carry a count badge. The page body uses the existing brand-tinted gradient (`pageBackgroundGradient`).

**Phones.** A bottom bar with Home, Matches, Polls, Players and Menu. Menu opens a bottom sheet covering most of the screen with every destination as a tile (brand icon at 40 px, label, badge), grouped as on desktop; it closes on choosing a destination, on the close button, on tapping outside, and on swipe down. The sheet is a real dialog for keyboard and screen readers.

**Overview content.** A greeting and date, a row of key figures, an "Upcoming matches" card (each row with date, teams, time, venue, selection status pill linking to the selection page), a "Needs an answer" card (open polls with a progress bar and close time) and a "Recent results" card (for now an empty state: "No results yet", then real results once Results exists) and a quick-actions row of the actions a manager can perform (Create match, Create availability poll, Add player, Message the squad). On a phone these stack as Next match, Needs an answer and Last result. Empty states (a brand-new club with no matches or polls) show a short explanation and the next action instead of blank cards.

**Existing pages.** All 18 pages that use `ManageScreenHeader` ("Back to Dashboard") keep working inside the shell. "Back to Dashboard" goes away; detail and edit pages keep a back link to their list (see Decisions).

**Icons.** Overview has no brand icon yet; the user is generating one in the same style. Until it exists the mockup's dashed placeholder is not shipped; the menu uses a MUI home glyph for that one row or the build waits for the icon.

**Components.** A new manager shell component replacing `GridNavShell` for managers, a `SideMenu`, a `BottomTabBar` and a `MenuSheet`, each with the four-file anatomy, composed from MUI primitives; the overview cards reuse `RecordCard` conventions (`CardProgressBar`, pills, `DetailLine`) rather than new styles.

## Test Plan

Per `docs/standards/testing.md`:
- Backend unit and integration (Testcontainers) for the overview service: scoping by section (a section manager sees only their sections, a club admin everything, another club's data never), batched queries (a guard test for query counts), week boundaries, empty club.
- Frontend component tests for the side menu (groups, active item, badges, keyboard), the bottom bar and Menu sheet (opens, closes four ways, navigates), the header (club colour, light colour text, logo fallback) and the overview cards (data, empty states).
- Existing manager page tests updated only where the shell change breaks them.
- Storybook stories for each new component.
- Playwright smoke: log in as a manager, see the overview, navigate by the side menu.
- Manual: desktop and 375 px, several club colours including a light one.

## Acceptance Criteria

- On a desktop width every manager page shows the side menu with the active section highlighted and one click reaches any section.
- On a phone every manager page shows the bottom bar; Menu opens a sheet with all sections and closes as specified.
- The header uses the club's primary colour with readable text for any club colour, and shows the club logo or initials.
- The overview shows matches this week, teams not announced, polls awaiting answers, recent results and the key figures from real data, and a new club sees helpful empty states.
- A section-scoped manager never sees figures or items from sections outside their scope.
- The overview endpoint uses a fixed number of queries regardless of data size.
- No hard-coded colours, MUI `sx` only, brand icons only through `BrandIcon`.

## Decisions

Answered by the user on 2026-10-06:
- **Tablet widths:** the side menu collapses to **icons only** between about 900 and 1200 px (labels as tooltips and accessible names); full menu from 1200 px up.
- **Bottom bar:** Home, Matches, Polls, Players, Menu, as proposed.
- **Results:** results are not built yet, so the Recent results card shows **0 or "None"** for now (an honest empty state such as "No results yet"), and starts showing real results when the Results feature exists. No results data is needed in the overview endpoint yet.
- **Section-scoped managers** see only their **own** teams' items and figures, including results once they exist. No club-wide results for them.
- **Quick actions:** **yes**, a row on the overview with **Create match, Create availability poll, Add player, Message the squad**. An action is hidden for a manager who cannot perform it (same access rules as the underlying pages).
- **"Back to Dashboard":** the always-visible menu replaces it. A back link stays **only on detail and edit pages** and returns to the list the person came from.

Defaults assumed unless the user changes them (they match the mockup):
- Menu count badges: open polls that still await answers, and unread notifications.
- Overview icon: the user generates it as `nav/overview.svg`.

## Rollout Notes

Slices, each shippable: (1) the new shell, header and menus with the existing dashboard content moved to the Overview page unchanged, plus the Overview icon; (2) the overview endpoint and cards; (3) menu badges. Slice 1 delivers the navigation and look; slices 2 and 3 add information. Spec 078's brand icons and the availability public form (077) benefit from this shell, which is why the look is settled first.
