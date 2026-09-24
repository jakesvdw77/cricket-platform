# Plan: 050 — League Schedule & Fixtures

## Context

`docs/specs/050-league-schedule-and-fixtures.md` (draft, approved, including its post-draft amendment adding Playing Conditions/badges) extends the club-owned `League`/`Season`/`Match` model (`029`) with: a team-count + season-label badge and a conditional "Playing Conditions" action on the League `RecordCard`; an "Affiliations"→"Teams" label rename; a logo field for a `Match`'s free-text ("external") opponent; a new season-scoped "Schedule" tab on `LeagueFormPage` (match-scheduling shortcut + Playing Conditions PDF upload); and a new, reusable, presentational `LeagueFixtures` component shown on `LeagueDetailPage`'s new Fixtures section. The design pass for the two genuinely new visual patterns (`DocumentUpload`, `LeagueFixtures`) was already approved (user: "Looks great").

Two Explore passes (backend + frontend) confirmed every touch point directly against current source — exact signatures/line numbers below are all read from the real files, not inferred from the spec's own prose. Two things the explorations surfaced that refine the spec's own open items:

- **`MediaService` refactor**: add a second interface method `upload(MultipartFile file, Map<String, String> allowedContentTypes)`; `MediaServiceImpl`'s existing 1-arg `upload(file)` becomes a thin delegate to it using the existing `ALLOWED_CONTENT_TYPES` map, so the shared storage plumbing (UUID filename, `Files.createDirectories`/`Files.copy`) is written once. `LeaguePlayingConditionsServiceImpl` injects `MediaService` and calls the 2-arg overload with `Map.of("application/pdf", ".pdf")`.
- **`LeagueDto`'s three computed fields**: `LeagueMapper` is pure MapStruct field-inference (no room for computed fields with no matching entity property) — mirror `MatchServiceImpl`'s existing `enrichAnnounced`-style pattern (map via MapStruct, then reconstruct the record adding the computed fields) rather than fighting MapStruct. **Read `MatchMapper.java`'s exact `@Mapping(target = "...", ignore = true)` annotation shape for `homeSideAnnounced`/`awaySideAnnounced` first** and apply the identical shape to `LeagueMapper` for the three new fields — not read in this planning pass, first thing `backend-builder` confirms.
- **Match-prefill mechanism for the Schedule tab's "Add Match"** (spec left this open): use **query params** on the existing create route — `/manage/fixtures/matches/new?leagueId=<id>&seasonId=<id>` — read via `useSearchParams()` in `MatchFormPage.tsx` to seed `MatchForm`'s `initialValues.leagueId`/`seasonId` (a prop shape it already supports for edit-mode prefill). Chosen over router `state` because it survives a refresh and matches this codebase's own existing query-param convention (`037`'s `?tab=playing-xi`). `backend-builder`/`frontend-builder` note: `MatchFormPage.tsx`'s current create-mode initial-value construction wasn't read in the exploration pass — `frontend-builder` reads it first before wiring this in.

## Backend files, in order

### 1. `backend/src/main/resources/db/changelog/v1/025-add-match-external-opponent-logo.sql` (new)
```sql
ALTER TABLE match ADD COLUMN home_team_logo_url VARCHAR(1024);
ALTER TABLE match ADD COLUMN away_team_logo_url VARCHAR(1024);
```
Register in the changelog master file (check how `024` was registered, same pattern).

### 2. `backend/src/main/resources/db/changelog/v1/026-add-league-playing-conditions.sql` (new)
```sql
CREATE TABLE league_playing_conditions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id     UUID NOT NULL REFERENCES league(id),
    season_id     UUID NOT NULL REFERENCES season(id),
    document_url  VARCHAR(1024) NOT NULL,
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    uploaded_by   UUID,
    UNIQUE (league_id, season_id)
);
CREATE INDEX ix_league_playing_conditions_league ON league_playing_conditions(league_id);
CREATE INDEX ix_league_playing_conditions_season ON league_playing_conditions(season_id);
```

### 3. `Match.java` — add `homeTeamLogoUrl`/`awayTeamLogoUrl` (nullable `String`, plain `@Column`), same shape as `homeTeamName`/`awayTeamName`.

