# Plan: 051 — League Schedule Sharing

## Context

`docs/specs/051-league-schedule-sharing.md` (draft, approved — design mockup already approved this session, no further design-pass gate needed) adds four client-side generators (Schedule PDF, Poster PNG, per-team `.ics` calendar, a static next-match countdown) plus two new components (`NextMatchCountdown`, `ShareScheduleDialog`) to the League Fixtures surfaces built in `050`. Frontend-only — no backend/data-model change, everything consumes `Match`/`Team`/`League`/`Season` data the host pages (`LeagueDetailPage.tsx`, `LeagueFormPage.tsx`) already fetch.

An Explore pass confirmed every precedent directly against current source (not the spec's paraphrase) — exact structure below is read from the real files:

- `ui/src/utils/teamSheetPdf.ts` is the exact PDF structure to mirror: theme-derived RGB constants (`DARK=[20,35,28]`, `MID=[47,110,79]`, `WHITE`, `LGRAY=[150,165,158]` — the new file only needs these four, not `GRAY`/`TWELFTH_FILL`/`TWELFTH_BORDER`, which are team-sheet-specific), an unexported `loadImageBase64` (fetch→blob→`FileReader`, resolves `null` on any failure), a `checkPage(needed)` closure for hand-rolled pagination (`if (y + needed > safeBottom) { drawFooter(); doc.addPage(); y = 16 }`), an inline (not a separate function) header band drawn once on page 1 only, and `return URL.createObjectURL(doc.output('blob'))` as the delivery contract.
- `ui/src/utils/teamSheetPdf.test.ts` is the exact jsPDF-mocking precedent: a hand-rolled `MockJsPDF` class (`vi.mock('jspdf', () => ({ jsPDF: MockJsPDF }))`) with each drawing method as its own `vi.fn()` spy, assertions on `spy.mock.calls` contents (never parsed PDF bytes), `URL.createObjectURL` stubbed via `vi.stubGlobal`, `fetch`/a `StubFileReader` class stubbed per-test for the logo-load path.
- `ui/src/utils/teamSheetWhatsAppText.ts` has two exact doc-comments to cite/mirror verbatim explaining why small resolution helpers are duplicated per-file rather than imported from a sibling module (a `playerName`-style comment and a `resolveRosterLines`-style comment, both citing "docs/plans/030-team-sheet-communication.md's Flag #2" as the precedent for not reaching into already-shipped code for a small block).
- `ui/src/components/TeamSheetCommunicationDialog/TeamSheetCommunicationDialog.tsx` is the exact dialog shape: `Dialog(fullWidth, maxWidth="xs")` → `DialogTitle` → `DialogContent` → `List disablePadding` of `ListItemButton` option rows, a disabled **non-interactive** `ListItem` (not `ListItemButton`) for a "coming soon"/unavailable row with `sx={{opacity:0.6}}` and `secondaryAction={<Chip size="small" variant="outlined" .../>}` — this is the exact shape the "Add to Calendar" row uses when disabled (All Teams scope selected), just with different `Chip` copy ("Select a single team" instead of "Coming soon"). Reset-on-close via a `useEffect` on `open`. Inline error is a plain `Typography variant="body2" color="error.main"`, not an `Alert`.
- `ui/src/components/LeagueFixtures/LeagueFixtures.tsx`'s three unexported helpers to duplicate locally in the new PDF/poster files: `resolveSide(teamId, teamName, logoUrl, teamsById)` → `{name, logoUrl}` (falls back to `'Unknown team'`/`'TBC'`), `dateHeading(iso)` → `"Sat, 14 Mar 2026"`, `dayKey(iso)` → `iso.slice(0,10)` for grouping.
- `LeagueDetailPage.tsx`'s current Fixtures section (lines 212–222) has **no `note` prop set today** — that's where the Share button goes. **Neither host page currently computes a `seasonLabel` string anywhere** — only `selectedSeasonId` is held in state; both pages need a new `useMemo` resolving `seasonsQuery.data?.find(s => s.id === selectedSeasonId)?.label`.
- `LeagueFormPage.tsx`'s Schedule tab currently has "Add Match" alone inside a `flexDirection: 'column'` `Box` — the plan needs to change that to a row (`Stack direction="row"`) to sit a new Share button alongside it, not simply append a second child to a column layout.
- **Confirmed by grep**: zero `<a download>`/`createElement('a')`-triggered-download patterns exist anywhere in this codebase today (the two `.click()` hits found are both hidden file-*input* triggers for uploads, unrelated). This plan's poster/calendar delivery is genuinely the first forced download.
- `ui/package.json` confirms `jspdf@^4.2.1`, no `html2canvas`/`ics`/canvas library as a real dependency (an `html2canvas` entry exists only as one of jsPDF's own optional transitive installs, never imported).
- **Poster branding**: `withClubBranding()` (`ui/src/theme.ts`) is a `Theme`-returning function, not something a plain util can call itself — `leagueSchedulePoster.ts` is a pure function with no React/theme context, so it takes the resolved primary color as a plain hex-string parameter, supplied by the caller (which does have theme context via `useTheme()`).
- **One small plan-level decision beyond the spec's own text**: both the poster and the calendar file need the exact same "wrap a blob URL in a temporary `<a download>` element, click it, revoke the URL" mechanics — genuinely identical browser-API glue with no business logic in it (unlike `resolveSide`/`dateHeading`, which are shaped by each file's own data and follow this codebase's established per-file-duplication precedent). Extracting one tiny shared `ui/src/utils/triggerDownload.ts` (`triggerDownload(blobUrl: string, filename: string): void`) for just this mechanical browser-API step is the right call — not a violation of the "duplicate small resolution helpers" precedent, which is specifically about *data-shaped* logic, not identical DOM plumbing.

## Files to touch, in order

### 1. `ui/src/utils/triggerDownload.ts` (new)
```ts
export function triggerDownload(blobUrl: string, filename: string): void
```
Creates a temporary `<a href={blobUrl} download={filename}>`, appends to `document.body`, `.click()`s it, removes it, and `URL.revokeObjectURL(blobUrl)`s afterward. This codebase's first forced-download helper — used by both item 3 and item 5 below, nothing else.

### 2. `ui/src/utils/leagueSchedulePdf.ts` (new)
```ts
export async function generateLeagueSchedulePdf(
  matches: Match[],
  teamsById: Map<string, Team>,
  leagueName: string,
  seasonLabel: string,
  teamFilter: { teamId: string; teamName: string } | null,
): Promise<string> // blob URL — caller does window.open(url, '_blank')
```
Mirrors `teamSheetPdf.ts` exactly: same `DARK`/`MID`/`WHITE`/`LGRAY` constants (re-declared locally, not imported — matching that file's own self-contained-module precedent), a locally-duplicated `loadImageBase64`, a locally-duplicated `resolveSide`/`dateHeading`/`dayKey` (copied from `LeagueFixtures.tsx`, unexported), the same `checkPage`/pagination closure, a dark header band (league name, `"${seasonLabel}"` or `"${teamFilter.teamName} — ${seasonLabel}"` subtitle when scoped) drawn once on page 1, date-grouped match rows (home logo/initials — "VS" + time + venue — away logo/initials, using each side's real `Team.logoUrl` via id lookup or the match's own `homeTeamLogoUrl`/`awayTeamLogoUrl` for an external opponent), a footer with league name + page number repeated via `drawFooter()` on every page. When `teamFilter` is set, pre-filter `matches` to `m => m.homeTeamId === teamFilter.teamId || m.awayTeamId === teamFilter.teamId` before any layout math.

### 3. `ui/src/utils/leagueSchedulePoster.ts` (new)
```ts
export async function generateLeagueSchedulePoster(
  matches: Match[],
  teamsById: Map<string, Team>,
  leagueName: string,
  seasonLabel: string,
  teamFilter: { teamId: string; teamName: string } | null,
  primaryColorHex: string, // caller resolves via useTheme().palette.primary.main
): Promise<string> // blob URL via canvas.toBlob('image/png') → URL.createObjectURL
```
Genuinely new Canvas2D drawing code (no existing file to extend) — a 1080×1080 `<canvas>`, gradient background derived from `primaryColorHex` (parse hex → RGB, build a `createLinearGradient`/`createRadialGradient` dark-to-darker sweep, per the approved mockup) with a subtle repeated dot-grid texture, header text (league name/season/team-scope subtitle), a short list of upcoming match rows (same `resolveSide`/`dateHeading` helpers duplicated locally again, per the established per-file precedent), a "Generated by Cricket Legend" footer mark. Same `teamFilter` pre-filtering as item 2. Delivered as `canvas.toBlob(blob => resolve(URL.createObjectURL(blob)), 'image/png')`.

### 4. `ui/src/utils/leagueScheduleIcs.ts` (new)
```ts
export function generateLeagueScheduleIcs(
  matches: Match[],
  teamsById: Map<string, Team>,
  leagueName: string,
  seasonLabel: string,
  team: { teamId: string; teamName: string }, // required — per-team only
): string // a "text/calendar" Blob's object URL — caller uses triggerDownload
```
Hand-built `BEGIN:VCALENDAR`/`VEVENT`/`END:VCALENDAR` text, no library. One `VEVENT` per `matches.filter(m => m.homeTeamId === team.teamId || m.awayTeamId === team.teamId)`: `SUMMARY` (`"${home} vs ${away}"`, via the same locally-duplicated `resolveSide`, name only), `LOCATION` (`match.venue`, omitted when null), `DESCRIPTION` (`"${leagueName} — ${seasonLabel}"`), `DTSTART` (`match.matchDate` → `YYYYMMDDTHHMMSSZ` UTC), `DTEND` = `DTSTART + 3h` (fixed duration, per the spec's own explicit decision), `UID` = `"${match.id}@cricketlegend"` (stable across re-downloads), `DTSTAMP` = generation time. A local `escapeIcsText(value: string): string` helper escapes `\`, `;`, `,`, and newlines per RFC 5545 — applied to every free-text field. Returns a blob URL via `new Blob([icsText], {type: 'text/calendar;charset=utf-8'})` → `URL.createObjectURL`.

### 5. `ui/src/utils/nextMatchCountdown.ts` (new)
```ts
export interface NextMatchCountdown {
  match: Match
  label: 'today' | 'tomorrow' | 'days'
  value?: number
}
export function resolveNextMatchCountdown(matches: Match[], now: Date): NextMatchCountdown | null
```
Finds the earliest match with `new Date(m.matchDate) > now`; `null` if none. Day-boundary comparison uses each date's own local calendar day (midnight-to-midnight diff), not raw elapsed hours, so a match later today is `'today'` and one just after midnight tomorrow is `'tomorrow'`. `value` (whole days) populated only for `label === 'days'`.

### 6. `ui/src/components/NextMatchCountdown/` (new, four-file anatomy)
```ts
export interface NextMatchCountdownProps {
  countdown: NextMatchCountdown | null
  teamsById: Map<string, Team>
}
```
Presentational; renders `null` when `countdown` is `null` (host conditionally renders — no own empty state needed, `LeagueFixtures`'s `EmptyState` already covers "nothing scheduled"). Per the approved mockup: a horizontal card — a large day-count number + "DAYS" label on the left (or a single "Today"/"Tomorrow" chip in that slot for those two `label`s), a divider, then "Next match" + both team names (via the component's own small inline resolution — `resolveSide` is unexported in `LeagueFixtures.tsx`, so this component needs its own, same duplication posture as the utils above) + date/time/venue. Stacks to a single column at 375px (day-count block above the divider above the details), per `docs/standards/frontend.md`.

### 7. `ui/src/components/ShareScheduleDialog/` (new, four-file anatomy)
```ts
export type ShareScheduleOption = 'pdf' | 'poster' | 'calendar'
export interface ShareScheduleTeamOption { teamId: string; teamName: string }
export interface ShareScheduleDialogProps {
  open: boolean
  onClose: () => void
  leagueName: string
  seasonLabel: string
  teams: ShareScheduleTeamOption[]
  onSharePdf: (teamFilter: ShareScheduleTeamOption | null) => Promise<void>
  onSharePoster: (teamFilter: ShareScheduleTeamOption | null) => Promise<void>
  onShareCalendar: (team: ShareScheduleTeamOption) => Promise<void>
}
```
Mirrors `TeamSheetCommunicationDialog`'s exact structure (`Dialog fullWidth maxWidth="xs"` → `DialogTitle` + a caption `Typography` showing `leagueName`/`seasonLabel` → `DialogContent` → `List disablePadding` of three `ListItemButton` rows (Schedule PDF / Poster Image / Add to Calendar) → a `ToggleButtonGroup` team-scope selector ("All Teams (Full Schedule)" + one row per `teams` entry, `exclusive`) → `DialogActions` with Cancel + a footer button whose label swaps per selected option ("Open PDF" / "Download Poster" / "Download Calendar")). When scope is "All Teams," the "Add to Calendar" row renders as the exact disabled-`ListItem`-with-`Chip` shape `TeamSheetCommunicationDialog`'s Facebook row uses (`sx={{opacity:0.6}}`, `secondaryAction={<Chip label="Select a single team" size="small" variant="outlined" />}`) instead of a clickable `ListItemButton`; selecting it while disabled is impossible by construction (not interactive), and if the admin had "calendar" selected and then switches scope back to "All Teams," `selectedOption` resets to `'pdf'`. Reset-on-close `useEffect` mirrors `TeamSheetCommunicationDialog`'s exactly (`manualScope`/`selectedOption`/`isGenerating`/`error` all reset to their defaults on `!open`). Inline error is the same plain `Typography variant="body2" color="error.main"` convention, not an `Alert`.

### 8. `ui/src/pages/manage/LeagueDetailPage.tsx` (edited)
- Add a `seasonLabel` `useMemo`: `seasonsQuery.data?.find(s => s.id === selectedSeasonId)?.label ?? ''`.
- Add `shareOpen` state (`useState(false)`).
- Fixtures section (currently lines 212–222): add a `note` — a ghost/secondary `Button` "Share" (icon: `ShareOutlinedIcon` or similar) that sets `shareOpen(true)`, matching the header/section note styling convention already established by the Playing Conditions button in `headerNote`. Inside `content`'s season-exists branch, render `<NextMatchCountdown countdown={resolveNextMatchCountdown(matchesQuery.data?.content ?? [], new Date())} teamsById={teamsById} />` above `<LeagueFixtures .../>` — compute the countdown via `useMemo(() => resolveNextMatchCountdown(matchesQuery.data?.content ?? [], new Date()), [matchesQuery.data])`, not recomputed on every render.
- Render `<ShareScheduleDialog>` as a sibling after `</RecordDetailScreen>` (matching how dialogs are rendered outside the main screen component elsewhere in this codebase), wired to: `teams={affiliationsForSeason.map(a => ({teamId: a.teamId, teamName: teamsById.get(a.teamId)?.name ?? 'Unknown team'}))}`, and three callbacks:
  - `onSharePdf`: `await generateLeagueSchedulePdf(matchesQuery.data?.content ?? [], teamsById, league.name, seasonLabel, teamFilter)` then `window.open(url, '_blank')`.
  - `onSharePoster`: same generator call to `generateLeagueSchedulePoster(..., theme.palette.primary.main)` (needs `useTheme()` imported) then `triggerDownload(url, ...)`.
  - `onShareCalendar`: `generateLeagueScheduleIcs(...)` then `triggerDownload(url, ...)`.

### 9. `ui/src/pages/manage/LeagueFormPage.tsx` (edited)
- Same `seasonLabel` `useMemo` and `shareOpen` state as item 8.
- Schedule tab: change the `Box sx={{display:'flex', flexDirection:'column', gap:2}}` wrapping "Add Match" (currently alone) into a `Stack direction="row" spacing={2} flexWrap="wrap"` containing both "Add Match" and a new "Share" `Button` (same `variant="secondary" size="sm"` treatment), both above `<LeagueFixtures .../>` (unchanged, still below). No `NextMatchCountdown` on this tab, per the spec.
- Render `<ShareScheduleDialog>` as a sibling to the existing `<LinkExistingRecordDialog>` (same placement convention, dialog state declared alongside `linkOpen`), wired to the same three callbacks as item 8 (this page's own `matchesQuery`/`teamsById`/`affiliationsForSeason`/`league`/`seasonLabel`).

## Test coverage (test-writer, after the above)

- `triggerDownload.test.ts` — creates and clicks a real `<a>` with the right `href`/`download` attributes, revokes the URL, removes the element from the DOM afterward.
- `leagueSchedulePdf.test.ts` / `leagueSchedulePoster.test.ts` — mirror `teamSheetPdf.test.ts`'s exact jsPDF-mocking shape for the PDF file (`MockJsPDF` class, spy-per-method, assert on `.mock.calls`); a new, analogous `HTMLCanvasElement.getContext('2d')` mock for the poster file (spy `fillRect`/`fillText`/`drawImage`, assert on call inputs) — this codebase's first Canvas2D mock, explicitly flagged in the spec's Rollout Notes as the new reusable precedent. Both: `teamFilter: null` includes every match, a set `teamFilter` includes only that team's matches (home or away), a missing team logo falls back without throwing.
- `leagueScheduleIcs.test.ts` — correct `VEVENT` fields including the fixed 3-hour `DTEND`, RFC 5545 escaping of commas/semicolons/backslashes/newlines in a free-text opponent name and venue, filters to only the given team's matches, an empty per-team fixture list produces a valid zero-`VEVENT` calendar rather than throwing.
- `nextMatchCountdown.test.ts` — earliest future match selected from an unsorted mixed past/future list, `null` when none, today/tomorrow/multi-day boundary correctness, a same-calendar-day-but-already-past match correctly excluded.
- `NextMatchCountdown.test.tsx` + Storybook story — renders nothing given `null`; renders the chip vs. numeric-day treatment correctly per `label`; resolves both team names via `teamsById`.
- `ShareScheduleDialog.test.tsx` + Storybook story — all three rows render; "Add to Calendar" is the disabled-`ListItem` shape when scope is "All Teams" and a real `ListItemButton` once a team is selected; switching back to "All Teams" while "calendar" was selected resets to `'pdf'`; footer button label/disabled state tracks selection + in-flight state; each `onShare*` callback receives the correct `teamFilter`/`team` argument; a rejected callback surfaces inline and keeps the dialog open; state resets on close.
- `LeagueDetailPage.test.tsx` extended — Fixtures section renders `NextMatchCountdown` above `LeagueFixtures` when an upcoming match exists, renders neither when it doesn't, and the Share button opens `ShareScheduleDialog`.
- `LeagueFormPage.test.tsx` extended — the Schedule tab's Share button (alongside Add Match) opens the same dialog.

## Agent assignment

Frontend-only (spec's Data Model/API Contract both "None").

1. **`frontend-builder`** — items 1–9 (all production `.ts`/`.tsx` files plus each new component's `.stories.tsx`). Brief it explicitly: read `teamSheetPdf.ts`/`teamSheetPdf.test.ts`/`TeamSheetCommunicationDialog.tsx`/`LeagueFixtures.tsx` fully first and copy their exact conventions (color constants, `checkPage` closure, disabled-row `Chip` shape, `resolveSide`/`dateHeading`/`dayKey`) rather than inventing new shapes; use the approved mockup's exact visual values (artifact `https://claude.ai/artifact/3HTwghbBhAF4C7thSCHHCm`) for the poster/countdown/dialog layout, not freelanced ones; the poster's gradient must derive from `useTheme().palette.primary.main` passed in as a parameter, never a hardcoded color.
2. **`test-writer`** (after) — the full test list above. Brief it to read `teamSheetPdf.test.ts` first and mirror its jsPDF-mocking shape exactly for the new PDF file, then adapt the same spy-and-assert-on-calls approach for the new Canvas2D mock.
3. **`standards-reviewer`** (after) — full diff against the spec and `docs/standards/frontend.md`, with specific attention to: the `triggerDownload` extraction being the right call (mechanical DOM glue, not business logic — should NOT itself be flagged as "should have been duplicated per the resolveSide precedent"), and that every generator's `teamFilter: null` path genuinely produces the same output as omitting the filter entirely (no silent scope leakage between the "Full Schedule" and "Per Team" cases).

## Flags for your review

- `resolveSide` is unexported in `LeagueFixtures.tsx` — `NextMatchCountdown` (a component, not a util) needs its own small inline team-name/logo resolution rather than importing a private helper from a sibling component; this is a small, contained duplication, consistent with the established precedent, not a design gap.
- The poster's primary-color parameter (`primaryColorHex`) is resolved by each caller via `useTheme()` — both host pages already render inside the app's theme provider, so this is a one-line addition at each call site, not a new data-fetch.
- No new item beyond what's in the approved spec — this plan is a direct, literal execution of `docs/specs/051-league-schedule-sharing.md`'s UI Requirements, with the one small addition (`triggerDownload.ts` as a shared helper) explained above.

## Verification

- `cd ui && npm run build && npm run lint && npm run test && npm run test:storybook`.
- Manual smoke test on a real league's detail screen and edit screen's Schedule tab: the countdown renders correctly (or not at all with no upcoming fixture); Share → Schedule PDF opens a correctly laid-out, date-grouped PDF in a new tab, scoped correctly for "All Teams" vs. one team; Share → Poster Image downloads a square PNG themed in the club's own primary color; Share → Add to Calendar is disabled until a specific team is chosen, then downloads a `.ics` file that imports cleanly into a real calendar app (Google Calendar's "Add" flow) with correct event times/titles/venues.
