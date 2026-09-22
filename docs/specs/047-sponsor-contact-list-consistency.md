# 047 — Sponsor Contact List Consistency

**Depends on:** `041-list-screen-header-actions.md` (built `ManageScreenHeader.action`, the slot this spec moves `SponsorContactList`'s "Add Contact" button into), `043-list-toolbar-gold-standard.md` (built `ListToolbar.sortToggle`/`sortFieldOptions`, with `ClubContactList.tsx` as the exact two-sortable-field worked example this spec copies), `046-header-body-elevation-standard.md` (the white/bordered/shadowed/accented `PageHeaderBand` header treatment `SponsorContactList` has been missing and now inherits for free via `ManageScreenHeader`).
**Status:** draft.

## Problem & Goals

`SponsorContactList.tsx` is the one `/manage` list screen every prior consistency pass has explicitly stepped around: `041`'s Non-goals called it out as having "no `ManageScreenHeader` at all" and left its `ListToolbar`-hosted create button unchanged, `043`'s Non-goals scoped it out for the same reason, and `046`'s Non-goals again left its "hand-rolled back button" untouched as "a pre-existing, separately-flagged gap." The result, confirmed by reading the file directly: it's now the only `/manage` list screen with no page title at all — a direct violation of `docs/standards/design-system.md`'s "every `/manage` screen must render a page title — no exceptions by omission" rule — a hand-rolled plain-text `MuiButton` back link instead of `ManageScreenHeader` (so it never got `046`'s header treatment every other list screen now has), the deprecated `ListToolbar` `sortValue`/`sortOptions`/`onSortChange` `Select` path instead of `043`'s `sortToggle`/`sortFieldOptions` icon-toggle pattern, and `createLabel`/`onCreate` instead of `041`'s `ManageScreenHeader.action` slot.

Every piece of this fix already has an exact, shipped, working precedent elsewhere in the codebase — this spec introduces zero new design decisions. It is a mechanical catch-up applying patterns `041`/`043`/`046` already built and proved, not a new design exploration.

**Goals**
- `SponsorContactList` renders `ManageScreenHeader` (title, back link, `action`) in place of its hand-rolled back button, inheriting `046`'s header treatment automatically.
- `SponsorContactList`'s "Add Contact" button moves from `ListToolbar.createLabel`/`onCreate` to `ManageScreenHeader.action`, matching every other list screen migrated by `041`.
- `SponsorContactList`'s Sort control moves from `ListToolbar`'s `sortValue`/`sortOptions`/`onSortChange` `Select` to `sortToggle` + `sortFieldOptions`/`sortField`/`onSortFieldChange`, mirroring `ClubContactList.tsx`'s exact Name/Role two-field shape byte-for-byte.
- `SponsorContactList` is no longer an exception to any documented `/manage` list-screen pattern — it becomes indistinguishable, structurally, from every other screen in `docs/standards/frontend.md`'s "List screen layout" section.

## Non-goals

- **No backend change.** Purely frontend — same boundary `041`/`043`/`046` all established. No entity, migration, or endpoint is touched.
- **No change to `SponsorContactFormPage.tsx`, `SponsorContactDetailPage.tsx`, `SponsorList.tsx`, or any other screen.** This is the one straggler file's catch-up, not a second sweep of a related screen.
- **No new visual pattern.** Every element used here (`ManageScreenHeader`, its `action` slot, `ListToolbar.sortToggle`/`sortFieldOptions`) already exists and is already tested via `ClubContactList`'s own precedent (`043`). If building this surfaces a need for a genuinely new pattern, that's a signal to stop and flag it, not invent one here.
- **No sponsor-name-aware title.** `SponsorContactList.tsx` fetches contacts via `listSponsorContacts(clubId, sponsorId)` only — no sponsor entity (and therefore no sponsor name) is fetched anywhere in this component or threaded through its route context. Making the title read e.g. "Acme Ltd — Contacts" would require adding a new data fetch, which is exactly the kind of new decision this spec is not scoped to make. The title is the static string `"Sponsor Contacts"` — see UI Requirements.
- **No change to `RecordCard` grid, `EmptyState` variants (no-contacts / no-search-match), or the underlying data-fetching/sort/filter logic.** The `sort` state's `'name,asc' | 'name,desc' | 'role,asc' | 'role,desc'` shape and its `[field, direction] = sort.split(',')` consuming logic are already correct (already support descending) — only the control that sets `sort` changes, not the state shape or the sorting logic itself.

## User Stories

- As a club admin viewing a sponsor's contacts, the screen has a visible page title ("Sponsor Contacts"), matching every other `/manage` list screen instead of being the one screen with none.
- As a club admin, the back link to the sponsor's edit screen renders in the same white/bordered/shadowed/accented header treatment (`046`) every other list screen's back link already has, not a plain hand-rolled text button.
- As a club admin, the "Add Contact" button sits top-right beside the page title, in the same place it already sits on every other migrated list screen (`041`), not inside the toolbar row below.
- As a club admin, I can sort a sponsor's contacts by Name or Role, toggling either between ascending and descending, via the same compact icon-toggle + field-picker `ClubContactList` already uses — not a `Select` that risks clipping at the viewport edge (`043`'s own finding).

## Data Model Changes

None. Purely a frontend, presentational-layer spec — no entity, field, migration, or endpoint changes.

## API Contract

None — no endpoint touched. `listSponsorContacts(clubId, sponsorId)` is called exactly as it is today.

## UI Requirements

**`ui/src/pages/manage/SponsorContactList.tsx`** (existing, edited):

