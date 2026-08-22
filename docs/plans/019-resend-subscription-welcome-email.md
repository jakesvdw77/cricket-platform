# Implementation Plan — 019: Resend Subscription Welcome Email

## Context

`017` (merged) sends a Subscription's responsible `Person` a one-time welcome email at creation via `SubscriptionWelcomeEmailService.sendWelcomeEmail(Person, Subscription, Club, Product)`. Its own Non-goals named the exact gap this spec closes: no admin-facing way to trigger that email again if it never arrived, landed in spam, or the admin wants to hand it to the responsible person again during a support conversation. This spec adds a single "Resend welcome email" action to the existing Subscription card in `SubscriptionList.tsx`, calling the already-built service directly — no new email mechanism, no new template, just a second, differently-postured caller. It's also the second half of the user's own immediate practical need (alongside `018`, now merged): resending on demand is a faster way to confirm their real Gmail SMTP settings actually deliver a real business email, without creating a brand-new Subscription each time.

The spec (`docs/specs/019-resend-subscription-welcome-email.md`) is fully resolved with 4 named "Real Architectural Judgment Calls" and complete reasoning for every decision. This plan sequences the work and confirms no drift against the current codebase — nothing about entities, API shapes, or scope is re-decided here.

**Confirmed current state (read directly, no drift found anywhere):**
- `SubscriptionServiceImpl` (`backend/src/main/java/com/cricketlegend/service/impl/SubscriptionServiceImpl.java`) already has exactly the private helpers the spec names — `findOrThrow(UUID)`, `findClubOrThrow(UUID)`, `findProductOrThrow(UUID)`, `findPersonOrThrow(UUID)` — and already depends on `SubscriptionWelcomeEmailService` (injected as the 12th constructor param, used today only by `sendWelcomeEmailBestEffort` inside `create()`). The new `resendWelcomeEmail(UUID id)` method reuses all four helpers and the same `subscriptionWelcomeEmailService` field — no new dependency.
- `update()` (line 247-250) and `cancel()` (line 277-281) both already throw `InvalidStatusTransitionException` for a `CANCELLED`-related conflict, confirming the exact precedent this spec's own status check reuses rather than inventing a new exception.
- `SubscriptionController`/`SubscriptionService` interface both currently expose exactly `create`/`get`/`list`/`update`/`cancel` — `cancel`'s shape (`POST /{id}/cancel`, `@PathVariable UUID id`, no request body, package-neutral `@RestController` with no explicit `@RequestMapping` prefix — the prefix is inlined per-method as `/api/v1/platform/subscriptions...`) is the exact template the new `POST /{id}/resend-welcome-email` endpoint follows.
- `RecordCard` (`ui/src/components/RecordCard/RecordCard.tsx`) currently takes exactly `{ title, badge?, description?, fields?, chips?, editLabel, onEdit?, editTo? }` — confirmed by reading the file and its test suite. `ProductList.tsx` is the only other consumer and passes none of the two new props this spec adds, so the addition is genuinely backward-compatible, not just claimed to be.
- `SubscriptionList.tsx` already renders one `RecordCard` per row inside a `data.content.map(...)`, already has `subscription.status` (`'ACTIVE' | 'CANCELLED'`) available per card — the exact condition needed to show/hide the new action.
- `ui/src/api/subscriptionApi.ts` already has `cancelSubscription(id): Promise<Subscription>` (`POST /platform/subscriptions/{id}/cancel`, no body) as the direct template for the new `resendWelcomeEmail(id): Promise<ResendWelcomeEmailResult>`.
- `SubscriptionControllerIntegrationTest.java` already has `newClub`/`newProduct`/`newSubscription` private test-data helpers and a `cancelActiveSubscriptionTransitionsToCancelledAndKeepsItFetchable` / `cancelOnAlreadyCancelledSubscriptionReturns409` pair — the exact pattern the new resend tests mirror (200/ACTIVE vs 409/CANCELLED).
- `docs/standards/design-system.md`'s Record list pattern confirms `RecordCard` is the mandatory grid unit for any Subscription card — no bespoke row layout is an option here.

## Phase 1 — Backend: DTO (`backend-builder`)

1. `backend/src/main/java/com/cricketlegend/dto/ResendWelcomeEmailResultDto.java` (new) — `record ResendWelcomeEmailResultDto(boolean success, String message, String sentTo)`, the same shape `018`'s `EmailTestSendResultDto` already established for an admin-triggered, visible-failure action.

## Phase 2 — Backend: `SubscriptionService`/`SubscriptionServiceImpl` (`backend-builder`)

Depends on Phase 1.

