# Plan — 027: Team Profile (Contacts, Logo & Sponsors)

## Context

`026-teams.md` shipped `Team` deliberately bare (`id, club_id, section_id, name, active`). `docs/specs/027-team-profile.md` (already drafted and read in full this session) extends it with real operational content: team-specific contacts (linked to existing `ClubContact` rows, with a team-specific role), a team logo that falls back to the club's own, team sponsors (linked to existing `Sponsor` rows, shown alongside the club's own read-only), badges on `SectionDetailPanel`'s "Manage Teams" card, and a full section-ancestry breadcrumb wherever a team is opened.

Two research passes against the real, already-shipped code (`026`'s `Team`, `025`'s `SectionContact`, `023`'s `Sponsor`) surfaced a few things worth deciding explicitly before building, laid out below.

## Flags for review — real decisions made during planning, not assumed

1. **`CreateTeamRequest` needs an optional `logoUrl` too, not just `UpdateTeamRequest`.** The spec's API Contract table only explicitly grows the `PUT` endpoint's body, but its own Goals/UI Requirements are explicit that `TeamForm`'s logo field applies "in both create and edit modes" (matching `ClubContactForm`'s existing photo-on-create precedent). Resolving this as: `CreateTeamRequest` also gains an optional `logoUrl`. This is filling a gap consistent with the spec's own stated intent, not a redefinition — flagging it here rather than silently doing it.
2. **Service class shape:** `SectionContact`'s link/unlink logic today lives *inside* `SectionServiceImpl` (no separate service class), but `027`'s own Test Plan explicitly names standalone `TeamContactServiceImplTest`/`TeamSponsorServiceImplTest` files. Building `TeamContact`/`TeamSponsor` as two genuinely separate service interfaces/impls (`TeamContactService`/`TeamContactServiceImpl`, `TeamSponsorService`/`TeamSponsorServiceImpl`), each doing its own `clubId → sectionId → teamId` scoping chain (reusing `SectionRepository`/`TeamRepository` the same way `TeamServiceImpl` already does) — matches the spec's explicit file naming and keeps `TeamServiceImpl` from growing unboundedly. **Controller stays unified**: all six new endpoints land on the existing `TeamController` (matching `SectionController`'s precedent of hosting a join's endpoints alongside its parent's, and matching the spec's own Test Plan which extends `TeamControllerIntegrationTest` rather than naming new controller test files) — `TeamController` just injects two more service interfaces.
3. **`TeamContact`'s link dialog needs an explicit confirm step; `Section`'s and `TeamSponsor`'s don't.** `ClubStructure.tsx`'s current "link existing contact" dialog auto-links the instant an `Autocomplete` option is selected (no confirm button) — fine when there's nothing else to capture. `TeamContact` also needs a `role` captured at link time, so its dialog can't auto-submit on selection; it needs to hold the selection locally, show the role field (with quick-fill), and only link on an explicit "Link" click. The shared `LinkExistingRecordDialog` (below) supports both modes: no `extraField` prop → today's exact auto-submit-on-select behavior (used by `Section`↔`Contact`, unchanged, and by `Team`↔`Sponsor`); `extraField` prop present → hold-then-confirm (used only by `Team`↔`Contact`).

## Backend (`backend-builder`)

Mirrors `SectionServiceImpl`'s link/unlink idiom exactly (`findOrThrowForClub` on the parent scope first, then an independent `findOrThrowXForClub` on the sibling being linked — order matters, a cross-club parent must 404 without ever querying the sibling) and `SponsorServiceImpl`'s `findOrThrowForClub` shape for `Sponsor` lookups.

