# Plan: 025 — Club Structure

## Context

`docs/specs/025-club-structure.md` (approved) builds `001-tenancy-identity-model.md`'s `Section` entity for real, for the first time — `001` already designed it self-referential (`parent_section_id`) specifically because every club structures itself differently, but nothing in code has ever implemented it. This spec adds two capabilities `001` never designed: a many-to-many link from a `Section` to `021`'s existing `ClubContact`, and optional, unenforced eligibility metadata (`minAge`/`maxAge`/`gender`). It ships on `020`'s established `/api/v1/manage/**` namespace, reusing `AccessService.canAdministerClub` exactly like `021`/`022`/`023`/`024`.

The one genuinely new piece is `SectionTreeEditor` — a visual, click-to-edit org-chart component. A Claude Design pass was completed and approved before this plan (published canvas: four artboards — desktop with a node selected, 375px mobile, first-run empty state, and a close-up of the "can't remove — has active children" blocked state). The plan below builds `ClubStructure.tsx`/`SectionTreeEditor` to match that approved mockup's visual language: outlined flat node cards (`border: 1px solid divider`, `borderRadius: 8`), a pure-CSS nested-`<ul>`/`<li>` connector-line technique (`::before`/`::after` pseudo-elements drawing the org-chart rail), a per-node circular "+" add-child button, a pill-shaped rename/remove toolbar on the selected node, and a right-hand (desktop) / stacked-below (mobile) detail panel.

**Scope decisions the spec already fixed — not re-litigated here:** `Section`-only this pass (no `Team`); eligibility fields are capture-only, never enforced; `ClubContact` linking is many-to-many via a new `SectionContact` join; no re-parenting/drag-to-move; no `/platform` mirror; deactivate is blocked while any direct child is still active.

## Backend changes

**1. `backend/src/main/java/com/cricketlegend/domain/Section.java`** (new) — mirrors `ClubContact.java`'s skeleton (`@Entity`, Lombok `@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder`, generated `UUID id`, audit columns, `@PrePersist`/`@PreUpdate`), plus: `UUID clubId`, `UUID parentSectionId` (nullable, self-referential FK column per `001` — plain `UUID`, no JPA relationship navigation, matching this codebase's established "plain FK column" convention), `String name`, `Integer minAge` (nullable), `Integer maxAge` (nullable), `Gender gender` (nullable) `@Enumerated(EnumType.STRING)`, `boolean active`.

**2. `backend/src/main/java/com/cricketlegend/domain/Gender.java`** (new enum) — `MALE`, `FEMALE`. First gender field in this codebase; keep it exactly this small per the spec's own "unenforced hint" framing — no broader taxonomy.

