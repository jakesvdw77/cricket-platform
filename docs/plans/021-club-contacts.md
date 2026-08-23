# Plan: 021 — Club Contacts

## Context

`docs/specs/021-club-contacts.md` (approved) builds the "who do I contact at this club?" list `012` deliberately deferred and reserved `Contact.java`/`ContactDto` for. It ships entirely on `020`'s already-built `/api/v1/manage/**` namespace — a brand-new resource, so (per the spec's own Architecture note) it needs no `/api/v1/platform/**` mirror the way `012`'s `ClubProfile` did; `AccessService.canAdministerClub` already gives `platform_admin` a superset pass on `/manage/**` endpoints. This is the first genuinely new list/CRUD resource built since `020` landed, and the first *list* endpoint in this codebase that's deliberately **not** paginated (a club's contacts are a small, bounded set — not the "unbounded growth" case `docs/standards/backend.md`'s pagination rule targets; `Product` remains the only paginated list precedent).

**Added during planning (user request): a photo field on each contact, reusing `012`'s `MediaUpload` mechanism.** This surfaced a real, previously-latent gap: `MediaUpload`/`uploadMedia()` hit `POST /api/v1/platform/media` (`MediaController.java`), which is `platform_admin`-only at the URL gate — `012`'s own Javadoc claims "any future consumer (Sponsors, Club Contacts) calls this same endpoint," but that was written before `020`'s `/manage` namespace existed, and a `CLUB_ADMIN` genuinely cannot reach `/api/v1/platform/**` at all. This plan closes that gap the same way `020` closed it for `ClubProfile`: an additive `POST /api/v1/manage/media` mapping on the existing `MediaController`/`MediaService` (no new service, no `@PreAuthorize` needed — upload itself isn't club-scoped, the resulting URL only becomes meaningful once attached to an authorized `ClubContact` record), plus a `namespace` prop on `MediaUpload` so it can call either endpoint. **This requires amending `docs/specs/021-club-contacts.md` itself** (new `photoUrl` field, new `/manage/media` endpoint + architecture note, `MediaUpload`'s new prop) before implementation starts — done as step 0 below, by me directly, not delegated, since it changes what the spec fixes.

## Backend changes

**0. Amend `docs/specs/021-club-contacts.md`** (done by me directly, before any builder starts):
- Data Model Changes: add `photoUrl` (nullable `String`) to `ClubContact`, same posture as `ClubProfile.logoUrl`/`bannerUrl` (no format validation, just a URL string set by the upload flow). Migration gains `photo_url VARCHAR(512)`.
- API Contract: add an Architecture-note addendum explaining the `/manage/media` gap and fix (see Context above), and a new row: `POST /api/v1/manage/media | authenticated() only, no @PreAuthorize | Generic image upload for a /manage caller — same MediaService as 012's platform-facing endpoint, returns {url}`.
- UI Requirements: `MediaUpload` (012) gains an optional `namespace?: 'platform' | 'manage'` prop, default `'platform'` (every existing `ClubForm` logo/banner call site unaffected); `ClubContactForm` uses `namespace="manage"`.
- Non-goals: note that photo cropping/resizing beyond `MediaUpload`'s existing fixed-dimension preview is out of scope — reused exactly as built.
- Test Plan: add `MediaController` coverage for the new `/manage/media` mapping (see Backend tests below) and a `ClubContactForm` photo-upload wiring case.
- Acceptance Criteria: add "a club admin can upload and attach a photo to a contact via the same `MediaUpload` mechanism platform admins already use for club branding."
- Rollout Notes: flag that `012`'s claim that Sponsors/Club Contacts could reuse `POST /api/v1/platform/media` "unchanged" didn't anticipate `020`'s `/manage` namespace and wasn't actually reachable by a club admin — the future Sponsors spec should use the new `/manage/media` mapping, not the platform one.

**1. `backend/src/main/java/com/cricketlegend/domain/ClubContact.java`** (new) — mirrors `Product.java`'s skeleton (`@Entity`, Lombok `@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder`, generated `UUID id`, `createdAt`/`updatedAt`/`updatedBy` audit columns, `@PrePersist`/`@PreUpdate` timestamp stamping) plus a plain `UUID clubId` FK column (not the PK — many rows per club, matching `ClubProfile`'s "plain UUID FK, no entity graph navigation" convention, just not shared-PK this time), `@Embedded private Contact contact;` (no `@AttributeOverride` needed — no column-name collision at this embedding site), `String role`, `boolean isPrimary`, `boolean active` (default `true`), and `String photoUrl` (nullable, same posture as `ClubProfile.logoUrl`/`bannerUrl`).

