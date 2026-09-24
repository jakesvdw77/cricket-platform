# Plan: 052 — League Playing Conditions

## Context

`docs/specs/052-league-playing-conditions.md` (approved by the user this session) promotes Playing Conditions from a PDF-only upload buried in `LeagueFormPage.tsx`'s Schedule tab into its own "Playing Conditions" tab, adds a genuinely structured set of match-format/points/bonus-points fields to the existing `LeaguePlayingConditions` entity (so a future results-calculation feature can read them programmatically instead of parsing a PDF), and adds a captain-friendly summary — shareable as WhatsApp text or a one-page PDF — derived from those structured fields. Full-stack: one migration + entity/DTO/service/controller changes on the backend, two new util files, two new four-file components, and edits to both host pages (`LeagueFormPage.tsx`, `LeagueDetailPage.tsx`) on the frontend.

Every shape below (entity fields, validation rules, endpoint contract, component props) is already fixed by the spec — this plan sequences the work and pins the exact insertion points in the two host pages (confirmed against current source, not paraphrased) and flags one real ambiguity the spec didn't resolve.

**Backend precedent read in full**: `LeaguePlayingConditions.java`/`LeaguePlayingConditionsController.java`/`Service(.java)`/`ServiceImpl.java`/`Dto.java`/`Mapper.java` (the exact stack this extends), `LeagueController.java`'s `UpdateLeagueRequest`/`PUT` shape (the convention the new `PUT` endpoint follows), `docs/standards/backend.md`.

