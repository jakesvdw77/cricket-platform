# 009 — Subscriptions

**Depends on:** `001-tenancy-identity-model.md` (`Subscription`'s existing `owner_type`/`owner_id`/`plan` shape and ADR-03's resolution rule — this spec replaces `plan` with a real FK and implements what's buildable of that rule today), `008-product-catalog.md` (the `Product` catalog this links to — only `ACTIVE` products can be newly subscribed), `007-configuration-hub-overview.md` (reserves the `Subscriptions` card this spec builds the real screen behind), `docs/standards/design-system.md`'s "Record list / create-edit pattern" (the `ListToolbar`/`RecordCard`/`RecordFormScreen` pattern this screen must use, not a bespoke layout).
**Status:** draft.

## Problem & Goals

`001`'s `Subscription` entity has never been implemented — `plan` is a bare, unvalidated string with nothing behind it. `008` built a real `Product` catalog specifically so a club's plan could point at something real, but nothing links the two yet: there is no way today to say "this club is on the Club Standard plan." This spec builds that link — a `Subscription` that FKs a `Club` to an `ACTIVE` `Product` — and the admin screen to manage it, reusing the `Subscriptions` card `007` already reserved in the Configuration hub.

**A scope-defining gap, found while writing this spec, not assumed away:** `001`'s full tenancy model (`Section`, `Team`, `ClubMembership`, `RoleAssignment`) does not exist in code. Only a minimal `Club` stub does (`backend/src/main/java/com/cricketlegend/domain/Club.java`, built for `004`'s public club search — its own Javadoc says so explicitly: "NOT the full tenancy entity... no Section, Team, ClubMembership yet"). `001`'s ADR-03 describes `Subscription.owner_type ∈ {CLUB, SECTION}` with a walk-up-the-section-tree resolution rule — but there is no `Section` table to walk. This spec cannot build `SECTION`-owned subscriptions or their resolution rule without first building `Section` for real, which is a much bigger, separate piece of work than "Subscriptions" implies. See Non-goals.

**Goals**
- A platform admin can assign a `Club` an `ACTIVE` `Product` as its `Subscription` via a real screen at `Configuration → Subscriptions`.
- A platform admin can change a Club's `Subscription` to a different `Product` (upgrade/downgrade) or cancel it, without losing the historical record.
- A platform admin can view every Club's current `Subscription` (owner, product, status, dates) in one list, searchable and sortable, following the established Record list pattern.
- `001`'s open question from `008`'s Rollout Notes — does `Subscription` point at `Product` by id or by code — is resolved here: by `product_id`.

## Non-goals

- **`SECTION`-owned subscriptions, and therefore ADR-03's walk-up-the-tree resolution rule.** Both require a real `Section` entity, which doesn't exist in code. `owner_type` stays a column (default/only valid value `CLUB` for now, validated server-side) so the schema doesn't need a breaking migration when `Section` eventually ships — but no `SECTION` subscription can actually be created through this spec's API. This also means `001`'s still-open "Section subscription lapse behaviour" deferred item is **not resolved by this spec either** — it was never buildable without `Section`, and this spec doesn't change that. `001`'s Deliberately Deferred entry stays as-is.
- **Payment/invoice processing.** A `Subscription` here is an entitlement record ("this club is on this plan"), not a billing transaction. No charging, no payment gateway, no invoice generation. `AdminHome.tsx`'s separate top-level `Subscriptions & Invoices` sidebar item (`/admin/invoices`) is untouched by this spec and stays its own `EmptyState` — this spec's screen lives at `Configuration → Subscriptions` only, matching `007`'s reservation. Don't conflate the two navigation entry points; a future Invoicing spec may eventually decide whether they merge.
- **Enforcing `Product`'s usage limits** (`maxSections`/`maxTeams`/`maxPlayers`) — blocking a Club from exceeding its plan when creating a `Section`/`Team`/registering a player. That requires the entities being limited to exist first (see the Section gap above) — necessarily a later spec.
- **Automatic expiry/renewal.** `end_date` is a plain date field an admin can set and read; there's no scheduled job that flips a `Subscription` to an expired state when the date passes, and no `EXPIRED` status. `status` is only ever `ACTIVE` or `CANCELLED`, both admin-driven.
- **Self-serve subscription changes.** Only a platform admin can create/change/cancel a Subscription — matches `003`'s vendor-assisted onboarding model, no club-side self-service screen.
- **Enforcing `Product.maxPeriodMonths` against a Subscription's date range.** The UI suggests `endDate = startDate + maxPeriodMonths` as a convenience (post-build addition, see Rollout Notes) so the two concepts aren't silently disconnected, but nothing rejects a Subscription whose dates exceed the product's max term — same deferral as the `maxSections`/`maxTeams`/`maxPlayers` limits above, for the same reason (no payment/billing enforcement layer exists yet).
- **Proration and billing-cycle mechanics.** `startDate`/`endDate` are entitlement markers only, not billing-cycle anchors — no charge is ever computed from them in this spec. See `docs/roadmap.md`'s billing-model note for the anniversary-vs-calendar-billing decision a future Invoicing spec should follow.