### 4. `MatchDto.java`, `CreateMatchRequest.java`, `UpdateMatchRequest.java` — add the same two fields to each record (field names match the entity, so `MatchMapper`'s MapStruct inference picks them up for free — no mapper annotation needed for these two, unlike League's computed fields).

### 5. `MatchServiceImpl.java` — new private method (name it `validateLogoOnlyWithName` or similar), called from both `create()`/`update()` alongside the existing `validateSides(...)` call (same call site, right after it): for each side, `if (teamLogoUrl != null && teamName == null) throw new ValidationException(...)` — a logo may only be set when that side's `*TeamName` is the populated one (i.e. `*TeamId` is null), mirroring `validateExactlyOneOfIdOrName`'s existing posture. Confirmed exact existing method to sit beside: `validateSides` (line 393), `validateExactlyOneOfIdOrName` (line 398).

### 6. `MediaService.java` — add `MediaUploadResponse upload(MultipartFile file, Map<String, String> allowedContentTypes)` to the interface.

### 7. `MediaServiceImpl.java` — extract the existing `upload(file)` body (content-type check, UUID filename, `Files.createDirectories`/`Files.copy`) into the new 2-arg method, parameterized on `allowedContentTypes` instead of the hardcoded `ALLOWED_CONTENT_TYPES` map; the existing 1-arg `upload(file)` becomes `return upload(file, ALLOWED_CONTENT_TYPES);`. No behavior change for any existing image-upload caller — confirm via existing `MediaServiceImplTest`/`MediaControllerIntegrationTest` still passing unmodified.

### 8. `LeaguePlayingConditions.java` (new domain entity) — `id`(UUID), `leagueId`, `seasonId`, `documentUrl`, `uploadedAt`, `uploadedBy`, same Lombok/`@Entity` shape as `LeagueAffiliation.java` (its closest precedent), `@Table(name = "league_playing_conditions")`, `@PrePersist` setting `uploadedAt` if null.

### 9. `LeaguePlayingConditionsDto.java` (new) — flat record mirroring `LeagueAffiliationDto`'s shape: `(UUID id, UUID leagueId, UUID seasonId, String documentUrl, Instant uploadedAt, UUID uploadedBy)`.

### 10. `LeaguePlayingConditionsMapper.java` (new) — `@Mapper(componentModel = "spring")`, single `toDto(LeaguePlayingConditions entity)`, MapStruct-inferred (all fields match by name), same shape as `LeagueAffiliationMapper.java`.

### 11. `LeaguePlayingConditionsRepository.java` (new) — extends `JpaRepository<LeaguePlayingConditions, UUID>`: `Optional<LeaguePlayingConditions> findByLeagueIdAndSeasonId(UUID leagueId, UUID seasonId)` (used by both the GET/upsert-check paths) and `List<LeaguePlayingConditions> findBySeasonId(UUID seasonId)` (used by `LeagueServiceImpl`'s batch computed-field query, item 14 below).

### 12. `LeagueAffiliationRepository.java` — add one new query method for the team-count batch: a JPQL `@Query` grouping by `leagueId` for a single `seasonId`, e.g.
```java
@Query("select a.leagueId as leagueId, count(distinct a.teamId) as teamCount from LeagueAffiliation a where a.seasonId = :seasonId group by a.leagueId")
List<LeagueTeamCount> countDistinctTeamsBySeasonId(@Param("seasonId") UUID seasonId);

interface LeagueTeamCount {
    UUID getLeagueId();
    long getTeamCount();
}
```
(Spring Data interface projection — nested interface can live in the repository file itself, matching this codebase's convention of keeping a query's own small projection type close to it; `backend-builder` confirms the exact convention against one other existing projection if this codebase already has one, else this is the first.)

