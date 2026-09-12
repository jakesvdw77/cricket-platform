# Plan: 030 — Team Sheet Communication from the Match Card

## Context

`docs/specs/029-league-management.md` shipped match scheduling and Playing XI selection but stopped at persistence — there's no way to get a selected XI in front of the actual team. `docs/specs/030-team-sheet-communication.md` (already written and committed on `feature/030-team-sheet-communication`) is the first slice of that follow-up work: a "Communicate Team Sheet" action on each match's `RecordCard`, opening a dialog built to hold several communication formats over time, with exactly one — "Print as PDF" — wired this pass. The PDF is generated entirely client-side, porting the legacy Cricket Legend app's `jsPDF`/`jspdf-autotable` approach. No backend change; no new entity.

This plan turns that approved spec into a concrete file list and build order. It does not redefine anything the spec already fixed (data sources, scope semantics, the `RecordCard.secondaryActions` decision, the "no shirt number" gap, the dropped vendor-branding footer). Two implementation-level judgment calls the spec's prose didn't pin down precisely are called out below in **Flags for your review**.

## Files to touch, in order

### 1. `ui/package.json`
Add `jspdf` and `jspdf-autotable` as runtime dependencies (confirmed absent today). Run `npm install` to update `package-lock.json`.

### 2. `CLAUDE.md`
Add one row/note to the Tech Stack table recording this new dependency, mirroring the existing `@mui/x-tree-view` precedent ("approved addition for X — added for spec NNN's Rollout Notes — not a departure from MUI-only, it generates documents, not UI"). Keeps the precedent of durable tooling decisions being reflected in this file, not just buried in a spec.

### 3. `ui/src/components/RecordCard/RecordCard.tsx` (+ `RecordCard.test.tsx`)
Exactly the spec's fixed decision: add an optional `secondaryActions?: RecordCardSecondaryAction[]` prop, rendered after the existing singular `secondaryAction` (if both present), before Edit. Build one ordered list internally — `[...(secondaryAction ? [secondaryAction] : []), ...(secondaryActions ?? [])]` — reusing the exact same `Button` markup (`variant="ghost"`, `size="sm"`, icon, pending-label swap) `secondaryAction` already renders, keyed by index. `secondaryAction` itself stays byte-for-byte unchanged so all other current call sites (`TeamFormPage` + its test, `SeasonList`, `PlayerList`, `LeagueList`, `LeagueFormPage`, `SponsorContactList`, `TeamDirectory`, `TeamList`, `SponsorList`, `ClubContactList`, `SubscriptionList`, `RecordCard.stories.tsx`) keep compiling and behaving unmodified.

Test additions: `secondaryActions` renders every action in order alongside an existing `secondaryAction`, and alone (no `secondaryAction`) — without touching any existing assertion in the file.

### 4. `ui/src/utils/teamSheetPdf.ts` (new, + `teamSheetPdf.test.ts`)
The single home for all `jsPDF`/`jspdf-autotable` usage in this feature, ported from the legacy app's `generateTeamsheetPdf` (`/Users/jaco/Development/cricketlegend/ui/src/utils/matchPdf.ts`), adapted to this repo's actual types:

```ts
export interface TeamSheetSide {
  team: Team              // ui/src/api/teamApi.ts — has logoUrl: string | null
  teamName: string        // resolved display name (Team.name, or Match's free-text *TeamName when no real Team)
  side: MatchSide | undefined  // ui/src/api/matchSideApi.ts
  squad: Player[]         // ui/src/api/teamSquadApi.ts's listSquad() result — Player has firstName/lastName, not name/surname
}

export async function generateTeamSheetPdf(
  match: Match,
  sides: TeamSheetSide[],       // already filtered to the requested scope by the caller
  subtitle: string,             // pre-resolved "date · venue · league/season" string — built by the caller from the same league/season maps matchRecordFields.ts already uses on the card, not re-derived here
): Promise<string>               // returns URL.createObjectURL(doc.output('blob'))
```

