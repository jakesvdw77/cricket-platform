# Implementation Plan — 018: Email Configuration & Test Send

## Context

`017` (merged to `master`, commit `c314a74`) gave this backend its first outbound SMTP mechanism — `EmailService`/`EmailServiceImpl`, `spring.mail.*`/`app.mail.*` properties, a `SpringTemplateEngine` bean, and the `email/base-layout.html` Thymeleaf fragment — but there is no way for a platform admin to see what it's configured to do or prove it actually works without reading `application.properties`/environment variables directly. This spec closes that gap with a read-only settings view plus a real test-send button, both surfaced from the existing Configuration hub (`007`). It is also the user's own immediate practical need: they are actively debugging a real Gmail SMTP configuration (`smtp.gmail.com`) and want a test-send button rather than having to trigger a real Subscription creation (`017`'s welcome email) every time they want to check whether a setting change worked.

The spec (`docs/specs/018-email-configuration-and-test-send.md`) is fully resolved with 5 named "Real Architectural Judgment Calls" and complete code sketches for every file — this plan sequences that already-fixed content, confirms no drift against the current codebase, and hands each part to the right builder agent. Nothing about entities, API shapes, or scope is re-decided here.

**Confirmed current state (read directly, no drift found anywhere):**
- `SecurityConfig` (`backend/src/main/java/com/cricketlegend/config/SecurityConfig.java:60`) already gates `/api/v1/platform/**` with `hasRole("platform_admin")` — the new `EmailConfigController` needs no `SecurityConfig` change.
- `EmailService`/`EmailServiceImpl`, `EmailDeliveryException`, and the `SpringTemplateEngine` bean (auto-configured by `spring-boot-starter-thymeleaf`) all exist exactly as `017` shipped them — confirmed by reading `EmailServiceImpl.java` and `SubscriptionWelcomeEmailServiceImpl.java` directly. `EmailServiceImpl.send(...)`'s `toName` parameter is confirmed still unused (never passed to `MimeMessageHelper.setTo(...)`) — the spec's own Rollout Notes flag this as a drive-by fix for a future PR, **not fixed by this plan**.
- `ui/src/pages/admin/ConfigurationHome.tsx`'s `CARDS` array currently has exactly 4 entries (`Products`, `Discounts & Promotions`, `Invoicing`, `System Settings`) in that order — the new `Email` card slots in as the 2nd entry, right after `Products`, exactly as the spec specifies.
- `ui/src/App.tsx`'s `configuration` route block (lines 64–72) currently nests `index`/`products`/`products/new`/`products/:id/edit`/`discounts`/`invoicing`/`settings` — the new `email` route slots in after the `products/:id/edit` route, before `discounts`.
- `RecordFormScreen` (`ui/src/components/RecordFormScreen/RecordFormScreen.tsx`) takes exactly `{ title, backTo, backLabel, actions, children }` — matches the spec's `EmailSettings.tsx` sketch with no adjustment needed.
- `Input` (wraps MUI `TextField`, accepts `label`/`value`/`disabled`), `Button` (accepts `variant`/`disabled`/`onClick`), and `EmptyState` (`title`/`description`) all match the spec's sketch exactly — confirmed by reading each component file.
- `MediaUpload.tsx` (`012`) confirms the precedent cited in the spec: a `Button` label swap while an async action is pending (`'Uploading…'`), plus a coloured `Typography` (`error.main`/`text.secondary`) for the outcome — no Alert/Snackbar component exists anywhere in `ui/src`.
- `backend/src/test/java/com/cricketlegend/PlatformRoleJwtPostProcessors.java` provides `platformAdmin(UnaryOperator<Jwt.Builder> claims)` — the exact helper needed to set a custom `email`/`name` claim (for the success path) or omit `email` entirely (for the `400`-no-email-claim path), reused unmodified.
- `EmailServiceImplTest`/`SubscriptionWelcomeEmailServiceImplTest` (`017`) both already landed under `com.cricketlegend.service.impl` — this spec's two new service test classes follow the same, now well-established convention. `SubscriptionControllerIntegrationTest`/7 other controller integration tests all live flat under `com.cricketlegend.controller` — the new `EmailConfigControllerIntegrationTest` follows that.

## Phase 1 — Backend: email template (`backend-builder`)

1. `backend/src/main/resources/templates/email/test-send.html` (new) — exactly the spec's checked-in HTML, composing into `017`'s `email/base-layout.html` via `th:replace="~{email/base-layout :: layout(~{::content})}"`. **Must include the root-tag `th:fragment`/`th:replace` composition correctly** — `017`'s own history (a missing `th:fragment` declaration broke real rendering silently) makes this the one thing to double check by eye, not just by copying.

## Phase 2 — Backend: DTOs (`backend-builder`)

Depends on nothing new — plain records.

2. `backend/src/main/java/com/cricketlegend/dto/EmailSettingsDto.java` (new) — `record EmailSettingsDto(String host, int port, boolean authEnabled, boolean starttlsEnabled, String fromAddress, String fromName, String supportAddress)`, exactly the spec's sketch. Deliberately excludes `username`/`password`.
3. `backend/src/main/java/com/cricketlegend/dto/EmailTestSendResultDto.java` (new) — `record EmailTestSendResultDto(boolean success, String message, String sentTo)`, exactly the spec's sketch.

## Phase 3 — Backend: services (`backend-builder`)

Depends on Phase 1 (template) and Phase 2 (DTOs).

4. `backend/src/main/java/com/cricketlegend/service/EmailSettingsService.java` + `impl/EmailSettingsServiceImpl.java` (new) — constructor-injected `@Value` bindings straight off `spring.mail.host`/`spring.mail.port`/`spring.mail.properties.mail.smtp.auth`/`spring.mail.properties.mail.smtp.starttls.enable`/`app.mail.from-address`/`app.mail.from-name`/`app.mail.support-address`, exactly the spec's sketch. No new property — all seven already exist from `017`.
5. `backend/src/main/java/com/cricketlegend/service/EmailTestSendService.java` + `impl/EmailTestSendServiceImpl.java` (new) — constructor-injected `EmailService`, `SpringTemplateEngine`, `@Value("${app.mail.from-address}")`, `@Value("${app.frontend.base-url}")`. Renders `email/test-send`, calls `EmailService.send(...)`, catches `EmailDeliveryException` and returns `success: false` with the root cause's message rather than letting it propagate — exactly the spec's sketch. **Never throws** — this is the load-bearing contract the controller and every test rely on.

## Phase 4 — Backend: controller (`backend-builder`)

Depends on Phase 3.

6. `backend/src/main/java/com/cricketlegend/controller/EmailConfigController.java` (new) — `@RestController` at `/api/v1/platform/email`, package-private class per the existing skeleton (`docs/standards/backend.md`). `GET /settings` delegates straight to `EmailSettingsService.getSettings()`. `POST /test-send` reads `@AuthenticationPrincipal Jwt jwt`, resolves `email`/`name` claims (same pattern `MeServiceImpl.bridgeByEmail`, `016`, already uses), throws `ValidationException` (400) if `email` is `null`, otherwise delegates to `EmailTestSendService.sendTestEmail(...)`. No `SecurityConfig` change — already covered by the existing `/api/v1/platform/**` gate.
7. Regenerate `backend/openapi/openapi.yaml` from the running app once the controller compiles (`unlike 017`, this spec's diff is expected to be **non-empty** — two brand-new endpoints/DTOs). Commit the regenerated file in the same PR.

## Phase 5 — Frontend: API client (`frontend-builder`)

Can start in parallel with Phase 1–4 once the API contract is fixed (it already is, per the spec) — but sequence after Phase 4 in practice so the real endpoints exist to manually smoke-test against.

8. `ui/src/api/emailApi.ts` (new) — `EmailSettings`/`EmailTestSendResult` interfaces, `getEmailSettings()`/`sendTestEmail()`, exactly the spec's sketch, built on the shared `axiosConfig` instance.

## Phase 6 — Frontend: Configuration hub card, route, and new page (`frontend-builder`)

Depends on Phase 5.

9. `ui/src/pages/admin/ConfigurationHome.tsx` — insert the new `Email` card object into `CARDS`, 2nd position (right after `Products`, before `Discounts & Promotions`), exactly the spec's entry.
10. `ui/src/App.tsx` — insert `<Route path="email" element={<EmailSettings />} />` into the existing `configuration` block, after `products/:id/edit`, before `discounts`; add the `EmailSettings` import alongside the other `pages/admin/*` imports.
11. `ui/src/pages/admin/EmailSettings.tsx` (new page, not a shared component — no four-file anatomy required, but gets its own test per Phase 7) — exactly the spec's sketch: `useQuery` for settings via `RecordFormScreen`'s disabled-field-grid shape, `useMutation` for the test send, `Button` label swap (`'Sending…'`) while pending, coloured `Typography` (`success.main`/`error.main`) for the outcome, `EmptyState` on a failed settings fetch.

## Phase 7 — Tests (`test-writer`)

Depends on Phases 1–6 being implemented.

| Tier | File | Coverage |
|---|---|---|
| Unit | `backend/src/test/java/com/cricketlegend/service/impl/EmailSettingsServiceImplTest.java` (new) | `getSettings()` returns a DTO matching the injected `@Value` bindings exactly; a reflection-based regression test asserts `EmailSettingsDto`'s record components never include anything named `username`/`password`. |
| Unit | `backend/src/test/java/com/cricketlegend/service/impl/EmailTestSendServiceImplTest.java` (new, real `SpringTemplateEngine` + `ClassLoaderTemplateResolver` against the checked-in `test-send.html`, mirroring `SubscriptionWelcomeEmailServiceImplTest`'s own precedent, no Spring context) | Rendered HTML contains substituted `sentAt`/`fromAddress`/`frontendBaseUrl`; mocked `EmailService` success → `success: true`, `sentTo` equals the given `toAddress`, and `EmailService.send(...)` was called with that address; mocked `EmailService` throwing `EmailDeliveryException` is caught (never propagates) and returns `success: false` with a message starting `"Failed to send test email: "` containing the cause's own message. |
| Integration | `backend/src/test/java/com/cricketlegend/controller/EmailConfigControllerIntegrationTest.java` (new, `@MockitoBean EmailService`, mirroring `SubscriptionControllerIntegrationTest`'s own precedent to avoid a real SMTP call in CI; uses `PlatformRoleJwtPostProcessors.platformAdmin(...)`) | `GET /settings` as `platform_admin` → `200` with expected fields; raw JSON body asserted **not** to contain `"username"`/`"password"` anywhere. `POST /test-send` with `platformAdmin(b -> b.claim("email", "...").claim("name", "..."))` and a stubbed successful `EmailService` → `200`, `success: true`, `sentTo` equal to that claim. Same endpoint with `EmailService` throwing `EmailDeliveryException` → still `200`, `success: false`, message containing `"Failed to send test email"`. `platformAdmin()` with **no** `email` claim set → `400`. A caller without `platform_admin` → `403` on both endpoints (regression against the existing `SecurityConfig` gate). |
| Contract | — | `EmailSettingsDto`/`EmailTestSendResultDto` and both endpoints reflected in the regenerated `openapi.yaml` (Phase 4, step 7); reviewer manually confirms the generated `EmailSettingsDto` schema has no `username`/`password` property. |
| Component | `ui/src/pages/admin/EmailSettings.test.tsx` (new) | Renders fetched settings as disabled fields with correct values; clicking "Send test email" shows `'Sending…'`/disables the button while pending, then renders the returned message in `success.main` on success or `error.main` on a `success: false`/network-error outcome. |
| Component | `ui/src/pages/admin/ConfigurationHome.test.tsx` (extended) | `EXPECTED_CARDS` gains `{ title: 'Email', to: '/admin/configuration/email' }` in the 2nd position. |
| End-to-end | Not CI-wired (manual only, same precedent as `016`/`017`) | See Verification below. |

## Flags for your review

1. **`EmailServiceImpl`'s `toName`-never-used bug is confirmed real and deliberately NOT fixed by this plan** — the spec's own Rollout Notes flag it as a drive-by fix for whenever that file is next touched, not in scope here. Flagging again so it isn't mistaken for an oversight.
2. **This spec's OpenAPI diff is expected to be non-empty**, unlike `017`'s (which had no wire-visible change). `backend-builder` must regenerate `openapi.yaml` from the running app and commit it in this PR — don't skip the check just because `017` set a "diff should be empty" precedent; that precedent doesn't apply here.
3. **No `SecurityConfig` change** — confirmed the existing `/api/v1/platform/**` → `hasRole("platform_admin")` rule already covers `/api/v1/platform/email/**` with no edit needed.
4. **Test package placement follows the now-established newer convention** — both new service test classes go under `com.cricketlegend.service.impl` (matching `017`'s own `EmailServiceImplTest`/`SubscriptionWelcomeEmailServiceImplTest`), the new controller test goes flat under `com.cricketlegend.controller` (matching every existing controller integration test, including `017`'s own amended `SubscriptionControllerIntegrationTest`).
5. **No drift found anywhere else** between the spec's assumptions and the current codebase — confirmed by directly reading `SecurityConfig`, `ConfigurationHome.tsx`, `App.tsx`, `RecordFormScreen.tsx`, `Input.tsx`, `Button.tsx`, `EmptyState.tsx`, `MediaUpload.tsx`, `EmailServiceImpl.java`, and `PlatformRoleJwtPostProcessors.java` directly.

## Verification

1. `cd backend && ./mvnw verify` — full build + unit + Testcontainers integration + ArchUnit + OpenAPI contract diff (expected non-empty this time, confirmed committed not just generated).
2. `cd ui && npm run build && npm run test && npm run lint`.
3. Independently re-run both of the above myself after `backend-builder`/`frontend-builder`/`test-writer` report — a subagent's self-report is not sufficient confirmation on its own, per this session's established practice.
4. **Manual local smoke test, directly useful for the user's own live SMTP debugging**: start backend + frontend, log in as `platform_admin`, open Configuration → Email. Confirm the displayed host/port/auth/STARTTLS/from-address/from-name/support-address match whatever `SMTP_HOST`/`SMTP_PORT`/`SMTP_AUTH`/`SMTP_STARTTLS`/etc. env vars are currently set (e.g. the user's own Gmail settings, once corrected to port `587`). Click "Send test email" — confirm either a real email arrives at the admin's own inbox with a success message, or a specific, readable failure message renders inline (this is the button the user will actually use to iterate on their Gmail SMTP settings without touching a Subscription).
5. Confirm via the browser network tab that `GET /api/v1/platform/email/settings`'s raw response body contains no `username`/`password` field anywhere.