**2. Migration — `backend/src/main/resources/db/changelog/v1/013-add-club-contact.sql`** (next sequential after `012`), exactly as specified in `021`'s (amended) Data Model Changes section (table + `photo_url VARCHAR(512)` + `ix_club_contact_club` index + the partial unique index `ux_club_contact_primary ... WHERE is_primary AND active`). Register it in `backend/src/main/resources/db/changelog/db.changelog-master.xml` with `<include file="db/changelog/v1/013-add-club-contact.sql" relativeToChangelogFile="false"/>`, directly after the existing `012` line.

**3. DTOs** — `dto/ClubContactDto.java` (read shape) and `dto/CreateClubContactRequest.java`/`dto/UpdateClubContactRequest.java` (write shapes, identical field sets). Each **nests `ContactDto contact`** as a field (not flattened) — matching `ClubProfileDto`'s own precedent of nesting `AddressDto address` for its embedded `Address`, and directly satisfying the spec's "reuse `ContactDto` directly" intent:
```java
public record ClubContactDto(UUID id, UUID clubId, ContactDto contact, String role, boolean isPrimary, boolean active, String photoUrl, Instant createdAt, Instant updatedAt, UUID updatedBy) {}
public record CreateClubContactRequest(@Valid @NotNull ContactDto contact, @NotBlank String role, boolean isPrimary, String photoUrl) {}
public record UpdateClubContactRequest(@Valid @NotNull ContactDto contact, @NotBlank String role, boolean isPrimary, String photoUrl) {}
```
`ContactDto`'s own `@NotBlank`/`@Email` annotations do the field-level validation (per `docs/standards/backend.md`'s DTO-boundary rule) — nothing re-declared here. `@Valid` on the nested `contact` field is required for those annotations to actually run. `photoUrl` is unvalidated (nullable free-form URL string), matching `ClubProfile`'s `logoUrl`/`bannerUrl`.

**4. `mapper/ClubContactMapper.java`** (new, `@Mapper(componentModel = "spring")`) — `toDto(ClubContact)`, `toEntity(CreateClubContactRequest)` (`@Mapping(target = "id", ignore = true)` + audit fields + `active`/`clubId` ignored, set by the service). MapStruct auto-generates the nested `Contact ↔ ContactDto` mapping inline (identical property names on both sides, no separate `ContactMapper` class needed) — confirm this by checking the generated `ClubContactMapperImpl` compiles cleanly; if MapStruct can't infer it, add an explicit `Contact toContact(ContactDto)`/`ContactDto toContactDto(Contact)` pair to this same mapper class rather than a new file. No `toEntity` for update — per `ProductMapper`'s precedent, updates apply via manual setters in the service, not a MapStruct update method.

**5. `service/ClubContactService.java` + `service/impl/ClubContactServiceImpl.java`** — `list(UUID clubId)`, `create(UUID clubId, CreateClubContactRequest)`, `update(UUID clubId, UUID contactId, UpdateClubContactRequest)`, `deactivate(UUID clubId, UUID contactId)`, `reactivate(UUID clubId, UUID contactId)`. Key behaviors:
- A private `findOrThrowForClub(clubId, contactId)` — 404s (`NotFoundException`) if the contact doesn't exist *or* belongs to a different club (cross-club isolation at the data layer, not just the `@PreAuthorize` layer).
- `create`/`update`: when `request.isPrimary() == true`, before saving, unset `isPrimary` on any other `active` `ClubContact` row for the same `clubId` (a `RoleAssignmentRepository`-style repository method, e.g. `clubContactRepository.findByClubIdAndActiveTrueAndIsPrimaryTrue(clubId)`, in the same transaction) — the auto-unset behavior the spec specifies, not a `ConflictException`.
- `deactivate`/`reactivate`: mirror `ProductServiceImpl.retire()`'s shape exactly — `InvalidStatusTransitionException` (existing class, reused as-is per the spec, no new exception subclass) if already in the target state.
- `@Transactional` on `create`/`update` (the auto-unset + save must be atomic).

