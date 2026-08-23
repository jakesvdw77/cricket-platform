# 023 — Sponsors

**Depends on:** `012-club-profile.md` (`ClubProfile`'s shape this entity mirrors — name/contact/branding), `020-club-manager-access.md` (the `/api/v1/manage/**` namespace, `AccessService.canAdministerClub`, `ManagerHome`'s `Outlet` context), `021-club-contacts.md` (the single-namespace API decision for a brand-new resource, and the `POST /api/v1/manage/media` endpoint this spec reuses unchanged for logo/banner uploads), `022-club-social-media.md` (the `SocialLink` `@Embeddable`/`@ElementCollection` pattern and the `SocialLinksFields` editor component this spec reuses directly, unmodified), `008-product-catalog.md`/`010-minimal-club-creation.md` (the `ListToolbar`/`RecordCard`/`RecordFormScreen` list/CRUD pattern).
**Status:** draft.

## Problem & Goals

`docs/roadmap.md` has named "Sponsors" (name, website, icon, banner, social links) as an unscoped future item since `012` first flagged it. This is the second of a three-spec mini-epic (see `022`'s Rollout Notes): it builds the `Sponsor` entity itself — a club's list of sponsors, each with contact info, branding, and social links. Naming a sponsor's own contact *people* (as opposed to the sponsor organisation's own email/phone) is deliberately deferred to the third spec, `024`, the same way `010` shipped a bare `Club` well before `021` gave it Contacts.

**Goals**
- A club admin can list, add, edit, deactivate, and reactivate their club's sponsors.
- Each sponsor records: name, website, email, phone, a logo, a banner, and social media links — reusing `022`'s `SocialLinksFields` component unmodified, and `021`'s `POST /api/v1/manage/media` for the logo/banner uploads.
- Ships on `020`'s `/api/v1/manage/**` namespace only, same reasoning `021` already established for Club Contacts — a brand-new resource needs no `/platform` mirror.
- A cancelled sponsor is deactivated, not deleted — same "disable, never delete" posture as `Club`/`Product`/`ClubContact`.

## Non-goals

