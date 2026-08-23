# 021 — Club Contacts

**Depends on:** `012-club-profile.md` (reserved `Contact`/`ContactDto` for this exact spec, and named "Club Contacts" as the next follow-up in its own Rollout Notes), `020-club-manager-access.md` (the `/api/v1/manage/**` namespace, `AccessService.canAdministerClub`, and `ManagerHome`'s `Outlet` context this spec builds directly on top of, per `020`'s own Rollout Notes), `008-product-catalog.md`/`010-minimal-club-creation.md` (the `ListToolbar`/`RecordCard`/`RecordFormScreen` list/CRUD pattern this spec reuses, and `Product`'s "never hard-deleted, lifecycle status instead" precedent).
**Status:** draft.

## Problem & Goals

Nothing in this system today can answer "who do I contact at this club?" — `012`'s own Non-goals flagged this as a real, deliberate gap: a club's Main Contact Person turned out to be one entry in a future *list* of named contacts, not a scalar field on `ClubProfile`. `012` reserved `backend/src/main/java/com/cricketlegend/domain/Contact.java`/`dto/ContactDto.java` for exactly this follow-up, but both remain unused in the codebase today. Separately, `docs/roadmap.md` names "Club Contacts" (name, role, phone, email, mobile, one flagged primary) as the next unscoped item under `003-club-onboarding.md`'s section.

This spec builds that list — and, per the explicit request behind this epic, makes it something a club's own `CLUB_ADMIN` manages themselves via `020`'s new `/manage` surface, not something that requires a platform admin.

**Goals**
- A club admin (or a platform admin, who already passes `AccessService.canAdministerClub`'s superset check) can list, add, edit, and remove named contacts for their own club — first name, last name, email, phone, a free-text role, an optional photo, and one contact flaggable as primary.
- Reuses `012`'s reserved `Contact`/`ContactDto` for the name/email/phone portion, exactly as that spec's Rollout Notes intended — not a second, parallel definition of the same four fields.
- Reuses this project's mandatory list/CRUD pattern (`ListToolbar` + `RecordCard` + `RecordFormScreen`, already established by `008`'s Product catalogue and `010`'s Club list) rather than a bespoke layout.
- Ships on `020`'s `/api/v1/manage/**` namespace only — see the architecture note below for why this spec, unlike `012`, does not also need a parallel `/api/v1/platform/**` mirror.
- A club admin can attach a photo to a contact, reusing `012`'s `MediaUpload` mechanism — which surfaced a second, related namespace gap (see the API Contract's Media architecture note) fixed by this spec.

## Non-goals

- **A platform-admin-facing `/admin` screen for Club Contacts.** The API is reachable by `platform_admin` today regardless (see the architecture note below — `canAdministerClub`'s existing superset behaviour), but no dedicated `/admin/onboarding/:id/contacts` UI is built in this pass. This is a deliberate scope match to the actual ask behind this epic — club-admin self-service, not a new admin-facing feature — not an oversight. Add one later only if a real platform-admin workflow (e.g. a cross-club contact directory) needs it.
- **Sponsors.** Named alongside Club Contacts in `docs/roadmap.md`, but a separate future spec — not built here, even though it will likely reuse the list/CRUD pattern and `/manage`-only API shape this spec establishes.
- **Any grant/revoke `RoleAssignment` UI, or inviting additional per-club users.** Unchanged from `020`'s own Non-goals — still out of scope, still no second real persona to design against yet.
- **Address or social-media fields on a contact.** `012`'s Non-goals already deferred "social media links" generally; a Club Contact is a name/role/email/phone/photo row only, not a mini-profile. `AddressFields` (`012`) is not used here — a named contact person doesn't have their own address in this pass. (`MediaUpload` *is* used, for the photo field — see Goals/User Stories/API Contract.)
- **Photo cropping, resizing, or any image editing beyond `MediaUpload`'s existing fixed-dimension preview.** Reused exactly as `012` built it (the `'logo'` variant's square preview) — no new image-editing capability.
- **Showing a contact's photo in the `ClubContactList` card grid.** `RecordCard` (`008`) has no avatar/image slot in its current shape — adding one is a real but separate future enhancement to that shared component, not scoped here. The photo is captured and shown only on the create/edit form this pass.
- **Hard delete.** Matches this codebase's existing "disable, never delete" posture (`Product`'s `RETIRED` status, `Club`'s suspend/reactivate) rather than introducing the app's first hard-delete action. See Data Model Changes for the `active` flag this uses instead.
- **Any change to `ClubProfile`, `ClubForm`, or the existing `/manage/club-profile` screen from `020`.** Club Contacts is its own list screen, not a new tab on `ClubForm` — a repeatable list of records doesn't fit that component's single-record tab shape.
- **Validating a role against a fixed list.** `role` is free text (e.g. "Chairman", "Treasurer", "Ground Manager") — clubs use different terminology, and standardising it isn't this spec's problem to solve.

## User Stories

- As a club admin, I can see a list of my club's contacts, each showing their name, role, and whether they're the primary contact.
- As a club admin, I can add a new contact with a name, email, phone, role, and optionally a photo — using the same upload control platform admins already use for club branding (`012`).
- As a club admin, I can edit an existing contact's details, or flag a different contact as primary — flagging a new primary automatically un-flags whoever held it before, so I never have to manage that by hand.
- As a club admin, I can deactivate a contact who's no longer involved (e.g. a past Treasurer), without losing their record, and reactivate one if that turns out to be premature.
- As a platform admin, I can reach the same contact data if I ever need to (via the same `/manage` API my `platform_admin` role already has superset access to), even though this spec doesn't build a dedicated admin screen for it.
- As a club admin for club X, I cannot see or edit club Y's contacts, even by guessing an id — enforced server-side, matching `020`'s existing cross-club isolation.

## Data Model Changes

**New entity — `ClubContact`**, many-to-one with `Club` (a plain `UUID` FK column, no JPA relationship navigation — matching `ClubProfile`'s existing convention, see `012`'s own Javadoc reasoning), embedding the existing `Contact` (`012`, `firstName`/`lastName`/`email`/`phone`) with no `@AttributeOverride` needed (no column-name collision at this embedding site):

```
ClubContact {
    uuid      id            -- PK, generated
    uuid      club_id       -- FK to club.id, not null
    -- embedded Contact (012): first_name, last_name, email, phone
    string    role           -- free text, not null, e.g. "Chairman"
    boolean   is_primary     -- default false; at most one true per (club_id, active) — enforced
                              -- below, both in the service layer and at the DB level
    boolean   active         -- default true; "disable, never delete" (see Non-goals)
    string    photo_url      -- nullable; same posture as ClubProfile.logo_url/banner_url (012) —
                              -- populated by MediaUpload, no format validation
    timestamp created_at
    timestamp updated_at
    uuid      updated_by
}
```

**Primary-contact enforcement — auto-unset, not reject.** Setting `isPrimary: true` on one contact automatically unsets it on any other active contact for the same club, in the same transaction. A two-step "unset the old one first or get a `409`" flow would be needless friction for what's a single boolean toggle in the UI — this project's `ConflictException` pattern (`docs/standards/backend.md`) is reserved for cases where silently resolving the conflict would be surprising or lossy, which flipping a primary flag is not. Backed by a partial unique index (below) as a DB-level guarantee, not just a service-layer promise.

**Migration** (next sequential file after `012`'s `keycloak_provisioned_at` addition):

```sql
-- backend/src/main/resources/db/changelog/v1/013-add-club-contact.sql
CREATE TABLE club_contact (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID NOT NULL REFERENCES club(id),
    first_name  VARCHAR(255) NOT NULL,
    last_name   VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL,
    phone       VARCHAR(32) NOT NULL,
    role        VARCHAR(128) NOT NULL,
    is_primary  BOOLEAN NOT NULL DEFAULT false,
    active      BOOLEAN NOT NULL DEFAULT true,
    photo_url   VARCHAR(512),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID
);

CREATE INDEX ix_club_contact_club ON club_contact(club_id);

-- DB-level backstop for the service-layer auto-unset above — guarantees at most one active
-- primary per club even under a bug or race, without blocking a *deactivated* contact from
-- having stale is_primary=true sitting unused.
CREATE UNIQUE INDEX ux_club_contact_primary ON club_contact(club_id) WHERE is_primary AND active;
```

## API Contract

**Architecture note — one namespace, not two.** `012`'s `ClubProfile` kept parallel `/api/v1/platform/**` and `/api/v1/manage/**` mappings (`020`) because a `platform_admin`-only `/platform` implementation already shipped before `/manage` existed — `020` had to stay backward-compatible with it. Club Contacts has no such legacy surface to preserve: `AccessService.canAdministerClub` already treats `platform_admin` as a superset/override on `/api/v1/manage/**` endpoints (confirmed end-to-end during `020`'s own manual verification — a `platform_admin` JWT passes `canAdministerClub` for any `clubId`). So this spec builds exactly **one** set of endpoints, under `/api/v1/manage/**` only, reachable by both personas — no redundant `/platform/clubs/{id}/contacts` mirror to keep in sync.

**Architecture note — Media upload has the same gap, closed the same way.** `012`'s `MediaUpload`/`uploadMedia()` calls `POST /api/v1/platform/media` (`MediaController`), which is `platform_admin`-only at the URL gate — `012`'s own Javadoc claimed "any future consumer (Sponsors, Club Contacts) calls this same endpoint," but that was written before `020`'s `/manage` namespace existed, and a `CLUB_ADMIN` genuinely cannot reach `/api/v1/platform/**` at all. This spec adds a second, additive mapping on the same existing `MediaController`/`MediaService` — `POST /api/v1/manage/media` — rather than reclassifying the platform one. No `@PreAuthorize` on it: uploading a file isn't club-scoped data in itself (nothing is persisted against a club until the resulting URL is saved onto an authorized `ClubContact` record via the endpoints below), so `authenticated()` at the URL level is sufficient, matching `010`'s original platform `GET`-relies-on-URL-gate-only precedent.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/contacts` | `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")` | Lists all contacts for the club (active and inactive — inactive ones render with a muted badge, same posture as `Product`'s `RETIRED` staying visible in its list) |
| `POST /api/v1/manage/clubs/{clubId}/contacts` | same | Creates a contact. `{firstName, lastName, email, phone, role, isPrimary, photoUrl?}`. `400` (`ValidationException`) on a malformed email or a blank required field, matching `ContactDto`'s existing `@NotBlank`/`@Email` annotations |
| `PUT /api/v1/manage/clubs/{clubId}/contacts/{contactId}` | same | Full-resource update, same fields as create. Setting `isPrimary: true` auto-unsets any other active primary for this club in the same transaction |
| `POST /api/v1/manage/clubs/{clubId}/contacts/{contactId}/deactivate` | same | `active: true → false`. `409` (`InvalidStatusTransitionException`) if already inactive, matching `Club`'s existing suspend/reactivate error shape (`010`) |
| `POST /api/v1/manage/clubs/{clubId}/contacts/{contactId}/reactivate` | same | `active: false → true`. `409` if already active |
| `POST /api/v1/manage/media` | `authenticated()` only, no `@PreAuthorize` | Generic image upload for a `/manage` caller — same `MediaService` as `012`'s platform-facing endpoint, returns `{url}`. First real consumer: this spec's contact photo field |