2. `backend/src/main/java/com/cricketlegend/service/SubscriptionService.java` — add `ResendWelcomeEmailResultDto resendWelcomeEmail(UUID id);` to the interface.
3. `backend/src/main/java/com/cricketlegend/service/impl/SubscriptionServiceImpl.java` — add the implementation: `findOrThrow(id)`, throw `InvalidStatusTransitionException` if `status == CANCELLED` (mirroring `update()`'s own existing check verbatim), otherwise resolve `Club`/`Product`/responsible `Person` via the three existing `findXOrThrow` helpers, call `subscriptionWelcomeEmailService.sendWelcomeEmail(person, subscription, club, product)` inside a try/catch on `EmailDeliveryException` that returns `success:false` with the failure message rather than propagating (the deliberate contrast with `sendWelcomeEmailBestEffort`'s catch-log-swallow — this method must **never** let the exception escape uncaught either, matching `018`'s own `EmailTestSendServiceImpl` contract). On success, return `success:true` with `sentTo` equal to the responsible person's email.

## Phase 3 — Backend: controller + OpenAPI (`backend-builder`)

Depends on Phase 2.

4. `backend/src/main/java/com/cricketlegend/controller/SubscriptionController.java` — add `POST /api/v1/platform/subscriptions/{id}/resend-welcome-email`, no request body, `@PathVariable UUID id`, delegating straight to `subscriptionService.resendWelcomeEmail(id)`, matching the existing `cancel` method's exact shape. No `SecurityConfig` change — already covered by `/api/v1/platform/**`.
5. Regenerate `backend/openapi/openapi.yaml` from the running app once the controller compiles — this spec's diff is expected to be **non-empty** (one new path, one new schema), same as `018`'s own precedent, unlike `017`'s empty diff.

## Phase 4 — Frontend: `RecordCard` extension (`frontend-builder`)

Can run in parallel with Phases 1–3 (the prop shapes are already fully fixed by the spec) — sequence after Phase 3 in practice so the real endpoint exists to smoke-test against once wired up.

6. `ui/src/components/RecordCard/RecordCard.tsx` — add two new, optional props: `secondaryAction?: { label: string; pendingLabel: string; onClick: () => void; pending: boolean }` (rendered in the existing `CardActions` footer, to the left of the Edit action, as a `Button variant="ghost" size="sm"`, disabled and showing `pendingLabel` while `pending`) and `feedback?: { message: string; tone: 'success' | 'error' } | null` (an inline `Typography` — `color: 'success.main'`/`'error.main'`, `variant: 'body2'` — rendered inside `CardContent`, below the existing fields/chips slots, above `CardActions`, only when non-null). Both generic, not Subscription-specific — exactly the spec's own UI Requirements section.
7. `ui/src/components/RecordCard/RecordCard.stories.tsx` — add a story variant demonstrating `secondaryAction`/`feedback`, per `docs/standards/frontend.md`'s four-file anatomy (every shared component's story stays current with its real prop surface).

## Phase 5 — Frontend: API client + `SubscriptionList.tsx` wiring (`frontend-builder`)

Depends on Phase 3 (real endpoint) and Phase 4 (`RecordCard` props).

8. `ui/src/api/subscriptionApi.ts` — add `ResendWelcomeEmailResult` interface (`{ success, message, sentTo }`) and `resendWelcomeEmail(id): Promise<ResendWelcomeEmailResult>` (`POST /platform/subscriptions/${id}/resend-welcome-email`, no body), mirroring `cancelSubscription`'s existing shape exactly.
9. `ui/src/pages/admin/SubscriptionList.tsx` — each card gets its own `useMutation` calling `resendWelcomeEmail(subscription.id)`, with per-card pending/outcome state keyed by subscription id (e.g. a `Record<string, {success,message}|null>` local state) so one card's state never leaks onto another's. Pass `secondaryAction`/`feedback` to `RecordCard` **only when `subscription.status === 'ACTIVE'`** — omitted entirely for a `CANCELLED` card, the UI-side half of the spec's judgment call #2. Label `"Resend welcome email"`, pending label `"Sending…"` (matching `018`'s `EmailSettings.tsx` precedent verbatim). No React Query invalidation of the `['subscriptions', ...]` query — a resend changes no Subscription field.

## Phase 6 — Tests (`test-writer`)

Depends on Phases 1–5 being implemented.