- **Sponsor contact people.** A sponsor's own `email`/`phone` (this spec) is the sponsor organisation's general contact info — a specific named person to reach at that sponsor (with a role, a flagged primary, their own active/inactive lifecycle) is `024`'s job, structurally mirroring `021`'s `ClubContact`. This spec deliberately ships without it, the same way `Club` itself shipped (`010`) long before it got Contacts (`021`).
- **Any `/platform` mirror.** Same Architecture-note reasoning `021` already established — `platform_admin` reaches these endpoints via `canAdministerClub`'s existing superset behaviour, no separate `/platform/clubs/{id}/sponsors` surface needed.
- **Hard delete.** `active` toggles only, never a real delete — same posture as every other entity in this pattern.
- **Sponsor tiers, ranking/ordering, or payment/invoicing tracking.** Contact and branding info only this pass.
- **Any public-facing display of sponsor branding or social links** (e.g. on the club's public page). This spec is the `/manage`-side CRUD only; a public sponsors section is a separate future concern.
- **A new social-link editor.** `022`'s `SocialLinksFields` is reused exactly as built — this spec doesn't touch it beyond passing it a different `value`/`onChange` pair.

## User Stories

- As a club admin, I can see a list of my club's sponsors, each showing their name and active/inactive status.
- As a club admin, I can add a new sponsor with a name, website, email, phone, logo, banner, and social media links.
- As a club admin, I can edit an existing sponsor's details.
- As a club admin, I can deactivate a sponsor who cancelled, without losing their record, and reactivate one if that turns out to be premature.
- As a club admin for club X, I cannot see or edit club Y's sponsors, even by guessing an id — enforced server-side, matching `020`/`021`'s existing cross-club isolation.

## Data Model Changes

**New entity — `Sponsor`**, many-to-one with `Club` (plain `UUID` FK, no JPA relationship navigation — same convention as `ClubContact`/`ClubProfile`):

```
Sponsor {
    uuid      id             -- PK, generated
    uuid      club_id        -- FK to club.id, not null
    string    name            -- not null
    string    website
    string    email
    string    phone
    string    logo_url        -- nullable, same posture as ClubProfile.logo_url
    string    banner_url      -- nullable, same posture as ClubProfile.banner_url
    List<SocialLink> socialLinks   -- @ElementCollection (022), new sponsor_social_link table
    boolean   active          -- default true; "disable, never delete"
    timestamp created_at
    timestamp updated_at
    uuid      updated_by
}
```

`socialLinks` reuses `022`'s `SocialLink` `@Embeddable` unchanged (`platform` free text, `url`) — no new embeddable type, just a second `@ElementCollection` owner.

**Migration** (next sequential file after `022`'s `014-add-club-profile-social-links.sql`):

```sql
-- backend/src/main/resources/db/changelog/v1/015-add-sponsor.sql
CREATE TABLE sponsor (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID NOT NULL REFERENCES club(id),
    name        VARCHAR(255) NOT NULL,
    website     VARCHAR(512),
    email       VARCHAR(255),
    phone       VARCHAR(32),
    logo_url    VARCHAR(512),
    banner_url  VARCHAR(512),
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID
);

CREATE INDEX ix_sponsor_club ON sponsor(club_id);

CREATE TABLE sponsor_social_link (
    sponsor_id UUID NOT NULL REFERENCES sponsor(id),
    platform   VARCHAR(64) NOT NULL,
    url        VARCHAR(512) NOT NULL,
    PRIMARY KEY (sponsor_id, platform)
);
```

## API Contract

**Architecture note — one namespace, matching `021`.** `AccessService.canAdministerClub` already gives `platform_admin` superset access on `/api/v1/manage/**` — a brand-new resource needs no `/platform` mirror, same reasoning `021` already established for `ClubContact`.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/sponsors` | `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")` | Lists all sponsors for the club (active and inactive, not paginated — same "small bounded collection" reasoning as `021`'s Club Contacts) |
| `POST /api/v1/manage/clubs/{clubId}/sponsors` | same | Creates a sponsor. `{name, website, email, phone, logoUrl, bannerUrl, socialLinks}` |
| `PUT /api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}` | same | Full-resource update |
| `POST /api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/deactivate` | same | `active: true → false`. `409` (`InvalidStatusTransitionException`) if already inactive |
| `POST /api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/reactivate` | same | `active: false → true`. `409` if already active |

Every endpoint's `@PreAuthorize` is checked against `#clubId`; a `sponsorId` that's real but belongs to a different club 404s at the service layer (`findOrThrowForClub`, the same pattern `ClubContactServiceImpl` already established — not a new one).

**Logo/banner uploads reuse `021`'s `POST /api/v1/manage/media` unchanged** — no new media endpoint.

## UI Requirements

- **`ui/src/components/SponsorForm/`** (new, four-file anatomy) — mirrors `ClubForm`'s tabbed shape (given the field count) rather than `ClubContactForm`'s flat shape: **Basic Info** (name, website, email, phone), **Branding** (logo, banner via `MediaUpload namespace="manage"`), **Social Media** (one `022` `SocialLinksFields`, reused unmodified).
- **`ui/src/pages/manage/SponsorList.tsx`** (new) — mirrors `021`'s `ClubContactList.tsx` shape exactly: `Outlet`-context `clubId`, the "Back to Dashboard" link (`020`'s navigation fix), `ListToolbar` + `RecordCard` grid, Deactivate/Reactivate `secondaryAction`.
- **`ui/src/pages/manage/SponsorFormPage.tsx`** (new) — mirrors `ClubContactFormPage.tsx`'s create/edit shape, wrapping `SponsorForm`.
- **`ui/src/pages/manage/ManagerDashboard.tsx`** — add a "Club Sponsors" card to the `'Club manager'` group, next to the existing "Club Contacts" card, routing to `/manage/sponsors` — matching that card's and "Club Profile"'s naming convention rather than a bare "Sponsors".
- **`ui/src/App.tsx`** — new routes: `sponsors` (list), `sponsors/new`, `sponsors/:id/edit`.
- **`ui/src/api/sponsorApi.ts`** (new) — mirrors `clubContactApi.ts`'s shape, base path `/manage/clubs/${clubId}/sponsors`.

**Claude Design pass precedes implementation** for `SponsorForm` (per `docs/workflow.md` Step 2) — `SponsorList`/`SponsorFormPage` compose entirely from existing, already-styled shared components.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `SponsorServiceImplTest` — create/update validation, `socialLinks` round-tripping, deactivate/reactivate transitions and their `409`s, cross-club `NotFoundException` isolation — mirrors `021`'s `ClubContactServiceImplTest` shape |
| Integration | `SponsorRepositoryTest` (Testcontainers) — migration applies cleanly; `SponsorControllerIntegrationTest` — real `CLUB_ADMIN` success, cross-club `403`, `platform_admin` superset success, no-grant `403` — mirrors `021`'s `ClubContactControllerIntegrationTest` |
| Contract | New endpoints + `SponsorDto` documented in the checked-in OpenAPI schema |
| Component | `SponsorForm.test.tsx` + Storybook story — tab structure, required-field validation, logo/banner upload wiring via `namespace="manage"`, social links wiring via `022`'s `SocialLinksFields`; `SponsorList.test.tsx` — badges, deactivate/reactivate wiring |
| E2E | Extends `020`/`021`'s `smoketest-club-admin` prerequisite: add a sponsor with a logo and a social link, edit it, deactivate it, confirm the inactive state persists, reactivate it |

## Acceptance Criteria

- A club admin can list, create, edit, deactivate, and reactivate sponsors for their own club through `/manage/sponsors`.
- A sponsor's logo, banner, and social links all save and redisplay correctly, using the same components/endpoints already proven for Club Profile.
- A club admin for club X gets `403` attempting any sponsor endpoint against club Y's id.
- No endpoint or UI action permanently deletes a `Sponsor` row — only `active` toggles.

## Rollout Notes

- Ships as its own PR, on top of `020`/`021`/`022`'s already-built namespace, `Outlet` context, `/manage/media` endpoint, and `SocialLinksFields` component — no changes to any of those required.
- **Second of the three-spec mini-epic** started by `022` (see that spec's own Rollout Notes for the full split rationale). `024` — Sponsor Contacts — follows this one and adds a "Manage Contacts →" link to `SponsorFormPage`'s edit mode once that target page exists; this spec does **not** add that link itself, since it would point nowhere yet.
- **Resolves the `docs/roadmap.md` "Sponsors" entry** named since `012`, for the entity/branding/social-links half — `024` resolves the remaining "and their contacts" half.
