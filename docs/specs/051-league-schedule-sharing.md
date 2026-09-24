# 051 — League Schedule Sharing

**Depends on:** `050-league-schedule-and-fixtures.md` (`Match.homeTeamLogoUrl`/`awayTeamLogoUrl`, the `LeagueFixtures` component, and the season-scoped `matches`/`teamsById` data already fetched on both `LeagueDetailPage.tsx` and `LeagueFormPage.tsx`'s Schedule tab — all reused here, nothing re-fetched), `030-team-sheet-communication.md`/`039-team-sheet-whatsapp-text.md` (`ui/src/utils/teamSheetPdf.ts`'s jsPDF conventions and `ui/src/components/TeamSheetCommunicationDialog/`'s share-dialog shape — both extended into a new domain here, not duplicated from scratch).
**Status:** draft.

## Problem & Goals

`050` gave a club admin a friendly, read-only, on-screen fixture list for a league+season (`LeagueFixtures`) but no way to get that schedule off the screen — no printable/postable document, no calendar entry, no at-a-glance sense of what's coming up next. The legacy Cricket Legend app solved this need for its own "Tournament" concept, but solved it badly: research this session found it had independently built three near-identical generators for the same underlying idea — a card-style PDF in `matchPdf.ts`, a table-style PDF in `TournamentScheduleTab.tsx`, and a pill-style shareable image in `MatchScheduleVisual.tsx` — three separate implementations of "render this list of matches as a document," never converged into one. This spec deliberately does not repeat that mistake: one team-filterable pair of generators (PDF + poster image) serves both the "every team" and "one team's fixtures only" cases, by pre-filtering the match list before generating, not by branching into a second code path per scope.

**Goals**
- A club admin can generate a printable Schedule PDF for a league+season — either the full schedule (every team) or filtered to one team — from the same screens that already show that season's fixtures (`LeagueDetailPage.tsx`'s Fixtures section, `LeagueFormPage.tsx`'s Schedule tab).
- A club admin can generate a shareable, square Poster Image (PNG) of the same schedule, same full/per-team scope choice, for posting to a team chat or social media — visually distinct from the PDF (a designed graphic, not a printable document), but built from the same underlying data and the same scope filter.
- A club admin can download a `.ics` calendar file for one team's fixtures within a league+season, to share with that team so its members can add their matches to their own calendar app in one action.
- A club admin glancing at a league's Fixtures section can see, at a glance and without scrolling the fixture list, which match is coming up next and when — a static "next match" countdown, not a second thing to maintain or refresh.
- All three generators (PDF, poster, calendar) are reachable from one "Share Schedule" dialog, not three separate buttons — a single, consistent entry point per screen.

## Non-goals

- **No cross-club/shared league sharing.** This stays entirely within `050`'s club-owned `League` model — a "shared" schedule here means "one club shares its own schedule with its own team," not a schedule spanning multiple clubs' ownership. No change to `001` ADR-02 or `029`'s/`050`'s own Non-goals.
- **No live-ticking countdown, and no shareable countdown image.** The "next match" widget is computed once at render from already-fetched match data and left alone — no `setInterval`, no re-render-per-second, no PDF/poster/image export of the countdown itself. If the underlying `matches` list is refetched (e.g. the admin changes the season selector), the countdown recomputes then, and only then.
- **No whole-league (all-teams) calendar file, and no per-fixture "Add to Calendar" buttons.** The `.ics` export is a single, per-team file covering that team's fixtures for the selected league+season — nothing broader, nothing more granular. Confirmed directly with the user: the real want was "download a calendar file for the league for a team to share with the team," not a per-match action or an all-teams file a team would have to filter themselves.
- **No results or scores anywhere in this spec's output.** The PDF, the poster, and the calendar file all carry exactly what `LeagueFixtures` already shows — date, venue, teams — and nothing else. `050`'s own "no results/scores" Non-goal carries forward unchanged; this is still a fixture list, not a results feature, in every format it's rendered into.
- **No consolidation of `leagueSchedulePdf.ts` with `teamSheetPdf.ts`.** The two happen to share the same library (`jspdf`) and the same drawing conventions (colour constants, `checkPage`/pagination, base64 logo embedding), but render genuinely different data shapes for genuinely different purposes (a squad roster vs. a fixture list) — `leagueSchedulePdf.ts` is a new, separate file, not a generic "PDF poster" abstraction extracted from both. Flagged in Rollout Notes as a reasonable future refactor if a third, similarly-shaped PDF-export feature appears — not attempted now for two data shapes that aren't identical, per `docs/standards/frontend.md`'s "two components sharing more than ~70%" threshold not obviously being met here.
- **No player-facing screen, route, or player auth.** Same posture as `050` — every new component and entry point in this spec lives under `/manage` only. The "next match" countdown and the share options are club-admin tools for getting a schedule to a team, not a player's own view of it.
- **No in-app preview for the poster image or the calendar file.** The Schedule PDF keeps `030`'s existing `window.open(url, '_blank')` convention (a PDF has a meaningful browser-native viewer to open into). The poster PNG and the `.ics` file do not — opening a raw image blob URL in a new tab just displays it without saving it, and a `.ics` file has no browser-native renderer at all — so both are delivered as a forced download instead (see UI Requirements and Rollout Notes for why this is a deliberate, justified first for this codebase, not an inconsistency).

## User Stories

- As a club admin viewing a League's Fixtures section, I can see a static "next match" countdown — days (or "Today"/"Tomorrow") until the earliest upcoming fixture, plus who's playing and where — without scrolling into the fixture list itself.
- As a club admin viewing a League's Fixtures section or Schedule tab, I can open a "Share Schedule" dialog and choose to generate a Schedule PDF for either every affiliated team or just one, opening it in a new browser tab ready to print or save.
- As a club admin in that same dialog, I can generate a square Poster Image (PNG) of the schedule, same full/per-team scope choice, downloaded ready to post to a team chat or social page.
- As a club admin in that same dialog, I can download a `.ics` calendar file for one specific team's fixtures in this league+season, to share with that team so its members can import their matches into their own calendar app.
- As a club admin, when I choose "All Teams" as the share scope, the calendar option is unavailable (it only ever makes sense for one team's fixtures) — the dialog makes this obvious rather than letting me pick it and fail.
- As a club admin, I can reach the Share Schedule dialog from both the League's own view screen (`LeagueDetailPage.tsx`) and its edit screen's Schedule tab (`LeagueFormPage.tsx`) — the same dialog, the same three options, wherever I already am looking at that league's fixtures.

## Data Model Changes

None. Every generator in this spec consumes `Match`/`League`/`Season`/`Team` data the host pages have already fetched for `050`'s Fixtures section/Schedule tab (`matches`, `teamsById`, the selected `League`/`Season`) — nothing new is persisted, and nothing new is fetched. This is entirely client-side generation from an existing, already-in-memory data shape.

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| — | — | None. No new endpoint. The PDF, poster, and calendar generators all run entirely client-side against data the host pages already hold; there is nothing for the backend to serve that it doesn't already serve via `050`'s existing `GET .../matches` (filtered by `leagueId`/`seasonId`). |

## UI Requirements

This spec is the first place three genuinely new client-side patterns enter this codebase — called out explicitly here, the same way `050` called out being the first PDF/document *upload* path:

- **No `.ics`/calendar generation exists anywhere in this codebase today** (confirmed by exhaustive grep — no library dependency, no prior code). `leagueScheduleIcs.ts` (below) is hand-rolled, deliberately not a new dependency — matching both the legacy app's own precedent of hand-building this rather than adding an ICS library, and this codebase's own `teamSheetWhatsAppText.ts` precedent of hand-building formatted output rather than pulling one in for a well-understood, bounded text format.
- **No Canvas2D/PNG image generation exists anywhere in this codebase today** (confirmed — `jspdf` is the only export library in `ui/package.json`; no `html2canvas`, despite it being available in the legacy app). `leagueSchedulePoster.ts` (below) is genuinely new drawing code, with no existing component to extend.
- **No forced (`<a download>`) download exists anywhere in this codebase today** (confirmed via grep — zero occurrences in any `.tsx`/`.ts` file). Every generated or uploaded document today is opened via `window.open(url, '_blank')` instead (`030`'s team sheet PDF, `050`'s Playing Conditions viewer, the generic `DocumentUpload` "View" action). This spec introduces the first two forced downloads in this codebase — the Poster Image and the calendar file — for the reason given in Non-goals (neither has anything meaningful to preview in a browser tab). The Schedule PDF is deliberately kept on the existing `window.open` convention, since a PDF *does* have a meaningful browser-native viewer.

**1. New `ui/src/utils/leagueSchedulePdf.ts`** — mirrors `teamSheetPdf.ts`'s structure and conventions exactly (same `DARK`/`MID`/`WHITE`/`GRAY`/`LGRAY` colour constants, same `loadImageBase64` fetch→blob→`FileReader` pattern for embedding a team's `logoUrl`, same `checkPage`/`addPage` hand-rolled pagination, same header/footer band treatment, same "return a blob URL, the caller opens it" delivery contract):

```ts
export async function generateLeagueSchedulePdf(
  matches: Match[],
  teamsById: Map<string, Team>,
  leagueName: string,
  seasonLabel: string,
  teamFilter: { teamId: string; teamName: string } | null,
): Promise<string> // blob URL — caller does window.open(url, '_blank')
```

When `teamFilter` is set, the match list is pre-filtered to `matches.filter(m => m.homeTeamId === teamFilter.teamId || m.awayTeamId === teamFilter.teamId)` before rendering, and the header subtitle reads e.g. `"${teamFilter.teamName} — ${seasonLabel}"` instead of just `seasonLabel` — this is the one code path that serves both "Full Schedule" and "Per Team," per this spec's own stated goal of not repeating the legacy app's three-generator mistake. Layout: dark header band (league name, season, and — when scoped — the team-scope subtitle, exactly mirroring `teamSheetPdf.ts`'s own header band shape), date-grouped match rows (home logo/name — a small "VS" divider + time + venue — away logo/name, reusing the same avatar-or-initials fallback `LeagueFixtures`' own `resolveSide` already establishes, duplicated locally here per the note below rather than imported), footer with league name + page number on every page. Resolving a side's display name/logo from `(teamId, teamName, logoUrl, teamsById)` duplicates a small local helper shaped exactly like `LeagueFixtures`' own unexported `resolveSide` — deliberately not imported from that component, matching `teamSheetPdf.ts`/`teamSheetWhatsAppText.ts`'s own established precedent of small pure resolution helpers being independently duplicated per consumer rather than centralized, so each file stays a self-contained, independently readable unit (`teamSheetWhatsAppText.ts`'s own doc comment states this reasoning explicitly for `playerName`/`resolveRoster`; the same reasoning applies here for all four new files that need it).

