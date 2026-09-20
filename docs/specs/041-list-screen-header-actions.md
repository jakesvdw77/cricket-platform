# 041 — List Screen Header Actions & Filter Row Cleanup

**Depends on:** `008-product-catalog.md` (`ListToolbar`, the pattern every `/manage` list screen composes from), `030-team-sheet-communication.md` (`RecordCard.secondaryActions` — unrelated to, and unchanged by, this spec's `viewTo`/`editTo` change), `036-view-first-record-detail-screens.md` (`RecordCard.viewTo`/`editTo` — this spec revises that decision), `037-match-improvements.md` (`MatchList`'s Section filter row and `sortMinWidth`, the specific screen whose visual rough edges triggered this spec).
**Status:** draft.

## Problem & Goals

A live cosmetic review of `MatchList`'s card (screenshot-driven, in conversation) surfaced four real rough edges that turned out not to be Match-specific — they're artifacts of `ListToolbar`/`RecordCard`/`ManageScreenHeader`'s shared shape, present on every `/manage` list screen that uses a Section filter and/or the view-first pattern:

1. A card's secondary-action label ("Communicate Team Sheet") was long enough to crowd the footer next to "Select Team"/"View", with more communication channels (`039`'s WhatsApp, and Facebook still deferred) only making it worse over time.
2. `036`'s `RecordCard` decision made `viewTo` and `editTo` mutually exclusive — passing `viewTo` always suppressed Edit, even when a caller had a real `editTo` too. That was the right call when View-first shipped, but it means there's no direct Edit shortcut from the list card at all today, only View → (that screen's own) Edit.
3. `MatchList`'s Section filter sat on its own row below `ListToolbar`, capped at `maxWidth: 360` while `ListToolbar`'s own Search flexes to fill — visually shorter and disconnected from the row above it. The container wrapping both used a translucent `alpha(primary.main, 0.05)` tint, which reads as invisible against the app shell's own gradient page background (the same problem `RecordCard`'s own card background already had, fixed separately in unrelated in-flight work).
4. `ManageScreenHeader`'s title row had no slot for a screen's primary "create" action — every list screen's "Add X" button lived inside `ListToolbar` instead, one row below the page title, rather than beside it.

None of these are Match-specific: `PlayerList` and `TeamDirectory` had the identical Section-filter row/tint problem, and every list screen following `008`'s `ListToolbar` pattern had "Add X" living in the toolbar row rather than the header.

**Goals**
- Shorten `MatchList`'s "Communicate Team Sheet" action label to "Team Sheet".
- `RecordCard` renders View **and** Edit together when a caller passes both `viewTo` and `editTo` — `viewTo`-only or `editTo`-only call sites are unaffected.
- `ListToolbar` gains an optional `filters` slot (a single extra filter control, e.g. a `SectionTreeSelect`) rendered inline with Search/Sort on desktop and as its own full-width row on mobile — replacing every screen's own ad-hoc `Box`-wrapped filter row.
- `ManageScreenHeader` gains an optional `action` slot (top-right, beside the title) for a screen's primary create action; `ListToolbar.createLabel`/`onCreate` become optional and are no longer the sanctioned place for it.
- Every existing `/manage` list screen using this pattern (`MatchList`, `PlayerList`, `TeamDirectory`, `SponsorList`, `LeagueList`, `TeamList`, `ClubContactList`, `SeasonList`) is migrated to the new shape in the same pass — this is now the documented standard (`docs/standards/frontend.md`) for every list screen, present and future, not an opt-in.

## Non-goals

