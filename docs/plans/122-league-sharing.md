# Plan 122: League sharing

Implements `docs/specs/122-league-sharing.md` (approved 2026-10-28, Decisions 1 to 3). Plan only; the spec is not redefined.

## Context
One Share League dialog (six contents, five formats) replaces the separate schedule and playing-conditions dialogs. It builds on the `114` shell. The only backend change is an additive `disabledFormats` on `share-settings`, which Results honours in the same change. Next free migration is **056**.

## Findings and proposals (to confirm)
1. **`LeagueFormPage` opens both old dialogs** (around lines 507 and 520). It is a league caller, so move its two Share buttons to `ShareLeagueDialog` (Schedule and Playing conditions preselected) and retire both old dialogs. `LeagueFormPage.test.tsx` needs updating.
2. **Results already filter by `leagueId`, `seasonId` and `status`** (`MatchResultController`, `ResultList`). No backend filter needed. Check page size at build time so all of a season's results load.
3. **Shared share pieces move to `components/ShareCore/`** (`ShareInitialsControl`, `ShareLogoControls`, `useEditableShareText`, `ShareControlGroup`, `useShareLogoImages`, `shareScreenTypes`, `SharePdfActions`, `ShareImageActions`), with re-exports from the old paths so existing tests keep passing.
4. **Admin-only switches:** keep one `PUT`; add the `canAdministerClub` check only when `disabledFormats` is present and differs from the stored value. Section managers can still change `initialsOnlyDefault`.
5. Docs to update at the end: `docs/roadmap.md`, `docs/standards/design-system.md`, `docs/standards/frontend.md`.

## Slices
### 1. Backend `disabledFormats` (backend-builder, parallel with 2 and 3)
- `db/changelog/v1/056-club-share-disabled-formats.sql`: `ALTER TABLE club_profile ADD COLUMN share_disabled_formats TEXT NOT NULL DEFAULT '{}';` plus the master changelog include after 055.
- `ClubProfile` gets the field (JSON string). Not on `UpdateClubProfileRequest`; confirm `ClubProfileServiceImpl.upsert` leaves it untouched.
- `ShareSettingsDto(boolean initialsOnlyDefault, Map<String, List<String>> disabledFormats)`. Null on PUT leaves as is; GET always returns a map.
- `ClubShareSettingsServiceImpl`: default to empty map without a profile row; validate keys (`RESULT`, `LEAGUE`) and codes (RESULT: PDF, IMAGE, TV, WHATSAPP, FACEBOOK; LEAGUE: PDF, POSTER, CALENDAR, WHATSAPP, FACEBOOK) in one place; reject a request leaving a content type with no format (400); admin check per Finding 4.
- `ClubShareSettingsController`: admin check following `ClubProfileController`.
- Hand-edit `backend/openapi/openapi.yaml` (`ShareSettingsDto`, additions only). Verify in a scratch copy, never under `backend/`.

### 2. Content-neutral share core (frontend-builder)
- Create `components/ShareCore/` and move the neutral pieces (Finding 3), re-exporting from `components/ShareResultDialog/index.ts`.
- `api/shareSettingsApi.ts` and `hooks/useShareSettings.ts` carry `disabledFormats`; pure helper `utils/share/enabledFormats.ts` (`offeredFormats(contentType, disabled)`).
- `ShareResultDialog` hides club-disabled formats, with a "no format left" message pointing to club share settings.
- `utils/share/shareChoices.ts`: add the `league` branch. Contact opt-in is never stored.

