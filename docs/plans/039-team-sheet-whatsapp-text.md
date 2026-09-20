# Plan: 039 — Team Sheet WhatsApp Text

## Context

`030-team-sheet-communication.md` shipped "Print as PDF" as the only wired option in `TeamSheetCommunicationDialog`, with "WhatsApp" and "Facebook" left as disabled "Coming soon" rows — explicitly deferred, not forgotten. `039-team-sheet-whatsapp-text.md` (approved spec) resolves the WhatsApp deferral: the legacy Cricket Legend app's `buildWhatsAppText` (emoji role indicators — 🏏 bat, 🔴 bowl, 🏏🔴 all-rounder, 🧤 keeper — plus captain/twelfth-man callouts and a legend line) gets ported and wired to real scope selection, using data this codebase already persists (`MatchSidePlayer.role`, unlike legacy which had to *infer* role from a player's standing profile). This is a frontend-only addition: one new text-building util, and `TeamSheetCommunicationDialog` gaining a second real, selectable option alongside "Print as PDF." No backend change, no new dependency, no data model change.

The existing dialog currently assumes exactly one enabled option ("Print as PDF" is a plain, non-interactive `ListItem` — the code comment there explicitly says a `ListItemButton` was skipped "with only one option ever enabled, there's nothing to toggle"). That assumption breaks once WhatsApp becomes real, so the option rows themselves change shape, not just gain a sibling.

## Files to touch, in order

### 1. `ui/src/utils/teamSheetWhatsAppText.ts` (new)

Plain TypeScript, no Storybook story (matches `teamSheetPdf.ts`'s own precedent as a non-`components/**` util). Exports:

- `getRoleEmoji(role: PlayingRole, isWicketKeeper: boolean): string` — the 6-entry table from the spec (BATSMAN/BOWLER/ALL_ROUNDER × WK/not-WK). Direct port of legacy's `getRoleText`, minus `getEffectiveRole`'s inference step — this repo's `MatchSidePlayer.role` (`ui/src/api/matchSideApi.ts`'s `PlayingRole` type) is already the source of truth, read as-is.
- `generateTeamSheetWhatsAppText(match: Match, sides: TeamSheetSide[], subtitle: string): string` — synchronous (no `fetch`/`FileReader`, unlike the PDF util — text has no logo to load). Reuses the exact `TeamSheetSide` type already exported from `teamSheetPdf.ts` (`import type { TeamSheetSide } from './teamSheetPdf'`) so both utils agree on shape without a second competing type. Internally: sort each side's `players` by `battingOrder` (same sort `teamSheetPdf.ts`'s `resolveRoster` already does — duplicated locally here rather than imported, matching `teamSheetPdf.ts`'s own precedent of not extracting a shared roster helper for a ~10-line block), join against `side.squad` by `playerProfileId` for name + `squadJerseyNumber`, and build:
  - Header: `🏏 *<teamName> vs <teamName>*` (joined in `sides` order).
  - Logistics line: the `subtitle` string passed in, verbatim (already-assembled date/venue/league-season from `matchFields()` — not re-derived).
  - Per side, blank-line separated: `*<TeamName> — Playing XI*`; `⭐ Captain: <name>` if set; one line per roster entry `<emoji> <n>. #<jerseyNumber> <name>` (jersey prefix omitted when null, `*(C)*` suffix for captain) or `_Team not yet announced_` when the roster is empty; `_12th Man: <name>_` if set.
  - Trailing legend: `🏏 = Bat  |  🔴 = Bowl  |  🏏🔴 = All-Rounder  |  🧤 = WK`.
  - Missing-player fallback: reuse the same `'Unknown player'` fallback convention `teamSheetPdf.ts`'s `playerName()` uses, for consistency between the two outputs.

### 2. `ui/src/components/TeamSheetCommunicationDialog/TeamSheetCommunicationDialog.tsx` (edit)

