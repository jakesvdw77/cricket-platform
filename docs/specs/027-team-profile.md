# 027 — Team Profile: Contacts, Logo & Sponsors

**Depends on:** `026-teams.md` (`Team` — the bare entity this spec extends, currently `id, club_id, section_id, name, active` + audit columns), `025-club-structure.md` (`SectionContact`'s join shape and "link existing / create-and-link / unlink, no create-and-link endpoint" architecture note, both mirrored here; `SectionDetailPanel`'s existing "Manage Teams" card and its own inline link-existing/create-and-link dialogs, both extended/refactored here; `ClubStructure.tsx`'s private `breadcrumbFor` helper, extracted here), `023-sponsors.md` (`Sponsor` — the entity this spec links to via a new join, and its `logo_url` nullable-column posture, the direct precedent for `Team.logo_url`), `021-club-contacts.md` (`ClubContact.role`'s free-text posture — the precedent for `TeamContact.role`; `POST /api/v1/manage/media`, reused unchanged for the new logo field), `012-club-profile.md` / `020-club-manager-access.md` (`ClubProfile.logoUrl` and the existing `getManagedClubProfile` call, reused as a team's logo fallback source).
**Status:** draft.

## Problem & Goals

`026` shipped `Team` deliberately bare — a name and a place in the `Section` tree, nothing else — because nothing beyond that had a real consumer yet. Using the shipped feature surfaced real gaps: a team has no way to record who runs it, no branding of its own, no sponsors distinct from the club's, and two screens now feel visibly incomplete — `SectionDetailPanel`'s "Manage Teams" card looks empty even once teams exist under it, and opening a specific team shows only its immediate section's name, not where it actually sits in a possibly-deep tree (e.g. "Juniors → Boys → O/15").

This spec is `026`'s named next step (`Team-level metadata beyond a name`, deferred there "until a spec actually needs them") — it gives `Team` real operational content, and closes the two UX gaps above.

**Goals**
- A club admin can link existing `ClubContact` records to a team with a team-specific role (e.g. the same person is Coach for the 1st XI and Manager for the 2nds) — with "Manager" / "Coach" / "Assistant Coach" offered as one-click quick-fill suggestions, never a closed set, and can create a brand-new `ClubContact` and link it in the same flow.
- A club admin can set a team-specific logo; until they do, the team's page shows the club's own logo as an unambiguous default, with a clear way to override it and a way to clear that override back to inheriting the club's.
- A club admin can link one or more of the club's existing `Sponsor` records (`023`) to a specific team — a team's own sponsor list, independent of but shown alongside the club's full sponsor list for context — and can create a brand-new `Sponsor` and link it in the same flow.
- `SectionDetailPanel`'s "Manage Teams" card shows the section's own teams as badges, so an admin can see what's already there without clicking through.
- Any screen that opens a specific team shows the full section-ancestry breadcrumb to it, not just its immediate parent's name.

## Non-goals

- **A structured `captain` field, or any field requiring a real roster.** `TeamRegistration`/`Season` still don't exist (`026`'s own Non-goals, unchanged). If an admin wants to record a captain today, `TeamContact.role` free text covers it (e.g. type "Captain") — no dedicated field, no player-linked concept.
- **Any other team metadata** — kit colour, home ground, short name/abbreviation. Still genuinely unrequested; add if a future spec actually needs them, matching `026`'s own deferral reasoning.
- **Editing a `TeamContact`/`TeamSponsor` link in place.** Changing a contact's role, once linked, means unlink then relink with the new role — there's no update endpoint for either join. `TeamSponsor` has nothing on it to edit beyond existence.
- **Cardinality limits on either join.** Any number of contacts/sponsors per team; the same `ClubContact`/`Sponsor` can be linked to any number of different teams — matching `SectionContact`'s already-established unbounded many-to-many posture.
- **Any change to `023`'s club-wide `Sponsor` list or its own screen.** This spec only adds a new way to link an existing `Sponsor` to a `Team` and a read-only display of the club's list on a team's page — `SponsorList`/`SponsorFormPage`/the `Sponsor` entity itself are untouched.
- **Ranking, ordering, or tiering of a team's sponsors.** Matches `023`'s own "no tiers/ranking" Non-goal.
- **Any public-facing display** of a team's logo, contacts, or sponsors (e.g. on a club's public page). `/manage`-side only, matching `023`'s identical Non-goal.
- **A `/platform` mirror.** Same established reasoning every spec since `020` has given — `canAdministerClub` already gives `platform_admin` a superset pass on `/manage/**`.
- **Hard-deleting anything new here beyond an unlink.** `TeamContact`/`TeamSponsor` unlink is a hard delete of the join row only (the underlying `ClubContact`/`Sponsor`/`Team` rows are untouched) — same "not a departure from disable-never-delete, a join row carries no independent business meaning" reasoning `025` already gave for `SectionContact`. `Team` itself keeps `026`'s existing deactivate/reactivate-only posture, unchanged.

