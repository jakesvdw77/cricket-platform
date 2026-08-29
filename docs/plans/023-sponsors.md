# Plan: 023 — Sponsors

## Context

`docs/specs/023-sponsors.md` (approved) is the second of the 022/023/024 mini-epic. It builds the `Sponsor` entity itself (name/website/email/phone, logo/banner, social links) on `020`/`021`'s `/api/v1/manage/**`-only namespace — no sponsor *contacts* yet (`024`'s job, the same way `010` shipped a bare `Club` long before `021` gave it Contacts).

Exploration confirmed two things that shape this plan:

- **`Sponsor` is structurally closest to `ClubContact`** (many-to-one with `Club`, plain UUID FK, active/deactivate/reactivate lifecycle, no `/platform` mirror) **crossed with `ClubProfile`'s `socialLinks` handling** (the `@ElementCollection`/`@CollectionTable` pattern, reusing `022`'s `SocialLink`/`SocialLinkDto` unmodified). Neither precedent alone covers it.
- **`SponsorForm` is `ClubForm`'s tab machinery with the create-mode-disabling logic stripped out.** `ClubForm`'s disabled-tabs-until-saved behavior exists solely because `ClubProfile` is a *separate* 1:1-with-`Club` child entity that can't be upserted before the `Club` itself has an id — a real two-step flow. `Sponsor` has no such split: it's one entity, created in one `POST`, exactly like `ClubContact`. So `SponsorForm` is effectively `ClubForm`'s `'profileOnly'`-mode subset (tab index / `activeTab` / error-routing skeleton) with all tabs always enabled, no `Tooltip`, no `profileEnabled` boolean — confirmed as a genuinely new sub-pattern (no existing tabbed form in this codebase has this simpler shape to copy wholesale).

**Plan-time lesson applied from `022`'s bug, not rediscovered**: `ClubProfileServiceImpl` originally had `@Transactional` on nothing, and `get()` threw a real `LazyInitializationException` on every plain `GET` because it mapped a fetched entity's lazy `@ElementCollection` *after* `findById`'s own transaction had closed — caught only by manual testing, since the integration test suite's own `@Transactional` wrapper happened to mask it. `Sponsor` has the exact same `socialLinks` shape, so **every `SponsorServiceImpl` method that fetches-then-maps a `Sponsor` (`list`, `create`, `update`, `deactivate`, `reactivate` — all of them, not just the obvious read path) gets `@Transactional` from the start.** This is called out explicitly below so it isn't left to be found the hard way a second time.

**Plan-time mapper decision**: `SponsorMapper` gets full MapStruct treatment in both directions (`toDto`/`toEntity`), including `socialLinks` — declaring both `SocialLinkDto toDto(SocialLink)` and `SocialLink toEntity(SocialLinkDto)` element-level one-liners lets MapStruct auto-generate both list directions, the same convention `ClubContactMapper` already established for its own `toEntity(CreateClubContactRequest)`. This is a deliberate departure from `ClubProfileServiceImpl`'s manual `toSocialLinks` helper — that hand-rolled approach exists there only because `ClubProfileMapper` predates `022` and had no `toEntity` at all before; `SponsorMapper` is brand new and isn't constrained by that history.

## Backend changes

**1. `backend/src/main/java/com/cricketlegend/domain/Sponsor.java`** (new) — mirrors `ClubContact`'s skeleton (`@Entity`, plain `UUID clubId` FK, audit columns, `@PrePersist`/`@PreUpdate`) with `String name` (not null), `String website`, `String email`, `String phone`, `String logoUrl`, `String bannerUrl`, `boolean active` (default `true`), and `@ElementCollection @CollectionTable(name = "sponsor_social_link", joinColumns = @JoinColumn(name = "sponsor_id")) @Builder.Default List<SocialLink> socialLinks = new ArrayList<>()` — the exact `ClubProfile.socialLinks` pattern, different join column.

