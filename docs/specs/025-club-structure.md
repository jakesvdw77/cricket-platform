# 025 — Club Structure

**Depends on:** `001-tenancy-identity-model.md` (`Section` — the self-referential entity this spec builds for the first time, exactly as `001` already modeled it), `006-post-login-home-shells.md` (`ManagerHome`/`GridNavShell`/`ManagerDashboard`'s existing "Sections & Age Groups" card, which this spec renames and wires to a real screen for the first time), `020-club-manager-access.md` (the `/api/v1/manage/**` namespace, `AccessService.canAdministerClub`, `ManagerHome`'s `Outlet` context), `021-club-contacts.md` (`ClubContact`/`ClubContactController` — the existing named-contact records this spec links to, via a new join, without redefining them).
**Status:** approved.

## Problem & Goals

`001`'s `Section` was deliberately designed self-referential (`parent_section_id`) specifically because "every club structures its age groups differently" — but nothing has ever built it. `006`'s `ManagerDashboard` has shipped a "Sections & Age Groups" card routing to an `EmptyState` placeholder since the day it landed, and `docs/roadmap.md`'s "Blocked on the full tenancy model" section still lists `Section` as not existing in code.

Real clubs don't share one hierarchy shape. One club splits Juniors into Boys/Girls before age bands; another doesn't split by gender at all; another adds a grade split within an age band (`U13A`/`U13B`); a Vets section might have no age-based children at all, just "Over 40"/"Over 50". A fixed-depth, fixed-vocabulary form can't represent all of that — which is exactly why `001` made `Section` a self-referential tree instead of a fixed `Club → Section → AgeGroup → Team` chain in the first place.

This spec builds `Section` for real, for the first time, as a club-admin-editable tree via a visual org-chart-style editor — plus two capabilities `001` never designed: linking existing `ClubContact` (`021`) records to a `Section` node, and capturing (not enforcing) simple eligibility metadata per node.

**Goals**
- A club admin can define and edit an arbitrarily-shaped tree of `Section` nodes for their club — any depth, any branching, freely relabeled — through a visual, click-to-edit org-chart component, not a fixed multi-step wizard or a hardcoded level vocabulary.
- A small set of optional starter templates — covering a few genuinely different, real club/school shapes, each shown as a small diagram before picking one — pre-populates a plausible starting tree the admin can then freely restructure, rename, extend, or prune. A template is a convenience default, never a constraint on what shape the tree can end up as; starting blank is always an equally-valid option alongside them.
- Clicking any node opens a detail panel where the admin can rename it, set optional eligibility metadata (min age, max age, a gender hint), and manage which `ClubContact` records are linked to that node — link an existing one, or create a brand-new one and link it in the same flow.
- Renames `ManagerDashboard`'s existing "Sections & Age Groups" card to "Club Structure" and wires it to this real screen for the first time — `001`'s own Javadoc-equivalent note already established that "Section" is the correct internal/technical name while user-facing copy should say whatever fits ("Age Group," "Grade," or, at the nav-card level, "Club Structure" — the tree covers more than age groups, exactly as `001` anticipated).

## Non-goals

