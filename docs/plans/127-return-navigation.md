# Plan 127 (Phase 1): Return navigation for the Leagues pages

Implements Phase 1 of `docs/specs/127-return-navigation.md` (approved 2026-10-31). UI only: no backend, no migration. Branch `feat/097-098-import-framework-and-schedule-import` (uncommitted work continues). Other pages follow in their page reviews.

## Context
A page reached from somewhere other than its default parent has no idea where the user came from. Example: league Schedule, Manage League, Add Match opens the Match form headed "Back to Matches", and Save goes to the Matches list, not back to the schedule with the new match visible. Today there are four unrelated mechanisms; this plan adds one (`returnTo` in the address) and moves the Leagues flows onto it, keeping the old ones as fallbacks.

## What exists (from the code read)
- `utils/backTarget.ts`: `backTarget(state, fallback)` already guards router-state `{backTo, backLabel}` (must start with `/manage/`, not `//`, no backslash; blank label becomes "previous page"). Used by `ResultDetailPage` and `TeamStatsPage`. **Reuse its guard rules in `safeReturnTo`; leave `backTarget` as the legacy fallback.**
- Back rendering: `ManageScreenHeader` (optional `backTo`, `backLabel`), `RecordFormScreen` and `RecordDetailScreen` (required `backTo`, `backLabel`), and hand-rolled Backs in `MatchDetailPage` (fixed `/manage/fixtures/matches`), `TeamDetailPage` (`?from=section` logic), `LeagueViewLayout` ("Back to Leagues"), `TeamFormPage`.
- `MatchFormPage`: Back and Cancel are fixed to the Matches list (edit Cancel goes to the match); Save (create and update) and Delete navigate to `/manage/fixtures/matches` (Delete with `{notice}` state). Create reads `leagueId` and `seasonId` prefill params. Deactivate and reactivate do not navigate.
- `LeagueFormPage` (edit): Back fixed to Leagues; Cancel goes to `/leagues/:id/schedule` (no season); Save navigates to the Leagues list; deactivate and reactivate do not navigate.
- Import wizard: `leagueScheduleImportPath(..., 'view')` writes `?from=view`; `LeagueScheduleImportPage` reads it; `useLeagueScheduleWizardProps` sets `backTo: leagueScheduleBackPath(...)`; `ImportScheduleControls` also builds the path.
- The Schedule tab's upcoming-only switch is local state (`showPlayed`, `useState(false)` in `LeagueScheduleView`) with no URL parameter, so a saved past match would stay hidden.
- React Router 7.18; no generic query hook, no `useReturnTo` yet; tests use `MemoryRouter` with `LocationProbe` and `LeagueViewTestHarness` helpers.

## Corrections to the spec's Phase 1 lists (found in the code; none change the rule)
1. **"Edit League Team", Conditions PDF and Add Team need no `returnTo`:** Edit League Team opens a dialog, the PDF uses `window.open`, and Add Team stays inside the league page (`?add=team`). Skip them.
2. **Deactivate and reactivate do not navigate** today, so they need no after-save handling; **Delete** (on Match form and Match detail) navigates with a `{notice}` and should return to the origin with the same notice.
3. **`LeagueFixturesTable` is shared with the league edit page's Schedule tab,** so the origin it records is simply the current location of whichever page renders it.
4. **Open Team has no `from=section` today for tiles from the league Teams tab;** the TeamDetailPage default Back stays as it is when there is no `returnTo`.

## Slices (one frontend-builder, sequential; `nvm use 22.12.0`; run vitest folders alone)
1. **Util and hooks.** `ui/src/utils/returnTo.ts`: `safeReturnTo(value)` (decoded in-app path starting with `/manage/` or `/admin/`; no scheme/host, no leading `//`, no backslash, no control characters, at most 512 characters, double-encoded variants rejected), `safeReturnLabel(value)` (plain text, at most 60 characters, no control characters), `withReturnTo(destination, {to, label})` (adds `returnTo` and `returnLabel` with stable ordering, preserves existing params), `currentOrigin(location)`, `afterSaveTarget(origin, options)`. `ui/src/hooks/useReturnTo.ts`: `useReturnTo()` (validated `{to, label}` or null, falling back to legacy router state through `backTarget` and legacy `?from=`), `useBackLink(defaultTo, defaultLabel)` (label "Back to {label}"), `useAfterSave(defaultTo)` (returns a navigate function; accepts router `state` such as the delete notice). Unit tests for every accept and reject case in the spec's list.
2. **Headers wire automatically.** `ManageScreenHeader`, `RecordFormScreen` and `RecordDetailScreen` resolve their Back through `useBackLink(backTo, backLabel)` (a valid `returnTo` overrides, otherwise unchanged, so every page that uses them is covered); hand-rolled Backs in `MatchDetailPage`, `TeamDetailPage` and `LeagueViewLayout` use the hook directly. Keep the Back look and the 44 px touch target.
3. **Destinations honour it.**
   - `MatchFormPage`: Back, Cancel, Save, and Delete (with its notice) use `useBackLink` and `useAfterSave`. When the origin is a league Schedule path and the saved match date is in the past, add `showAll=1` to the target.
   - `MatchDetailPage`: Back and Delete.
   - `LeagueFormPage`: Back, Cancel (default becomes the league page with the season) and Save.
   - `TeamDetailPage`: Back.
   - Import wizard: `LeagueScheduleImportPage` and `useLeagueScheduleWizardProps` read `useReturnTo()` first, then legacy `from`; `ImportScheduleControls` passes `returnTo`.
   - `LeagueScheduleView`: initialise `showPlayed` from `?showAll=1`.
