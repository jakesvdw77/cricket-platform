# 024 — Sponsor Contacts

**Depends on:** `021-club-contacts.md` (`ClubContact`/`ClubContactController`/`ClubContactServiceImpl` — the exact entity/API/service shape this spec mirrors structurally, field for field, including the `saveAndFlush` primary-auto-unset fix that spec needed after the fact), `023-sponsors.md` (the `Sponsor` entity these contacts belong to, and `SponsorFormPage` — this spec adds the "Manage Contacts" link that spec deliberately left out), `020-club-manager-access.md` (the `/api/v1/manage/**` namespace, `AccessService.canAdministerClub`, `ManagerHome`'s `Outlet` context).
**Status:** approved.

## Problem & Goals

`023` shipped `Sponsor` without any way to name a specific person to contact there — deliberately deferred to this spec, the third and last of the mini-epic `022` started. This spec gives each sponsor its own list of named contacts, structurally identical to `021`'s `ClubContact` — same fields, same auto-unset-primary behaviour, same list/CRUD shape — just scoped to a `sponsor_id` instead of a `club_id`.

**Goals**
- A club admin can list, add, edit, deactivate, and reactivate named contacts for a specific sponsor.
- The data model, service logic, and API shape are a deliberate, field-for-field mirror of `021`'s `ClubContact` — including applying the `saveAndFlush` fix `ClubContactServiceImpl.create()` needed after `021` shipped, from the start this time, not rediscovered as a bug.
- `SponsorFormPage` (`023`) gains the "Manage Contacts →" link that spec left out because this page didn't exist yet.

## Non-goals

- **Anything not already a `021` non-goal for `ClubContact`.** Same list applies here unchanged: no hard delete, no `/platform` mirror, no address/social-media fields on a contact, no role validated against a fixed list, no photo-in-list-card display (mirrors `021`'s own `RecordCard`-has-no-avatar-slot reasoning).
- **A photo field on a sponsor contact.** `021`'s Club Contacts gained one (per a mid-implementation request); this spec deliberately does *not* replicate that here unless asked — sponsor contacts are a smaller, more transactional relationship than a club's own named contacts, and adding it back in without being asked would be scope creep. Flagged explicitly so it reads as a deliberate omission, not an oversight.

## User Stories

- As a club admin, from a sponsor's edit screen I can open "Manage Contacts" to see everyone associated with that sponsor.
- As a club admin, I can add a new contact for a sponsor with a name, email, phone, and role.
- As a club admin, I can flag a different contact as primary — automatically un-flagging whoever held it before, for that sponsor specifically (a club contact's primary flag and a sponsor contact's primary flag are entirely independent).
- As a club admin, I can deactivate a sponsor contact who's no longer involved, without losing their record, and reactivate one if that turns out to be premature.
- As a club admin for club X, I cannot see or edit a sponsor contact belonging to club Y's sponsor, even by guessing an id — enforced server-side, two levels deep (the sponsor must belong to the club, and the contact must belong to the sponsor).

## Data Model Changes

**New entity — `SponsorContact`**, many-to-one with `Sponsor` — a structural mirror of `021`'s `ClubContact`, FK'd to `sponsor_id` instead of `club_id`:

```
SponsorContact {
    uuid      id
    uuid      sponsor_id     -- FK to sponsor.id, not null
    -- embedded Contact (012/021): first_name, last_name, email, phone
    string    role
    boolean   is_primary     -- at most one true per (sponsor_id, active) — same auto-unset +
                              -- partial-unique-index pattern as ClubContact
    boolean   active
    timestamp created_at
    timestamp updated_at
    uuid      updated_by
}
```

**Apply `021`'s `saveAndFlush` fix from day one.** `ClubContactServiceImpl.create()` originally threw a `409` instead of silently auto-unsetting a previous primary, because Hibernate's default flush ordering applies all pending `INSERT`s before all pending `UPDATE`s in a transaction regardless of registration order — the new primary row's insert landed before the old row's unset was flushed, tripping the partial unique index. `SponsorContactServiceImpl`'s `unsetOtherActivePrimaries` must call `saveAndFlush` (not `save`) on the unset from the start — see `ClubContactServiceImpl`'s Javadoc for the full mechanism. This is a known, understood correctness requirement now, not something to rediscover the hard way a second time.

**Migration** (next sequential file after `023`'s `015-add-sponsor.sql`):

```sql
-- backend/src/main/resources/db/changelog/v1/016-add-sponsor-contact.sql
CREATE TABLE sponsor_contact (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id  UUID NOT NULL REFERENCES sponsor(id),
    first_name  VARCHAR(255) NOT NULL,
    last_name   VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL,
    phone       VARCHAR(32) NOT NULL,
    role        VARCHAR(128) NOT NULL,
    is_primary  BOOLEAN NOT NULL DEFAULT false,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID
);

CREATE INDEX ix_sponsor_contact_sponsor ON sponsor_contact(sponsor_id);

CREATE UNIQUE INDEX ux_sponsor_contact_primary ON sponsor_contact(sponsor_id) WHERE is_primary AND active;
```

## API Contract

**Architecture note — one namespace, matching `021`/`023`.** Same reasoning: `platform_admin` reaches these via `canAdministerClub`'s existing superset behaviour, no `/platform` mirror.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts` | `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")` | Lists a sponsor's contacts. `404` if `sponsorId` doesn't exist or doesn't belong to `clubId` |
| `POST /api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts` | same | Creates a contact for that sponsor. `{firstName, lastName, email, phone, role, isPrimary}` |
| `PUT /api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}` | same | Full-resource update. Setting `isPrimary: true` auto-unsets any other active primary for this sponsor (`saveAndFlush`, see Data Model Changes) |
| `POST .../contacts/{contactId}/deactivate` | same | `409` (`InvalidStatusTransitionException`) if already inactive |
| `POST .../contacts/{contactId}/reactivate` | same | `409` if already active |

Two-level cross-tenant isolation: a `sponsorId` real but belonging to a different club 404s (`findOrThrowSponsorForClub`), and a `contactId` real but belonging to a different sponsor 404s (`findOrThrowContactForSponsor`) — the same `findOrThrowForClub` pattern `ClubContactServiceImpl` established, applied one level deeper.

## UI Requirements

- **`ui/src/components/SponsorContactForm/`** (new, four-file anatomy) — reuses `021`'s `ClubContactForm`'s *pattern* (flat fields: First Name, Last Name, Email, Phone, Role, "Is primary contact" checkbox), not the component itself — different payload shape (scoped to a sponsor, not a club), so it's a genuine near-copy rather than an import. No photo field (see Non-goals).
- **`ui/src/pages/manage/SponsorContactList.tsx`** / **`SponsorContactFormPage.tsx`** (new) — near-identical to `021`'s `ClubContactList.tsx`/`ClubContactFormPage.tsx`: reads `sponsorId` from the route (`useParams`), `clubId` from `Outlet` context (still needed for the API's `clubId`-scoped URL and `@PreAuthorize`). The back link goes to `/manage/sponsors/{sponsorId}/edit`, not the dashboard — a sponsor contact's natural "back" is its owning sponsor, not the top-level dashboard.
- **`ui/src/pages/manage/SponsorFormPage.tsx`** (`023`, amended) — edit mode gains a "Manage Contacts →" link to `/manage/sponsors/{id}/contacts`, visible only for an existing sponsor (a brand-new, unsaved sponsor has no id to attach contacts to yet) — the link `023` deliberately left out because this page didn't exist until now.
- **`ui/src/App.tsx`** — new routes: `sponsors/:sponsorId/contacts` (list), `sponsors/:sponsorId/contacts/new`, `sponsors/:sponsorId/contacts/:contactId/edit`.
- **`ui/src/api/sponsorContactApi.ts`** (new) — mirrors `clubContactApi.ts`'s shape, base path `/manage/clubs/${clubId}/sponsors/${sponsorId}/contacts`.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `SponsorContactServiceImplTest` — mirrors `021`'s `ClubContactServiceImplTest` exactly: create/update, primary auto-unset via `saveAndFlush` (verified via mock, same assertion shape as `021`'s corrected test), deactivate/reactivate transitions and `409`s, two-level cross-tenant `NotFoundException` isolation (wrong sponsor, and sponsor-belongs-to-wrong-club) |
| Integration | `SponsorContactRepositoryTest` — migration applies cleanly, the partial unique index rejects two simultaneous active primaries at the DB level, proven from the first version of this test (not added after finding a bug, per `021`'s own experience); `SponsorContactControllerIntegrationTest` — real `CLUB_ADMIN` success, cross-club/cross-sponsor `403`/`404`, `platform_admin` superset success, and — critically — the create-a-second-primary-succeeds-through-the-HTTP-layer case passing on the first try (the exact scenario that was broken in `021` until fixed) |
| Contract | New endpoints + `SponsorContactDto` documented in the checked-in OpenAPI schema |
| Component | `SponsorContactForm.test.tsx` + Storybook story — required-field validation, primary checkbox toggling; `SponsorContactList.test.tsx`/`SponsorContactFormPage.test.tsx` — mirror `021`'s equivalents; `SponsorFormPage.test.tsx` extended for the new "Manage Contacts" link (present only in edit mode) |
| E2E | Extends `020`/`021`/`023`'s `smoketest-club-admin` prerequisite: from an existing sponsor, open Manage Contacts, add a contact, flag it primary, add a second contact and flag *it* primary (confirming the first's flag clears with no error), deactivate one, reactivate it |

## Acceptance Criteria

- A club admin can list, create, edit, deactivate, and reactivate contacts for a specific sponsor through `/manage/sponsors/{id}/contacts`.
- Flagging a sponsor contact as primary automatically un-flags whichever contact previously held that status for the *same sponsor* — verified through the real HTTP layer, with no `409`, from the first version shipped.
- A club admin for club X gets `403`/`404` attempting to reach a sponsor contact via a `sponsorId` that isn't theirs, or a `contactId` that doesn't belong to the given `sponsorId`.
- `SponsorFormPage`'s edit mode shows a working "Manage Contacts" link; create mode does not.
- No endpoint or UI action permanently deletes a `SponsorContact` row — only `active` toggles.

## Rollout Notes

- Ships as its own PR, on top of `020`/`021`/`023`'s already-built namespace, `Outlet` context, and `SponsorFormPage` — the only change to already-shipped code is adding the "Manage Contacts" link there.
- **Last of the three-spec mini-epic** started by `022` (see that spec's Rollout Notes for the full split rationale). Together, `022`/`023`/`024` fully resolve the `docs/roadmap.md` "Sponsors" entry named since `012`, and close out everything currently named under the club-manager-self-service push that started with `020`.
- **Full role/permission management** (inviting additional per-club users, a grant/revoke UI) remains deliberately deferred, per `020`'s own Non-goals, restated at every spec since — still no second real persona to design against.