| Tier | File | Coverage |
|---|---|---|
| Unit | `backend/src/test/java/com/cricketlegend/service/SubscriptionServiceImplTest.java` (extended — existing flat package, not `.service.impl`, matching how this file already sits) | `resendWelcomeEmail(id)` on an `ACTIVE` Subscription calls `subscriptionWelcomeEmailService.sendWelcomeEmail(...)` with the current `Club`/`Product`/responsible `Person` and returns `success:true` with `sentTo` equal to that Person's email; on a `CANCELLED` Subscription, throws `InvalidStatusTransitionException` and never calls `sendWelcomeEmail(...)`; a mocked `EmailDeliveryException` from `sendWelcomeEmail(...)` is caught, does **not** propagate, and returns `success:false` with a descriptive message. |
| Unit | `ui/src/components/RecordCard/RecordCard.test.tsx` (extended) | `secondaryAction` renders, is clickable, calls `onClick`, and disables/relabels to `pendingLabel` while `pending`; `feedback` renders the message in the correct colour for each tone; both remain absent, with no regression, when the props are omitted (covering `ProductList`'s existing, unchanged usage — its existing test suite must keep passing unmodified). |
| Integration | `backend/src/test/java/com/cricketlegend/controller/SubscriptionControllerIntegrationTest.java` (extended, reusing its existing `newClub`/`newProduct`/`newSubscription` helpers and `@MockitoBean SubscriptionWelcomeEmailService`) | `POST /{id}/resend-welcome-email` against an `ACTIVE` seeded Subscription → `200`, `success:true`, `sentTo` equal to the seeded responsible person's email; against a `CANCELLED` seeded Subscription → `409`; with the mocked service throwing `EmailDeliveryException` → still `200` (not `5xx`), `success:false`, message describing the failure; a caller without `platform_admin` → `403` (regression against the existing gate). |
| Contract | — | `ResendWelcomeEmailResultDto` and the new endpoint reflected in the regenerated `openapi.yaml` (Phase 3, step 5); every other `SubscriptionDto`/existing-endpoint schema confirmed byte-for-byte unchanged in the diff. |
| Component | `ui/src/pages/admin/SubscriptionList.test.tsx` (extended) | An `ACTIVE` card renders the "Resend welcome email" action; clicking it shows `"Sending…"` while pending, then the returned success message in `success.main`; a mocked failure response renders the error message in `error.main`; a `CANCELLED` card renders no resend action at all. |
| End-to-end | Not CI-wired (manual only, same precedent as `016`/`017`/`018`) | See Verification below. |

## Flags for your review

1. **`SubscriptionServiceImplTest` stays in the flat `com.cricketlegend.service` package** (not `.service.impl`) — this is an *extension* of an existing file already sitting flat, not a new test class, so `017`'s own "newer convention for new classes" doesn't apply here; consistent with how `017` itself extended this same file without relocating it.
2. **This spec's OpenAPI diff is expected to be non-empty**, same as `018`'s (one new path, one new schema) — `backend-builder` must regenerate and commit `openapi.yaml`, not treat an empty diff as the goal.
3. **No `SecurityConfig` change** — confirmed the existing `/api/v1/platform/**` → `hasRole("platform_admin")` rule already covers the new endpoint.
4. **`RecordCard.stories.tsx` update assigned to `frontend-builder`** (component authoring, four-file anatomy), while `RecordCard.test.tsx` assertions are `test-writer`'s (Phase 6) — matching this repo's established split between "ships with the component" (`.tsx`/`.stories.tsx`) and "written in the dedicated test pass" (`.test.tsx`).
5. **No drift found anywhere** between the spec's assumptions and the current codebase — confirmed by directly reading `SubscriptionServiceImpl.java`, `SubscriptionController.java`, `SubscriptionService.java`, `InvalidStatusTransitionException.java`, `RecordCard.tsx`, `RecordCard.test.tsx`, `SubscriptionList.tsx`, `subscriptionApi.ts`, `SubscriptionControllerIntegrationTest.java`, and `docs/standards/design-system.md` directly.

## Verification

1. `cd backend && ./mvnw verify` — full build + unit + Testcontainers integration + ArchUnit + OpenAPI contract diff (expected non-empty, confirmed committed).
2. `cd ui && npm run build && npm run test && npm run lint`.
3. Independently re-run both of the above myself after each builder/test-writer agent reports — a subagent's self-report is not sufficient confirmation on its own, per this session's established practice.
4. **Manual local smoke test, directly useful for the user's own live SMTP debugging**: log in as `platform_admin`, open `/admin/billing`, click "Resend welcome email" on an `ACTIVE` Subscription's card. Confirm the success message renders inline and a real second welcome email arrives (via whatever SMTP provider is currently configured, e.g. the user's own Gmail settings from `018`'s work) with the Subscription's current club/product/dates. Confirm a `CANCELLED` card shows no resend action at all. Force a failure (e.g. temporarily wrong SMTP settings) and confirm a specific, readable error message renders on the card rather than a blank/broken state.
5. Confirm `ProductList.test.tsx`'s existing suite still passes unmodified — the regression check that `RecordCard`'s two new optional props didn't break its only other consumer.
