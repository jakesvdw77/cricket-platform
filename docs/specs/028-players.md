# 028 — Players

**Depends on:** `001-tenancy-identity-model.md` (`Person`, `ClubMembership` — this spec builds `ClubMembership` for the first time, exactly as `001` designed it, and grows `Person` with fields `001` always described but never built), `014-subscription-responsible-contact.md` (`Person.firstName`/`lastName`/`email`/`phone`, `PersonServiceImpl.findOrCreatePerson` — read but not reused as-is, see Data Model Changes), `015-person-status-and-role-assignment.md` (`PersonStatus`, `RoleAssignmentRole.PLAYER` — reserved but still not granted by this spec), `025-club-structure.md` (`Section`, the shared `Gender` enum this spec gives a second real consumer, and `SectionContact`'s bare-join shape mirrored here), `020-club-manager-access.md` (the `/api/v1/manage/**` namespace, `AccessService.canAdministerClub`), `021-club-contacts.md`/`023-sponsors.md` (`POST /api/v1/manage/media`, reused unchanged for the profile photo), `006-post-login-home-shells.md` (`ManagerDashboard`'s existing "Players" nav card and `/manage/players` `EmptyState` placeholder, wired to a real screen for the first time).
**Status:** draft.

## Problem & Goals

`006` stubbed a "Players" card on `ManagerDashboard` routing to `/manage/players` the same day it shipped everything else as a placeholder — `docs/roadmap.md` has listed "sections/teams/players management" as unbuilt ever since. `025` and `026`/`027` have since built `Section` and `Team` for real; `Player` is the last of that original trio, and the one with the richest real-world data requirement of the three.

`001`'s model has always had the shape this needs — `Person` as the identity anchor, `ClubMembership` as "which club is this person currently with" — but neither `ClubMembership` nor a real player-specific profile has ever been built. This spec builds both: `ClubMembership` for the first time (small, foundational, the same "build the prerequisite `001` already designed" move `025` made for `Section`), and a new `PlayerProfile` entity carrying everything a club actually needs to know about a player beyond their bare identity — basic info, contact info, medical info, and cricket-specific info — plus the ability to tag a player as eligible for more than one `Section` (a strong junior might reasonably be tagged against both an age-group section and the Open side).

**Goals**
- A club admin can add a player with: name, date of birth, an optional gender, a profile photo, a club membership number, and medical aid details (provider, member number).
- A club admin can record a player's own contact info (phone, email) and one alternative contact (name, phone) — independent of `Person.email`/`phone`, which stay reserved for login-capable identities (see Data Model Changes for why).
- A club admin can record cricket-specific info: batting stance, bowling arm, bowling type (a fixed list — see UI Requirements), and whether the player keeps wicket — every one of these fields independently optional, since not every player bowls or keeps.
- A club admin can tag a player against any number of `Section`s — a many-to-many relationship, independent of actual team rosters (`TeamRegistration`, still blocked on `Season` not existing).
- A club admin can edit, deactivate, and reactivate a player — deactivating also closes their `ClubMembership` (they're no longer with the club); reactivating reopens it.
- Resolves `006`'s "Players" card: real screen, not `EmptyState`.

## Non-goals

- **`TeamRegistration`, rosters, or squad placement.** Tagging a player to a `Section` is an eligibility/interest tag, not a squad assignment — matches this spec's Goals explicitly. `TeamRegistration` (`person_id, team_id, season_id, role`) remains entirely unbuilt, blocked on `Season`, exactly as `026`/`027` already left it.
- **Any `RoleAssignment(PLAYER, ...)` grant, or a Keycloak account.** Adding a player creates a `Person` with no login capability by default — same posture `026`'s `Team` creation takes toward its own contacts (no account implied by existing as a record). `RoleAssignmentRole.PLAYER` stays exactly as reserved-but-ungranted as `015` left it.
- **Person deduplication/matching for player creation.** Every "Add Player" creates a brand-new `Person` row — no search-by-name-or-email-and-link-instead flow. `PersonServiceImpl.findOrCreatePerson` (`014`) is deliberately not reused here (see Data Model Changes for the full reasoning); a future spec can add real matching (e.g. by name + date of birth) if duplicate `Person` rows turn out to be a real practical problem. Accepted as a known, documented limitation for this pass, matching this codebase's existing posture toward similar rare-edge-case gaps (`015`'s own concurrent-grant note).
- **Concurrent multi-club membership.** `001` ADR-01 stays enforced — at most one active (`valid_to IS NULL`) `ClubMembership` per `Person`, backed by a partial unique index. A transfer between clubs isn't built here; that's future scope once a real need for it shows up.
- **A standalone `ClubMembership` CRUD screen or endpoint.** It's created and closed only as a side effect of adding/deactivating/reactivating a `Player` in this pass — no direct `/manage/club-memberships` surface.
- **Enforcing `Section.minAge`/`maxAge`/`gender` against a tagged player's own age/gender.** Matches `025`'s own explicit non-enforcement stance for that metadata — tagging a player to a `Section` is never validated against `Player.dateOfBirth`/`gender`. Purely descriptive on both sides, same as it's always been.
- **Bulk import (CSV or similar).** A real future want, not this pass — players are added one at a time through the form.
- **The `/player` self-service shell** (`PlayerHome`/`PlayerProfile` view pages, `006`) — still entirely unbuilt/unwired, unrelated to this admin-facing `/manage` screen. Not touched here, same cut `020` already made for `MANAGER`/`PLAYER`-role screens generally. (Naming note: this spec's new backend `PlayerProfile` entity and DTOs share a name with the existing frontend `ui/src/pages/view/PlayerProfile.tsx` file — different layers, no actual collision, flagged here so it isn't a surprise later.)
- **Any public-facing roster display.** `/manage`-side only, matching every prior spec in this epic's identical Non-goal.
- **A `/platform` mirror.** Same established reasoning every spec since `020` has given.