## User Stories

- As a club admin, I open a team and see its linked contacts, each showing their name and team-specific role.
- As a club admin, I can link an existing club contact to a team, with "Manager" / "Coach" / "Assistant Coach" available as one-click role suggestions, or my own free-text role instead.
- As a club admin, I can create a brand-new contact and have it linked to the team I'm working on, without leaving the team's page.
- As a club admin, I can unlink a contact from a team without deleting the underlying `ClubContact` record — it stays available to link elsewhere.
- As a club admin, I can upload a logo for a specific team; until I do, the team's page clearly shows my club's own logo as the default.
- As a club admin, I can clear a team's logo override and go back to inheriting the club's logo.
- As a club admin, I can link one of my club's existing sponsors to a team, or create a brand-new sponsor and link it in the same flow.
- As a club admin, I see my club's other sponsors listed (read-only) alongside a team's own linked sponsors, so I know what's already available without leaving the team's page or double-adding one.
- As a club admin, I can unlink a sponsor from a team without deleting the underlying `Sponsor` record.
- As a club admin, when I select a section that already has teams under it, I see their names as badges on the "Manage Teams" card, without clicking through to find out.
- As a club admin opening a specific team, I see the full path to it (e.g. "Juniors › Boys › O/15"), not just its immediate section's name.

## Data Model Changes

**`Team` gains one field:**

```
Team {
    ...                  -- unchanged fields from 026
    string    logo_url   -- nullable; same posture as Sponsor.logo_url/ClubProfile.logo_url —
                          -- captured, no format validation. Resolution (fall back to the club's
                          -- own logo when null) is a UI-layer concern, not computed server-side —
                          -- see UI Requirements.
}
```

**New entity — `TeamContact`**, a many-to-many join between `Team` and `021`'s existing `ClubContact` — mirrors `025`'s `SectionContact` shape with one deliberate addition: a `role` column, because the same person can hold a different role on different teams (Coach for the 1st XI, Manager for the 2nds) in a way that isn't true of a `ClubContact`'s own club-wide `role` field:

```
TeamContact {
    uuid      id                -- PK, generated
    uuid      team_id           -- FK to team.id, not null
    uuid      club_contact_id   -- FK to club_contact.id, not null
    string    role              -- free text, not null — e.g. "Coach"; the UI suggests "Manager" /
                                 -- "Coach" / "Assistant Coach" as quick-fill, never a closed set,
                                 -- same free-text posture as ClubContact.role itself
    timestamp created_at
    uuid      created_by
}
```

Unique on `(team_id, club_contact_id)` — matches `SectionContact`'s existing unique-pair constraint; the same contact can hold only one role per team (changing it is unlink-then-relink, per Non-goals), but can be linked to any number of different teams.

**New entity — `TeamSponsor`**, a many-to-many join between `Team` and `023`'s existing `Sponsor` — bare join, no role/no active flag, mirroring `SectionContact` exactly:

```
TeamSponsor {
    uuid      id           -- PK, generated
    uuid      team_id      -- FK to team.id, not null
    uuid      sponsor_id   -- FK to sponsor.id, not null
    timestamp created_at
    uuid      created_by
}
```

Unique on `(team_id, sponsor_id)`.

