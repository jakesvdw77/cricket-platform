# 012 — Club Profile

**Depends on:** `001-tenancy-identity-model.md` (the `ClubBranding` 1:1-entity precedent this spec's `ClubProfile` mirrors, and ADR-06's "club admins self-edit their own club-scoped data" decision this spec designs toward but does not yet implement), `010-minimal-club-creation.md` (the `Club` stub and `/admin/onboarding` screens — `ClubList.tsx`, `ClubForm/`, `ClubFormPage.tsx` — this spec extends rather than replaces), `docs/roadmap.md`'s `003-club-onboarding.md` entry (the "organisation type… needs a field" note this spec resolves).
**Status:** draft.

## Problem & Goals

`010-minimal-club-creation.md` gave a platform admin a way to get a bare `Club` (name + slug) into the database, but nothing beyond that. There's no way to record what kind of organisation a club actually is, no logo or banner, no address, no way to reach the club by email/phone/website — every field a real club profile needs is still missing, and the only way to get any of it into the system today is a direct database write. This spec is the next slice: a real `ClubProfile` a platform admin can fill in on a club's behalf, extending `010`'s existing onboarding screens rather than introducing a new surface.

**Goals**
- A platform admin can record a club's organisation type, logo, banner, address, email, phone, and website through the UI, with no direct database access.
- These fields live on a new `ClubProfile` entity, 1:1 with `Club`, mirroring the `ClubBranding` precedent in `001-tenancy-identity-model.md` — `Club` itself stays the minimal tenancy row `001` and `010` already established.
- The org-type field resolves the roadmap note already tracked under `003-club-onboarding.md` in `docs/roadmap.md` — this spec is where that field actually gets built.
- The editing screen and endpoint are shaped so a club admin can self-edit their own profile later (per `001` ADR-06) without a rebuild — same "one component, two audiences" precedent `003-club-onboarding.md` set for the branding editor — even though only `platform_admin` can reach it today.
- Image uploads (logo, banner) get a first, generically-reusable upload mechanism — nothing in the codebase handles file uploads yet, and this is a deliberately small, honest first version of it.

## Non-goals

- **A "Main Contact Person" field, or any Club Contacts list.** The user's original ask was a Main Contact Person field on the club profile itself. During scoping, that turned out to be the wrong shape: it's really just one entry in a future list of named contacts (name, role, phone, email, mobile — one flagged primary), not a scalar field on `ClubProfile`. That list is its own future spec, "Club Contacts," not built here. Until it ships, "who to contact at this club" has no answer in this system — that's a real gap, not an oversight, and this spec deliberately does not paper over it with a placeholder field that would need un-shipping later.
- **Sponsors.** Name, website, icon, banner, brand colours, social links for a club's sponsors — a separate future spec, "Sponsors." `MediaUpload` (below) is built generically enough that spec should be able to reuse it for sponsor icons/banners, but no sponsor-specific field or screen is built here.
- **Social media links.** Would belong to the Club Contacts or Sponsors specs' "list of X" shape (repeatable rows with add/remove chrome) if they end up needed on the profile at all — not decided here, and no repeatable-list component is built in this spec regardless (see UI Requirements — `ClubProfile` has no list-typed field of its own).
- **Club-Manager self-service.** The screen and endpoint this spec builds are `platform_admin`-only, the same interim gate `010` used. A real "Club Manager" who could log in and edit their own club's profile needs `ClubMembership`/`RoleAssignment` to exist first — still blocked per `docs/roadmap.md`'s "Blocked on the full tenancy model" section. This spec designs for that reuse (see UI Requirements, Rollout Notes) but does not build the auth path that would let it happen.
- **Non-image media types.** `MediaUpload` (below) accepts only a fixed set of image MIME types (PNG/JPEG/WebP, matching `ClubBranding`'s existing logo/favicon handling). Documents, video, or any other upload type is out of scope — a genuinely different validation/storage/serving story, not a small extension of this one.
- **Multi-instance / production-grade file storage.** Uploaded files are written to a configured local directory on the backend instance and served back via a static path — see Data Model Changes / Rollout Notes. This does not survive or scale across multiple backend instances (no shared/networked volume, no object storage). Accepted as a known limitation of this pass, not solved here — flagged explicitly so it isn't mistaken for a finished decision.
- **Address validation against a real postal/geocoding service.** `AddressFields` (below) captures free-text address components with basic required-field validation only — no address-lookup autocomplete, no postal-code-format-per-country validation, no geocoding. A future enhancement, not required to make the field usable.
- **Hard delete of `ClubProfile`.** Same "disable, never delete" posture `010` established for `Club` itself — there's no lifecycle action on `ClubProfile` at all in this spec; it's created alongside/after a `Club` and only ever updated in place.

## User Stories

- As a platform admin, I can set a club's organisation type (Club / Academy / School / Other) so the system records what kind of organisation it actually is.
- As a platform admin, I can upload a club's logo and banner images so the club has a visual identity captured beyond `ClubBranding`'s existing logo/colour token set.
- As a platform admin, I can record a club's address (number, street, city, province/state, country, postal code) so it's available wherever the club's physical location matters later.
- As a platform admin, I can record a club's email, phone, and website, each validated to a sensible format, so this contact information is usable rather than free-text guesswork.
- As a platform admin, I can edit any of the above at any time from the same screen I already use to manage a club's name and slug (`010`'s `/admin/onboarding/:id/edit`), without navigating to a separate page.
- As a platform admin creating a brand-new club, I can leave every profile field blank and fill them in later — `ClubProfile` has no fields required at `Club`-creation time.