## User Stories

- As a club admin, I open "Players" from my dashboard and see a list of my club's players.
- As a club admin, I can add a new player with their name, date of birth, and (optionally) gender, a photo, a club membership number, and medical aid details.
- As a club admin, I can record a player's own phone/email and one alternative contact's name/phone.
- As a club admin, I can record a player's batting stance, bowling arm, bowling type, and whether they keep wicket — leaving any or all of these blank if they don't apply or aren't known yet.
- As a club admin, I can tag a player against any number of sections — e.g. a strong U15 tagged to both "U15" and "Open Men" — and untag them later without deleting the player.
- As a club admin, I can edit any of a player's details at any time.
- As a club admin, I can deactivate a player who's left the club, without losing their record, and reactivate one if that turns out to be premature.
- As a club admin for club X, I cannot view or modify club Y's players, even by guessing an id — enforced server-side.

## Data Model Changes

**`Person` grows two fields, and one existing constraint loosens** — both changes `001` already anticipated:

```
Person {
    ...                    -- unchanged: id, first_name, last_name, phone?, keycloak_user_id?,
                            -- status, keycloak_provisioned_at
    string    email         -- NOW NULLABLE (was NOT NULL since 014) — see reasoning below
    date      date_of_birth -- new, nullable — 001's own Field Reference footnote already named
                            -- this as reserved-but-unbuilt "add it if/when a real consumer needs
                            -- it" — this is that consumer
    Gender    gender         -- new, nullable — reuses 025's existing Gender enum (MALE | FEMALE)
                            -- unchanged, gives it a second real consumer beyond Section's own
                            -- eligibility hint (Gender.java's Javadoc should be updated by a human
                            -- to note this, per Rollout Notes)
}
```

**Why `email` becomes nullable.** `014` built it `NOT NULL` for its one existing use case — a Subscription's responsible party, who always has an email because they need to log in. Most players (especially juniors) will never have a login at all, and this spec's own confirmed decision is that a player's contact info lives on `PlayerProfile` (below), entirely separate from `Person.email`/`phone`. So `Person.email` stays reserved for "this person can (or will) log in" — genuinely absent for a player-only `Person`, not populated with their roster contact email. The existing `ux_person_email_lower` unique index needs no change: Postgres unique indexes already treat `NULL` as distinct from any other value, so any number of `Person` rows can have a `NULL` email without colliding.

