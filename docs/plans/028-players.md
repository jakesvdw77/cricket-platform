# Plan — 028: Players

## Context

`docs/specs/028-players.md` (already drafted and read in full this session) builds the last of the "sections/teams/players" trio `006` stubbed nav cards for — a real `/manage/players` screen, backed by a new `ClubMembership` entity (`001`'s own original design, never built), a new `PlayerProfile` (club-scoped profile data: basic/contact/medical/cricket info), a `PlayerSection` many-to-many tagging join (mirrors `SectionContact`), and two changes to the existing `Person` entity (`date_of_birth`/`gender` added, `email` made nullable).

This is the first spec in this epic to touch an entity (`Person`) with real, already-shipped consumers beyond this feature — research this session confirmed every one of them (Subscription creation, Keycloak provisioning, `MeServiceImpl.bridgeByEmail`, welcome email) is safe as-is, since all of them only ever run for a Subscription's responsible party, who always has an email; player creation never touches those code paths. One existing test *will* break and needs a real fix as part of this build (below).

Confirmed with the user before finalizing this plan: `PlayerFormPage` uses one flat 4-tab bar (Basic Info / Contact Info / Cricket Info / Sections) — mirrors `TeamFormPage`'s existing Details/Contacts/Sponsors pattern exactly, not `SponsorForm`'s self-contained-tabs-plus-cross-link shape. `PlayerForm` itself does not own tabs — `PlayerFormPage` does, passing down which of the three field-group tabs is active.

## Flags for review

1. **A real, currently-passing test will break and needs fixing, not just noting.** `backend/src/test/java/com/cricketlegend/repository/PersonRepositoryTest.java`'s `nullEmailIsRejectedAtTheDbLevel()` explicitly asserts a null-email `Person` save throws `DataIntegrityViolationException` — true today, false once this migration drops the `NOT NULL` constraint. Flip it to a positive assertion (`nullEmailIsAllowedAtTheDbLevel` or similar — save succeeds, `person.getEmail()` reads back `null`), and update that class's Javadoc header (currently claims "first_name/last_name/email are NOT NULL at the DB level" — no longer true for `email`). Confirmed via this session's research: every other `Person.builder()...build()` call site across the whole test suite already sets `.email(...)` explicitly, so nothing else needs touching.
2. **`PersonDto` may or may not need `dateOfBirth`/`gender` added** — not required by any endpoint this spec builds (nothing outside `Player` reads them yet), but harmless and additive if the build finds it convenient to route `PlayerDto`'s identity-field composition through the existing `PersonMapper`/`PersonDto` rather than hand-picking fields off `Person` directly. Either approach is fine — not a decision worth blocking on.

## Backend (`backend-builder`)

Mirrors `SectionServiceImpl`'s two-level scoping idiom for `PlayerSectionServiceImpl` (parent scope first, then an independent check on the sibling), and `TeamServiceImpl`'s "one service orchestrates its own composed entity" shape for `PlayerServiceImpl` (which owns `Person`+`ClubMembership`+`PlayerProfile` together, same as `TeamServiceImpl` alone owns `Team`).

**Extend `Person`:**
- `domain/Person.java` — add `@Column(name = "date_of_birth") private LocalDate dateOfBirth;` and `@Enumerated(EnumType.STRING) private Gender gender;` (bare nullable field, no annotations — exact mirror of `Section.gender`'s own declaration, confirmed via this session's research). Drop `nullable = false` from the `email` `@Column`.
- (Optional, see Flag #2) `dto/PersonDto.java` — add `dateOfBirth`/`gender` if convenient.
- `backend/src/test/java/com/cricketlegend/repository/PersonRepositoryTest.java` — the required fix from Flag #1.

**New entities:**
- `domain/ClubMembership.java` — `id, personId, clubId, validFrom (LocalDate, defaults today), validTo (LocalDate, nullable)`. No service/controller of its own (Non-goal) — used directly via its repository inside `PlayerServiceImpl`, same "a repository with no dedicated service, used internally by another entity's service" precedent as `SectionContactRepository` being used directly inside `SectionServiceImpl`.
- `domain/PlayerProfile.java` — every field from the spec's Data Model Changes (`personId, clubId, photoUrl, clubMembershipNumber, medicalAidProvider, medicalAidMemberNumber, phone, email, altContactName, altContactPhone, battingStance, bowlingArm, bowlingType, isWicketKeeper, active` + audit columns). Three new small enums: `domain/BattingStance.java` (`RIGHT_HANDED, LEFT_HANDED`), `domain/BowlingArm.java` (`RIGHT_ARM, LEFT_ARM`), `domain/BowlingType.java` (`FAST, FAST_MEDIUM, MEDIUM_FAST, MEDIUM, OFF_BREAK, LEG_BREAK, ORTHODOX_SPIN, WRIST_SPIN, GOOGLY` — the exact list from the spec's UI Requirements).
- `domain/PlayerSection.java` — bare join (`id, playerProfileId, sectionId, createdAt, createdBy`), mirrors `SectionContact.java` exactly.
- `repository/ClubMembershipRepository.java` — `findByPersonIdAndValidToIsNull` (the "current active membership" lookup, used by both create-time uniqueness reasoning and reactivate's conflict check).
- `repository/PlayerProfileRepository.java` — `findByClubId`, plus whatever `findOrThrowForClub`-style lookups the service needs.
- `repository/PlayerSectionRepository.java` — same method shape as `TeamSponsorRepository` (`findByPlayerProfileId`, `existsByPlayerProfileIdAndSectionId`, `findByPlayerProfileIdAndSectionId`, `deleteByPlayerProfileIdAndSectionId`).
- `dto/PlayerDto.java` — flat, composed from `Person` + `PlayerProfile` + `sectionIds: List<UUID>` (bare ids — frontend joins names client-side against its own `listSections` call, same pattern `TeamDirectory.tsx` already uses for section names).
- `dto/CreatePlayerRequest.java` / `dto/UpdatePlayerRequest.java` — flat, `@NotBlank` on `firstName`/`lastName` only (mirrors `Person`'s own two required columns), everything else optional with no annotation (mirrors `Gender`'s existing no-annotation pattern on `Section`'s own request DTOs).
- `mapper/PlayerMapper.java` — composes the three sources into `PlayerDto`; hand-written compose method (matching `TeamContactServiceImpl.list`'s own manual-compose precedent) rather than forcing MapStruct across three sources, unless the build finds MapStruct's multi-parameter mapping method support cleaner — either is fine.
- `service/PlayerService.java` + `service/impl/PlayerServiceImpl.java`:
  - `list(clubId)`, `create(clubId, request)`, `update(clubId, playerId, request)`, `deactivate(clubId, playerId)`, `reactivate(clubId, playerId)`.
  - `create`: builds a new `Person` (`status = ACTIVE` set directly, not via `PersonServiceImpl.findOrCreatePerson` — see spec's explicit reasoning), a `ClubMembership` (`validFrom = today`, `validTo = null`), and a `PlayerProfile`, all in one `@Transactional` method.
  - `update`: loads the existing `Person` (via `PlayerProfile.personId`) and writes `firstName`/`lastName`/`dateOfBirth`/`gender` onto it directly (no "link, don't overwrite" guard — this is an unambiguous, already-linked edit, not a best-guess dedup match; the spec is explicit this is a deliberate divergence from `findOrCreatePerson`'s own rule), alongside updating `PlayerProfile`'s own fields.
  - `deactivate`: `409` (`InvalidStatusTransitionException`) if already inactive; otherwise sets `PlayerProfile.active = false` and closes the `ClubMembership` (`validTo = today`) in the same transaction.
  - `reactivate`: `409` if already active; `409` (a second, distinct case — consider a named subclass or a clearly distinct message) if `ClubMembershipRepository.findByPersonIdAndValidToIsNull` already returns a *different* membership for this person by the time reactivation runs; otherwise reopens the membership (`validTo = null`) and sets `active = true`. The partial unique index (`ux_club_membership_active`) is the real DB-level backstop for this, same "service-level pre-check for a clean message + DB constraint as backstop" pattern `021`'s `ux_club_contact_primary` already established.
  - Cross-club isolation: `findOrThrowForClub(clubId, playerId)` private helper, same shape as every prior spec's.
- `service/PlayerSectionService.java` + `service/impl/PlayerSectionServiceImpl.java` — `list`, `link`, `unlink`, exact same shape as `TeamSponsorServiceImpl` (`027`): resolve the `PlayerProfile` belongs to `clubId` first, then independently validate `sectionId` belongs to the same `clubId` (mirrors `SponsorServiceImpl.findOrThrowForClub`'s idiom, applied here against `SectionRepository`). `409` if already tagged, `404` if not tagged to unlink.
- `controller/PlayerController.java` — 8 endpoints, every one with its own `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")`:

  | Endpoint | Purpose |
  |---|---|
  | `GET /api/v1/manage/clubs/{clubId}/players` | list |
  | `POST /api/v1/manage/clubs/{clubId}/players` | create (201) |
  | `PUT /api/v1/manage/clubs/{clubId}/players/{playerId}` | update |
  | `POST .../players/{playerId}/deactivate` | 409 if already inactive |
  | `POST .../players/{playerId}/reactivate` | 409 if already active, or a different active membership exists |
  | `GET .../players/{playerId}/sections` | list tagged sections |
  | `POST .../players/{playerId}/sections/{sectionId}/link` | 409 if already tagged |
  | `POST .../players/{playerId}/sections/{sectionId}/unlink` | 404 if not tagged |

- **Migration** — `backend/src/main/resources/db/changelog/v1/020-add-player.sql`, exact SQL already written in the spec's Data Model Changes (the `Person` `ALTER`, `club_membership`, `player_profile`, `player_section` — with `ux_club_membership_active` and both new unique constraints). Add its `<include>` to `db.changelog-master.xml` after `019-add-team-profile.sql`'s.
- **OpenAPI** — splice in the 8 new paths + `PlayerDto`/`CreatePlayerRequest`/`UpdatePlayerRequest` + `Person`'s `dateOfBirth`/`gender` additions, same run-the-app-and-diff process every prior spec used.

**Tests:**
- `service/PlayerServiceImplTest.java` (new) — create (all three rows created, `status = ACTIVE`, `email` stays `null` when omitted), update (writes through to `Person`), deactivate (closes membership) + its `409`, reactivate (reopens membership) + both its `409`s, cross-club `NotFoundException` isolation.
- `service/PlayerSectionServiceImplTest.java` (new) — link/unlink, `409`/`404`, cross-club rejection for `sectionId` and for the player scope (parent-check-fails-before-sibling-queried case, same as `TeamSponsorServiceImplTest`).
- `repository/PlayerProfileRepositoryTest.java` / `ClubMembershipRepositoryTest.java` (new, Testcontainers) — migration applies cleanly, both unique constraints reject a duplicate at the DB level.
- `controller/PlayerControllerIntegrationTest.java` (new) — real `CLUB_ADMIN` success across all 8 endpoints, cross-club `403`/`404`, `platform_admin` superset, all `409`/`404` cases through real HTTP.
- `repository/PersonRepositoryTest.java` (fix, Flag #1).

## Frontend (`frontend-builder`, after backend)

- `ui/src/api/playerApi.ts` (new) — `Player`/`PlayerPayload` types (flat, matching `PlayerDto`/`CreatePlayerRequest` — including `sectionIds` on the read type only), `listPlayers`, `createPlayer`, `updatePlayer`, `deactivatePlayer`, `reactivatePlayer`, `listPlayerSections`, `linkPlayerSection`, `unlinkPlayerSection`.
- `ui/src/components/PlayerForm/` (new, four-file anatomy) — **does not own its own `Tabs`** (per the confirmed decision). Props include `activeTab: 0 | 1 | 2` (controlled from `PlayerFormPage`), `initialValues?`, `onSubmit`. Renders one `<Box component="form" id={PLAYER_FORM_ID}>` with `{activeTab === 0 && (...)}`/`1`/`2` conditional field-group panels (same conditional-panel mechanism `SponsorForm` already uses internally, just with `activeTab` as a prop instead of owned state) — Basic Info (First/Last name, Date of birth, Gender select with "Not specified", `MediaUpload` photo, Club membership number, Medical aid provider/member number), Contact Info (Phone, Email, Alternative contact name/phone), Cricket Info (Batting stance / Bowling arm / Bowling type selects each with "Not specified", Wicketkeeper checkbox — the exact `BowlingType` option list from the spec).
- `ui/src/pages/manage/PlayerFormPage.tsx` (new) — owns the real `Tabs` bar: **Basic Info | Contact Info | Cricket Info | Sections**. Renders `<PlayerForm activeTab={activeTab} .../>` for tabs 0–2; the Save action (in `RecordFormScreen`'s `actions`) only shows when `activeTab !== 3` (mirrors `TeamFormPage`'s `activeTab === 0` check, generalized). Tab 3 ("Sections", edit mode only — needs a persisted id, same constraint as `026`/`027`): a `Chip` list of currently-tagged sections with an unlink action, "Link existing" opening `LinkExistingRecordDialog<Section>` (`027`, no `extraField` — tagging carries no extra data, candidates = the club's full section list filtered to exclude already-tagged ones) — no create-and-link (sections are created via Club Structure only).
- `ui/src/pages/manage/PlayerList.tsx` (new, replaces `006`'s `EmptyState`) — `ListToolbar` + `RecordCard` grid: `title` = full name, `fields` = a couple of identifying ones (date of birth, club membership number), `chips` = tagged section names (client-joined against `listSections(clubId)`, `RecordCard`'s `chips` prop's first real use in this codebase — the interface already supports it, just unused until now), muted "Inactive" badge, `editTo`/Deactivate-Reactivate `secondaryAction` — same shape as every other `/manage` list.
- `ui/src/App.tsx` — the existing `players` route's `element` changes from `<EmptyState title="Players" description="Coming soon." />` to `<PlayerList />`; add `players/new`, `players/:playerId/edit`.
- `ui/src/pages/manage/ManagerDashboard.tsx` — no change, its existing "Players" card already points at the right path.

**Tests:**
- `PlayerForm.test.tsx` + Storybook story (one story per `activeTab` value, since it's now prop-controlled) — field rendering per tab, validation, photo upload wiring.
- `PlayerList.test.tsx` — cards render with the right fields/chips/badge, deactivate/reactivate wiring.
- `PlayerFormPage.test.tsx` — all four tabs switch correctly, Save only shows on tabs 0–2, Sections tab is edit-mode-only, link/unlink wiring.

## Order

1. `backend-builder` — full backend slice + its own tests, including the `PersonRepositoryTest` fix (Flag #1).
2. Independently re-run `mvn test`.
3. `frontend-builder` — full frontend slice + its own tests (needs the real `PlayerDto`/endpoint shapes from step 1).
4. Independently re-run `npm run build`, `npm run lint`, `npm run test` (isolate touched files given this machine's known CPU-contention flake in the full run), `npm run test:storybook`.
5. `test-writer` — new `ui/e2e/manager-players.spec.ts`: add a player (all three tabs filled), confirm it appears, tag it to two sections, untag one, deactivate it, confirm it still shows (muted), reactivate it, reload and confirm every change persisted. Not wired into CI, same precedent as every prior `/manage` spec.
6. Manual smoke test against the real dev stack (backend restart + real Postgres + a real Keycloak token for `smoketest-club-admin`, same approach used for `026`/`027` since no browser-automation tool is available in this environment) — drive the new endpoints directly, confirm the migration applies to the real dev DB (including the `person.email` nullability change against whatever rows already exist there from this session's earlier smoke tests), confirm cross-club isolation.

## Verification

- `cd backend && ./mvnw test` — all new/fixed tiers pass, existing suite unaffected (specifically confirm `PersonRepositoryTest`'s flipped test passes and nothing else in the ~550-test suite regressed).
- `cd ui && npm run build && npm run lint && npm run test && npm run test:storybook` — all pass.
- Contract: `openapi.yaml` diff matches what springdoc actually generates.
- Live smoke test (real Postgres + real Keycloak token, `nvm use 22.12.0` first): create a player with no email, confirm `Person.email` is genuinely `null` in the DB (not empty string); tag/untag sections; deactivate (confirm `club_membership.valid_to` gets set); reactivate; confirm cross-club `403`/`404` on all 8 new endpoints.
