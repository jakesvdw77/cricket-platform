# Plan: 047 — Sponsor Contact List Consistency

## Context

`docs/specs/047-sponsor-contact-list-consistency.md` (draft) closes the one gap `041`, `043`, and `046` each independently stepped around: `SponsorContactList.tsx` still hand-rolls its own back link (no `ManageScreenHeader`, no page title, none of `046`'s header treatment) and still uses `ListToolbar`'s deprecated `sortValue`/`sortOptions`/`onSortChange` `Select` (not `043`'s `sortToggle`/`sortFieldOptions`). The user saw this live and reacted strongly. Every piece of the fix has an exact, shipped precedent — `ClubContactList.tsx` (`ui/src/pages/manage/ClubContactList.tsx`, read in full this session) is structurally the *same* two-sortable-field (Name/Role) screen, already migrated. This plan is a near-literal copy of that file's shape onto `SponsorContactList.tsx`, adjusted only for its sponsor-scoped route params and existing back-link target.

Direct reading confirmed:
- `SponsorContactList.tsx`'s current `SORT_OPTIONS` const (`[{value:'name,asc',label:'Name'},{value:'role,asc',label:'Role'}]`) and its `sort` `useState`/`[field, direction] = sort.split(',')` consuming logic in `visibleContacts`'s `useMemo` are **already byte-identical in shape** to `ClubContactList`'s own `sort` state — only the *control* setting `sort` needs to change, not the state shape or sort logic itself.
- `SponsorContactList.test.tsx` (`ui/src/pages/manage/SponsorContactList.test.tsx`) already exists (9 tests) and has **zero sort-related coverage today** — this is new coverage to add, not a rewrite of existing sort tests.
- Two existing test assertions will keep passing unchanged once the render tree changes, since both target roles/accessible names that `ManageScreenHeader`/its `action` also produce: the back-link test (`getByRole('link', {name: /Back to Sponsor/})`, line ~190) and the Add Contact click (`getByRole('button', {name: 'Add Contact'})`, line ~160) — `ManageScreenHeader`'s back button is a `RouterLink`-backed `MuiButton` (a link role) and its `action` slot renders whatever `Button` is passed (a button role), so neither assertion's query shape needs to change, just confirm they still find their target in the new tree.
- No sponsor name is fetched anywhere in this component (`listSponsorContacts(clubId, sponsorId)` only) — per spec, the title is the static string `"Sponsor Contacts"`, not sponsor-name-aware. Not re-litigated here.

## Files to touch, in order

### 1. `ui/src/pages/manage/SponsorContactList.tsx` (edited)

A near-literal application of `ClubContactList.tsx`'s own shape:
- Add imports: `ManageScreenHeader` from `'../../components/ManageScreenHeader'`, `Button` from `'../../components/Button'`. Remove the now-unused `MuiButton`/`ArrowBackIcon` imports (confirm nothing else in the file still needs them before removing).
- Replace the top-level `SORT_OPTIONS` const with `SORT_FIELD_OPTIONS = [{ value: 'name', label: 'Name' }, { value: 'role', label: 'Role' }]` (matching `ClubContactList.tsx:17-20` exactly, including its docs/specs/043 comment).
- Replace the hand-rolled back-link `MuiButton` (current lines ~128-138) with:
  ```tsx
  <ManageScreenHeader
    title="Sponsor Contacts"
    backTo={`/manage/sponsors/${sponsorId}/edit`}
    backLabel="Back to Sponsor"
    action={<Button onClick={() => navigate(`/manage/sponsors/${sponsorId}/contacts/new`)}>Add Contact</Button>}
  />
  ```
  (same shape as `ClubContactList.tsx:117-120`, with this screen's own sponsor-scoped `backTo`/navigate target — unchanged from today's hand-rolled button's own target).
- `ListToolbar`: remove `createLabel`/`onCreate`; replace `sortValue`/`sortOptions`/`onSortChange` with the `sortToggle`/`sortFieldOptions`/`sortField`/`onSortFieldChange` block, copied verbatim from `ClubContactList.tsx:126-134` (identical shape — both screens sort by the same `name`/`role` field pair).
- No other line changes — `visibleContacts`'s `useMemo`, the `RecordCard` grid, both `EmptyState` branches, loading/error/not-authorized/not-found guards all stay exactly as they are.

### 2. `ui/src/pages/manage/SponsorContactList.test.tsx` (edited)

- Existing 9 tests: run as-is first to confirm the two role-based assertions (back link, Add Contact click) still pass unchanged against the new render tree — per spec's Test Plan, these should need no query changes, only re-verification.
- Add a title-heading assertion: `screen.getByRole('heading', { name: 'Sponsor Contacts' })` is present (closing the "no page title" gap this whole spec exists to fix).
- Add sort coverage mirroring `ClubContactList.test.tsx`'s own two sort tests (read that file's equivalent tests for the exact shape before writing these — not summarized here since test-writer should copy the real, current version, not this plan's paraphrase): direction-toggle click reverses card order and flips the toggle's accessible name; switching the field picker from Name to Role re-sorts by role while the current direction carries over.

## Agent assignment

Frontend-only, one file + its test file, mechanical precedent reuse — no new design decisions per the spec's own framing.

1. **`frontend-builder`** — item 1 only. Brief it explicitly: copy `ClubContactList.tsx`'s `ManageScreenHeader`/`ListToolbar` block shape as closely as possible (read that file first), adjusting only the sponsor-scoped `backTo`/`action` navigation targets — this is not a place to improvise a different shape.
2. **`test-writer`** (after `frontend-builder`) — item 2. Brief it to read `ClubContactList.test.tsx`'s current sort-toggle/sort-field tests directly and mirror their exact assertions/interactions onto `SponsorContactList.test.tsx`'s own fixtures (`makeContact`, the existing `renderList` helper), not reinvent the interaction pattern.

## Flags for your review

None substantive — this is as close to a pure mechanical port as this codebase gets. One small note: the plan removes `MuiButton`/`ArrowBackIcon` imports since they become unused; `frontend-builder` should double-check nothing else in the file still references them before deleting (a two-second grep, not expected to find anything).

## Verification

- `cd ui && npm run build && npm run lint && npm run test -- --run src/pages/manage/SponsorContactList.test.tsx`.
- Manual smoke test on `/manage/sponsors/:id/contacts` at 375px and desktop: title "Sponsor Contacts" visible, header has the white/bordered/shadowed/accented `046` treatment, "Add Contact" sits top-right beside the title, Sort is the icon-toggle + Name/Role field picker (no `Select` dropdown anywhere), back link still goes to the sponsor's edit screen.