**2. New `ui/src/utils/leagueSchedulePoster.ts`** — genuinely new Canvas2D drawing code, no existing component to extend:

```ts
export async function generateLeagueSchedulePoster(
  matches: Match[],
  teamsById: Map<string, Team>,
  leagueName: string,
  seasonLabel: string,
  teamFilter: { teamId: string; teamName: string } | null,
): Promise<string> // blob URL via canvas.toBlob('image/png') → URL.createObjectURL — caller
                    // triggers a forced download (see below), not window.open
```

Same `teamFilter` parameter shape as the PDF generator, for consistency and so both are driven by the same dialog state. A square (1:1) canvas — approved mockup: a dark-green gradient background (derived at draw time from `theme.palette.primary.main`, **not** a hardcoded independent palette the way the legacy app's own `MatchScheduleVisual.tsx` was — so a club's own branded primary colour re-tints the poster via the same `withClubBranding()` mechanism every other themed surface already uses, not a fixed colour baked into this file) with a subtle dot-grid texture, a header (league name, season, team-scope subtitle when filtered), a short list of upcoming match rows (team initials/logo avatars — same resolution helper as item 1 above, duplicated locally again — date/time), and a "Generated by Cricket Legend" footer mark. Delivery: the caller wraps the returned blob URL in a temporary `<a download="...">` element, clicks it programmatically, and revokes the object URL afterward — this codebase's first use of that pattern for an image (see the callout above and Rollout Notes).