**6. `controller/ClubContactController.java`** (new) — five endpoints, all under `/api/v1/manage/clubs/{clubId}/contacts`, all `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")` (no exceptions — `/manage/**` is only `authenticated()` at the URL level, per `020`):
```
GET    /api/v1/manage/clubs/{clubId}/contacts                       -> List<ClubContactDto>
POST   /api/v1/manage/clubs/{clubId}/contacts                       -> ClubContactDto
PUT    /api/v1/manage/clubs/{clubId}/contacts/{contactId}           -> ClubContactDto
POST   /api/v1/manage/clubs/{clubId}/contacts/{contactId}/deactivate -> ClubContactDto
POST   /api/v1/manage/clubs/{clubId}/contacts/{contactId}/reactivate -> ClubContactDto
```
Thin pass-through to the service, DTOs only across the boundary — same shape as `ClubProfileController`'s existing `/manage` mappings.

**7. `backend/src/main/java/com/cricketlegend/controller/MediaController.java`** — add a second mapping alongside the existing `POST /api/v1/platform/media`, same `mediaService.upload(file)` call, no `@PreAuthorize` (media upload isn't club-scoped data — `authenticated()` at the URL level, per `020`'s namespace, is sufficient):
```java
@PostMapping(value = "/api/v1/manage/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
public ResponseEntity<MediaUploadResponse> uploadManaged(@RequestParam("file") MultipartFile file) {
    return ResponseEntity.ok(mediaService.upload(file));
}
```
Update the class's existing Javadoc (currently says "no `@PreAuthorize`" in a way that implied `/platform`-only) to describe both mappings, same style as `020`'s update to `ClubProfileController`'s Javadoc.

**8. Regenerate `backend/openapi/openapi.yaml`** — same manual process used for `020` (run the backend locally on a scratch port so as not to disturb any already-running dev instance, `curl .../v3/api-docs.yaml`, splice in the five new `ClubContact` paths + the new `/manage/media` path + `ClubContactDto`/`CreateClubContactRequest`/`UpdateClubContactRequest` schemas).

**Assigned to:** `backend-builder`.

## Backend tests (`test-writer`, after backend-builder)

