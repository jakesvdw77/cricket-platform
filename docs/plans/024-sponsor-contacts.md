# Plan: 024 — Sponsor Contacts

## Context

`docs/specs/024-sponsor-contacts.md` (approved) is the third and last spec in the mini-epic `022` started, closing out the `docs/roadmap.md` "Sponsors" entry. `023` shipped `Sponsor` without any way to name a contact person for one — deliberately deferred to this spec. `024` is a structural, field-for-field mirror of `021`'s `ClubContact` (same entity shape, same `saveAndFlush` primary-auto-unset fix, same list/CRUD API shape, same `ListToolbar`/`RecordCard`/`RecordFormScreen` UI pattern) except scoped one level deeper: a `SponsorContact` belongs to a `Sponsor`, which itself belongs to a `Club`, so every lookup needs **two-level** cross-tenant isolation (sponsor-belongs-to-club, then contact-belongs-to-sponsor) instead of `021`'s single level. Per the spec's own Non-goals, this pass deliberately has **no photo field** (unlike `021`, which gained one mid-implementation) — `SponsorContactForm` has no `MediaUpload`.

Verified against the real, already-shipped code before planning: `ClubContactServiceImpl`'s `saveAndFlush` mechanism, `findOrThrowForClub` pattern, `SponsorServiceImpl`'s own `findOrThrowForClub`/`requireClubExists` (the extra level `SponsorContactServiceImpl` now composes with), `SponsorController`'s existing `sponsors/{sponsorId}` URL nesting convention, and the next migration number (`015-add-sponsor.sql` is latest → `016-add-sponsor-contact.sql` is correctly next) — all match what the spec assumes.

## Backend changes

**1. `backend/src/main/java/com/cricketlegend/domain/SponsorContact.java`** (new) — mirrors `ClubContact.java`'s skeleton exactly (`@Entity`, Lombok `@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder`, generated `UUID id`, `@Embedded private Contact contact;`, `String role`, `boolean isPrimary`, `boolean active`, audit columns + `@PrePersist`/`@PreUpdate`), with `UUID sponsorId` (FK column, not PK) in place of `clubId`. **No `photoUrl` field** — the one deliberate structural difference from `ClubContact` (spec Non-goals).

