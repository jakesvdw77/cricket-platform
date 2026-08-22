# 018 - Email Configuration & Test Send

**Depends on:** `017-subscription-welcome-email.md` (`EmailService`/`EmailServiceImpl`, the `spring.mail.*`/`app.mail.*` properties in `application.properties`, the `SpringTemplateEngine` bean and `email/base-layout.html` Thymeleaf fragment this spec's own test email reuses unmodified, not a bare string), `016-keycloak-account-provisioning.md` (`MeServiceImpl.bridgeByEmail`'s JWT `email`-claim resolution pattern, reused here to resolve "the admin"; and `SecurityConfig`'s confirmed `platform_admin` gate on `/api/v1/platform/**`, unchanged by this spec), `007-configuration-hub-overview.md` (the Configuration hub's card-grid pattern and per-module route convention this spec's new "Email" card and route follow), `012-club-profile.md` (the precedent of a Configuration-hub-adjacent admin screen showing settings, and `MediaUpload`'s inline loading/success/error state pattern this spec's "Send test email" button reuses rather than inventing a new Alert/Snackbar component), `docs/standards/backend.md` (the fixed three-exception status table this spec deliberately does not extend - see Real Architectural Judgment Calls #3).
**Status:** draft.

## Problem & Goals

`017` gave this application's own backend a real SMTP client and a reusable HTML email mechanism, but there is no way for a platform admin to see what that mechanism is actually configured to do, or to prove it works, without reading `application.properties` or the deployed environment's variables directly. If a club's welcome email (`017`) or a future notification silently fails to send, nobody finds out until a customer complains - there's no self-service way for an admin to check "is email even working right now." This spec closes that gap: a read-only view of the platform's current email configuration, plus a one-click test send to the admin's own inbox, both surfaced from the existing Configuration hub (`007`).

**Goals**
- A platform admin can see the platform's current outbound email configuration (host, port, whether authentication/STARTTLS are enabled, from-address, from-name, support-address) from a screen in the Configuration hub, with no server or database access.
- A platform admin can trigger a real test email, sent through the exact same `EmailService`/SMTP path every other email in this codebase already uses, to confirm the configuration actually works end to end, not just that it's present.
- A failed test send is reported back to the admin as a real, visible, specific error - this is a diagnostic action the admin explicitly triggered, not a best-effort side effect of some other business action, so it does not inherit `017`'s or `016`'s catch-log-swallow posture.
- No credential (`spring.mail.password`, or `spring.mail.username`) is ever returned to the frontend or rendered in any UI, in any form, masked or otherwise.

## Non-goals

- **Editing any email setting from the UI.** This screen is read-only. `spring.mail.*`/`app.mail.*` remain `application.properties`/environment-variable configuration, changed by a redeploy - the same posture `016`'s Keycloak admin secret and `017`'s own mail credentials already have today, with no in-app settings-editor anywhere in this codebase yet. A future "System Settings" Configuration-hub module (still unscoped, `docs/roadmap.md`) is the natural home for an eventual settings-editor if one is ever built - not decided or scoped here.
- **Returning `spring.mail.username` or `spring.mail.password` in any form**, including a boolean "is a password configured" flag. See Real Architectural Judgment Calls #1 for why even a boolean is deliberately excluded.
- **A free-text "send to" field, or sending a test email to anyone other than the currently authenticated admin.** See Real Architectural Judgment Calls #2 - this is deliberately not a general-purpose "send an email to any address" tool.
- **Any change to Keycloak's own realm-level SMTP configuration** (`016`'s Realm Settings -> Email, used for `execute-actions-email`). Entirely separate transport, untouched by this spec - this spec is about this application's own `spring.mail.*` mechanism (`017`) only.
- **Any change to `017`'s welcome-email failure posture, or `016`'s Keycloak-provisioning failure posture.** Both stay best-effort/caught-logged-swallowed exactly as shipped. This spec's different, visible-failure posture applies only to the new test-send endpoint below, not retroactively to either existing consumer of `EmailService`.
- **Persisting a record of test sends** - no `EmailTestSendLog` entity, no "last tested at" timestamp, no history screen. Each test send is a stateless, ephemeral diagnostic action; the only durable trace is whatever application logging already captures.
- **Any new Maven dependency or new Spring config property.** This spec reuses `017`'s `spring.mail.*`/`app.mail.*` keys, `EmailService`, and the `SpringTemplateEngine` bean unmodified - see Configuration & Infrastructure Changes.
- **Per-club email settings or branding.** `spring.mail.*`/`app.mail.*` are process-wide configuration, not club-scoped - there is exactly one set of settings to show, matching how `017`'s welcome email is deliberately platform-default-themed only (`017` Non-goals).
- **Extending `docs/standards/backend.md`'s fixed exception-to-HTTP-status table** with a new base exception type for this endpoint. Considered and rejected - see Real Architectural Judgment Calls #3.
- **Multi-language content for the test email.** English copy only, matching `017`'s own precedent.