4. **Links that leave the Leagues pages carry the origin** (`withReturnTo(destination, currentOrigin(location), label)`):
   - **League page** (`LeagueViewLayout`): Edit League Details, the edit pencil, Edit Conditions, Add Match, Import Schedule (label such as "{league} schedule", "{league} teams", "{league} conditions" by active tab).
   - **Schedule tab:** the Add Match button, row link and row menu Open Match and Edit Match (`LeagueScheduleView`, `LeagueFixturesTable`), Conditions "Edit Conditions" (`LeagueConditionsView`), Teams tiles Open Team (`LeagueTeamsView`).
   - **Leagues list** (`LeagueRowMenu`, `LeagueTable`, `LeagueCard`): all Open and Edit items, Add Match, Import Schedule; label "Leagues". `LeagueEditScheduleTab` Open Schedule.
   - Add League (button and `AddCard`) goes to `/leagues/new` with `returnTo` the list.
5. **Chevron removal (owner request 2026-10-31).** Remove the visible open-chevron from table rows on the Leagues list and the league Schedule table (keep the whole-row link and its accessible name; the cue is the hover tint and pointer). Tests updated.
6. **Docs.** `docs/standards/page-anatomy.md`: new "Navigation" section (origin travels in `returnTo`; Back, Cancel and Save return there; Decided 2026-10-31), table rows carry no chevron (decided), checklist line "links that leave this page carry `returnTo`; pages reached from elsewhere honour it", review log notes. `frontend.md`: one paragraph naming the util, hooks and the legacy fallbacks. `docs/roadmap.md`: the sweep of other pages, breadcrumbs, filters in the address.

## Tests (updated or added in the same change; many existing hrefs gain query parameters)
New: `returnTo` util and hook tests (rejects `https://evil`, `//evil`, `/\evil`, `javascript:`, `/other`, over-long, control characters, double-encoded; legacy state and `from` fallback), `useAfterSave`, `ManageScreenHeader` and `RecordFormScreen` Back label and target with and without `returnTo`, Match form Back, Cancel, Save and Delete with the origin and the `showAll=1` rule, League edit Save and Cancel, Schedule `showAll`, the league and list links building the right destination for the current tab and season. Update the tests the code read listed: `LeagueViewLayout`, `LeagueScheduleView`, `LeagueFixturesTable`, `LeagueTeamsView`, `LeagueConditionsView`, `LeagueCard`, `LeagueTable` (and its actions test), `LeagueList`, `MatchFormPage`, `MatchDetailPage`, `LeagueFormPage`, `TeamDetailPage`, `LeagueScheduleImportPage`, `leagueScheduleImport`. Prefer `expect.stringContaining` on hrefs so tests do not depend on parameter order. Playwright golden path (Manage League, Add Match, Save, lands on the schedule with the match; reload keeps the label) is written but skipped in CI.

## Risks
Many link tests change at once; a missed link silently falls back to the old default (fine, no break); label length and encoding of nested queries (tested); the shared `LeagueFixturesTable` origin on the edit page; `RecordFormScreen` and `RecordDetailScreen` serve other pages, so the override must be a no-op without `returnTo` (covered by tests).

## Verification
`npx tsc -b`, `npx oxlint` on touched files, vitest folders alone (`src/utils`, `src/hooks`, `src/components/ManageScreenHeader`, `RecordFormScreen`, `RecordDetailScreen`, `src/pages/manage/league`, `leagues`, `leagueEdit`, `leagueImport`, `leagueTeams`, `MatchFormPage`, `MatchDetailPage`, `LeagueFormPage`, `TeamDetailPage`). In the browser: Manage League, Add Match shows "Back to {league} schedule", Back and Save land on the schedule with the new match (past matches visible), reload keeps the label, a hand-typed external `returnTo` is ignored, rows have no chevron.