- `ClubContactServiceImplTest` (unit) — create/update validation, primary auto-unset (setting a new primary unsets the previous *active* one, leaves an *inactive* contact's stale flag alone — the spec's own carve-out), deactivate/reactivate transitions and their `409`s.
- `ClubContactRepositoryTest` (Testcontainers) — migration applies cleanly; the partial unique index actually rejects two simultaneous active primaries inserted directly (bypassing the service), proving the DB-level backstop is real.
- `ClubContactControllerIntegrationTest` (Testcontainers) — following `020`'s own established pattern exactly (`PlatformRoleJwtPostProcessors.withSubject`, a real `Person` + `RoleAssignment(CLUB_ADMIN, CLUB, clubId)` row): a real `CLUB_ADMIN` can reach all five endpoints for their own club, gets `403` for a different club or no grant; additionally (per the spec's Test Plan) a `platformAdmin()` JWT also succeeds on the same endpoints, proving the superset-access claim in the spec's Architecture note.
- `MediaControllerIntegrationTest` (new or extended, whichever already exists) — `POST /api/v1/manage/media` succeeds for any authenticated caller (`withSubject`, no `RoleAssignment` needed at all, since the endpoint itself does no scoping), and `POST /api/v1/platform/media` still rejects a non-`platform_admin` caller unchanged (regression, matching `020`'s own "prove the other namespace is untouched" pattern).

## Frontend changes (`frontend-builder`)

**9. `ui/src/api/mediaApi.ts`** — add `uploadManagedMedia(file)`, mirroring `uploadMedia` exactly, hitting `/manage/media` instead of `/platform/media`. Same `MediaUploadResponse` type.

**10. `ui/src/components/MediaUpload/MediaUpload.tsx`** — add `namespace?: 'platform' | 'manage'` prop, default `'platform'` (every existing `ClubForm` logo/banner call site unaffected — must keep passing with no changes). Internally: `const upload = namespace === 'manage' ? uploadManagedMedia : uploadMedia` (or equivalent), used in place of the current hardcoded `uploadMedia` call. Existing `MediaUpload.test.tsx` cases must all keep passing unmodified; add one new case for `namespace="manage"` calling `uploadManagedMedia`.

**11. `ui/src/api/clubContactApi.ts`** (new) — mirrors `productApi.ts`'s shape (types + thin wrappers), base path `/manage/clubs/${clubId}/contacts`:
```ts
export interface ClubContact { id: string; clubId: string; contact: { firstName: string; lastName: string; email: string; phone: string }; role: string; isPrimary: boolean; active: boolean; photoUrl: string | null; createdAt: string; updatedAt: string; updatedBy: string | null }
export interface ClubContactPayload { contact: { firstName: string; lastName: string; email: string; phone: string }; role: string; isPrimary: boolean; photoUrl: string | null }
listClubContacts(clubId): Promise<ClubContact[]>   // GET — plain array, no Page<T> (see Context)
createClubContact(clubId, payload): Promise<ClubContact>
updateClubContact(clubId, contactId, payload): Promise<ClubContact>
deactivateClubContact(clubId, contactId): Promise<ClubContact>
reactivateClubContact(clubId, contactId): Promise<ClubContact>
```

**12. `ui/src/components/ClubContactForm/`** (new, four-file anatomy) — mirrors `ProductForm`'s shape (`FormState`/`toFormState`/`validate`/`handleSubmit` local pattern, `<Box component="form" id={CLUB_CONTACT_FORM_ID} sx={{ display: 'contents' }}>` so `RecordFormScreen`'s grid owns layout) but flat, no tabs: First Name, Last Name, Email, Phone, Role (`Input`s), "Is primary contact" (`Checkbox`/`FormControlLabel`), and a Photo field (`<MediaUpload label="Photo" value={values.photoUrl} onUploaded={...} variant="logo" namespace="manage" />` — square avatar-style dimensions via the existing `'logo'` variant, no new `MediaUploadVariant` needed). Validation mirrors `ContactDto`'s backend rules (`@NotBlank` on all four contact fields + role, `@Email` format on email) — same "inline validation mirrors backend rules" precedent this codebase already uses elsewhere (`ClubForm`'s slug/email checks). `photoUrl` is optional, no validation.

**13. `ui/src/pages/manage/ClubContactList.tsx`** (new) — reads `clubId` via `useOutletContext<{ clubId?: string }>()` (identical guard pattern to `ManageClubProfilePage.tsx`: `!clubId` → `EmptyState`, `enabled: Boolean(clubId)` on the query). `useQuery(['managed-club', clubId, 'contacts'], () => listClubContacts(clubId))` — **no pagination state** (unlike `ProductList.tsx`; see Context). `ListToolbar` (search by name, sort by name/role — client-side filter/sort over the fetched array, justified since the collection is small and already fully fetched, not a violation of the backend-driven-pagination rule which targets unbounded collections). Grid of `RecordCard`s: `title` = full name, `badge` = `{label: 'Primary', tone: 'positive'}` or (if `!active`) `{label: 'Inactive', tone: 'muted'}`, `fields` = Role/Email/Phone, `secondaryAction` = Deactivate/Reactivate (`RecordCardSecondaryAction` shape, one mutation per card, no confirm step — matches the type's actual capability, no built-in confirm dialog exists). **`RecordCard` has no avatar/image slot** (confirmed prop shape: title/badge/description/fields/chips/secondaryAction/feedback only) — the photo is captured/edited in `ClubContactForm` only and is **not** shown in the list this pass; extending `RecordCard` with an avatar slot is a real but separate future enhancement, out of scope here (flag this explicitly, don't silently skip it).

