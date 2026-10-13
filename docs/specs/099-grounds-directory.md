# 099 — Grounds Directory

**Depends on:** `001-tenancy-identity-model.md` (`Club`, `RoleAssignment`, `PLATFORM` scope, the one shared realm), `005-admin-login.md` and `010-minimal-club-creation.md` (the `platform_admin` surface under `/admin`), `012-club-profile.md` (the shared `@Embeddable Address` and the club's own address, used for the country default), `029-league-management.md` and `037-match-improvements.md` (`Match`, today carrying a free-text `venue`), `075-match-view-and-edit.md` and `089-match-page-form-and-list-view.md` (where venue is shown and edited), `097-import-framework.md` and `098-league-schedule-import.md` (venue stays free text there; see Non-goals), `043-list-toolbar-gold-standard.md`, `087-matches-polls-alignment.md` (`FilterBar`, `PageCounters`, `ContentControlsLine`), `091-leagues-gold-standard.md` (the list-page shape this follows).
**Status:** approved 2026-10-13 (user). Written 2026-10-13 from the user's request ("Fields Directory Manager"; renamed to Grounds the same day). Numbered 099 because 086 is reserved for the poll test mode idea.

## Problem & Goals

A match's ground is a free-text string today (`Match.venue`). Every club types "Riverside Oval", "Riverside", "riverside oval (main)" differently, so nothing can be filtered, linked to a map, checked for clashes, or reused by the next club that plays there. Roadmap already lists "a venue entity" as a deferred item (`docs/roadmap.md`, from `098`). Clubs also play away at other clubs', schools' and provincial grounds, and those grounds are shared knowledge: the first club to capture one should save every other club the work.

This spec adds a **Grounds directory**: a platform-wide list of cricket grounds (grounds), captured by club managers, **verified by a platform admin**, reusable by every club, and selectable (or creatable on the spot) when a match is created. It also fixes the data shape now so that a **ground booking and availability system (step 2)** can be added later without reshaping it.

**Terminology (decided with the user, 2026-10-13).** A **Ground** is the venue as a whole ("Riverside Sports Complex"), and is what this directory lists and what a match is linked to. A ground can contain several cricket **Fields**, named "Field A" and "Field B" (never "Ground A"). Fields and nets are areas inside a ground that step 2 needs for booking; they are named now but not built here (see Data Model Changes, "Designed for step 2"). The entity is `Ground` (`ground` table, `/grounds` paths) and the future sub-areas are `GroundArea` (`ground_area`), each with a type (`FIELD`, `NETS`, later others), because a bare `Field` collides with `java.lang.reflect.Field` and JPA vocabulary and because nets are not fields.

**Goals**
- A club manager can capture a ground once (name, owner, type, address, map link) and every club can then find and reuse it.
- Every ground has an explicit verification state. A ground captured by a manager is **Unverified** until a platform admin verifies it; an unverified ground is usable but visibly flagged wherever it is chosen or shown on a match.
- A club links grounds to itself as **home** (it manages or plays at it) so the manager sees "Our grounds" first, and a ground shared by two clubs is supported.
- Creating or editing a match picks a ground from the directory, or creates one inline without leaving the form.
- Grounds can be filtered by type (School, Club, Academy, Provincial).
- The data model leaves clear room for bookings and availability (step 2) without a migration that rewrites ground rows.

## Non-goals

- **No booking or availability system.** Step 2, a separate spec. This spec only fixes the shape it will hang on (see Data Model Changes, "Designed for step 2"). No booking table, endpoint or screen is built here.
- **No areas inside a ground (Field A, Field B, nets).** A real ground can have several cricket fields and a nets facility; modelling them is step 2's decision (booking is the first thing that needs them). Not built or stubbed here.
- **No geocoding, address autocomplete or map embed.** The map is a link the manager pastes. Latitude and longitude are not stored (a link is enough for people to navigate; coordinates are a step 2 or later need, added by migration then). Same posture as `012`'s Non-goals on address validation.
- **No ground photos, facilities lists, capacity, opening hours or contact people.** Out of scope; each is a clean later addition on the same row or a child table.
- **No "suggest a correction" flow for a verified ground.** Once verified, only a platform admin edits identifying details (see Access rules). Clubs reporting an error is on the roadmap list below.
- **No automatic conversion of existing `Match.venue` text into grounds.** Existing matches keep their text and show no flag. A manager can attach a ground when they next edit the match. Guessing at free text would create wrong, "verified-looking" links.
- **No change to the import (`097`/`098`).** Imported venues stay text. Resolving an imported venue to a ground is a roadmap item.
- **No ratings, reviews or per-club private notes on a ground.**
- **No public (unauthenticated) page for grounds.** Public schedule pages (`051`) keep showing the match's venue text, which now carries the ground name; a linked public ground page is later.
- **No per-club time zones** (`project_club_time_zones` in memory): unchanged assumption, not touched here.

## User Stories

- As a club manager, I can add a ground (name, owner, type, address, map link) so my club's ground is in the system.
- As a club manager, I am shown "Did you mean ...?" matches before saving a new ground, so I link an existing ground instead of creating a duplicate.
- As a club manager, I can search the directory of all clubs' grounds, filtered by type and by city, province or country, so I find an away ground someone already captured.
- As a club manager, I can mark a ground as one of my club's home grounds, so it appears under "Our grounds" and is the default suggestion in my matches. More than one club may mark the same ground home.
- As a club manager creating or editing a match, I can pick a ground from a searchable list (my club's home grounds first) or add a new one right there, without losing what I typed on the match.
- As a club manager, when the ground on a match is not verified, I see a clear flag on the match form, the match page and the match card, so I know the address may be wrong and can check it before telling players.
- As a club manager, I can edit a ground my club captured while it is still unverified, so I can fix my own mistakes.
- As a platform admin, I see a queue of unverified grounds with a counter, and can open each, correct it, and **Verify** it, so the directory becomes trustworthy.
- As a platform admin, I can **Reject** a ground with a reason (spam, test data), so it stops appearing in search.
- As a platform admin, I can **merge** a duplicate ground into another, so every match and club link moves to the surviving ground and nothing is orphaned.
- As a platform admin, I can edit any ground, verified or not, so I can correct what a club reports to me.
- As a club manager of club X, I cannot edit another club's unverified ground or any verified ground, even by guessing ids.
- As a player or public viewer, I see the ground's name on the match as before; the directory itself is manager-only.

## Data Model Changes

Migration: `backend/src/main/resources/db/changelog/v1/041-grounds.sql` (next free number after `040-player-verification-status.sql`; confirm at build time) plus its changelog entry. `ddl-auto=validate`; entity and migration ship in one PR (`docs/standards/backend.md`).

### New entity `Ground` (platform-wide, not club-scoped)

A ground is **not** owned by a club row: it is shared. It deliberately has no `club_id`. Who captured it is recorded separately; who uses it is the `club_ground` link.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | varchar(200), not null | e.g. "Riverside Oval" |
| `ground_type` | enum `GroundType`: `SCHOOL`, `CLUB`, `ACADEMY`, `PROVINCIAL`; not null | The filter dimension. Stored as a string column (`@Enumerated(STRING)`) |
| `owner_type` | enum `GroundOwnerType`: `CLUB`, `SCHOOL`, `PROVINCE`, `OTHER`; not null | Who owns the land or runs it |
| `owner_name` | varchar(200), not null | The owner as text ("Riverside CC", "St Andrew's College", "Western Province Cricket"). Always required so the ground reads sensibly with no further lookup |
| `owner_club_id` | uuid FK `club`, nullable | Set when `owner_type = CLUB` and the owner is a club on this platform; `owner_name` is then copied from that club's name by the service. Null for clubs not on the platform, schools, provinces |
| `address_street` ... | embedded `Address` (`012`) | Reuses the shared `@Embeddable Address` (street, city, province/state, country, postal code), not a new type. `address_number` and `address_postal_code` are optional. **City and country are required**, street required, province/county optional (not every country has one). `address_country` holds the **ISO 3166-1 alpha-2 code** for a ground (the UI shows the name); this is stricter than `012`'s free-text country on the club profile and is stated here so the two are not assumed identical |
| `map_url` | varchar(500), nullable | https URL (Google Maps, Apple Maps, OpenStreetMap). Validated server-side: must be `https`, parseable, and not a `javascript:`/`data:` scheme. Rendered as a link with `rel="noopener noreferrer"` |
| `location_notes` | varchar(500), nullable | Free text: "Enter via the school gate on Oak Rd". This is the "location" the request names in addition to the address and map link |
| `verification_status` | enum `GroundVerificationStatus`: `UNVERIFIED`, `VERIFIED`, `REJECTED`; not null, default `UNVERIFIED` | |
| `verified_at`, `verified_by_subject` | timestamptz / varchar, nullable | Set on Verify. The Keycloak subject is stored rather than a `Person` id, because a `platform_admin` may have no `Person` row (see `MeAccessDto`) |
| `rejection_reason` | varchar(500), nullable | Required when `REJECTED` |
| `created_by_club_id` | uuid FK `club`, nullable | The club whose manager captured it. Null for a ground created by a platform admin directly |
| `merged_into_id` | uuid FK `ground`, nullable | Set when an admin merges this ground away; such a row is hidden from search and resolves to its target (see Merge) |
| `created_at`, `updated_at` | timestamptz | Standard, as other entities |

Indexes and constraints:
- `ux_ground_identity` on `(lower(name), lower(address_city), address_country)` **where `merged_into_id is null`**: a hard stop on the exact duplicate. A violation maps to `DuplicateGroundException extends ConflictException` (409), whose body carries the existing ground's id so the UI can offer "Use this one". This is the safety net; the softer "Did you mean" check is the first line of defence (see API).
- `ix_ground_search` on `(address_country, lower(address_city))`; `ix_ground_status` on `(verification_status)` for the admin queue.

### New entity `ClubGround` (the link)

A club's relationship to a ground. This is what "the club links to it as the home club" means.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `club_id` | uuid FK `club`, not null | |
| `ground_id` | uuid FK `ground`, not null | |
| `is_home` | boolean, not null, default true | The club manages or regularly plays at the ground. A club can have non-home links in future (a "saved away ground"); for this spec the UI only creates `is_home = true` links, and the column exists so step 2 and a favourites feature need no migration |
| `created_at` | timestamptz | |

Unique `(club_id, ground_id)`. Many clubs may link the same ground home (a ground shared by two clubs is normal). The set of home clubs on a ground is also the set of clubs that will **manage its availability** in step 2.

A ground captured by a manager is **automatically linked home to the capturing club**. Linking and unlinking an existing ground is a separate action. Unlinking a ground that matches still reference is allowed: the link is only the "Our grounds" shortlist, matches reference the ground directly.

### Change to `Match`

- Add `ground_id uuid null` FK `ground`. Index `ix_match_ground`.
- **`venue` stays**, and is kept in step by the service: when a `ground_id` is set, `venue` is written to the ground's `name` (the same copy-the-display-text pattern `070` uses for league team names). This keeps every existing consumer working unchanged: match cards, the schedule PDF, `098`'s clash detection and venue suggestions, calendar exports and the public pages (`051`). A match with no `ground_id` keeps whatever text it had. The two are never edited independently in the UI: choosing a ground fills `venue`; clearing the ground clears `ground_id` and leaves `venue` null.
- `MatchDto` gains `groundId`, `groundName` (same as `venue` when linked), `groundVerificationStatus` (null when no ground). `CreateMatchRequest`/`UpdateMatchRequest` gain optional `groundId`; if both `groundId` and a differing `venue` are sent, `groundId` wins. A `groundId` that is `REJECTED`, or merged away, is refused with `ValidationException` ("This ground is no longer available"). A merged-away id is transparently resolved to its target.
- `Match.venue` as a client-writable ground remains accepted for backward compatibility with `097`/`098` imports and existing clients, until a later spec retires it.

### Designed for step 2 (booking) — not built here

Decisions made now so booking needs no rework:
- **The ground id is the stable anchor.** A booking will be `ground_booking(id, ground_id, club_id, starts_at, ends_at, purpose, match_id?, status, ...)` referencing `ground.id`. Because a ground is platform-wide and merge keeps one surviving id, booking rows never straddle two copies of the same ground.
- **Who may grant a booking** = the home clubs of the ground (`club_ground.is_home`). This is why home linking is a real table now, not a string on the ground.
- **Matches will reference bookings optionally**, not the reverse: `ground_booking.match_id`. Nothing on `Match` needs to change again.
- **Areas inside a ground** (Field A, Field B, Nets lanes 1-4) will be an optional child table `ground_area(id, ground_id, name, area_type, ...)` with `area_type` `FIELD` or `NETS` (extensible), and an optional `ground_area_id` on a booking and, for `FIELD` areas only, on a match. Absent means the whole ground. Matches already carry `ground_id`, so adding the optional area is additive.
- **Clash checks** will run on `(ground_id, time range)`, which is why `ground_id` must be on `Match` now rather than inferred from text.
- **Time zones:** a ground will eventually carry its own zone; omitted today (see Non-goals). Noted so step 2 adds it deliberately.

## API Contract

Two surfaces, following existing conventions: club-scoped under `/api/v1/manage/clubs/{clubId}/...` (guarded by `@access.canAccessClub`, per `docs/standards/backend.md`) and platform-admin under `/api/v1/admin/...` (`platform_admin`, as the existing admin controllers). DTOs only; MapStruct mappers; controller → service interface + impl → repository. List endpoints return `Page<T>` (`page`/`size`/`sort`); none fetch everything. Every service `list`/`get` is `@Transactional(readOnly = true)`, every write `@Transactional` (open-in-view is off).

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/grounds` | club manager | Search the whole directory. Params: `q` (name/city, case-insensitive substring, backend query), `type` (repeatable `GroundType`), `country`, `province`, `city`, `verification` (`UNVERIFIED`/`VERIFIED`), `mine` (only this club's home grounds). Excludes `REJECTED` and merged-away rows. Paged. Each item carries `linkedHome` (is it home for this club) and `verificationStatus`. Default sort: home grounds first, then name |
| `GET /api/v1/manage/clubs/{clubId}/grounds/summary` | club manager | Counters for the list page for the same filters: Our grounds, In the directory, Unverified |
| `GET /api/v1/manage/clubs/{clubId}/grounds/similar` | club manager | "Did you mean": params `name`, `city`, `country`; returns up to 5 existing grounds by normalised-name similarity within the same country (trigram or normalised prefix; see Open question 4). Used by the create form before submit; read-only |
| `GET /api/v1/manage/clubs/{clubId}/grounds/{groundId}` | club manager | One ground, with `linkedHome`, creator club name, verification details, and the number of this club's matches using it |
| `POST /api/v1/manage/clubs/{clubId}/grounds` | club manager | Capture a ground. Creates it `UNVERIFIED` with `created_by_club_id = clubId` and **auto-links it home** to the club. 409 `DuplicateGroundException` (carrying `existingGroundId`) on the identity constraint |
| `PUT /api/v1/manage/clubs/{clubId}/grounds/{groundId}` | club manager | Edit. Allowed only when the ground is `UNVERIFIED` **and** `created_by_club_id = clubId`; otherwise 409 `GroundNotEditableException` with a message saying who can edit (see Open question 5) |
| `PUT /api/v1/manage/clubs/{clubId}/grounds/{groundId}/home` | club manager | Link the ground home for this club (idempotent). `DELETE` on the same path unlinks. Body-less |
| `GET /api/v1/admin/grounds` | platform admin | The moderation list: params `verification` (default `UNVERIFIED`), `q`, `type`, `country`. Paged, oldest unverified first |
| `GET /api/v1/admin/grounds/summary` | platform admin | Counters: Unverified, Verified, Rejected |
| `GET /api/v1/admin/grounds/{groundId}` | platform admin | Full detail with every linked club, match count, creator club, possible duplicates |
| `PUT /api/v1/admin/grounds/{groundId}` | platform admin | Edit any ground, any state. Editing a verified ground keeps it verified |
| `POST /api/v1/admin/grounds/{groundId}/verify` | platform admin | `UNVERIFIED` → `VERIFIED`, stamps `verified_at`/`verified_by_subject`. Idempotent on an already verified ground. 409 `InvalidStatusTransitionException` from `REJECTED` (reopen first) |
| `POST /api/v1/admin/grounds/{groundId}/reject` | platform admin | Body `{reason}` (required). → `REJECTED`. Existing matches keep their link and show a "Ground rejected" flag (below) |
| `POST /api/v1/admin/grounds/{groundId}/reopen` | platform admin | `REJECTED` → `UNVERIFIED` |
| `POST /api/v1/admin/grounds/{groundId}/merge` | platform admin | Body `{targetGroundId}`. One transaction: set `merged_into_id`, repoint `match.ground_id`, move `club_ground` links to the target (de-duplicating on `(club_id, ground_id)`, a home link stays home if either was home), copy the target's name onto the affected matches' `venue`. Refused (409) if the target is itself merged away, rejected, or the same row |
| Existing match create/update/get/list | as today | `MatchDto` and request DTOs gain `groundId`/`groundName`/`groundVerificationStatus` as above. `GET /matches` gains an optional `groundId` filter (backend param) |

Summary endpoints use the same filter params as their list, as `087`/`088`/`091` do, so counters equal lists.

New exceptions in `com.cricketlegend.exception`: `DuplicateGroundException extends ConflictException`, `GroundNotEditableException extends ConflictException`, `GroundRejectedException extends ValidationException`. No new base type, so the status matrix in `docs/standards/backend.md` is unchanged. `InvalidStatusTransitionException` is reused (exists per the standards doc).

The OpenAPI schema is regenerated and checked in. Per the user's standing rule, do not run `mvn` under the live backend (`feedback_dont_build_under_live_backend`): verify in a scratch copy and hand-regenerate `openapi.yaml`.

## UI Requirements

**Design pass first.** This is a new list, a new form, and a new picker. Per `docs/workflow.md` Step 2 and the user's standing rules (`feedback_record_list_pattern`, `feedback_design_pass_pixel_fidelity`), mockups come from `theme.ts` and real components and are approved before build. Mirror the Poll screens' quality bar (`reference_poll_screens_gold_standard`).

**Composed from existing parts, no new styling system** (MUI v5 only):

1. **Grounds list: `/manage/fixtures/grounds`** (under the Fixtures group beside Matches and Seasons; menu entry "Grounds"). Follows the Leagues/Matches list shape (`091`, `087`): `ManageScreenHeader` with the primary **Add ground** action; `PageCounters` (Our grounds, In the directory, Unverified; "Unverified" is a quick filter) from `/grounds/summary`; `FilterBar` with **Type** (School / Club / Academy / Provincial), **Country**, **Province**, **City**, name search; `ContentControlsLine` with the Name sort link, a **Show only our grounds** switch (default **on** when the club has at least one home ground, off otherwise) and the Cards | List switch (`useListViewPreference('groundList:view')`). Filters saved per club (`groundList:filters:<clubId>` via `usePersistedListFilters`); search and the quick filter are per visit. All filters are backend params; the list is paged (`useQuery` keyed on page), never sliced client-side.
2. **Ground card** (`RecordCard`): leading `rounded` avatar with a fixed ground icon (a new brand icon is not needed: icons under 32 px stay MUI; the 56 px avatar uses the standard `avatarSx` initials fallback), title name, **status badge**: green **Verified**, amber **Unverified** (`badgeSx`, same colours as the amber used by availability), grey **Rejected**; key fields: city + province, owner; chips: type and "Our ground"; footer: **Edit** (filled primary, `feedback_edit_button_always_filled`) only where editable, otherwise **View**; **Add to our grounds** / **Remove** link action (`LinkOff` icon, per the card footer convention). The map link opens as an icon action ("Open in maps"). The whole card opens the detail page (`059`).
3. **Ground list view** (`ListViewToggle`): a `GroundTable` with columns Name, Type, Owner, City, Province, Status (a phone shows Name, City, Status), whole row opens the record, zebra rows, "–" for empty values.
4. **Ground detail page** (`RecordDetailScreen` pattern, `088`/`089`): header with name and status badge, key-figure strip (Type, Owner, City, Matches played here, Our ground yes/no), address block, **Open in maps** button (real outlined button with icon, `feedback_cross_link_discoverability`), location notes, "Captured by <club name>", and for admins/anyone the verification line ("Verified 12 Oct 2026" or "Not yet verified by Cricket Legend"). Unverified grounds show a persistent amber notice: "This ground has not been verified yet. Check the address before you share it with players."
5. **Add / edit ground: `RecordFormScreen`** (`/manage/fixtures/grounds/new`, `/:groundId/edit`): fields in order: Name, Type, Owner type, Owner (free text; when Owner type is Club, an optional picker of platform clubs sets `owner_club_id` and copies the name), Street, City, Province/County (label adapts: "Province" for ZA, "County" for GB/IE, "State" for US/AU/IN, "Province/County/State" otherwise, a label map, no per-country validation), Postal code, **Country**, Map link, Location notes. **Country defaults from the browser**: the browser time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`, e.g. `Africa/Johannesburg`) mapped to an ISO country through a small bundled lookup (`utils/countryFromTimeZone.ts`), falling back to the locale region (`navigator.language`, e.g. `en-ZA`), then to the club's profile country, then empty (user must choose). It is a default only and always editable. A Country `Autocomplete` over a static ISO list (`utils/countries.ts`). Validation errors show under the ground; compact 40 px inputs, "(optional)" in labels. On the create form, entering Name and City triggers `/grounds/similar` and shows a "Did you mean one of these?" panel with **Use this ground** per suggestion (links it home and returns) and a **No, this is a different ground** confirmation before Save. A `409 DuplicateGround` response shows the same offer for the existing ground. A non-editable ground opens the form read-only with the reason ("Only a platform admin can change a verified ground").
6. **`GroundPicker` — new shared component** (`components/GroundPicker/`, four-file anatomy: `.tsx`, `.test.tsx`, `.stories.tsx`, `index.ts`). An MUI `Autocomplete` with server-side search (debounced into `GET /grounds?q=`, never client-filtered), options grouped **Our grounds** then **Other grounds**, each option showing name, city and a small amber **Unverified** chip; a footer option **Add a new ground...** that opens the same form as a **dialog** (a `GroundFormDialog` composed from the same ground set as the page, so the form is one shared body, `ui/src/components/GroundFormGrounds`, not two copies) and, on save, selects the new ground in the picker with the surrounding match form state untouched. Used by the match form here and by step 2 (booking) later. Presentational about data: takes `value`, `onChange`, `clubId`.
7. **Match form (`089`)**: the "Venue (optional)" input becomes `GroundPicker` labelled "Ground (optional)". If the selected ground is `UNVERIFIED`, an inline amber alert under the picker: "This ground has not been verified yet. The address may be wrong." If `REJECTED` (only possible for an existing link), a red alert and Save is blocked until the manager picks another or clears it. A match imported or created with only text shows the text read-only beneath ("Current venue text: ...") until a ground is chosen.
8. **Match card, Match view and Match list table**: the Venue slot shows the ground name; an amber **Unverified ground** badge (small, with a tooltip) next to it when applicable, and a red **Ground rejected** one when applicable. The Match view key-figure strip's Venue tile links to the ground's detail page and carries the same flag. The Matches `FilterBar` gains an optional **Ground** filter (a `GroundPicker`-backed select of this club's grounds) passed as `groundId`.
9. **Admin: `/admin/grounds`** — the moderation queue in the same shell as the other `/admin` screens. `PageCounters` (Unverified, Verified, Rejected; Unverified is the default quick filter), a list of grounds oldest first, each with who captured it, the clubs linked, the number of matches using it, and possible duplicates. Detail view with **Verify**, **Reject** (dialog with required reason), **Reopen**, **Edit**, and **Merge into...** (a search picker for the target, a confirm step stating how many matches and clubs will move: nothing merges without that explicit confirm, `feedback_import_always_confirm`). A nav tile/counter for "Grounds to verify" on the admin home so the queue is noticed without a menu badge on the manager side (`project_notifications_bell_not_menu_badge`).
10. **Mobile first.** Everything authored at 375 px: the picker is a full-width autocomplete with a bottom-sheet-style dialog for "Add a new ground"; the list shows the reduced column set; counters two across.
11. **API client**: `ui/src/api/groundApi.ts` (list, summary, similar, get, create, update, link/unlink) and `ui/src/api/adminGroundApi.ts` (queue, verify, reject, reopen, merge), React Query, no direct axios in components. Match types gain the new fields in `matchApi`.
12. **Standards docs to update in the same PR:** `docs/standards/design-system.md` (GroundPicker, status badge colours for verification, the Grounds list as the next worked example of the `091` shape), `docs/standards/frontend.md` (route list, persisted keys `groundList:filters:<clubId>`, `groundList:view`), `docs/roadmap.md` (resolve the "venue entity" item from `098`; add the deferred items below), and `docs/architecture.md` if it lists the match relationships.

## Test Plan

Per `docs/standards/testing.md`:

- **Unit (JUnit 5, no Spring):** `GroundServiceImpl` rules: auto home-link on capture; edit allowed only for the creator club while unverified, refused for another club, refused for a verified ground; verify / reject / reopen transitions and the invalid ones (`REJECTED` → verify refused); reject requires a reason; `venue` is written from the ground name when `groundId` is set and cleared with it; `groundId` wins over a conflicting `venue`; a rejected or merged-away `groundId` is refused / resolved; `owner_club_id` copies the club name; map URL validation (https only, `javascript:` and `data:` refused); required address parts (city, country, street). Merge: target validity rules, link de-duplication, home-stays-home. Country-code validation (ISO alpha-2).
- **Integration (Testcontainers via `AbstractIntegrationTest`):** the migration applies cleanly; the identity unique index rejects an exact duplicate case-insensitively and allows the same name in another city; the search query (`q`, type, country/province/city, `mine`, verification, exclusion of rejected and merged rows, home-first ordering, paging with real `LIMIT/OFFSET`); `similar` returns near matches and nothing across countries; the admin queue order; merge repoints `match.ground_id`, moves `club_ground` and updates `match.venue` in one transaction, and rolls back whole on failure; `GET /matches?groundId=`. Service tests that exercise lazy mapping run **without** an ambient class-level `@Transactional` (the `open-in-view=false` trap in `docs/standards/backend.md`).
- **Authorization tests:** club X cannot read `grounds/{id}/home` or write through club Y's `clubId`; a manager cannot call any `/api/v1/admin/grounds` endpoint (403); a platform admin can; a manager cannot edit a verified ground.
- **Contract:** regenerated `openapi.yaml` diff reviewed; the `Match` DTO additions are additive (no breaking change).
- **ArchUnit:** unchanged rules must still pass (layering, no entity across the controller boundary, `Impl` suffix).
- **Component (Vitest + Testing Library + Storybook interaction):** `GroundPicker`: debounced server search, groups "Our grounds" then "Other grounds", the Unverified chip, "Add a new ground..." opens the dialog and selects the saved ground while the host form's state is retained, a rejected value shows the error. `GroundFormGrounds`: country defaults from the mocked time zone, falls back to locale, then club country; province label map; "Did you mean" panel appears for a near match and "Use this ground" links instead of creating; 409 duplicate offers the existing ground. `GroundCard`/`GroundTable`: badges per status, Edit vs View by editability, empty values as "–". Match form: unverified alert shown / rejected blocks save. Admin queue: Verify, Reject requires reason, Merge shows the confirm with counts and does not call the API until confirmed. A story for every new shared component.
- **End-to-end (Playwright, mobile + desktop, one golden path):** a manager creates a match, adds a new ground inline from the picker, sees the Unverified flag on the match; a platform admin verifies it; the manager reloads the match and the flag is gone; a second club finds the ground in the directory and uses it on its own match.
- **Manual smoke (real running app, not just tests):** list/get paths for lazy fields, and the live country default in a real browser on this machine's time zone.

## Acceptance Criteria

- A club manager can add a ground with name, type, owner (type and name), street, city, province/county, country, optional map link and location notes, and it appears in their directory marked **Unverified** and under **Our grounds**.
- The Country field defaults from the browser's time zone (falling back to the browser locale region, then the club's own country) and the manager can change it.
- Saving a ground whose name and city match an existing ground offers to use that ground; a hard duplicate (same name, city, country, ignoring case) is refused with 409 and the existing ground offered.
- The directory lists grounds from every club, can be filtered by type (School, Club, Academy, Provincial), country, province and city, searched by name, and is paged by the backend.
- A manager can mark any ground as home for their club and remove it again; two clubs can have the same ground as home.
- A manager can edit a ground only while it is unverified and their club captured it; they cannot edit anyone else's ground or any verified ground, and the API enforces it, not just the UI.
- Creating or editing a match offers a searchable ground picker (own home grounds first) and an **Add a new ground...** option that creates the ground without leaving or resetting the match form.
- Selecting an unverified ground on a match shows a visible warning on the form, and an **Unverified ground** flag on the match card, list row and match page; a verified ground shows none.
- Choosing a ground sets the match's `venue` text to the ground name, so existing cards, schedule PDFs, calendar exports, public schedule pages and imports show the same text as before; matches without a ground are unchanged.
- A platform admin has a queue of unverified grounds with a count, and can verify, edit, reject (with a reason), reopen and merge them. Verifying clears the flag on every match using that ground without editing any match.
- Rejecting a ground removes it from search and picker results; matches already using it show a **Ground rejected** flag and cannot be saved until a manager chooses another ground or clears it.
- Merging ground A into B moves all matches and club links to B in one transaction, B's name appears as the venue on those matches, and A no longer appears anywhere; nothing merges without an explicit confirmation showing how many matches and clubs are affected.
- No migration changes or deletes existing match rows' `venue` text, and no existing match is given a ground automatically.
- The model supports step 2 without change to the `ground` table or `match`: a booking can reference `ground.id`, the home clubs of a ground are queryable, and the match-to-ground link is a column, not text.
- All list endpoints are paged server-side; no screen fetches the whole directory to filter in the browser.
- All new UI is mobile-first at 375 px and uses MUI v5 with `theme.ts` tokens only.

## Rollout Notes

**Sequencing (one PR may carry slices, each separately reviewable):**
1. **Backend core:** migration, `Ground`/`ClubGround` entities, services, club-scoped endpoints, exceptions, `Match.ground_id` and DTO additions, `GET /matches?groundId`. Authorization and integration tests land here.
2. **Admin moderation:** `/api/v1/admin/grounds` endpoints (verify, reject, reopen, edit, merge), then the `/admin/grounds` screens.
3. **Manager UI:** grounds list, form, detail, `GroundPicker` + `GroundFormGrounds`, then the match form, card, view and filter integration. Design mockups approved before this slice.
4. **Docs:** standards, roadmap, architecture notes in the same PR as the slice that changes them.

Backward compatible throughout: `ground_id` is nullable and `venue` keeps working, so slice 1 can ship before any UI and old clients are unaffected. No feature flag needed. The new Grounds menu entry is hidden behind nothing; the admin queue starts empty.

**Seeding:** none required. The directory starts empty and fills as managers capture grounds. Optionally (Open question 6) a one-off admin script could pre-seed grounds from the distinct `match.venue` strings, as unverified, for the admin to review; not part of this spec.

**Deferred (to be added to `docs/roadmap.md` under "Deferred by `099`"):**
- Step 2 booking and availability (spec to follow; shape fixed above), including the areas inside a ground (Field A, Field B, nets), per-ground time zone, home-club approval flow and clash detection against `(ground_id, time)`.
- Clubs suggesting corrections to a verified ground.
- Resolving imported venue text (`097`/`098`) to grounds, and retiring client-writable `Match.venue`.
- Coordinates and map embed; facilities, photos, opening hours, contacts.
- A public ground page and "grounds near me".
- A header-bell notification to the admin on a new unverified ground (`project_notifications_bell_not_menu_badge`); until then the admin sees the counter on the admin home.
- A one-off review job converting legacy venue strings into suggested grounds.

### Open questions (recommended defaults, accepted unless the reviewer says otherwise)

1. **Naming:** decided. UI and code both say Ground; the sub-areas inside a ground are Fields (Field A, Field B), built in step 2.
2. **Visibility of other clubs' unverified grounds.** Recommended: visible and selectable by every manager, flagged. Alternative: unverified grounds are visible only to the capturing club until verified (safer against spam, but defeats the reuse goal and means the second club re-captures it).
3. **Ground type vs owner type overlap.** `ground_type` (what the ground is, for filtering) and `owner_type` (who owns it) often agree (a school ground owned by a school). Recommended: keep both, because a club can run a ground on school land and the request lists them as separate inputs. Alternative: drop `owner_type` and keep only the free-text owner.
4. **Similarity matching** for "Did you mean": recommended Postgres `pg_trgm` (needs the extension enabled in the migration) over a normalised name within the same country. Alternative with no extension: case/space/punctuation-normalised prefix and contains match only.
5. **HTTP status for "not editable".** Recommended 409 via `GroundNotEditableException extends ConflictException` (no new base type). Alternative: add a 403 base type, which means a standards-table change first, so not recommended.
6. **Country from browser zone.** Recommended: time zone first (as requested), locale second. The time-zone lookup table is a small bundled map; the alternative is locale only (simpler, accurate for most users, but it reflects language preference, not location, e.g. `en-US` in South Africa).
7. **Who may verify.** Recommended: platform admins only (as requested). Alternative for scale: also club admins of the ground's owning club when `owner_club_id` is set (trusted for their own ground). Not recommended before real volume.
8. **Merge in this spec or later?** Recommended in: verification without merge leaves duplicates unfixable once matches reference them. Alternative: ship without and add before launch.