**Why player creation doesn't reuse `PersonServiceImpl.findOrCreatePerson`.** That method (a) requires an email to key its dedup lookup — this spec's player-creation flow never collects one for `Person` at all — and (b) defaults a newly-created `Person` to `PersonStatus.PENDING`, a status `015`/`016` designed specifically around "invited but hasn't logged in yet." A `Person` created purely as a player has no invite, ever — `PENDING` would read as a permanently-stuck, misleading state. This spec's own person-creation path (inside the new `PlayerService`, not `PersonService`) always creates a fresh `Person` and sets `status = ACTIVE` immediately, matching `015`'s own *original* default (before `016` changed it specifically for the login-invite case) — a deliberate, explicit divergence, not an oversight.

**New entity — `ClubMembership`**, `001`'s own original design, unmodified, built for the first time:

```
ClubMembership {
    uuid  id
    uuid  person_id  -- FK to person.id, not null
    uuid  club_id    -- FK to club.id, not null
    date  valid_from -- not null, defaults to creation date
    date  valid_to   -- nullable; null = currently active (001 ADR-01)
}
```

At most one row per `person_id` with `valid_to IS NULL` — `001` ADR-01, enforced by a partial unique index (same `WHERE status = 'ACTIVE'`-style backstop `009`'s `ux_subscription_active_owner` already established for an identical "one active X" rule).

**New entity — `PlayerProfile`**, club-scoped, everything from Goals beyond bare identity:

```
PlayerProfile {
    uuid      id
    uuid      person_id                  -- FK to person.id, not null
    uuid      club_id                    -- FK to club.id, not null (denormalized, same
                                          -- Team.club_id precedent — queries without joining
                                          -- club_membership)
    string    photo_url                  -- nullable, same posture as every other logo/photo field
    string    club_membership_number     -- nullable, free text
    string    medical_aid_provider       -- nullable, free text
    string    medical_aid_member_number  -- nullable, free text
    string    phone                      -- nullable — the player's own contact number, entirely
                                          -- separate from Person.phone
    string    email                      -- nullable — ditto, separate from Person.email
    string    alt_contact_name           -- nullable
    string    alt_contact_phone          -- nullable
    BattingStance battingStance          -- nullable enum: RIGHT_HANDED | LEFT_HANDED
    BowlingArm    bowlingArm             -- nullable enum: RIGHT_ARM | LEFT_ARM
    BowlingType   bowlingType            -- nullable enum, fixed list — see UI Requirements
    boolean   is_wicket_keeper           -- not null, default false
    boolean   active                     -- default true; "disable, never delete"
    timestamp created_at
    timestamp updated_at
    uuid      updated_by
}
```

Unique on `(person_id, club_id)` — one `PlayerProfile` per person per club (a transfer to a different club is a different `club_id`, so a new row, not a conflict).

**New entity — `PlayerSection`**, a many-to-many join between `PlayerProfile` and `Section` — bare join, mirrors `SectionContact` exactly:

```
PlayerSection {
    uuid      id
    uuid      player_profile_id  -- FK to player_profile.id, not null
    uuid      section_id         -- FK to section.id, not null
    timestamp created_at
    uuid      created_by
}
```

Unique on `(player_profile_id, section_id)`.

**Deactivate/reactivate also touches `ClubMembership`** — unlike every prior spec's simple `active` flip, a `PlayerProfile` sits on top of a real membership relationship: deactivating a player sets `PlayerProfile.active = false` *and* closes their `ClubMembership` (`valid_to = today`) in the same transaction — "no longer with the club" is exactly what deactivating a player means. Reactivating flips `PlayerProfile.active` back and re-opens the membership (`valid_to = null`) — `409` (`ConflictException`) if the person already holds a different active `ClubMembership` by then (the partial unique index is the real backstop; the service checks first for a clean error, same "DB constraint + pre-check for a clean message" pattern `021`'s `ux_club_contact_primary` already established).