### 13. `LeaguePlayingConditionsService.java` (interface, new) + `LeaguePlayingConditionsServiceImpl.java` (new) — constructor-injects `LeagueRepository`, `SeasonRepository`, `LeaguePlayingConditionsRepository`, `MediaService`, `LeaguePlayingConditionsMapper`:
- `LeaguePlayingConditionsDto get(UUID clubId, UUID leagueId, UUID seasonId)` — validate `leagueId`/`seasonId` both belong to `clubId` (mirror `MatchServiceImpl.validateLeagueAndSeason`'s exact `findById().orElseThrow(NotFoundException)` + `!x.getClubId().equals(clubId) → NotFoundException` pattern, `leagueId` always required here unlike `Match`'s optional one), then `repository.findByLeagueIdAndSeasonId(...).map(mapper::toDto).orElseThrow(() -> new NotFoundException("Playing conditions not found"))`.
- `LeaguePlayingConditionsDto upload(UUID clubId, UUID leagueId, UUID seasonId, MultipartFile file, UUID uploadedBy)` — same club-ownership validation, then `mediaService.upload(file, Map.of("application/pdf", ".pdf"))` for the `documentUrl`, then upsert: `repository.findByLeagueIdAndSeasonId(...)` — if present, mutate `documentUrl`/`uploadedAt`/`uploadedBy` in place and save (same row, same `id`); if absent, build a new entity and save. `uploadedBy` resolution: **read how `LeagueServiceImpl.update()`/`MatchServiceImpl` resolve the current principal's person id for `updatedBy`/`createdBy` and mirror that exact mechanism** — not confirmed in this planning pass, `backend-builder` reads it first (likely a value threaded in from the controller via `Authentication`, not resolved inside the service itself — confirm before assuming).

### 14. `LeaguePlayingConditionsController.java` (new, separate file — not folded into `LeagueController.java`, per the exploration's recommendation: this endpoint's multipart/file-upload shape is structurally different from every other JSON-body endpoint already in `LeagueController`) — `@RestController`, base path `/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions`, both endpoints `@PreAuthorize("@access.canAdministerClub(authentication, #clubId)")` (same annotation every other League-nested endpoint uses):
- `GET` → `service.get(clubId, leagueId, seasonId)`, 404 via the service's own `NotFoundException` when nothing uploaded yet (global exception mapping, not a per-controller try/catch — confirm this codebase's existing `NotFoundException`→404 mapping is truly global by checking one existing controller, expected to be, not re-derived).
- `POST` (`consumes = MULTIPART_FORM_DATA_VALUE`) → `@RequestParam("file") MultipartFile file` → `service.upload(...)`, mirroring `MediaController.uploadManaged`'s exact param shape.

### 15. `LeagueDto.java` — add `currentSeasonTeamCount: int`, `currentSeasonLabel: String` (nullable), `currentSeasonPlayingConditionsUrl: String` (nullable) to the record.

### 16. `LeagueMapper.java` — add whatever `@Mapping(target = "...", ignore = true)` (or equivalent) annotations `MatchMapper.java` uses for `homeSideAnnounced`/`awaySideAnnounced`, applied to the three new fields — **read `MatchMapper.java` first** to confirm the exact shape before writing this.

