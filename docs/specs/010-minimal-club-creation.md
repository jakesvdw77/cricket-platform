# 010 — Minimal Club Creation

**Depends on:** `001-tenancy-identity-model.md` (the `Club` entity this reuses), `002-realm-subdomain-auth.md` (ADR-04's slug reserved-word blocklist), `003-club-onboarding.md` (the full future onboarding flow this is a deliberate minimal slice of), `004-landing-page.md` (already introduced the `Club`/`ClubStatus` stub and `club` table this spec builds admin CRUD on top of, and `ClubSearchService`'s public typeahead this spec does not touch), `009-subscriptions.md` (the reason this spec exists — a `Subscription` needs a real `Club` to attach to).
**Status:** draft.

## Problem & Goals

`004-landing-page.md` already introduced a minimal `Club` entity/table/`ClubStatus` enum as a prerequisite stub for its public lead-capture club search and `005`'s `platform_admin` auth check — but nothing in the app can actually *create* a `Club`. The only way one gets into the database today is a direct SQL insert, which is exactly what blocked manually testing `009-subscriptions.md`'s screens (a `Subscription` FKs to a real `Club.id`). `003-club-onboarding.md` is the eventual full answer — branding, `Section`/`Season` bootstrapping, admin invitations — but none of that is built, and building all of it is far more than is needed to unblock Subscription testing today.

This spec is the smallest useful slice: a platform admin creates a bare `Club` (name + slug) through the UI, landing `ACTIVE` immediately, with no branding/section/invitation step in between.

**Goals**
- A platform admin can create a `Club` through the UI and have it exist, `ACTIVE`, immediately — no database access required.
- A platform admin can list, search, and edit existing `Club`s (rename, fix a slug typo, suspend/reactivate) — the same `ListToolbar`/`RecordCard`/`RecordFormScreen` pattern `008`/`009` already established.
- Reuse the `Club`/`ClubStatus` entity and `club` table `004-landing-page.md` already shipped — this spec adds the missing CRUD around them, it does not redefine them.
- `Club.slug` is validated against `002-realm-subdomain-auth.md` ADR-04's reserved-word blocklist before it's accepted — this is the first place in the app a `Club.slug` is ever set by a human, so it's the correct point to finally enforce that rule rather than deferring it again.

## Non-goals

- **The full onboarding flow.** Branding (`ClubBranding`), initial `Section`/`Season` creation, and admin `Invitation` are entirely `003-club-onboarding.md`'s scope and stay unbuilt here. This spec does not touch the `Invitation` entity or any invite-by-email mechanism.
- **The `ONBOARDING` status / branding-review gate.** `003`'s flow lands a new club in `ONBOARDING` until setup is confirmed complete; this spec skips straight to `ACTIVE` on create. `ClubStatus.ONBOARDING` stays a defined-but-unreachable enum value through this spec — `003`, when it ships, decides whether it reuses this spec's create endpoint (defaulting it to `ONBOARDING` instead) or adds its own wizard-driven creation path.
- **Self-service / public club signup.** Still vendor-assisted only, consistent with `003`'s existing Non-goals — this is a `platform_admin`-only screen, same gate as `008`/`009`.
- **Club org-type (School / Academy / Cricket Club).** A real future data point already captured as a roadmap note under `003`'s section in `docs/roadmap.md` — intentionally not added here to keep this slice minimal; cross-referenced, not re-decided.
- **Hard delete.** `Subscription.owner_id` and (later) `Section`/`Team`/`ClubMembership` all FK to `Club.id` — deleting a club risks orphaning real billing/roster data. `Suspend`/`Reactivate` (see User Stories) is the only lifecycle action this spec adds, matching `008`'s Retire and `009`'s Cancel precedent of "disable, never delete."
- **Subdomain provisioning / DNS.** Slug validation (format + reserved-word check) happens here; actually wiring a new slug up to `002`'s `TenantResolutionFilter` and any DNS-level step is that spec's own concern, not this one's.

## User Stories