**Frontend precedent read in full**: `LeagueForm.tsx` (controlled-form/`validate()` shape `PlayingConditionsForm` mirrors), `leagueSchedulePdf.ts` (the freshest real PDF-generator precedent — colour constants, `loadImageBase64`, header-band, `URL.createObjectURL` delivery), `TeamSheetCommunicationDialog.tsx` (the exact dialog shape `PlayingConditionsShareDialog` mirrors, including the WhatsApp-textarea-plus-clipboard-copy mechanism), `RecordDetailScreen.tsx` (`DetailFieldRow`/`DetailFieldGrid`), and the **current, real** state of both host pages (line numbers below are from the actual files, confirmed this session — not the spec's own illustrative citations, which are close but not exact).

## One flag for your review before building

**Two independent "Share" buttons/dialogs will exist side by side on both host pages** — the existing `ShareScheduleDialog` (schedule PDF/poster/calendar, from `051`) and the new `PlayingConditionsShareDialog` (captain summary, this spec). They must not be merged or share state:

- `LeagueFormPage.tsx` already has `shareOpen` (boolean) wired to `ShareScheduleDialog` inside the **Schedule** tab (`activeTab === 2`, line 94/465-468/494-503). The new **Playing Conditions** tab (`activeTab === 3`) needs its own `playingConditionsShareOpen` state and its own "Share" button wired to `PlayingConditionsShareDialog`.
- `LeagueDetailPage.tsx` already has `shareOpen` wired to `ShareScheduleDialog` on the **Fixtures** section's `note` (line 48/304-313). The new **Playing Conditions** section needs its own `playingConditionsShareOpen` state.

Naming the new state/handlers distinctly (`playingConditionsShareOpen`, `handleSharePlayingConditionsPdf`, etc.) is a mechanical requirement, not a judgment call — called out here so it isn't missed mid-build.

## Files to touch, in order

### Backend (`backend-builder`)

1. **`backend/src/main/resources/db/changelog/v1/027-add-league-playing-conditions-structured-fields.sql`** (new) — exact SQL already written in the spec's Data Model Changes section: widen `document_url`/`uploaded_at` to nullable, drop the `uploaded_at` default, add all 12 new nullable columns (`bonus_points_enabled` is the one `NOT NULL DEFAULT false`). Register it in the Liquibase master changelog the same way `026` was.
2. **`backend/src/main/java/com/cricketlegend/domain/LeaguePlayingConditions.java`** — add the 12 new `@Column` fields (flat, no embeddable, per spec). Narrow `@PrePersist` to only default `uploadedAt` when `documentUrl != null` (spec's Data Model Changes, paragraph 2).
3. **`backend/src/main/java/com/cricketlegend/dto/LeaguePlayingConditionsDto.java`** — add the 12 new record components; `documentUrl`/`uploadedAt` types become nullable (already `String`/`Instant`, just document the new nullability in the Javadoc).
4. **`backend/src/main/java/com/cricketlegend/dto/UpdateLeaguePlayingConditionsRequest.java`** (new) — exact record from spec's API Contract, bean-validated as written.
5. **`backend/src/main/java/com/cricketlegend/mapper/LeaguePlayingConditionsMapper.java`** — no change needed beyond what MapStruct infers automatically once the entity/DTO field names match (flat, field-for-field); confirm the generated mapping still compiles.
6. **`backend/src/main/java/com/cricketlegend/service/LeaguePlayingConditionsService.java`** — add `update(UUID clubId, UUID leagueId, UUID seasonId, UpdateLeaguePlayingConditionsRequest request)`.
7. **`backend/src/main/java/com/cricketlegend/service/impl/LeaguePlayingConditionsServiceImpl.java`** — extract the shared `findOrCreate(leagueId, seasonId)` lookup-or-build helper `upload()` already does inline, reuse it from both `upload()` and the new `update()` (spec's API Contract, last paragraph — this is the one place the spec asks for a small refactor of existing code, not just additive code). Implement `update()`'s cross-field validation exactly as the spec's Data Model Changes / API Contract specify: `powerplayOvers <= maxOversPerInnings`, `maxOversPerBowler <= maxOversPerInnings` when set, `bonusPointsEnabled=true` requires both threshold fields non-null (`ValidationException` otherwise), `bonusPointsEnabled=false` clears both threshold fields to `null` on save regardless of request payload, `bonusBattingOversThreshold <= maxOversPerInnings` when set.
8. **`backend/src/main/java/com/cricketlegend/controller/LeaguePlayingConditionsController.java`** — add the `PUT` mapping, same `@PreAuthorize("@access.canAdministerClub(...)")` as the other two endpoints, `@Valid @RequestBody UpdateLeaguePlayingConditionsRequest`.
9. **`backend/openapi/openapi.yaml`** — hand-edit (this repo's established convention, confirmed via `037`'s plan — not auto-generated) to document the new `PUT` endpoint, the DTO's new fields, and `UpdateLeaguePlayingConditionsRequest`'s schema, matching the existing entries' style.
10. **Required-by-standards unit tests, same PR** (`docs/standards/backend.md`'s "every `@Service` method carrying a business rule ships with a unit test in the same PR"): extend `LeaguePlayingConditionsServiceImplTest.java` with the `update()` cases from the spec's Test Plan (first save with no existing row, save against a PDF-carrying row leaves PDF fields untouched, each `400` validation case, `bonusPointsEnabled=false` clears thresholds, cross-club isolation).

### Frontend (`frontend-builder`, after backend types are settled)

1. **`ui/src/api/leaguePlayingConditionsApi.ts`** — extend `LeaguePlayingConditions` interface with the 12 new fields (`documentUrl`/`uploadedAt` become `string | null`); add `PlayingConditionsPayload` interface (writable subset, mirrors `UpdateLeaguePlayingConditionsRequest`); add `updatePlayingConditions(clubId, leagueId, seasonId, payload)` calling the new `PUT`.
2. **`ui/src/utils/playingConditions.ts`** (new) — `resolveEffectiveMaxOversPerBowler(maxOversPerInnings, maxOversPerBowler)`, exact formula from spec UI Requirements item 3.
3. **`ui/src/components/PlayingConditionsForm/`** (new, four-file anatomy) — mirrors `LeagueForm.tsx`'s controlled-form shape exactly (local `useState` `FormState`, a `validate()` mirroring the server's cross-field rules, a stable `PLAYING_CONDITIONS_FORM_ID` constant), per spec UI Requirements item 2: four field groups (Match Format / Points System / Bonus Points / Additional Notes), seeded point defaults (`2/0/1/1/2`) when `initialValues` is absent, bonus-threshold fields genuinely unmounted (not disabled) while the checkbox is off, its own local "Save Playing Conditions" button (not routed through `RecordFormScreen`'s actions bar — this form is season-scoped, not record-scoped, same posture as `DocumentUpload`'s own local "Upload" button).
4. **`ui/src/utils/playingConditionsWhatsAppText.ts`** (new) — `generatePlayingConditionsWhatsAppText(leagueName, seasonLabel, conditions)`, sync, per spec UI Requirements item 8.
5. **`ui/src/utils/playingConditionsSummaryPdf.ts`** (new) — `generatePlayingConditionsSummaryPdf(leagueName, seasonLabel, conditions)`, async → blob URL, single page, same `DARK`/`MID`/`WHITE`/`LGRAY` constants and header-band shape as `leagueSchedulePdf.ts` (re-declared locally, not imported — established per-file precedent), no `checkPage`/pagination needed.
6. **`ui/src/components/PlayingConditionsShareDialog/`** (new, four-file anatomy) — mirrors `TeamSheetCommunicationDialog.tsx` exactly per spec UI Requirements item 7: two `ListItemButton` rows (PDF Summary / WhatsApp), no third placeholder row, `hasStructuredFields=false` renders an info `Alert` in place of the option list with both footer actions disabled, WhatsApp branch shows a pre-filled regeneratable textarea + clipboard-copy footer button, PDF branch's footer button calls `onSharePdf` (the host page's own handler — this component does not import the PDF generator itself, matching `ShareScheduleDialog`'s own "host page owns the generator call" convention).
7. **`ui/src/pages/manage/LeagueFormPage.tsx`** (edit) — exact changes:
   - Add `<Tab label="Playing Conditions" />` after the existing three (line ~316), making `activeTab` 0–3.
   - Add `playingConditionsShareOpen` state alongside the existing `shareOpen`/`linkOpen` (line ~93-94).
   - Move the `DocumentUpload` block (currently lines 430-446, inside `activeTab === 2`) out of the Schedule tab into a new `activeTab === 3` block, under a "Full Document" sub-heading.
   - In that same new tab block, render `<PlayingConditionsForm>` under a "Match Format & Points" sub-heading, wired to a new `updatePlayingConditionsMutation` (`useMutation` → `updatePlayingConditions`, invalidating `playingConditionsQueryKey`, same pattern `DocumentUpload`'s `onUploaded` already uses at line 445), plus a "Share" `Button` opening `PlayingConditionsShareDialog`.
   - Render `<PlayingConditionsShareDialog>` as a new sibling after the existing `<ShareScheduleDialog>` (after line 504), wired to `hasStructuredFields`/`conditions` derived from `playingConditionsQuery.data` (`maxOversPerInnings != null` signal, matching item 3's `PlayingConditionsForm.initialValues` derivation) and `onSharePdf` calling `generatePlayingConditionsSummaryPdf(...)` then `window.open(url, '_blank')`.
8. **`ui/src/pages/manage/LeagueDetailPage.tsx`** (edit) — exact changes:
   - Remove the `headerNote`'s "Playing Conditions" `Button` (lines 208-217) entirely.
   - Add `playingConditionsShareOpen` state alongside the existing `shareOpen` (line ~48).
   - Add a 4th section object to `sections` (after "Fixtures", line ~300) titled "Playing Conditions": empty-state `Typography` when `playingConditionsQuery.data` is `null`/has no structured fields; otherwise a `DetailFieldGrid` of `DetailFieldRow`s per spec UI Requirements item 5 (bonus rows omitted when `bonusPointsEnabled` is false, "(auto)" hint via `resolveEffectiveMaxOversPerBowler`), plus a "View full document" button (only when `documentUrl` is set — same `window.open` mechanism the removed header button used) and a "Share" button (same `note` slot pattern the Fixtures section already uses at line 279-288) opening `PlayingConditionsShareDialog`.
   - Render `<PlayingConditionsShareDialog>` as a new sibling after the existing `<ShareScheduleDialog>` (after line 313), same wiring as item 7's.

### Tests (`test-writer`, after both builders finish — compare against spec's Test Plan table for gaps rather than re-deriving)

- Backend integration/contract tier: migration applies cleanly against a pre-052 row (`LeaguePlayingConditionsRepositoryTest` or a new test), `LeaguePlayingConditionsControllerIntegrationTest` extended with the new `PUT` endpoint's success/validation/cross-club cases, OpenAPI contract diff passes.
- `resolveEffectiveMaxOversPerBowler.test.ts`, `generatePlayingConditionsWhatsAppText.test.ts`, `playingConditionsSummaryPdf.test.ts` (mirror `teamSheetPdf.test.ts`'s `MockJsPDF` shape).
- `PlayingConditionsForm.test.tsx` + story, `PlayingConditionsShareDialog.test.tsx` + story — full cases from spec's Test Plan Component row.
- `LeagueFormPage.test.tsx` / `LeagueDetailPage.test.tsx` extended per spec's Test Plan — including confirming the two Share buttons/dialogs stay independent (opening one never affects the other's state).

## Verification

- `cd backend && ./mvnw test` (unit + Testcontainers integration + ArchUnit + contract diff).
- `cd ui && npm run build && npm run lint && npm run test && npm run test:storybook`.
- Manual smoke test on a real league: Playing Conditions tab renders 4th, PDF upload still works from its new location, saving the structured form round-trips and re-populates on reload, bonus fields mount/unmount correctly, validation errors match the spec's Acceptance Criteria; read-only detail screen renders the new section correctly including the empty state; both Share flows (Schedule vs. Playing Conditions) work independently from both host pages, WhatsApp text copies correctly, summary PDF opens as a single well-laid-out page.
