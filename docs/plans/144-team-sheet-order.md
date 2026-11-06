# Plan 144: Team sheet order (batting order or alphabetical)

Implements `docs/specs/144-team-sheet-order.md` (approved 2026-11-06). Frontend only: no backend, migration or `openapi.yaml` change, so `backend-builder` is not involved. Branch `feat/144-team-sheet-order` (spec and roadmap row already committed there, `a67399a1`).

## Context
Every shared match lineup is listed in batting order, numbered, by `lineupOf` (`ui/src/utils/share/shareMatchData.ts`). The owner wants an **Order** toggle, **Batting Order | Alphabetical**, on every lineup share in every format. The spec fixes: default Batting Order and the last choice remembered; sort by surname then first name using the real name (so the initials switch never reorders); no batting numbers when alphabetical; the 12th man always last; Team Sheet and Team Selection Poster both get it; label "Order"; one frontend-only PR.

## What the code already gives us (reuse, do not rebuild)
- One model: `buildMatchShareModel` -> `MatchShareModel.lineups: MatchShareLineup[]` (`shareMatchData.ts`). PDF (`matchPdf.ts`), image and TV (`matchImage.ts`), WhatsApp and Facebook (`matchText.ts`) all read `lineup.players` and number with the same expression `player.order != null ? position += 1`. Nobody formats order by hand.
- `usesLineup(content)` in `matchShareFormats.ts` already says which contents carry a lineup (`TEAM_SELECTION`, `TEAM_SHEET`); `MatchContentControls.tsx` already hides the Side group with `lineup &&`.
- Remembered choices: `MatchShareChoices` in `utils/share/shareChoices.ts` (`share:choices:${clubId}` via `hooks/useShareChoices`, `sanitiseShareChoices`, `DEFAULT_SHARE_CHOICES`, `pickEnum`). `layout` is the exact precedent for a remembered enum (`ShareMatchDialog.tsx` lines about 66, 103, 179, 199).
- Controls: `CompactToggleGroup` + `ToggleButton` inside `ShareControlGroup`, `guard(() => ...)` for the edit-text confirmation (same as Side and Layout).

## Decisions of the spec this plan keeps unchanged
Sort key, no numbers when alphabetical, 12th man last, both contents, label and default: all as in the spec. Nothing is redefined.

**One point to confirm (not a reinterpretation):** the spec says remembered "per manager in the browser". The existing mechanism stores choices per club in the browser (`share:choices:${clubId}`), which is the same thing for a manager with one club. The plan uses that mechanism and adds no new storage.

## Design
1. **Type and sort (pure).** In `matchShareFormats.ts` add `MatchLineupOrder = 'BATTING' | 'ALPHABETICAL'`, `MATCH_LINEUP_ORDERS`, `MATCH_ORDER_LABELS` ("Batting Order", "Alphabetical").
2. **Model.** `MatchShareLineup` gets `numbered: boolean` (true for batting order). `lineupOf(side, own, logoUrl, initialsOnly, order = 'BATTING')`: for ALPHABETICAL sort the non-12th-man rows with an `Intl.Collator('en', { sensitivity: 'base' })` on the real last name then first name (member or entry name, the same source `nameOf` uses before `shareName`, so initials-only never changes the order), then `numbered: false`. `BuildMatchShareInput` gets `lineupOrder?: MatchLineupOrder` (default BATTING so every existing caller and test is unchanged); `buildMatchShareModel` passes it through `lineupFor`.
3. **Generators.** Replace the numbering expression with `lineup.numbered && player.order != null`: `matchText.ts` `lineupLines`, `matchImage.ts` `drawLineup` (and drop the number column gutter when not numbered), `matchPdf.ts` `table` (also hide the "#" header and shift the name left). No new wording ("(alphabetical)" is not added, per the spec).
4. **Choices.** `MatchShareChoices.lineupOrder: MatchLineupOrder` (default `'BATTING'`), `sanitiseShareChoices` falls back with `pickEnum`, `DEFAULT_SHARE_CHOICES.match.lineupOrder`.
5. **Dialog and control.** `ShareMatchDialog.tsx` holds `lineupOrder` state initialised from `choices.match.lineupOrder`, passes it to `buildMatchShareModel` (and its memo deps), persists on change with `updateChoices({ match: { lineupOrder } })`, exactly like `layout`. `MatchContentControls.tsx` adds a `ShareControlGroup label="Order"` with a `CompactToggleGroup` (Batting Order | Alphabetical), shown inside the existing `lineup &&` gate so it appears only for lineup contents; its props are added to the controls type in `matchScreenTypes.ts`. Switching it regenerates the preview and the WhatsApp and Facebook text through the existing model memo and `useEditableShareText` regenerate rule behind `guard`.
6. **Fixture.** `matchShareFixture.ts` accepts the new input key so tests can build both orders.
7. **Docs.** `docs/specs/131-match-sharing.md` control strips table gets an "Order (lineup contents)" note; `docs/standards/frontend.md` one sentence; `docs/roadmap.md` row 144 to "Built". No `design-system.md` change (no new component).

