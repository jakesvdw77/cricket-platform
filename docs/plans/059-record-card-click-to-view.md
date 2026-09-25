# Plan: 059 — RecordCard Click-to-View

## Context

`docs/specs/059-record-card-click-to-view.md` (approved) removes the explicit "View" footer button from every `RecordCard` that has a `viewTo`, replacing it with a "stretched link" — the card's title becomes a real link to `viewTo`, expanded via CSS to cover the whole card as the click target. This is a single-component change (`RecordCard.tsx`) that every consumer picks up automatically; no per-page changes needed, confirmed by auditing every real call site this session (the only card with a nested interactive field value — `TeamFormPage.tsx`'s `SquadPlayerCard`'s jersey-number `Input` — has no `viewTo`, so it's unaffected either way, but the stacking fix is applied generically so it holds if that ever changes).

**Verified directly against current source this session**: the full current `RecordCard.tsx` (footer button logic for the `viewTo`/`editTo` branches, `CardContent`/`CardActions` structure), the full current `RecordCard.test.tsx` (23 existing tests — three of them assert on a `getByRole('link', { name: 'View' })` that this change removes and must be rewritten, not just left broken), and confirmed via a full-codebase grep that no other `RecordCard` consumer combines `viewTo` with a custom interactive `field.value` today.

## Files to touch, in order

### Frontend (`frontend-builder`) — this is a frontend-only spec, no backend slice

1. **`ui/src/components/RecordCard/RecordCard.tsx`**:
   - Add `position: 'relative'` to the outer `MuiCard`'s `sx` (needed as the containing block for the stretched-link `::after`).
   - Wrap the title `Typography` in a `RouterLink` to `viewTo` when `viewTo` is set (plain, unstyled — no underline/color change, matching the spec's "not a visible link cue" requirement); give that link `sx={{ color: 'inherit', textDecoration: 'none', '&::after': { content: '""', position: 'absolute', inset: 0 } }}` — **deliberately no `position: 'relative'` on the link itself** (verified empirically during build: doing so traps the `::after` overlay inside the link's own tiny box instead of letting it resolve to `MuiCard`, since a positioned element is its own pseudo-element's nearest containing block). When `viewTo` is absent, the title renders exactly as today (plain `Typography`, no link).
   - Remove the footer's `viewTo` branch's "View" `MuiButton` — when `viewTo` is set and `editTo` is also set, render only the Edit button (today's `<>...<View/><Edit/></>` becomes just `<Edit/>`); when `viewTo` is set and `editTo` is not, the footer renders no Edit-area button at all (today's `viewTo`-only branch rendered View alone — now renders nothing there, since View is gone and there's no editTo to show); the `editTo`-without-`viewTo` and neither-set branches are unchanged.
   - Add `position: 'relative'` to `CardActions`'s `sx` — this is the stacking-order fix: lifts every button inside it (Edit, every secondary action) above the stretched-link overlay in one place, per the spec's UI Requirements.
   - Update `RecordCardField`'s doc comment to note the new integration contract: a caller rendering an interactive control as a `field.value` must give that element its own `position: relative` (or similar stacking context) if the card might ever also have `viewTo` set — mirror the spec's own wording for this, it's already precise.

2. **`ui/src/components/RecordCard/RecordCard.test.tsx`** — three existing tests reference the now-removed View button and must be rewritten (not left broken):
   - `'renders View and Edit together when both viewTo and editTo are provided'` → rename/rewrite to assert the title itself is a link with `href` = `viewTo` (`screen.getByRole('link', { name: 'Jane Smith' })`), the Edit link is still present and unchanged, and there is no longer a separately-labeled "View" link/button.
   - `'renders View alone, with no Edit link, when only viewTo is provided'` → rewrite the same way: title is a link to `viewTo`, no Edit link/button renders.
   - `'keeps rendering the Edit action normally when viewTo is not provided'` — read through carefully; likely already passes unchanged (no `viewTo` means no title-link, no footer change) but confirm rather than assume.
   - Add new test coverage per the spec's own Test Plan: clicking the card body (not a button) navigates via the title's stretched link; clicking Edit still navigates to `editTo` and does not also trigger View's own navigation; clicking a `secondaryAction` button still fires its own `onClick`, doesn't navigate; a card with no `viewTo` is unchanged (no card-wide link at all — assert `queryByRole('link', { name: <title> })` is absent).

3. **`ui/src/pages/manage/TeamFormPage.tsx`'s `SquadPlayerCard`** — no code change (it has no `viewTo`, per the spec's Non-goals), but per the plan's own Test Plan, confirm/extend `TeamFormPage.test.tsx`'s existing jersey-number-input test still passes unmodified after the `RecordCard` change (a real regression check, not just an assumption) — this is the one genuine nested-interactive-field proof case in the whole codebase.

### Tests (`test-writer`, after the frontend build finishes)

- `RecordCard.stories.tsx` — add or update a story demonstrating a `viewTo`+`editTo` card so Storybook's own visual review shows the new click-anywhere behavior (check the existing stories file first for its current `viewTo` coverage before assuming a new story is needed).
- A light end-to-end-tier smoke check per the spec's own Test Plan, on two or three representative `viewTo`-bearing lists (e.g. `LeagueList.test.tsx`, `SponsorList.test.tsx`) — confirm clicking a card's title/body (not a button) still resolves to the same route the old View button targeted, and Edit still works alongside it. Not a new full test suite — a couple of targeted additions to already-existing list test files, per the spec's own "not every single one" scoping.

## Verification

- `source ~/.nvm/nvm.sh && nvm use 22.12.0 && cd ui && npm run build && npm run lint && npm run test && npm run test:storybook`.
- Manual smoke test: on a `viewTo`-bearing list (e.g. Leagues), click the card body away from any button — confirm it navigates to the detail view; click Edit — confirm it still navigates to the edit screen and doesn't also trigger the card-wide link; on `TeamFormPage`'s Squad tab, confirm the jersey-number input is still clickable/editable and doesn't accidentally trigger any navigation.
