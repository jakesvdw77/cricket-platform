# 106: Match Results: Anthropic AI Adaptor (bring your own key)

**Depends on:** `104-match-results-import-adaptors.md` (the adaptor framework, the common import format, the Result Processor, the import wizard; this spec adds one adaptor and one generic mechanism to it)
**Status:** draft, written 2026-10-16 from the user's decisions. **Not approved. Do not build until the legal questions below are answered by the user's lawyer and the user approves.**

## Problem & Goals

The JSON adaptor (`104`) asks a manager to convert a scorecard to JSON in their own AI chat and paste the result back. That works but is manual, and it only suits people who already use an AI tool. The user wants an adaptor that does the conversion for them: the manager gives a file or pastes text, supplies their own Anthropic API key, and our server sends the content to Claude with the same conversion prompt the JSON adaptor already offers, then turns the reply into the common import format. From there everything is unchanged: the preview, the team and player matching, the guess flags, the explicit confirm, the draft that is never published.

This reverses the first revision's "no AI" rule (`104`, "Deferred: AI tier"), in a narrower form: **the AI only converts a file to the common format; it never matches names to players** (that stays deterministic and local), and it is used only with the manager's own key and an explicit consent.

Goals:

- **One new adaptor, `ANTHROPIC`**, accepting a CSV, a PDF or plain text (uploaded or, for text formats, pasted).
- **A standard "credentials" mechanism** so any adaptor can declare the secrets it needs and the Source step draws the fields generically. Later integrations (other providers, a commercial module that stores keys per club) reuse it with no UI rewrite.
- **No key is ever stored** in this version. It is used for one call and discarded.
- **The same safety as every import:** the reply is validated like any other document, shown in the preview, and only a person confirming creates a draft.

## Non-goals

- **Storing keys, or linking an adaptor to a club's commercial module.** Later. The credentials mechanism is designed so a stored key can replace the typed one without changing the adaptor.
- **Per-club enablement or billing.** For now any club manager sees the adaptor. A server setting switches it off everywhere (see Rollout).
- **Name matching by AI.** Unchanged from `104`: deterministic only.
- **Excel, images, several files at once, streaming and background jobs.** Excel is not readable by Claude directly. Streaming or a background job is the first thing to add if conversions prove too slow (see Risks).
- **Other providers.** The framework allows them; none is built here.
- **Usage tracking or cost display.** The call is charged to the manager's own Anthropic account.

## User Stories

- As a club manager, I can choose "Anthropic AI (your own key)" as the source, upload a CSV or PDF or paste text, enter my own Anthropic API key and tick that I am allowed to send the content, so that the scorecard is converted for me without leaving the platform.
- As a club manager, I see that the key is used once and is not saved, so that I know it is safe to paste.
- As a club manager, I see clear messages when the key is rejected, my Anthropic account has no credit, the service is busy, or the answer could not be read, so that I know what to do next.
- As a club manager, the converted result goes through the same preview and confirm steps as any import, so that nothing is created without my say.
- As the operator, I can switch the adaptor off with one setting, so that I can stop it without a release.
- As a developer, I can add another adaptor that needs a secret by declaring it, so that no screen has to be written for it.

## Data Model Changes

**None.** No table or column changes. No key, file content or AI answer is stored. An imported draft records `source = IMPORT:ANTHROPIC` and no `external_id`, because an AI-read provider id is not reliable enough to deduplicate on; re-importing onto a match that already has a draft uses the existing "replace the existing draft" tick.

## API Contract

