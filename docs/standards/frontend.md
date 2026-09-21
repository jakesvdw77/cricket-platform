# Frontend Standards

Component anatomy, styling, state, and mobile-first — none of which the original Cricket Legend UI had consistently from day one. See `CLAUDE.md` for the principles this exists to serve.

## Component anatomy (one shape, no exceptions)

```
components/match/ScorecardCaptureTab/
├── ScorecardCaptureTab.tsx
├── ScorecardCaptureTab.test.tsx     // Testing Library, required
├── ScorecardCaptureTab.stories.tsx  // Storybook, required
└── index.ts                         // re-export only
```

A CI script fails the build if any component folder is missing its test or story file. `pages/**` compose from `components/**` and don't need this anatomy themselves — they're not reusable.

## Rules

- **UI library: Material UI (MUI) v5, always.** Every component in `components/**` is built from `@mui/material` primitives, styled through the shared MUI theme (`ui/src/theme.ts`) — never a competing library, never unstyled HTML with hand-rolled CSS. This carries forward the original Cricket Legend app's stack (`@mui/material` + `@mui/icons-material` v5, `createTheme`) rather than reinventing it. See "Styling" below for exactly how.
- **Reuse check comes first.** Before a new component is scaffolded, search `components/**` and `docs/standards/design-system.md` for one that already covers the need. A near-miss is extended with a prop or variant, not copy-pasted under a new name. Two components sharing more than roughly 70% of their markup or logic is the signal to extract a shared component immediately, not "in a follow-up."
- **Mobile-first.** Every component is authored at a 375px viewport first; breakpoints are added upward using MUI's `sx` breakpoint syntax (`{ xs: ..., md: ... }`) or `useMediaQuery`. No component may assume ≥1024px unless `design-system.md` explicitly marks it desktop-only (e.g. an admin data grid).
- **Styling.** MUI's `sx` prop and theme (`palette`/`typography`/`shape`/`spacing`), or `styled()` for anything reused across many instances. No raw hex values outside `theme.ts`, no competing CSS system (no Tailwind, no CSS modules, no styled-components) — one styling mechanism, not two fighting each other.
- **State.** Server state through React Query over `ui/src/api/*` (one file per backend resource, built on the shared axios instance in `ui/src/api/axiosConfig.ts` — don't call axios/fetch directly from components). Local UI state via `useState`/`useReducer`. No new global state library without a spec decision first.
- **Pagination is never client-side.** Never fetch an entire backend collection and paginate or slice it in the browser — that's exactly the memory/scalability risk `docs/standards/backend.md`'s matching rule keeps off the server by pushing it onto every client instead. A paginated list consumes the backend's `page`/`size` (or cursor) params directly, via `useQuery` keyed on the current page or `useInfiniteQuery` for cursor-based loading — never a client-side `.slice()` over a full result set.
- **Accessibility.** Every interactive element keyboard-reachable; every form input has a label — MUI's `TextField`/`FormControl` wire this up correctly by default, don't bypass it with a bare `<input>`. Colour contrast checked once at the token stage, not re-litigated per screen.

## List screen layout (required shape for every `/manage` list screen)

Every list screen (`ProductList` down through `MatchList`, `PlayerList`, `SponsorList`, etc.) composes from the same three pieces, in this order — a new list screen follows this shape rather than inventing its own:

1. **`ManageScreenHeader`** — title (+ back link). Its own primary "create" action (e.g. "Add Match", "Add Player") renders via the `action` prop, top-right alongside the title — not inside the toolbar row below. `action` takes any `ReactNode`, typically a single `Button`.
2. **`ListToolbar`** — search (flexes to fill), an optional single extra filter control via the `filters` prop (e.g. a `SectionTreeSelect`, rendered inline with search/sort on desktop, its own full-width row on mobile), and sort. `createLabel`/`onCreate` are deprecated on this component — new screens use `ManageScreenHeader`'s `action` instead; existing screens have all been migrated. `ListToolbar` renders its own bordered, shadowed `background.paper` surface (`docs/specs/043-list-toolbar-gold-standard.md`) — a caller never wraps it in its own card `Box`; every list screen gets the same surface automatically just by rendering `ListToolbar`.
3. The record list itself (a grid/stack of `RecordCard`s, or an `EmptyState`).

A screen with more than one filter control still uses `ListToolbar.filters` for the single most important one; anything beyond that is a case for extending `filters` to accept more than one control, not stacking ad-hoc `Box`es under the toolbar.

**Sort is always `ListToolbar.sortToggle`, never the `sortValue`/`sortOptions` `Select` path, for a new screen.** The `Select` clips at the viewport edge once a filter (or a narrow enough viewport) is also present — real, screenshot-confirmed (`docs/specs/042-match-list-filters-and-search.md`) — and stays on the component only for a caller with a genuine reason to need a full dropdown (e.g. more than a small handful of sortable fields), not as a default. A screen sorting by exactly one field passes `sortToggle` (`value`/`ascLabel`/`descLabel`/`onToggle`, a single icon button toggling ascending/descending). A screen sorting by more than one field (so far only `ClubContactList`, Name/Role) additionally passes `sortFieldOptions`/`sortField`/`onSortFieldChange` — a compact field picker layered in front of `sortToggle`'s own arrow, not a second `Select`. `042` and `043` (`docs/specs/043-list-toolbar-gold-standard.md`) are the worked examples for both shapes.

**Any filter backed by a real, server-side query param persists via `ui/src/hooks/usePersistedListFilters`.** `MatchList`'s Section/League/Season filters, `TeamDirectory`'s and `PlayerList`'s Section filter, and `AvailabilityPollsDashboard`'s Section filter all reapply on return to the screen rather than silently resetting — `usePersistedListFilters(storageKey, defaults)` wraps every `localStorage` read/write in its own `try/catch`, falling back to `defaults` on a missing key, corrupt JSON, or unavailable storage. `search` is never passed through this hook for any screen — it stays its own separate, non-persisted `useState`, exactly as `MatchList` established in `042`. A purely client-side filter (nothing re-fetched from the backend) has no persistence obligation.

## Folder structure

```
ui/src/
├── api/          # one file per backend resource, built on axiosConfig
├── auth/         # keycloak-js client config — see docs/specs/002-realm-subdomain-auth.md
├── components/   # shared, reusable — the four-file anatomy above
├── pages/
│   ├── admin/    # platform/club-admin-only screens
│   ├── manage/   # club/team manager screens
│   └── view/     # read-only, available to all authenticated or public users
└── test/         # vitest setup
```

## Enforcement

- **dependency-cruiser rule** — `components/**` may not import from `pages/**`; `api/**` is the only place axios is imported.
- **Folder-shape check** — CI fails if a component folder is missing its test or story file.
- **Duplicate-code scan** (jscpd) — same rule as backend, applied to TS/TSX.

## Testing tiers (see `docs/standards/testing.md`)

- **Unit/Component** — Vitest + Testing Library (`ui/src/test/setup.ts` wires `@testing-library/jest-dom`).
- **E2E** — Playwright, golden paths only, mobile + desktop viewport.