**3. New `ui/src/utils/leagueScheduleIcs.ts`** — hand-built `VCALENDAR`/`VEVENT` text, no library:

```ts
export function generateLeagueScheduleIcs(
  matches: Match[],
  teamsById: Map<string, Team>,
  leagueName: string,
  seasonLabel: string,
  team: { teamId: string; teamName: string }, // required, not optional — per-team only, see Non-goals
): string // blob URL via new Blob([icsText], { type: 'text/calendar;charset=utf-8' }) →
          // URL.createObjectURL — caller triggers the same forced-download pattern as item 2
```

One `VEVENT` per match in `matches.filter(m => m.homeTeamId === team.teamId || m.awayTeamId === team.teamId)`. Each event: `SUMMARY` is `"${home} vs ${away}"` (resolved the same way as items 1–2), `LOCATION` is `match.venue` (omitted when null), `DESCRIPTION` is `"${leagueName} — ${seasonLabel}"`, `DTSTART` is `match.matchDate` converted to UTC (`toISOString()`, formatted `YYYYMMDDTHHMMSSZ`) — deliberately not attempting `VTIMEZONE` handling, since a UTC-stamped event already renders correctly in the recipient's own local time in every mainstream calendar app. **Event duration: a fixed 3 hours** (`DTEND = DTSTART + 3h`) — this spec's own decision, stated explicitly per the requirement to decide and record a convention rather than leave it open: a generic club cricket fixture (a T20/limited-overs match plus a realistic pre/post-match window) runs closer to 3 hours than the shorter 2-hour default originally floated during scoping, and `Match` carries no format/duration field today to derive a more precise figure from — a fixed default is a deliberate simplification, not an attempt at precision. `UID` is `"${match.id}@cricketlegend"` (stable, so re-downloading the same schedule and re-importing doesn't create duplicate calendar entries in a calendar app that respects `UID`), `DTSTAMP` is generation time. All text fields (`SUMMARY`/`LOCATION`/`DESCRIPTION`) pass through proper RFC 5545 escaping (commas, semicolons, backslashes, and newlines) before being written — a real, testable requirement given free-text opponent names and venues can contain any of those characters. Delivery: the caller wraps the returned blob URL in the same temporary `<a download="${team.teamName}-schedule.ics">` pattern as item 2 — this codebase's first forced download of any kind (see the callout above), a deliberate, justified exception to the "open in new tab" convention every other generated/uploaded document in this codebase uses, because a calendar file has nothing to preview in a browser tab.

**4. New `ui/src/utils/nextMatchCountdown.ts`** — a pure function, injectable `now` for testability:

```ts
export interface NextMatchCountdown {
  match: Match
  label: 'today' | 'tomorrow' | 'days'
  value?: number // whole days until the match — present only when label === 'days'
}

export function resolveNextMatchCountdown(matches: Match[], now: Date): NextMatchCountdown | null
```

Finds the earliest match with a strictly future `matchDate` (`new Date(m.matchDate) > now`); returns `null` when none exists. The day-count is computed by comparing the two dates' own local calendar day (midnight-to-midnight), not raw elapsed hours — a match at 23:50 today is still "Today," and one at 00:10 tomorrow is still "Tomorrow," matching how a person actually reads a countdown rather than a raw hour count. `value` (the whole-day count) is only populated for `label === 'days'` — the "today"/"tomorrow" cases are rendered as plain-language chips by the component (item 5), never as `"0 days"`/`"1 day"`, per the locked scope.

**5. New `ui/src/components/NextMatchCountdown/` component** (four-file anatomy — `.tsx`/`.test.tsx`/`.stories.tsx`/`index.ts`). Deliberately presentational — takes the already-resolved `NextMatchCountdown` (or `null`) plus a `teamsById: Map<string, Team>` for side-name/logo resolution, renders nothing when `countdown` is `null` (the host conditionally renders it, `LeagueFixtures`' own `EmptyState` already covers the "nothing scheduled at all" case, so this component doesn't need its own empty state):

```ts
export interface NextMatchCountdownProps {
  countdown: NextMatchCountdown | null
  teamsById: Map<string, Team>
}
```

Per the approved mockup: a horizontal card — a large day-count number + "DAYS" label on the left (or a single "Today" chip in that same slot when `label === 'today'`, "Tomorrow" when `label === 'tomorrow'`), a divider, then "Next match" label + the two resolved team names + date/time/venue on the right. Placed at the top of `LeagueDetailPage.tsx`'s Fixtures section, above `LeagueFixtures` itself (item 7) — computed by the host via `useMemo(() => resolveNextMatchCountdown(matches, new Date()), [matches])`, recomputed only when the underlying match list changes (e.g. a season switch triggers a refetch), never on a timer — consistent with the "static, computed once at render" requirement. Not rendered on `LeagueFormPage.tsx`'s Schedule tab — the approved mockup places this only on the read-only view screen, where a club admin is more likely to be glancing at "what's next" rather than actively editing the schedule.

**6. New `ui/src/components/ShareScheduleDialog/` component** (four-file anatomy), mirroring `TeamSheetCommunicationDialog`'s exact structure — a `Dialog` with a `List` of selectable `ListItemButton` option rows (not tabs), a `ToggleButtonGroup` scope selector beneath, presentational-only (no React Query — the host owns data and callbacks, matching `LinkExistingRecordDialog`/`TeamSheetCommunicationDialog`'s convention), reset-on-close via a `useEffect` on `open`, inline error state with retry, and a footer action button whose label swaps per selected option:

```ts
export type ShareScheduleOption = 'pdf' | 'poster' | 'calendar'

export interface ShareScheduleTeamOption {
  teamId: string
  teamName: string
}

export interface ShareScheduleDialogProps {
  open: boolean
  onClose: () => void
  leagueName: string
  seasonLabel: string
  // Affiliated teams for the currently-selected season — host-supplied, see item 9.
  teams: ShareScheduleTeamOption[]
  // Caller-owned generation + delivery (calls the relevant util above, then either
  // window.open or the forced-download pattern) — rethrows on failure so this dialog can
  // surface an inline error and let the admin retry, mirroring TeamSheetCommunicationDialog's
  // onPrint contract exactly. `teamFilter` is null for the "All Teams" scope.
  onSharePdf: (teamFilter: ShareScheduleTeamOption | null) => Promise<void>
  onSharePoster: (teamFilter: ShareScheduleTeamOption | null) => Promise<void>
  onShareCalendar: (team: ShareScheduleTeamOption) => Promise<void>
}
```

Three option rows — "Schedule PDF" (opens in a new tab), "Poster Image" (downloads as PNG), "Add to Calendar" (downloads as `.ics`, team-scoped only) — each with the same icon + primary/secondary text shape `TeamSheetCommunicationDialog`'s own rows already use. The team scope `ToggleButtonGroup` lists "All Teams (Full Schedule)" plus one row per entry in `teams`, defaulting to "All Teams." When "All Teams" is selected, the "Add to Calendar" option row is rendered **disabled** (not hidden — keeping all three rows visible and in a stable position, matching this same dialog's own "Facebook — Coming soon" disabled-row precedent), with a secondary line explaining why ("Select a single team to enable"), rather than letting an admin pick it and hit a runtime error. Selecting "Add to Calendar" while "All Teams" is active auto-clears the selected option back to `null`/`'pdf'` rather than leaving an invalid combination selected. The dialog shows `leagueName`/`seasonLabel` as a small caption under its title, so the admin can confirm scope before generating. Footer button label: "Open PDF" / "Download Poster" / "Download Calendar" depending on the selected option; disabled while its own `on*` promise is in flight or while the calendar option is invalid for the current scope.