## User Stories

- As a platform admin, I can view the platform's current outbound email host, port, whether authentication/STARTTLS are enabled, from-address, from-name, and support-address from the Configuration hub, without needing database or server access.
- As a platform admin, I can click "Send test email" and receive a real email at my own login address, confirming the configured SMTP settings actually work, not just that they look correct on screen.
- As a platform admin, if the test send fails, I see a specific, readable reason why (e.g. "Failed to send test email: Connection refused"), not a blank screen, a generic error, or a silently-missing email I have no way to know about.
- As a developer reading `EmailTestSendServiceImpl`, I can see clearly that a failure here is returned to the caller as real data, in contrast with `017`'s welcome email and `016`'s Keycloak provisioning, both of which catch, log, and swallow the same category of failure because they're side effects of an unrelated business action rather than a diagnostic the admin explicitly asked for.
- As anyone without the `platform_admin` role, I cannot view email settings or trigger a test send - both endpoints sit under the existing `/api/v1/platform/**` gate, unchanged.

## Real Architectural Judgment Calls

Resolved explicitly here, not silently assumed - a reviewer should be able to challenge each one on its own terms.

**1. Which settings are safe to show: host, port, `authEnabled`/`starttlsEnabled` booleans, from-address, from-name, support-address - never the username, never the password, and never even a boolean confirming whether a password is set.**
`spring.mail.password` is a live credential; it must never reach the frontend, full stop, masked or not. `spring.mail.username` is excluded too, even though it's typically just an email address rather than a secret, because this endpoint has no legitimate reason to expose it and "no reason to show it" is reason enough not to. The harder call is the suggested middle ground - a `credentialsConfigured: boolean` flag confirming "yes, a password is set" without revealing it. Rejected: the test-send action this same spec builds is already the honest, actionable signal for "does this actually work," and it tells the admin more (whether auth *succeeds*, not just whether a value is present) than a boolean ever could. Adding the boolean anyway would give any `platform_admin` a slightly more detailed picture of this platform's SMTP account posture for zero corresponding diagnostic benefit - not a large risk, but an unforced one, and this spec declines to take it.