## User Stories

- As a platform admin, I can open `Configuration → Subscriptions` and see every Club's current Subscription — the Club, the Product, its status, and its dates — at a glance.
- As a platform admin, I can create a Subscription for a Club that doesn't have one yet, picking from `ACTIVE` Products only.
- As a platform admin, I can change an existing Subscription to a different Product (upgrade/downgrade) without creating a duplicate record.
- As a platform admin, I can cancel a Subscription, ending the Club's entitlement while keeping the record visible for history.
- As a platform admin, if I try to create a second Subscription for a Club that already has an active one, I see a clear conflict error rather than a silent duplicate — a Club has at most one active Subscription at a time.

## Data Model Changes

Replaces `001`'s placeholder `Subscription.plan` string with a real structure. Scoped to `CLUB` owners only this pass (see Non-goals) — `owner_type` stays present for forward-compatibility with `SECTION`, but only `CLUB` validates.

**Field Reference**

| Field | Type | Required | Purpose |
|---|---|---|---|
| `id` | uuid | — | Primary key |
| `ownerType` | enum: `CLUB` (only valid value for now) | yes | Kept from `001`'s ADR-03 shape for forward-compatibility — `SECTION` is a recognized enum value at the column/domain level but rejected by service-layer validation until `Section` exists in code. |
| `ownerId` | uuid | yes | FK to `club.id` when `ownerType = CLUB` (the only case this spec builds) — enforced with a real DB foreign key against `club`, not a polymorphic/unenforced column, since only one owner table exists today. |
| `productId` | uuid | yes | FK to `product.id`. **Resolves `008`'s open question: id, not code** — a real FK gives DB-enforced join integrity; `Product.code` is stable by convention but not immutable, and a real foreign key is the standard, safer choice regardless. |
| `status` | enum: `ACTIVE`, `CANCELLED`, default `ACTIVE` | yes | No `EXPIRED`/`PAST_DUE` — see Non-goals on automatic expiry. |
| `startDate` | date, default today | yes | When the entitlement began. |
| `endDate` | date, nullable | no | Fixed term end, if any — informational only in this spec (see Non-goals); `null` means ongoing. |
| `createdAt` / `updatedAt` | timestamp | — | Standard audit columns. |
| `updatedBy` | uuid, nullable | — | Acting admin's `keycloakUserId`, matching `Product.updatedBy`'s pattern. |

**Validation rules** (enforced in `SubscriptionServiceImpl`, per `docs/standards/backend.md`):
- `ownerType` must be `CLUB` — any other value throws `ValidationException` (400). Revisit this check the day `Section` ships for real.
- `ownerId` must reference an existing `Club` — missing club throws `NotFoundException` (404).
- `productId` must reference a `Product` with `status = ACTIVE` **on create** — creating a Subscription against a `DRAFT` or `RETIRED` Product throws a new `ProductNotActiveException extends ConflictException` (409). Changing an *existing* Subscription's product is held to the same rule (you can't move a Club onto a non-active product either).
- At most one `ACTIVE` Subscription per `(ownerType, ownerId)` — enforced by a partial unique index at the DB level (mirroring `001` ADR-01's own pattern for "one active X at a time"), and pre-checked in the service for a clean `DuplicateActiveSubscriptionException extends ConflictException` (409) rather than a raw constraint-violation 500 (matching `008`'s `DataIntegrityViolationException` defense-in-depth handler already in `GlobalExceptionHandler`, which still catches this as a fallback).
- Changing a Subscription's Product (`PUT`) does not create a new row — it updates `productId` (and optionally `startDate`/`endDate`) on the existing one. Only `cancel` and a brand-new Club's first Subscription create rows.
- Cancelling an already-`CANCELLED` Subscription throws `InvalidStatusTransitionException` (reused from `008`, same exception already covers this shape) (409).