**Extend existing 026 files:**
- `domain/Team.java` — add `@Column(name = "logo_url") private String logoUrl;` (nullable, no format validation — exact `Sponsor.logoUrl` posture).
- `dto/TeamDto.java` — add `String logoUrl`.
- `dto/CreateTeamRequest.java` / `dto/UpdateTeamRequest.java` — both add optional `String logoUrl` (see Flag #1).
- `mapper/TeamMapper.java` — map the new field (MapStruct, automatic once the DTO/entity fields match by name).
- `service/impl/TeamServiceImpl.java` — `create`/`update` set `team.setLogoUrl(request.logoUrl())`; `null`/omitted clears an override with no special-case logic needed.
- `controller/TeamController.java` — grows six new endpoints (below), injecting the two new service interfaces alongside the existing `TeamService`.

**New files:**
- `domain/TeamContact.java` — `id, teamId, clubContactId, role (not-null), createdAt, createdBy` (mirrors `SectionContact.java`'s shape plus the one extra `role` column; `createdBy` stays unset, matching `SectionContact`'s own — no `AuditorAware` exists anywhere in this codebase).
- `domain/TeamSponsor.java` — `id, teamId, sponsorId, createdAt, createdBy` (bare join, mirrors `SectionContact.java` exactly).
- `repository/TeamContactRepository.java` — `findByTeamId`, `existsByTeamIdAndClubContactId`, `findByTeamIdAndClubContactId`, `deleteByTeamIdAndClubContactId` (same method shape as `SectionContactRepository`).
- `repository/TeamSponsorRepository.java` — same shape, `findByTeamId`/`existsByTeamIdAndSponsorId`/`findByTeamIdAndSponsorId`/`deleteByTeamIdAndSponsorId`.
- `dto/TeamContactDto.java` — `record TeamContactDto(UUID id, ClubContactDto contact, String role, Instant createdAt)` — unlike `SectionContact` (whose list endpoint returns bare `List<ClubContactDto>`, nothing extra to carry), `TeamContact` has its own `role` to surface, so it needs this small wrapper record. `TeamSponsor`'s list endpoint needs no equivalent wrapper — it returns `List<SponsorDto>` directly, exactly like `SectionContact`'s pattern, since there's no extra join data.
- `dto/LinkTeamContactRequest.java` — `record LinkTeamContactRequest(@NotBlank String role)` — the one body `TeamContact`'s link endpoint needs that `SectionContact`'s/`TeamSponsor`'s bare link endpoints don't.
- `service/TeamContactService.java` + `service/impl/TeamContactServiceImpl.java` — `list(clubId, sectionId, teamId)`, `link(clubId, sectionId, teamId, contactId, role)`, `unlink(clubId, sectionId, teamId, contactId)`. Scoping chain: `findSectionOrThrowForClub` → `findTeamOrThrowForSection` (both already exist as private helpers in `TeamServiceImpl` — either duplicate the two small checks here or extract them to a small shared helper if the duplication bothers you at build time; either is fine, not worth a plan-level decision) → then independently validate `contactId` belongs to `clubId` (mirrors `SectionServiceImpl.findOrThrowContactForClub` verbatim). `link` throws `ConflictException` if already linked (mirrors `SectionServiceImpl.link`'s exact message shape); `unlink` throws `NotFoundException` if no such link.
- `service/TeamSponsorService.java` + `service/impl/TeamSponsorServiceImpl.java` — same shape, validating `sponsorId` against `clubId` via `SponsorRepository` (mirrors `SponsorServiceImpl.findOrThrowForClub`).
- `mapper/TeamContactMapper.java` — maps a `TeamContact` + its resolved `ClubContact` into `TeamContactDto` (small, likely hand-written rather than pure MapStruct given the composition — follow whichever this codebase's existing composed-DTO mappers already do, e.g. check how `SectionServiceImpl.listContacts` itself does the `.map(link -> ...).map(clubContactMapper::toDto)` composition and mirror that instead of forcing MapStruct to do a join).
- **`controller/TeamController.java`** — six new endpoints, all `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")`:

  | Endpoint | Purpose |
  |---|---|
  | `GET .../teams/{teamId}/contacts` | `List<TeamContactDto>` |
  | `POST .../teams/{teamId}/contacts/{contactId}/link` | body `{role}`, `409` if already linked |
  | `POST .../teams/{teamId}/contacts/{contactId}/unlink` | `404` if no such link |
  | `GET .../teams/{teamId}/sponsors` | `List<SponsorDto>` |
  | `POST .../teams/{teamId}/sponsors/{sponsorId}/link` | no body, `409` if already linked |
  | `POST .../teams/{teamId}/sponsors/{sponsorId}/unlink` | `404` if no such link |

- **`backend/src/main/resources/db/changelog/v1/019-add-team-profile.sql`** — exact SQL already written in `docs/specs/027-team-profile.md`'s Data Model Changes (adds `team.logo_url`, creates `team_contact` and `team_sponsor` with their unique constraints + indexes). Add its `<include>` to `db.changelog-master.xml` after `018-add-team.sql`'s.
- **`backend/openapi/openapi.yaml`** — splice in the six new paths + `TeamContactDto`/`LinkTeamContactRequest` schemas + `TeamDto`/`CreateTeamRequest`/`UpdateTeamRequest`'s `logoUrl` addition, same run-the-app-and-diff process every prior spec used.

**Tests:**
- `service/TeamServiceImplTest.java` (extend) — `logoUrl` round-trips on create/update, including explicit clear-to-`null`.
- `service/TeamContactServiceImplTest.java` / `service/TeamSponsorServiceImplTest.java` (new) — link/unlink, already-linked `409`, not-linked `404`, cross-club rejection for the sibling id *and* for the section/team scope (mirroring `SectionServiceImplTest`'s exact link/unlink block, including the "parent check fails before the sibling is ever queried" case), a contact/sponsor linkable to more than one team.
- `repository/TeamContactRepositoryTest.java` / `repository/TeamSponsorRepositoryTest.java` (new, Testcontainers) — migration applies cleanly, both unique constraints reject a duplicate pair at the DB level.
- `controller/TeamControllerIntegrationTest.java` (extend) — `logoUrl` through the real `PUT`; all six new endpoints: real `CLUB_ADMIN` success, cross-club `403`/`404`, `platform_admin` superset, the `409`/`404` cases through real HTTP.
- Contract: new schemas/endpoints in the checked-in OpenAPI file.

## Frontend (`frontend-builder`, after backend)

**Extract the shared breadcrumb utility first (small, everything else composes on it):**
- `ui/src/utils/sectionBreadcrumb.ts` (new) — `breadcrumbFor(section, sectionsById)`, moved verbatim from `ClubStructure.tsx`'s current private function (lines ~120–130). `ClubStructure.tsx` imports it instead of defining it locally — no behavior change there.
- `ui/src/pages/manage/TeamList.tsx` — already fetches `listSections(clubId)` to resolve its current section's name; build a `sectionsById` `Map` from that same data and replace the `Teams — {section.name}` header with the full breadcrumb chain via `breadcrumbFor`.
- `ui/src/pages/manage/TeamFormPage.tsx` — its `sections` query currently only runs when `!isSectionScoped` (club-wide create, for the section picker); change its `enabled` to `Boolean(clubId)` unconditionally so it's also available for the breadcrumb in every mode (section-scoped create/edit too) — one query now serving two purposes instead of needing a second one. Render the breadcrumb near the top, for the section the team belongs to (route `sectionId`, or the freshly-created team's `sectionId` for club-wide create).
- `ui/src/pages/manage/TeamDirectory.tsx` — already fetches `listSections(clubId)` for its `sectionNamesById` map; build the same `sectionsById` shape and replace each card's immediate-name `fields` entry with the full breadcrumb chain via the same utility.

**Extract the two shared link dialogs from `ClubStructure.tsx` (needed by Team↔Contact and Team↔Sponsor; `Section`↔`Contact` migrates onto them too — must not regress, see Flag #3):**
- `ui/src/components/LinkExistingRecordDialog/` (new, four-file anatomy) — generic `Autocomplete`-over-candidates dialog. Props: `open`, `onClose`, `title`, `candidates: T[]` (caller pre-filters out already-linked), `loading?`, `getOptionLabel`, `isOptionEqualToValue?`, `searchLabel?`/`searchPlaceholder?`, `onLink: (option: T, extraValue?: string) => void`. An optional `extraField` slot (label + quick-fill option strings, e.g. `['Manager', 'Coach', 'Assistant Coach']`) switches the dialog from today's auto-link-on-select behavior to select-then-confirm (a "Link" button in `DialogActions`, disabled until both a selection and a non-empty extra value exist) — see Flag #3 for why. Built directly from `ClubStructure.tsx`'s current `Autocomplete`/`Dialog` JSX (lines ~461–498), generalized.
- `ui/src/components/CreateAndLinkRecordDialog/` (new, four-file anatomy) — generic `Dialog` wrapping an arbitrary create-form component. Props: `open`, `onClose`, `title`, `formId` (the target form's exported `*_FORM_ID` constant — `ClubContactForm`/`SponsorForm` both already export one, both already take only `{initialValues?, onSubmit}` with no `clubId` prop, confirmed drop-in fits), `renderForm: (onSubmit) => ReactNode`, `onCreateAndLink`, `isPending`/`isError`/`errorMessage`, optional `confirmLabel`/`pendingLabel` (default "Create & link"/"Creating…"). Built directly from `ClubStructure.tsx`'s current create-dialog JSX (lines ~500–520). Same optional extra-field affordance as `LinkExistingRecordDialog`, for `Team`↔`Contact`'s create-and-link flow (a new `ClubContact` still needs a team-specific `role` captured alongside it — that's separate from `ClubContactForm`'s own club-wide `role` field).
- `ui/src/pages/manage/ClubStructure.tsx` — its existing Section↔Contact `linkDialogOpen`/`createDialogOpen` JSX is replaced with `<LinkExistingRecordDialog ... />`/`<CreateAndLinkRecordDialog ... />`, wired to the exact same `linkMutation`/`unlinkMutation`/`createAndLinkMutation`/`allContactsQuery` already there — no `extraField` passed, so behavior is byte-for-byte the same as today (this is the regression surface Flag #3 and the Test Plan call out explicitly).

**Team's own new content:**
- `ui/src/components/TeamForm/TeamForm.tsx` — `TeamFormValues` gains `logoUrl?: string | null`; new optional `clubLogoUrl?: string | null` prop (passed by `TeamFormPage`, resolved via `020`'s existing `getManagedClubProfile`). Renders `MediaUpload label="Logo" value={logoUrl} onUploaded={...} variant="logo" namespace="manage"` (exact props `ClubContactForm`'s photo field already uses) in both create and edit — matching Flag #1. When `!logoUrl && clubLogoUrl`, shows a small caption/preview ("Using your club's logo") using `clubLogoUrl`; when a team override is set, a "Reset to club logo" action clears it back to `null`.
- `ui/src/pages/manage/TeamFormPage.tsx` — new `useQuery` for `getManagedClubProfile(clubId)` (feeds `TeamForm`'s `clubLogoUrl`); `saveMutation`'s create/update payloads widen to include `logoUrl`. In edit mode only (mirrors `SectionDetailPanel`'s own "only once a real node/team exists" precedent), renders two new sections below the form:
  - **Contacts** — mirrors `SectionDetailPanel`'s existing "Linked contacts" block (avatar, name, role, unlink) verbatim in structure, backed by new `listTeamContacts`/`linkTeamContact`/`unlinkTeamContact` queries/mutations (`ui/src/api/teamContactApi.ts`, new) and the two dialogs above (`LinkExistingRecordDialog` with the `extraField` role slot; `CreateAndLinkRecordDialog` wrapping `ClubContactForm` with the same extra role slot).
  - **Sponsors** — two labeled groups: "This team's sponsors" (editable, same two dialogs, no extra field, wrapping `SponsorForm`, backed by new `listTeamSponsors`/`linkTeamSponsor`/`unlinkTeamSponsor` — `ui/src/api/teamSponsorApi.ts`, new) and "Club sponsors" (read-only — the existing `listSponsors(clubId)` call, `023`, filtered to exclude any `id` already present in the team's own sponsor list).
- `ui/src/components/SectionDetailPanel/SectionDetailPanel.tsx` — new `teams: Team[]` prop; inside the existing "Manage Teams" `Card`, a `Stack direction="row" flexWrap="wrap"` of `Chip`s (one per team) — active teams a plain filled `Chip`, inactive teams using `RecordCard`'s exact muted-tone `sx` (`alpha(theme.palette.text.secondary, 0.12)` background, `text.secondary` color, `0.7` opacity) since `SectionDetailPanel` doesn't use `RecordCard` itself. A small "No teams yet" caption when empty.
- `ui/src/pages/manage/ClubStructure.tsx` — new `listTeamsForSection(clubId, selectedId)` query (same place `contacts` is already fetched for the selected node), passed to `SectionDetailPanel` as the new `teams` prop.
- `ui/src/api/teamApi.ts` — `Team` interface gains `logoUrl: string | null`; `TeamPayload` gains optional `logoUrl?: string | null`.
- `ui/src/api/teamContactApi.ts` (new) — `TeamContact` type (`id`, embedded `ClubContact`, `role`, `createdAt`), `listTeamContacts(clubId, sectionId, teamId)`, `linkTeamContact(clubId, sectionId, teamId, contactId, role)`, `unlinkTeamContact(clubId, sectionId, teamId, contactId)`.
- `ui/src/api/teamSponsorApi.ts` (new) — `listTeamSponsors(clubId, sectionId, teamId)`, `linkTeamSponsor(clubId, sectionId, teamId, sponsorId)`, `unlinkTeamSponsor(clubId, sectionId, teamId, sponsorId)` — returns `Sponsor[]` directly, no wrapper type (mirrors the backend's bare-list shape).

**Tests:**
- `ui/src/utils/sectionBreadcrumb.test.ts` (new, pure function).
- `ui/src/components/LinkExistingRecordDialog/` / `CreateAndLinkRecordDialog/` — new component tests + Storybook stories, covering both the no-extra-field (auto-submit) and with-extra-field (confirm-gated) modes.
- `ui/src/components/TeamForm/TeamForm.test.tsx` (extend) — logo field wiring, club-logo fallback caption, reset-to-club-logo.
- `ui/src/pages/manage/TeamFormPage.test.tsx` (extend) — contacts/sponsors sections render in edit mode only; club-sponsors list excludes already-linked ones; breadcrumb renders in every mode.
- `ui/src/pages/manage/TeamList.test.tsx` / `TeamDirectory.test.tsx` (extend) — breadcrumb chain replaces the single-name display.
- `ui/src/components/SectionDetailPanel/SectionDetailPanel.test.tsx` (extend) — team badges render, muted for inactive, empty state.
- `ui/src/pages/manage/ClubStructure.test.tsx` — **explicit regression pass**: every existing Section↔Contact link/create-and-link/unlink test must still pass unchanged after the dialog extraction (this is the real risk of this refactor — verify, don't assume).

## Order

1. `backend-builder` — full backend slice + its own tests.
2. Independently re-run `mvn test`.
3. `frontend-builder` — breadcrumb utility and the two shared dialogs first (everything else composes on them), then `ClubStructure.tsx`'s refactor + regression check, then Team's own new content (logo/contacts/sponsors/badges/breadcrumb wiring) + its own tests (needs the real backend DTO/endpoint shapes from step 1).
4. Independently re-run `npm run build`, `npm run lint`, `npm run test` (isolate the touched files given this machine's known CPU-contention flake in the full run, per prior session), `npm run test:storybook`.
5. `test-writer` — compare the amended spec's Test Plan against what's actually on disk, fill any real gaps (particularly: confirm the `ClubStructure.tsx` regression tests are real and passing, not just present).
6. Extend `ui/e2e/manager-teams.spec.ts` with the new golden path steps named in the spec's Test Plan (link/create-and-link/unlink a contact with the role quick-fill, logo override + reset, sponsor link/create-and-link, club-sponsors read-only exclusion, section-card badges, breadcrumb) — same "not run, just structurally correct" posture as `026`'s own E2E addition.
7. Manual smoke test against the real dev stack (backend restart + real Postgres + a real Keycloak token for `smoketest-club-admin`, same approach used for `026` since no browser-automation tool is available in this environment) — drive the new endpoints directly, confirm the migration applies to the real dev DB, confirm cross-club isolation on the new endpoints.

## Verification

- `cd backend && ./mvnw test` — all new/extended tiers pass, existing suite unaffected.
- `cd ui && npm run build && npm run lint && npm run test && npm run test:storybook` — all pass; explicitly confirm `ClubStructure.test.tsx`'s existing Section↔Contact tests still pass post-refactor.
- Contract: `openapi.yaml` diff matches what springdoc actually generates for the six new endpoints + the `logoUrl` additions.
- Live smoke test (real Postgres + real Keycloak token, `nvm use 22.12.0` first): create a `TeamContact` link with a role, create-and-link a new contact, unlink it; set/clear a team logo override; link/create-and-link/unlink a `TeamSponsor`; confirm cross-club `403`/`404` on all six new endpoints.