Additive changes only.

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/manage/clubs/{clubId}/results/import/adaptors` | club manager | The catalogue now lists `ANTHROPIC` (when enabled) and each descriptor gains `credentials[]` (empty for JSON). |
| `POST .../results/import/preview` | club manager | The multipart `request` part gains `credentials` (a map of credential name to value, write-only) and `aiConsent` (boolean). Everything else is as in `104`. |

**Descriptor additions.** `AdaptorDescriptorDto.credentials: CredentialSpecDto[{name, label, kind, help}]` where `kind` is `SECRET` (the only kind now). For `ANTHROPIC`: one credential, `name = "apiKey"`, `label = "Anthropic API key"`, `help = "Create a key in the Anthropic Console. It is used for this one conversion and is not saved."`. `AdaptorDescriptorDto` also gains `requiresAiConsent: boolean` (true for `ANTHROPIC`). `aiAllowed` becomes true for it.

**Formats.** `ImportInputFormat` gains `TEXT` (text-based, `.txt`, pasteable). `ANTHROPIC` accepts `CSV`, `PDF` and `TEXT`. Size limits are the existing ones (text 2 MB, PDF 5 MB, paste 1,000,000 characters).

**Request rules.** The preview is refused (400, `ImportInputValidationException` with path `credentials.apiKey` or `aiConsent`) when a required credential is missing or blank, or when the adaptor requires consent and `aiConsent` is not true. The server enforces this; the UI tick is not trusted. The credentials map is `writeOnly` in the OpenAPI schema and `format: password`.

**New errors (mapped in `GlobalExceptionHandler`, no new base type):**

| Situation | Status | Meaning for the manager |
|---|---|---|
| Anthropic rejects the key (401 or 403) | 400, code `AI_KEY_REJECTED` | "Anthropic did not accept that key." |
| No credit or a billing problem | 400, code `AI_ACCOUNT_PROBLEM` | "Your Anthropic account cannot be used right now. Check its credit." |
| Rate limited (429) | 429, code `AI_RATE_LIMITED` | "Anthropic is limiting requests. Try again shortly." |
| Overloaded, 5xx, timeout, no network | 502, code `AI_UNAVAILABLE` | "Claude could not be reached. Try again." |
| The answer was cut off at the length limit | 400, code `AI_ANSWER_TRUNCATED` | "The scorecard is too long to convert in one go." |
| The answer is not a readable result | 400, code `AI_ANSWER_UNREADABLE` | "Claude's answer could not be read as a result." (never echoes the answer) |
| The adaptor is switched off | 404 (not in the catalogue) | The tile is not offered. |

A result that parses but fails the common-format validation is returned as the existing `ImportInputValidationException` list, so the manager sees exactly which values are wrong.

## UI Requirements

Built on the `104` wizard; no new step.

- **Source step.** "Anthropic AI (your own key)" appears as another source tile when the catalogue lists it. Its tabs are Upload file and Paste (Paste only for CSV and TEXT). There is no "Other" prompt tab for this source (the prompt is sent for them).
- **Credentials panel (generic).** Below the tabs, one field per descriptor credential, drawn from `credentials[]`: a masked text field with a show/hide toggle, `autocomplete="off"`, the descriptor's label and help text. It knows nothing about Anthropic. The value is held in React state only: never `localStorage`, `sessionStorage`, the URL or the query cache, and cleared when the wizard closes or the source changes.
- **Consent.** For a source with `requiresAiConsent`, a required tick with this wording (final wording to follow the lawyer's advice): "I am allowed to send this content to Anthropic. It is sent from our server using my key, is not stored by us, and may include players' names." Continue stays disabled until the key is entered and the tick is set.
- **Continue label and progress.** The button reads "Read with Claude"; while the call runs it reads "Reading with Claude..." with a note "This can take a minute or two." The step cannot be left mid-call except by Cancel, which aborts the browser request (the server call may still finish and is still charged to the manager's account; the screen says so).
- **Errors.** The table above maps to `ImportProblemAlert` kinds; a rejected key keeps the file or paste and puts focus on the key field. The key field is never cleared by an error.
- **Accessibility and phone.** 44 px targets, the key field labelled, no horizontal scroll at 375 px, status text announced politely.
- **Reuse.** Extends `SourceStep`, `ImportProblemAlert` and `importErrors.ts`; the credentials panel is a small shared component (`components/CredentialFields`) so other adaptors reuse it.

## Backend design

- **`AnthropicAdaptor extends AbstractAdaptor`** (`AdaptorType.ANTHROPIC`, one `@JsonSubTypes` entry). It reads its content (text for CSV and TEXT, the raw bytes for PDF), calls the client, parses the answer with the existing fence-tolerant JSON parse (shared with `JsonAdaptor`, not copied), clears `source.externalMatchId`, and returns the common format. `AbstractAdaptor.importFrom` still does the format and size checks, the source stamp and the common-format validation.
- **Credentials.** A new `ImportCredentials` value (a map wrapper whose `toString` and serialisation are masked) is passed to the adaptor with each import. `Adaptor` gains `getCredentialSpecs()` (empty by default). The final template method checks that every declared credential is present and non-blank before any network call.
- **The client.** A small `AnthropicMessagesClient` in `service.adaptor` using Spring's `RestClient` (no new library): `POST {base-url}/v1/messages` with `x-api-key`, `anthropic-version: 2023-06-01`, a JSON body (`model`, `max_tokens`, `system` = the conversion prompt, one user message). Text goes as a text block; a PDF goes as a base64 `document` block. A truncated answer is detected from `stop_reason = max_tokens`.
- **One prompt.** The conversion prompt currently built inside `JsonAdaptor` moves to a shared class used by both adaptors, so the manual and the automatic route can never drift.
- **Configuration (new):** `cricketlegend.import.anthropic.enabled` (default true), `.model` (default `claude-sonnet-5-5`), `.max-tokens` (default 16000), `.timeout-seconds` (default 150), `.base-url` (default `https://api.anthropic.com`, overridden in tests). No key setting exists.
- **ArchUnit.** The `service.adaptor` isolation rule (`104`) gains exactly what the client needs (`org.springframework.web.client` and `org.springframework.http`), and a new rule says nothing in the package may log a credential or import a logger into the client's request path.
- **Standards.** `docs/standards/backend.md` gains the credentials rules; `frontend.md` gains the credentials panel.

## Privacy, logging and legal

What the design does, regardless of the legal answer:

- The key is read from the request, used for one call and dropped. It is never persisted, never put in a URL, never logged, never included in an exception message, and masked in `toString`. A test captures the application log during an import and fails if the key, the file text or the answer appears.
- The file content and the answer are never logged and never stored. `source_payload` stays null (`104`).
- Only the content the manager chose is sent. Nothing else about the club, its players or the match is added by us.
- The call needs an explicit consent tick, enforced by the server.
- A prompt-injection line inside a scorecard cannot do anything: the only use of the answer is to parse it as data and validate it.

**Questions for the user's lawyer (not answered by this spec, and I am not a lawyer):**

1. The platform's server transmits children's names (a scorecard) to a third party, Anthropic, on the manager's instruction. Does that make the platform an operator or a responsible party for that transfer under POPIA, even with the manager's own key and consent? Does it need an operator agreement, a notice to parents, or a lawful basis recorded?
2. Cross-border transfer: the content leaves South Africa. Is the manager's consent tick enough, or is a contract or an adequacy basis needed?
3. Anthropic's own terms and retention for API traffic: which apply to the manager's key, and what must we tell the manager?
4. Wording of the consent tick and of the notice on the Source step, and whether a club-level acknowledgement is needed before the option appears.
5. Whether a short privacy-policy and terms-of-use update is needed before any club outside the two testers can see it.

## Test Plan

- **Backend unit.** The client against `MockRestServiceServer` (never the real network, never a real key in CI): a text request, a PDF request, the headers and body shape, a successful answer, a fenced answer, `max_tokens` truncation, a non-JSON answer, and each error status mapped to its exception. `AnthropicAdaptor`: credential and consent checks happen before any call, `externalMatchId` is cleared, the shared prompt is the one sent, the common-format validation still runs. `ImportCredentials` masking.
- **Log safety.** A test attaches a log appender, runs a failing and a successful import with a distinctive key and distinctive names, and asserts none appears in any log line or exception message.
- **Backend integration.** The preview route with the catalogue listing, the descriptor's credentials, a refused request with no key or no consent, and the full path with the client pointed at a mock server through to a draft. The disabled setting removes the adaptor from the catalogue.
- **Architecture.** The adjusted isolation rule and the new no-logging rule, each proven non-vacuous.
- **Frontend.** The credentials panel (masked, toggle, not persisted, cleared on source change), the consent gating of Continue, the progress and Cancel states, every error mapping keeping the input and the key, and the Source step for a source with and without credentials.
- **Manual smoke (not CI).** The user and the tester run one real conversion each with their own keys against a CSV, a PDF and pasted text.
- **E2E.** None against the real service. The existing import golden path is unchanged.

## Acceptance Criteria

- [ ] Legal questions answered and the consent wording approved by the user.
- [ ] The catalogue lists `ANTHROPIC` with its credentials and consent requirement when enabled, and omits it when disabled.
- [ ] A CSV, a PDF and pasted text each convert with a valid key and reach the preview and draft through the unchanged `104` flow.
- [ ] A missing key or missing consent is refused by the server before any call to Anthropic.
- [ ] Each error in the table shows its message and keeps the file, the paste and the key field.
- [ ] No log line, exception message, stored row or URL contains the key, the file text or the answer.
- [ ] The key is not in `localStorage`, `sessionStorage`, the query cache or the URL, and is cleared when the wizard closes.
- [ ] Name matching, guess flags, the confirm step and "never published" behave exactly as in `104`.
- [ ] OpenAPI changes are additive; no new third-party library is added.

## Rollout Notes

- **Visibility now:** any club manager, with the user and one tester using it. `cricketlegend.import.anthropic.enabled=false` removes it for everyone. A later spec replaces this with a per-club link to a commercial module.
- **Risks to watch in the first real use:** (1) **Time.** A long scorecard can take over a minute to convert; the call is synchronous with a 150 second timeout. If real files hit it, the next step is streaming or a background job, in its own spec. (2) **Accuracy.** The model can misread a column. The preview and the deterministic checks (totals, wickets, margin) are the safety net, and the manual confirm is required. (3) **Cost.** Charged to the manager's key.
- **Order of work:** the shared prompt and the credentials mechanism first (JSON adaptor unchanged), then the client and adaptor, then the Source step panel, then tests, docs, review and the PR. Slices ship behind the setting.
- **Docs to update when built:** `docs/standards/backend.md`, `docs/standards/frontend.md`, `docs/architecture.md`, `docs/roadmap.md`, `104`'s Rollout Notes (a pointer to this spec).
- **Deferred (also for `docs/roadmap.md`):** stored keys and the commercial-module link; per-club enablement; streaming or background conversion; Excel and image inputs; other providers; usage display; reading the platform's own AI key from an environment variable for a managed offering.

### Decisions

- **Server-side call** (user, 2026-10-16), not the browser, so the adaptor framework and a later stored key fit together.
- **Visible to any club manager for now** (user, 2026-10-16); only the user and a tester will use it.
- **Formats:** CSV, PDF and text (user, 2026-10-16). No Excel.
- **Model:** Sonnet, `claude-sonnet-5-5` by default and configurable (user, 2026-10-16).
- **The AI converts only.** Matching names to players stays deterministic and local.
- **No stored key in version 1.**
