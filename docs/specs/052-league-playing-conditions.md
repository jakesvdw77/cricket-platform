# 052 — League Playing Conditions

**Depends on:** `050-league-schedule-and-fixtures.md` (the `LeaguePlayingConditions` entity/`LeaguePlayingConditionsController`/`Service`/`ServiceImpl`/`Repository`/`Mapper`/`Dto` this spec extends rather than replaces, the PDF-only upload path and `DocumentUpload` component this spec keeps unchanged, and `LeagueFormPage.tsx`'s Schedule tab, where the PDF upload currently lives and moves off of here), `051-league-schedule-sharing.md` (most recent touch to the same two host pages — confirms this spec's new tab/section slot in each doesn't collide with `NextMatchCountdown`/`ShareScheduleDialog`'s own placement, and the exact `triggerDownload`/blob-URL delivery precedent this spec's own summary PDF reuses), `039-team-sheet-whatsapp-text.md` and `TeamSheetCommunicationDialog.tsx` (the exact dialog shape and WhatsApp-text-plus-clipboard-copy mechanism this spec's own share dialog mirrors — see UI Requirements item 7), `036-view-first-record-detail-screens.md` (`RecordDetailScreen`'s section/`DetailFieldRow`/`DetailFieldGrid` shape, reused for the new read-only section on `LeagueDetailPage.tsx`), `029-league-management.md` (`League`/`Season` — unchanged by this spec — and its own deferred "Phase 1: results capture and standings" item, which this spec's structured fields exist to eventually feed, without building any part of that item itself).
**Status:** draft.

## Problem & Goals

`050` gave a club admin one Playing Conditions artifact per league+season: a PDF upload, embedded inside `LeagueFormPage.tsx`'s Schedule tab and surfaced as a single "view/download" link on `LeagueDetailPage.tsx`. That PDF is opaque to the platform — a blob of prose no code can read. `029`'s own deferred "Phase 1: results capture and standings" item (`docs/roadmap.md`'s "Blocked on the full tenancy model" section lists "results capture" among what `006` named and hasn't built yet) will eventually need to programmatically apply a league's match-format rules and points/bonus-points formulas to compute a standings table — and a PDF can't be that source of truth. This spec does not build results/standings; it makes the *data* that a future results-calculation spec will need to read already exist, in a shape code can consume, well ahead of that spec being written.

A club admin who manages this today pasted a real example document (~15 sections — authority, nominations, match format, toss/timing, intervals, DLS/interruptions, scoring, no-balls/wides, fielding restrictions, substitutes, dismissals/appeals, conduct, equipment/safety, officials, and a "Special Conditions" section carrying a points table, a bonus-point rule, and promotion/relegation) and asked for a general schema — this platform is multi-tenant, so different clubs' leagues carry different numbers and, for some rules, genuinely different conventions, not just different values for the same fields.

**Goals**
- A club admin managing a league+season's Playing Conditions does so from its own dedicated "Playing Conditions" tab on `LeagueFormPage.tsx` (promoted out of the Schedule tab, where it's a poor fit alongside match scheduling), which still includes the existing PDF upload — unchanged capability, just relocated — as the authoritative full-text document for everything not modeled as a structured field (authority, nominations, conduct, equipment/safety, appeals, promotion/relegation, and the rest of the ~15-section document's prose).
- Alongside that PDF, a club admin can enter and edit a genuinely structured set of match-format, points-system, and bonus-points fields for that same league+season — the specific numbers a future results-calculation feature will need to read programmatically, not parse out of a PDF.
- A club admin viewing a league (read-only) sees those same structured fields, plainly laid out, alongside a link to the full PDF document — a real section, not just a download link, mirroring this codebase's existing view-first record detail pattern (`036`).
- The schema is general enough to serve any club's league — every numeric/boolean field is genuinely club-configurable, nothing from the one example document is hardcoded — while staying deliberately narrow: only the rules a results-calculation feature would need to read are modeled as fields; everything else stays prose in the PDF.
- A club admin can generate a **captain-friendly summary** of a league+season's structured Playing Conditions — the handful of numbers a captain actually needs before a match (overs, powerplay, points, bonus-point rule), not the full ~15-section legal document — and share it the same way `039` already lets an admin share a team sheet: as WhatsApp-formatted plain text (copied to the clipboard) or a one-page PDF, with no new captain login or player-facing surface. The full PDF document (item 1's "Full Document") remains the authoritative reference; this summary is a derived, friendlier restatement of only the structured fields.

## Non-goals