**Migration** (next sequential file after `026`'s `018-add-team.sql`):

```sql
-- backend/src/main/resources/db/changelog/v1/019-add-team-profile.sql
ALTER TABLE team ADD COLUMN logo_url VARCHAR(512);

CREATE TABLE team_contact (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id          UUID NOT NULL REFERENCES team(id),
    club_contact_id  UUID NOT NULL REFERENCES club_contact(id),
    role             VARCHAR(128) NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by       UUID,
    UNIQUE (team_id, club_contact_id)
);

CREATE INDEX ix_team_contact_team ON team_contact(team_id);
CREATE INDEX ix_team_contact_contact ON team_contact(club_contact_id);

CREATE TABLE team_sponsor (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID NOT NULL REFERENCES team(id),
    sponsor_id  UUID NOT NULL REFERENCES sponsor(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID,
    UNIQUE (team_id, sponsor_id)
);

CREATE INDEX ix_team_sponsor_team ON team_sponsor(team_id);
CREATE INDEX ix_team_sponsor_sponsor ON team_sponsor(sponsor_id);
```

## API Contract

**Architecture note — no new create-and-link endpoint, for either join.** Same reasoning `025` already established for `Section`↔`ClubContact`: the UI composes an ordinary create call (`021`'s existing `POST /api/v1/manage/clubs/{clubId}/contacts`, or `023`'s existing `POST /api/v1/manage/clubs/{clubId}/sponsors`) followed by this spec's own link endpoint below.

**Architecture note — the club's own sponsor list needs no new endpoint.** The "club sponsors, shown read-only alongside a team's own" requirement (Goals) is served entirely by `023`'s existing `GET /api/v1/manage/clubs/{clubId}/sponsors` — the UI fetches both lists and filters, see UI Requirements.

| Endpoint | Access | Purpose |
|---|---|---|
| `POST /api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams` | same | **Extends `026`'s existing endpoint** — request body grows to `{name, logoUrl?}`, matching `TeamForm`'s own create-mode logo field (UI Requirements) — the same "no persisted id needed to upload" precedent `ClubContactForm`'s photo-on-create already established |
| `PUT /api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}` | `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")` | **Extends `026`'s existing endpoint** — request body grows to `{name, logoUrl?}`. `logoUrl` omitted or `null` clears any override, falling back to inheriting the club's logo (a UI-layer resolution, not a stored "inherited" state) |
| `GET .../teams/{teamId}/contacts` | same | Lists this team's linked `ClubContact` records, each with its `role` |
| `POST .../teams/{teamId}/contacts/{contactId}/link` | same | Body `{role}`. Links an existing `ClubContact` (must belong to the same `clubId`) with the given role. `409` if already linked |
| `POST .../teams/{teamId}/contacts/{contactId}/unlink` | same | Removes the link. `404` if no such link exists |
| `GET .../teams/{teamId}/sponsors` | same | Lists this team's linked `Sponsor` records |
| `POST .../teams/{teamId}/sponsors/{sponsorId}/link` | same | Links an existing `Sponsor` (must belong to the same `clubId`). `409` if already linked |
| `POST .../teams/{teamId}/sponsors/{sponsorId}/unlink` | same | Removes the link. `404` if no such link exists |

Every endpoint is scoped to `clubId` → `sectionId` → `teamId` exactly as `026` already established (404 at each level for a mismatch). `contactId`/`sponsorId` are independent siblings of `teamId` under the same `clubId` (same "siblings under `Club`, not nested" relationship `025` already noted for `Section`/`ClubContact`) — the link/unlink endpoints 404 if either doesn't belong to the given `clubId`.

## UI Requirements

**Where this lives — `TeamFormPage.tsx`'s existing edit mode, not a new page.** Contacts, sponsors, and the breadcrumb all need a real, persisted `teamId` to attach to or resolve — exactly the same constraint `025` already designed around for `SectionDetailPanel`'s own contact-linking (only available once a real node is selected). `TeamFormPage.tsx` already has a clean create-vs-edit split (`026`); this spec adds new sections to its edit-mode render only, so "opening a team" is one screen showing everything — breadcrumb, name, logo, contacts, sponsors — rather than another cross-link hop to a separate page. Logo is the one exception: it's captured on the create form too, since uploading via `MediaUpload` never needed a persisted id in the first place (`ClubContactForm`'s own photo field already works this way on create).