- As a platform admin, I can create a `Club` with a name and a slug, validated against the reserved-word blocklist, so it exists immediately and I can attach a `Subscription` to it.
- As a platform admin, I can see a list of existing `Club`s, searchable by name/slug, so I know what already exists before creating a duplicate.
- As a platform admin, I can edit a `Club`'s name or slug, so I can fix a mistake without recreating the row and losing any `Subscription` already attached to its `id`.
- As a platform admin, I can suspend an `ACTIVE` club and reactivate a `SUSPENDED` one, so I have a way to disable a club without deleting it or breaking rows that FK to it.

## Data Model Changes

No new entity. `Club` and `ClubStatus` already exist (`backend/src/main/resources/db/changelog/v1/001-prerequisite-club-person.sql`, `domain/Club.java`, `domain/ClubStatus.java`), shipped as a stub by `004-landing-page.md`. This spec adds only the audit columns every other admin-managed entity in this pattern already carries (`Product`, `Subscription`):

```sql
-- backend/src/main/resources/db/changelog/v1/005-add-club-audit-columns.sql
ALTER TABLE club
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN updated_by UUID;
```

`Club.java` gains matching `createdAt`/`updatedAt`/`updatedBy` fields and `@PrePersist`/`@PreUpdate` handling, mirroring `Product.java`'s exact shape. `updated_by` stays unpopulated (`null`) for now — no request-principal-to-`Person` resolution exists yet (`002` is still only partially implemented) — same precedent already accepted for `Product`/`Subscription`.