**2. Migration — `backend/src/main/resources/db/changelog/v1/016-add-sponsor-contact.sql`** (next sequential after `023`'s `015-add-sponsor.sql`), exactly as specified in `024`'s Data Model Changes section (table + `ix_sponsor_contact_sponsor` index + partial unique index `ux_sponsor_contact_primary ... WHERE is_primary AND active`). Register it in `backend/src/main/resources/db/changelog/db.changelog-master.xml` directly after the `015` line.

**3. DTOs** — `dto/SponsorContactDto.java`, `dto/CreateSponsorContactRequest.java`, `dto/UpdateSponsorContactRequest.java`, nesting `ContactDto contact` (not flattened), same shape as `021`'s equivalents minus `photoUrl`:
```java
public record SponsorContactDto(UUID id, UUID sponsorId, ContactDto contact, String role, boolean isPrimary, boolean active, Instant createdAt, Instant updatedAt, UUID updatedBy) {}
public record CreateSponsorContactRequest(@Valid @NotNull ContactDto contact, @NotBlank String role, boolean isPrimary) {}
public record UpdateSponsorContactRequest(@Valid @NotNull ContactDto contact, @NotBlank String role, boolean isPrimary) {}
```
`ContactDto`'s own `@NotBlank`/`@Email` annotations do the field-level validation, same as `021`.

**4. `mapper/SponsorContactMapper.java`** (new, `@Mapper(componentModel = "spring")`) — `toDto(SponsorContact)`, `toEntity(CreateSponsorContactRequest)` (`id`/audit/`active`/`sponsorId` ignored, set by the service). Same nested-`Contact`-mapping approach as `ClubContactMapper` — confirm `SponsorContactMapperImpl` compiles cleanly; if MapStruct can't infer the nested mapping, add explicit `Contact toContact(ContactDto)`/`ContactDto toContactDto(Contact)` to this same mapper class rather than a new file.

**5. `service/SponsorContactService.java` + `service/impl/SponsorContactServiceImpl.java`** — `list(clubId, sponsorId)`, `create(clubId, sponsorId, request)`, `update(clubId, sponsorId, contactId, request)`, `deactivate(clubId, sponsorId, contactId)`, `reactivate(clubId, sponsorId, contactId)`. Injects `SponsorRepository` (to verify the sponsor belongs to the club) and `SponsorContactRepository`. Key behaviors:
- `findOrThrowSponsorForClub(clubId, sponsorId)` — mirrors `SponsorServiceImpl.findOrThrowForClub` exactly (404 if the sponsor doesn't exist or belongs to a different club). Called first, in every method.
- `findOrThrowContactForSponsor(sponsorId, contactId)` — 404s if the contact doesn't exist or belongs to a different sponsor. Called second, after the sponsor is confirmed.
- `create`/`update`: when `request.isPrimary() == true`, unset `isPrimary` on any other `active` `SponsorContact` for the same `sponsorId`, via `sponsorContactRepository.saveAndFlush(existing)` — **the `saveAndFlush` fix applied from day one**, not `save` (see `ClubContactServiceImpl`'s Javadoc for the full flush-ordering mechanism this avoids).
- `deactivate`/`reactivate`: mirror `ClubContactServiceImpl`'s one-way-transition-guard shape — `InvalidStatusTransitionException` (existing class, reused as-is) if already in the target state.
- `@Transactional` on `create`/`update`.

**6. `controller/SponsorContactController.java`** (new) — five endpoints, all under `/api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts`, all `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")`:
```
GET    /api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts                        -> List<SponsorContactDto>
POST   /api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts                        -> SponsorContactDto
PUT    /api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}            -> SponsorContactDto
POST   /api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}/deactivate -> SponsorContactDto
POST   /api/v1/manage/clubs/{clubId}/sponsors/{sponsorId}/contacts/{contactId}/reactivate -> SponsorContactDto
```
Thin pass-through to the service, DTOs only across the boundary — same shape as `ClubContactController`/`SponsorController`.

**7. Regenerate `backend/openapi/openapi.yaml`** — same manual process used for `021`/`023` (run the backend locally on a scratch port, `curl .../v3/api-docs.yaml`, splice in the five new paths + `SponsorContactDto`/`CreateSponsorContactRequest`/`UpdateSponsorContactRequest` schemas).

**Assigned to:** `backend-builder`.

## Backend tests (`test-writer`, after backend-builder)

- `SponsorContactServiceImplTest` (unit) — create/update, primary auto-unset via `saveAndFlush` (verified via mock, same assertion shape as `021`'s corrected test), deactivate/reactivate transitions and their `409`s, two-level cross-tenant `NotFoundException` isolation (wrong sponsor for the contact, and sponsor-belongs-to-wrong-club).
- `SponsorContactRepositoryTest` (Testcontainers) — migration applies cleanly; the partial unique index rejects two simultaneous active primaries inserted directly.
- `SponsorContactControllerIntegrationTest` (Testcontainers, `PlatformRoleJwtPostProcessors.withSubject` pattern) — real `CLUB_ADMIN` success on their own club/sponsor, `403`/`404` for a different club or a `sponsorId` belonging to another club, `platform_admin` superset success, and the create-a-second-primary-succeeds-through-the-HTTP-layer case passing on the first try (the exact scenario `021` initially got wrong).

## Frontend changes (`frontend-builder`)

**8. `ui/src/api/sponsorContactApi.ts`** (new) — mirrors `clubContactApi.ts`'s shape, minus `photoUrl`, base path `/manage/clubs/${clubId}/sponsors/${sponsorId}/contacts`:
```ts
export interface SponsorContact { id: string; sponsorId: string; contact: { firstName: string; lastName: string; email: string; phone: string }; role: string; isPrimary: boolean; active: boolean; createdAt: string; updatedAt: string; updatedBy: string | null }
export interface SponsorContactPayload { contact: { firstName: string; lastName: string; email: string; phone: string }; role: string; isPrimary: boolean }
listSponsorContacts(clubId, sponsorId): Promise<SponsorContact[]>
createSponsorContact(clubId, sponsorId, payload): Promise<SponsorContact>
updateSponsorContact(clubId, sponsorId, contactId, payload): Promise<SponsorContact>
deactivateSponsorContact(clubId, sponsorId, contactId): Promise<SponsorContact>
reactivateSponsorContact(clubId, sponsorId, contactId): Promise<SponsorContact>
```

**9. `ui/src/components/SponsorContactForm/`** (new, four-file anatomy) — a near-copy of `ClubContactForm.tsx`'s pattern (First Name, Last Name, Email, Phone, Role `Input`s + "Is primary contact" checkbox, same client-side validation mirroring `ContactDto`'s backend rules), **no `MediaUpload`/photo field** (spec Non-goals) and a `SponsorContactPayload` instead of `ClubContactPayload`. Genuine near-copy, not an import — different payload shape, per the spec's own UI Requirements note.

**10. `ui/src/pages/manage/SponsorContactList.tsx`** (new) — near-identical to `ClubContactList.tsx`: `sponsorId` from `useParams<{ sponsorId: string }>()`, `clubId` from `useOutletContext<{ clubId?: string }>()` (still needed for the API's `clubId`-scoped URL and query key). `useQuery(['managed-club', clubId, 'sponsors', sponsorId, 'contacts'], ...)`, no pagination state, `ListToolbar` (search by name, sort by name/role), grid of `RecordCard`s with Primary/Inactive badges and a deactivate/reactivate `secondaryAction`, same as `ClubContactList`. **Back link goes to `/manage/sponsors/{sponsorId}/edit`** (a sponsor contact's natural "back" is its owning sponsor), not `/manage` — the one navigational difference from `ClubContactList`.

**11. `ui/src/pages/manage/SponsorContactFormPage.tsx`** (new) — near-identical to `ClubContactFormPage.tsx`: `sponsorId` from route params, `clubId` from `Outlet` context, `contactId` from `useParams` for edit mode, edit-mode fetches the full list and finds the matching row client-side (no single-contact GET endpoint, matching `SponsorFormPage`/`ClubContactFormPage`'s established convention). `RecordFormScreen` with `backTo="/manage/sponsors/${sponsorId}/contacts"`.

**12. `ui/src/pages/manage/SponsorFormPage.tsx`** (amended) — add a "Manage Contacts →" link to `/manage/sponsors/{id}/contacts`, visible only when `isEdit` is true (a brand-new, unsaved sponsor has no id to attach contacts to). Placed near the existing form actions/header, matching this codebase's existing pattern for a record-detail cross-link.

**13. `ui/src/App.tsx`** — new routes nested under the existing `sponsors/:id/edit` block:
```
sponsors/:sponsorId/contacts                    -> SponsorContactList
sponsors/:sponsorId/contacts/new                -> SponsorContactFormPage
sponsors/:sponsorId/contacts/:contactId/edit     -> SponsorContactFormPage
```

## Frontend tests (`test-writer`, after frontend-builder)

- `SponsorContactForm.test.tsx` + Storybook story — required-field validation (including email format), primary checkbox toggling, submit payload shape.
- `SponsorContactList.test.tsx` — renders cards with correct badges, search/sort filtering, deactivate/reactivate wiring, back-link target.
- `SponsorContactFormPage.test.tsx` — create vs edit mode, `clubId`-from-context guard, save flow.
- `SponsorFormPage.test.tsx` — extended for the new "Manage Contacts" link (present only in edit mode, absent in create mode).

## E2E (`test-writer`)

Extends `020`/`021`/`023`'s `smoketest-club-admin` prerequisite (project memory `reference_smoketest_club_admin.md`). New spec `ui/e2e/manager-sponsor-contacts.spec.ts`: from an existing sponsor, open Manage Contacts, add a contact, flag it primary, add a second contact and flag *it* primary (confirming the first's flag clears with no error), deactivate one, reactivate it.

## Verification

- Backend: `./mvnw verify` from `backend/`.
- Frontend: `npm run lint && npm run test && npm run build` from `ui/` (`nvm use 22.12.0` first).
- Manual smoke test: log in as `smoketest-club-admin`, confirm the Sponsor → Manage Contacts → list/create/edit/deactivate/reactivate flow end to end against a real (not stale) backend instance.
- OpenAPI: regenerate and diff `backend/openapi/openapi.yaml` per step 7.

## Order of work

1. `backend-builder`: entity, migration + changelog registration, DTOs, mapper, service/impl, controller, OpenAPI regen.
2. `frontend-builder`: `sponsorContactApi.ts`, `SponsorContactForm`, `SponsorContactList`, `SponsorContactFormPage`, `SponsorFormPage` amendment, routes.
3. `test-writer`: backend unit/integration tests, frontend component tests, new e2e spec.
4. Manual smoke test, then `standards-reviewer` before PR, per `docs/workflow.md`.