- **No results/standings calculation.** This spec supplies the structured inputs a future results-calculation feature will need (win/loss/draw/no-result/forfeit points, the bonus-point rule, overs/powerplay figures) — it does not compute a standings table, does not add any score/outcome field to `Match`, and does not build the feature that would read these fields. `029`'s own "Phase 1" item stays exactly as unscheduled as `docs/roadmap.md` already has it; a human should note against that roadmap item, once this ships, that its structured inputs now exist.
- **No general/pluggable bonus-point rule model.** `bonusBattingOversThreshold`/`bonusBowlingRestrictionPercentage` model exactly one pattern — a team batting second earns a bonus point for an early chase, a team bowling second earns one for a big restriction — a common amateur-league T20 convention and the one the example document uses. A different club's league running a genuinely different bonus scheme (net-run-rate-based, margin-of-victory-based, a bonus point for a clean sweep, etc.) isn't representable here. Revisit with a pluggable/rule-engine-shaped model only once a real second bonus convention is encountered — not speculatively generalized now.
- **No parsing, OCR, or consistency check between the uploaded PDF and the structured fields.** The two are independently maintained by the admin; nothing in this spec verifies the PDF's prose agrees with e.g. `pointsForWin`. That's the admin's own responsibility, same as any two independently-entered fields elsewhere in this codebase.
- **No version history for either the PDF or the structured fields.** `050`'s "no history, just current state" posture for `documentUrl`/`uploadedAt`/`uploadedBy` carries forward unchanged, and the new structured fields get the same posture: a save overwrites the same row's fields in place, no prior-value list, no audit trail beyond the existing `uploadedAt`/`uploadedBy` (which continue to describe only the PDF, not the structured fields — see Data Model Changes).
- **No backfill of the new columns on existing rows.** Every column this spec adds is nullable; a league+season with a Playing Conditions PDF uploaded before this spec ships simply has every new field blank until an admin fills the new tab in.
- **No change to the PDF upload mechanism itself.** Still a multipart `POST`, still PDF-only (`application/pdf`), still the same `DocumentUpload` component and `MediaService.upload(file, allowedTypes)` plumbing `050` built. This spec adds a sibling write path for the structured fields (see API Contract), not a replacement for the existing one.
- **No player-facing screen, route, or player auth.** Same posture as `050`/`051` — everything in this spec lives under `/manage` only. The captain summary (see Goals) doesn't change this: it's an admin-generated, admin-shared *output* (clipboard text or a downloaded/opened PDF), the same posture `039`'s WhatsApp team-sheet text already has — a captain receives it outside the platform, never logs into it.
- **No summary of the Full Document's prose.** The captain summary restates only the structured fields (Data Model Changes) — it never attempts to condense or extract from the uploaded PDF, which this spec still has no way to parse (see the existing "no parsing, OCR" non-goal above). When no structured fields are saved for a league+season, there is nothing to summarize (see UI Requirements item 7).
- **No native WhatsApp deep link (`wa.me`) or direct send.** The summary's WhatsApp option is a clipboard copy the admin pastes into their own chat, identical to `039`'s existing mechanism — not a new send/deep-link integration.
- **No third share channel or "coming soon" placeholder row.** Unlike `TeamSheetCommunicationDialog`'s own Facebook placeholder, this spec's share dialog ships with exactly the two real options (PDF, WhatsApp) and nothing disabled/placeholder — no manufactured parity with a pattern this feature doesn't need yet.
- **No cross-club/vendor-run league change.** Stays entirely inside `029`'s club-owned `League` model, unchanged.
- **No enforcement that a league's structured Playing Conditions are filled in before it can host a `Match`.** Entering these fields stays entirely optional — a league can be scheduled and played with the Full Document only, exactly as today, with the structured tab left blank.

## User Stories

- As a club admin on a League's edit screen, I see a "Playing Conditions" tab (alongside Details/Teams/Schedule) rather than finding the PDF upload buried in the Schedule tab.
- As a club admin on that tab, I can upload (and later replace) the season's Playing Conditions PDF, exactly as I could before this spec, just relocated.
- As a club admin on that same tab, I can enter and save my league's match format (max overs per innings, powerplay overs, an optional per-bowler overs cap, free-text fielding-restriction notes), its points system (points for a win/loss/draw/no result/forfeit win), and its bonus-points rule (on/off, and — when on — the early-chase overs threshold and the bowling-restriction percentage), plus a free-text "additional notes" field for anything else worth capturing outside the PDF.
- As a club admin filling in match format, I can leave "max overs per bowler" blank to mean "use the standard one-fifth-of-the-innings rule," or enter an explicit override for a league that does it differently.
- As a club admin filling in bonus points, when I turn the bonus-points toggle off, I don't need to (and can't usefully) set the threshold/percentage fields — the form and the saved data both reflect that they're not meaningful while disabled.
- As a club admin viewing a League's read-only screen, I see a "Playing Conditions" section showing the same structured fields (when set) and a link to open the full PDF document (when uploaded), instead of only a bare download link.
- As a club admin, entering only some of the structured fields (e.g. match format but not points) and saving still works — the two groups aren't forced to be filled in together, and saving the structured fields at all doesn't require a PDF to already be uploaded, or vice versa.
- As a club admin, once I've saved a league+season's structured Playing Conditions, I can click "Share" and get a captain-friendly summary — either a WhatsApp-formatted text block I copy into a team chat, or a one-page PDF I can open, save, or print — covering just the overs/powerplay/points/bonus-point numbers, not the full document.
- As a club admin, if I try to share a summary before any structured field has been saved for the selected season, I'm told there's nothing to summarize yet rather than getting an empty or broken output.

## Data Model Changes

`LeaguePlayingConditions` (`050`) gains new nullable columns on the same row — still one row per `(league_id, season_id)`, per that spec's own "no version history" decision, which this spec doesn't revisit. **`document_url` and `uploaded_at`, both `NOT NULL` today, become nullable** — a genuine, necessary widening of `050`'s own schema: this spec makes it possible for a row to exist with structured fields saved but no PDF ever uploaded (an admin filling in match format/points before ever touching the PDF upload), so the row can no longer guarantee a document exists. `uploaded_at`/`uploaded_by` keep meaning exactly what they meant before — the PDF's own upload metadata — and stay `null` until a PDF is actually uploaded, regardless of whether the structured fields are set.