**7. `LeagueDetailPage.tsx` integration.** `NextMatchCountdown` (item 5) renders at the top of the Fixtures section's `content`, above `LeagueFixtures`. A "Share" action opens `ShareScheduleDialog` — **placement decision, made here rather than left to the plan**: `RecordDetailScreen.secondaryActions` (confirmed by direct inspection of `RecordDetailScreen.tsx`) is link-shaped only (`{ label, to, icon }`, rendered as a `RouterLink`-backed `MuiButton` with no `onClick`/pending-state support at all) — it exists specifically for plain navigations, not for opening a dialog. Widening that shared prop's shape to support an `onClick` variant would be a page-header-level change affecting every other `secondaryActions` call site's current link-only assumption, for a feature that's genuinely scoped to one section, not the whole page. Instead, the Share button is rendered via the Fixtures section's own `note` slot (`RecordDetailScreenSection.note` — "a small supplementary control/caption rendered directly under the heading," already used elsewhere for a section-scoped control) as a plain MUI `Button` with an `onClick` that opens the dialog — no change to `RecordDetailScreen`'s own contract at all. `LeagueDetailPage.tsx` owns the three `on*` callbacks passed into the dialog: each resolves the affiliated-teams-for-season list already computed for the Teams section (item 9), calls the matching util from items 1–4, and either `window.open`s the result (PDF) or performs the forced-download click (poster/calendar).