**14. `ui/src/pages/manage/ClubContactFormPage.tsx`** (new) — `useOutletContext` for `clubId`, `useParams<{id?: string}>()` for the contact id (`isEdit`), `useQuery` for edit-mode fetch, one `useMutation` for create/update (branch inside `mutationFn`, mirroring `ProductFormPage.tsx`). `RecordFormScreen` (`backTo="/manage/club-contacts"`) wrapping `ClubContactForm`.

**15. `ui/src/pages/manage/ManagerDashboard.tsx`** — add a "Club Contacts" card to the `'Club manager'` group, `to: '/manage/club-contacts'`.

**16. `ui/src/App.tsx`** — three new routes under the existing `/manage` block, matching `onboarding`/`products`' exact naming convention: `club-contacts` (list), `club-contacts/new`, `club-contacts/:id/edit`.

## Frontend tests (`test-writer`, after frontend-builder)

- `ClubContactForm.test.tsx` + Storybook story — required-field validation (including email format), primary checkbox toggling, photo upload wiring (`MediaUpload namespace="manage"` calls `uploadManagedMedia`, `onUploaded` sets `photoUrl` in the submitted payload), submit payload shape.
- `MediaUpload.test.tsx` — extended per item 9 above (`namespace="manage"` case); all pre-existing cases (default `'platform'` namespace) must keep passing unmodified.
- `ClubContactList.test.tsx` — renders cards with correct badges (Primary/Inactive), search/sort filtering over the fetched array, deactivate/reactivate wiring calls the right mutation.
- `ClubContactFormPage.test.tsx` — create vs edit mode, `clubId`-from-context guard (mirrors `ManageClubProfilePage.test.tsx`'s no-`clubId` case), save flow.
- `ManagerDashboard.test.tsx` — same note as `020`'s plan: create this file only if it doesn't already exist elsewhere by then; otherwise extend it for the new card.

## E2E (`test-writer`)

Extend `ui/e2e/manager-club-profile.spec.ts`'s existing prerequisite rather than inventing a new one — the `smoketest-club-admin` account (see project memory `reference_smoketest_club_admin.md`, scoped to Riverside CC, `E2E_CLUB_ADMIN_*` env vars) is explicitly kept around for reuse. Add a new spec `ui/e2e/manager-club-contacts.spec.ts` (or a second `test()` in the existing file — prefer a new file, matching this repo's one-spec-per-flow convention), same `PREREQUISITE`/`test.skip(!!process.env.CI, ...)` shape: log in as the club admin, open Club Contacts, add a contact (including uploading a photo via the new `/manage/media` path), flag it primary, edit it, deactivate it, reactivate it, confirm persistence across a reload.

## Verification

- Backend: `./mvnw verify` from `backend/`.
- Frontend: `npm run lint && npm run test && npm run build` from `ui/` (remember `nvm use 22.12.0` first — plain `node` resolves to v12 on this machine).
- Manual smoke test: log in as `smoketest-club-admin` (already provisioned, see memory), confirm the Club Contacts card/list/create/edit/deactivate/reactivate flow end to end against a real (not stale) backend instance — restart the local `:8082` backend first if it predates this branch's code, same gotcha hit during `020`'s smoke test.
- OpenAPI: regenerate and diff `backend/openapi/openapi.yaml` per step 7 above.

## Order of work

0. Me, directly: amend `docs/specs/021-club-contacts.md` per item 0 above, before dispatching any builder.
1. `backend-builder`: entity, migration + changelog registration, DTOs, mapper, service/impl, controller, `MediaController`'s new mapping, OpenAPI regen.
2. `frontend-builder`: `mediaApi.ts`/`MediaUpload.tsx` namespace prop, `clubContactApi.ts`, `ClubContactForm`, `ClubContactList`, `ClubContactFormPage`, dashboard card, routes.
3. `test-writer`: backend unit/integration tests (including `MediaController`'s new mapping), frontend component tests (including `MediaUpload`'s new case), new e2e spec.
4. Manual smoke test, then `standards-reviewer` before PR, per `docs/workflow.md`.