Internals, matching legacy's structure and this spec's fixed decisions:
- Local, non-exported `loadImageBase64(url): Promise<string | null>` (fetch → blob → `FileReader.readAsDataURL`) — nothing to port from inside this repo (confirmed no existing base64-image-loader here); resolves `null` on any failure so a missing/broken logo never throws.
- Local, non-exported roster helper: sort `side.players` by `battingOrder`, resolve each `MatchSidePlayer.playerProfileId` against `squad` for the name, flag `captainPlayerId`/`wicketKeeperPlayerId`/`twelfthManPlayerId` matches. (See Flag #2 below on why this isn't shared with `PlayingXiBuilder`.)
- Dark header band: match title (`homeTeamName ?? homeTeam.name` vs away equivalent, using free-text name when no real `Team`), the pre-built `subtitle` line, "TEAM SHEET" label.
- One section per side in scope: team header bar (logo via `addImage`, falling back to an initial-letter tile when missing/failed — matching legacy), uppercased name, "Playing XI (n)" count, numbered rows in batting order (name only, no shirt number — the spec's documented gap), `(C)`/`(WK)` suffixes, a distinct twelfth-man callout box, and a "Team not yet announced" placeholder row when `side.side` is undefined or has zero players.
- `checkPage()` pagination helper — new page + redrawn footer band on overflow, matching legacy.
- Footer: **only** "Team sheet generated `<date>`" — no vendor/club branding line (spec's deliberate deviation from legacy, since no club branding is available to this dialog and it's a white-labelled platform).

Unit tests (Vitest, per spec's Test Plan): header/subtitle content; one section per side in scope for `both`/`home`/`away`; correct batting-order rows; `(C)`/`(WK)` suffixes; twelfth-man callout; "Team not yet announced" placeholder for a side with zero players; a failed `loadImageBase64` (mocked `fetch`/`FileReader`) still produces a valid PDF instead of throwing.

### 5. `ui/src/components/TeamSheetCommunicationDialog/` (new, four-file anatomy)
`TeamSheetCommunicationDialog.tsx` / `.test.tsx` / `.stories.tsx` / `index.ts`.

Presentational — no React Query inside this component (see Flag #1: fetching lives in the caller, matching this codebase's existing dialog convention). Props:

```ts
interface TeamSheetCommunicationDialogProps {
  open: boolean
  onClose: () => void
  match: Match
  sides: TeamSheetSide[]          // both resolved sides (or as many as could be resolved), always passed in full — the dialog itself computes per-side "printable" from `sides`
  sidesLoading: boolean           // true while the caller's listMatchSides/listSquad queries are in flight
  onPrint: (scope: 'both' | 'home' | 'away') => Promise<void>  // caller-owned: runs generateTeamSheetPdf + window.open, rethrows on failure
}
```

Behavior:
- Option list: "Print as PDF" (enabled), "WhatsApp" and "Facebook" rows visibly present but disabled ("Coming soon") — makes the dialog's planned growth visible to a real user, per spec.
- Scope `ToggleButtonGroup` (`both`/`home`/`away`, exclusive): a side's individual scope is disabled when it has no real `Team` or its resolved `side.side` has zero players; `both` stays enabled whenever at least one side qualifies; if neither qualifies, the toggle is replaced by an inline message and Print is disabled. Default selection: `both` if at least one side printable, else whichever single side is.
- Print button: label mirrors legacy's `Print Both Teams` / `Print <TeamName>` copy; disabled while `sidesLoading` or while `onPrint` is in flight (local `isGenerating` state); calls `onPrint(scope)`, closes the dialog on success. On a caught rejection, shows an inline `Alert`/error `Typography` and **keeps the dialog open** for retry (matching `CreateAndLinkRecordDialog.tsx`'s existing inline-error convention) rather than closing or failing silently.
- Mobile-first: every control stacks full-width and is keyboard-reachable at 375px; Storybook story includes the 375/768/1280 viewport addon per `design-system.md`'s convention.

Component test (RTL): the one meaningful interaction per `testing.md`'s scope rule — cover the scope-disabling logic and the Print → success/error paths, not every prop permutation.

### 6. `ui/src/pages/manage/MatchList.tsx` (edit `MatchCard`)
`MatchCard` gains:
- Local `dialogOpen` state.
- `useQuery(listMatchSides(clubId, match.id), { enabled: dialogOpen })`, plus per-side `useQuery(listSquad(clubId, teamId, match.seasonId), { enabled: dialogOpen && <that side has a real teamId> })` — mirroring `MatchFormPage.tsx`'s existing `MatchSideTab` query-key shape exactly (`['managed-club', clubId, 'teams', teamId, 'seasons', seasonId, 'squad']`), not inventing a new key convention.
- A `handlePrint(scope)` function: assembles `TeamSheetSide[]` from the fetched sides/squads/`teamsById`, builds the subtitle from `leaguesById`/`seasonsById` (same lookups `matchFields()` in `matchRecordFields.ts` already does for the card — reuse, don't re-derive), calls `generateTeamSheetPdf(...)`, `window.open(url, '_blank')` on success, rethrows on failure so the dialog can surface it.
- New `secondaryActions={[{ label: 'Communicate Team Sheet', pendingLabel: 'Opening…', pending: false, onClick: () => setDialogOpen(true), icon: <ShareOutlinedIcon fontSize="small" /> }]}` alongside the existing `secondaryAction` (Deactivate/Reactivate) — left untouched.
- Renders `<TeamSheetCommunicationDialog open={dialogOpen} onClose={...} match={match} sides={...} sidesLoading={...} onPrint={handlePrint} />`.

No route change; `SquadPicker` (which renders `MatchList` with different props per `029`) inherits this automatically.

## Agent assignment

1. **`frontend-builder`** — items 1–6 above (dependency install, `CLAUDE.md` note, `RecordCard` extension, `teamSheetPdf.ts`, `TeamSheetCommunicationDialog` four-file scaffold with a basic story, `MatchList.tsx` wiring). No `backend-builder` needed — spec confirms zero backend changes.
2. **`test-writer`** (after frontend-builder) — compares spec's Test Plan against what frontend-builder actually wrote, then fills gaps: `RecordCard.test.tsx` additions, `TeamSheetCommunicationDialog.test.tsx` real cases + enriched `.stories.tsx`, `teamSheetPdf.test.ts`, and an e2e addition extending `ui/e2e/manager-league-management.spec.ts` (Print as PDF → assert a new tab/blob URL opens via Playwright's `page.waitForEvent('popup')` or equivalent) — following that file's existing `process.env.CI` self-skip guard if it needs the same authenticated flow CI's `e2e-smoke` job can't yet run.

Then: manual smoke test in a real browser (open a match with a built XI, trigger the dialog, print, confirm a real PDF opens) before commit/review, per `CLAUDE.md`'s UI rule.

## Flags for your review

1. **Dialog fetch ownership.** The spec's prose says "the dialog... fetches `listMatchSides`... (React Query, enabled: open)." This plan instead has `MatchCard` own those queries and pass resolved data into `TeamSheetCommunicationDialog` as props, keeping the dialog presentational — matching this codebase's existing convention (`LinkExistingRecordDialog`, `TeamFormPage`'s dialogs: the host owns React Query/mutation state, the dialog is props-in/callbacks-out). This doesn't change the spec's data sources, entities, or user-visible behavior — it's an internal component-boundary call. Flagging since it diverges from the spec's literal wording.
2. **Duplicated roster logic.** `PlayingXiBuilder.tsx` (shipped in `029`) already sorts by `battingOrder` and resolves captain/WK/12th-man inline, un-exported. `teamSheetPdf.ts` needs the same small logic. Recommendation: duplicate it locally in `teamSheetPdf.ts` rather than refactoring `PlayingXiBuilder` to share it — extracting a shared helper would touch already-shipped, tested code for a small (~10-line) block, which isn't worth the regression risk for this spec. Flagging in case you'd rather extract a shared helper now instead.

## Verification

- `cd ui && npm run build && npm run lint && npm run test && npm run test:storybook` — must pass clean.
- Manual smoke test per `CLAUDE.md`: start both dev servers, open a match with a built Playing XI on at least one side, trigger "Communicate Team Sheet" → "Print as PDF" for `both`/`home`/`away`, confirm a real PDF opens in a new tab with correct content; also test a match where one side has no XI yet (confirm scope gating + placeholder) and a match with two free-text opponents (confirm the "nothing to print" message).
- `npm run test:e2e` locally (not CI-gated) for the extended `manager-league-management.spec.ts` scenario.
