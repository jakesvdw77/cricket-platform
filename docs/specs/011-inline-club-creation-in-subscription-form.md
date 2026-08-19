# 011 — Inline Club Creation from the Subscription Form

**Depends on:** `009-subscriptions.md` (`SubscriptionForm`'s existing Club Autocomplete, which this spec extends), `010-minimal-club-creation.md` (`Club`'s entity/validation contract and `POST /api/v1/platform/clubs`, reused as-is — including the Name→Slug auto-suggest UX this spec's inline fields also use), `docs/standards/design-system.md` (the Record list / create-edit pattern component library this adds one new member to, and the "Modal not yet built" constraint this spec deliberately designs around).
**Status:** draft.

## Problem & Goals

`009`'s `SubscriptionForm` Club picker is pick-existing-only: if the Club a platform admin wants to subscribe doesn't exist yet, they have to abandon the Subscription form, navigate to `010`'s Club Onboarding screen, create the Club there, then navigate back to Subscriptions and start over — re-picking the Product and dates from scratch. This is exactly the common case Subscriptions gets used for (a new club just signed), so the friction lands on the most frequent path, not an edge case.

**Goals**
- A platform admin can create a new `Club` inline, without ever leaving the Subscription form, when the one they need isn't in the picker.
- The new `Club` is not created until the whole Subscription form is actually submitted — an admin who changes their mind or abandons the form leaves no orphan `Club` row behind.
- The inline club-creation UI ships as a genuinely reusable shared component (four-file anatomy, Storybook story, component test), designed through the full Claude Design → `design-token-sync` flow — the same process `008-product-catalog.md`'s `ListToolbar`/`RecordCard`/`RecordFormScreen` went through — not a one-off block of markup inside `SubscriptionForm`.
- No Modal/Dialog is introduced. `docs/standards/design-system.md` lists Modal as not yet built, and `008`'s Retire flow already established the precedent of an inline pattern over a dialog for the same reason — this spec follows that precedent rather than building the library's first Modal for a single use.

## Non-goals

- **The Product picker.** Stays pick-only — no user need for "create a new Product from here" has surfaced, and Products are a curated, admin-managed catalog by design (`008`), unlike Clubs which grow one-by-one as real clubs sign up.
- **`010`'s Club Onboarding screens.** `ClubList`/`ClubFormPage` remain the primary, full Club management surface (list, search, edit, suspend/reactivate). This spec is a shortcut for the one specific in-context case — creating a bare Club while setting up its first Subscription — not a replacement.
- **Any change to Club's validation or business rules.** Reuses `010`'s existing `POST /api/v1/platform/clubs` contract exactly as-is — same `@Pattern`/`@Size` slug format, same ADR-04 reserved-word check, same case-insensitive uniqueness check, same immediate `ACTIVE` status on creation. Nothing here redefines what a valid Club is.
- **A generic "pick an existing X or create a new one" abstraction.** The new component is Club-specific. No second consumer of this pattern exists yet in the app (the Product picker doesn't need it — see above); generalizing it is deferred until a real second use case shows up, per `CLAUDE.md`'s "don't design for hypothetical future requirements" principle.
- **Edit mode.** `009` already disables the Club picker entirely once editing an existing Subscription ("you change the Product, not the owner"). Inline creation therefore only ever applies in create mode — the new component's create-affordance has no role to play on the edit screen.
- **Cross-request atomicity between the two creates.** Creating the Club and creating the Subscription are two independent HTTP requests, not one transaction. If Club creation succeeds but Subscription creation then fails, the Club row is **not** rolled back — see API Contract below for why this is accepted behavior, not a defect to fix here.
- **Introducing a create-new affordance anywhere else** (e.g. a similar shortcut on `010`'s own screens, or elsewhere in the admin app). Scoped strictly to this one picker in this one form.
- **Any change to the public `GET /api/v1/public/clubs` endpoint or `004-landing-page.md`'s club search.** `ClubPicker` moves off that endpoint entirely (see API Contract) rather than changing its blank-query behavior — the public, unauthenticated landing page search is untouched by this spec.

## User Stories

- As a platform admin creating a Subscription, if the Club I need isn't found by the picker's search, I can add it inline without leaving the form.
- As a platform admin, after adding a new Club inline, I can keep filling in the rest of the Subscription form (Product, dates) and submit everything together.
- As a platform admin, I can discard an in-progress inline Club (go back to searching, or pick a different existing Club instead) before submitting, with no Club having been created.
- As a platform admin, if the new Club's slug is rejected on submit (reserved word or already taken), I see that specific error against the inline Club fields — not a generic "something went wrong saving this subscription" message — and no Subscription is created.

## Data Model Changes

None. Reuses `Club` (`010-minimal-club-creation.md`) and `Subscription` (`009-subscriptions.md`) exactly as they already exist — no new entity, field, or migration.

## API Contract

No new endpoints, but one existing usage is **swapped**, flagged here rather than silently changed:

| Endpoint | Access | Purpose | When called |
|---|---|---|---|
| `GET /api/v1/platform/clubs` | `platform_admin` | **Replaces** the public `GET /api/v1/public/clubs` that `SubscriptionForm`'s Club Autocomplete uses today. `ClubPicker` renders exclusively inside the authenticated, `platform_admin`-only Subscription form — there's no reason for it to call the public, unauthenticated search endpoint instead of `010`'s own admin list endpoint, which already supports `search`/`sort`/paging. Response is filtered client-side to `status === 'ACTIVE'` (the admin endpoint returns every status, since `010`'s own list screen needs to show suspended clubs too — a Subscription should only ever attach to an `ACTIVE` one). | On focus with no query (`size=10`, default `name` ascending sort — the "show me some clubs" default list), and again on each debounced keystroke using its `search` param (same debounce behavior `SubscriptionForm` already has) |
| `POST /api/v1/platform/clubs` | `platform_admin` | Creates the pending inline Club — same contract as `010` | Only on Subscription form submit, only if the current Club selection is a pending "new" one, and only once |
| `POST /api/v1/platform/subscriptions` | `platform_admin` | Creates the Subscription, using the newly-created Club's `id` as `ownerId` | Immediately after the above succeeds |

**Why not change the public endpoint instead:** `GET /api/v1/public/clubs` deliberately returns nothing for a blank query today (`ClubSearchServiceImpl`), and the same endpoint backs the unauthenticated landing page's "find your club" login search (`004-landing-page.md`). Changing its blank-query behavior to satisfy this spec's "show 10 clubs on focus" request would also change what an anonymous visitor sees on the public landing page, which this spec has no reason to touch. Switching `ClubPicker` onto the already-authenticated `010` admin endpoint gets the desired behavior with zero backend changes and zero blast radius on the public site.

If the `POST /clubs` call fails (400 `ReservedSlugException`, 409 `DuplicateSlugException`, or any other error), the `POST /subscriptions` call is never made and the Subscription is not created — the failure surfaces against the inline Club fields specifically (see UI Requirements). If `POST /clubs` succeeds but the subsequent `POST /subscriptions` call fails for any reason, the created Club is **not** deleted or rolled back: it's now a real, valid Club (indistinguishable from one created directly through `010`'s own screen), and the admin can simply retry creating the Subscription against it — through this same form (now picking it as an existing Club) or through `010`'s screen. Treating this as acceptable avoids adding a compensating-delete step for what should be a rare failure window, and a Club existing without a Subscription yet is already a normal, valid state (`010` doesn't require a Subscription to exist).