**8. `LeagueFormPage.tsx` Schedule tab integration.** A "Share" `Button` (same `secondary`/ghost treatment as the tab's existing "Add Match" button) rendered alongside it in the same row, above `LeagueFixtures` — opening the same `ShareScheduleDialog`, wired to the same three utils, with `LeagueFormPage.tsx` owning the callbacks exactly as `LeagueDetailPage.tsx` does in item 7. No `NextMatchCountdown` on this tab (see item 5).

**9. Team scope list.** Both host pages already compute `affiliationsForSeason`/`teamsById` for `050`'s Teams/Affiliations tab and section — `ShareScheduleDialog`'s `teams` prop is built from that existing data (`affiliationsForSeason.map(a => ({ teamId: a.teamId, teamName: teamsById.get(a.teamId)?.name ?? 'Unknown team' }))`), not a new fetch. No new API call anywhere in this spec.

**Mobile-first**, per `docs/standards/frontend.md`: `NextMatchCountdown`'s horizontal card stacks to a single column at 375px (day-count block above the divider above the next-match details, not side-by-side); `ShareScheduleDialog`'s option list, scope `ToggleButtonGroup`, and footer button already inherit `TeamSheetCommunicationDialog`'s own confirmed-mobile-friendly `fullWidth`/vertical-orientation layout, reused as-is.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `nextMatchCountdown.test.ts` — earliest future match selected from an unsorted/mixed past-and-future list, `null` returned when no future match exists, day-boundary correctness for "today" (a match later the same calendar day) vs. "tomorrow" vs. a multi-day count, a past-dated match on today's calendar date is correctly excluded (strictly-future filter, not same-day-inclusive). `leagueScheduleIcs.test.ts` — correct `VEVENT` field values (`SUMMARY`/`LOCATION`/`DESCRIPTION`/`UID`/`DTSTART`/`DTEND` at the fixed 3-hour duration), RFC 5545 escaping of commas/semicolons/backslashes/newlines in a free-text opponent name and venue, filters to only the given team's matches, empty-team-fixture-list produces a valid (zero-`VEVENT`) calendar rather than throwing. `leagueSchedulePdf.test.ts`/`leagueSchedulePoster.test.ts` — `jspdf` mocked exactly as `teamSheetPdf.test.ts` already establishes (asserting on inputs to `text`/`rect`/`addImage` rather than parsing PDF bytes, per `docs/standards/testing.md`'s guidance for a third-party drawing library with no existing mocking precedent); `HTMLCanvasElement.getContext('2d')` mocked analogously for the poster generator (asserting on inputs to `fillRect`/`fillText`/`drawImage`) — this codebase's first Canvas2D mock, flagged as a new but directly analogous pattern to the jsPDF one. Both generators tested for: `teamFilter: null` includes every match, a set `teamFilter` includes only that team's matches (as home or away), and a missing team logo falls back to the initials/icon treatment without throwing. |
| Integration | None — no backend/repository change in this spec. |
| Contract | None — no new/changed endpoint or DTO. |
| Component | `NextMatchCountdown.test.tsx` + Storybook story — renders nothing given `countdown: null`; renders the "Today"/"Tomorrow" chip vs. the numeric day-count + "DAYS" label correctly per `label`; resolves and displays both sides' names via `teamsById`. `ShareScheduleDialog.test.tsx` + Storybook story — all three option rows render; the calendar option is disabled when scope is "All Teams" and enabled once a specific team is selected; selecting "Add to Calendar" while scoped to "All Teams" doesn't leave an invalid selection; the footer button's label and disabled state track the selected option and in-flight state; `onSharePdf`/`onSharePoster`/`onShareCalendar` are each called with the correct `teamFilter`/`team` argument for the selected scope; an error thrown by the relevant `on*` callback surfaces inline and leaves the dialog open for retry; state resets on close. `LeagueDetailPage.test.tsx` extended — the Fixtures section renders `NextMatchCountdown` above `LeagueFixtures` when an upcoming match exists, renders neither when none does, and the Share button opens `ShareScheduleDialog`. `LeagueFormPage.test.tsx` extended — the Schedule tab's Share button, alongside the existing Add Match button, opens the same dialog. |
| End-to-end | None new — matching every prior `/manage` spec building on an already-covered golden path rather than introducing a new one; not wired into CI regardless, per this codebase's stated precedent. |

