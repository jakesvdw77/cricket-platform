# Plan: spec 099, Fields directory

## Context
Spec `docs/specs/099-fields-directory.md` (revised 2026-10-13, mockups approved, artifact 169hZbqsa8pKr9jhqoLu7z) adds a platform-wide directory of cricket fields: captured by managers, verified by a platform admin, linked to clubs as home fields, selectable on a match, with a nullable `ground_id` and an `area_type` kept ready for step 2 (grounds, nets, bookings). A field is a `PlayingArea` row (`area_type = CRICKET_FIELD`); the UI only ever says Field. Nothing here is built; the plan follows the two exploration reports (backend and frontend patterns) and the standards docs.

Branch: one branch `feat/099-fields-directory`, cut from the current docs branch so the spec travels with it (`feedback_one_place_not_many_branches`: one branch, one PR, the user's checkout stays on it). Never run `mvn` in `backend/` under the live app: verify in an rsync'd scratch copy and edit `backend/openapi/openapi.yaml` by hand (`feedback_dont_build_under_live_backend`). Node: `nvm use 22.12.0` before any `ui/` command (`reference_node_version_gotcha`).

## Findings that shape the plan
- Platform admin endpoints live under `/api/v1/platform/**` and `SecurityConfig` gates them by URL; `/manage/**` needs a per-method `@PreAuthorize("@access.canAccessClub(authentication, #clubId)")`.
- Closest copies: `PlayerController/PlayerServiceImpl.changeVerificationStatus` + `utils/playerStatus.ts` + `PlayerStatusMenu` + `usePlayerStatusActions` (status), `MatchController/MatchServiceImpl/MatchSpecifications` (paged list, `/summary` from the same `Specification`, `/filter-options`), `ClubPicker` (server-search Autocomplete), `MatchForm` (compact form), `PlayerCard`/`PlayerTable`/`PlayerDetailPage`, `MatchList` (paged page state), `LeagueTable` etc.
- `PlayerMapper` is hand-written, not MapStruct; use MapStruct for PlayingArea (`MatchMapper` is the model). `PlayerServiceImpl.summary` filters in memory; do not copy that, use `MatchServiceImpl.summary` (`count(Specification)`).
- `SelectionRejectedException` + its `GlobalExceptionHandler` method is the pattern for an exception carrying a property (`DuplicateFieldException.existingPlayingAreaId`).
- `Match` uses flat UUID columns. `MatchServiceImpl.enrichList` rebuilds `MatchDto` positionally: every new DTO component must be added there and in every `new MatchDto(...)` in tests.
- Every backend `getVenue()` reader keeps working because `venue` is kept equal to the field name.
- Frontend `venue` references are many; only `MatchForm`, `MatchFormPage`, `MatchCard`, `MatchKeyFigures`, `MatchDetailPage` and `matchApi.ts` change. The three Playwright specs and four unit tests that assert the "Venue" label change.

## Flags for your review (spec versus code; plan's resolution in bold)
1. **"Did you mean" matching (Open question 4).** The spec recommends `pg_trgm`, but no migration uses extensions and the production role is unconfirmed. **Plan: ship without an extension (normalised name, same country, prefix/contains), written so `pg_trgm` can replace it later.** Say if you want `pg_trgm` now.
2. **Field card base.** Spec leaves it to the plan. **Plan: a standalone `FieldCard` in `components/FieldCard/` modelled on `PlayerCard` (own three-column footer, disabled Edit with tooltip), because `RecordCard.footerButtons` cannot guarantee identical parts and height.**
3. **`MatchTable` has no venue column.** **Plan: do not add one; the flag appears on the match card, match page, form and detail only.** (Spec 8 allowed either.)
4. **`ConfirmDialog` has no reason input.** **Plan: extend it with an optional required `reason` prop (reuse check first), not a new dialog.**
5. **"Show only our fields" default** depends on loaded data. **Plan: stored filter value is `true | false | null`; `null` (never chosen) resolves to "on" once the first summary reports own fields, else off; the user's choice is then saved.**
6. **Frontend naming.** Directory data is global but routes are club-scoped, so query keys are `['managed-club', clubId, 'playing-areas', ...]`; the admin side has no club and uses `['platform', 'playing-areas', ...]`.
7. **No dependency-cruiser or folder-shape script and no CI contract diff exist** although the standards describe them. **Plan: do not add them in this PR; follow the rules by hand (components never import pages or axios).** Tracked in the roadmap.
8. **Section-only admins.** Plan uses `canAccessClub` as the spec recommends (Open question 9).
9. **Club country to ISO** for the form's country fallback needs a name-to-code lookup from `utils/countries.ts` (new, no country list exists).

## Order of work (each step ends with one commit. **Amended 2026-10-13 by the user: no tests and no standards review per step.** Build to functional correctness first; the user checks it; only after approval do `test-writer` (spec Test Plan) and `standards-reviewer` run. A compile or build check alone is allowed.)

### Slice A: backend (`backend-builder`, then `test-writer`), scratch copy only
- **A1 Schema and entities.** `db/changelog/v1/041-playing-areas.sql` (confirm the number is free; `playing_area`, `club_playing_area`, `match.playing_area_id`, CHECKs, `ux_playing_area_identity` functional unique index with `WHERE merged_into_id IS NULL`, search and status indexes) and its `db.changelog-master.xml` include. `domain/PlayingArea`, `ClubPlayingArea` (embedded `Address`, flat UUIDs), enums `PlayingAreaType/Category/OwnerType/VerificationStatus`; `Match.playingAreaId`. Repositories `PlayingAreaRepository` (`JpaSpecificationExecutor`), `ClubPlayingAreaRepository`; `PlayingAreaSpecifications` (modelled on `MatchSpecifications`).
- **A2 Club-scoped service and controller.** `PlayingAreaService/Impl` and `PlayingAreaController` under `/api/v1/manage/clubs/{clubId}/playing-areas` (list, summary, filter-options, similar, get, create, update, `/home` PUT/DELETE). DTOs, MapStruct `PlayingAreaMapper`. Rules: `area_type` forced to `CRICKET_FIELD`, auto home-link, edit only creator club while unverified, required street/city/country, ISO country check, https-only map URL. Exceptions `DuplicateFieldException` (with handler adding `existingPlayingAreaId`), `FieldNotEditableException`, `FieldRejectedException`, `PlayingAreaNotMatchableException`.
- **A3 Match integration.** `MatchDto`, `CreateMatchRequest`, `UpdateMatchRequest` gain the three playing-area fields; `MatchServiceImpl` create/update sync `venue`, resolve merged ids, refuse rejected/non-field; `enrichList` and `MatchMapper` (`ignore` the derived fields) updated; `MatchSpecifications.playingAreaIdEquals` and `GET /matches?playingAreaId`; `new MatchDto(...)` call sites in tests updated.
- **A4 Platform moderation.** `PlatformPlayingAreaController` under `/api/v1/platform/playing-areas` (list, summary, get, edit, verify with `verified_by_subject = authentication.getName()`, reject with reason, reopen, merge). Merge is one transaction using a `@Modifying` bulk update on `MatchRepository` (the `propagateLeagueTeamToHomeSide` style) plus link de-duplication.
- **A5 Contract.** Hand-edit `backend/openapi/openapi.yaml`; run the scratch-copy test suite (including `LayeringRulesTest`).

### Slice B: frontend (`frontend-builder`, then `test-writer`), after A
- **B1 Foundations.** `api/playingAreaApi.ts`, `api/platformPlayingAreaApi.ts`; `matchApi.ts` optional fields; `utils/fieldStatus.ts` (copy of `playerStatus.ts` shape: Reopen replaces Suspend), `utils/countries.ts`, `utils/countryFromTimeZone.ts`, club-country-to-ISO helper.
- **B2 Shared extensions.** `AddressFields` (optional ISO country select and province label map; `ClubForm` unchanged), `KeyFigureTile` `to` prop, `ConfirmDialog` `reason`, `NavTile` count prop, nav glyph `PlaceOutlined` in `navGlyphs.ts`. Each with its existing test and story updated.
- **B3 Field components** (four-file anatomy each): `FieldCard`, `FieldTable`, `FieldStatusMenu`, `FieldFormFields`, `FieldFormDialog`, `FieldPicker`; hooks `useFieldStatusActions`.
- **B4 Manager pages.** `pages/manage/fields/FieldsPage` (counters, `FilterBar` with `extraSelects`, `ContentControlsLine`, Cards | List, `usePersistedListFilters('fieldList:filters:<clubId>')`, `useListViewPreference('fieldList:view')`, paged like `MatchList`), `FieldDetailPage`, `FieldFormPage`; routes `fixtures/fields`, `fixtures/fields/new`, `:fieldId`, `:fieldId/edit` in `App.tsx`; "Fields" item in the Schedule group of `managerNav.ts` (`managerNav.test.ts` reads the route literal).
- **B5 Match integration.** `MatchForm` (`clubId` prop, `FieldPicker` labelled "Field (optional)", unverified/rejected alerts), `MatchFormPage`, `MatchCard` badge, `MatchKeyFigures` linked tile, `MatchDetailPage`, Matches `FilterBar` Field filter. Update the four unit tests and three Playwright specs that use the "Venue" label.
- **B6 Platform pages.** `/admin/fields` list and detail (merge confirm), a route and top-nav item in `AdminHome`, "Fields to verify" tile and count on `AdminDashboard`.
- **B7 E2E.** New Playwright golden path (manager adds an away field inline, admin verifies, second club reuses), skipped in CI like the others; needs `E2E_CLUB_ADMIN_*` for a second club.

### Docs (last commit, `frontend-builder`)
`docs/standards/design-system.md`, `frontend.md`, `backend.md` (verifier stamp, exception-with-property), `docs/roadmap.md` (already carries the 099 section; mark built), `docs/architecture.md` if it lists match relationships, spec status to built.

## Reuse (do not rebuild)
`AddressFields`, `Address`/`AddressDto`, `ManageScreenHeader`, `PageCounters`, `FilterBar` (`extraSelects`), `ContentControlsLine` (`SortLink`), `ListViewToggle` + `useListViewPreference`, `usePersistedListFilters`, `CompactSwitch`, `CompactToggleGroup`, `RecordFormScreen`, `FormSectionHeading`, `InfoCard`, `KeyFigureTile`, `DetailLine`, `BottomSheet`, `ConfirmDialog`, `CreateAndLinkRecordDialog` (form-id pattern), `ClubPicker` (picker pattern), `avatarSx`/`badgeSx`, `zebraTint`, `utils/initials`, `utils/errorDetail`, test helper `problem(409, ...)`, backend `AbstractIntegrationTest`, `PlatformRoleJwtPostProcessors`.

## Verification
- Backend (scratch copy): unit tests per spec, Testcontainers integration (migration, identity index, search/paging, merge rollback), authorization (401/403 on `/platform`, club isolation), `LayeringRulesTest`, lazy-mapping tests without an ambient `@Transactional`.
- Frontend: `npm run lint`, `npm run test`, `npm run build` (Node 22.12.0); `npm run test:storybook` for the new stories.
- Live check against the running app, with the user: add an away field from a match in one dialog; flag appears; admin verifies; flag disappears; second club reuses it; reject and merge; phone width at 375 px; country default in the browser.

## Not in this plan
Step 2 (grounds, nets, bookings), `pg_trgm`, owner-to-club link, import resolution, public field page, a CI contract diff, dependency-cruiser. All are in the roadmap.

## Changes after approval
Copy this plan verbatim to `docs/plans/099-fields-directory.md` on the feature branch and commit it first; mark the spec status approved.

## Amendment (2026-10-13, user)
Tests, test-writer and the standards review are deferred until the user has approved the working feature. Slices below describe the build only; every "then `test-writer`" in the headings means after approval.