**Migration sketch** (`backend/src/main/resources/db/changelog/v1/004-add-subscription.sql`, next sequential after `003-add-product.sql`):

```sql
CREATE TABLE subscription (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type   VARCHAR(16) NOT NULL DEFAULT 'CLUB',
    owner_id     UUID NOT NULL REFERENCES club(id),
    product_id   UUID NOT NULL REFERENCES product(id),
    status       VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    start_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date     DATE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by   UUID
);

CREATE UNIQUE INDEX ux_subscription_active_owner
    ON subscription (owner_type, owner_id)
    WHERE status = 'ACTIVE';
```

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/platform/subscriptions` | `platform_admin` | Paginated list (`Page<SubscriptionDto>`), with `search` (matches on the Club's name) and backend-driven `sort`, mirroring `008`'s Product list endpoint exactly. |
| `GET /api/v1/platform/subscriptions/{id}` | `platform_admin` | Fetch one Subscription. |
| `POST /api/v1/platform/subscriptions` | `platform_admin` | Create a Subscription for a Club with no active one (`status` defaults to `ACTIVE`). |
| `PUT /api/v1/platform/subscriptions/{id}` | `platform_admin` | Change `productId`/`startDate`/`endDate` on an existing Subscription. |
| `POST /api/v1/platform/subscriptions/{id}/cancel` | `platform_admin` | Transition to `CANCELLED` — the only "removal" path; no `DELETE` endpoint, matching `008`'s no-hard-delete convention. |

All under `/api/v1/platform/**`, reusing the existing `hasRole("platform_admin")` match — no `SecurityConfig` change. `SubscriptionDto` embeds a summary of the linked Club (`id`, `name`) and Product (`id`, `name`, `code`) so the list screen doesn't need N+1 follow-up calls per row.

## UI Requirements

Composed entirely from the `ListToolbar`/`RecordCard`/`RecordFormScreen` pattern (`docs/standards/design-system.md`) — the second real usage after `008`'s Products screen, proving the pattern is genuinely reusable. No new shared components expected; flag back if one turns out to be needed.

- **`ui/src/pages/admin/SubscriptionList.tsx`** (new, at `/admin/configuration/subscriptions` — replacing `007`'s `EmptyState` placeholder for that card) — `ListToolbar` (search by Club name, sort by Club name/start date, "Add Subscription") above a `RecordCard` grid: title = Club name, badge = status (`Active`/`Cancelled`, reusing `RecordCard`'s `positive`/`muted` tones from `008`), description = Product name, key fields = Product code + start date, footer = Edit. Same backend-driven pagination/search/sort convention as `008`'s `ProductList`.
- **`ui/src/pages/admin/SubscriptionFormPage.tsx`** (new, at `/admin/configuration/subscriptions/new` and `/admin/configuration/subscriptions/:id/edit`) — `RecordFormScreen` wrapping a new `SubscriptionForm` component (`ui/src/components/SubscriptionForm/`, four-file anatomy): a Club picker (autocomplete over the **existing** `GET /api/v1/public/clubs` search endpoint via `searchClubs()` — already built for `004`'s landing page, reused here rather than building a new admin-specific club list endpoint), a Product picker (a select populated from `GET /api/v1/platform/products?status=ACTIVE` — reuses `008`'s existing list endpoint, no new backend query needed since it already supports arbitrary sort/filter via `Pageable`... **flag:** `008`'s list endpoint doesn't currently expose a `status` filter, only `search`/`sort` — this spec needs `ProductService.list` to gain an optional `status` param, a small, additive change to `008`'s existing endpoint, not a new one), start/end date fields. Edit mode adds a "Cancel Subscription" action (inline confirm, same pattern as `008`'s Retire button) calling `POST /subscriptions/{id}/cancel`, hidden once already `CANCELLED`. The Club picker is disabled once editing an existing Subscription — you change the Product, not the owner; cancel and create a new one to reassign.

**Mobile-first**, per `docs/standards/frontend.md` — both pages inherit `RecordFormScreen`'s and `ListToolbar`'s already-established responsive behavior from `008`.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `SubscriptionServiceImpl`: `ownerType != CLUB` rejected; creating against a non-`ACTIVE` Product throws `ProductNotActiveException`; a second active Subscription for the same Club throws `DuplicateActiveSubscriptionException`; `update` changes `productId` in place rather than creating a row; cancelling an already-cancelled Subscription throws `InvalidStatusTransitionException`. |
| Integration | `SubscriptionRepository`'s partial-unique-index behavior (a second `ACTIVE` insert for the same owner fails at the DB level) and the Club/Product FK constraints, against Testcontainers Postgres — includes `004-add-subscription.sql` applying cleanly alongside `003-add-product.sql`. |
| Contract | All five endpoints, plus `008`'s new `status` query param on the Product list endpoint, documented in the checked-in OpenAPI schema. |
| Component | `SubscriptionForm`: renders the Club/Product pickers and date fields, submit calls the expected handler with correctly-shaped data; the Cancel action's inline-confirm flow, mirroring `008`'s `ProductForm`/`ProductFormPage` test conventions. |
| E2E | One golden path (Playwright), extending `008`'s: log in as the seeded `platform_admin` test user, navigate `Configuration → Subscriptions`, create a Subscription linking a seeded Club to a seeded `ACTIVE` Product, confirm it appears in the list, change it to a different Product, cancel it, and confirm it stays visible with a `Cancelled` status badge. |

## Acceptance Criteria

- A platform admin can create a Subscription linking a Club to an `ACTIVE` Product, and see it in the list immediately after.
- Attempting to create a Subscription against a `DRAFT` or `RETIRED` Product is rejected with a clear error.
- Attempting to create a second active Subscription for a Club that already has one is rejected with a clear conflict error, not a silent duplicate.
- Changing a Subscription's Product updates the existing record rather than creating a new one.
- Cancelling a Subscription sets its status to `Cancelled`, keeps it visible and fetchable by id, and does not delete its row.
- No `SECTION`-owned Subscription can be created through the API or UI in this spec.
- No `DELETE` endpoint exists for Subscriptions anywhere in the API.

## Rollout Notes

- Ship after `008`'s `status` query param addition to the Product list endpoint (see UI Requirements' flag) — small, additive, no new migration.
- Migration `004-add-subscription.sql` is the next sequential migration after `003-add-product.sql`.
- No seed data ships with this spec — the first real Subscriptions are created manually through this admin UI post-deploy, same as `008`'s Products.
- **Flag for whenever `Section` is built for real:** this spec's `owner_type`/`owner_id` shape anticipates `SECTION` as a second valid owner without a breaking schema change — but the *resolution logic* (walking up the section tree per `001` ADR-03, and finally resolving `001`'s deferred "section subscription lapse behaviour") is genuinely new work for that future spec to do, not something this one left half-built. Don't assume it's a small follow-up; re-read `001` ADR-03 fresh at that point.
- **Flag for a future Invoicing spec:** decide then whether `AdminHome.tsx`'s top-level `Subscriptions & Invoices` nav item becomes a real combined view, or whether `Subscriptions` stays exclusively under `Configuration` and that nav item narrows to `Invoices` only. Not decided here.
- **Flag for a future spec: self-serve signup for Free-tier Products.** Pick a Product on the landing page, create an account, configure the Club, and claim a subdomain — no vendor involved. Decided during this spec's planning discussion: paid tiers stay vendor-assisted (`003`) until real payment processing exists; self-serve is scoped to `price = 0` Products only. Depends on this spec's `Subscription`/`Product` link existing first (the new Club's Subscription is created as the last step of that future flow) — see `docs/roadmap.md` for how it sequences against everything else.
- **Post-build addition, from manual review:** `SubscriptionForm` shows the selected Product's `maxPeriodMonths` next to the picker and auto-suggests `endDate = startDate + maxPeriodMonths` when the admin hasn't set an end date themselves — informational only, never enforced (see the new Non-goals entry above). Fixes a real confusion where the two concepts were otherwise silently disconnected.
- **Billing-cycle model, discussed during planning but explicitly not implemented here (no payment processing exists yet) — recorded for whenever a future Invoicing spec picks this up:** anniversary billing, not calendar-month billing. A Subscription's billing period should run from its own `startDate` in `billingInterval`-sized increments (subscribe on the 15th → billed the 15th of every following month), not aligned to the 1st of the calendar month. This avoids proration entirely for the common case — calendar-aligned billing would require prorating almost every first invoice, since `003`'s vendor-assisted onboarding can happen any day of the month. Proration still becomes a real question for *mid-cycle Product changes* (the `PUT` endpoint already allows this) — that's the future Invoicing spec's problem to solve, not this one's. Full reasoning in `docs/roadmap.md`.
