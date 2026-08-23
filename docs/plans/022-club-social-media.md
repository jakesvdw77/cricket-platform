# Plan: 022 — Club Social Media

## Context

`docs/specs/022-club-social-media.md` (approved) is the first of a three-spec mini-epic (022/023/024) building sponsors and social media links, split from one combined draft for the same reason `020`/`021` stayed small. It adds a free-text `SocialLink` (platform + URL) to `ClubProfile` via JPA's `@ElementCollection` — a genuinely new pattern for this codebase (verified: zero existing `@ElementCollection` usage) — and a new editable `SocialLinksFields` component, surfaced as a 5th tab on `ClubForm`. No new endpoint: this amends `020`'s existing `PUT /api/v1/manage/clubs/{id}/profile` (and `012`'s `/platform` counterpart) with one new field.

Two things confirmed during exploration that shape this plan:
- **MapStruct auto-maps the new list** the same way it already auto-maps `Address`→`AddressDto` today — one new `SocialLinkDto toDto(SocialLink)` method is enough; no explicit `@Mapping` needed.
- **`UpdateClubProfileRequest` and `ClubProfileDto` are both records constructed *positionally* throughout the existing test suite** (`ClubProfileServiceImplTest`'s `dummyDto(...)`, every request literal). Adding a new trailing component breaks every one of those call sites at compile time — this is a real, unavoidable mechanical fix, not optional cleanup, and is called out explicitly below so it isn't missed.
- **No repeatable add/remove-row UI pattern exists anywhere in this codebase today** (confirmed via search) — `SocialLinksFields`'s row-mutation mechanics (add row, remove row, swap to a custom-label input) are genuinely new UI work, not a copy of prior art. `AddressFields` is the closest precedent for the "controlled `value`/`onChange`, no internal fetch" shape only.
- **Icon availability**: of the 10 popular platforms named in the spec, `@mui/icons-material` (installed v5.18.0) has real icons for facebook/instagram/x/youtube/linkedin/whatsapp/pinterest but **not** tiktok/threads/snapchat. Design decision (below): those three get the same generic fallback icon a fully custom platform gets — no special-casing needed, one fallback mechanism covers both.

**Plan-time decision the spec explicitly deferred** ("decide and document which during implementation planning" — spec's own Test Plan wording): a request containing two `SocialLink`s with the same `platform` is **rejected with a `400 ValidationException`**, not silently de-duplicated. Reasoning: the DB's composite primary key would otherwise surface as a raw `DataIntegrityViolationException` (an ugly, unhandled constraint violation) rather than a clean, documented error — validating before persisting matches this codebase's existing "validate at the service boundary, don't leak persistence exceptions" convention (`docs/standards/backend.md`'s exception table exists precisely so callers get a named, mapped error).

## Backend changes

**1. `backend/src/main/java/com/cricketlegend/domain/SocialLink.java`** (new) — plain `@Embeddable`, two fields, `platform` (`String`) and `url` (`String`), no `@Column` overrides needed (raw field names `platform`/`url` already match the migration's column names for the `@ElementCollection` side table).

**2. `backend/src/main/java/com/cricketlegend/dto/SocialLinkDto.java`** (new) — `record SocialLinkDto(@NotBlank String platform, @NotBlank @Pattern(regexp = "^https?://.+") String url)`, mirroring `UpdateClubProfileRequest.website`'s existing `@Pattern` precedent for "basic format check, not a link-verification service."

**3. `backend/src/main/java/com/cricketlegend/domain/ClubProfile.java`** — add:
```java
@ElementCollection
@CollectionTable(name = "club_profile_social_link", joinColumns = @JoinColumn(name = "club_id"))
@Builder.Default
private List<SocialLink> socialLinks = new ArrayList<>();
```
The `@Builder.Default` is required — this class uses Lombok `@Builder`, and every existing builder-based test construction would otherwise get `null` instead of an empty list.

**4. `backend/src/main/java/com/cricketlegend/dto/ClubProfileDto.java`** — append `List<SocialLinkDto> socialLinks` as the new final record component. **Every positional construction of this record breaks at compile time** — production code's `ClubProfileServiceImpl.defaultDto(UUID)` needs its trailing `null` list updated to `List.of()`; test call sites are `test-writer`'s job (see Backend tests below), but flag this clearly so it isn't mistaken for an unrelated compile failure.

**5. `backend/src/main/java/com/cricketlegend/dto/UpdateClubProfileRequest.java`** — append `List<SocialLinkDto> socialLinks` as the new final record component. Same positional-breakage note as #4.

**6. `backend/src/main/java/com/cricketlegend/mapper/ClubProfileMapper.java`** — add one line: `SocialLinkDto toDto(SocialLink socialLink);` (mirrors the existing `AddressDto toDto(Address address)` line exactly). MapStruct auto-generates the `List<SocialLink>` → `List<SocialLinkDto>` mapping for free once this element-level method exists — no other change to this file.

**7. `backend/src/main/java/com/cricketlegend/service/impl/ClubProfileServiceImpl.java`**:
- Add a private `toSocialLinks(List<SocialLinkDto> dtos)` helper mirroring the existing `toAddress(AddressDto)` hand-rolled DTO→entity conversion — `null`/omitted input maps to `new ArrayList<>()` (empty), matching the spec's "omitting it clears all links" semantics.
- **Before persisting**, check for a duplicate `platform` value (case-sensitive exact match is fine — a club typing "Facebook" and "facebook" as two different customs is an edge case not worth solving) within the incoming list; throw `ValidationException` if found (per the plan-time decision above).
- In `upsert()`, add `profile.setSocialLinks(toSocialLinks(request.socialLinks()))` alongside the other field setters.
- Update `defaultDto(UUID)`'s positional `ClubProfileDto` construction to include `List.of()` for the new trailing component.

**8. `backend/src/main/java/com/cricketlegend/controller/ClubProfileController.java`** — **no change**. All four existing endpoints (`/platform` and `/manage` × `GET`/`PUT`) already pass the full DTO/request through; the new field flows end-to-end with zero controller-level changes.

**9. Migration — `backend/src/main/resources/db/changelog/v1/014-add-club-profile-social-links.sql`** (next sequential after `021`'s `013-add-club-contact.sql`), exactly as specified in the spec's Data Model Changes section — `club_profile_social_link` table, composite PK (`club_id`, `platform`), `VARCHAR(64)` for `platform` (wide enough for an arbitrary custom label). Register in `db.changelog-master.xml` with `<include file="db/changelog/v1/014-add-club-profile-social-links.sql" relativeToChangelogFile="false"/>` directly after the existing `013` line.

**10. Regenerate `backend/openapi/openapi.yaml`** — same manual process as every prior spec (scratch port if `:8082` is already running, `curl .../v3/api-docs.yaml`, splice in the amended `ClubProfileDto`/`UpdateClubProfileRequest` schemas plus the new `SocialLinkDto` schema — no new path, only schema changes).

**Assigned to:** `backend-builder`.

## Backend tests (`test-writer`, after backend-builder)

- **Fix every existing positional-record call site** broken by `ClubProfileDto`/`UpdateClubProfileRequest`'s new trailing component — primarily in `ClubProfileServiceImplTest`'s `dummyDto(...)` helper and its request literals. This is a mechanical, unavoidable fix to get the suite compiling again, not new coverage — call it out as its own first step so it isn't confused with the real new tests below.
- `ClubProfileServiceImplTest` — new cases: `socialLinks` round-trips through `upsert()`, a duplicate-`platform` request throws `ValidationException`, omitting `socialLinks` clears any existing links (empty list, not left unchanged).
- `ClubProfileRepositoryTest` — new case: inserting two `club_profile_social_link` rows with the same (`club_id`, `platform`) directly via the repository (bypassing the service) throws `DataIntegrityViolationException` — proves the DB-level composite-PK backstop is real, mirroring `021`'s `ClubContactRepositoryTest` partial-index proof shape.
- `ClubProfileControllerIntegrationTest` — extend the existing full-round-trip tests (both `/platform` and `/manage` `PUT` cases) to include `socialLinks` in the request JSON and assert it comes back correctly; add one new case for the duplicate-platform `400`.

## Frontend changes (`frontend-builder`)

**11. `ui/src/components/marketing/SocialLinksRow/SocialLinksRow.tsx`** — expand `SocialPlatform` from 5 to 10 values (`facebook | instagram | x | tiktok | youtube | linkedin | whatsapp | threads | pinterest | snapchat`). `ICONS` stays a **partial** lookup (only the 7 platforms with a real `@mui/icons-material` icon: facebook/instagram/x/youtube/linkedin/whatsapp/pinterest); at render time, `const Icon = ICONS[platform] ?? LinkIcon` — one fallback mechanism covers both "known platform without a dedicated icon" (tiktok/threads/snapchat) and any fully custom platform string a `SocialLinksFields` row produces, no special-casing needed. `LABELS` similarly falls back to the raw platform string (`LABELS[platform] ?? platform`) for `aria-label` on an unrecognized value. The 1 existing test (facebook+x) must keep passing unmodified.

**12. `ui/src/components/SocialLinksFields/`** (new, four-file anatomy per `docs/standards/frontend.md`) — the genuinely new UI mechanics flagged in Context above. `SocialLinksFieldsProps { value: SocialLink[]; onChange: (links: SocialLink[]) => void }`, controlled, no internal fetching (same shape as `AddressFields`). Per row: a `Select` offering every `SocialPlatform` not already present in `value`, plus a trailing **"Custom…"** option that swaps the `Select` for a free-text platform-label `Input`; a URL `Input` alongside; a remove `IconButton`. An "Add link" button below appends a new row (defaults to the first unused known platform, or "Custom…" if all 10 are already used). Client-side validation mirrors the backend: URL format (reuse `ClubForm`'s existing `WEBSITE_PATTERN` regex or import a shared one), and a blank/duplicate platform string is rejected inline rather than allowed through to a failed save.

**13. `ui/src/components/ClubForm/ClubForm.tsx`**:
- New `const socialTab = showBasicInfo ? 4 : 3` (follows the exact `showBasicInfo ? n : n-1` pattern the existing `contactTab`/`addressTab`/`brandingTab` already use).
- Tab list gains `{renderTab('Social Media')}` after Branding — reuses the existing `renderTab` helper as-is (handles the disabled/tooltip "Save the club first" state in create mode automatically).
- New content panel: `{activeTab === socialTab && profileEnabled && <SocialLinksFields value={values.socialLinks} onChange={handleSocialLinksChange} />}`, wrapped in a full-width `Box sx={{ gridColumn: '1 / -1' }}` (a row-list doesn't fit the existing 2-column field grid the way individual `Input`s do).
- `FormState` gains `socialLinks: SocialLink[]`; `toFormState()` defaults it to `profileInitialValues?.socialLinks ?? []`; `handleSubmit`'s constructed `profile` payload includes `socialLinks: values.socialLinks`.
- **Verify all 18 existing `ClubForm.test.tsx` cases still pass unmodified** — none should assert an exact tab count, but this needs confirming, not assuming, since a 5th tab is now always present in both modes.

**14. `ui/src/api/clubApi.ts`** — import `SocialLink` (type only) from `../components/marketing/SocialLinksRow`; add `socialLinks: SocialLink[]` to both the `ClubProfile` and `ClubProfilePayload` interfaces. No changes needed to `ClubFormPage.tsx`/`ManageClubProfilePage.tsx` — both already pass `ClubForm`'s constructed payload straight through to their save mutation without touching individual fields.

## Frontend tests (`test-writer`, after frontend-builder)

- `SocialLinksRow.test.tsx` — extend for the generic-icon fallback (an unrecognized platform string renders `LinkIcon`, not a crash) and the expanded label set.
- `SocialLinksFields.test.tsx` + Storybook story (new) — add a row, remove a row, switching a row to "Custom…" reveals a free-text label input and round-trips it, a duplicate platform is rejected inline, URL format validation.
- `ClubForm.test.tsx` — extend for the Social Media tab's presence/enabled-state in both `'full'` and `'profileOnly'` mode, and that submit includes `socialLinks` in the payload. All 18 pre-existing cases must remain green, unmodified.

## E2E (`test-writer`)

Extend `020`'s existing club-profile e2e coverage (`ui/e2e/manager-club-profile.spec.ts`, the `smoketest-club-admin` prerequisite): add a social link (one known platform, one custom), save, reload, confirm both persisted; remove one, save, reload, confirm it's gone.

## Verification

- Backend: `./mvnw verify` from `backend/`.
- Frontend: `npm run lint && npx vitest run --pool=threads --poolOptions.threads.maxThreads=4 && npm run build` from `ui/` (`nvm use 22.12.0` first).
- Manual smoke test: log in as `smoketest-club-admin` (already provisioned, see project memory), add a known-platform link and a custom link to Club Profile's new Social Media tab, save, reload, confirm both persisted with correct icons/fallback.
- OpenAPI: regenerate and diff `backend/openapi/openapi.yaml` per step 10 above.

## Order of work

1. `backend-builder`: `SocialLink`/`SocialLinkDto`, `ClubProfile`/`ClubProfileDto`/`UpdateClubProfileRequest` changes, `ClubProfileMapper`, `ClubProfileServiceImpl` (including the duplicate-platform validation), migration + changelog registration, OpenAPI regen.
2. `frontend-builder`: `SocialLinksRow` amendment, new `SocialLinksFields`, `ClubForm`'s 5th tab, `clubApi.ts` type additions.
3. `test-writer`: fix broken positional-record test call sites first, then new backend tests, frontend tests, e2e extension.
4. Manual smoke test, then `standards-reviewer` before PR, per `docs/workflow.md`.
