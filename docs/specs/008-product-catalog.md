# 008 — Product Catalog Configuration

**Depends on:** `007-configuration-hub-overview.md` (the `Configuration` landing page and its `Products` card, which this spec's screen is reached from), `001-tenancy-identity-model.md` (`Subscription.owner_type`/`owner_id`/`plan` — today `plan` is a bare string; this spec builds the structured entity a later Subscriptions spec will point `plan` at instead), `006-post-login-home-shells.md` (`AppShell`, the System Admin shell this screen renders inside).
**Status:** draft.

## Problem & Goals

There is no way to define what a club or section is actually paying for. `001`'s `Subscription` entity has a bare `plan` string with no structure behind it — no name, no price, no usage limits, nothing a billing flow or an enforcement check could read. A platform admin needs to define a small catalogue of **Products** (subscription tiers — e.g. "Free", "Club Standard", "Club Pro") up front, each with its own limits and price, before the next spec can link a `Club`/`Section` to one.

**Goals**
- A platform admin can create, view, edit, and retire Products from a real admin screen, reached via `007`'s `Configuration → Products` card.
- Each Product captures the fields the user requested (name, description, max period, free, max sections, max teams, max players, price) plus a small set of additional fields needed to make the catalogue usable and safe to reference from a future `Subscription` FK (see Data Model Changes for the full list and rationale).
- Products are never hard-deleted — once a future `Subscription` can reference one, deleting the row would orphan that reference. A `RETIRED` status is the only way to remove one from active use.

## Non-goals

- **Linking a `Club`/`Section` to a Product.** That's the very next spec in `007`'s roadmap (Subscriptions) — this spec only builds the catalogue side, not the purchase/assignment side.
- **Enforcing the usage limits this spec defines** (`maxSections`/`maxTeams`/`maxPlayers`). Defining the cap is this spec's job; checking a club against it when it creates a `Section`/`Team`/registers a player is the Subscriptions spec's or a later enforcement spec's job.
- **Billing/payment processing.** `price`/`currency`/`billingInterval` are catalogue data only — no invoice generation, no payment gateway integration. `006`'s roadmap already names "Subscriptions & Invoices" as a separate future sidebar item.
- **Public-facing pricing page.** This screen is platform-admin-only, inside the System Admin shell. Whether/how Products are ever shown to a prospective club on the public marketing site is undecided and out of scope.
- **Product-level discounts, coupons, or per-club custom pricing.** `007`'s roadmap names "Discounts & Promotions" as a separate future module — this spec's `price` is the one flat price per Product, no overrides.
- **Hard delete.** No endpoint or UI action permanently removes a Product row — see Goals above.

## User Stories

- As a platform admin, I can open `Configuration → Products` and see every Product that exists, including retired ones, each showing its name, price, and key limits at a glance.
- As a platform admin, I can create a new Product, filling in its name, description, pricing, and usage limits, so it becomes available for the next spec to offer to a club.
- As a platform admin, I can mark a Product as free, which waives the price/currency/billing-interval fields rather than requiring me to enter `0.00` by hand.
- As a platform admin, I can edit an existing Product's details.
- As a platform admin, I can retire a Product I no longer want offered to new subscribers, without losing its historical data or breaking anything that already references it.
- As a platform admin, if I try to create a Product with a code that's already in use, I see a clear conflict error instead of a silent duplicate.
- As a platform admin, I can independently toggle whether a Product shows ads, allows the club its own subdomain, and allows the club to configure Whitelisting — each off by default, so a free or low tier doesn't get any of them just by being free.

## Data Model Changes

New entity: **Product**, platform-global (not club-scoped — it's the vendor's own catalogue, sold *to* clubs/sections, matching `001`'s `Subscription.owner_type ∈ {CLUB, SECTION}` on the buying side).

**Field Reference**

| Field | Type | Required | Purpose |
|---|---|---|---|
| `id` | uuid | — | Primary key |
| `code` | string, unique | yes | Stable, admin-chosen identifier (e.g. `CLUB_STANDARD`) that a future `Subscription` FK points to. Kept separate from `name` so renaming the display name never breaks an existing reference. |
| `name` | string | yes | Display name, e.g. "Club Standard" — user-requested field. |
| `description` | text | no | User-requested field. |
| `isFree` | boolean, default `false` | yes | User-requested `free` field. When `true`, `price`/`currency`/`billingInterval` are ignored (not required at save time). |
| `price` | decimal(10,2) | required unless `isFree` | User-requested field. The recurring charge per `billingInterval`. |
| `currency` | string(3), ISO 4217 | required unless `isFree` | **Added.** `price` alone is ambiguous — this is a multi-club platform and nothing pins the currency without this field, even if only one currency is actually offered at launch. |
| `billingInterval` | enum: `MONTHLY`, `ANNUAL` | required unless `isFree`, default `MONTHLY` | **Added.** How often `price` is charged — kept distinct from `maxPeriodMonths` below, which is a different concept. |
| `maxPeriodMonths` | integer, nullable | no | User-requested `max period` field. The maximum subscription term (in months) purchasable under this Product before it must be renewed/reselected — e.g. a promotional tier capped at a 12-month term. `null` = no cap (rolling/unlimited term). Distinct from `billingInterval`'s charge cadence. Confirmed with reviewer. |
| `maxSections` | integer, nullable | no | User-requested field. Cap on `Section` rows the subscribing `Club`/`Section` may create. `null` = unlimited. |
| `maxTeams` | integer, nullable | no | User-requested field. Cap on `Team` rows. `null` = unlimited. |
| `maxPlayers` | integer, nullable | no | User-requested field. Cap on active player registrations (`TeamRegistration`/`ClubMembership` rows, exact source resolved by the future enforcement spec). `null` = unlimited. |
| `status` | enum: `DRAFT`, `ACTIVE`, `RETIRED`, default `DRAFT` | yes | **Added.** Lifecycle instead of delete — a future `Subscription` can safely reference a `RETIRED` Product's history without a dangling FK. Only `ACTIVE` Products are offered to a new subscriber (enforced by the next spec, not this one). |
| `displayOrder` | integer, default `0` | yes | **Added.** Controls card ordering on this screen (and any future public pricing page) — without it, ordering falls back to creation order, which drifts from the intended tier ranking (Free → Standard → Pro) as products are edited. |
| `showAds` | boolean, default `false` | yes | User-requested field (`show_adds`). Whether the subscribing club's public-facing pages show advertisements under this product. Defaults off — free/lower tiers don't get this enabled just by being free; an admin opts a specific product into it explicitly, same as any other tier capability here. |
| `allowSubdomain` | boolean, default `false` | yes | User-requested field. Whether a club subscribing under this product may use its own club subdomain (`{slug}.{rootDomain}`, per `002-realm-subdomain-auth.md`'s ADR-04) rather than being restricted to a shared/generic path. Defaults off — not automatically granted to free/lower tiers. |
| `allowWhitelisting` | boolean, default `false` | yes | User-requested field. Whether a club subscribing under this product can configure the platform's Whitelisting feature (the `Whitelisting` admin module already named in `006-post-login-home-shells.md`'s sidebar roadmap, restricting registration/access to approved members). Defaults off — not automatically granted to free/lower tiers. |
| `createdAt` / `updatedAt` | timestamp | — | Standard audit columns. |
| `updatedBy` | uuid, nullable | — | Acting admin's `keycloakUserId` — mirrors `001`'s `ClubBranding.updated_by` pattern; no `Person` FK, consistent with `005`'s decision not to provision `Person` rows for admins. |

**Validation rules** (enforced in `ProductServiceImpl`, per `docs/standards/backend.md`):
- `code` is unique (case-insensitive) — a duplicate on create/update throws a new `DuplicateProductCodeException extends ConflictException` (409).
- When `isFree = true`, `price`/`currency`/`billingInterval` are cleared server-side regardless of what the client sends, rather than trusted as-is.
- When `isFree = false`, `price` and `currency` are required — a missing value throws `ValidationException` (400), same as any other `@Valid` request body failure.
- A `RETIRED` product cannot transition back to `DRAFT`/`ACTIVE` in this spec (one-way) — attempting it throws a new `InvalidStatusTransitionException extends ConflictException` (409). Reversing a retirement is deliberately out of scope; if a real need for it shows up, that's a small follow-up to this rule, not a reason to delay it now.

**Migration sketch** (`backend/src/main/resources/db/changelog/v1/003-add-product.sql`, next sequential after `002-add-lead.sql`):

```sql
CREATE TABLE product (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code               VARCHAR(64) NOT NULL,
    name               VARCHAR(255) NOT NULL,
    description        TEXT,
    is_free            BOOLEAN NOT NULL DEFAULT false,
    price              NUMERIC(10,2),
    currency           VARCHAR(3),
    billing_interval   VARCHAR(16) NOT NULL DEFAULT 'MONTHLY',
    max_period_months  INTEGER,
    max_sections       INTEGER,
    max_teams          INTEGER,
    max_players        INTEGER,
    status             VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    display_order      INTEGER NOT NULL DEFAULT 0,
    show_ads           BOOLEAN NOT NULL DEFAULT false,
    allow_subdomain    BOOLEAN NOT NULL DEFAULT false,
    allow_whitelisting BOOLEAN NOT NULL DEFAULT false,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by         UUID
);

CREATE UNIQUE INDEX ux_product_code ON product (LOWER(code));
```

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/platform/products` | `platform_admin` | Paginated list (`Page<ProductDto>`, per `docs/standards/backend.md`'s pagination rule) — includes every status, ordered by `displayOrder` unless the caller's `Pageable` specifies a `sort` (e.g. `?sort=name,asc`, already native to Spring Data's `Pageable` binding — no new param needed for sort). **Added:** optional `search` query param — case-insensitive substring match against `name` OR `code`, combined with the existing pagination/sort. Omitted/blank `search` returns the unfiltered list, unchanged from today's behavior. |
| `GET /api/v1/platform/products/{id}` | `platform_admin` | Fetch one Product. |
| `POST /api/v1/platform/products` | `platform_admin` | Create a Product (`status` defaults to `DRAFT`). |
| `PUT /api/v1/platform/products/{id}` | `platform_admin` | Update a Product's editable fields, including transitioning `DRAFT → ACTIVE`. |
| `POST /api/v1/platform/products/{id}/retire` | `platform_admin` | Transition to `RETIRED` (see validation rules above) — the only "removal" path; no `DELETE` endpoint exists. |

All under `/api/v1/platform/**`, reusing `005`'s existing `SecurityConfig` match on `hasRole("platform_admin")` — no `SecurityConfig` change needed. Follows `docs/standards/backend.md`'s Controller → Service → Repository skeleton with MapStruct DTO mapping.

## UI Requirements

**Revised after a Claude Design pass, post-build** (see Rollout Notes) — Products is the reference implementation of three new *generic* pattern components, designed to be reused by every future list-backed admin/manager screen (`007`'s Subscriptions/Discounts/Invoicing/System Settings, and later manager-side screens), not one-off Products UI:

| Component | Shape |
|---|---|
| `ListToolbar` | Sits above any record list. Three fixed slots: search input (debounces into the `search` query param above), a sort control (backend-driven — selecting an option re-fetches with a new `sort` param, never a client-side re-order), and the primary "Add `<Record>`" action. Desktop (`≥ md`): one row, search grows, sort + button stay fixed-width. Mobile: search full-width on its own row, sort + button share the row below. The create action lives here, never as a tile inside the record grid itself. |
| `RecordCard` | The grid unit for any record list. Fixed slot order: title + status badge, a required 2-line-clamped description, a row of key fields (label/value pairs), an optional row of small attribute/limit chips, then a footer with an "Edit" action. Same slot order regardless of which screen uses it — only the field labels/values change. |
| `RecordFormScreen` | The shape every create/edit screen uses: a visible "Back to `<List>`" action above the title, a responsive field grid (single column at `xs`, two columns from `md` — single-value fields one-per-cell, long-form fields like `description` spanning both columns), and an actions bar (primary Save + ghost Cancel) below a divider. Content scrolls inside the page at both widths — nothing gets clipped, and desktop uses the available width instead of staying a centered mobile-width column. |

`ProductForm`'s own fields (from the Data Model table above) are unchanged in substance — `isFree` still conditionally hides/disables `price`/`currency`/`billingInterval`, and `showAds`/`allowSubdomain`/`allowWhitelisting` are still three independent toggles — but its fields now render *through* `RecordFormScreen`'s responsive grid rather than a single fixed-width mobile column. All three new components get the standard four-file anatomy (`docs/standards/frontend.md`).

Pages, all nested under `/admin/configuration/products` per `007`'s routing convention:

- **`ui/src/pages/admin/ProductList.tsx`** (new, at `/admin/configuration/products`) — `ListToolbar` (search + sort + "Add Product") above a responsive grid of `RecordCard`s, one per Product (title/status badge, description, price-or-"Free" + code as key fields, the three limit fields as chips, an Edit footer action). Empty state (no products yet, or no results for the current search) uses the existing `EmptyState` component. List data comes from `GET /api/v1/platform/products` via React Query, keyed on page/sort/search, paginated per `docs/standards/frontend.md`'s pagination rule — never fetched whole and sliced or sorted client-side.
- **`ui/src/pages/admin/ProductFormPage.tsx`** (new, at `/admin/configuration/products/new` and `/admin/configuration/products/:id/edit`) — renders `RecordFormScreen` (Back action targets the products list) wrapping the shared `ProductForm` fields; new routes rather than a dialog, deliberately, since `docs/standards/design-system.md` doesn't have a `Modal` component built yet ("Table, Modal, and loading states are next"). Edit mode adds a "Retire" button (confirmation via a plain inline confirm state, not a `Modal`, for the same reason) calling `POST /products/{id}/retire`.
- **`ui/src/api/productApi.ts`** (new) — one file per `docs/standards/frontend.md`'s per-resource convention, built on the shared `axiosConfig.ts` instance: `listProducts` (now takes `search`/`sort` alongside `page`/`size`), `getProduct`, `createProduct`, `updateProduct`, `retireProduct`.

**Mobile-first**, per `docs/standards/frontend.md`: `ListToolbar`/`RecordCard`/`RecordFormScreen` are each authored at 375px first, reflowing upward as described in the component table above.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `ProductServiceImpl`: `isFree` clears billing fields server-side; duplicate `code` throws `DuplicateProductCodeException`; retiring an already-`RETIRED` product throws `InvalidStatusTransitionException`; missing `price`/`currency` when `isFree=false` throws `ValidationException`; `showAds`/`allowSubdomain`/`allowWhitelisting` each default to `false` when omitted on create and persist whatever boolean value is sent on update. |
| Integration | `ProductRepository`'s case-insensitive unique-code lookup, the `search` query (matches on `name` OR `code`, case-insensitive, blank/omitted returns everything) combined with pagination/sort, against Testcontainers Postgres — includes the `003-add-product.sql` migration applying cleanly. |
| Contract | All five endpoints documented in the checked-in OpenAPI schema, including the `search` query param. |
| Component | `ProductForm`: renders all fields, toggling `isFree` hides/disables price fields, submit calls the expected handler with correctly-shaped data. `ListToolbar`: search debounces into a callback, sort selection fires a callback with the new sort value, create action fires its own callback. `RecordCard`: renders all slots including description. `RecordFormScreen`: renders Back action, reflows fields single/two-column at 375/900. Each gets a component test + Storybook story at 375/768/1280. |
| E2E | One golden path (Playwright), extending `007`'s: log in as the seeded `platform_admin` test user, navigate `Configuration → Products`, create a Product with a full set of fields, confirm it appears in the list with the right price/limits, open it, retire it, and confirm its status chip updates to `Retired` without disappearing from the list. |

## Acceptance Criteria

- A platform admin can create a Product with all fields from the Data Model table and see it in the list immediately after.
- Creating a Product with a `code` that already exists (case-insensitive) returns a 409 and a clear on-screen error, not a silent duplicate or a generic failure.
- Marking a Product `isFree` waives the price/currency/billing-interval requirement, both in the form and server-side, even if a client sends stale values for those fields.
- Retiring a Product changes its status to `Retired`, keeps it visible in the list and fetchable by `id`, and does not delete its row.
- A retired Product cannot be un-retired through the UI or API in this spec.
- No `DELETE` endpoint exists for Products anywhere in the API.
- A newly created Product defaults `showAds`, `allowSubdomain`, and `allowWhitelisting` to `false` unless the admin explicitly enables them — a free or low tier isn't granted any of the three just by virtue of being free.
- A platform admin can search the Products list by name or code, and sort it by a chosen field — both re-query the backend (`search`/`sort` params), never a client-side filter/re-order of an already-fetched page.
- The create/edit screen shows a visible way back to the Products list, and its fields use the available width on a desktop-sized viewport rather than staying a single narrow column.

## Rollout Notes

- Ship together with `007` — see that spec's Rollout Notes.
- Migration `003-add-product.sql` is the next sequential migration after `002-add-lead.sql`.
- No seed data ships with this spec — the first real Products (e.g. "Free", "Club Standard") are created manually through this new admin UI post-deploy.
- **Flag for the next spec (Subscriptions):** decide there whether `Subscription.plan` (currently a bare string, per `001`) becomes a `product_id` FK to this table, or a `product_code` string FK to `Product.code` — either is compatible with what's built here, but it's that spec's decision to make, not this one's.
- **`ListToolbar`/`RecordCard`/`RecordFormScreen` added post-build, via a Claude Design pass**, after manual review found the shipped Products screens lacking (no description on cards, an "Add Product" tile cluttering the record grid, no Back action on the form, no search/sort, a form stuck at mobile width even on desktop). Designed as generic patterns — not Products-specific — in the "Cricket Legend Platform" Claude Design project, specifically so `007`'s remaining Configuration modules (Subscriptions, Discounts & Promotions, Invoicing, System Settings) can compose from them directly instead of each getting its own design pass. Products is the reference implementation.
- **`showAds`/`allowSubdomain`/`allowWhitelisting` added post-build, during manual review of the shipped pages.** The backend (migration, entity, DTOs, service, controller, OpenAPI schema) is updated to match this revision before the frontend `ProductForm` picks up the three new toggles — backend and frontend ship as two separate follow-up passes rather than together, unlike the original `007`+`008` build.