## UI Requirements

Composed from the existing `docs/standards/design-system.md` library plus one new shared component, built code-first per the sequencing in Rollout Notes below — pushed to the "Cricket Legend Platform" Claude Design project afterward, once its real shape is settled.

- **New shared component: `ui/src/components/ClubPicker/`** (four-file anatomy per `docs/standards/frontend.md`), replacing the raw Club `Autocomplete` currently inlined in `ui/src/components/SubscriptionForm/SubscriptionForm.tsx`. Controlled component: its value represents either an existing Club (from search) or a pending, not-yet-created Club (local draft state only), or nothing selected.
  - **Search mode** (default): on focus, before any typing, shows up to 10 `ACTIVE` clubs (via `GET /api/v1/platform/clubs?size=10`, default `name` ascending sort, client-filtered to `ACTIVE` — see API Contract) so the admin has something to recognize/pick from immediately rather than facing a blank dropdown. Once they type, the same debounced Autocomplete behavior `SubscriptionForm` already has today re-queries the same endpoint with `search=<query>`, still filtered to `ACTIVE`.
  - **No-results affordance:** when a search (or the default on-focus list) returns no matches, the dropdown offers a single extra option, `+ Add "<query>" as a new club` (using the current search text, or a generic "+ Add a new club" when no query has been typed yet). Selecting it switches the component into create mode.
  - **Create mode:** reveals inline Name/Slug fields in place of (or directly beneath) the search input, reusing `010`'s `ClubForm`-shaped fields and validation: Name pre-filled from the search query that triggered it, Slug auto-suggested from Name the same "suggest until edited" way `ClubForm`/`010` already does, same format hint text. A visible way back to search mode (discarding the draft) is present at all times in create mode.
  - **Error surfacing:** the component accepts an external error (the `POST /clubs` failure's `ProblemDetail.detail` message, same RFC 7807 extraction `SubscriptionFormPage`/`ClubFormPage` already use) and renders it against the inline Slug field specifically, not as a generic banner — a reserved-word or duplicate-slug rejection reads exactly like it does on `010`'s own `ClubForm`.
  - Nothing in this component calls `POST /api/v1/platform/clubs` itself — creation stays owned by the consuming form's submit handler (deferred-creation requirement above), matching the existing convention that shared form components own no mutations (`ProductForm`/`SubscriptionForm`/`ClubForm` all take an `onSubmit` prop rather than calling `useMutation` themselves).
- **`ui/src/components/SubscriptionForm/SubscriptionForm.tsx`** — replaces its inline Club `Autocomplete` block with `<ClubPicker />`, threading its selection (existing-club-id or pending-new-club-draft) into the form's own state. No other field changes.
- **`ui/src/pages/admin/SubscriptionFormPage.tsx`** — its save flow becomes two sequential steps when the current Club selection is a pending draft: `POST /clubs` then `POST /subscriptions`, per API Contract above. A club-creation failure is routed to `ClubPicker`'s error prop (not the page's existing generic save-error banner); a subsequent subscription-creation failure still uses that existing generic banner, unchanged from `009`.
- **Mobile-first**, per `docs/standards/frontend.md` — the inline Name/Slug fields reflow within `RecordFormScreen`'s existing responsive grid, no fixed-width assumptions.