## Acceptance Criteria

- A club admin viewing a league's Fixtures section (view screen) or Schedule tab (edit screen) can open a Share Schedule dialog offering Schedule PDF, Poster Image, and Add to Calendar.
- Choosing "Schedule PDF" with "All Teams" selected opens a PDF listing every match for the league+season in a new browser tab; choosing a specific team instead produces a PDF scoped to only that team's matches, from the same generator, not a second one.
- Choosing "Poster Image" downloads a square PNG poster of the same, scope-filtered schedule, themed with the club's own branded primary colour rather than a fixed palette.
- Choosing "Add to Calendar" is only available once a specific team (not "All Teams") is selected, and downloads a `.ics` file containing one event per that team's fixtures in the selected league+season, each a correctly-escaped, 3-hour-duration event.
- A club admin viewing a league's Fixtures section sees a static "next match" countdown above the fixture list whenever an upcoming fixture exists, showing "Today"/"Tomorrow" in plain language rather than "0 days"/"1 day" when applicable, and showing nothing when no upcoming fixture exists — and it never changes without a page action (season switch, refetch), confirmed by its component test using mocked props rather than a live clock.
- No new backend endpoint, DTO field, or persisted table exists as a result of this spec — every acceptance criterion above is satisfied by data `050` already fetches.
- `LeagueFixtures` itself, `MatchList.tsx`'s own card rendering, and every other screen untouched by this spec's UI Requirements are unchanged.

## Rollout Notes

- **The design mockup for this spec was already produced and approved by the user during this spec's own scoping (artifact `https://claude.ai/artifact/3HTwghbBhAF4C7thSCHHCm`), not deferred to a separate Claude Design pass before planning starts.** Unlike `050` (which flagged `LeagueFixtures`/`DocumentUpload` for a design pass as an explicit next step before any UI code), the plan for this spec should build directly against this spec's own UI Requirements section — the mockup description embedded there is the source of truth, no further design-pass gate is needed first.
- **This spec introduces three genuinely new client-side patterns in one PR**: hand-rolled ICS/calendar generation (no library, no prior code), Canvas2D/PNG image generation (`jspdf` was this codebase's only prior export mechanism), and forced (`<a download>`) file delivery (every prior generated/uploaded document opens via `window.open` instead). All three are called out explicitly in UI Requirements — treat them the same way `050`'s Rollout Notes treated its own "first PDF/document upload path" callout: real, load-bearing firsts for this codebase, not incidental implementation detail.
- **A future third PDF-export feature is the trigger to revisit the "no shared abstraction between `teamSheetPdf.ts` and `leagueSchedulePdf.ts`" decision**, not this spec. Per `docs/standards/frontend.md`'s "~70% shared markup/logic" extraction threshold — two data shapes (a squad roster vs. a fixture list) don't meet it today; a human should note this against `docs/roadmap.md` if a third PDF-export need appears later, so the decision doesn't get quietly re-litigated per-feature.
- **The Canvas2D mocking pattern introduced by `leagueSchedulePoster.test.ts`** (mocking `HTMLCanvasElement.getContext('2d')` and asserting on draw-call inputs, directly analogous to `teamSheetPdf.test.ts`'s existing jsPDF-mocking pattern) is this codebase's first, and should be treated as the reusable precedent for any future canvas-based generator, the same way `teamSheetPdf.test.ts` already is for jsPDF.
- Ships as one PR — four new util files (`leagueSchedulePdf.ts`, `leagueSchedulePoster.ts`, `leagueScheduleIcs.ts`, `nextMatchCountdown.ts`) plus their unit tests, two new components (`NextMatchCountdown`, `ShareScheduleDialog`, each with the full four-file anatomy), and the two host-page integrations (`LeagueDetailPage.tsx`'s Fixtures section, `LeagueFormPage.tsx`'s Schedule tab) — no backend change, no migration, no staggering across multiple PRs.