**3. `backend/src/main/java/com/cricketlegend/domain/SectionContact.java`** (new) — join entity: `UUID id`, `UUID sectionId`, `UUID clubContactId`, `Instant createdAt`, `UUID createdBy`. No `active` flag (unlink is a real row delete, per the spec's Data Model Changes rationale).

**4. Migration — `backend/src/main/resources/db/changelog/v1/017-add-section.sql`** (next after `024`'s `016-add-sponsor-contact.sql`), exactly as specified in the spec's Data Model Changes section (`section` table + `ix_section_club`/`ix_section_parent` indexes; `section_contact` table + unique `(section_id, club_contact_id)` + its two indexes). Register in `db.changelog-master.xml` after the `016` line.

**5. DTOs** — `dto/SectionDto.java`, `dto/CreateSectionRequest.java`, `dto/UpdateSectionRequest.java`:
```java
public record SectionDto(UUID id, UUID clubId, UUID parentSectionId, String name, Integer minAge, Integer maxAge, Gender gender, boolean active, Instant createdAt, Instant updatedAt, UUID updatedBy) {}
public record CreateSectionRequest(@NotBlank String name, UUID parentSectionId, Integer minAge, Integer maxAge, Gender gender) {}
public record UpdateSectionRequest(@NotBlank String name, Integer minAge, Integer maxAge, Gender gender) {}
```
`dto/SectionContactDto.java` — a thin wrapper for the link-list response, actually just reuses `021`'s existing `ClubContactDto` directly (`GET .../sections/{id}/contacts` returns `List<ClubContactDto>`, per the spec's API Contract) — no new DTO needed for that endpoint.

**6. `mapper/SectionMapper.java`** (new, MapStruct `componentModel = "spring"`) — `toDto(Section)`, `toEntity(CreateSectionRequest)` (id/audit/active/clubId ignored, set by the service).

**7. `repository/SectionRepository.java`** — `findByClubId(UUID)`, `findByParentSectionIdAndActiveTrue(UUID)` (used by the deactivate-blocked-by-active-children check).
**`repository/SectionContactRepository.java`** — `findBySectionId(UUID)`, `existsBySectionIdAndClubContactId(UUID, UUID)`, `findBySectionIdAndClubContactId(UUID, UUID)`, `deleteBySectionIdAndClubContactId(UUID, UUID)`.

**8. `service/SectionService.java` + `service/impl/SectionServiceImpl.java`** — injects `SectionRepository`, `SectionContactRepository`, `ClubContactRepository` (existing, `021`), `SectionMapper`, `ClubContactMapper` (existing). Methods: `list(clubId)`, `create(clubId, request)`, `update(clubId, sectionId, request)`, `deactivate(clubId, sectionId)`, `reactivate(clubId, sectionId)`, `listContacts(clubId, sectionId)`, `link(clubId, sectionId, contactId)`, `unlink(clubId, sectionId, contactId)`. Key behaviors:
- `findOrThrowForClub(clubId, sectionId)` — mirrors `ClubContactServiceImpl`'s exact pattern (404 if not found or wrong club).
- `create`: validates `minAge <= maxAge` when both set (`ValidationException`, `400`); if `parentSectionId` given, verify it belongs to the same `clubId` (`NotFoundException` otherwise — a parent from another club can't be referenced).
- `deactivate`: `InvalidStatusTransitionException` (existing class, reused) if already inactive OR if `sectionRepository.findByParentSectionIdAndActiveTrue(sectionId)` is non-empty — two distinct messages ("already inactive" vs "has N active child section(s)") so the UI can show the right guidance, per the spec's Data Model Changes.
- `link`: verify the `ClubContact` belongs to the same `clubId` (404 otherwise, mirroring the cross-tenant isolation posture used everywhere else); `409` (`ConflictException`, existing class) if already linked.
- `unlink`: `404` if no such link row exists.
- `@Transactional` on `create`/`update`/`link`/`unlink`.

**9. `controller/SectionController.java`** (new) — eight endpoints under `/api/v1/manage/clubs/{clubId}/sections`, all `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")`, exactly matching the spec's API Contract table:
```
GET    /api/v1/manage/clubs/{clubId}/sections
POST   /api/v1/manage/clubs/{clubId}/sections
PUT    /api/v1/manage/clubs/{clubId}/sections/{sectionId}
POST   /api/v1/manage/clubs/{clubId}/sections/{sectionId}/deactivate
POST   /api/v1/manage/clubs/{clubId}/sections/{sectionId}/reactivate
GET    /api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts
POST   /api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts/{contactId}/link
POST   /api/v1/manage/clubs/{clubId}/sections/{sectionId}/contacts/{contactId}/unlink
```

**10. Regenerate `backend/openapi/openapi.yaml`** — same manual process as `021`/`023`/`024` (scratch-port run, `curl .../v3/api-docs.yaml`, splice in the eight new paths + `SectionDto`/`CreateSectionRequest`/`UpdateSectionRequest` schemas).

**Assigned to:** `backend-builder`.

## Backend tests (`test-writer`, after backend-builder)

- `SectionServiceImplTest` (unit) — create/update incl. `minAge <= maxAge` validation and cross-club parent rejection; deactivate blocked by an active child (distinct message from already-inactive); reactivate; link/unlink incl. already-linked `409` and cross-club contact rejection; cross-club `NotFoundException` isolation for `sectionId`.
- `SectionRepositoryTest` (Testcontainers) — migration applies cleanly, the self-referential FK and `section_contact` unique constraint behave correctly.
- `SectionControllerIntegrationTest` (Testcontainers, `PlatformRoleJwtPostProcessors.withSubject` pattern) — real `CLUB_ADMIN` success across all eight endpoints for their own club, `403`/`404` for a different club, `platform_admin` superset success, the active-child deactivate-block proven through the real HTTP layer.

## Frontend changes (`frontend-builder`)

Reference the approved design canvas (published this session — four artboards: desktop/mobile/empty/blocked-remove) for exact visual treatment. Key values it establishes, to carry into the real components: node = outlined card (`1px solid`, `theme.palette.divider`, `borderRadius: 8`, `10px 18px` padding, `fontWeight 600`, `14px`); selected node = `2px solid primary.main` border + `alpha(primary.main, 0.08)` background; connector lines = `1px solid divider`; add-child button = 22px circle, `1px solid primary.main` border, primary-colored plus icon, positioned at the node's bottom edge; node toolbar (rename/remove) = white pill, `1px solid divider`, shown above the selected node; age-eligibility chip = small pill, `alpha(primary.main, 0.14)` background.

**11. `ui/src/api/sectionApi.ts`** (new) — mirrors `clubContactApi.ts`'s shape, base path `/manage/clubs/${clubId}/sections`:
```ts
export interface Section { id: string; clubId: string; parentSectionId: string | null; name: string; minAge: number | null; maxAge: number | null; gender: 'MALE' | 'FEMALE' | null; active: boolean; createdAt: string; updatedAt: string; updatedBy: string | null }
export interface SectionPayload { name: string; parentSectionId?: string | null; minAge: number | null; maxAge: number | null; gender: 'MALE' | 'FEMALE' | null }
listSections(clubId): Promise<Section[]>                          // GET, flat array
createSection(clubId, payload): Promise<Section>
updateSection(clubId, sectionId, payload): Promise<Section>
deactivateSection(clubId, sectionId): Promise<Section>
reactivateSection(clubId, sectionId): Promise<Section>
listSectionContacts(clubId, sectionId): Promise<ClubContact[]>    // reuses ClubContact type from clubContactApi.ts
linkSectionContact(clubId, sectionId, contactId): Promise<void>
unlinkSectionContact(clubId, sectionId, contactId): Promise<void>
```

**12. `ui/src/components/SectionTreeEditor/`** (new, four-file anatomy — the one component needing the Claude Design pass, now complete) — props: `sections: Section[]`, `selectedId: string | null`, `onSelect(id)`, `onAddChild(parentId | null)`, `onRename(id, name)` (inline rename on the selected node's toolbar), `onRemove(id)` (calls up to the parent, which calls `deactivateSection` and surfaces the blocked-by-active-children error). Internally: builds a tree structure from the flat `sections` array (group by `parentSectionId`, root = `parentSectionId === null`), renders the nested `<ul>`/`<li>` DOM structure with the CSS connector technique from the approved mockup — this is genuinely new CSS, not composed from an existing component, so port it directly from the design canvas's `Main.dc.html`/`Mobile.dc.html` (published this session) rather than re-deriving it. Horizontal scroll container (`overflow-x: auto`) wraps the tree per the spec's mobile requirement. The remove/add-child controls call the passed-in handlers; a node with active children shows its remove icon disabled with a tooltip (mirrors the mockup's `BlockedRemove.dc.html` artboard) — `frontend-builder` derives "has active children" client-side from the same flat `sections` array (a node has active children if any other active section's `parentSectionId` equals its own `id`), no extra API call needed.

**13. `ui/src/components/SectionDetailPanel/`** (new, four-file anatomy) — props: `section: Section`, `breadcrumb: string[]` (ancestor names, computed by the parent from the flat list), `onUpdate(payload)`, `contacts: ClubContact[]`, `onLinkExisting()`, `onCreateAndLink()`, `onUnlink(contactId)`. Renders: breadcrumb trail, editable name field, eligibility fields (`Input type="number"` for min/max age, a `Select` for gender with an explicit "Not specified" option), a divider, and the linked-contacts list (`avatar` = initials in an `alpha(primary.main, 0.14)` circle, name, role, unlink icon button) + "Link existing" / "+ New contact" actions — matching the approved mockup's detail-panel layout exactly.

**14. `ui/src/pages/manage/ClubStructure.tsx`** (rewritten from `006`'s `EmptyState` placeholder) — reads `clubId` from `ManagerHome`'s `Outlet` context. `useQuery` for `listSections`; empty-state branch (no sections yet) renders the "Start from a template" / "Start blank" choice from the mockup's `Empty.dc.html` artboard — "Start from a template" fires a small sequence of `createSection` calls building a starter tree (e.g. Open Sides/Juniors/Vets with a couple of representative children), "Start blank" just leaves the tree empty for the admin to build with `SectionTreeEditor`'s add-child controls. Otherwise renders `SectionTreeEditor` + `SectionDetailPanel` side by side (desktop) / stacked (mobile, via `sx={{xs: 'column', md: 'row'}}` flex direction, matching the mockup's two layouts). Manages `selectedId` state; "Link existing contact" opens a small `Autocomplete` over `listClubContacts(clubId)`; "+ New contact" opens `021`'s existing `ClubContactForm` in a `Dialog`, and on successful create, calls `linkSectionContact` with the new contact's id.

**15. `ui/src/pages/manage/ManagerDashboard.tsx`** — rename the existing card: `{ title: 'Sections & Age Groups', description: 'Set up age-group sections', to: '/manage/sections' }` → `{ title: 'Club Structure', description: "Define your club's own section tree", to: '/manage/sections' }`. Route path unchanged.

**16. `ui/src/App.tsx`** — the existing `sections` route's `element` changes from `<EmptyState title="Sections & Age Groups" ... />` to `<ClubStructure />`. No new route paths.

## Frontend tests (`test-writer`, after frontend-builder)

- `SectionTreeEditor.test.tsx` + Storybook story (375/768/1280 viewports, matching the approved mockup's desktop/mobile artboards) — builds a tree from a flat list correctly, add-child/rename/remove wiring, remove disabled+explained when a node has active children, click selects a node.
- `SectionDetailPanel.test.tsx` + Storybook story — field round-trip, link/unlink/create-and-link wiring.
- `ClubStructure.test.tsx` — empty state (template vs blank), `clubId`-from-context guard, selecting a node loads its contacts, the full add/rename/eligibility/link flow wired end-to-end at the page level.
- `ManagerDashboard.test.tsx` — extend for the renamed card (only if the file doesn't already need creating from scratch — check first).

## E2E (`test-writer`)

New `ui/e2e/manager-club-structure.spec.ts`, same `smoketest-club-admin` prerequisite/skip shape as every prior `/manage` e2e spec. Golden path: open Club Structure (empty state on a fresh club, or existing tree), add a top-level node and a child under it, rename one, set eligibility on the leaf, link an existing `ClubContact`, create-and-link a new one, attempt to deactivate the parent (blocked), deactivate the leaf, then successfully deactivate the parent, reload and confirm every change persisted.

## Verification

- Backend: `./mvnw verify` from `backend/`.
- Frontend: `npm run lint && npm run test && npm run build` from `ui/` (`nvm use 22.12.0` first — plain `node` resolves to v12 on this machine).
- Manual smoke test: log in as `smoketest-club-admin`, confirm the Club Structure empty-state → build-a-tree → detail-panel → contact-linking → deactivate/reactivate flow end to end against a real (not stale) backend instance — restart the local `:8082` backend first if it predates this branch's code, same recurring gotcha.
- Visual check against the approved design canvas (this session's published artifact) at both desktop and 375px widths.
- OpenAPI: regenerate and diff `backend/openapi/openapi.yaml`.

## Order of work

1. `backend-builder`: `Section`/`Gender`/`SectionContact` entities, migration + changelog registration, DTOs, mapper, repositories, service/impl, controller, OpenAPI regen.
2. `frontend-builder`: `sectionApi.ts`, `SectionTreeEditor`, `SectionDetailPanel`, `ClubStructure.tsx`, `ManagerDashboard.tsx` rename, `App.tsx` route swap.
3. `test-writer`: backend unit/integration tests, frontend component tests, new e2e spec.
4. Manual smoke test (incl. visual check against the design canvas), then `standards-reviewer` before PR, per `docs/workflow.md`.