```sql
-- backend/src/main/resources/db/changelog/v1/027-add-league-playing-conditions-structured-fields.sql

ALTER TABLE league_playing_conditions ALTER COLUMN document_url DROP NOT NULL;
ALTER TABLE league_playing_conditions ALTER COLUMN uploaded_at DROP NOT NULL;
ALTER TABLE league_playing_conditions ALTER COLUMN uploaded_at DROP DEFAULT;

ALTER TABLE league_playing_conditions ADD COLUMN max_overs_per_innings INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN powerplay_overs INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN max_overs_per_bowler INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN fielding_restrictions_notes TEXT;

ALTER TABLE league_playing_conditions ADD COLUMN points_for_win INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN points_for_loss INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN points_for_draw INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN points_for_no_result INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN points_for_forfeit_win INTEGER;

ALTER TABLE league_playing_conditions ADD COLUMN bonus_points_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE league_playing_conditions ADD COLUMN bonus_batting_overs_threshold INTEGER;
ALTER TABLE league_playing_conditions ADD COLUMN bonus_bowling_restriction_percentage INTEGER;

ALTER TABLE league_playing_conditions ADD COLUMN additional_notes TEXT;
```

No new table, no new entity — every field above is a plain nullable column on the existing `LeaguePlayingConditions` entity, mapped field-for-field like its existing columns (no `@ElementCollection`, no nested embeddable — a flat row, matching this entity's existing shape).

**`LeaguePlayingConditions`'s existing `@PrePersist` must be narrowed**: today it unconditionally defaults `uploadedAt = Instant.now()` on first persist. Left as-is, a structured-fields-only save (no PDF ever uploaded) would incorrectly stamp `uploadedAt` as though a document existed. The hook must only default `uploadedAt` when `documentUrl` is non-null at persist time; `LeaguePlayingConditionsServiceImpl.upload()` already sets `uploadedAt` explicitly on every real upload, so this hook only ever matters for a row's very first PDF upload landing on a row already created by a prior structured-only save.

**Field meanings** (all nullable at the DB level — see Non-goals on backfill — but required together as a group by the new write endpoint's own validation, see API Contract):

*Match Format*
- `maxOversPerInnings` — the innings length, e.g. `20`.
- `powerplayOvers` — the first N overs of the innings under powerplay fielding restrictions, e.g. `6`. Must be `<= maxOversPerInnings`.
- `maxOversPerBowler` — a single bowler's overs cap, e.g. `4`. `null` means "no explicit override" — the conventional `ceil(maxOversPerInnings / 5)` rule applies, computed at read time by whatever consumes it (this spec's own UI, for a "(auto)" display — see UI Requirements — and, later, the not-yet-built results-calculation feature), never persisted as a resolved value. When set, must be `<= maxOversPerInnings`.
- `fieldingRestrictionsNotes` — free text; the exact circle/leg-side clauses vary too much between clubs to model as fields (the example document alone has roughly six distinct clauses here), so this stays prose, same posture as the rest of the PDF's content, just surfaced separately since it's directly adjacent to the structured match-format numbers.

*Points System* — all five required together once any is set (see API Contract validation):
- `pointsForWin`, `pointsForLoss`, `pointsForDraw`, `pointsForNoResult` — standard result points.
- `pointsForForfeitWin` — points awarded to the non-forfeiting side.

*Bonus Points*:
- `bonusPointsEnabled` — off by default (`false`).
- `bonusBattingOversThreshold` — the team batting second earns a bonus point if it reaches the target strictly before this over, e.g. `17`. Meaningful only when `bonusPointsEnabled`; must be `<= maxOversPerInnings` when set.
- `bonusBowlingRestrictionPercentage` — the team bowling second earns a bonus point if it restricts the chasing side to this percentage of the target (or bowls them out) before the same overs threshold, e.g. `80`. `1`–`100` inclusive when set, meaningful only when `bonusPointsEnabled`.

Service-layer rule (not bean validation, since it's cross-field): when `bonusPointsEnabled` is `true`, both threshold fields are required non-null; when `false`, the service clears both to `null` on save regardless of what the request sent — a deliberate decision so the persisted row never carries stale threshold values from a since-disabled bonus rule (see Rollout Notes).

*Additional Rules*:
- `additionalNotes` — free text for anything club-specific that doesn't fit the structured fields and isn't worth adding to the PDF (e.g. a short plain-text summary of interval/DLS/substitute rules).

## API Contract

| Endpoint | Access | Purpose / change |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions` | `@access.canAdministerClub` (unchanged) | `LeaguePlayingConditionsDto` response gains all fields from Data Model Changes; `documentUrl`/`uploadedAt` are now nullable in the response. `404` only when the row doesn't exist at all for this pair (neither a PDF nor any structured field has ever been saved) — unchanged trigger condition, just now covering "nothing saved of either kind" rather than "no PDF uploaded" |
| `POST /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions` | `@access.canAdministerClub` (unchanged) | Multipart PDF upload — behavior unchanged from `050`: still only touches `documentUrl`/`uploadedAt`/`uploadedBy`, still upserts against the row's unique `(league_id, season_id)` key — except the row may now already exist (created by a prior structured-fields-only `PUT`, below), in which case this upload adds the PDF fields onto that same existing row rather than creating a second one |
| `PUT /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions` | `@access.canAdministerClub` (new) | JSON body (`UpdateLeaguePlayingConditionsRequest`) — creates the row on first save for this `(league, season)` pair if none exists yet (an upsert, same posture as the existing PDF upload), otherwise updates the structured fields on the existing row in place, leaving `documentUrl`/`uploadedAt`/`uploadedBy` untouched. `404` if `leagueId`/`seasonId` belongs to a different club (same `LeagueSeasonAccessValidation` check the other two endpoints already use). `400` (`ValidationException`) on `powerplayOvers > maxOversPerInnings`, `maxOversPerBowler > maxOversPerInnings` when set, `bonusPointsEnabled = true` with either threshold field null, or `bonusBattingOversThreshold > maxOversPerInnings` when set |

`UpdateLeaguePlayingConditionsRequest` (new, `com.cricketlegend.dto`, a record per this codebase's existing `UpdateLeagueRequest`/`CreateLeagueRequest` convention — bean validation directly on the record components):

```java
public record UpdateLeaguePlayingConditionsRequest(
        @NotNull @Positive Integer maxOversPerInnings,
        @NotNull @Positive Integer powerplayOvers,
        @Positive Integer maxOversPerBowler,
        @Size(max = 2000) String fieldingRestrictionsNotes,
        @NotNull @Min(0) Integer pointsForWin,
        @NotNull @Min(0) Integer pointsForLoss,
        @NotNull @Min(0) Integer pointsForDraw,
        @NotNull @Min(0) Integer pointsForNoResult,
        @NotNull @Min(0) Integer pointsForForfeitWin,
        boolean bonusPointsEnabled,
        @Min(1) Integer bonusBattingOversThreshold,
        @Min(1) @Max(100) Integer bonusBowlingRestrictionPercentage,
        @Size(max = 4000) String additionalNotes) {
}
```

Every field is required at the request level (bean-validated `@NotNull` on every numeric field except the two genuinely optional overrides, `maxOversPerBowler` and the two bonus-threshold fields) — the structured tab is saved as one whole form, not field-by-field, so there's no partial-save case to support once an admin does choose to save it; entering nothing at all on the tab (never clicking save) is what leaves every new column `null`, per Data Model Changes.

`LeaguePlayingConditionsService`/`ServiceImpl` gain a new `update(UUID clubId, UUID leagueId, UUID seasonId, UpdateLeaguePlayingConditionsRequest request)` method alongside the existing `get`/`upload`, same upsert-against-`findByLeagueIdAndSeasonId` shape `upload()` already establishes — both mutating methods share that lookup-or-build pattern rather than duplicating it, per `docs/standards/backend.md`'s "shared logic lives in one place" rule (exact extraction shape — a small shared `private LeaguePlayingConditions findOrCreate(leagueId, seasonId)` helper — left to the plan).

## UI Requirements

**1. New 4th tab "Playing Conditions" on `LeagueFormPage.tsx`.** Tabs become `Details` / `Teams` / `Schedule` / `Playing Conditions` (`activeTab` 0–3) — `<Tab label="Details" /> <Tab label="Teams" /> <Tab label="Schedule" /> <Tab label="Playing Conditions" />`. The existing `DocumentUpload` block (currently inside the Schedule tab, `activeTab === 2`) moves to the new `activeTab === 3` block, under a "Full Document" sub-heading, with the same season `Select` this tab reuses from the others (shared `selectedSeasonId` state, same pattern every season-scoped tab on this page already follows — no second, independent season picker). The Schedule tab (`activeTab === 2`) keeps its Season picker, "Add Match"/"Share" actions, and `LeagueFixtures` list exactly as `050`/`051` left them — only the `DocumentUpload` block leaves it.

**2. New `ui/src/components/PlayingConditionsForm/` component** (four-file anatomy — `.tsx`/`.test.tsx`/`.stories.tsx`/`index.ts`), the structured-fields editor, rendered on the new tab beneath the relocated "Full Document" `DocumentUpload` block, under its own "Match Format & Points" sub-heading. Mirrors `LeagueForm.tsx`'s own controlled-form shape (local `useState` form state, a `validate()` function mirroring the client-side echo of this spec's server-side cross-field rules, a stable form `id` constant) rather than a new pattern — this is a same-shaped sibling to `LeagueForm`, not a new form paradigm. Unlike `LeagueForm` (whose Save button lives in `LeagueFormPage`'s shared `RecordFormScreen` actions bar, gated to `activeTab === 0`), this form owns its own local "Save Playing Conditions" `Button` inside itself — the same "tab-scoped action lives in the tab's own content, not the page-level actions bar" precedent the Schedule tab's "Add Match"/"Share"/`DocumentUpload`'s own "Upload" button already establish, since this save is scoped to the selected season, not the whole League record.

```ts
export interface PlayingConditionsFormProps {
  initialValues?: PlayingConditionsPayload | null   // null/undefined when nothing saved yet for this league+season
  onSubmit: (payload: PlayingConditionsPayload) => void
  pending: boolean
  error?: unknown
}
```

Fields, grouped visually (matching `LeagueForm`'s existing `RecordFormScreen`-grid field layout, `xs` single column / `md` two columns):
- Match Format group — `Max overs per innings` / `Powerplay overs` (both numeric `Input`, required), `Max overs per bowler` (numeric `Input`, optional, helper text `"Leave blank to use the standard ceil(overs ÷ 5) rule"` and, when the innings-overs field has a value, a live-computed `"(auto: N)"` hint via the new `resolveEffectiveMaxOversPerBowler` helper below), `Fielding restrictions notes` (multiline `Input`, optional, spans both columns).
- Points System group — five numeric `Input`s (`Points for win/loss/draw/no result/forfeit win`), all required. Seeded defaults on a first-ever save for this league+season (no `initialValues`): `pointsForWin=2`, `pointsForLoss=0`, `pointsForDraw=1`, `pointsForNoResult=1`, `pointsForForfeitWin=2` — a reasonable starting point for a typical T20 league so the form isn't a wall of empty required fields, matching `LeagueForm`'s own precedent of defaulting `maxPlayingXiSize` to `11`; every value remains freely editable.
- Bonus Points group — a `FormControlLabel`+`Checkbox` "Enable bonus points" (mirrors `LeagueForm`'s own `allowSubstitutions` checkbox), and two numeric `Input`s (`Early-chase overs threshold`, `Bowling restriction %`) rendered only when the checkbox is checked — not just disabled, genuinely unmounted, since they're not meaningful at all while off (matching the field's own "meaningful only when enabled" semantics from Data Model Changes) rather than shown-but-grayed.
- Additional Notes group — one multiline `Input`, optional, spans both columns.

Client-side `validate()` mirrors the server's cross-field rules exactly (`powerplayOvers <= maxOversPerInnings`, `maxOversPerBowler <= maxOversPerInnings` when set, `bonusBattingOversThreshold <= maxOversPerInnings` when set) so an obviously-invalid combination never round-trips to the backend just to be rejected — same posture `LeagueForm`'s own `validate()` already documents for `minAge <= maxAge`.

**3. New `ui/src/utils/playingConditions.ts`** — one pure helper, unit-tested, used by both this form's "(auto: N)" hint and `LeagueDetailPage.tsx`'s read-only rendering (item 5) so the two never state the formula differently:

```ts
export function resolveEffectiveMaxOversPerBowler(
  maxOversPerInnings: number | null,
  maxOversPerBowler: number | null,
): number | null
```

Returns `maxOversPerBowler` when set; otherwise `Math.ceil(maxOversPerInnings / 5)` when `maxOversPerInnings` is set; otherwise `null`.

**4. `LeagueFormPage.tsx` wiring.** A new `updatePlayingConditionsMutation` (`useMutation` calling `updatePlayingConditions`, item 6) alongside the existing `playingConditionsQuery`, invalidating the same `playingConditionsQueryKey` on success — same pattern the existing `DocumentUpload`'s `onUploaded` callback already uses. `PlayingConditionsForm`'s `initialValues` is built from `playingConditionsQuery.data` when every required structured field is present (i.e. `maxOversPerInnings != null`, the group's own "has this ever been saved" signal — `pointsFor*`/`bonusPointsEnabled` are always non-null together with it, per the request's "saved as one whole form" rule), else `null` (a first-time, unseeded form).

**5. New "Playing Conditions" section on `LeagueDetailPage.tsx`** — a 4th `RecordDetailScreen` section (`Details`, `Teams`, `Fixtures`, `Playing Conditions`), reusing the page's existing shared `selectedSeasonId`/`Select` (already in `headerNote`, unchanged). The existing `headerNote` "Playing Conditions" `Button` (which currently opens `playingConditionsQuery.data.documentUrl` directly) is **removed** from `headerNote` and its capability moves into this new section instead — per the feature request, this becomes a real section, not just a link floating in the header. Section content:
- When `playingConditionsQuery.data` is `null` (nothing saved for this league+season yet): `Typography` — `"No Playing Conditions set for this season yet."`
- Otherwise, a `DetailFieldGrid` of `DetailFieldRow`s covering every structured field that's set (match format, points, bonus points — bonus threshold/percentage rows omitted entirely when `bonusPointsEnabled` is `false`, matching `LeagueDetailPage`'s own existing convention of omitting a `DetailFieldRow` entirely rather than rendering it blank, e.g. its current age-range row), the "Max overs per bowler" row showing the explicit value or, when `null`, the computed `"N (auto)"` via `resolveEffectiveMaxOversPerBowler` (item 3), and `Fielding restrictions notes`/`Additional notes` rendered as their own full-width rows when non-empty.
- A "View full document" `Button` (same `variant="ghost"` treatment the removed header button used) rendered inside this section, only when `playingConditionsQuery.data.documentUrl` is non-null, opening it via `window.open(url, '_blank')` — the exact same mechanism, just relocated into the section body instead of the header.

**6. `ui/src/api/leaguePlayingConditionsApi.ts` changes.** `LeaguePlayingConditions` interface gains every new field from Data Model Changes (`documentUrl`/`uploadedAt` become `string | null`); a new `PlayingConditionsPayload` interface (the writable structured-fields subset, mirroring `UpdateLeaguePlayingConditionsRequest` field-for-field); a new `updatePlayingConditions(clubId, leagueId, seasonId, payload: PlayingConditionsPayload): Promise<LeaguePlayingConditions>` calling the new `PUT` endpoint. `getPlayingConditions`'s existing "404 → `null`" behavior is unchanged and now also covers "row exists with only structured fields, no PDF" correctly, since that's a `200` with `documentUrl: null`, not a `404`.

**7. New `ui/src/components/PlayingConditionsShareDialog/` component** (four-file anatomy), the captain-summary share surface — mirrors `TeamSheetCommunicationDialog.tsx`'s exact structure: `Dialog fullWidth maxWidth="xs"` → `DialogTitle` "Share Playing Conditions" → `DialogContent` → a `List disablePadding` of two `ListItemButton` rows (`PictureAsPdfOutlinedIcon` "PDF Summary" / secondary "Generate a one-page summary, ready to print or save." and `WhatsAppIcon` "WhatsApp" / secondary "Share a text summary to a group chat.") with `selectedOption: 'pdf' | 'whatsapp'` state exactly like that component's own — no third placeholder row (see Non-goals). Selecting "WhatsApp" reveals the same `Input` `multiline minRows={10}` textarea pre-filled via a synchronous `generatePlayingConditionsWhatsAppText(...)` call (item 8) plus a "Regenerate" `Button` (`variant="ghost"`, `RefreshOutlinedIcon`), identical to `TeamSheetCommunicationDialog`'s own WhatsApp branch. `DialogActions`: Cancel, plus an asymmetric footer button exactly like that component's (`selectedOption === 'pdf'` → `onClick={onSharePdf}` labelled `isGenerating ? 'Generating…' : 'Open PDF'`; else → `onClick={handleCopyWhatsApp}` (`navigator.clipboard.writeText`, same try/catch-with-inline-error posture) labelled "Copy to Clipboard"). When `hasStructuredFields` (a prop, see below) is `false`, `DialogContent` renders an `Alert severity="info"` — `"Save the league's match format, points, and bonus-point rules before sharing a summary."` — in place of the option list, and both footer actions are disabled (same "empty-state alert replaces the interactive body" shape `TeamSheetCommunicationDialog` already uses for its own "add players to a Playing XI first" case). Reset-on-close `useEffect` mirrors that component's exactly (`selectedOption`/`whatsappText`/`isGenerating`/`error` reset on `!open`).

```ts
export interface PlayingConditionsShareDialogProps {
  open: boolean
  onClose: () => void
  hasStructuredFields: boolean
  leagueName: string
  seasonLabel: string
  conditions: PlayingConditionsPayload | null  // structured fields only; null when hasStructuredFields is false
  onSharePdf: () => Promise<void>
}
```

**8. Two new pure/near-pure utils, unit-tested**, both consuming only `PlayingConditionsPayload` plus `leagueName`/`seasonLabel` — neither touches the Full Document PDF or fetches anything beyond a club logo image (mirroring `teamSheetPdf.ts`'s own `loadImageBase64`, resolving `null` on any failure, same as that file's precedent):

```ts
// ui/src/utils/playingConditionsWhatsAppText.ts
export function generatePlayingConditionsWhatsAppText(
  leagueName: string,
  seasonLabel: string,
  conditions: PlayingConditionsPayload,
): string
```
Synchronous, WhatsApp-formatted (`*bold*`) plain text — mirrors `generateTeamSheetWhatsAppText`'s own block-based structure: a bold header line (`*${leagueName} — Playing Conditions*`, `seasonLabel` beneath), a "Match Format" block (overs/powerplay/max-overs-per-bowler via `resolveEffectiveMaxOversPerBowler`, item 3), a "Points" block (all five point values on one line each), a "Bonus Points" block only when `bonusPointsEnabled` (the two thresholds in plain language: `"Chase the target before over 17 for a bonus point"` / `"Restrict them to 80% of the target (or bowl them out) before over 17 for a bonus point"`), omitted entirely when disabled — same "omit rather than render blank" convention as the read-only detail section (item 5).

```ts
// ui/src/utils/playingConditionsSummaryPdf.ts
export async function generatePlayingConditionsSummaryPdf(
  leagueName: string,
  seasonLabel: string,
  conditions: PlayingConditionsPayload,
): Promise<string>  // blob URL — caller does window.open(url, '_blank'), same delivery contract as leagueSchedulePdf.ts
```
A single-page jsPDF document — same `DARK`/`MID`/`WHITE`/`LGRAY` constants and dark header-band precedent as `teamSheetPdf.ts`/`leagueSchedulePdf.ts` (re-declared locally, not imported, matching those files' own self-contained-module precedent), no `checkPage`/pagination needed since the field count guarantees one page: header band (league name, `"${seasonLabel} — Playing Conditions Summary"`), then the same three grouped blocks as the WhatsApp text (Match Format / Points / Bonus Points, bonus block omitted when disabled), laid out as label/value rows, a footer line — `"Full Playing Conditions available from your club."`. No page number (always exactly one page).

Both host pages (`LeagueFormPage.tsx`'s new tab and `LeagueDetailPage.tsx`'s new section) render a "Share" `Button` next to their existing "Save Playing Conditions" (form) / "View full document" (detail) actions, opening `PlayingConditionsShareDialog` with `hasStructuredFields`/`conditions` derived the same way item 4's `initialValues` already are (`maxOversPerInnings != null` as the "has this been saved" signal), and `onSharePdf` calling `generatePlayingConditionsSummaryPdf(...)` then `window.open(url, '_blank')`.

**Mobile-first**, per `docs/standards/frontend.md`: `PlayingConditionsForm`'s field groups stack to a single column at 375px exactly like `LeagueForm`'s existing grid; the bonus-points threshold fields, when shown, sit directly beneath the "Enable bonus points" checkbox in the same single-column flow; `LeagueDetailPage`'s new section's `DetailFieldGrid` already wraps to one column at `xs` (existing behavior, unchanged); `PlayingConditionsShareDialog`'s `maxWidth="xs"` layout is already phone-width-safe, same as `TeamSheetCommunicationDialog`.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `LeaguePlayingConditionsServiceImplTest` — new `update()` cases: first save for a `(league, season)` pair with no existing row creates one with `documentUrl`/`uploadedAt`/`uploadedBy` all null; a save against a row that already has a PDF (from a prior `upload()`) leaves the PDF fields untouched; `powerplayOvers > maxOversPerInnings` rejected `400`; `maxOversPerBowler > maxOversPerInnings` rejected `400`; `bonusPointsEnabled=true` with a null threshold rejected `400`; `bonusPointsEnabled=false` persists `null` for both threshold fields regardless of what the request sent; `bonusBattingOversThreshold > maxOversPerInnings` rejected `400`; cross-club `NotFoundException` isolation for `leagueId`/`seasonId`, matching `get`/`upload`'s existing tests. `resolveEffectiveMaxOversPerBowler.test.ts` — explicit value returned when set, `ceil` formula applied when null, `null` returned when `maxOversPerInnings` is itself null |
| Integration | Migration `027-add-league-playing-conditions-structured-fields.sql` applies cleanly against existing `league_playing_conditions` rows (a pre-`052` row with `document_url`/`uploaded_at` populated is unaffected; the nullability change doesn't reject existing data); a new repository-level save proves a structured-only row (all PDF fields null) persists and round-trips correctly; controller integration test for the new `PUT` endpoint — a first structured-only save, a save against an existing PDF-carrying row, the four `400` validation cases above at the HTTP layer, cross-club `404` isolation |
| Contract | `LeaguePlayingConditionsDto`'s new fields and nullable `documentUrl`/`uploadedAt`, `UpdateLeaguePlayingConditionsRequest`, and the new `PUT` endpoint all documented in the checked-in OpenAPI schema |
| Component | `PlayingConditionsForm.test.tsx` + Storybook story — renders seeded default point values with no `initialValues`; renders saved values when `initialValues` is provided; client-side validation blocks submit on `powerplayOvers > maxOversPerInnings` and on `bonusPointsEnabled` with a missing threshold; bonus-threshold fields are unmounted (not merely disabled) while the checkbox is unchecked, and appear when checked; `onSubmit` receives the exact expected payload shape. `LeagueFormPage.test.tsx` extended — 4th tab renders "Playing Conditions"; `DocumentUpload` no longer renders under the Schedule tab and does render under the new tab; `PlayingConditionsForm`'s save wires to `updatePlayingConditions` and invalidates the shared query key on success; new tab's "Share" button opens `PlayingConditionsShareDialog`. `LeagueDetailPage.test.tsx` extended — new section renders the empty-state copy when nothing is saved; renders the full `DetailFieldGrid` (including the bonus rows only when enabled, and the "(auto)" max-overs-per-bowler hint when null) when data exists; "View full document" renders only when `documentUrl` is set and calls `window.open` with it; the old header-level Playing Conditions button no longer renders; new section's "Share" button opens `PlayingConditionsShareDialog`. `generatePlayingConditionsWhatsAppText.test.ts` — bonus block present only when `bonusPointsEnabled`, max-overs-per-bowler line reflects the auto/explicit value via `resolveEffectiveMaxOversPerBowler`, WhatsApp bold markers wrap the header line. `playingConditionsSummaryPdf.test.ts` — mirrors `teamSheetPdf.test.ts`'s `MockJsPDF` mocking shape; bonus block spy calls present/absent per `bonusPointsEnabled`, single page (no `addPage` call). `PlayingConditionsShareDialog.test.tsx` + Storybook story — mirrors `TeamSheetCommunicationDialog.test.tsx`'s shape; `hasStructuredFields=false` renders the info `Alert` with both footer actions disabled; WhatsApp option shows pre-filled, regeneratable text and copies it via `navigator.clipboard.writeText` on footer click, closing the dialog on success and surfacing an inline error on failure; PDF option's footer button calls `onSharePdf` and shows a generating state; reset-on-close |
| End-to-end | None new — extends `050`'s already-covered "edit a league" golden path rather than introducing a new one; not wired into CI regardless, matching every prior `/manage` spec's stated precedent |

## Acceptance Criteria

- A club admin editing a league sees a "Playing Conditions" tab, separate from "Schedule," containing both the PDF upload (unchanged capability) and a structured Match Format / Points System / Bonus Points / Additional Notes form.
- Saving the structured form with `powerplayOvers` greater than `maxOversPerInnings`, or `maxOversPerBowler` greater than `maxOversPerInnings`, is rejected both client-side (before any request) and server-side (`400`) if somehow bypassed.
- Enabling "bonus points" without setting both the overs threshold and the restriction percentage is rejected the same way; disabling it after both were set clears both fields on save.
- A club admin can save the structured fields for a league+season that has no PDF uploaded yet, and separately upload a PDF for a league+season that has no structured fields saved yet — neither blocks the other, and both live on the same underlying row once both exist.
- A club admin viewing a league (read-only) sees a "Playing Conditions" section showing every structured field that's been set, a computed "(auto)" value for max overs per bowler when it was left blank, and a "View full document" action when a PDF exists — and sees a clear "not set yet" message when nothing has been saved for the selected season.
- No score, result, outcome, or standings field exists anywhere in this codebase as a result of this spec — every field added is an input a future results-calculation feature could read, not a computed or captured result itself.
- Every pre-existing `LeaguePlayingConditions` row (PDF-only, from before this spec) continues to work exactly as before: its document still opens via the same link, and its new structured-field columns simply read as unset until an admin fills them in.
- A club admin can click "Share" (from either host page, once structured fields are saved) and get a captain-friendly summary in both formats: WhatsApp text copies to the clipboard with the right values, and the PDF opens in a new tab as a single, correctly-laid-out page — without ever touching or requiring the uploaded Full Document PDF.
- Attempting to share before any structured field has been saved for the selected season shows an explanatory message instead of an empty or broken summary.

## Rollout Notes

- **This spec is explicitly preparatory for `029`'s still-unscheduled "Phase 1: results capture and standings" item** (`docs/roadmap.md`'s "Blocked on the full tenancy model" section, "results capture" bullet) — a human should note against that roadmap item, once this ships, that its points/bonus-points/overs inputs now exist on `LeaguePlayingConditions` and don't need to be re-designed when that spec is finally written; the results-calculation logic itself is still that future spec's own scope, not touched here.
- **The bonus-points model here is deliberately narrow — one specific rule shape, not a general engine.** Flagged explicitly in Non-goals: if a second, differently-shaped bonus convention is encountered for a different club's league, that's the trigger to revisit this as a pluggable rule model, not something to speculatively build now for a hypothetical second shape.
- **`document_url`/`uploaded_at` becoming nullable is a real, if narrow, schema-shape change to a table `050` shipped as `NOT NULL`.** Confirmed safe for existing data (every pre-`052` row already has both populated; relaxing a `NOT NULL` constraint never rejects existing rows) — called out here explicitly since it's the one place this spec touches `050`'s existing columns rather than only adding new ones.
- Ships as one PR — one migration (`027-add-league-playing-conditions-structured-fields.sql`), `LeaguePlayingConditionsDto`/`LeaguePlayingConditionsMapper`/entity field additions, the narrowed `@PrePersist`, the new `UpdateLeaguePlayingConditionsRequest` + `LeaguePlayingConditionsService.update()` + controller `PUT` mapping, the new `ui/src/utils/playingConditions.ts` + `ui/src/components/PlayingConditionsForm/` (full four-file anatomy), the captain-summary share slice (`ui/src/utils/playingConditionsWhatsAppText.ts`, `ui/src/utils/playingConditionsSummaryPdf.ts`, `ui/src/components/PlayingConditionsShareDialog/`), and both host-page changes (`LeagueFormPage.tsx`'s new tab, `LeagueDetailPage.tsx`'s new section replacing its old header button) — no staggering across multiple PRs, matching `050`/`051`'s own precedent for a similarly-scoped change.
- No Claude Design pass flagged as a prerequisite, unlike `050`'s `LeagueFixtures`/`DocumentUpload` — `PlayingConditionsForm` is a same-shaped sibling to the existing `LeagueForm` (a field-grid form using existing `Input`/`Checkbox` primitives), not a genuinely new visual pattern; the new "Playing Conditions" section on `LeagueDetailPage.tsx` composes from the existing `DetailFieldGrid`/`DetailFieldRow` primitives `036` already established; `PlayingConditionsShareDialog` is a same-shaped sibling to `TeamSheetCommunicationDialog`. The plan can build directly against this spec's UI Requirements.
- **The captain summary is deliberately scoped to a shareable output, not a new audience.** This was an explicit decision (not the original request's literal wording, which just said "a summary view for captains") — this codebase has no player/captain-facing auth or route anywhere yet, and every prior Fixtures-area spec (`050`/`051`) has stayed `/manage`-only. Building real captain login was flagged as materially bigger scope (its own foundational spec) and traded for the `039`-precedented "admin generates, admin shares outside the platform" model instead. If a genuine in-app captain/player surface is wanted later, that's a new foundational spec, not an extension of this one.
- **Amendment (same PR): `League.allowSubstitutions` moved to `LeaguePlayingConditions.allowSubstitutions`.** Raised during the PR review of this spec's own League view screen — `League` currently carries `maxPlayingXiSize`/`allowSubstitutions`/`minAge`/`maxAge`/`ageCutoffDate`, all fixed per-League rather than per-season, which is questionable for a club running the same League across many years. Investigated before acting: `maxPlayingXiSize`/`minAge`/`maxAge`/`ageCutoffDate` are all genuinely enforced by `MatchSideServiceImpl` (squad cap, age eligibility) — moving them means rewiring that validation to read from the match's own `(leagueId, seasonId)` `LeaguePlayingConditions` row instead of `League` directly, a real, separate migration this spec does not attempt. `allowSubstitutions`, by contrast, was confirmed (by reading every call site) to be enforced by **nothing** — purely informational display text on the League card/detail screen — so moving just that one field was safe, mechanical, and low-risk. New migration `028-move-allow-substitutions-to-playing-conditions.sql`: adds `allow_substitutions BOOLEAN NOT NULL DEFAULT false` to `league_playing_conditions`, drops the column from `league`. `UpdateLeaguePlayingConditionsRequest`/`LeaguePlayingConditionsDto` gain the field (in the Match Format group, alongside the other squad-composition rules); `CreateLeagueRequest`/`UpdateLeagueRequest`/`LeagueDto` lose it; `LeagueForm.tsx` loses its checkbox, `PlayingConditionsForm.tsx` gains one; `LeagueDetailPage.tsx`'s "Substitutions allowed" row moves from the Details section to the Playing Conditions section; `LeagueList.tsx`'s `leagueChips`/"Substitutions allowed" card chip is removed outright (the League summary card has no season context to read the new per-season value from, and fetching it per-card for a chip was judged not worth the added round-trips for this one badge). The remaining four fields' migration is **not** in scope here — flagged as a real, separate future spec if a club actually needs per-season squad-cap/age-eligibility rules, not speculatively built now.
