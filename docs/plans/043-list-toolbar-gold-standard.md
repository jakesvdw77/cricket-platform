# Plan: 043 — List Toolbar Gold Standard Rollout

## Context

`docs/specs/043-list-toolbar-gold-standard.md` (approved) generalizes `042-match-list-filters-and-search.md`'s `ListToolbar.sortToggle` icon-button pattern (which fixed a real, screenshot-confirmed layout bug — the Sort `Select`'s fixed 200px width clipping at the viewport edge once a filter is also present) to every other `/manage` list screen: Club Contacts, Club Sponsors, Teams (`TeamDirectory`+`TeamList`), Players, Leagues, Seasons, and Availability Polls. It also adds one small genuinely-new `ListToolbar` capability (a compact sort-field picker, needed only by Club Contacts, which has two sortable fields) and one new shared hook (`usePersistedListFilters`, generalizing `MatchList`'s ad hoc localStorage pattern now that three more screens need it).

Direct reading of every target file (this session, before the spec was written) confirmed:
- Six of the seven screens (`SponsorList`, `LeagueList`, `SeasonList`, `PlayerList`, `TeamDirectory`, `TeamList`) already have a fully-written `direction === 'desc' ? sorted.reverse() : sorted` branch that's simply unreachable today — `SORT_OPTIONS` never offers a `desc` value. This is a UI-wiring change, not new sort logic, for those six.
- `ClubContactList` is the one two-field case (`name,asc|desc` / `role,asc|desc`).
- `TeamDirectory`/`PlayerList` already have a real, backend-driven `sectionId` filter (a genuine re-fetch, `listTeamsForClub`/`listPlayers` called with the new `sectionId`) — nothing to add there except persistence.
- `AvailabilityPollsDashboard` has no `ListToolbar` at all today (`034`'s own explicit "no ListToolbar" call) — a bare `SectionTreeSelect` in a standalone `Box`, no Search, no Sort. This spec migrates it onto `ListToolbar` for the first time.
- None of these seven screens' backend endpoints are paginated (`teamApi.ts`/`playerApi.ts`/`leagueApi.ts`/`seasonApi.ts`/`sponsorApi.ts`/`clubContactApi.ts` all return plain arrays, not `Page<T>`) — confirming the spec's own Non-goal that Search stays client-side everywhere in this rollout, unlike Match.
- The closest existing precedent for a small `IconButton` + `Menu` picker (needed for the new sort-field picker) is `ui/src/components/AvatarMenu/AvatarMenu.tsx` — `useState<HTMLElement | null>` anchorEl, `IconButton onClick` opens it, `Menu anchorEl open onClose` + `MenuItem`s, `handleClose()` on each selection. The new field-picker reuses this exact shape, not a new pattern.
- `ui/src/hooks/` does not exist yet — this plan's new hook is the first file in that directory (analogous to `042` introducing `localStorage`/`Specification`/`freeSolo` as first-of-kind patterns, each flagged explicitly rather than silently invented).

## Files to touch, in order

### 1. `ui/src/components/ListToolbar/ListToolbar.tsx` (edited) — the only shared-component change

Add three new optional props, used together or not at all, layered onto the existing `sortToggle`:
```ts
sortFieldOptions?: { value: string; label: string }[]
sortField?: string
onSortFieldChange?: (value: string) => void
```
Render the field-picker only when `sortToggle` is present **and** `sortFieldOptions` has more than one entry — an `IconButton` (reuse `AvatarMenu`'s anchor/`Menu`/`MenuItem`/`handleClose` shape verbatim, not a new state-management pattern) showing the current field's short label (e.g. via a small `Typography` next to the button, or as the button's own tooltip/aria-label — decide exact visual during build, but it must stay meaningfully narrower than the old 200px `Select`), positioned immediately before `sortToggle`'s own arrow `IconButton` in the same trailing flex `Box`. Every other prop/rendering path (`sortValue`/`sortOptions`/`onSortChange`, the plain `sortToggle`-only five-screen case) stays byte-for-byte unchanged — confirmed by not touching that code at all, only adding a new conditional block.

### 2. `ui/src/hooks/usePersistedListFilters.ts` (new — first file in a new directory)

```ts
export function usePersistedListFilters<T extends Record<string, unknown>>(
  storageKey: string,
  defaults: T,
): [T, (next: Partial<T>) => void]
```
- On mount: `try { const raw = localStorage.getItem(storageKey); if (raw) setState({ ...defaults, ...JSON.parse(raw) }) } catch { /* ignore, keep defaults */ }`
- On every `setState` call from the returned setter: merge into current state, then `try { localStorage.setItem(storageKey, JSON.stringify(merged)) } catch { /* ignore */ }`
- Same "every access wrapped in its own `try/catch`, silent fallback" shape `MatchList.tsx` already established in `042` — this hook is a straight extraction of that logic generalized to an arbitrary `T`, not a new design.
- `search` is never part of `T` for any caller in this rollout — enforced by convention (every caller keeps `search` as its own separate, non-persisted `useState`), not by the hook itself refusing a `search` key.

### 3. `ui/src/hooks/usePersistedListFilters.test.ts` (new)

Round-trip (set → simulate remount by calling the hook again with a fresh `renderHook` → still applied), silent fallback to `defaults` on missing key / corrupt JSON / a `localStorage` that throws (mock `Storage.prototype.getItem`/`setItem` to throw, confirm no crash and defaults win).

### 4. Six single-field screens migrated onto `sortToggle` (mechanical, same shape each time)

`ui/src/pages/manage/SponsorList.tsx`, `LeagueList.tsx`, `SeasonList.tsx`, `PlayerList.tsx`, `TeamDirectory.tsx`, `TeamList.tsx`:
- Remove `SORT_OPTIONS`; replace the `ListToolbar`'s `sortValue`/`sortOptions`/`onSortChange` props with:
  ```tsx
  sortToggle={{
    value: sort.endsWith(',asc') ? 'asc' : 'desc',
    ascLabel: '<Field>, A to Z',
    descLabel: '<Field>, Z to A',
    onToggle: () => setSort(sort.endsWith(',asc') ? '<field>,desc' : '<field>,asc'),
  }}
  ```
  Field per screen: `name` (Sponsor, Team×2, Player), `name` (League — sorts by league name), `label` (Season). The existing `sort` `useState<string>` and its consuming `direction === 'desc' ? sorted.reverse() : sorted` logic are untouched — only the control that sets `sort` changes.

### 5. `ui/src/pages/manage/ClubContactList.tsx` (edited — the two-field case)

Replace `sortValue`/`sortOptions`/`onSortChange` with both `sortToggle` (direction of whichever field is currently active — derive from `sort.endsWith(',asc')` same as above) **and** the new triplet:
```tsx
sortFieldOptions={[{ value: 'name', label: 'Name' }, { value: 'role', label: 'Role' }]}
sortField={sort.split(',')[0]}
onSortFieldChange={(field) => setSort(`${field},${sort.endsWith(',asc') ? 'asc' : 'desc'}`)}
```
`sort`'s existing `'name,asc' | 'name,desc' | 'role,asc' | 'role,desc'` shape and its `[field, direction] = sort.split(',')` consuming logic are unchanged.

### 6. `ui/src/pages/manage/TeamDirectory.tsx` and `PlayerList.tsx` (edited — filter persistence)

Wrap the existing `sectionId` state in `usePersistedListFilters('teamDirectory:filters:${clubId}', { sectionId: null })` / `usePersistedListFilters('playerList:filters:${clubId}', { sectionId: null })` respectively — same pattern `MatchList.tsx` already uses for its own three filters, generalized via the new hook. `search` stays a plain, separate, non-persisted `useState` exactly as today.

### 7. `ui/src/pages/manage/AvailabilityPollsDashboard.tsx` (edited — the one screen gaining real capability)

- Add `search` (`useState`, new) and filter its `polls` list client-side on the resolved home/away team names (reuse the existing `sideDisplayName` helper already in this file — no new resolution logic).
- Add a `sortToggle` over `matchDate` (ascending default, soonest-first — mirroring `042`'s own default-ascending convention for Match), client-side sort since `listOpenPolls` is unpaginated.
- Move the existing bare `SectionTreeSelect` (currently in its own `Box sx={{maxWidth:360}}`) into a real `ListToolbar`'s `filters` slot, wired through `usePersistedListFilters('availabilityPolls:filters:${clubId}', { sectionId: null })`.
- No `createLabel`/`onCreate`, no `ManageScreenHeader.action` — this screen still has no create action of its own (per spec's Non-goals).

### 8. `docs/standards/frontend.md` (edited — documents the finished pattern)

Extend the existing "List screen layout" section (added by `041`) with: every list screen's Sort uses `ListToolbar.sortToggle` (the `sortFieldOptions` variant when more than one field is sortable) — never the `sortValue`/`sortOptions` `Select` path for a new screen; any filter backed by a real server-side query param persists via `usePersistedListFilters`. Point at `043` and `042` as the worked examples, matching how that section already points at `041` for the header/filter-slot shape.

## Agent assignment

Frontend-only spec, no backend involvement (confirmed in spec's Data Model Changes / API Contract — both "None").

1. **`frontend-builder`** — items 1–7 (the shared component, the new hook, and all seven page migrations). One dispatch is enough; brief it explicitly on: (a) reuse `AvatarMenu.tsx`'s exact `IconButton`+`Menu`+anchorEl shape for the new sort-field picker, not a new pattern, (b) the six single-field screens' `desc` logic already exists and works — this is a control swap, verify by actually exercising descending sort in each screen's own test after the change, not just visually, (c) `usePersistedListFilters`'s `search` exclusion is a convention every caller must follow (keep `search` as its own separate `useState`), not something the hook enforces itself.
2. **`test-writer`** (after `frontend-builder`) — compares `043`'s own Test Plan table against what's on disk, fills any gaps: `ListToolbar.test.tsx`'s new `sortFieldOptions` cases, the new `usePersistedListFilters.test.ts` (if `frontend-builder` didn't already write a thorough one per item 3 above), each of the seven migrated screens' existing test files updated for the icon-toggle (including exercising the previously-dead descending branch for real), `ClubContactList.test.tsx`'s field-picker case, `TeamDirectory.test.tsx`/`PlayerList.test.tsx`/new `AvailabilityPollsDashboard.test.tsx` persistence round-trip cases.

## Flags for your review

- **The sort-field-picker's exact visual treatment (item 1) is deliberately left to build time** — the spec and this plan fix the *contract* (`sortFieldOptions`/`sortField`/`onSortFieldChange`, `AvatarMenu`'s interaction shape) but not the exact pixel layout of "current field's short label next to the arrow." Reasonable per this repo's own established granularity (`042`'s plan left the same kind of visual detail to build time), but flagging since it's the one genuinely new piece of UI in this rollout.
- **`AvailabilityPollsDashboard`'s new Search is a small scope addition beyond a pure control-swap** — every other screen in this rollout keeps its exact existing Search semantics; this is the one screen gaining Search from nothing. The spec's own UI Requirements already call this out explicitly (reusing `sideDisplayName`, no new resolution logic), so this isn't a plan-level reinterpretation, just restating it here since it's the one place this rollout does slightly more than "swap the Sort control."
- **`usePersistedListFilters` is a new codebase pattern** (first file in a new `ui/src/hooks/` directory) — same "flag it, don't silently invent a convention" treatment `042` gave `localStorage`/`Specification`/`freeSolo` the first time each appeared. Recommend proceeding (the spec already calls for it, reasoning is solid — three more callers is a real "rule of three-plus" trigger), just flagging per this repo's established practice of naming every first-of-kind pattern explicitly.

## Verification

- Frontend: `cd ui && npm run build && npm run lint && npm run test && npm run test:storybook`.
- Manual smoke test (`claude-in-chrome`) at 375px and desktop widths on at least `TeamDirectory` (has a filter, most likely to still clip if the fix is wrong) and `ClubContactList` (the field-picker): confirm Sort never clips or overlaps another control; toggle direction and confirm the list actually re-orders (proving the previously-dead `desc` branch really fires); on `ClubContactList`, switch the sort field and confirm direction carries over; reload `TeamDirectory`/`PlayerList`/`AvailabilityPollsDashboard` after picking a Section filter and confirm it's still applied, and confirm Search is empty on reload (never persisted).