## Files
Modify: `ui/src/utils/share/matchShareFormats.ts`, `shareMatchData.ts`, `shareChoices.ts`, `matchText.ts`, `matchImage.ts`, `matchPdf.ts`, `matchShareFixture.ts`; `ui/src/components/ShareMatchDialog/ShareMatchDialog.tsx`, `MatchContentControls.tsx`, `matchScreenTypes.ts`; docs listed above.
Create: none (no new component, so no new story).

## Who does what
- **frontend-builder:** steps 1 to 6 in the order listed (pure model first, generators second, choices third, dialog last), then the doc edits in step 7.
- **test-writer** (after the user checks the function, per the standing "build first, tests after approval" rule): the tests below. No `backend-builder`.

## Tests (the spec's Test Plan, per `docs/standards/testing.md`)
- Unit, `utils/share/matchShare.test.ts`: `lineupOf` in both orders (surname then first name, accents and case, initials-only keeps the real-name order, single-name player, a player with no batting position, 12th man last and outside the sort, `numbered` flag); `matchText`, `matchPdf` and `matchImage` with `numbered` true and false (no numbers, no "#" header); batting output byte-for-byte unchanged by default.
- Unit, `shareChoices.test.ts`: default `'BATTING'`, an invalid stored value falls back, a patch merges key by key.
- Component, `ShareMatchDialog.test.tsx`: the Order toggle appears for Team Sheet and Team Selection and not for Fixture Card or Countdown; switching it regenerates the WhatsApp text and the preview; the last choice is the default on reopening.
- Existing share tests must stay green; the page-anatomy guard test is unaffected (no new button).
- Not run: Playwright; the visual check of the PDF and poster is the owner's.

## Verification
1. `cd ui && source ~/.nvm/nvm.sh && nvm use 22.12.0 && npx tsc -b && npx oxlint`.
2. Run the share test files on their own (`src/utils/share`, `src/components/ShareMatchDialog`); the full suite flakes under load, so run folders separately.
3. Manual: Matches or Select Team page -> Share Match -> Team Sheet and Team Selection Poster -> each format: toggle Order; alphabetical lists A to Z by surname with no numbers, batting order unchanged; flip the initials switch and confirm the order does not move; reopen the dialog and confirm the last choice is remembered.

## Risks and notes
- A player with no batting position (still "waiting") sorts like everyone else in alphabetical order; in batting order they stay after the numbered ones, as today.
- Image/TV tile heights depend on the row count only, so no layout change beyond the dropped number column.
- Anything outside `ShareMatchDialog` that prints a lineup (the older `030`/`039` team-sheet utilities) is not reached by this toggle; if any caller still uses them live it needs a follow-up decision from the owner (flagged, not decided here). No such caller was found in the share flow traced above.