- The hand-rolled back link — the file's own inline `MuiButton` with `ArrowBackIcon`, `variant="text"`, `color="inherit"`, `sx={{ color: 'text.secondary' }}`, targeting `/manage/sponsors/${sponsorId}/edit` with the label "Back to Sponsor" — is removed and replaced by `ManageScreenHeader`, rendered as the first element in the screen's returned `Box`, exactly where `ClubContactList.tsx` renders it:
  - `title`: the static string `"Sponsor Contacts"` (see Non-goals for why this is static, not sponsor-name-aware).
  - `backTo`: `` `/manage/sponsors/${sponsorId}/edit` `` — unchanged target from today's hand-rolled button.
  - `backLabel`: `"Back to Sponsor"` — unchanged copy.
  - `action`: the existing "Add Contact" `Button`, moved here from `ListToolbar`'s `createLabel`/`onCreate` — same `onClick={() => navigate(`/manage/sponsors/${sponsorId}/contacts/new`)}` target, unchanged. Uses `ui/src/components/Button` the same way `ClubContactList.tsx` does (`<Button onClick={...}>Add Contact</Button>`), not a raw `MuiButton`.
- `ListToolbar`'s `createLabel`/`onCreate` props are removed (superseded by `ManageScreenHeader.action`, per `041`).
- `ListToolbar`'s `sortValue`/`sortOptions`/`onSortChange` triplet (backed by the file's own `SORT_OPTIONS` const, currently `[{value:'name,asc',label:'Name'},{value:'role,asc',label:'Role'}]`) is replaced with `sortToggle` + `sortFieldOptions`/`sortField`/`onSortFieldChange`, mirroring `ClubContactList.tsx`'s exact shape:
  - `sortFieldOptions={[{value:'name',label:'Name'},{value:'role',label:'Role'}]}`.
  - `sortToggle={{ value: sort.endsWith(',asc') ? 'asc' : 'desc', ascLabel: `${sort.startsWith('role') ? 'Role' : 'Name'}, A to Z`, descLabel: `${sort.startsWith('role') ? 'Role' : 'Name'}, Z to A`, onToggle: () => setSort(sort.endsWith(',asc') ? `${sort.split(',')[0]},desc` : `${sort.split(',')[0]},asc`) }}`.
  - `sortField={sort.split(',')[0]}`, `onSortFieldChange={(field) => setSort(`${field},${sort.endsWith(',asc') ? 'asc' : 'desc'}`)}`.
  - The `SORT_OPTIONS` const is removed once nothing references it for rendering — the underlying `sort` `useState` and its `[field, direction] = sort.split(',')` consuming logic in `visibleContacts`'s `useMemo` are unchanged.
- No other change: `RecordCard` grid, both `EmptyState` variants (no-contacts / no-search-match), the data-fetching (`useQuery` over `listSponsorContacts`), search state, and sort/filter logic itself are all unchanged.

Mobile-first: verified at 375px — `ManageScreenHeader`'s title/back-link/`action` stacking behaviour and `ListToolbar`'s field-picker + direction-arrow pair are both `ClubContactList`'s own already-proven responsive shape, reused here verbatim, not re-derived.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit/Component | `SponsorContactList.test.tsx` (existing file, extended) — matching `ClubContactList.test.tsx`'s own coverage for the equivalent behaviour: title "Sponsor Contacts" renders as a real `<h1>`/heading (not just visible text); the back link's existing `href` assertion (`/manage/sponsors/test-sponsor-id/edit`) continues to pass now that it renders via `ManageScreenHeader`; a new assertion that "Add Contact" renders in the header and navigates to `/manage/sponsors/${sponsorId}/contacts/new` (the existing test's `onCreate`-driven click assertion is retargeted at the header button, same navigation outcome); new sort-field-switching coverage mirroring `ClubContactList.test.tsx`'s two sort tests — clicking the direction toggle reverses card order and flips its accessible name, and switching the field picker from Name to Role re-sorts by role while the current direction carries over. Existing search/empty-state assertions (no-contacts, no-search-match, error, loading, not-authorized, not-found, no-Deactivate-on-card) are otherwise unaffected and stay in place. |
| Contract | None — no endpoint changed. |
| End-to-end | None new — no existing e2e spec targets this screen specifically; not introduced here, consistent with this being a presentational catch-up, not new golden-path behaviour. |

## Acceptance Criteria

- `SponsorContactList` renders a real page title ("Sponsor Contacts") — no `/manage` screen renders with a missing title by omission anymore.
- The back link renders inside `ManageScreenHeader`/`PageHeaderBand`, showing `046`'s white/bordered/shadowed/accented treatment, not a plain hand-rolled `MuiButton`.
- "Add Contact" renders in `ManageScreenHeader.action`, top-right beside the title, not inside `ListToolbar`.
- Sort renders as `ListToolbar.sortToggle` + `sortFieldOptions` (Name/Role field picker plus a direction toggle), never the `Select` path — matching `ClubContactList`'s exact shape.
- `RecordCard` grid, both `EmptyState` variants, and all data-fetching/search/sort logic are pixel-for-pixel and behaviour-for-behaviour unchanged apart from the control that sets `sort`.
- No backend change, no new dependency, no other screen touched.

## Rollout Notes

- Ships as a single, small PR touching exactly one file plus its test file: `ui/src/pages/manage/SponsorContactList.tsx` and `ui/src/pages/manage/SponsorContactList.test.tsx`. No other screen, component, or shared file is touched — `ManageScreenHeader`, `ListToolbar`, and `PageHeaderBand` are consumed as-is, not modified.
- This closes out the gap `041`, `043`, and `046` each independently deferred — no further "SponsorContactList out of scope" note should appear in any future spec's Non-goals after this ships.
- A human should confirm `docs/roadmap.md` has no stale "SponsorContactList catch-up" entry left open once this merges (a scan of the current file found none, so likely a no-op, but worth a final check at merge time).