All five `contacts` endpoints carry the real method-level `@PreAuthorize` — `/api/v1/manage/**` is only `authenticated()` at the URL level (`020`), so every endpoint here does its own scoping, no exceptions. `POST /api/v1/manage/media` is the one deliberate exception, per the Media architecture note above.

## UI Requirements

Composes entirely from existing shared components — `ListToolbar`, `RecordCard`, `RecordFormScreen`, `MediaUpload` (`008`/`010`/`012`'s established anatomy) — plus one new form component:

- **`ui/src/components/MediaUpload/MediaUpload.tsx`** (existing, `012`) — gains an optional `namespace?: 'platform' | 'manage'` prop, default `'platform'` so every existing `ClubForm` logo/banner call site is unaffected. Internally selects `uploadMedia` (`/platform/media`) or a new `uploadManagedMedia` (`ui/src/api/mediaApi.ts`, hitting `/manage/media`) based on it. This is a near-miss prop extension (per `docs/standards/frontend.md`'s reuse rule), not a new component — same pattern `ClubForm`'s `mode` prop already established in `020`.
- **`ui/src/pages/manage/ClubContactList.tsx`** (new) — reads `clubId` from `ManagerHome`'s `Outlet` context (`020`), same precedent `ManageClubProfilePage.tsx` already set. `ListToolbar` (search by name, sort by name/role), a grid of `RecordCard`s — `title` = full name, `badge` = "Primary" (positive tone) or nothing, a muted "Inactive" badge variant for a deactivated contact (mirroring `RecordCard`'s existing `'muted'` tone already used for `Product`'s `RETIRED`), `fields` = Role/Email/Phone, `secondaryAction` = Deactivate/Reactivate depending on current state (mirroring `010`'s `ClubFormPage.tsx` confirm-then-transition UX, adapted to a card-level action the way `019`'s `RecordCardSecondaryAction` shape already supports). No photo shown here — see Non-goals.
- **`ui/src/components/ClubContactForm/`** (new, four-file anatomy per `docs/standards/frontend.md`) — First Name, Last Name, Email, Phone, Role, an "Is primary contact" checkbox, and a Photo field (`<MediaUpload label="Photo" namespace="manage" variant="logo" .../>` — reusing the existing square `'logo'` preview dimensions, no new `MediaUploadVariant`). Plain fields, no tabs (unlike `ClubForm` — this is a single flat record, no profile/basic-info split).
- **`ui/src/pages/manage/ClubContactFormPage.tsx`** (new) — `RecordFormScreen` wrapping `ClubContactForm`, same create/edit-via-`:id?`-param shape `010`'s `ClubFormPage.tsx` already establishes, but scoped under `/manage` and resolving `clubId` from `Outlet` context rather than a route param.
- **`ui/src/pages/manage/ManagerDashboard.tsx`** — add a "Club Contacts" card to the existing `'Club manager'` group, routing to `/manage/club-contacts`.
- **`ui/src/App.tsx`** — new routes under the existing `/manage` block: `club-contacts` (list), `club-contacts/new`, `club-contacts/:id/edit`.
- **`ui/src/api/clubContactApi.ts`** (new) — one file per backend resource per `docs/standards/frontend.md`, thin wrappers over the five endpoints above.

**Mobile-first**, same responsive rules `008`'s `ProductList`/`010`'s `ClubList` already established for this exact list/CRUD anatomy — no new pattern to design.

**Claude Design pass precedes implementation** for the one genuinely new component, `ClubContactForm` (per `docs/workflow.md` Step 2) — `ClubContactList`/`ClubContactFormPage` compose entirely from existing, already-styled shared components and don't need a fresh design pass.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `ClubContactServiceImplTest` — create/update validation, setting `isPrimary` auto-unsets a previous active primary for the same club (and does *not* touch an inactive contact's stale flag), deactivate/reactivate transitions and their invalid-transition `409`s |
| Integration | `ClubContactRepositoryTest` (Testcontainers) — migration applies cleanly, the partial unique index actually rejects two simultaneous active primaries at the DB level (bypassing the service layer) proving the backstop is real, not just documented; `ClubContactControllerIntegrationTest` — following `020`'s own new pattern (`withSubject`, a real `Person`+`RoleAssignment` row): a real `CLUB_ADMIN` can reach all five endpoints for their own club and gets `403` for a different club or no grant; a `platform_admin` JWT also succeeds (proving the superset claim in the Architecture note above), and a bare authenticated caller with neither grant gets `403`; `MediaController` integration coverage — `POST /api/v1/manage/media` succeeds for any authenticated caller (no `RoleAssignment` needed), `POST /api/v1/platform/media` still rejects a non-`platform_admin` caller unchanged (regression) |
| Contract | New endpoints (including `POST /api/v1/manage/media`) + `ClubContactDto` documented in the checked-in OpenAPI schema |
| Component | `ClubContactForm.test.tsx` + Storybook story — required-field validation, primary checkbox toggling, photo upload wiring (`MediaUpload namespace="manage"` calls the manage-namespace upload path); `ClubContactList.test.tsx` — renders cards with the right badges, deactivate/reactivate wiring; `MediaUpload.test.tsx` extended for the new `namespace` prop, all pre-existing (`platform`-default) cases unmodified |
| E2E | Extends `020`'s own `manager-club-profile.spec.ts` prerequisite (the same manually-provisioned `E2E_CLUB_ADMIN_*` test account) with a new golden path: log in as that club admin, open Club Contacts, add a contact (including a photo upload), flag it primary, edit it, deactivate it, reactivate it, confirm each state persists across a reload. Not wired into CI, same precedent as every prior spec's e2e coverage |

## Acceptance Criteria

- A club admin can list, create, edit, deactivate, and reactivate contacts for their own club through `/manage/club-contacts`, with no platform-admin access required.
- Flagging a contact as primary automatically un-flags whichever contact previously held that status for the same club — verifiable both through the UI and by the DB-level partial unique index actually rejecting a manual attempt to set two.
- A club admin for club X gets `403` attempting any of the five endpoints against club Y's id.
- A `platform_admin` JWT can reach the same five endpoints (superset access), without any dedicated `/admin` screen existing for it in this pass.
- No endpoint or UI action permanently deletes a `ClubContact` row — only `active` toggles.
- `ContactDto`'s existing `@NotBlank`/`@Email` validation is what rejects a malformed create/update, not a second, redefined validation set.
- A club admin can upload and attach a photo to a contact via the same `MediaUpload` mechanism platform admins already use for club branding (`012`), reaching it through the new `POST /api/v1/manage/media` endpoint rather than the platform-admin-only one.

## Rollout Notes

- Ships as its own PR, on top of `020`'s already-built `/api/v1/manage/**` namespace and `ManagerHome`'s `Outlet` context — no changes to either required.
- **Resolves `012`'s "Club Contacts" deferral** and the matching `docs/roadmap.md` entry under `003-club-onboarding.md`'s section — a human should mark that roadmap entry resolved and add a pointer to this spec once it ships, per `docs/roadmap.md`'s own living-index convention.
- **The single-namespace API decision (no `/platform` mirror) is a deliberate departure from `012`/`020`'s dual-namespace precedent for `ClubProfile`**, not an inconsistency — see the Architecture note in API Contract for the full reasoning. Any future spec adding a *new* club-scoped resource (not amending an existing `/platform`-only one) should default to this single-namespace shape too, unless it specifically needs to preserve an existing `/platform` surface the way `020` did.
- **Sponsors is next.** Per `docs/roadmap.md`, it's named alongside Club Contacts and will very likely reuse this spec's list/CRUD shape (`ListToolbar`/`RecordCard`/`RecordFormScreen`, single `/manage`-only namespace, `active`-flag-not-hard-delete posture) and its new `POST /api/v1/manage/media` mapping for icon/banner uploads — not scoped or designed here beyond that reuse intent.
- **`012`'s claim that `POST /api/v1/platform/media` would be reused "unchanged" by Sponsors/Club Contacts was incomplete** — it predates `020`'s `/manage` namespace and wasn't actually reachable by a club admin. This spec's `POST /api/v1/manage/media` addition is the real, working answer; any future `/manage`-side consumer (Sponsors included) should use that mapping, not the platform one.
- **No `/admin`-facing screen is a deliberate, revisitable choice, not a permanent one.** If a real platform-admin workflow needs cross-club contact visibility later, it calls the same `/api/v1/manage/**` endpoints this spec already exposes to `platform_admin` — no backend change would be needed, only a new `/admin`-side page.