## Data Model Changes

**New entity — `ClubProfile`**, 1:1 with `Club`, mirroring `001-tenancy-identity-model.md`'s `ClubBranding` shape (a separate entity with its own `updated_by`/audit trail, keeping `Club` itself tenancy-only rather than accreting columns):

```
ClubProfile {
    uuid    club_id            -- PK and FK to club.id (1:1, same shape as club_branding)
    string  type                -- CLUB | ACADEMY | SCHOOL | OTHER, nullable (blank until set)
    string  logo_url
    string  banner_url
    -- address, embedded (see below) rather than a separate table — strictly 1:1, no
    -- independent lifecycle of its own
    string  address_number
    string  address_street
    string  address_city
    string  address_province_state
    string  address_country
    string  address_postal_code
    string  email
    string  phone
    string  website
    timestamp created_at
    timestamp updated_at
    uuid    updated_by
}
```

`address_*` maps to a JPA `@Embeddable Address` (deliberately not `ClubAddress` — a generic, unscoped embeddable so the future Club Contacts and Sponsors specs can embed the exact same class into their own entities via `@Embedded`, rather than each redefining an identical six-field type) embedded directly into `ClubProfile` — same table, no join, consistent with the "strictly 1:1, no independent lifecycle" reasoning `001` used for `ClubBranding` rather than splitting it into its own entity. Every address field is nullable; a `ClubProfile` with no address entered yet is valid.

`logo_url`/`banner_url` are populated by the generic upload mechanism below (not raw file bytes in the table) — the same `*_url` shape `ClubBranding.logo_url`/`favicon_url` already use in `001`'s Field Reference.