- New local state: `selectedOption: 'pdf' | 'whatsapp'`, default `'pdf'` (today's behavior is the unchanged default).
- Convert the "Print as PDF" and "WhatsApp" `ListItem`s to `ListItemButton` (selected/highlighted state via MUI's `selected` prop tied to `selectedOption`), removing the now-stale comment about skipping `ListItemButton`. The "Facebook" row is untouched — still a disabled, non-interactive `ListItem` with its `Chip`.
- The team-scope `ToggleButtonGroup` and its `isSidePrintable`/`bothPrintable`/`homePrintable`/`awayPrintable`/`defaultScope`/`manualScope` logic are **completely unchanged** — shared as-is regardless of `selectedOption`, per the spec's explicit "one printability computation, not two."
- New prop: `subtitle: string` — added to `TeamSheetCommunicationDialogProps`. `MatchCard` already computes this exact string today (`const subtitle = matchFields(match, leaguesById, seasonsById).map(...).join(' · ')`, used for `generateTeamSheetPdf`'s own subtitle) — it's now also passed straight into `<TeamSheetCommunicationDialog subtitle={subtitle} ... />`, so the WhatsApp text and the PDF share literally the same logistics line, computed once, not two drifting copies.
- New block, rendered only when `selectedOption === 'whatsapp'` and at least one side is printable: an `Input` (from `../Input`, multiline, `minRows={10}`) holding `whatsappText` local state, plus a ghost `Button` with `RefreshOutlinedIcon` labeled "Regenerate" — mirrors `PollShareDialog.tsx`'s exact pattern (`ui/src/components/PollShareDialog/PollShareDialog.tsx`), including a `useEffect` that recomputes `whatsappText` via `generateTeamSheetWhatsAppText(match, sidesInScope, subtitle)` whenever the dialog opens, `selectedOption` becomes `'whatsapp'`, or `selectedScope` changes — and a `handleRegenerateWhatsApp` that does the same recompute on demand, discarding manual edits.
- The primary `DialogActions` button becomes option-aware: `selectedOption === 'pdf'` keeps today's exact `handlePrint`/`scopeLabel`/`onPrint` flow, byte-for-byte; `selectedOption === 'whatsapp'` renders a "Done" button that just calls `onClose()` — no call to `onPrint`, matching the spec's explicit rejection of clipboard automation.
- The "neither side printable" `Alert` and its Print-disabled behavior apply under both options unchanged (same `bothPrintable || homePrintable || awayPrintable` check already gates the scope-toggle-vs-alert branch).
- `sidesLoading` continues to gate both options identically (Loading state unchanged).

### 3. `ui/src/components/TeamSheetCommunicationDialog/TeamSheetCommunicationDialog.stories.tsx` (edit — basic coverage only, test-writer enriches)

Add one new story, `WhatsAppSelected`, that opens the dialog and (via a `play` function, same pattern `ErrorState` already uses) clicks the WhatsApp row to show the generated-text state exists and renders. Existing stories (`Default`, `OneSideNotPrintable`, etc.) stay on the PDF path by default (unchanged args) since `selectedOption` defaults to `'pdf'`.

### 4. `ui/src/components/TeamSheetCommunicationDialog/TeamSheetCommunicationDialog.test.tsx` (edit — basic smoke test only, test-writer fills the full matrix)

Add one smoke test confirming selecting "WhatsApp" reveals a textbox containing the expected role emoji, so frontend-builder's own verification pass has at least one real assertion before handing off.

### 5. `ui/src/utils/teamSheetWhatsAppText.test.ts` (new — basic smoke test only, test-writer fills the full matrix)

One test: given a simple fixture (reuse the same shape as `teamSheetPdf.test.ts`'s fixtures), assert the emoji table and header line are correct.

### 6. `ui/src/pages/manage/MatchList.tsx` (edit — one line)

Pass the already-computed `subtitle` (currently only used for `generateTeamSheetPdf`'s call in `handlePrint`) through as the new `subtitle` prop on `<TeamSheetCommunicationDialog ... subtitle={subtitle} />`. No other change to this file — `subtitle`'s computation itself is untouched.

## Agent assignment

1. **`frontend-builder`** — items 1–6 above (new util with its core logic, dialog rework including the new `subtitle` prop, `MatchCard`'s one-line wiring, one basic story, one basic test per file). No `backend-builder` needed — spec confirms zero backend/data changes.
2. **`test-writer`** (after frontend-builder) — compares the spec's Test Plan table against what frontend-builder actually wrote, then fills the full matrix: `teamSheetWhatsAppText.test.ts` (all 6 role/WK emoji combinations, header/logistics line, one section per scope, batting order, captain/twelfth-man lines, jersey-number prefix present/absent, "Team not yet announced" line, trailing legend always present), `TeamSheetCommunicationDialog.test.tsx` (WhatsApp reveals pre-filled text; scope change regenerates; Regenerate discards a manual edit; scope-disable rules identical under WhatsApp; Facebook still unselectable; "Done" closes without calling `onPrint`), and enriched `.stories.tsx` coverage (mobile/tablet/desktop viewports for the WhatsApp state, matching the PDF stories' own viewport story set). E2E: extend `ui/e2e/manager-league-management.spec.ts` with a WhatsApp-scope assertion, following that file's existing CI self-skip guard.

## Flags for your review

- **Logistics line: resolved.** The dialog gains a `subtitle: string` prop, computed once in `MatchCard` exactly as it already is for the PDF path, and passed to both `generateTeamSheetPdf` (unchanged) and the new WhatsApp text builder — one shared line, not two drifting copies.
- **`ListItemButton` visual selected-state styling** isn't specified pixel-for-pixel in `039` — frontend-builder will use MUI's default `selected` treatment (per `docs/standards/design-system.md`'s token set) rather than inventing new styling, consistent with `docs/standards/frontend.md`'s "no raw hex values outside theme.ts" rule.

## Verification

- `cd ui && npm run build && npm run lint && npm run test` — must pass with the new/edited files (mirrors `030`'s own verification step for `teamSheetPdf.ts`/`TeamSheetCommunicationDialog`).
- `npm run test:storybook` for the new/edited stories.
- Manual smoke test (`claude-in-chrome`, per `docs/workflow.md` step 8, once built): open a match's "Communicate Team Sheet" dialog, select "WhatsApp," confirm the emoji-formatted text renders for `both`/`home`/`away` scope, confirm "Regenerate" resets an edit, confirm "Print as PDF" still behaves exactly as before.