**Layout — Details/Contacts/Sponsors are tabs on one screen, not stacked vertically.** Refined after initial implementation, before merge, on direct user feedback: the first version stacked the `TeamForm` fields, a Contacts card, and a Sponsors card vertically, which read as an unusually long, scroll-heavy page compared to every other multi-concern form in this codebase. `SponsorForm` (`023`) already establishes the pattern for exactly this shape of problem — MUI `Tabs` switching between concern groups within one screen — so `TeamFormPage` (edit mode only; a brand-new team has nothing yet to show a Contacts/Sponsors tab for) adopts the same pattern at the page level: a "Details" tab (the `TeamForm` fields), a "Contacts" tab, and a "Sponsors" tab, one panel visible at a time. The Save action only shows while "Details" is active — Contacts/Sponsors changes persist immediately through their own link/unlink mutations, so there's nothing for a page-level Save to do on those tabs.

- **`ui/src/utils/sectionBreadcrumb.ts`** (new) — `breadcrumbFor(section, sectionsById)` extracted verbatim from `ClubStructure.tsx`'s current private helper (same function, same signature, just moved so it has one implementation instead of becoming two once Team screens need it too — `docs/standards/frontend.md`'s reuse rule). `ClubStructure.tsx` imports it instead of defining it locally; behavior is unchanged there.
- **`ui/src/pages/manage/TeamList.tsx`** (edit, existing) — its current single-section-name header is replaced with the full breadcrumb chain, via the extracted utility (it already fetches `listSections(clubId)`).
- **`ui/src/pages/manage/TeamFormPage.tsx`** (edit, existing) — gains the same breadcrumb near the top (using `sections`, already fetched or fetchable the same way `TeamList.tsx` does), plus, in edit mode only, two new inline sections below the form:
  - **Contacts** — mirrors `SectionDetailPanel`'s existing "Linked contacts" block (avatar, name, role, unlink) with one addition: the link-existing flow's dialog includes a `role` `Input` with three `Chip`/`Button`-style quick-fill options ("Manager", "Coach", "Assistant Coach") that populate it — clicking one doesn't submit, it just fills the field, so the admin can still edit it before confirming. "Link existing" and "+ New contact" actions, same as `SectionDetailPanel`.
  - **Sponsors** — two labeled groups on one screen: **"This team's sponsors"** (editable — link existing `Sponsor` / create-and-link a new one via `023`'s existing `SponsorForm` / unlink) and **"Club sponsors"** (read-only list from `023`'s existing `listSponsors(clubId)`, filtered to exclude any `Sponsor` already present in the team's own linked list, so nothing is shown twice).
- **`ui/src/components/TeamForm/TeamForm.tsx`** (edit, existing) — gains an optional logo field (`MediaUpload namespace="manage" variant="logo"`, same as every other logo field in this codebase) in both create and edit modes. A new optional prop, `clubLogoUrl?: string` (passed down from `TeamFormPage`, which resolves it via `020`'s existing `getManagedClubProfile` call), drives a caption/preview shown whenever the team has no logo of its own ("Using your club's logo — upload one to override"), and a "Reset to club logo" action clears an existing override back to `null`.
- **Extracting the shared link dialogs — a real, explicit decision, not assumed either way.** `ClubStructure.tsx` today implements its own "link existing" (`Autocomplete` + `Dialog`) and "create and link" (a `Dialog` wrapping `ClubContactForm`) flows inline, for `Section`↔`ClubContact` only. This spec needs the same two *shapes* twice more — `Team`↔`ClubContact` (with an extra `role` field mid-flow) and `Team`↔`Sponsor` (wrapping `SponsorForm` instead of `ClubContactForm`, no extra field). Three near-identical inline implementations of the same interaction crosses `docs/standards/frontend.md`'s reuse threshold on its own terms — this spec extracts two new shared components instead of writing a third bespoke pair:
  - **`ui/src/components/LinkExistingRecordDialog/`** (new, four-file anatomy) — a searchable `Autocomplete`-over-candidates dialog, generic over the linked record type via props (candidate list, already-linked-id exclusion, label/search-field getter, an optional extra-field slot used only by the Team↔Contact flow for `role`), confirming calls a passed-in `onLink`.
  - **`ui/src/components/CreateAndLinkRecordDialog/`** (new, four-file anatomy) — a `Dialog` wrapping an arbitrary create-form component (`ClubContactForm` or `SponsorForm`, passed as a prop) and linking the created record on save.
  - `ClubStructure.tsx`'s existing `Section`↔`ClubContact` dialogs are refactored onto these two shared components rather than left as a third, divergent implementation — its own behavior must not regress (see Test Plan).
- **`ui/src/components/SectionDetailPanel/SectionDetailPanel.tsx`** (edit, existing) — gains a new `teams: Team[]` prop (fetched by `ClubStructure.tsx` via `026`'s existing `listTeamsForSection(clubId, sectionId)`, the same place section/contact data is already fetched for the selected node) and renders each as a small `Chip` inside the existing "Manage Teams" `Card` — active teams in the normal tone, inactive ones muted (matching `RecordCard`'s existing inactive-badge convention elsewhere). No chips (or a small "No teams yet" caption) when the section has none.
- **`ui/src/pages/manage/TeamDirectory.tsx`** (edit, existing) — its per-card "Section" field switches from the immediate section name to the full breadcrumb chain, via the same extracted utility — same underlying data, a low-cost consistency win alongside the two screens above rather than new requested scope.
- **`ui/src/api/teamContactApi.ts`** and **`ui/src/api/teamSponsorApi.ts`** (new) — one file per backend resource per `docs/standards/frontend.md`, thin wrappers over the new endpoints above.

**No Claude Design pass needed.** Every visual element here — cards, chips, avatars, dialogs, an `Autocomplete`, `MediaUpload` — is an already-styled primitive or a generalization of `025`'s already-shipped, already-designed contact-linking pattern; the quick-fill role buttons are three small `Button`s next to an `Input`, not a new visual language. Contrast with `025`'s tree editor, which genuinely had no existing precedent to generalize from.

**Mobile-first**, same responsive rules every prior `/manage` list/detail screen has already established — no new pattern to design.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `TeamServiceImplTest` extended — updating `logoUrl` (set, clear back to `null`); new `TeamContactServiceImplTest`/`TeamSponsorServiceImplTest` — link/unlink, the already-linked `409`, cross-club rejection for both `contactId`/`sponsorId`, mirroring `SectionServiceImplTest`'s existing link/unlink coverage |
| Integration | `TeamRepositoryTest` extended for the new column; new `TeamContactRepositoryTest`/`TeamSponsorRepositoryTest` (Testcontainers) — migration applies cleanly, both unique constraints behave; `TeamControllerIntegrationTest` extended for `logoUrl` in the update endpoint; new controller integration tests for all six new endpoints — real `CLUB_ADMIN` success, cross-club `403`/`404`, `platform_admin` superset, the already-linked `409` and no-such-link `404` through real HTTP |
| Contract | New endpoints + `TeamContactDto`/`TeamSponsorDto` + `TeamDto`'s `logoUrl` addition documented in the checked-in OpenAPI schema |
| Component | `sectionBreadcrumb.test.ts` (new, pure function); `LinkExistingRecordDialog`/`CreateAndLinkRecordDialog` — new component tests + Storybook stories, generic behavior plus the Team↔Contact extra-role-field case; `TeamForm.test.tsx` extended — logo field wiring, club-logo fallback caption, reset-to-club-logo action; `TeamFormPage.test.tsx` extended — contacts/sponsors sections render in edit mode only, club-sponsors list correctly excludes already-linked ones; `SectionDetailPanel.test.tsx` extended — team badges render, muted for inactive; `ClubStructure.test.tsx` — existing Section↔Contact link/create-and-link/unlink tests still pass unchanged after the dialog extraction (a real regression check, not just new coverage) |
| E2E | Extends `manager-teams.spec.ts`'s existing golden path: open a team, link an existing contact using the "Coach" quick-fill, create-and-link a new contact, unlink one, upload a logo override then reset it back to the club's, link an existing sponsor, create-and-link a new one, confirm the club's other sponsors show read-only and exclude anything already linked, confirm the section card shows the right team badges, confirm the breadcrumb shows the full path. Not wired into CI, same precedent as every prior `/manage` spec |

## Acceptance Criteria

- A club admin can link an existing `ClubContact` to a team with a free-text role, using a quick-fill suggestion or their own text, and can create-and-link a new contact in the same flow.
- Unlinking a team contact never deletes the underlying `ClubContact`; the same contact can be linked to more than one team, each with its own role.
- A team with no logo of its own visibly shows the club's logo as its default; setting a team logo overrides it; clearing the override goes back to the club's.
- A club admin can link an existing `Sponsor` to a team, or create-and-link a new one; a team's own sponsors and the club's full sponsor list are both visible on the team's page, with no sponsor shown twice.
- Unlinking a team sponsor never deletes the underlying `Sponsor`.
- `SectionDetailPanel`'s "Manage Teams" card shows a badge per team currently under that section, muted for inactive ones.
- Opening any specific team shows its full section-ancestry breadcrumb, not just its immediate parent's name.
- `ClubStructure.tsx`'s existing Section↔Contact link/create-and-link/unlink behavior is unchanged after being refactored onto the new shared dialog components.
- A club admin for club X gets `403`/`404` attempting any of the six new endpoints against club Y's id, or against a `contactId`/`sponsorId` that isn't theirs.

## Rollout Notes

- Ships as its own PR, on top of `026`'s already-built `Team` and `025`'s already-built `Section`/`SectionContact`/`SectionDetailPanel`.
- **The `LinkExistingRecordDialog`/`CreateAndLinkRecordDialog` extraction is a refactor of already-shipped, already-tested behavior, not just new scope** — `ClubStructure.tsx`'s Section↔Contact flows must be re-verified to behave identically afterward, not just newly covered (see Test Plan's explicit regression note).
- **Kit colour, home ground, and short name/abbreviation remain deferred**, exactly as `026` first named them — still no real consumer; add them if a future spec actually needs them.
- **`captain` remains unbuilt as a structured field**, blocked on `TeamRegistration`/`Season` (`026`'s own Non-goals, unchanged) — `TeamContact.role` free text is the answer for now if an admin wants to record one informally.
- **Refined after initial implementation, before merge, on direct user feedback:** the original build stacked `TeamForm`/Contacts/Sponsors vertically on `TeamFormPage`, which looked like an outlier next to `SponsorForm`'s existing tabbed layout and required far more scrolling than any other `/manage` screen. Reworked onto MUI `Tabs` (Details/Contacts/Sponsors) at the page level instead — see UI Requirements' new "Layout" note. `TeamFormPage.test.tsx` and `ui/e2e/manager-teams.spec.ts` were both updated to switch tabs before asserting on Contacts/Sponsors content, and gained a dedicated test proving the tab panels are mutually exclusive and that Save only shows on Details.
- **Refined a second time after initial implementation, before merge, on direct user feedback:** the tabbed layout above still showed a linked contact/sponsor as a bare name with no way to see its details or reach its real edit screen — a second, related complaint about the same tab-based screen. Reworked both the Contacts and Sponsors tab panels onto `RecordCard` (the same card every other `/manage` list in this codebase already uses), each with `editTo` pointing at the actual `ClubContactFormPage`/`SponsorFormPage` edit route (`021`/`023`) and `fields` showing key details (team-specific role/email/phone for a contact; website/email/phone for a sponsor) — matching `ClubContactList.tsx`/`SponsorList.tsx`'s own card shape exactly, including per-card unlink mutations so one card's pending state never leaks onto another's. `SponsorList.tsx`'s field-building logic was extracted to a new shared `ui/src/utils/sponsorRecordFields.ts` (it was about to be duplicated a second time) rather than exported straight from that page component, which would have broken React Fast Refresh there.
- **A real bug caught only by a live smoke test against real Postgres, not by any automated test:** `TeamSponsorServiceImpl.list()` (and, defensively, `TeamContactServiceImpl.list()`) were missing `@Transactional(readOnly = true)`, so `GET .../teams/{teamId}/sponsors` threw `LazyInitializationException` on `Sponsor.socialLinks` against the real `spring.jpa.open-in-view=false` server — a 500 on what looked like a working `GET`. `TeamControllerIntegrationTest`'s own class-level `@Transactional` masked this in the automated suite (it keeps one Hibernate session open across the whole simulated request). Fixed, re-verified live, and captured as a durable rule in `docs/standards/backend.md` — this exact bug shape has now hit this codebase three times (`ClubProfileServiceImpl`, `SponsorServiceImpl`, this spec).
