# Implementation Plan — 011: Inline Club Creation from the Subscription Form

## Context

`SubscriptionForm`'s Club picker (`ui/src/components/SubscriptionForm/SubscriptionForm.tsx`) is pick-existing-only today — searching `GET /api/v1/public/clubs` via `searchClubs()`. If the Club doesn't exist yet, the admin has to abandon the Subscription form, create it at `010`'s Club Onboarding screen, then come back and start over. This plan implements `011-inline-club-creation-in-subscription-form.md`: a new `ClubPicker` shared component that adds an inline "create new Club" escape hatch, with creation deferred until the whole Subscription form submits (so an abandoned form leaves no orphan Club row). No backend changes — reuses `010`'s existing `POST /api/v1/platform/clubs` and `GET /api/v1/platform/clubs` endpoints and `009`'s existing `POST /api/v1/platform/subscriptions` as-is. Built code-first, pushed to Claude Design afterward (matching what actually happened with `ListToolbar`/`RecordCard`/`RecordFormScreen` in `008`, not the design-first order the spec originally — incorrectly — stated).

Read in full during planning, confirmed as ground truth: `ui/src/components/SubscriptionForm/SubscriptionForm.tsx`, `ui/src/pages/admin/SubscriptionFormPage.tsx`, `ui/src/api/clubApi.ts`, `ui/src/components/ClubForm/ClubForm.tsx` (the `deriveSlug`/`SLUG_PATTERN` source this plan extracts, and the exact slug-auto-suggest UX `ClubPicker`'s create mode mirrors).

## Flags for your review

1. **Extracting `deriveSlug`/`SLUG_PATTERN` out of `ClubForm.tsx` into a small shared util** (`ui/src/utils/slug.ts`), reused by both `ClubForm.tsx` (updated to import instead of defining locally, no behavior change) and the new `ClubPicker.tsx`. This is a mechanical, mandatory refactor per `docs/standards/frontend.md`'s "two components sharing more than ~70% of logic gets extracted immediately" rule, now that a second consumer needs the exact same derivation — not a redesign of either component's slug logic.
2. **`ClubPicker`'s value shape** — a discriminated union the spec describes behaviorally but doesn't type:
   ```ts
   export type ClubPickerValue =
     | { mode: 'existing'; id: string; name: string }
     | { mode: 'new'; name: string; slug: string }
     | null
   ```
   Controlled component (`value`/`onChange`), matching `ProductForm`/`SubscriptionForm`'s existing "component owns no mutation" convention.
3. **`ClubPicker` is create-mode-only — it never renders in Subscription edit mode.** `009` already disables the Club field entirely once editing (owner is immutable), and the spec's own Non-goals confirm inline creation has no role there. `SubscriptionForm` keeps its current simple disabled `Input` showing the club's name in edit mode, completely unchanged — `ClubPicker` only ever mounts in create mode. This keeps `ClubPicker`'s API narrower (no "disabled/readonly" mode to support).
4. **Club-creation-failure routing mechanism**: the spec requires a club-creation failure to surface against `ClubPicker`'s Slug field, not the page's existing generic banner, and a subscription-creation failure to keep using that generic banner unchanged. Concrete mechanism: `SubscriptionFormPage`'s `saveMutation.mutationFn` catches a `createClub` rejection specifically and re-throws a small local `class ClubCreationError extends Error` carrying the already-`errorDetail()`-extracted message; the render logic checks `saveMutation.error instanceof ClubCreationError` to decide which of the two error UIs shows — they're mutually exclusive, never both.
5. **No-results affordance rendering**: rather than fighting MUI `Autocomplete`'s internal option-list APIs to inject a synthetic "add new" option, `ClubPicker` renders its own plain inline affordance (a `Button`-styled row) below the search `Input` whenever the current (possibly-default) result list is empty and not still loading — simpler and more predictable than a `PaperComponent` override, same "don't fight the library" spirit as `ClubForm`'s plain `Input`-based fields.
6. **Default-on-focus list can return fewer than 10** if some of the `size=10` admin-endpoint page are `SUSPENDED`/`ONBOARDING` and get client-filtered out — not backfilled with a second fetch. Matches the spec's own "up to 10" wording; flagging since it's a real, visible rough edge, not a bug to fix later.

## Frontend — `frontend-builder`

No backend work — this spec has zero backend changes.

1. `ui/src/utils/slug.ts` (new) — `deriveSlug(name: string): string` and `SLUG_PATTERN` moved verbatim from `ClubForm.tsx` (see Flag #1).
2. `ui/src/components/ClubForm/ClubForm.tsx` — updated to import `deriveSlug`/`SLUG_PATTERN` from the new util instead of defining them locally. No behavior change; existing `ClubForm.test.tsx` should pass unmodified.
3. `ui/src/components/ClubPicker/` (new shared component, four-file anatomy per `docs/standards/frontend.md`) — exports `ClubPicker` and the `ClubPickerValue` type (Flag #2).
   - **Search mode** (default): on focus (gated by an internal `hasFocused` flag, not fetched before first interaction), queries `listClubs({ page: 0, size: 10, search: debouncedQuery || undefined, sort: 'name,asc' })` from `ui/src/api/clubApi.ts` — the same debounce pattern (~300ms) `SubscriptionForm`'s old inline Autocomplete already used. Response filtered client-side to `status === 'ACTIVE'` (Flag #6).
   - **No-results affordance** (Flag #5): when the filtered result list is empty and the query isn't still loading, shows `+ Add "<query>" as a new club` (or `+ Add a new club` when the query is blank — the on-focus-with-nothing-typed case). Selecting it switches to create mode.
   - **Create mode**: reveals Name + Slug `Input` fields. Name pre-fills from the search query that triggered create mode (blank if triggered from the empty default list). Slug auto-derives from Name via the new `deriveSlug` until the admin edits Slug directly (identical `slugTouched` pattern to `ClubForm.tsx`), same format hint text and format validation (reusing `SLUG_PATTERN` + the same length check). A "Back to search" action discards the draft and returns to search mode, clearing Name/Slug/`slugTouched`.
   - **`error?: string` prop**: rendered as the Slug field's error text/helper when present (Flag #4) — only ever relevant while already in create mode.
   - Emits `onChange(value)` on every meaningful change: selecting an existing club → `{mode: 'existing', id, name}`; editing Name/Slug while in create mode → `{mode: 'new', name, slug}`; discarding the draft → `null`.
4. `ui/src/components/SubscriptionForm/SubscriptionForm.tsx`:
   - Remove the inline Club `Autocomplete` block and its dedicated state (`clubInputValue`, `debouncedClubQuery`, `selectedClub`, the `searchClubs` query, `CLUB_SEARCH_DEBOUNCE_MS`) — all of that moves into `ClubPicker`.
   - Create mode: render `<ClubPicker value={clubSelection} onChange={setClubSelection} error={clubCreationError} />` in the Club field's grid slot.
   - Edit mode: unchanged — keep today's simple disabled `Input` showing `initialValues.clubLabel` (Flag #3).
   - `SubscriptionFormValues` (the `onSubmit` payload type) gains a `club: SubscriptionClubSelection` field (same discriminated shape as `ClubPickerValue` minus `null`, since submission requires a resolved selection — validated by the existing `validate()` function, extended to require a non-null `clubSelection` in create mode, same as today's `clubId` check). `SubscriptionFormProps` gains an optional `clubCreationError?: string`, threaded straight through to `ClubPicker`.
5. `ui/src/pages/admin/SubscriptionFormPage.tsx`:
   - Local `class ClubCreationError extends Error` (Flag #4).
   - `saveMutation.mutationFn`: in create mode, if `values.club.mode === 'new'`, call `createClub({ name: values.club.name, slug: values.club.slug })` first; on rejection, throw `new ClubCreationError(errorDetail(err, 'Something went wrong adding this club. Please try again.'))`. On success (or if `values.club.mode === 'existing'`), proceed to `createSubscription` exactly as today, using the resolved `ownerId`.
   - Derive `clubCreationError = saveMutation.error instanceof ClubCreationError ? saveMutation.error.message : undefined`, passed to `<SubscriptionForm clubCreationError={clubCreationError} />`.
   - Existing generic banner (`errorDetail(saveMutation.error, 'Something went wrong saving this subscription...')`) only renders when `saveMutation.isError && !(saveMutation.error instanceof ClubCreationError)` — mutually exclusive with the `ClubPicker`-routed error.
6. No `App.tsx` change — no new route, same screen at `/admin/configuration/subscriptions/new`.

## Tests — `test-writer`

Mirrors `ClubForm.test.tsx`/`SubscriptionForm.test.tsx`/`SubscriptionFormPage.test.tsx`'s existing conventions (all frontend-only — no backend test changes, per the spec's own Test Plan).

- `ui/src/components/ClubPicker/ClubPicker.test.tsx` (new) + `.stories.tsx` (375/768/1280, both search and create-mode states) — per the spec's Test Plan: default-10-`ACTIVE`-clubs-on-focus (a `SUSPENDED` club in the mocked response filtered out); typed search re-queries with `search`, still `ACTIVE`-filtered; selecting an existing club; the "+ Add" affordance appears only when results are empty (both the blank-query and typed-query cases, correct label each way); selecting it reveals Name/Slug with correct pre-fill and auto-suggest; discarding the draft returns to search mode with no side effects and clears the draft; an externally-supplied `error` renders against the Slug field.
- `ui/src/utils/slug.test.ts` (new, small) — `deriveSlug` behavior (only if not already fully covered incidentally by `ClubForm.test.tsx`'s existing auto-derive tests; keep minimal, don't duplicate coverage).
- `ui/src/components/SubscriptionForm/SubscriptionForm.test.tsx` — existing Club-selection tests rewritten to drive `ClubPicker` instead of the old raw Autocomplete (search, select, submit-shape assertions now check `values.club`); edit-mode disabled-display test is a light update only (still a plain disabled `Input`, unchanged behavior).
- `ui/src/pages/admin/SubscriptionFormPage.test.tsx` — new tests: submitting with an existing-club selection is unchanged from today (regression check, no `createClub` call); submitting with a pending-new-club draft calls `createClub` then `createSubscription` in order with correctly-shaped payloads; a `createClub` rejection prevents `createSubscription` from being called at all and the message renders against `ClubPicker`'s Slug field, not the generic banner; a `createClub` success followed by a `createSubscription` rejection still shows the existing generic banner (mirroring `009`'s save-error test pattern).
- `ui/e2e/admin-configuration-subscriptions.spec.ts` (extend existing golden path) — add: search a club name with no existing match, use "+ Add as a new club," fill Product/dates, submit, confirm the new Subscription appears against the newly-created Club. Not wired into CI, same precedent as `005`/`008`/`009`/`010`.

## Verification

- `cd ui && npm run lint && npm run test && npm run build` — frontend unit/component tests, type-check, build. No backend verification needed (no backend changes).
- Manual smoke test: `Configuration → Subscriptions → Add Subscription`, focus the Club field and confirm a default list of existing clubs appears with nothing typed, search a non-existent name, use "+ Add as a new club," fill in Product/dates, submit, confirm the new Club and Subscription both appear correctly (Club in `010`'s Club Onboarding list as `Active`, Subscription in the list against it). Also confirm: typing a reserved-word slug into the inline field, then submitting, shows the specific rejection against the Slug field and does not create a Subscription.
- Once the component is verified working, push it to the "Cricket Legend Platform" Claude Design project via the `design-token-sync` skill (both search and create-mode states), per the spec's build-first Rollout Notes.