### 17. `LeagueServiceImpl.java` — `list(UUID clubId)` gains the batch computation, all in one method, one round trip per collection (not per league):
1. `seasonRepository.findByClubId(clubId)` → resolve `currentSeasonId` via a new private method (`resolveCurrentSeasonId(List<Season> seasons)`) porting `pickDefaultSeasonId`'s exact two-branch rule (season whose `[startDate, endDate]` contains today, else the most-recently-created by `createdAt`) — doc-comment citing `ui/src/utils/defaultSeason.ts`'s `pickDefaultSeasonId` explicitly so the two definitions don't drift apart. Returns `null` when the club has zero seasons.
2. If `currentSeasonId` is null: every league gets `currentSeasonTeamCount = 0`, `currentSeasonLabel = null`, `currentSeasonPlayingConditionsUrl = null` — skip steps 3/4 entirely.
3. Else: `leagueAffiliationRepository.countDistinctTeamsBySeasonId(currentSeasonId)` → build a `Map<UUID, Long>` (leagueId → count); `leaguePlayingConditionsRepository.findBySeasonId(currentSeasonId)` → build a `Map<UUID, String>` (leagueId → documentUrl); resolve `currentSeasonLabel` once from the already-fetched `Season` list (the one whose id matches `currentSeasonId`).
4. Map each `League` via `leagueMapper.toDto(entity)` then reconstruct the record (same "MapStruct base, then add computed fields" pattern as `MatchServiceImpl.enrichAnnounced` — read that method's exact reconstruction style and mirror it) with the three fields pulled from the two maps above (`getOrDefault(leagueId, 0L)`/`.get(leagueId)`), plus `currentSeasonLabel` (same value for every league in this club).

## Backend tests (test-writer, after backend-builder)

- `MatchServiceImplTest.java` — new cases for the logo-only-with-name validation (both accept/reject shapes), mirroring the existing `createWithBothHomeTeamIdAndHomeTeamNameSetThrowsValidationException`-style tests already there.
- `MediaServiceImplTest.java` — confirm existing image-upload tests still pass unmodified against the refactored 2-arg-delegate shape; add one new case calling the 2-arg `upload(file, Map.of("application/pdf", ".pdf"))` directly, proving the extracted storage plumbing works for a non-image allowlist too.
- `LeaguePlayingConditionsServiceImplTest.java` (new) — mirror `LeagueAffiliationServiceImplTest.java`'s exact shape (`@ExtendWith(MockitoExtension.class)`, mocked repos/mapper/`MediaService`, builder helpers): cross-club `NotFoundException` for `leagueId`/`seasonId`, first upload creates a row, second upload for the same `(league, season)` replaces in place (assert via `verify(repository, never()).save(argThat(isNewEntity))`-style or a captured-entity `id` equality check, not just a response check), `get()` throws `NotFoundException` when nothing uploaded.
- `LeagueServiceImplTest.java` — extend for the three computed fields together: zero seasons (all defaults), affiliations spread across multiple seasons (only current season's distinct teams counted), a current season with no uploaded document (`currentSeasonPlayingConditionsUrl` null, label still populated), the current-season resolution rule's two branches (contains-today vs. most-recently-created fallback).
- `LeaguePlayingConditionsRepositoryTest.java` (new, if this codebase has a repository-tier test precedent beyond `LeagueAffiliationRepositoryTest.java` — mirror it) — the unique `(league_id, season_id)` DB constraint is actually enforced.
- `MatchControllerIntegrationTest`-equivalent (check its real file name) — new case: `POST`/`PUT .../matches` with a logo set alongside a team id → 400.
- `LeaguePlayingConditionsControllerIntegrationTest.java` (new) — combine `LeagueControllerIntegrationTest`'s seeding/auth/cross-club-404 pattern with `MediaControllerIntegrationTest`'s exact multipart/temp-storage-dir pattern (`@SpringBootTest(properties = "app.media.storage-path=...")`, `MockMultipartFile`, `@AfterEach` cleanup): real PDF upload succeeds and is fetchable via GET, non-PDF file → 400, GET before any upload → 404, second upload replaces (assert via a repository `count()` staying at 1, not 2), cross-club 404 isolation.
- New migration test/assertion (however this codebase verifies migrations apply cleanly — likely just "the app boots in the integration test suite," not a dedicated migration test) — confirm `025`/`026` apply without breaking any existing `Match`/`League` fixture data.

## Frontend files, in order

### 18. `ui/src/api/leagueApi.ts` — `League` interface gains `currentSeasonTeamCount: number`, `currentSeasonLabel: string | null`, `currentSeasonPlayingConditionsUrl: string | null` (lines 9–23).

### 19. `ui/src/api/matchApi.ts` — `Match` interface (lines 25–42) and `MatchPayload` interface (lines 47–56) both gain `homeTeamLogoUrl: string | null` / `awayTeamLogoUrl: string | null` (or `?:` on the payload, matching that interface's existing optionality convention).

### 20. `ui/src/api/leaguePlayingConditionsApi.ts` (new) — `getPlayingConditions(clubId, leagueId, seasonId)`: GETs the new endpoint, catches a 404 and returns `null` instead of throwing (so callers don't need a try/catch per call site — check `axiosConfig.ts`'s interceptor shape for how other "404 as null" callers in this codebase do it, if any exist, else a plain `try/catch` on the axios call checking `error.response?.status === 404`). `uploadPlayingConditions(clubId, leagueId, seasonId, file)`: multipart POST, mirroring `mediaApi.ts`'s `uploadMedia`/`uploadManagedMedia` exact `FormData`/`multipart/form-data` shape.

### 21. `ui/src/components/MatchForm/MatchForm.tsx`:
- `FormState` (lines 32–43) gains `homeTeamLogoUrl`/`awayTeamLogoUrl` (`string`, empty-string default matching `homeTeamName`'s own convention).
- `toFormState` (lines 63–76) seeds them from `initialValues?.homeTeamLogoUrl ?? ''` / away mirror.
- Render a `<MediaUpload label="Logo" value={values.homeTeamLogoUrl || null} onUploaded={(url) => setValues((prev) => ({ ...prev, homeTeamLogoUrl: url }))} variant="logo" namespace="manage" />` immediately after the home-side external `Input` (after line 250, still inside the `homeMode === 'external'` branch, before the closing of that `Box` at line 252) — copy `TeamForm.tsx`'s own call shape (line 110) verbatim in style. Mirror for away (after line 295, before line 297).
- Toggle `onChange` handlers (lines 217, 262): when switching to `'team'`, also clear that side's `*TeamLogoUrl` back to `''`.
- `handleSubmit`'s payload build (lines 152–161): `homeTeamLogoUrl: values.homeMode === 'external' ? (values.homeTeamLogoUrl || null) : null` (and away mirror) — a logo is never sent when that side is a real `Team`, matching the backend's new validation rule.

### 22. `ui/src/components/MatchForm/MatchForm.test.tsx` (test-writer) — new cases: `MediaUpload` only renders in `'external'` mode for a side, clears `*TeamLogoUrl` on toggling back to `'team'`, submitted payload carries the logo only for an external side.

### 23. `ui/src/components/DocumentUpload/` (new, four-file anatomy, mirroring `MediaUpload`'s exact directory shape):
- `DocumentUpload.tsx` — props: `label`, `value: { documentUrl: string; uploadedAt: string } | null`, `onUploaded: (documentUrl: string) => void`, `namespace?: 'manage'` (only namespace this needs today, unlike `MediaUpload`'s two). Client-side allowlist `['application/pdf']`. Renders: label, a bordered row (not `MediaUpload`'s image-preview box) showing a document icon + filename/"No document uploaded yet" + upload-date sub-line, an "Upload"/"Replace" `Button` (same variant convention as `MediaUpload`'s), and — only when `value` is set — a "View" `Button` whose `onClick` is `() => window.open(value.documentUrl, '_blank')`. Calls the new `uploadPlayingConditions` (threaded in via a prop or a fixed import — match whichever convention `MediaUpload` uses for choosing its upload function, i.e. decide if this needs a `namespace` prop at all or just always calls the one League-scoped upload function it's given).
- `DocumentUpload.test.tsx` — mirror `MediaUpload.test.tsx`'s exact structure (mocked API module via `vi.mock`): empty state, populated state (filename/date/View+Replace), client-side non-PDF rejection, successful upload calling `onUploaded`, View button calling `window.open` with the right URL.
- `DocumentUpload.stories.tsx` — CSF3, `title: 'Components/DocumentUpload'`, `parameters: { layout: 'padded' }`, stories: `Empty`, `Populated`, `Uploading`, `Error`, plus the mandatory viewport story/trio per `docs/standards/design-system.md` (mirror `MediaUpload.stories.tsx`'s trailing `MobileViewport`/etc. shape) — use the exact visual values from the approved design mockup (document icon in a tinted `#fbeceb`/error-toned box, filename ellipsis-truncated, upload date as a secondary caption line).
- `index.ts` — re-export, same shape as `MediaUpload/index.ts`.

### 24. `ui/src/components/LeagueFixtures/` (new, four-file anatomy):
- `LeagueFixtures.tsx` — props: `matches: Match[]`, `teamsById: Map<string, Team>` (already-fetched, no data-fetching inside this component — deliberately presentational per spec). Groups matches by date (e.g. `matchDate` truncated to day, formatted as the approved mockup's `"Sat, 14 Mar 2026"` heading style), each match a three-column row (home / time+venue / away) collapsing to a stacked single column at narrow widths (`sx` breakpoint, mirroring the approved mockup's 375px behavior — no horizontal scroll). Each side resolves its own avatar: a real `Team` via `homeTeamId`/`teamsById.get(id)?.logoUrl` falling back to `initialsFromName(team.name)`; an external opponent via `homeTeamName`/`homeTeamLogoUrl` falling back to `initialsFromName(homeTeamName)` — same fallback posture as every other avatar slot in this codebase (`RecordCard`'s own avatar convention). Empty state when `matches` is empty.
- `LeagueFixtures.test.tsx` — real `Team` renders name+logo via id lookup; external opponent with a logo renders name+that logo; external opponent with no logo renders initials fallback; matches grouped correctly under distinct date headings; empty state renders with zero matches.
- `LeagueFixtures.stories.tsx` — CSF3, mirror `AvailabilityRespondentAvatars.stories.tsx`'s "named fixture arrays + args-referencing stories + trailing viewport story" convention (including its `decorators` width-constraint pattern, since this too sits inside a page section). Use the approved mockup's exact fixture content (Irene Villagers 1/2, Riverside Occasionals, Centurion Thursdays, Wanderers Pioneers) as realistic story data.
- `index.ts` — re-export.

### 25. `ui/src/pages/manage/LeagueList.tsx`:
- New exported `leagueSeasonBadges(league: League): RecordCardBadge[]` (alongside existing `badgeFor`/`leagueRecordFields`/`leagueChips`) — team-count badge always present (`` `${league.currentSeasonTeamCount} team${league.currentSeasonTeamCount === 1 ? '' : 's'}` ``, tone `'neutral'` or `'muted'` — pick whichever reads correctly against the approved mockup's `.chip.count`/`.chip.season` styling, both distinct from the existing Active/Inactive `badge`'s tones), season-label badge only when `league.currentSeasonLabel` is non-null.
- `RecordCard` call (lines 47–59) gains `badges={leagueSeasonBadges(league)}` and a conditional `secondaryActions` entry: `...(league.currentSeasonPlayingConditionsUrl ? [{ label: 'Playing Conditions', pendingLabel: 'Opening…', pending: false, onClick: () => window.open(league.currentSeasonPlayingConditionsUrl!, '_blank'), icon: <DescriptionOutlinedIcon fontSize="small" /> }] : [])` — exact shape mirrored from `MatchList.tsx`'s own Team Sheet `secondaryActions` entry.

### 26. `ui/src/pages/manage/LeagueList.test.tsx` (test-writer) — new cases: both badges render with correct labels; season-label badge absent when `currentSeasonLabel` is null; "Playing Conditions" action renders only when `currentSeasonPlayingConditionsUrl` is set, and its click handler calls `window.open` with that exact URL (mock `window.open`, mirror however `MatchList.test.tsx` already tests its own `window.open`-based Team Sheet action).

### 27. `ui/src/pages/manage/LeagueFormPage.tsx`:
- Line 234: `<Tab label="Affiliations" />` → `<Tab label="Teams" />`.
- New third `<Tab label="Schedule" />` after it.
- New `activeTab === 2` content block after the existing Affiliations block (after line 325, before the closing `</RecordFormScreen>`): reuses the page's existing `selectedSeasonId`/`pickDefaultSeasonId` state (shared across tabs, not a second copy) — a season `Select` (or reuse the Teams tab's, if the block's layout allows sharing it visually while both tabs are season-scoped; otherwise each tab keeps its own `Select` bound to the same shared state), `listMatches(clubId, { page: 0, leagueId, seasonId: selectedSeasonId })` rendered via `LeagueFixtures`, an "Add Match" `Button` navigating to `/manage/fixtures/matches/new?leagueId=${leagueId}&seasonId=${selectedSeasonId}`, and a `DocumentUpload` control wired to `getPlayingConditions`/`uploadPlayingConditions` for `(leagueId, selectedSeasonId)`, re-fetching after a successful upload.

### 28. `ui/src/pages/manage/LeagueFormPage.test.tsx` (test-writer) — Tab renders "Teams" not "Affiliations"; new Schedule tab renders the league+season's matches via `LeagueFixtures`, an Add Match link with the right `?leagueId=&seasonId=` href, and the `DocumentUpload` control.

### 29. `ui/src/pages/manage/LeagueDetailPage.tsx`:
- Line 128: `heading: 'Affiliations'` → `heading: 'Teams'`.
- New third `sections` entry (`heading: 'Fixtures'`) after line 173: same `selectedSeasonId`/`Select` pattern the Teams section already has, rendering `LeagueFixtures` against `listMatches(clubId, { page: 0, leagueId: league.id, seasonId: selectedSeasonId })` and the page's already-fetched `teamsQuery.data` (reused, not re-fetched).

### 30. `ui/src/pages/manage/LeagueDetailPage.test.tsx` (test-writer) — section heading renders "Teams" not "Affiliations"; new Fixtures section renders `LeagueFixtures` for the selected season.

### 31. `ui/src/pages/manage/MatchFormPage.tsx` — read its current create-mode initial-value construction first (not covered by the exploration pass), then read `leagueId`/`seasonId` from `useSearchParams()` and pass them into `MatchForm`'s `initialValues` only in create mode (never override an existing edit's own values).

### 32. `ui/src/pages/manage/MatchFormPage.test.tsx` (test-writer) — new case: visiting the create route with `?leagueId=&seasonId=` query params pre-selects both on the rendered form.

## Agent assignment

Given the size, run this in stages rather than one flat dispatch:

1. **`backend-builder`** — items 1–17 (migrations through `LeagueServiceImpl`). Brief it explicitly to read `MatchMapper.java`'s exact `homeSideAnnounced`/`awaySideAnnounced` `@Mapping`/reconstruction shape before writing `LeagueMapper`/`LeagueServiceImpl`'s equivalent, and to read how `updatedBy`/`createdBy` is resolved from `Authentication` elsewhere in this codebase before writing `LeaguePlayingConditionsController`'s `uploadedBy` wiring — both explicitly flagged as unconfirmed in this plan, not to be guessed.
2. **`test-writer`** (after 1) — the backend test list above.
3. **`frontend-builder`** (can start in parallel with 1/2, no dependency on backend completing since it works against the spec'd DTO shapes) — items 18–21, 23–25, 27, 29, 31. Brief it to read `MatchFormPage.tsx`'s current create-mode flow before wiring the query-param prefill (item 31), and to build `DocumentUpload`/`LeagueFixtures` against the approved design mockup's exact visual values (avatar sizing, tint colors, date-grouped row shape) rather than freelancing new ones.
4. **`test-writer`** (after 3) — items 22, 26, 28, 30, 32, plus `DocumentUpload.test.tsx`/`.stories.tsx` and `LeagueFixtures.test.tsx`/`.stories.tsx` from items 23/24.
5. **`standards-reviewer`** (after everything) — full diff, both backend and frontend, against the spec and `docs/standards/backend.md`/`frontend.md`.

## Flags for your review

- **`MediaService`'s 2-arg refactor touches a shared, already-in-production file** (`MediaServiceImpl.java`) used today by every existing logo/banner upload across the app (`ClubForm`, `TeamForm`, `SponsorForm`, etc.) — low risk since the 1-arg method's behavior is preserved byte-for-byte as a delegate, but it's the one file in this plan that isn't purely additive. `backend-builder` should run the full existing `MediaServiceImplTest`/`MediaControllerIntegrationTest` suite unmodified first, before adding new cases, to prove zero regression.
- **The Schedule tab's exact layout** (whether it shares one `Select` visually with the Teams tab or renders its own bound to the same state) is left as a build-time call within the stated constraint (shared `selectedSeasonId` state, not a second independent one) — not expected to need your input, but flagging since it's the one remaining "exact pixel" decision not covered by the approved mockup (which showed `LeagueFixtures`/`DocumentUpload` in isolation, not the full tab layout around them).
- This is a large plan (32 items across two layers) but ships as the one PR the spec itself calls for — not proposing to split it, per the spec's own Rollout Notes.

## Verification

- Backend: `cd backend && ./mvnw test` (unit + integration), plus a manual boot (`./mvnw spring-boot:run -Dspring-boot.run.profiles=dev`) to confirm both new migrations apply cleanly against the real dev DB.
- Frontend: `cd ui && npm run build && npm run lint && npm run test && npm run test:storybook`.
- Manual smoke test: create a `Match` against an external opponent with a logo, confirm it renders correctly; open a League's edit screen, confirm "Teams" (not "Affiliations") tab label, add a match via the new Schedule tab's prefilled "Add Match", upload a Playing Conditions PDF and confirm "View" opens it in a new tab; confirm the League list card shows both new badges and, once a document exists, the "Playing Conditions" card action; open a League's view screen and confirm the new Fixtures section renders the same fixture list read-only.
