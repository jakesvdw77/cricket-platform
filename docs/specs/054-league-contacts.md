# 054 — League Contacts

**Depends on:** `029-league-management.md` (the `League` entity this spec adds contacts to, `LeagueFormPage`'s Details/Teams/Schedule/Playing Conditions tab convention and `LeagueDetailPage`'s matching Details/Playing Conditions/Teams/Fixtures section convention — both extended here, not re-derived — and the `/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/**` namespace `LeagueAffiliation`/`Match` already nest under), `024-sponsor-contacts.md` (the entity/API/service/component shape this spec structurally clones field-for-field, retargeted at `League` instead of `Sponsor` — see Data Model Changes and API Contract for exactly what's reused unchanged vs. what diverges).
**Status:** approved.

## Problem & Goals

`029` shipped `League` with no way to name a specific person to contact for it — no league administrator, no umpire coordinator, nothing beyond the club admin who happens to be logged in. `024` solved this identical problem for `Sponsor` by giving it its own list of named contacts (`SponsorContact`): first name, last name, email, phone, a role label, and one flaggable primary contact. This spec gives `League` the same capability, structurally identical to `SponsorContact` — same entity shape, same auto-unset-primary behaviour, same disable-never-delete posture — just scoped to a `league_id` instead of a `sponsor_id`.

**Goals**
- A club admin can list, add, edit, deactivate, and reactivate named contacts for a specific league, from that league's own edit screen and read-only detail screen.
- The data model, service logic, and API shape are a deliberate, field-for-field mirror of `024`'s `SponsorContact` — including its `saveAndFlush` primary-auto-unset fix from day one (see Data Model Changes), not rediscovered as a bug the way `021`'s original version was.
- Unlike `024` (a separate `SponsorContactList` page reached via a "Manage Contacts →" link off `SponsorFormPage`), League Contacts surface as a **tab** on `LeagueFormPage` and a **section** on `LeagueDetailPage`, positioned last, after the tabs/sections `029`/`050`/`052` already established — matching how this feature was explicitly asked for, and consistent with `LeagueFormPage`'s own existing multi-tab shape rather than introducing a second, competing navigation pattern for the same page.

## Non-goals

- **Season-scoping.** A league contact belongs to the `League` itself, not to any one `Season` — explicit, deliberate scope for this pass. A per-season contact (e.g. "who's the umpire coordinator for the 2026 season specifically") is real, plausible future scope if a real need for it shows up, not built here — flagged explicitly so it reads as deliberate, not forgotten.
- **A `photoUrl` field.** `024` deliberately excluded this from `SponsorContact` (unlike `ClubContact`, which has one) on the reasoning that a sponsor contact is a smaller, more transactional relationship than a club's own named contacts. A league contact (league administrator, umpire coordinator) is the same kind of relationship — transactional, role-driven, not identity-bearing the way a club's own public-facing contact might be — so this spec follows `SponsorContact`'s lighter shape for the same reason, not `ClubContact`'s heavier one. Not requested this session either way; default to consistency with the closer precedent.
- **A separate, top-level `LeagueContactList` `/manage` route reached via a link off another page.** `024`'s own UI shape (a dedicated list page, linked from `SponsorFormPage`) is deliberately **not** replicated here — see Problem & Goals' third goal and UI Requirements. The list itself renders inline as `LeagueFormPage`'s Contacts tab / `LeagueDetailPage`'s Contacts section, matching those two pages' own already-established tab/section convention (`Teams`, `Fixtures`, `Playing Conditions`) rather than adding a second, inconsistent navigation pattern to the same host pages.
- **Linking an existing `ClubContact` as a league contact.** `026`/`027`'s `TeamContact` is a join entity linking a `Team` to an already-existing `ClubContact` record; this spec does not build that pattern here. A league contact is a genuinely new, standalone record scoped to the league, cloned from `SponsorContact`'s own "new record, not a link" shape — not a second contact-reuse mechanism.
- **Everything already a `024` Non-goal for `SponsorContact`, unchanged**: no hard delete (disable, never delete only), no `/platform` mirror (`AccessService.canAdministerClub` already gives `platform_admin` a superset pass on `/manage/**`), no role validated against a fixed list, no photo-in-list-card display.
- **Bulk import of contacts** (CSV or similar) — one at a time through the form, matching every other entity's identical cut in this codebase (`028`'s players, `029`'s seasons/fixtures/squads).
- **Any `RoleAssignment` scope wiring, or a genuine second admin persona for a league contact to log in as.** A league contact is a plain named-person record, not an account — same posture as `SponsorContact`/`ClubContact`.

## User Stories

- As a club admin, from a league's edit screen I can open the Contacts tab to see everyone associated with that league.
- As a club admin, I can add a new contact for a league with a first name, last name, email, phone, and role (e.g. "League Administrator", "Umpire Coordinator").
- As a club admin, I can flag a different contact as primary — automatically un-flagging whoever held it before, for that league specifically (a league contact's primary flag is entirely independent of any sponsor's or club's own primary flag).
- As a club admin, I can deactivate a league contact who's no longer involved, without losing their record, and reactivate one if that turns out to be premature.
- As a club admin, from a league's read-only detail screen I can see its Contacts section without needing to enter edit mode.
- As a club admin for club X, I cannot see or edit a league contact belonging to club Y's league, even by guessing an id — enforced server-side, two levels deep (the league must belong to the club, and the contact must belong to the league).

## Data Model Changes

**New entity — `LeagueContact`**, many-to-one with `League` (`029`) — a structural mirror of `024`'s `SponsorContact`, FK'd to `league_id` instead of `sponsor_id`:

```
LeagueContact {
    uuid      id
    uuid      league_id     -- FK to league.id, not null
    -- embedded Contact (012/024): first_name, last_name, email, phone
    string    role
    boolean   is_primary    -- at most one true per (league_id, active) — same auto-unset +
                              -- partial-unique-index pattern as SponsorContact/ClubContact
    boolean   active
    timestamp created_at
    timestamp updated_at
    uuid      updated_by
}
```

Reuses `Contact` (`backend/src/main/java/com/cricketlegend/domain/Contact.java`) via `@Embedded`, exactly as `SponsorContact`/`ClubContact` already do — no new embeddable.

**Apply `021`/`024`'s `saveAndFlush` fix from day one**, same as `024` did for `SponsorContact`: Hibernate's default flush ordering applies all pending `INSERT`s before all pending `UPDATE`s in a transaction regardless of registration order, so a naive `save()` on the unset-previous-primary step would trip `ux_league_contact_primary` when a new primary's insert lands before the old row's unset is flushed. `LeagueContactServiceImpl.unsetOtherActivePrimaries` must call `saveAndFlush` (not `save`), not rediscovered as a bug — see `SponsorContactServiceImpl.unsetOtherActivePrimaries`'s Javadoc for the full mechanism.

**Migration** (numbered `030`, after sibling spec `053`'s `029-add-league-profile.sql` — these three specs, `053`/`054`/`055`, were drafted in parallel and all independently claimed the next number after `028`; `053` was assigned `029`, this spec `030`, and `055` `031`. Confirm the real next number against `db.changelog-master.xml` at build time in case the actual build order differs):

```sql
-- backend/src/main/resources/db/changelog/v1/030-add-league-contact.sql
CREATE TABLE league_contact (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id   UUID NOT NULL REFERENCES league(id),
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

CREATE INDEX ix_league_contact_league ON league_contact(league_id);

CREATE UNIQUE INDEX ux_league_contact_primary ON league_contact(league_id) WHERE is_primary AND active;
```

## API Contract

**Architecture note — one namespace, matching `024`/`029`.** Same reasoning: `platform_admin` reaches these via `canAdministerClub`'s existing superset behaviour, no `/platform` mirror. Nested under `029`'s existing `leagueId` path segment, the same way `LeagueAffiliation`/`Match` already nest under `clubId`.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts` | `@access.canAdministerClub` | Lists a league's contacts (active and inactive, not paginated — a deliberately small bounded collection, mirroring `SponsorContactService.list`). `404` if `leagueId` doesn't exist or doesn't belong to `clubId` |
| `POST /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts` | same | Creates a contact for that league. `{contact: {firstName, lastName, email, phone}, role, isPrimary}` |
| `PUT /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/contacts/{contactId}` | same | Full-resource update. Setting `isPrimary: true` auto-unsets any other active primary for this league (`saveAndFlush`, see Data Model Changes) |
| `POST .../contacts/{contactId}/deactivate` | same | `409` (`InvalidStatusTransitionException`) if already inactive |
| `POST .../contacts/{contactId}/reactivate` | same | `409` if already active |

Two-level cross-tenant isolation: a `leagueId` real but belonging to a different club 404s (`findOrThrowLeagueForClub`, mirroring `SponsorContactServiceImpl.findOrThrowSponsorForClub`), and a `contactId` real but belonging to a different league 404s (`findOrThrowContactForLeague`, mirroring `findOrThrowContactForSponsor`) — the identical two-level pattern `024` established, applied to `League` instead of `Sponsor`.

`LeagueContactDto`/`CreateLeagueContactRequest`/`UpdateLeagueContactRequest` mirror `SponsorContactDto`/`CreateSponsorContactRequest`/`UpdateSponsorContactRequest` field-for-field (nested `ContactDto` for name/email/phone, `role` `@NotBlank`, `isPrimary` a plain `boolean`), with `sponsorId` replaced by `leagueId`. `LeagueContactMapper` carries the same `isPrimary`/`primary` MapStruct quirk documented on `SponsorContactMapper`'s Javadoc (Lombok's `isPrimary()` getter infers the JavaBean read property `primary`, not `isPrimary` — `toDto` needs `@Mapping(target = "isPrimary", source = "primary")`; `toEntity`'s ignore mapping targets the builder's literal `isPrimary(boolean)` instead).

## UI Requirements

- **`ui/src/components/LeagueContactForm/`** (new, four-file anatomy) — a near-copy of `SponsorContactForm`'s pattern (flat fields: First Name, Last Name, Email, Phone, Role, "Is primary contact" checkbox; same client-side validation mirroring `ContactDto`'s `@NotBlank`/`@Email` rules), not an import — different payload shape (scoped to a league, not a sponsor). No photo field (see Non-goals).
- **`ui/src/utils/leagueContact.ts`** (new) — exports `fullName(contact: LeagueContact)` and `badgeFor(contact: LeagueContact)` (Primary/Inactive badge logic, identical rules to `SponsorContactList.tsx`'s same-named exports). Needed as a standalone module rather than living on a list *page* export (`024`'s own `SponsorContactDetailPage` imports `badgeFor`/`fullName` from `SponsorContactList.tsx`) because League Contacts has no equivalent standalone list page to export them from (see the next bullet) — three different call sites (`LeagueFormPage`'s Contacts tab, `LeagueDetailPage`'s Contacts section, `LeagueContactDetailPage`) need the identical mapping, so it lives in one shared, page-independent place instead of being duplicated three times or picking one host page arbitrarily to own it.
- **`ui/src/pages/manage/LeagueContactFormPage.tsx`** (new) — near-identical to `SponsorContactFormPage.tsx`: reads `leagueId` from the route (`useParams`), `clubId` from `ManagerHome`'s `Outlet` context; the contact id is a route param for edit mode, same create/edit-via-`:contactId?` shape. No single-contact GET endpoint (mirrors `024`'s own cut) — edit mode fetches the full (small, unpaginated) list via `listLeagueContacts` and finds the matching row client-side. Deactivate/reactivate render on this screen's own actions bar (`038`'s established pattern, not a list-card footer action). Back link goes to `/manage/fixtures/leagues/{leagueId}/edit` (lands on `LeagueFormPage`'s Details tab — `LeagueFormPage`'s `activeTab` state isn't deep-linkable today, matching its own existing Teams/Schedule/Playing Conditions tabs' identical behaviour; not a gap this spec introduces).
- **`ui/src/pages/manage/LeagueContactDetailPage.tsx`** (new) — near-identical to `SponsorContactDetailPage.tsx` (`036`'s view-first pattern): same list-plus-find-by-id data fetch, same `badgeFor`/`fullName` mapping (imported from `ui/src/utils/leagueContact.ts` above, not duplicated), one un-headed `DetailFieldGrid` section (Role, Email, Phone, Primary contact). Back link goes to `/manage/fixtures/leagues/{leagueId}` (`LeagueDetailPage`).
- **`ui/src/pages/manage/LeagueFormPage.tsx`** (`029`/`050`/`052`, amended) — gains a fifth tab, **Contacts**, positioned last after Details/Teams/Schedule/Playing Conditions, edit mode only (mirrors every prior tab's own edit-mode-only precedent). Renders `listLeagueContacts(clubId, leagueId)` as a `RecordCard` grid (avatar `circular`/initials, `badgeFor` badge, `fields` = Role/Email/Phone, `viewTo`/`editTo` into the two new pages above) plus an "Add Contact" `Button` navigating to `/manage/fixtures/leagues/{leagueId}/contacts/new` — the same inline-grid-plus-navigate-out shape the existing Teams tab already uses for `AffiliatedTeamCard`, not a `ListToolbar`-fronted list screen (see Non-goals — this tab is a sub-section of an already-titled page, not a standalone `/manage` list route, matching the Teams tab's own identical, already-approved precedent for not using `ListToolbar` here).
- **`ui/src/pages/manage/LeagueDetailPage.tsx`** (`029`/`050`/`052`, amended) — gains a fifth section, **Contacts**, positioned last after Details/Playing Conditions/Teams/Fixtures. Same `listLeagueContacts` query and `RecordCard` grid as the `LeagueFormPage` tab above, `viewTo`/`editTo` per card (matching the existing Teams section's identical read-only-but-actionable card shape), no inline "Add" action on this read-only page (mirrors how every other `RecordDetailScreen` section defers creation to the edit screen).
- **`ui/src/App.tsx`** — new routes: `fixtures/leagues/:leagueId/contacts/new`, `fixtures/leagues/:leagueId/contacts/:contactId`, `fixtures/leagues/:leagueId/contacts/:contactId/edit`. No `fixtures/leagues/:leagueId/contacts` list route — the list itself is embedded in `LeagueFormPage`/`LeagueDetailPage`, not a standalone page (see Non-goals).
- **`ui/src/api/leagueContactApi.ts`** (new) — mirrors `sponsorContactApi.ts`'s shape (`LeagueContact`/`LeagueContactPayload` types, `listLeagueContacts`/`createLeagueContact`/`updateLeagueContact`/`deactivateLeagueContact`/`reactivateLeagueContact`), base path `/manage/clubs/${clubId}/leagues/${leagueId}/contacts`.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `LeagueContactServiceImplTest` — mirrors `SponsorContactServiceImplTest` exactly: create/update, primary auto-unset via `saveAndFlush` (verified via mock, same assertion shape), deactivate/reactivate transitions and their `409`s, two-level cross-tenant `NotFoundException` isolation (wrong league, and league-belongs-to-wrong-club) |
| Integration | `LeagueContactRepositoryTest` — migration applies cleanly, the partial unique index (`ux_league_contact_primary`) rejects two simultaneous active primaries at the DB level, proven from the first version of this test; `LeagueContactControllerIntegrationTest` — real `CLUB_ADMIN` success, cross-club/cross-league `403`/`404`, `platform_admin` superset success, and the create-a-second-primary-succeeds-through-the-HTTP-layer case passing on the first try |
| Contract | New endpoints + `LeagueContactDto` (and `Create`/`Update` request shapes) documented in the checked-in OpenAPI schema |
| Component | `LeagueContactForm.test.tsx` + Storybook story — required-field validation, primary checkbox toggling; `LeagueContactFormPage.test.tsx`/`LeagueContactDetailPage.test.tsx` — mirror `SponsorContactFormPage.test.tsx`/`SponsorContactDetailPage.test.tsx`'s equivalents; `LeagueFormPage.test.tsx` extended — the new Contacts tab renders only in edit mode, positioned last, "Add Contact" navigates to the right route; `LeagueDetailPage.test.tsx` extended — the new Contacts section renders last, cards carry working `viewTo`/`editTo` |
| End-to-end | Extends `029`'s golden path: from an existing league's edit screen, open the Contacts tab, add a contact, flag it primary, add a second contact and flag *it* primary (confirming the first's flag clears with no error), deactivate one, reactivate it, then confirm the same contact list renders correctly on the league's read-only detail screen's Contacts section. Not wired into CI, same precedent as every prior `/manage` spec |

## Acceptance Criteria

- A club admin can list, create, edit, deactivate, and reactivate contacts for a specific league through `LeagueFormPage`'s Contacts tab.
- A club admin can view a league's contacts read-only through `LeagueDetailPage`'s Contacts section, without entering edit mode.
- Flagging a league contact as primary automatically un-flags whichever contact previously held that status for the *same league* — verified through the real HTTP layer, with no `409`, from the first version shipped.
- A club admin for club X gets `403`/`404` attempting to reach a league contact via a `leagueId` that isn't theirs, or a `contactId` that doesn't belong to the given `leagueId`.
- The Contacts tab (`LeagueFormPage`) and Contacts section (`LeagueDetailPage`) both render last, after every other existing tab/section.
- No endpoint or UI action permanently deletes a `LeagueContact` row — only `active` toggles.

## Rollout Notes

- Ships as its own PR, on top of `029`'s already-built `League`/`LeagueFormPage`/`LeagueDetailPage` and `020`'s already-built `/api/v1/manage/**` namespace — the only changes to already-shipped code are the new tab/section on those two pages.
- **Backend/component-file shape clones `024`'s `SponsorContact` stack directly** (entity, DTOs, mapper, service, controller, repository, `LeagueContactForm`) — cite `024` rather than re-deriving any of that reasoning; this spec's own text only calls out where `League` genuinely diverges (tab/section UI placement, no separate list page/route, no season-scoping).
- **UI/routing shape deliberately diverges from `024`.** `SponsorContactList`/its "Manage Contacts →" link pattern is not replicated — League Contacts surface as a tab/section on pages that already have an established multi-tab/multi-section convention (`029`/`050`/`052`), so adding a second, separate list page would read as inconsistent with `LeagueFormPage`/`LeagueDetailPage`'s own existing shape, not more consistent with `024`. Flagged explicitly per this spec's own instructions rather than silently building around it.
- **Season-scoping stays deferred, matching `029`'s own precedent of resolving player-eligibility/squad concerns per-season while leaving other league-level metadata standing** (e.g. `League.minAge`/`maxAge` themselves are not season-scoped either). If a real need for a per-season contact shows up, that's a future spec's amendment, not assumed here.
- Full role/permission management (inviting additional per-club users, a grant/revoke UI) remains deliberately deferred, per `020`'s own Non-goals, restated at every spec since — still no second real persona to design against.