### 3. Data, formats and builders (frontend-builder, `ui/src/utils/share/`, parallel with 1)
- `leagueShareFormats.ts`: content-by-format table, `supports(content, format)`, `availability(ticked, clubDisabled)` (offered, greyed with reason, hidden).
- `shareLeagueData.ts`: pure `LeagueShareModel` assembler; flags own teams, names through `shareName`, junior forced when league `maxAge` is 18 or under.
- `leagueTextWhatsApp.ts`, `leagueTextFacebook.ts`, `leaguePdf.ts` (jsPDF, mirrors `resultPdf.ts`), `leagueIcs.ts` (reuse the existing calendar builder behind `ShareScheduleDialog`).
- Extend `leagueSchedulePoster.ts` for Teams and Key dates.
- `hooks/useShareLeagueData.ts`: React Query reads on dialog open only, reusing the League pages' reads; Results via the existing list, `status=PUBLISHED`.

### 4. `ShareLeagueDialog` with PDF and WhatsApp (needs 2, 3 and approved mockups)
- `components/ShareLeagueDialog/` with `WhatsAppLeagueScreen` and `PdfLeagueScreen`.
- Step 1 content list (greyed with reason, Next blocked with none ticked, season pill when no season given); step 2 format tiles from `availability()`; Back keeps ticks.
- Reuse the 114 shell (`ShareFormatScreen`, `SharePreviewStage`, `ShareDeliveryActions`, `WhatsAppSendActions`, `useEditableShareText`, `ShareInitialsControl`, `ShareLogoControls`). "Include phone and email" switch, off on every open.

### 5. Poster, Facebook, Calendar screens (after 4)
- `PosterLeagueScreen`, `FacebookLeagueScreen`, `CalendarLeagueScreen` (event list, Download plus native share).

### 6. Entry points and retirement (after 4)
- League card Share footer button (details and schedule preselected), list row and card view, Playing Conditions tab (conditions preselected), league view header ("Share schedule" becomes "Share", Schedule preselected), `LeagueFormPage` per Finding 1.
- Delete `ShareScheduleDialog` and `PlayingConditionsShareDialog` (with stories and tests) if Finding 1 is approved; keep the generators.

### 7. Club Share formats control (needs 1 and 2)
- `components/ShareFormatsSettings/` (switches per content type and format, last-format guard), on the club profile page beside the initials default, administrators only; surface the 400 message.

### 8. Docs, tests, review
After the whole leagues work: test-writer, then standards-reviewer.

## Parallelism
backend-builder: Slice 1 only. frontend-builder: Slices 2 and 3 straight away (hand-type `disabledFormats` until 1 lands); 4 waits on 2, 3 and mockups; 7 waits on 1; 5 and 6 follow 4.

## Risks
`ShareCore` move touches many files (re-exports; run existing share suites after Slice 2). Results volume (paging, no scorecards). Section-scoped managers cannot read some league data (junior lock stays on, logos omitted). PDF page breaks and Poster with many teams need mockups first. ICS time zone (GMT+2 assumption), all-day dates, line folding. Admin check split confuses section managers (test both paths). `openapi.yaml` hand-edit must be additions only. The word "children" must not appear.

## Tests (written once at the end)
- **Backend:** migration defaults; share-settings round trip; profile PUT does not reset it; last-format and unknown-code 400; non-admin and other-club refused; service default with no profile row; OpenAPI additions only.
- **Vitest units:** `leagueShareFormats` combinations; `shareLeagueData`; WhatsApp, Facebook and ICS builders; contact opt-in not remembered; junior privacy (no full first name in text, PDF, canvas, file name or title, extending `sharePrivacyFixture`); `shareChoices` league branch; `enabledFormats`.
- **Component:** `ShareLeagueDialog` (preselection per entry point, Next blocked, reasons, greyed formats, Back keeps ticks); each entry point; `ShareResultDialog` hides a disabled format; Share formats control (admin only, last-format guard); update `LeagueConditionsView.test.tsx` and `LeagueFormPage.test.tsx`; delete old dialog tests.
- **Playwright:** Schedule plus Key dates to Calendar golden path; junior-league Results WhatsApp text with initials only (written, probably not runnable without Keycloak).

## Verification
Backend suite in a scratch copy. UI: `tsc -b`, lint, vitest. Storybook from the main checkout.