**Migration** (next sequential file after `027`'s `019-add-team-profile.sql`):

```sql
-- backend/src/main/resources/db/changelog/v1/020-add-player.sql
ALTER TABLE person
    ALTER COLUMN email DROP NOT NULL,
    ADD COLUMN date_of_birth DATE,
    ADD COLUMN gender VARCHAR(16);

CREATE TABLE club_membership (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id  UUID NOT NULL REFERENCES person(id),
    club_id    UUID NOT NULL REFERENCES club(id),
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to   DATE
);

CREATE INDEX ix_club_membership_person ON club_membership(person_id);
CREATE INDEX ix_club_membership_club ON club_membership(club_id);
CREATE UNIQUE INDEX ux_club_membership_active ON club_membership(person_id) WHERE valid_to IS NULL;

CREATE TABLE player_profile (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id                UUID NOT NULL REFERENCES person(id),
    club_id                  UUID NOT NULL REFERENCES club(id),
    photo_url                VARCHAR(512),
    club_membership_number   VARCHAR(64),
    medical_aid_provider     VARCHAR(255),
    medical_aid_member_number VARCHAR(64),
    phone                    VARCHAR(32),
    email                    VARCHAR(255),
    alt_contact_name         VARCHAR(255),
    alt_contact_phone        VARCHAR(32),
    batting_stance           VARCHAR(16),
    bowling_arm              VARCHAR(16),
    bowling_type             VARCHAR(32),
    is_wicket_keeper         BOOLEAN NOT NULL DEFAULT false,
    active                   BOOLEAN NOT NULL DEFAULT true,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by               UUID,
    UNIQUE (person_id, club_id)
);

CREATE INDEX ix_player_profile_club ON player_profile(club_id);
CREATE INDEX ix_player_profile_person ON player_profile(person_id);

CREATE TABLE player_section (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_profile_id UUID NOT NULL REFERENCES player_profile(id),
    section_id        UUID NOT NULL REFERENCES section(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by        UUID,
    UNIQUE (player_profile_id, section_id)
);

CREATE INDEX ix_player_section_player ON player_section(player_profile_id);
CREATE INDEX ix_player_section_section ON player_section(section_id);
```

## API Contract

**Architecture note — one flat `PlayerDto`, composed from `Person` + `PlayerProfile`.** A club admin never thinks of these as two records — one form, one save. `PlayerDto` carries every field from both (identity fields from `Person`, everything else from `PlayerProfile`) plus `sectionIds: UUID[]` (bare ids — the frontend already has the club's full `Section` list fetched elsewhere and joins names client-side, same pattern `TeamDirectory.tsx` already uses for section names). `CreatePlayerRequest`/`UpdatePlayerRequest` are similarly flat. **Create never takes `sectionIds`** — tagging happens via the separate link/unlink endpoints below, after the player exists, matching every prior join in this codebase (no "create-and-tag" special endpoint).

**Architecture note — update writes through to the linked `Person`.** Unlike `findOrCreatePerson`'s "link, don't overwrite" rule (`014`, for its own ambiguous best-guess email match), editing an already-created `Player` is unambiguous — there's exactly one `Person` involved, already known by id. `PUT` updates `firstName`/`lastName`/`dateOfBirth`/`gender` on that `Person` directly, alongside `PlayerProfile`'s own fields, in one transaction.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/players` | `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")` | Lists every player for the club (active and inactive — inactive renders muted, same posture as every prior list) |
| `POST /api/v1/manage/clubs/{clubId}/players` | same | Creates a `Person` (`status = ACTIVE`, `email = null`), a `ClubMembership`, and a `PlayerProfile`, all in one transaction. Body: `{firstName, lastName, dateOfBirth?, gender?, photoUrl?, clubMembershipNumber?, medicalAidProvider?, medicalAidMemberNumber?, phone?, email?, altContactName?, altContactPhone?, battingStance?, bowlingArm?, bowlingType?, isWicketKeeper?}` |
| `PUT /api/v1/manage/clubs/{clubId}/players/{playerId}` | same | Updates the linked `Person`'s identity fields and the `PlayerProfile`'s own fields together. Same body shape as create |
| `POST .../players/{playerId}/deactivate` | same | `409` if already inactive. Otherwise sets `active: false` and closes the `ClubMembership` (`valid_to = today`) |
| `POST .../players/{playerId}/reactivate` | same | `409` if already active, or if the person already holds a different active `ClubMembership`. Otherwise sets `active: true` and reopens the `ClubMembership` (`valid_to = null`) |
| `GET .../players/{playerId}/sections` | same | Lists the `Section`s this player is tagged to |
| `POST .../players/{playerId}/sections/{sectionId}/link` | same | Tags the player to an existing `Section` (must belong to the same `clubId`). `409` if already tagged |
| `POST .../players/{playerId}/sections/{sectionId}/unlink` | same | Removes the tag. `404` if no such link exists |

Every endpoint is scoped to `clubId` first — `404` if `playerId`/`sectionId` is real but belongs to a different club, matching every prior spec's isolation posture.

## UI Requirements

Composes from the same primitives every other `/manage` screen now uses — `ListToolbar`/`RecordCard` for the list, a tabbed form (`SponsorForm`/`TeamFormPage`'s established pattern) for create/edit, `MediaUpload namespace="manage" variant="logo"` for the photo, and (for section tagging) the shared `LinkExistingRecordDialog` (`027`) with no `extraField` — tagging carries no extra data, same shape as `Team`↔`Sponsor`'s own link flow.

- **`ui/src/pages/manage/PlayerList.tsx`** (new, replaces `006`'s `EmptyState` placeholder) — `Outlet`-context `clubId`, `ListToolbar` (search by name) + `RecordCard` grid: `title` = full name, `fields` = a couple of the more identifying ones (e.g. date of birth, club membership number), `chips` = the player's tagged section names (resolved client-side against an already-fetched `listSections(clubId)`, same join pattern `TeamDirectory.tsx` uses), muted "Inactive" badge, `editTo`/Deactivate-Reactivate `secondaryAction` — same shape as every other list screen in this codebase.
- **`ui/src/components/PlayerForm/`** (new, four-file anatomy) — tabbed (**Basic Info** / **Contact Info** / **Cricket Info**), mirroring `SponsorForm`'s `Tabs` pattern exactly:
  - *Basic Info*: First name, Last name, Date of birth, Gender (`Select`, explicit "Not specified" option, matching `SectionDetailPanel`'s existing gender-select pattern), Photo (`MediaUpload`), Club membership number, Medical aid provider, Medical aid member number.
  - *Contact Info*: Phone, Email, Alternative contact name, Alternative contact phone.
  - *Cricket Info*: Batting stance (`Select`: Right-handed / Left-handed / not specified), Bowling arm (`Select`: Right-arm / Left-arm / not specified), Bowling type (`Select`, fixed list below, not specified), Wicketkeeper (checkbox).
  - **Bowling type options** (arm is already captured separately, so this list is arm-independent style, not combined codes like "RFM"): Fast, Fast-medium, Medium-fast, Medium, Off break, Leg break, Orthodox spin, Wrist spin / Chinaman, Googly.
- **`ui/src/pages/manage/PlayerFormPage.tsx`** (new) — `RecordFormScreen` wrapping `PlayerForm`, same create/edit-via-`:playerId?`-param shape every other form page uses. In edit mode only (needs a persisted id, same constraint `027` already established for `Team`'s Contacts/Sponsors tabs), gains a fourth tab, **Sections** — the player's currently-tagged sections (`Chip` list with an unlink `IconButton` per tag, mirroring `SectionDetailPanel`'s own linked-contacts block) plus a "Link existing" action opening `LinkExistingRecordDialog<Section>` (candidates = the club's full section list, filtered to exclude already-tagged ones) — no "create new section" option; sections are created via Club Structure only, not spawned from here.
- **`ui/src/api/playerApi.ts`** (new) — `Player`/`PlayerPayload` types, thin wrappers over the endpoints above.
- **`ui/src/App.tsx`** — the existing `players` route's `element` changes from `<EmptyState title="Players" description="Coming soon." />` to `<PlayerList />`; new routes `players/new`, `players/:playerId/edit`.
- **`ui/src/pages/manage/ManagerDashboard.tsx`** — no change. Its existing `{ title: 'Players', description: 'Manage the player roster', to: '/manage/players' }` card (`006`) already points at the right path.

**No Claude Design pass needed** — every element here is an already-styled primitive or a direct reuse of `027`'s tab/RecordCard/link-dialog patterns, not a new visual language.

**Mobile-first**, same responsive rules every prior `/manage` list/tabbed-form screen has already established.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `PlayerServiceImplTest` — create (Person+ClubMembership+PlayerProfile all created, `Person.status = ACTIVE`, `Person.email` stays null when none given), update (writes through to the linked Person), deactivate (closes ClubMembership) and its `409` if already inactive, reactivate (reopens ClubMembership) and its `409`s (already active; a different active ClubMembership already exists), link/unlink section tagging (already-tagged `409`, not-tagged `404`, cross-club rejection for `sectionId`), cross-club `NotFoundException` isolation for `playerId` |
| Integration | `PlayerProfileRepositoryTest`/`ClubMembershipRepositoryTest` (Testcontainers) — migration applies cleanly (including the `person.email` nullability change against any pre-existing rows), both unique constraints (`player_profile`'s `(person_id, club_id)`, `club_membership`'s active-partial-index) reject a duplicate at the DB level; `PlayerControllerIntegrationTest` — real `CLUB_ADMIN` success across all eight endpoints for their own club, `403`/`404` for a different club, `platform_admin` superset success, all the `409`/`404` cases through real HTTP |
| Contract | New endpoints + `PlayerDto`/`CreatePlayerRequest`/`UpdatePlayerRequest` documented in the checked-in OpenAPI schema |
| Component | `PlayerForm.test.tsx` + Storybook story — all three tabs render/validate, photo upload wiring; `PlayerList.test.tsx` — cards render with the right fields/chips/badge, deactivate/reactivate wiring; `PlayerFormPage.test.tsx` — the Sections tab renders only in edit mode, link/unlink wiring |
| E2E | New golden path: open Players, add a player (all three tabs), confirm it appears, open it, tag it to two sections, untag one, deactivate it, confirm it still shows (muted), reactivate it, reload and confirm every change persisted. Not wired into CI, same precedent as every prior `/manage` spec |

## Acceptance Criteria

- A club admin can add a player with the full set of Basic/Contact/Cricket Info fields from `/manage/players`, leaving any optional field blank.
- A player's own phone/email are stored separately from `Person.email`/`phone` and never conflated with a login identity.
- A club admin can tag a player to any number of sections and untag them without deleting the player.
- Deactivating a player closes their `ClubMembership`; reactivating reopens it, blocked (`409`) if the person already holds a different active membership by then.
- A club admin for club X gets `403`/`404` attempting any of the eight endpoints against club Y's id.
- `ManagerDashboard`'s "Players" card routes to a real screen, not `EmptyState`.

## Rollout Notes

- Ships as its own PR, on top of `025`'s `Section`, `020`'s `/api/v1/manage/**` namespace, and `027`'s `LinkExistingRecordDialog`.
- **This is `ClubMembership`'s first real implementation** — a human should add a footnote to `001-tenancy-identity-model.md`'s Field Reference table for it, same style as `Person`/`RoleAssignment`/`Section`/`Team`'s own footnotes.
- **`Person.email` becoming nullable is a real, deliberate loosening of an existing constraint** — re-verified here that `016`'s Keycloak provisioning and `017`'s welcome email are unaffected, since both only ever run for a `Person` that already has an email (the Subscription-responsible-party flow, untouched).
- **`Gender.java`'s Javadoc should be updated by a human** — it currently describes itself as Section-only ("a gender hint on a Section node"); this spec gives it a second real consumer (`Person.gender`).
- **`TeamRegistration` is still the real next step** once `Season` exists — this spec's `PlayerSection` tagging is explicitly not a substitute for it, just an eligibility signal in the meantime.
- A human should update `docs/roadmap.md`'s "Blocked on the full tenancy model" section once this ships — the `ClubMembership`-existence gap and the "players management" item under `006`'s section are both resolved; `Season`/`TeamRegistration`/`LeagueAffiliation`/`TEAM`- and `PLAYER`-scoped `RoleAssignment` resolution remain blocked exactly as before.
- **Refined after this spec shipped, on direct user feedback:** the Sections tab's "Link existing" dialog originally reused `027`'s `LinkExistingRecordDialog` (a flat search `Autocomplete`) — genuinely ambiguous once a real club's section tree had two branches reusing the same leaf name (e.g. "U13" under both Boys and Girls). Replaced with a real, expand/collapse `SectionTree` (new `@mui/x-tree-view` dependency — see `CLAUDE.md`'s tech stack table) inside a small dedicated dialog: already-tagged sections render disabled rather than being filtered out of the candidate pool, preserving the tree's real shape. `026-teams.md`'s `TeamForm` Section picker got the identical fix in the same pass, via the shared `SectionTreeSelect` component. Each tagged `Chip` also now shows the section's full breadcrumb path (reusing `026`'s `sectionBreadcrumb.ts`), not just its bare leaf name, for the same reason.