**2. "The admin" is always the caller's own JWT `email` claim - never a request-body destination field.**
A free-text "send to" field on this endpoint would turn a diagnostic screen into a generic "send an email to anyone" tool available to every `platform_admin` - a real misuse surface (spamming an arbitrary external address from this platform's own SMTP account/reputation) with no corresponding benefit, since the whole point of this feature is confirming the *admin's own* mail delivery works. `POST /api/v1/platform/email/test-send` therefore takes no request body at all; the controller reads `@AuthenticationPrincipal Jwt jwt` and resolves `jwt.getClaimAsString("email")`, the exact same claim `MeServiceImpl.bridgeByEmail` (`016`) already reads to bridge a login to a `Person`. No `Person` lookup is performed or required here - a `platform_admin` may have no `Person` row at all (`016`'s own `MeAccessDto` Javadoc already notes this is normal, not an error), and this feature has no reason to require one. If the JWT genuinely has no `email` claim (a malformed token, or an identity provider misconfiguration - not expected in practice, since Keycloak always sets one for a real login), the controller throws `ValidationException` (400) rather than attempting a send at all: this is a caller-side precondition failure, categorically different from an SMTP send failing, and `docs/standards/backend.md`'s existing `ValidationException` -> 400 mapping already covers it without any new exception type.

**3. A failed test send is returned as `{success: false, message}` inside a normal `200 OK` response, not thrown to `GlobalExceptionHandler` and not a new exception base type.**
Two alternatives were considered and rejected. First: let `EmailDeliveryException` (`017`) propagate uncaught. Rejected because `GlobalExceptionHandler` has no handler for it today, by design - `EmailDeliveryException`'s own Javadoc (`017`) states it is "always caught at the call site that triggers a send - never reaches `GlobalExceptionHandler`," and an uncaught propagation would fall through to Spring Boot's generic, undocumented 500 response, which carries none of the actual failure reason the admin needs ("Failed to send test email: Connection refused" requires the real exception message, only available at the catch site). Second: extend `docs/standards/backend.md`'s fixed three-exception status table (`NotFoundException`/`ConflictException`/`ValidationException`) with a new base type (e.g. something mapping to 502) for this one endpoint. Rejected as disproportionate - that table is a cross-cutting contract shared by every controller in this codebase, and a single diagnostic endpoint's outcome is exactly the kind of thing that's legitimately just data, not a transport-level error. `EmailTestSendServiceImpl.sendTestEmail(...)` therefore catches `EmailDeliveryException` itself and always returns an `EmailTestSendResultDto`, never throwing - `EmailDeliveryException`'s existing, documented invariant stays intact rather than being special-cased for one caller. This is the deliberate contrast with `017`/`016`: those catch-log-swallow into an unrelated *business* action's success response; this catches and *surfaces* into a response whose entire purpose is reporting exactly this outcome.

**4. The test email reuses `017`'s `email/base-layout.html` Thymeleaf fragment, via a new `email/test-send.html` content template - not a bare string.**
The `SpringTemplateEngine` bean and Thymeleaf dependency already exist (`017`); a plain string body would fragment the "every real email uses the same shell" precedent `017` established for its own future consumers (the self-serve OTP flow, `003`'s `Invitation` email, both still unbuilt per `docs/roadmap.md`), and a test email that visually matches the platform's real emails is a *better* diagnostic than a bare-bones one - it proves the exact rendering pipeline works end to end, not just that a raw SMTP connection succeeds.

**5. Settings stay read-only from this screen; there is no edit path here at all.**
Changing `spring.mail.*`/`app.mail.*` remains an `application.properties`/environment-variable change plus a redeploy, exactly as it is today for `016`'s Keycloak admin secret and `017`'s own mail credentials - no in-app settings-editor exists anywhere in this codebase, and building one is a materially larger, separate decision (validation, secret handling, who's allowed to change what) that belongs to a future "System Settings" module if it's ever scoped, not folded into this spec.

## Data Model Changes

**None.** No new entity, no new column, no migration - this spec reads existing configuration and calls the existing `EmailService` primitive (`017`); nothing about it touches the database.

## Configuration & Infrastructure Changes

**None new.** This spec deliberately introduces no new Maven dependency and no new Spring config property - it reads `017`'s already-checked-in `spring.mail.host`/`spring.mail.port`/`spring.mail.properties.mail.smtp.auth`/`spring.mail.properties.mail.smtp.starttls.enable`/`app.mail.from-address`/`app.mail.from-name`/`app.mail.support-address`, and reuses `017`'s already-registered `SpringTemplateEngine` bean. The only new checked-in file at this layer is a template:

**`backend/src/main/resources/templates/email/test-send.html` (new)** - composes into `017`'s `email/base-layout.html` exactly the way `email/subscription-welcome.html` does, via `th:replace="~{email/base-layout :: layout(~{::content})}"`:

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      th:replace="~{email/base-layout :: layout(~{::content})}">
<body>
<div th:fragment="content">
    <p style="margin:0 0 16px;">This is a test email, not a real notification.</p>
    <p style="margin:0 0 20px;">
        Triggered from <strong>Configuration &rarr; Email</strong> in the Cricket Legend admin
        console, to confirm this platform's outbound email settings are actually working end to
        end, not just configured.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background-color:#f4f6f5; border-radius:8px; margin:0 0 24px;">
        <tr>
            <td style="padding:16px;">
                <table role="presentation" width="100%" cellpadding="4" cellspacing="0"
                       style="color:#14231c; font-size:14px;">
                    <tr>
                        <td style="color:#52655c;">Sent at</td>
                        <td style="text-align:right;" th:text="${sentAt}">22 August 2026, 14:32</td>
                    </tr>
                    <tr>
                        <td style="color:#52655c;">Sent from</td>
                        <td style="text-align:right;" th:text="${fromAddress}">no-reply@cricketlegend.co.za</td>
                    </tr>
                    <tr>
                        <td style="color:#52655c;">This backend serves</td>
                        <td style="text-align:right;" th:text="${frontendBaseUrl}">http://localhost:5173</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <p style="margin:0; color:#52655c; font-size:13px;">
        If you weren't expecting this, no action is needed - nobody else was sent a copy.
    </p>
</div>
</body>
</html>
```

`frontendBaseUrl` reuses `app.frontend.base-url` (already added by `016`, reused unmodified by `017`) - a real, already-existing signal of which environment this backend instance is wired to, given so the admin checking their inbox knows this isn't the real welcome email and can tell which deployment sent it, without this spec inventing a new "environment name" property.

## New Domain Behaviour

**`EmailSettingsDto`/`EmailTestSendResultDto` (new DTOs):**

```java
// backend/src/main/java/com/cricketlegend/dto/EmailSettingsDto.java (new)
package com.cricketlegend.dto;

/**
 * The safe-to-display subset of this application's own outbound SMTP configuration - see
 * docs/specs/018-email-configuration-and-test-send.md's Real Architectural Judgment Calls #1.
 * Deliberately excludes spring.mail.username/spring.mail.password entirely - not even a boolean
 * "is a password configured" flag.
 */
public record EmailSettingsDto(
        String host,
        int port,
        boolean authEnabled,
        boolean starttlsEnabled,
        String fromAddress,
        String fromName,
        String supportAddress) {
}
```

```java
// backend/src/main/java/com/cricketlegend/dto/EmailTestSendResultDto.java (new)
package com.cricketlegend.dto;

/**
 * docs/specs/018-email-configuration-and-test-send.md. Always returned inside a 200 response -
 * success or failure is data here, not a transport-level error - see that spec's judgment call #3
 * for why a failed send is reported this way rather than thrown to GlobalExceptionHandler.
 */
public record EmailTestSendResultDto(boolean success, String message, String sentTo) {
}
```

**`EmailSettingsService`/`EmailSettingsServiceImpl` (new):**

```java
// backend/src/main/java/com/cricketlegend/service/EmailSettingsService.java (new)
package com.cricketlegend.service;

import com.cricketlegend.dto.EmailSettingsDto;

/** docs/specs/018-email-configuration-and-test-send.md. */
public interface EmailSettingsService {
    EmailSettingsDto getSettings();
}
```

```java
// backend/src/main/java/com/cricketlegend/service/impl/EmailSettingsServiceImpl.java (new)
package com.cricketlegend.service.impl;

import com.cricketlegend.dto.EmailSettingsDto;
import com.cricketlegend.service.EmailSettingsService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class EmailSettingsServiceImpl implements EmailSettingsService {

    private final String host;
    private final int port;
    private final boolean authEnabled;
    private final boolean starttlsEnabled;
    private final String fromAddress;
    private final String fromName;
    private final String supportAddress;

    public EmailSettingsServiceImpl(
            @Value("${spring.mail.host}") String host,
            @Value("${spring.mail.port}") int port,
            @Value("${spring.mail.properties.mail.smtp.auth}") boolean authEnabled,
            @Value("${spring.mail.properties.mail.smtp.starttls.enable}") boolean starttlsEnabled,
            @Value("${app.mail.from-address}") String fromAddress,
            @Value("${app.mail.from-name}") String fromName,
            @Value("${app.mail.support-address}") String supportAddress) {
        this.host = host;
        this.port = port;
        this.authEnabled = authEnabled;
        this.starttlsEnabled = starttlsEnabled;
        this.fromAddress = fromAddress;
        this.fromName = fromName;
        this.supportAddress = supportAddress;
    }

    @Override
    public EmailSettingsDto getSettings() {
        return new EmailSettingsDto(host, port, authEnabled, starttlsEnabled, fromAddress, fromName, supportAddress);
    }
}
```

**`EmailTestSendService`/`EmailTestSendServiceImpl` (new):**

```java
// backend/src/main/java/com/cricketlegend/service/EmailTestSendService.java (new)
package com.cricketlegend.service;

import com.cricketlegend.dto.EmailTestSendResultDto;

/** docs/specs/018-email-configuration-and-test-send.md. Never throws - see judgment call #3. */
public interface EmailTestSendService {
    EmailTestSendResultDto sendTestEmail(String toAddress, String toName);
}
```

```java
// backend/src/main/java/com/cricketlegend/service/impl/EmailTestSendServiceImpl.java (new)
package com.cricketlegend.service.impl;

import com.cricketlegend.dto.EmailTestSendResultDto;
import com.cricketlegend.exception.EmailDeliveryException;
import com.cricketlegend.service.EmailService;
import com.cricketlegend.service.EmailTestSendService;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

@Service
public class EmailTestSendServiceImpl implements EmailTestSendService {

    private static final DateTimeFormatter SENT_AT_FORMAT =
            DateTimeFormatter.ofPattern("d MMMM yyyy, HH:mm", Locale.UK).withZone(ZoneId.systemDefault());

    private final EmailService emailService;
    private final SpringTemplateEngine templateEngine;
    private final String fromAddress;
    private final String frontendBaseUrl;

    public EmailTestSendServiceImpl(
            EmailService emailService,
            SpringTemplateEngine templateEngine,
            @Value("${app.mail.from-address}") String fromAddress,
            @Value("${app.frontend.base-url}") String frontendBaseUrl) {
        this.emailService = emailService;
        this.templateEngine = templateEngine;
        this.fromAddress = fromAddress;
        this.frontendBaseUrl = frontendBaseUrl;
    }

    @Override
    public EmailTestSendResultDto sendTestEmail(String toAddress, String toName) {
        String subject = "Cricket Legend - SMTP test email";

        try {
            Context context = new Context();
            context.setVariable("subject", subject);
            context.setVariable("sentAt", SENT_AT_FORMAT.format(Instant.now()));
            context.setVariable("fromAddress", fromAddress);
            context.setVariable("frontendBaseUrl", frontendBaseUrl);
            String htmlBody = templateEngine.process("email/test-send", context);

            emailService.send(toAddress, toName, subject, htmlBody);
            return new EmailTestSendResultDto(true, "Test email sent to " + toAddress + ".", toAddress);
        } catch (EmailDeliveryException e) {
            // Diagnostic action, not a best-effort side effect (contrast with 016/017's own
            // catch-log-swallow posture) - the failure is real, visible data in the response.
            return new EmailTestSendResultDto(false, "Failed to send test email: " + rootCauseMessage(e), toAddress);
        }
    }

    private String rootCauseMessage(EmailDeliveryException e) {
        Throwable cause = e.getCause();
        return cause != null && cause.getMessage() != null ? cause.getMessage() : e.getMessage();
    }
}
```

**`EmailConfigController` (new):**

```java
// backend/src/main/java/com/cricketlegend/controller/EmailConfigController.java (new)
package com.cricketlegend.controller;

import com.cricketlegend.dto.EmailSettingsDto;
import com.cricketlegend.dto.EmailTestSendResultDto;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.service.EmailSettingsService;
import com.cricketlegend.service.EmailTestSendService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/platform/email")
class EmailConfigController {

    private final EmailSettingsService emailSettingsService;
    private final EmailTestSendService emailTestSendService;

    EmailConfigController(EmailSettingsService emailSettingsService, EmailTestSendService emailTestSendService) {
        this.emailSettingsService = emailSettingsService;
        this.emailTestSendService = emailTestSendService;
    }

    @GetMapping("/settings")
    EmailSettingsDto getSettings() {
        return emailSettingsService.getSettings();
    }

    @PostMapping("/test-send")
    EmailTestSendResultDto testSend(@AuthenticationPrincipal Jwt jwt) {
        // Same JWT email claim MeServiceImpl.bridgeByEmail (016) already reads - "the admin" is
        // always the caller's own resolved email, never a request-body destination (judgment
        // call #2).
        String email = jwt.getClaimAsString("email");
        if (email == null) {
            throw new ValidationException("Your login session has no email address to send a test email to.");
        }
        String name = jwt.getClaimAsString("name");
        return emailTestSendService.sendTestEmail(email, name != null ? name : email);
    }
}
```

Both endpoints fall under `/api/v1/platform/**`, already gated `hasRole("platform_admin")` in `SecurityConfig` - confirmed by reading the existing rule; no `SecurityConfig` change is needed or made.

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /api/v1/platform/email/settings` | `platform_admin` | Returns the safe-to-display subset of this application's own outbound email configuration - host, port, `authEnabled`/`starttlsEnabled`, from-address, from-name, support-address. Never returns `spring.mail.username`/`spring.mail.password`, or any flag derived from either. |
| `POST /api/v1/platform/email/test-send` | `platform_admin` | Sends a real test email, through the exact same `EmailService`/base-layout mechanism `017`'s welcome email uses, to the caller's own JWT `email` claim - no request body, no destination parameter. Always returns `200` with `{success, message, sentTo}`; a downstream SMTP failure is reported as `success: false` with a specific `message`, never a `5xx`. Returns `400` only if the caller's own JWT has no `email` claim at all. |

## UI Requirements

Extends `007-configuration-hub-overview.md`'s existing Configuration hub - one new card, one new page, no new shared component.

- **`ui/src/api/emailApi.ts` (new)**, one file per backend resource per `docs/standards/frontend.md`:

  ```ts
  import api from './axiosConfig'

  export interface EmailSettings {
    host: string
    port: number
    authEnabled: boolean
    starttlsEnabled: boolean
    fromAddress: string
    fromName: string
    supportAddress: string
  }

  export interface EmailTestSendResult {
    success: boolean
    message: string
    sentTo: string
  }

  export async function getEmailSettings(): Promise<EmailSettings> {
    const { data } = await api.get<EmailSettings>('/platform/email/settings')
    return data
  }

  export async function sendTestEmail(): Promise<EmailTestSendResult> {
    const { data } = await api.post<EmailTestSendResult>('/platform/email/test-send')
    return data
  }
  ```

- **`ui/src/pages/admin/ConfigurationHome.tsx`** - one new entry in the existing `CARDS` array, right after `Products` (the two working cards grouped ahead of the three still-`EmptyState` placeholders):

  ```ts
  { title: 'Email', description: 'View outbound email settings and send a test message', to: '/admin/configuration/email' },
  ```

- **`ui/src/App.tsx`** - one new route nested under the existing `/admin/configuration` block, alongside the `products` routes:

  ```tsx
  <Route path="email" element={<EmailSettings />} />
  ```

- **New page: `ui/src/pages/admin/EmailSettings.tsx`.** Not a shared component (`docs/standards/frontend.md`'s four-file anatomy is for `components/**`, not `pages/**`), but does get its own test file, matching `ProductList.test.tsx`/`ConfigurationHome.test.tsx`'s existing precedent of page-level tests. This is a settings-display-plus-action screen, not a record list and not a create/edit form, so neither `ListToolbar`/`RecordCard` (list pattern) nor a full create/edit flow applies - it reuses `RecordFormScreen`'s shape (Back action, title, field grid, actions bar) for its "Back to Configuration, read-only field grid, action button" layout, since that shape fits just as well with disabled fields and no Save button as it does with an editable form. The "Send test email" button's loading/success/error states reuse the same inline pattern `MediaUpload` (`012`) already established - a `Button` label swap while pending, and a coloured `Typography` (`success.main`/`error.main`, both existing design tokens) for the outcome - rather than introducing a new Alert/Snackbar component that doesn't exist anywhere in this codebase yet.

  ```tsx
  import { useState } from 'react'
  import { Typography } from '@mui/material'
  import { useMutation, useQuery } from '@tanstack/react-query'
  import { RecordFormScreen } from '../../components/RecordFormScreen'
  import { Input } from '../../components/Input'
  import { Button } from '../../components/Button'
  import { EmptyState } from '../../components/EmptyState'
  import { getEmailSettings, sendTestEmail } from '../../api/emailApi'

  export default function EmailSettings() {
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

    const { data, isLoading, isError } = useQuery({
      queryKey: ['email', 'settings'],
      queryFn: getEmailSettings,
    })

    const testSend = useMutation({
      mutationFn: sendTestEmail,
      onSuccess: (response) => setResult({ success: response.success, message: response.message }),
      onError: () =>
        setResult({ success: false, message: 'Something went wrong sending the test email. Please try again.' }),
    })

    if (isLoading) {
      return null
    }

    if (isError || !data) {
      return (
        <EmptyState
          title="Couldn't load email settings"
          description="Something went wrong loading the current email configuration. Please try again."
        />
      )
    }

    return (
      <RecordFormScreen
        title="Email"
        backTo="/admin/configuration"
        backLabel="Back to Configuration"
        actions={
          <>
            <Button
              variant="primary"
              disabled={testSend.isPending}
              onClick={() => {
                setResult(null)
                testSend.mutate()
              }}
            >
              {testSend.isPending ? 'Sending…' : 'Send test email'}
            </Button>
            {result && (
              <Typography
                variant="body2"
                color={result.success ? 'success.main' : 'error.main'}
                sx={{ alignSelf: 'center' }}
              >
                {result.message}
              </Typography>
            )}
          </>
        }
      >
        <Input label="Host" value={data.host} disabled />
        <Input label="Port" value={data.port} disabled />
        <Input label="Authentication" value={data.authEnabled ? 'Enabled' : 'Disabled'} disabled />
        <Input label="STARTTLS" value={data.starttlsEnabled ? 'Enabled' : 'Disabled'} disabled />
        <Input label="From address" value={data.fromAddress} disabled />
        <Input label="From name" value={data.fromName} disabled />
        <Input label="Support address" value={data.supportAddress} disabled />
      </RecordFormScreen>
    )
  }
  ```

- **Mobile-first**, per `docs/standards/frontend.md` - `RecordFormScreen`'s existing single-column-at-`xs`/two-column-from-`md` field grid applies unchanged; the actions bar's button-plus-message pair wraps to its own line at `xs` the same way `RecordFormScreen`'s existing actions bar already does for other consumers.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `EmailSettingsServiceImplTest` (new) - `getSettings()` returns a DTO whose fields match the injected `@Value`-bound properties exactly; a reflection-based regression test asserts `EmailSettingsDto`'s record components never include anything named `username`/`password` (guards the security decision in judgment call #1 the way `016`'s own `email_verified` regression test guarded its own security fix, rather than relying on the type system alone). `EmailTestSendServiceImplTest` (new, real `SpringTemplateEngine` against the checked-in `test-send.html`, no Spring context needed, mirroring `017`'s own `SubscriptionWelcomeEmailServiceImplTest` precedent) - the rendered HTML contains the substituted `sentAt`/`fromAddress`/`frontendBaseUrl`; a mocked `EmailService` success returns `success: true` with `sentTo` equal to the given `toAddress`, and `EmailService.send(...)` is called with that same address; a mocked `EmailService` throwing `EmailDeliveryException` is caught, does **not** propagate, and returns `success: false` with a `message` starting `"Failed to send test email: "` and containing the underlying cause's own message. |
| Integration | `EmailConfigControllerIntegrationTest` (new, `@MockitoBean EmailService`, mirroring `017`'s own `SubscriptionControllerIntegrationTest` precedent to avoid a real SMTP call in CI) - `GET /settings` as a `platform_admin` returns `200` with the expected fields, and the raw JSON response body is asserted **not** to contain the strings `"username"` or `"password"` anywhere (a defensive check against a future accidental leak, not just a trust-the-DTO assertion); `POST /test-send` with the mocked `EmailService` succeeding returns `200` with `success: true` and `sentTo` equal to the test JWT's own `email` claim; the same endpoint with the mocked `EmailService` throwing `EmailDeliveryException` returns `200` (not `5xx`) with `success: false` and a `message` containing `"Failed to send test email"`; a request built from a JWT with no `email` claim returns `400`; a caller without `platform_admin` receives `403` from both endpoints, a regression check against `SecurityConfig`'s existing gate rather than a new rule. |
| Contract | `EmailSettingsDto`/`EmailTestSendResultDto` and both new endpoints reflected in the checked-in OpenAPI schema; reviewer manually confirms the generated schema for `EmailSettingsDto` has no `username`/`password` property, alongside the automated integration-test check above. |
| Component | `EmailSettings.test.tsx` (new, page-level test, matching `ProductList.test.tsx`/`ConfigurationHome.test.tsx`'s existing precedent) - renders the fetched settings as disabled fields with the correct values; clicking "Send test email" triggers the mutation, shows "Sending…" and a disabled button while pending, then renders the returned message in `success.main` on success or `error.main` on a `success: false`/network-error outcome. `ConfigurationHome.test.tsx` (extended) - the existing `EXPECTED_CARDS` assertion gains the new `Email` card, `/admin/configuration/email`. |
| End-to-end | Not wired into CI, same precedent as `016`/`017` - needs a real local SMTP sink (Mailpit/MailHog, already the default per `017`'s Rollout Notes). Manual/local Playwright-adjacent run: log in as a `platform_admin`, open Configuration → Email, confirm the displayed settings match the running configuration, click "Send test email," confirm a success message renders and the email arrives at the local sink addressed to the logged-in admin's own email with the expected subject/content; stop the local sink, click "Send test email" again, confirm a specific, visible failure message renders rather than a blank or broken screen. |

## Acceptance Criteria

- A platform admin can view the platform's current outbound email host, port, whether auth/STARTTLS are enabled, from-address, from-name, and support-address, with no database or server access.
- Neither `spring.mail.username` nor `spring.mail.password`, nor any flag derived from either, is ever present in `GET /api/v1/platform/email/settings`'s response - verifiable by inspecting the raw JSON.
- Clicking "Send test email" sends a real email to the currently authenticated admin's own login email address, resolved from their JWT - never a free-text or request-body destination.
- A successful test send shows a clear success message naming the address it was sent to.
- A failed test send shows a specific, readable error message ("Failed to send test email: <reason>"), never a blank screen, an unstyled `5xx`, or a silent no-op - verifiable by a test that forces `EmailService` to throw and asserts the `200` response's `success: false` body.
- Both endpoints are reachable only by `platform_admin` - verified against the existing, unchanged `/api/v1/platform/**` `SecurityConfig` rule.
- No new Maven dependency, Spring config property, or database migration is introduced by this spec.
- The Configuration hub (`/admin/configuration`) shows a working `Email` card alongside the existing `Products` card, navigating to the new screen above.

## Rollout Notes

- Ships as its own PR, depending on `017`'s `EmailService`/`SpringTemplateEngine`/`spring.mail.*`/`app.mail.*` already existing in the codebase (currently implemented, tested, and CI-green on `feature/017-subscription-welcome-email`, not yet merged to `master`) - this spec's own PR should be sequenced after `017` merges, or rebased onto it, since `EmailConfigController`/`EmailTestSendServiceImpl` call `EmailService` directly and reuse its base layout template.
- `ConfigurationHome.test.tsx`'s existing `EXPECTED_CARDS` list must be extended with the new `Email` card in this spec's own PR, not left to drift - the same "amend an existing test explicitly" discipline `016`'s Rollout Notes already flagged for `015`'s own test.
- **Found while drafting this spec, worth a one-line flag rather than a silent fix (this spec doesn't touch backend/UI source):** `EmailServiceImpl.send(...)` (`017`) accepts a `toName` parameter but its current implementation never actually passes it to `MimeMessageHelper.setTo(...)` (which only takes an address) - `toName` is effectively unused today. Harmless for this spec (the recipient's own inbox still receives the email correctly), but worth a small drive-by fix whenever `EmailServiceImpl` is next touched, the same "flag it, don't quietly let it compound" posture `docs/roadmap.md`'s Known tech debt section already uses for other small gaps.
- Flag for `docs/roadmap.md`: if a future, still-unscoped "System Settings" Configuration-hub module ever becomes a general admin-editable settings screen, it should decide explicitly whether this spec's read-only `Email` card folds into it or stays its own dedicated card - not decided here; the two remain separate, non-overlapping entries for now.
- No audit trail exists for who triggered a test send or when, beyond whatever application-level logging (`013`) already captures incidentally. If that turns out to be a real operational need, it's a follow-up, not solved here.
