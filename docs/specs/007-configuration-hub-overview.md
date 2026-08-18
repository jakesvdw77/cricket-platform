# 007 — Configuration Hub Overview

**Depends on:** `006-post-login-home-shells.md` (`AppShell`'s System Admin sidebar already has a `Configuration` nav item at `/admin/configuration`, currently an inline `EmptyState` placeholder in `App.tsx`), `001-tenancy-identity-model.md` (the `Subscription` entity — `owner_type`/`owner_id`/`plan` — that the roadmap below eventually replaces `plan`'s bare string with a real `Product` reference).
**Status:** draft.

## Problem & Goals

`006` gave System Admin's `AppShell` a `Configuration` sidebar item, but it was scoped as pure navigation scaffolding — clicking it renders a static `EmptyState title="Configuration" description="Coming soon."` (`ui/src/App.tsx`). Nothing behind it exists yet, and there's no established pattern for what "behind it" should even look like once the first real configuration module ships.

This spec is the umbrella: it fixes the shape of the Configuration area itself — a landing page composed of cards, one per configuration module — and sequences the roadmap of modules that will each get their own spec. It exists so the next spec (`008-product-catalog.md`, and the `Subscriptions` spec after it) has a fixed landing page to slot a card into, instead of each module spec re-deciding page layout and navigation from scratch.

**Goals**
- Replace `/admin/configuration`'s placeholder `EmptyState` with a real landing page: a responsive grid of cards, one per configuration module, reusing the existing `Card` component — no new shared component required.
- Ship exactly one *working* card in this spec: **Products**, linking to `008-product-catalog.md`'s screen.
- Name the rest of the roadmap as additional cards on the same page, styled the same "Coming soon" way `006` already established for `ManagerHome`'s not-yet-built cards — so the information architecture is agreed once, and each future module spec's only UI job is "swap this card's target from `EmptyState` to a real screen."
- Confirm the sidebar's existing label (`Configuration`, singular — see `AdminHome.tsx` and `AppShell.stories.tsx`) is the realization of this request's "Configurations" menu item — not a second, duplicate nav entry.

## Non-goals

- **Building any configuration module besides Products.** Subscriptions, Discounts & Promotions, Invoicing, and System Settings are named below as roadmap cards only — each renders `EmptyState`, none gets a real screen in this spec.
- **The Products screen itself.** Its data model, API, and UI are `008-product-catalog.md`'s full scope — this spec only provides the card that links to it.
- **Card-level permission filtering.** Every card here is visible to any authenticated `platform_admin`, the same single real gate `005`/`006` already established for the whole System Admin shell. No finer-grained permission model is introduced.
- **Renaming or restructuring the sidebar.** `Configuration` stays exactly where `006` put it, at the same nav position, with the same label — this spec only builds what's behind it.
- **The Subscriptions module.** Linking a `Club`/`Section` to a `Product` (replacing `001`'s bare `Subscription.plan` string with a real foreign key) is explicitly the *next* spec after `008`, sequenced in Rollout Notes below, not built here.

## User Stories

- As a platform admin, when I click `Configuration` in the sidebar, I see a page of cards instead of "Coming soon," so I understand what configuration areas exist and can navigate straight to one.
- As a platform admin, I see a `Products` card that takes me to a real screen for managing subscription products.
- As a platform admin, I see cards for the rest of the configuration roadmap (Subscriptions, Discounts & Promotions, Invoicing, System Settings) so I know they're planned, even though clicking them today just shows "Coming soon" — the same pattern `006` already used for `ManagerHome`'s not-yet-built cards.

## Data Model Changes

None. This spec is page composition only.

## API Contract

None new. The page renders behind the System Admin shell's existing `platform_admin` gate (`005`'s `GET /api/v1/platform/me`, already enforced one level up by `AdminHome.tsx` before any nested route renders) — no additional backend call.

## UI Requirements

Composed entirely from the existing shared library (`docs/standards/design-system.md`) — no new shared component.

- **New page: `ui/src/pages/admin/ConfigurationHome.tsx`**, mounted at the existing `/admin/configuration` route in `ui/src/App.tsx` (replacing the inline `<EmptyState .../>` route element there — same route path, same nav item, real content). Renders inside `AppShell`'s existing content area (it does *not* wrap itself in a second top bar/sidebar — `ManagerHome`'s `GridNavShell` is the wrong reuse here, since `AppShell` already provides that chrome for every System Admin page).
- **Card grid**, mobile-first per `docs/standards/frontend.md`, one `Card` per module:

  | Card | Target | State in this spec |
  |---|---|---|
  | Products | `/admin/configuration/products` | Real screen — `008-product-catalog.md` |
  | Subscriptions | `/admin/configuration/subscriptions` | `EmptyState` ("Coming soon") — next spec after `008` |
  | Discounts & Promotions | `/admin/configuration/discounts` | `EmptyState` ("Coming soon") — unscoped roadmap item |
  | Invoicing | `/admin/configuration/invoicing` | `EmptyState` ("Coming soon") — unscoped roadmap item |
  | System Settings | `/admin/configuration/settings` | `EmptyState` ("Coming soon") — unscoped roadmap item |

  Each card shows a short one-line description of what the module will do (e.g. Products: "Define pricing tiers and usage limits clubs subscribe to").
- **Routing convention for future modules:** every module route nests under `/admin/configuration/*`, matching `008`'s `/admin/configuration/products` below — so this spec's roadmap cards need no route change when their real screens ship, only their target element swapping from `EmptyState` to the real page.

**Mobile-first.** Card grid is 1 column at `xs`, per `docs/standards/frontend.md` — same responsive pattern `ManagerHome`'s grid already established, reused here rather than re-derived.

## Test Plan

| Tier | Coverage |
|---|---|
| Component | None new — `ConfigurationHome` is a page composed entirely from the already-tested `Card`/`EmptyState` components, not a new shared component itself. |
| E2E | Extends `006`'s existing System Admin golden path (Playwright): after logging in, click `Configuration` in the sidebar, assert the card grid renders with a `Products` card, click it, and assert `008`'s product list screen renders (or its empty state, if no products exist yet). This single E2E case covers both `007` and `008` together — no separate `007`-only E2E needed. |

## Acceptance Criteria

- `/admin/configuration` renders a card grid, not the static `EmptyState` it does today.
- A `Products` card is present and navigates to `008`'s real screen at `/admin/configuration/products`.
- The four roadmap cards (Subscriptions, Discounts & Promotions, Invoicing, System Settings) are present, each navigating to its own `EmptyState` — no broken route, blank page, or console error.
- No new backend endpoint, no new database migration.

## Rollout Notes

- Ship `007` and `008` together — `008`'s Products screen has nowhere to be reached from without this spec's landing page, and this spec's `Products` card has nowhere real to go without `008`.
- **Roadmap order after `008`:** Subscriptions (links a `Club`/`Section` to a `Product`, replacing `001`'s bare `Subscription.plan` string with a real foreign key — the spec this whole initiative was requested to set up) ships next. Discounts & Promotions, Invoicing, and System Settings are named for roadmap visibility only, unscoped and unscheduled.
- Each future module spec's UI Requirements section should read as "swap the `<module>` card's target from `EmptyState` to `<new page>`" against the table above, not re-litigate page layout.