- **Gating the new View+Edit pairing behind a permission check.** No role/permission model exists yet to determine who can edit a given record from a list screen — flagged explicitly, not silently assumed. Everyone who can already reach a `/manage` list screen can already reach Edit via View → Edit today; this spec only removes an extra click, it doesn't expose a capability that wasn't already reachable. Real permission-based hiding is future work for whichever spec builds a real authorization model for `/manage` screens.
- **`SponsorContactList`'s own Add action.** That screen has no `ManageScreenHeader` at all (it's a nested contacts-within-a-sponsor list, not a standalone page-level screen) — out of scope; it keeps its current `ListToolbar`-hosted create button unchanged.
- **`/admin` (platform-admin) screens** (`ProductList`, `ClubList`, `SubscriptionList`). They don't use `ManageScreenHeader` at all today — a different header story entirely, not touched here. Real future work once that shell's own header pattern is settled, not decided in this spec.
- **A generic multi-filter `ListToolbar.filters` array.** This spec's `filters` slot holds exactly one control, matching every current real use case (a single Section picker). A screen that eventually needs two or more simultaneous filters is a real, separate future decision — noted in `docs/standards/frontend.md`'s own list-screen-layout section as the trigger for extending `filters` later, not built speculatively now.
- **Any change to `RecordCard.secondaryAction`/`secondaryActions`, `badge`/`badges`, or any other prop.** Purely the `viewTo`+`editTo` rendering decision.
- **Renaming `TeamSheetCommunicationDialog`'s own dialog title** ("Communicate Team Sheet") — only the card's trigger-button label shortens; the dialog itself is untouched.

## User Stories