`email`/`website` get `@Email`/URL-pattern validation at the DTO layer (`docs/standards/backend.md`'s DTO-boundary rule), not at the entity/column level — same posture `010` used for slug format validation.

**Migration** (next sequential file after `010`'s audit-column migration):

```sql
-- backend/src/main/resources/db/changelog/v1/006-add-club-profile.sql
CREATE TABLE club_profile (
    club_id                UUID PRIMARY KEY REFERENCES club(id),
    type                   VARCHAR(16),
    logo_url               VARCHAR(512),
    banner_url             VARCHAR(512),
    address_number         VARCHAR(32),
    address_street         VARCHAR(255),
    address_city           VARCHAR(128),
    address_province_state VARCHAR(128),
    address_country        VARCHAR(128),
    address_postal_code    VARCHAR(32),
    email                  VARCHAR(255),
    phone                  VARCHAR(32),
    website                VARCHAR(512),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by             UUID
);
```

No change to `Club`/`club` itself — this spec adds the sibling row, exactly as `001` describes `ClubBranding` doing, rather than extending `010`'s `Club` entity with more columns.

**`MediaUpload` storage — no new entity.** An uploaded file is written to a configured local directory (e.g. `${app.media.storage-path}`, a new Spring config property) under a generated filename, and the resulting relative path is what `ClubProfile.logo_url`/`banner_url` store — served back via a static resource handler mapped to a public path (e.g. `/media/**`). No `MediaAsset` table is introduced in this pass; the URL string is the only record kept, same posture `001`'s `ClubBranding.logo_url` already takes for its own logo/favicon. See Rollout Notes for why local disk is accepted for now and what it will take to revisit.

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/platform/clubs/{id}/profile` | `platform_admin` | Fetches `ClubProfile` for a club; returns an empty/default-shaped profile (all fields `null`) rather than `404` if the club has no profile row yet — a brand-new `Club` from `010` never has one until first saved here |
| `PUT /api/v1/platform/clubs/{id}/profile` | `platform_admin` | Upserts `ClubProfile` — creates the row on first save, updates in place thereafter. `{type?, logoUrl?, bannerUrl?, address: {...}?, email?, phone?, website?}`, all fields optional/nullable. `400` (`ValidationException`) on a malformed email/website, matching `docs/standards/backend.md`'s exception table |
| `POST /api/v1/platform/media` | `platform_admin` | Generic image upload — multipart `file` field, MIME-type restricted to the fixed image allowlist (`400`/`ValidationException` on rejection). Returns `{url}`, the path to hand back into `logoUrl`/`bannerUrl` on the profile save above. Not scoped to `ClubProfile` specifically — any future consumer (Sponsors, Club Contacts) calls the same endpoint, per this spec's reusability goal |

`PUT /profile` is authorized the same interim way `010`'s endpoints are — a flat `platform_admin` check — but written as a scope-shaped check (`@PreAuthorize` against `clubId`, not a bare role) so swapping in `001`'s `canAdminister(authentication, clubId)` scope resolution later (once `RoleAssignment` exists) is a one-line change, not a rewrite. This mirrors `003-club-onboarding.md`'s "one component, two audiences" branding-editor precedent applied to the endpoint layer.

## UI Requirements

Extends `010-minimal-club-creation.md`'s existing screens — no new page.

- **`ui/src/components/ClubForm/`** grows from its current Name/Slug-only shape into a sectioned form: **Basic Info** (existing Name/Slug fields, plus the new org-`type` select), **Contact** (email, phone, website), **Address**, and **Branding** (logo, banner). Given the field count, organise these as MUI `Tabs` within `RecordFormScreen`'s existing field-grid area rather than one long scrolling form — consistent with `docs/standards/design-system.md`'s Record list / create-edit pattern, which doesn't prescribe tabs but doesn't rule them out either; this is the first `RecordFormScreen` consumer with enough fields to need them, so `RecordFormScreen` gains an optional `tabs` composition mode here rather than each future large form inventing its own. Basic Info stays the default/first tab so `010`'s existing create flow (name + slug only) is unchanged for a platform admin who wants to create a bare club and fill in the rest later.
- **`ui/src/pages/admin/ClubFormPage.tsx`** — on edit, also fetches `GET .../profile` alongside the existing `GET .../clubs/{id}` and threads it into `ClubForm`'s `initialValues`; save becomes two calls on submit (`PUT .../clubs/{id}` for name/slug as today, `PUT .../clubs/{id}/profile` for everything else), matching `011-inline-club-creation-in-subscription-form.md`'s precedent of sequencing two independent mutations from one submit rather than requiring a single combined backend endpoint. On **create**, the profile fields are disabled/hidden until the club exists (no `clubId` to attach a profile to yet) — same "id must exist first" constraint `001`'s `ClubBranding` and `003`'s onboarding sequencing already assume; a platform admin fills in Name/Slug, saves, and is dropped onto the edit route where the rest of the tabs become available, consistent with `010`'s existing create→redirect-to-list flow but adjusted so profile completion continues to happen in edit mode.
- **New shared components** (`docs/standards/frontend.md`'s four-file anatomy, each under `ui/src/components/`), all designed for reuse beyond this spec's own screen:
  - **`AddressFields`** — number/street/city/province-state/country/postal code as one grouped field set, modeled after `ClubNameSlugFields`'s existing "grouped field pair" shape (props in, `onChange` callbacks out, no internal fetching). Intended for reuse by the future Club Contacts and Sponsors specs, which will each likely want an address of their own — noted here as reuse intent only, not scope for this spec.
  - **`PhoneInput`** — thin wrapper around `Input`, format-agnostic (no country-code enforcement in this pass, consistent with this spec's "basic validation, not a full address/phone service" posture).
  - **`WebsiteInput`** — thin wrapper around `Input` with URL-format validation matching the backend's DTO-layer check, same "inline validation mirrors backend rules" precedent `ClubNameSlugFields`/`ClubForm` already established for slug format.
  - **`MediaUpload`** — generic image upload control: file picker restricted to the image MIME allowlist client-side (mirrored, not replacing, the backend's own check), preview of the current image, calls `POST /api/v1/platform/media` on selection and returns the resulting URL to its consumer via an `onUploaded` callback — it does not know or care that its first two consumers are "logo" and "banner" specifically, so Sponsors' future icon/banner fields can reuse it unchanged.
- **Mobile-first**, same responsive rules as `010`'s screens — tabs collapse to a scrollable single row at `xs`, consistent with MUI `Tabs`' default mobile behaviour; no fixed desktop-only assumption anywhere in the new fields.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `ClubProfileServiceImplTest` — upsert-creates-on-first-save vs. updates-in-place, email/website format validation rejects malformed input, org-`type` accepts only the four enum values; `MediaServiceImplTest` — MIME-type allowlist rejection, generated filename/URL shape |
| Integration | `ClubProfileRepositoryTest` (Testcontainers) — `006-add-club-profile.sql` applies cleanly against `010`'s existing `club` table, the embedded `Address` fields round-trip correctly, `club_id` PK/FK constraint actually enforces 1:1 |
| Contract | New endpoints + `ClubProfileDto`/media upload response documented in the checked-in OpenAPI schema |
| Component | `ClubForm.test.tsx` (extended) — new tabs render, org-`type` select/email/phone/website validation messages surface correctly, profile tabs are disabled in create mode before a club exists; `AddressFields.test.tsx`, `PhoneInput.test.tsx`, `WebsiteInput.test.tsx`, `MediaUpload.test.tsx` — one meaningful interaction each (a validation error state, an upload success/failure), each with a Storybook story per `docs/standards/design-system.md` |
| E2E | One golden path (Playwright), extending `010`'s existing flow: platform admin creates a Club, opens it in edit mode, switches through each new tab, sets org type, uploads a logo, fills in address/email/phone/website, saves, reloads the edit screen, and confirms every value persisted. Not wired into CI, same precedent as `005`/`008`/`009`/`010`/`011` |

## Acceptance Criteria

- A platform admin can set a club's organisation type, logo, banner, address, email, phone, and website through the UI, with no direct database access.
- A brand-new `Club` created via `010`'s existing create flow has no `ClubProfile` row until the admin first saves profile data on it — creation never requires any profile field.
- An invalid email or website format is rejected with a specific, field-level error, not a generic failure.
- Uploading a non-image file to `MediaUpload`/`POST /api/v1/platform/media` is rejected, not silently accepted or stored.
- Reopening a club's edit screen after saving shows every previously-entered profile field, correctly repopulated.
- The `PUT /profile` endpoint's authorization check is written against `clubId` scope, not a bare role check, even though only `platform_admin` can satisfy it today (verifiable by reading the `@PreAuthorize` expression, not just by testing access).

## Rollout Notes

- Ships as its own PR, independent of any of `003`/`009`/`011`'s in-flight work, extending `010`'s already-merged screens.
- **Resolves the `docs/roadmap.md` roadmap note under `003-club-onboarding.md`'s section** ("`Club` used as umbrella term… needs an organisation type field, set during onboarding"). This spec is where that field is actually built, as `type` on `ClubProfile` rather than on `Club` itself. `001-tenancy-identity-model.md`'s `Club` Field Reference does not change — the note lives at `ClubProfile` in this spec's Field-equivalent (Data Model Changes above), not as a new `Club` column, since the field-shape decision in this spec's Background was to keep it off `Club` entirely. A human should mark that roadmap entry resolved/removed and add a pointer to this spec once this ships — not actioned by this spec itself.
- **Local disk media storage is a known, deliberately-flagged limitation**, not a finished decision: it does not survive or scale across multiple backend instances. Revisit before any multi-instance or production deployment — likely an object-storage swap (e.g. S3-compatible) behind the same `MediaUpload`/`POST /media` contract, so this pass's frontend component and API shape don't need to change, only the storage implementation behind them.
- **Designed for club-admin self-service, not built for it.** The `PUT /profile` endpoint's scope-shaped `@PreAuthorize` and `ClubForm`'s tab structure are deliberately reusable the moment `001`'s `RoleAssignment`/`ClubMembership` model ships (`docs/roadmap.md`'s "Blocked on the full tenancy model" section) — per `001` ADR-06 and `003`'s branding-editor precedent, a club admin should eventually reach this same screen and endpoint to self-edit their own profile. That auth path itself is not built here.
- **Club Contacts and Sponsors are the next two specs this one sets up for.** Both will likely reuse `AddressFields` and `MediaUpload` directly; neither is scoped or designed in detail here beyond that reuse intent.