**2. Migration — `backend/src/main/resources/db/changelog/v1/015-add-sponsor.sql`** (next sequential after `022`'s `014-add-club-profile-social-links.sql`) — use the spec's own already-drafted SQL verbatim (`sponsor` table, `ix_sponsor_club` index, `sponsor_social_link` table with composite PK `(sponsor_id, platform)`). Register in `db.changelog-master.xml` after the `014` line.

**3. DTOs** — `dto/SponsorDto.java` (read shape: `id, clubId, name, website, email, phone, logoUrl, bannerUrl, socialLinks, active, createdAt, updatedAt, updatedBy`), `dto/CreateSponsorRequest.java`/`dto/UpdateSponsorRequest.java` (identical shape to each other, matching `ClubContact`'s Create/Update precedent, not `Product`'s split): `{@NotBlank name, website, email, phone, logoUrl, bannerUrl, socialLinks}` — `socialLinks` typed `List<SocialLinkDto>`, no `@Valid` forgotten this time (apply it from the start, per `022`'s other bug).

**4. `mapper/SponsorMapper.java`** (new) — `SponsorDto toDto(Sponsor)`, `Sponsor toEntity(CreateSponsorRequest)` (`@Mapping(target = "id/clubId/active/createdAt/updatedAt/updatedBy", ignore = true)`), plus `SocialLinkDto toDto(SocialLink)` and `SocialLink toEntity(SocialLinkDto)` element-level one-liners enabling MapStruct's automatic `List<SocialLink></>List<SocialLinkDto>` mapping in both directions (per the Context section's mapper decision).

**5. `service/SponsorService.java` + `service/impl/SponsorServiceImpl.java`** — `list(clubId)`, `create(clubId, request)`, `update(clubId, sponsorId, request)`, `deactivate(clubId, sponsorId)`, `reactivate(clubId, sponsorId)`. **Every method is `@Transactional`** (`readOnly = true` on `list`, plain `@Transactional` on the rest) — see Context. Key behaviors:
- `findOrThrowForClub(clubId, sponsorId)` — 404s if the sponsor doesn't exist or belongs to a different club, mirroring `ClubContactServiceImpl`'s exact pattern.
- `create`/`update`: `requireNoDuplicatePlatform(request.socialLinks())` (mirrors `ClubProfileServiceImpl`'s exact helper/reasoning) before any save — the DB's composite PK on `sponsor_social_link` is a backstop, not the primary guard.
- `deactivate`/`reactivate`: mirror `ClubContactServiceImpl`'s exact shape — `InvalidStatusTransitionException` (409) if already in the target state.

**6. `controller/SponsorController.java`** (new) — five endpoints under `/api/v1/manage/clubs/{clubId}/sponsors`, each with its own `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")` (no class-level auth, matching `ClubContactController`'s exact shape — `/manage/**` is only `authenticated()` at the URL level).

**7. Regenerate `backend/openapi/openapi.yaml`** — same manual scratch-port process as every prior spec.

**Assigned to:** `backend-builder`.

## Backend tests (`test-writer`, after backend-builder)

- `SponsorServiceImplTest` — mirrors `ClubContactServiceImplTest`'s shape: create/update validation, `socialLinks` round-trip, duplicate-platform `ValidationException` + `verify(..., never()).save(...)`, deactivate/reactivate + `409`s, cross-club `NotFoundException` isolation. No primary-auto-unset case (Sponsor has no primary concept).
- `SponsorRepositoryTest` — migration applies cleanly; `sponsor_social_link`'s composite PK rejects a duplicate `(sponsor_id, platform)` inserted directly via the repository, bypassing the service (mirrors `022`'s `ClubProfileRepositoryTest` proof).
- `SponsorControllerIntegrationTest` — mirrors `ClubContactControllerIntegrationTest`'s exact 4-case structure (own `grantClubAdmin(subject, clubId)` private helper, same as that class defines locally — no shared test utility exists for this beyond the JWT postprocessors, so replicate rather than search for one): real `CLUB_ADMIN` success on own club, `403` on a different club, `platform_admin` superset success, `403` for no grant at all.
- **Explicitly flag in the test-writer prompt**: `022`'s `LazyInitializationException` bug was NOT caught by its own `@Transactional`-wrapped integration tests — only by manual testing, because the test's own transaction wrapper keeps a Hibernate session open regardless of whether the production code has `@Transactional`. Don't treat a green `./mvnw verify` alone as proof `Sponsor`'s lazy `socialLinks` collection is safe; the manual smoke test step later in this plan is what actually proves it, same as it did for `022`.

## Frontend changes (`frontend-builder`)

**8. `ui/src/api/sponsorApi.ts`** (new) — mirrors `clubContactApi.ts`'s shape exactly (entity interface, one shared `Payload` interface for create/update, `list`/`create`/`update`/`deactivate`/`reactivate` against `/manage/clubs/${clubId}/sponsors`), reusing the `SocialLink` type from `../components/marketing/SocialLinksRow`.

**9. `ui/src/components/SponsorForm/`** (new, four-file anatomy) — tabbed (**Basic Info**: name/website/email/phone; **Branding**: `MediaUpload` logo+banner, `namespace="manage"`; **Social Media**: one `SocialLinksFields`), following `ClubForm`'s tab-index/`activeTab`/`fieldTab`-error-routing skeleton but with **no disabled-tab/`Tooltip`/`profileEnabled` machinery at all** — every tab is enabled from the start, in both create and edit mode (per the Context section's analysis — there is no "save the parent first" step here). Exports `SPONSOR_FORM_ID`.

**10. `ui/src/pages/manage/SponsorList.tsx`** / **`SponsorFormPage.tsx`** (new) — mirror `ClubContactList.tsx`/`ClubContactFormPage.tsx`'s exact shape: `Outlet`-context `clubId`, "Back to Dashboard" link, `ListToolbar` + `RecordCard` grid (Deactivate/Reactivate `secondaryAction`), no single-sponsor GET endpoint so edit-mode prefill fetches the full list and `select`s the matching row client-side, same as `ClubContactFormPage`.

**11. `ui/src/pages/manage/ManagerDashboard.tsx`** — add `{ title: 'Club Sponsors', description: "Manage your club's sponsors", to: '/manage/sponsors' }` to the `'Club manager'` group, directly after the existing "Club Contacts" card (per the user's explicit placement request).

**12. `ui/src/App.tsx`** — new routes `sponsors` (list), `sponsors/new`, `sponsors/:id/edit` under the existing `/manage` block, directly after the `club-contacts/:id/edit` line, plus the corresponding imports.

## Frontend tests (`test-writer`, after frontend-builder)

- `SponsorForm.test.tsx` + Storybook story — tab structure (all three always enabled/reachable, no disabled state), required-field validation, logo/banner upload wiring (`namespace="manage"`), social links wiring (add/remove/custom via `SocialLinksFields`).
- `SponsorList.test.tsx` — cards render with correct active/inactive state, deactivate/reactivate wiring, search/sort.
- `SponsorFormPage.test.tsx` — create vs. edit mode, `clubId`-from-context guard, save flow.
- `ManagerDashboard.test.tsx` — extend if it exists (per `020`/`021`'s own note, may still not exist — check first, don't create a new test file for a component with none today if that's still the case).

## E2E (`test-writer`)

New `ui/e2e/manager-club-sponsors.spec.ts`, mirroring `021`'s `manager-club-contacts.spec.ts` structure exactly (same `smoketest-club-admin` prerequisite, same `test.skip(!!process.env.CI, ...)`): log in, open Club Sponsors, add a sponsor with a logo and a social link, edit it, deactivate it, confirm the inactive state persists across a reload, reactivate it.

## Verification

- Backend: `./mvnw verify` from `backend/`.
- Frontend: `npm run lint && npx vitest run --pool=threads --poolOptions.threads.maxThreads=4 && npm run build` from `ui/` (`nvm use 22.12.0` first).
- **Manual smoke test is not optional this time** (see the `@Transactional` note above) — log in as `smoketest-club-admin`, create a sponsor with a social link and a logo, then reload/re-navigate to confirm a plain `GET`-driven read (not just the create response) renders correctly with no `500`. This is exactly the step that caught `022`'s bug; skipping it would defeat the purpose of applying the lesson.
- OpenAPI: regenerate and diff `backend/openapi/openapi.yaml`.

## Order of work

1. `backend-builder`: `Sponsor`, migration + changelog registration, DTOs, `SponsorMapper`, `SponsorServiceImpl` (all methods `@Transactional` from the start), `SponsorController`, OpenAPI regen.
2. `frontend-builder`: `sponsorApi.ts`, `SponsorForm`, `SponsorList`, `SponsorFormPage`, dashboard card (positioned after Club Contacts), routes.
3. `test-writer`: backend tests (including the explicit "don't trust a green suite alone" note), frontend tests, new e2e spec.
4. Manual smoke test (mandatory, not just recommended — see above), then `standards-reviewer` before PR, per `docs/workflow.md`.