- As a club admin, a match's card footer reads "Team Sheet" instead of the longer "Communicate Team Sheet", with room for the row to stay uncluttered as more channels ship.
- As a club admin viewing any list screen with both a real View and a real Edit route configured (today: Matches only), I can jump straight to Edit from the card footer without going through View first.
- As a club admin, a list screen's Section filter (where one exists) sits inline with Search and Sort on desktop, and gets its own full-width row on mobile instead of competing for space with Sort and the create button.
- As a club admin scanning any list screen, the primary "Add X" action is immediately visible top-right next to the page title, not one row down inside the filter bar.
- As a club admin using a screen reader or a 375px viewport, every relocated/added control (the header's action button, the inline filter, the paired View/Edit buttons) is keyboard-reachable with a clear accessible name.

## Data Model Changes

None. Purely a frontend, presentational-layer spec — no entity, field, migration, or endpoint changes.

## API Contract

None — no endpoint touched.

## UI Requirements

**`ui/src/components/RecordCard/RecordCard.tsx`** (existing, edited):
- `viewTo`'s doc comment and rendering logic change: when `viewTo` is set, render the View button; **additionally**, when `editTo` is *also* set, render an Edit button immediately after it (same `MuiButton` markup/size/variant `editTo`-only call sites already use). `onEdit` (the bare-callback fallback) stays reachable only when neither `viewTo` nor `editTo` is set — unchanged.
- No prop shape change — this is a rendering-logic revision to existing optional props, not a new prop.

**`ui/src/components/ListToolbar/ListToolbar.tsx`** (existing, edited):
- New optional props: `filters?: ReactNode`, `filtersMinWidth?: number` (default `200`, same "flex 1 on mobile, fixed on desktop" shape as `sortMinWidth`). Rendered as its own flex child between Search and the Sort/Create group — its own full-width row on mobile (`xs`), fixed-width inline on desktop (`md`).
- `createLabel`/`onCreate` become optional (`createLabel?: string`, `onCreate?: () => void`); the Create button renders only when both are passed. Existing call sites that still pass both (`SquadPicker` via `MatchList`'s own props, `SponsorContactList`) are unaffected.

**`ui/src/components/ManageScreenHeader/ManageScreenHeader.tsx`** (existing, edited):
- New optional prop `action?: ReactNode`, rendered top-right in a row with the title (`justifyContent: space-between`, stacking to its own row below the title on `xs`). Every existing call site not passing it keeps its current title-only header, unchanged.

**Eight list screens migrated to the new shape** (`ui/src/pages/manage/{MatchList,PlayerList,TeamDirectory,SponsorList,LeagueList,TeamList,ClubContactList,SeasonList}.tsx`): each screen's "Add X" `Button` moves from `ListToolbar`'s `createLabel`/`onCreate` into `ManageScreenHeader`'s new `action` prop; `MatchList`/`PlayerList`/`TeamDirectory` (the three with a Section filter) additionally move their `SectionTreeSelect` from its own `maxWidth: 360` row into `ListToolbar`'s new `filters` prop. `MatchList`'s wrapping filter-row container switches from `alpha(primary.main, 0.05)` to `bgcolor: 'background.paper', boxShadow: 1` — matching `RecordCard`'s own already-applied fix for the identical "translucent tint reads as invisible against the gradient page background" problem. `SquadPicker.tsx` needs no direct change — it reuses `MatchList` and inherits the relocation automatically.

**`ui/src/pages/manage/MatchList.tsx`**: the "Communicate Team Sheet" `secondaryActions` entry's `label` changes to `"Team Sheet"`. `onClick`/`icon`/dialog behaviour unchanged.

**`docs/standards/frontend.md`**: gains a new "List screen layout" section documenting this three-piece shape (`ManageScreenHeader` + `ListToolbar` + record list) as the required pattern for every current and future `/manage` list screen — see that section for the exact wording committed.

Mobile-first: every new/relocated control (header `action`, `ListToolbar.filters`, the paired View/Edit buttons) verified at 375px — `action` stacks below the title, `filters` gets its own full-width row, View+Edit both fit in the card footer without wrapping.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit/Component | `RecordCard.test.tsx` — the pre-existing test asserting Edit is suppressed when `viewTo` is set alongside `editTo` is **replaced** with one asserting both render together (in order: View, then Edit); a `viewTo`-only (no `editTo`) case still renders View alone, unchanged. `ListToolbar.test.tsx` — `filters` renders inline when passed and is absent otherwise; the Create button is absent when `createLabel`/`onCreate` are both omitted. `ManageScreenHeader.test.tsx` — `action` renders when passed, absent otherwise, alongside the existing back-link/title assertions. `MatchList.test.tsx` — the existing assertion for a button named "Communicate Team Sheet" updates to "Team Sheet"; new assertions that "Add Match" renders in the header (not the toolbar) and that Edit renders alongside View on a card with both routes. Each of the seven other migrated list screens' existing test files updated for their own "Add X" button's new location (header, not toolbar) — no new test files, existing coverage relocated to match. |
| Contract | None — no endpoint changed. |
| End-to-end | Existing e2e coverage (`ui/e2e/manager-league-management.spec.ts` and others) that clicks any "Add X"/"Team Sheet"-adjacent button by role/name continues to pass unchanged, since accessible names don't change — only DOM position. Spot-checked, not re-authored, since this spec doesn't change any golden path's own sequence of actions. |

## Acceptance Criteria

- Every one of the eight migrated list screens shows its primary "Add X" action top-right next to the page title, not inside the filter/toolbar row.
- `MatchList`, `PlayerList`, and `TeamDirectory`'s Section filter sits inline with Search/Sort on desktop and gets its own full-width row on mobile — no screen has a visibly shorter, disconnected filter row below the toolbar anymore.
- A card with both `viewTo` and `editTo` configured shows both View and Edit in its footer; every other existing `RecordCard` call site's footer is pixel-for-pixel unchanged.
- `MatchList`'s card footer reads "Team Sheet", not "Communicate Team Sheet".
- `docs/standards/frontend.md` documents this three-piece list-screen shape as the required pattern for new screens.
- No backend change, no new dependency, no change to any endpoint or entity.

## Rollout Notes

- **This spec ships as its own PR on top of `029`–`040`** (all already merged) — frontend-only, no backend involvement, no migration.
- **`/admin` screens and `SponsorContactList` are deliberately out of scope**, not forgotten — see Non-goals. Track bringing `/admin` screens onto `ManageScreenHeader` (or an equivalent) as a real, separate future item once that shell's own header story is settled.
- **The View+Edit permission gap is a known, accepted gap** until a real `/manage` permission model exists — see Non-goals for the reasoning (nothing newly reachable, just a saved click). Revisit once that model exists.
- **A human should confirm `docs/roadmap.md` picks up the two still-deferred items** this spec's own Non-goals name (multi-filter `ListToolbar.filters`, `/admin` screens onto a shared header) if they're not already obvious follow-ups from this spec's own text.