## Test Plan

| Tier | Coverage |
|---|---|
| Component | `ClubPicker.test.tsx`: on focus with no query, requests and renders up to 10 `ACTIVE` clubs from `GET /api/v1/platform/clubs` (a `SUSPENDED`/`ONBOARDING` club in the mocked response is filtered out, not shown); typing re-queries the same endpoint with `search` and still filters to `ACTIVE`; allows selecting an existing club; shows the "+ Add as a new club" option only when the current result set (default list or search) is empty; selecting it reveals Name/Slug fields with Name pre-filled from the query (or blank when triggered from the empty default list) and Slug auto-suggested; discarding the draft returns to search mode with no side effects; an externally-supplied error renders against the Slug field. Storybook story at 375/768/1280 for both modes (search and create), per `docs/standards/design-system.md`. |
| Component | `SubscriptionForm.test.tsx` (extended): renders `ClubPicker` in place of the old inline Autocomplete; the form's submitted value shape correctly distinguishes an existing-club selection from a pending-new-club draft. |
| Component | `SubscriptionFormPage.test.tsx` (extended): submitting with an existing-club selection behaves exactly as `009` already tests (regression check, no behavior change); submitting with a pending-new-club draft calls `createClub` then `createSubscription` in that order with correctly-shaped payloads; a `createClub` rejection prevents `createSubscription` from being called at all and surfaces its message via `ClubPicker`'s error prop; a `createClub` success followed by a `createSubscription` rejection still shows the existing generic subscription-save-error banner, and does **not** attempt to delete the just-created club. |
| E2E | Extends `009`'s existing golden path (Playwright): from `Configuration → Subscriptions → Add Subscription`, search a club name with no existing match, use "+ Add as a new club," fill in the Product and dates, submit, and confirm the new Subscription appears in the list against the newly-created Club. Not wired into CI, same precedent as `005`/`008`/`009`/`010`. |

No backend test changes — no backend code changes in this spec.

## Acceptance Criteria

- A platform admin can create a Subscription for a brand-new Club without navigating away from the Subscription form at any point.
- Focusing the Club picker with no query typed shows up to 10 existing `ACTIVE` clubs immediately, rather than an empty dropdown until the admin starts typing.
- No `Club` row exists in the database unless the Subscription form was actually submitted with that Club selected.
- A rejected new-club slug (reserved word or duplicate) blocks Subscription creation entirely and shows a specific, non-generic error against the inline Club fields.
- The Product picker, `010`'s Club Onboarding screens, and edit-mode Subscription behavior are all unchanged from `009`/`010`.
- No Modal/Dialog component exists in the codebase as a result of this spec.

## Rollout Notes

- Sequencing: build first — `ClubPicker` plus its `SubscriptionForm`/`SubscriptionFormPage` wiring, per this spec's UI Requirements above — then push the finished component (both search and create-mode states) to the "Cricket Legend Platform" Claude Design project via the `design-token-sync` skill afterward, so it doesn't drift out of sync with what's actually shipped. This matches what actually happened with `ListToolbar`/`RecordCard`/`RecordFormScreen` in `008` — added to Claude Design *after* build and manual review, not before — not the design-first order this spec originally stated.
- Ships as its own PR, independent of `010` (already merged) — a pure UX improvement on top of `009`'s existing screen, no dependency ordering issue.
- **Flag for later:** if a second "pick an existing record or create a new one inline" need shows up elsewhere in the app, generalize the pattern `ClubPicker` establishes into a shared abstraction at that point — don't speculatively build that generality now.