No change to `ClubSearchService`/`ClubSearchServiceImpl` (`004`'s public typeahead) or `ClubSummaryDto` (the public-facing DTO `009`'s Subscription form already consumes) — this spec adds a separate, `platform_admin`-only `ClubService`/`ClubController` pair alongside them, the same way `009` kept `SubscriptionService` separate from `ProductService` rather than overloading one service with two audiences.

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/platform/clubs` | `platform_admin` | Paginated, searchable (name/slug) list of all `Club`s regardless of status — mirrors `ProductController`'s list shape (`search` + `Pageable`) |
| `GET /api/v1/platform/clubs/{id}` | `platform_admin` | Single `Club` by id, for the edit screen |
| `POST /api/v1/platform/clubs` | `platform_admin` | `{name, slug}` → `Club`, status set directly to `ACTIVE`. Rejects a slug that fails format validation or matches the ADR-04 reserved-word list (`www, auth, api, app, admin, static, mail, cdn, status, docs`) with `400`; rejects a slug that collides with an existing `Club.slug` with `409` (`DuplicateSlugException extends ConflictException`, matching `docs/standards/backend.md`'s named-exception convention) |
| `PUT /api/v1/platform/clubs/{id}` | `platform_admin` | `{name, slug}` → updates both fields, same slug validation as create (format, reserved-word, uniqueness-excluding-self) |
| `POST /api/v1/platform/clubs/{id}/suspend` | `platform_admin` | `ACTIVE → SUSPENDED`. `409` (`InvalidStatusTransitionException`) if already `SUSPENDED` |
| `POST /api/v1/platform/clubs/{id}/reactivate` | `platform_admin` | `SUSPENDED → ACTIVE`. `409` if not currently `SUSPENDED` |

`ONBOARDING` is a valid `ClubStatus` value in the database but no endpoint in this spec ever produces or transitions to/from it — it stays reachable only via direct data manipulation until `003` ships.

## UI Requirements

Composed entirely from the existing shared library (`docs/standards/design-system.md`'s Record list / create-edit pattern) — `ListToolbar` + `RecordCard` grid + `RecordFormScreen`, the same three components `008`/`009` already use. No new shared component.

**Where this lives:** `AdminHome.tsx`'s sidebar already has a `Club Onboarding` nav item at `/admin/onboarding`, currently `<EmptyState title="Club Onboarding" description="Coming soon." />` in `ui/src/App.tsx` — reserved for `003`'s eventual full flow but otherwise empty. This spec's screens land there, **not** as a new card under `007-configuration-hub-overview.md`'s Configuration hub — that hub is explicitly scoped to product/billing configuration modules (Products, Subscriptions, Discounts & Promotions, Invoicing, System Settings per `007`'s own table), not tenant management, and `007`'s Non-goals explicitly rule out restructuring the sidebar. Reusing the already-reserved `Club Onboarding` item keeps the nav's information architecture intact and gives `003` a real screen to extend later instead of replace.

- **`ui/src/pages/admin/ClubList.tsx`**, replacing the `EmptyState` route at `/admin/onboarding` — `ListToolbar` (search by name/slug, sort options Name / Created date, "Add Club") + `RecordCard` grid (title = name, status badge = `Active`/`Suspended`/`Onboarding` using `positive`/`muted`/`neutral` tones, description = slug, footer = Edit) + pagination + `isError`/empty states from the start, per `008`'s established review finding.
- **`ui/src/components/ClubForm/`** (new shared component, four-file anatomy per `docs/standards/frontend.md`) — name + slug fields only, inline validation mirroring the backend's format/reserved-word rules for immediate feedback before submit.
- **`ui/src/pages/admin/ClubFormPage.tsx`**, at `/admin/onboarding/new` and `/admin/onboarding/:id/edit` — `RecordFormScreen` wrapping `ClubForm`; actions bar has Save + nav "Cancel" + (edit mode) a status action showing "Suspend" for an `ACTIVE` club or "Reactivate" for a `SUSPENDED` one, same single-transition-button precedent as `008`'s Retire.
- **`ui/src/App.tsx`** — replace the `onboarding` route's inline `EmptyState` with `ClubList`/`ClubFormPage` at `/admin/onboarding`, `/new`, `/:id/edit`. Sidebar label stays `Club Onboarding` unchanged — this spec doesn't rename it, since `003` still owns what eventually fills the rest of that flow out.

**Mobile-first**, same responsive rules as `008`/`009`'s screens — no new visual pattern.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `ClubServiceImplTest` — slug format validation, reserved-word rejection, duplicate-slug `409`, suspend/reactivate transitions and their invalid-transition `409`s, create defaults to `ACTIVE` |
| Integration | `ClubRepositoryTest` (Testcontainers) — `005-add-club-audit-columns.sql` applies cleanly on top of `001`'s existing `club` table; the unique slug constraint actually rejects a collision at the DB level as TOCTOU defense-in-depth, same pattern as `009`'s `DataIntegrityViolationException` handler |
| Contract | New endpoints + updated `ClubDto` (with audit fields) documented in the checked-in OpenAPI schema |
| Component | `ClubForm.test.tsx`, `ClubList.test.tsx`, `ClubFormPage.test.tsx` — mirror `ProductForm`/`ProductList`/`ProductFormPage`'s conventions, including `isError` coverage from the start |
| E2E | One golden path (Playwright): platform admin creates a Club, confirms it in the list as `Active`, edits its name, suspends it, confirms the `Suspended` badge, reactivates it. Not wired into CI, same precedent as `005`/`008`/`009` |

## Acceptance Criteria

- A platform admin can create a `Club` through the UI and have it exist as `ACTIVE` immediately, with no direct database access.
- A slug matching the ADR-04 reserved-word list, or an already-taken slug, is rejected with a clear, specific error — not a generic failure or a silent no-op.
- An existing `Club` can be renamed/re-slugged without losing its `id` (and therefore without breaking any `Subscription` already attached to it).
- A `Club` can be suspended and reactivated; a `Subscription` attached to a suspended club is unaffected by this spec (no cascading status change — that's `001`'s still-open "Section subscription lapse behaviour" deferred item, not this one).
- `009-subscriptions.md`'s Subscription form's Club picker can find and select a `Club` created through this new screen, end to end.

## Rollout Notes

- Ships as its own PR, independent of `003`. When `003-club-onboarding.md` is eventually built, it extends this spec's `ClubList`/`ClubFormPage`/`ClubService` rather than replacing them — branding, `Section`/`Season` bootstrap, and invitations become additional steps *after* this spec's bare create, not a parallel mechanism. `003`'s own plan should explicitly decide then whether new clubs still land `ACTIVE` immediately (today's behavior) or move to `ONBOARDING` first once there's an actual onboarding flow to gate on.
- Unblocks manual/E2E testing of `009-subscriptions.md`'s screens against a real `Club`, which is this spec's immediate, concrete reason for existing.
- The Club org-type field (School / Academy / Cricket Club) stays a `docs/roadmap.md` note under `003` — revisit there, not here, if/when it's actually needed.