- **The `Team` entity, rosters, or player registration.** `001`'s `Team` stays exactly as unbuilt as `docs/roadmap.md` already describes. A future spec will place real `Team` rows under a leaf `Section` once roster/registration management is scoped — this spec's `Section` rows are shaped to be exactly what that future `Team.section_id` FK will point at, but no `Team` row is created here.
- **Enforcing eligibility rules anywhere.** Nothing in this codebase today lets a player register for a `Section` (`TeamRegistration` doesn't exist). `minAge`/`maxAge`/`gender` are pure metadata, shown and edited in the node detail panel, validated only for internal self-consistency (`minAge <= maxAge` when both are set) — never checked against a real person. Real enforcement is a future spec's job, blocked on player registration existing at all.
- **Any `RoleAssignment` `SECTION`-scope wiring.** `001`/`015` already reserve `SECTION` as a recognized `scope_type` value; granting or resolving a Section-scoped admin grant is separate, unbuilt future scope (`docs/roadmap.md`'s own "Blocked on the full tenancy model" section already names this gap). This spec only ever checks `CLUB`-scope access via the existing `canAdministerClub`, matching `020`/`021`/`022`/`023`/`024`'s precedent exactly.
- **A `/platform` mirror.** Matches `021`/`022`/`023`/`024`'s established precedent — `canAdministerClub` already gives `platform_admin` a superset pass on `/manage/**` endpoints; no parallel `/platform/clubs/{id}/sections` surface is built.
- **Hard-deleting a `Section` that still has linked contacts, or any child section at all (active or inactive).** Matches this codebase's "disable, never delete" posture (`Product`, `Club`, `ClubContact`, `Sponsor`, `SponsorContact`) for any node carrying real attached data or structure. See Data Model Changes for the one deliberate exception: a node with nothing attached to it — zero children, zero linked contacts — is actually deleted rather than left as a permanent inactive placeholder, since recreating an empty node costs nothing and there's nothing on it worth preserving.
- **Re-parenting an existing node to a different parent, or reordering siblings.** First pass supports add-child, rename, and remove (deactivate) only. Moving an existing subtree elsewhere in the tree is a real, valuable future enhancement — named explicitly here so it reads as a deliberate cut, not a forgotten one — but it adds real complexity (cycle prevention, subtree re-scoping) beyond what the requester's worked example needed.
- **A fixed or enum-based level vocabulary.** There is no hardcoded "Section → Age Group → Team" ladder anywhere in this feature. Every node's label is a free-text string the admin fully controls; the "starter template" (Goals) is pre-filled *data*, never a structural constraint — a club can delete every templated node and build something with a completely different shape.
- **Forcing `ClubContact` unlinking before a `Section` can be deactivated.** A deactivated `Section`'s contact links are left as-is (mirroring `021`'s own precedent of leaving a deactivated contact's stale `isPrimary` flag untouched rather than cleaning it up) — only *active child Sections* block a deactivate, not linked contacts.
- **The `ListToolbar`/`RecordCard`/`RecordFormScreen` flat list/CRUD pattern for the tree screen itself.** That anatomy (established by `008`/`010`, reused by `021`/`023`/`024`) is for a flat record list — a poor fit for a hierarchical, click-to-navigate editor. The node detail panel's own sub-forms (rename, eligibility, contact linking) do reuse this codebase's existing form conventions and shared `Input`/`Card`/`Button` primitives where they fit.

## User Stories

- As a club admin, I open "Club Structure" from my dashboard and see my club's current section tree — or, if none exists yet, a choice to start from a template or start blank.
- As a club admin, I can add a child node under any existing node, at any depth, so my tree matches how my club is actually organised — not a shape this app assumed in advance.
- As a club admin, I can rename any node inline, whether it's a top-level group like "Open Sides" or a leaf like "1s".
- As a club admin, I can remove a node once it has no active children — the app tells me clearly why I can't remove a node that still has active sub-sections underneath it, rather than silently orphaning them. If the node has no contacts linked to it either, removing it deletes it outright rather than leaving an inactive placeholder behind; if it does have linked contacts, removing it deactivates it instead, and I can reactivate it later.
- As a club admin, I can click any node and see/edit its eligibility metadata — a minimum age, a maximum age, and a gender hint — with every one of those three fields optional, so an "Open" section can have none of them set.
- As a club admin, I can link an existing `ClubContact` to a node (e.g. attach my club's Treasurer to both "Juniors" and "Open Sides"), or create a brand-new contact and link it in the same flow, without leaving the Club Structure screen.
- As a club admin, I can unlink a contact from a node without deleting the underlying `ClubContact` record — it stays available to link elsewhere.
- As a club admin with an empty section tree, I see a small set of named, previewed starting shapes (e.g. a traditional club with a men's/women's and boys'/girls' split, a simpler club with no gender split, an adults-only club with no juniors, a school's First/Second XI plus an age-graded Colts ladder) — each shown as a small diagram — so I can pick whichever is closest to how my club is actually organised, rather than always getting the same one-size-fits-all starting point.
- As a club admin, if I start from a template, I can immediately rename, delete, or add to every node it created — nothing about having used a template locks any part of the tree.
- As a club admin for club X, I cannot view or modify club Y's section tree, even by guessing an id — enforced server-side.

## Data Model Changes

**New entity — `Section`**, the first real implementation of `001-tenancy-identity-model.md`'s already-designed self-referential shape. Adds three fields `001` never specified (the eligibility metadata this spec introduces) and this codebase's standard audit/active-flag columns:

```
Section {
    uuid      id                  -- PK, generated
    uuid      club_id             -- FK to club.id, not null
    uuid      parent_section_id   -- nullable FK to section.id, self-referential (001)
    string    name                -- free text, user-editable, not null
    integer   min_age             -- nullable, no enforcement (see Non-goals)
    integer   max_age             -- nullable, no enforcement
    string    gender              -- nullable enum: MALE | FEMALE; unset = no restriction —
                                   -- an unenforced hint only, never validated against a real
                                   -- person (see Non-goals)
    boolean   active              -- default true; see the Remove rule below — not every removal
                                   -- is a soft deactivate
    timestamp created_at
    timestamp updated_at
    uuid      updated_by
}
```

`min_age <= max_age` is validated at create/update time when both are set (a `ValidationException`, `400`) — the one piece of validation these fields get; no other consistency rule applies to them.

**Remove rule — a `Section` with an active direct child can never be removed, by either mechanism below.** Unlike `ClubContact`/`Sponsor`'s simple one-way transition guard, a tree has a real orphaning risk a flat list doesn't: removing "Juniors" while "U13"/"U15" are still active would leave an active subtree hanging off an inactive (or now-deleted) parent, which the tree UI has no sane way to render. `InvalidStatusTransitionException` (`409`, existing class, reused as-is) covers both the already-inactive case (matching every other spec's precedent) and this active-children case, with a distinct message for each so the UI can show the right guidance.

Once that guard passes, removing a `Section` does one of two things, decided server-side (the caller always hits the same endpoint — see the API Contract's matching Architecture note):

- **Zero children at all (active or inactive) and zero linked `SectionContact` rows → the row is actually deleted.** Nothing about the node is worth preserving — no structure hangs off it, no contact references it — so leaving it around as a permanent inactive placeholder is pure clutter; recreating an equivalent empty node costs nothing. This is the one deliberate exception to this codebase's "disable, never delete" posture. "Zero children" means literally none, not just none *active* — an inactive child row would still violate `section`'s own `parent_section_id` FK on delete. Once `Team` (`001`, still unbuilt) exists, its own linked-rows check belongs in this same eligibility test.
- **Any linked contact → the existing soft-deactivate behavior (`active: true -> false`).** A contact link is real attached data; unlinking it is a separate, explicit admin action (see the unlink endpoint below), never an implicit side effect of removing the section it's attached to.

Reactivating a node never requires touching its children (an inactive parent's active children were never possible to create in the first place, since creating a child requires the parent to exist and nothing here requires a parent to be active for a child to be created against it — reactivating a leaf independently of its ancestors' state is fine). A hard-deleted `Section` has no reactivate path — there's nothing left to reactivate.

**New entity — `SectionContact`**, a many-to-many join between `Section` and `021`'s existing `ClubContact` (not a FK added to either table, matching this codebase's precedent of a dedicated join row over a bidirectional relationship column):

```
SectionContact {
    uuid      id                -- PK, generated
    uuid      section_id        -- FK to section.id, not null
    uuid      club_contact_id   -- FK to club_contact.id, not null
    timestamp created_at
    uuid      created_by
}
```

Unique on `(section_id, club_contact_id)` — the same contact can't be linked twice to the same section, but the same contact can be linked to any number of *different* sections, and a section can have any number of linked contacts. No `active` flag on the join itself — unlinking is a hard delete of the join row only (the `ClubContact` and `Section` rows themselves are never touched by an unlink), which is not a departure from the "disable, never delete" posture above since a join row carries no independent business meaning once removed — same category as e.g. removing a tag, not deleting a record.

**Migration** (next sequential file after `024`'s `016-add-sponsor-contact.sql`):

```sql
-- backend/src/main/resources/db/changelog/v1/017-add-section.sql
CREATE TABLE section (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id            UUID NOT NULL REFERENCES club(id),
    parent_section_id  UUID REFERENCES section(id),
    name               VARCHAR(255) NOT NULL,
    min_age            INTEGER,
    max_age            INTEGER,
    gender             VARCHAR(16),
    active             BOOLEAN NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by         UUID
);

CREATE INDEX ix_section_club ON section(club_id);
CREATE INDEX ix_section_parent ON section(parent_section_id);

CREATE TABLE section_contact (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id       UUID NOT NULL REFERENCES section(id),
    club_contact_id  UUID NOT NULL REFERENCES club_contact(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by       UUID,
    UNIQUE (section_id, club_contact_id)
);

CREATE INDEX ix_section_contact_section ON section_contact(section_id);
CREATE INDEX ix_section_contact_contact ON section_contact(club_contact_id);
```

## API Contract

**Architecture note — flat list, not nested JSON.** `GET .../sections` returns every `Section` for the club as a flat array (each row carrying its own `parentSectionId`), the same "small, unpaginated, fully-fetched" posture `021`/`023`/`024` already established for their own lists — not a recursively-nested tree payload. The client builds the tree from the flat list plus parent pointers, which is also the input shape essentially every tree/org-chart UI library expects, so this avoids a serialization step on the backend that the frontend would just have to flatten again for the editor anyway.

**Architecture note — no new endpoint for "create a contact and link it."** The UI composes two already-existing/new-but-independent calls: `021`'s existing `POST /api/v1/manage/clubs/{clubId}/contacts` (creates the `ClubContact`) followed by this spec's own link endpoint below — no new "create-and-link" backend endpoint is needed.

**Architecture note — `POST .../deactivate` sometimes hard-deletes instead.** Kept as one endpoint behind the tree's single "Remove" control, rather than exposing a separate delete endpoint the client would have to choose between — the delete-vs-deactivate eligibility check (Data Model Changes' Remove rule) is a server-side business rule, not a client decision. Returns `200` with the updated `SectionDto` when soft-deactivated, `204 No Content` when the row was actually deleted (there's no longer a resource to return). The endpoint name stays `/deactivate` — it still describes the one admin-facing action ("remove this section"), the two possible mechanics behind it are an implementation detail.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/sections` | `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")` | Lists every section for the club (active and inactive — an inactive node renders muted in the tree, matching `ClubContact`/`Sponsor`'s existing "inactive stays visible" posture), flat, with `parentSectionId` |
| `POST /api/v1/manage/clubs/{clubId}/sections` | same | Creates a node. `{name, parentSectionId?, minAge?, maxAge?, gender?}` — `parentSectionId` omitted/null creates a root node |
| `PUT /api/v1/manage/clubs/{clubId}/sections/{sectionId}` | same | Updates `{name, minAge?, maxAge?, gender?}` — `parentSectionId` is not editable via this endpoint (see Non-goals on re-parenting) |
| `POST .../sections/{sectionId}/deactivate` | same | `409` if already inactive, or if any direct child is still active (see Data Model Changes). Otherwise: `200` + updated `SectionDto` if the section has any linked contact; `204` (hard-deleted) if it has zero children and zero linked contacts |
| `POST .../sections/{sectionId}/reactivate` | same | `409` if already active. `404` if the section was hard-deleted rather than deactivated — nothing left to reactivate |
| `GET .../sections/{sectionId}/contacts` | same | Lists the `ClubContact` records currently linked to this section |
| `POST .../sections/{sectionId}/contacts/{contactId}/link` | same | Links an existing `ClubContact` (must belong to the same `clubId`) to this section. `409` if already linked |
| `POST .../sections/{sectionId}/contacts/{contactId}/unlink` | same | Removes the link. `404` if no such link exists |

Every endpoint is scoped to `clubId` first (404 if `sectionId`/`contactId` is real but belongs to a different club), matching `020`'s established isolation posture. `sectionId` and `contactId` are independent children of the same `clubId` (unlike `024`'s sponsor→contact chain, `Section` and `ClubContact` are siblings under `Club`, not nested) — the link/unlink endpoints 404 if either id doesn't belong to the given `clubId`.

## UI Requirements

**The org-chart tree editor is genuinely new — flag for a Claude Design pass before build (`docs/workflow.md` Step 2), same precedent `021` followed for `ClubContactForm`.** Nothing in `components/**` today renders or edits a hierarchical structure; this is not a near-miss on an existing component.

- **`ui/src/components/SectionTreeEditor/`** (new, four-file anatomy) — the visual, editable org-chart. Renders the flat `Section[]` (plus `parentSectionId`) as a tree; supports add-child-under-any-node, inline rename, remove (calling deactivate, disabled/explained when a node has active children), and click-to-select (drives the detail panel below).
- **`ui/src/components/SectionTemplatePicker/`** (new, four-file anatomy) — shown in place of the tree editor when a club has zero sections. A small grid of a few named, described starter templates (see User Stories for the actual set), each rendered as a small static diagram reusing `SectionTreeEditor`'s own connector-line visual language at a smaller scale (so a template's shape is genuinely visible before picking it, not just described in prose), plus a "Use this template" action per card and a "start blank" action alongside them. Picking a template creates its nodes via the same ordinary `createSection` calls a manually-built tree would use — not a special server-side endpoint — so the admin can then edit exactly as if they'd built it by hand.
- **`ui/src/pages/manage/ClubStructure.tsx`** (rewritten from `006`'s `EmptyState` placeholder) — reads `clubId` from `ManagerHome`'s `Outlet` context (`020`), fetches the section list, renders `SectionTreeEditor`, and a detail panel (a `Card`- or `Drawer`-based panel — exact shape decided at plan/build time, not prescribed here) for the currently-selected node: an editable name field, the three eligibility fields (`min age`/`max age` numeric `Input`s, a `gender` `Select` with an explicit "not specified" option), and a linked-contacts section — a list of currently-linked `ClubContact`s with an unlink action, a searchable "link an existing contact" control (over `021`'s existing `listClubContacts`), and a "create a new contact" action that opens `021`'s existing `ClubContactForm` (reused as-is, in a dialog or inline) and links the result on save.
- **`ui/src/api/sectionApi.ts`** (new) — one file per backend resource per `docs/standards/frontend.md`, thin wrappers over the API Contract above.
- **`ui/src/pages/manage/ManagerDashboard.tsx`** — rename the existing card from `{ title: 'Sections & Age Groups', description: 'Set up age-group sections', to: '/manage/sections' }` to `{ title: 'Club Structure', description: "Define your club's own section tree", to: '/manage/sections' }` — route path unchanged, label/description only (`001`'s own established convention: the entity stays `Section` in code, user-facing copy says whatever fits the context).
- **`ui/src/App.tsx`** — the existing `sections` route's `element` changes from `<EmptyState title="Sections & Age Groups" ... />` to `<ClubStructure />`. No new route paths.

**Mobile-first**, per `docs/standards/frontend.md` — an org-chart is inherently a wide-content pattern, so `SectionTreeEditor` must scroll horizontally inside its own container at narrow widths (matching this repo's existing wide-content convention) rather than the page itself scrolling horizontally, and the detail panel must be reachable and usable at 375px (e.g. a full-width bottom sheet or stacked panel below the tree at `xs`, not squeezed side-by-side with it the way it might sit at `md+`).

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `SectionServiceImplTest` — create/update (including `minAge <= maxAge` validation), the deactivate-blocked-by-active-child rule and its distinct error from the already-inactive case, reactivate, link/unlink (including the already-linked `409` and cross-club rejection), cross-club `NotFoundException` isolation for both `sectionId` and `contactId`, **the remove-eligibility rule**: a childless/contactless node is actually deleted (row gone from the repository), a node with a linked contact is soft-deactivated instead, a node with an *inactive* child (not just an active one) is still soft-deactivated rather than deleted (would violate the FK) |
| Integration | `SectionRepositoryTest` (Testcontainers) — migration applies cleanly, the self-referential FK and the `section_contact` unique constraint behave correctly, and that deleting a `Section` still referenced by a child's `parent_section_id` genuinely fails at the DB level (proving the service-layer guard is backed by a real constraint, not just documented); `SectionControllerIntegrationTest` — real `CLUB_ADMIN` success across all eight endpoints for their own club, `403`/`404` for a different club, `platform_admin` superset success, the active-child deactivate-block proven through the real HTTP layer, and both remove outcomes proven through real HTTP (`200`+body for a section with a linked contact, `204`+no body for one with nothing attached) |
| Contract | New endpoints + `SectionDto`/`CreateSectionRequest`/`UpdateSectionRequest` documented in the checked-in OpenAPI schema |
| Component | `SectionTreeEditor.test.tsx` + Storybook story — renders a flat list as a tree, add-child/rename/remove interactions, remove is disabled (with an explanation) when a node has active children, click selects a node and surfaces it to the parent; `ClubStructure.test.tsx` — detail panel renders the right fields for a selected node, eligibility field round-trip, link/unlink/create-and-link contact flows |
| E2E | New golden path: open Club Structure, add a top-level node and a child under it, rename one, set eligibility on the leaf, link an existing `ClubContact`, create-and-link a new one, attempt to deactivate the parent (blocked, active child), deactivate the leaf, then successfully deactivate the parent, reload and confirm every change persisted. Not wired into CI, same precedent as every prior `/manage` spec |

## Acceptance Criteria

- A club admin can build a tree of arbitrary depth and branching for their club — no fixed level count, no fixed label vocabulary — through `/manage/sections`.
- Every node's label is freely editable at any time, including ones created from a starter template.
- A node with at least one active child cannot be removed at all; the UI explains why.
- A leaf node (no children at all, active or inactive) with zero linked contacts is permanently deleted when removed — it does not linger as an inactive placeholder, and there is no reactivate path for it afterward.
- A node with one or more linked contacts (leaf or not, once its active children are gone) is deactivated when removed, exactly as before, and can be reactivated later.
- Eligibility metadata (min age, max age, gender) is optional on every node independently — a node can have none, some, or all three set — and is never validated against a real person anywhere in this codebase.
- A `ClubContact` can be linked to more than one `Section`, and a `Section` can have more than one linked `ClubContact`; unlinking never deletes the underlying `ClubContact`.
- A club admin can create a brand-new `ClubContact` and have it linked to the section they were working on, without leaving the Club Structure screen.
- A club admin for club X gets `403`/`404` attempting to reach club Y's sections or link a contact across clubs.
- `ManagerDashboard`'s nav card reads "Club Structure," not "Sections & Age Groups," and routes to a real screen, not `EmptyState`.

## Rollout Notes

- Ships as its own PR, on top of `020`'s already-built `/api/v1/manage/**` namespace, `021`'s already-built `ClubContact`, and `006`'s existing `ManagerDashboard` card (renamed, not replaced).
- **This is `Section`'s first real implementation.** A human should add a footnote to `001-tenancy-identity-model.md`'s Field Reference table for the `Section` row, in the same style already used for `Person` (`014`) and `RoleAssignment` (`015`) — noting `min_age`/`max_age`/`gender`/`active` as additions beyond `001`'s original three-field sketch, and that `SECTION`-scope `RoleAssignment` resolution remains unwired (unchanged from `001`'s own note).
- **`Team` is the explicit next step**, once roster/registration management is scoped — future `Team` rows will FK to a leaf `Section` created by this spec. Not built here.
- **Eligibility-rule enforcement is explicitly future scope**, blocked on a player-registration spec existing at all — this spec only captures the data.
- A human should update `docs/roadmap.md`'s "Blocked on the full tenancy model" section once this ships: the `Section`-specific parts of that section are resolved; `Team` and `SECTION`-scoped `RoleAssignment` resolution remain blocked exactly as before.
- **Immediate next step before any code:** the Claude Design pass for `SectionTreeEditor` (`docs/workflow.md` Step 2) — this is the one component in this spec that doesn't compose from existing, already-styled primitives.
- **Refined a third time after initial implementation, before merge, on direct user feedback:** the tree and detail-panel cards now both stretch to the same full height rather than each sizing to its own content; the detail panel gained a "Clear" action to deselect without picking a different node; and the detail panel gained a collapse toggle — collapsing it reclaims its *width* for the tree on desktop (a fixed narrow rail, not a shrunken header bar — the point is to see more of the structure, not less of it), while on the stacked mobile layout it still collapses to a compact header only, since there's no spare width to reclaim there. Selecting any node always reopens the panel, overriding a prior manual collapse.
- **Refined a second time after initial implementation, before merge, on direct user feedback:** the original draft offered exactly one hardcoded starter template. A single one-size-fits-all shape doesn't reflect how differently clubs and schools actually organise themselves — a small set of named, previewed templates (traditional gender-split club, simpler no-gender-split club, adults-only club, school) lets an admin start from whichever is genuinely closest to their own structure, per the User Stories entry added for this. Starting blank remains an equally-valid option, unchanged.
- **Refined after initial implementation, before merge, on direct user feedback:** the original draft of this spec applied this codebase's blanket "disable, never delete" posture to `Section` unmodified. That turned out to be the wrong default specifically for a node with nothing attached to it — recreating an empty, contact-less, childless node costs nothing, so leaving a permanent inactive placeholder around for one is pure clutter, not data worth preserving. `Section` is now the first entity in this codebase to sometimes hard-delete; see Data Model Changes' Remove rule for the exact eligibility check (zero children at all, zero linked contacts) and the Non-goals entry for what still never gets hard-deleted (anything with linked contacts or child sections, active or inactive).
