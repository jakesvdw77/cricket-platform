# 017 - Subscription Welcome Email

**Depends on:** `009-subscriptions.md` (`Subscription`'s `ownerId`/`productId`/`startDate`/`endDate` shape and `Club`/`Product` this email's content pulls from), `014-subscription-responsible-contact.md` (`Person`'s `firstName`/`lastName`/`email` shape, and `docs/roadmap.md`'s own instruction that a future notifications spec should reuse this `Person` directly as its first real send-to address rather than redefining the shape), `016-keycloak-account-provisioning.md` (`SubscriptionServiceImpl.create()`'s existing best-effort side-effect pattern - `provisionKeycloakAccountIfNeeded` - this spec adds a second side effect alongside, and the Keycloak `execute-actions-email` invite this spec's own email is deliberately kept separate from), `013-centralized-logging.md` (the "Configuration & Infrastructure Changes" section shape this spec reuses for its SMTP/templating setup), `docs/standards/design-system.md` (`ui/src/theme.ts`'s token values this email's HTML reuses verbatim).
**Status:** draft.

## Problem & Goals

Creating a Subscription today (`009`, amended by `014`/`016`) resolves a real, identity-bearing `Person` as the responsible party, grants them a `RoleAssignment`, and - if they're brand new - provisions a Keycloak account and sends Keycloak's own password-reset invite. Nothing, anywhere in this codebase, ever tells that person what they actually just signed up for: which product, on which club, for which dates, or where to log back in. `docs/roadmap.md`'s "Next up - notifications / email infrastructure" item names this exact gap and has been waiting on the SMTP/template infrastructure that doesn't exist yet. This spec builds that infrastructure for real, for the first time this application's own backend sends an email, and uses it to close the loop on Subscription creation with a genuine welcome email.

**Goals**
- This application's own backend gains a real outbound SMTP client and a reusable, themed HTML email mechanism, entirely separate from Keycloak's own realm-level SMTP settings (`016`).
- A base email layout (header, content area, footer, button/link styling reusing `ui/src/theme.ts`'s actual palette) exists as a shared, reusable template fragment - this welcome email is the first of several future emails to use it, not a one-off inline HTML string.
- Every successful Subscription creation sends the responsible `Person` a friendly, personalised welcome email naming the club, the product, the subscription's start/end dates, and a working link to that club's own login page.
- Sending this email never blocks or fails Subscription creation, on the same best-effort posture `016` already established for Keycloak provisioning.
- The mechanism built here (SMTP client, base layout, generic send primitive) is reusable, unmodified, by the two other motivating use cases `docs/roadmap.md` already names: the self-serve signup OTP flow and `003`'s still-unbuilt `Invitation` admin-invite email.

## Non-goals

- **Combining this email with Keycloak's own `execute-actions-email` password-reset invite into a single message.** Considered and rejected - see Real Architectural Judgment Calls below for the full reasoning. The two stay two separate emails, sent by two separate mechanisms.
- **Per-club branded email content.** This welcome email uses the platform's own default theme colours (`ui/src/theme.ts`'s base tokens) only - it does not resolve or apply a club's own `ClubBranding.primaryColor` override (`001`'s White-Labelling model, `withClubBranding()`). Doing so would need a server-side equivalent of that runtime override mechanism, which doesn't exist outside the SPA today. Flagged for `docs/roadmap.md`.
- **A retry mechanism or admin-visible indicator for a failed send.** Caught, logged, swallowed - the same accepted, named gap `016` already carries for a failed Keycloak provisioning attempt, now doubled for this second best-effort external call in the same method. Not solved here.
- **An admin-facing "resend welcome email" action, send history, or delivery-status tracking.** No screen, no table, no endpoint. If this becomes a real operational need, it's its own follow-up.
- **The self-serve signup OTP email and `003`'s `Invitation` admin-invite email themselves.** Both are named, real future consumers of the reusable primitive this spec builds (`EmailService`, the base layout fragment) - neither is sent, triggered, or scaffolded by this spec. See Rollout Notes.
- **General "notifications" beyond this one transactional email** - no notification preferences, no in-app notification centre, no SMS/push channel. Email only, this one message only.
- **Bounce/complaint handling, unsubscribe management, or any marketing-list mechanic.** This is a one-off transactional confirmation tied to an admin action, not a marketing send - no suppression list, no unsubscribe link.
- **Attachments of any kind** (e.g. a PDF invoice). Plain HTML body only.
- **Multi-language content.** English copy only, hard-coded in the checked-in Thymeleaf templates - no `MessageSource`/i18n mechanism is introduced.
- **An admin-editable email-copy mechanism** (a template editor, a CMS-style "edit this email" screen). Copy changes are a code change to the checked-in template files, same as any other UI copy in this codebase.
- **Production email deliverability concerns** - choosing a real SMTP provider, SPF/DKIM/DMARC DNS records, sending-domain reputation. Real per-environment decisions, flagged in `docs/deployment.md`, not resolved by this spec's code (see Rollout Notes).
- **Any change to `016`'s Keycloak-side provisioning, invite email, or first-login activation flow.** `KeycloakProvisioningService`, `MeService`, `PostLoginRedirect` are all untouched.
- **Any UI/`ui/` change.** This spec is entirely backend + local infrastructure - no new endpoint the frontend calls, no new page, nothing in `ui/`.

## User Stories

- As a Subscription's responsible `Person`, once a platform admin creates my Subscription, I receive a friendly welcome email confirming which club, which product, and which dates I'm now signed up for, with a working link straight to my club's own login page.
- As a platform admin, I don't do anything beyond creating the Subscription exactly as I already do today (`014`) for this email to go out - same "no extra step" posture `016` already established for Keycloak provisioning.
- As a person responsible for more than one club's Subscription, I get a separate, correctly-scoped welcome email for each Subscription created for me - one per Subscription, since each names a different product/club/date range, not a single "welcome" sent only the first time I'm ever seen.
- As a developer reading `SubscriptionServiceImpl.create()`, I can see clearly that an SMTP outage never blocks a Subscription from being created, on the same footing as `016`'s already-stated Keycloak posture.
- As a developer building the self-serve signup OTP flow or `003`'s `Invitation` email next, I can reuse `EmailService` and the shared base layout fragment this spec builds, rather than standing up a second SMTP client or a second HTML-email mechanism.

## Real Architectural Judgment Calls

Resolved explicitly here, not silently assumed - a reviewer should be able to challenge each one on its own terms.

**1. Kept separate from Keycloak's own invite email, not combined into one message.**
`016` already sends one real email today: Keycloak's own `execute-actions-email` (`UPDATE_PASSWORD` action), delivered through Keycloak's own realm SMTP settings, using Keycloak's own default template - the application backend only ever triggers it via the Admin API, it never sees or controls that email's content. Combining the two into a single message would need one of two things: (a) building a fully custom Keycloak email theme so this app's welcome content could be appended to Keycloak's own password-set template, which `016`'s own Non-goals already explicitly ruled out this pass as "out of proportion... real custom Keycloak theme work"; or (b) suppressing Keycloak's own email entirely and reimplementing password-set-on-first-login from scratch inside this application, which would mean redefining `016`'s already-shipped, working flow rather than building alongside it. Neither is this spec's job. There is also a structural mismatch that makes "one email" the wrong shape regardless of theming effort: `016`'s Keycloak invite only fires once, the first time a `Person` is provisioned (`provisionKeycloakAccountIfNeeded`'s `keycloakUserId`/`keycloakProvisionedAt` guard) - but this welcome email's content (which product, which club, which dates) is specific to *this* Subscription and must fire on **every** Subscription creation, including a second Subscription for a `Person` who already has a working Keycloak account and receives no second invite. Collapsing the two into one send would either wrongly suppress the welcome confirmation on every Subscription after the first, or wrongly re-send a password-reset link to someone who's already active. Two separate emails, two separate trigger conditions, two separate mechanisms - the right shape given what already exists.

**2. Trigger point and guard: fires on every `SubscriptionServiceImpl.create()` call, unconditionally - deliberately not gated the way Keycloak provisioning is.**
`provisionKeycloakAccountIfNeeded` only fires for a brand-new `Person` (`keycloakUserId == null && keycloakProvisionedAt == null`), because provisioning an already-provisioned account would fail against Keycloak's own email-uniqueness constraint. No equivalent constraint applies here - sending a second, differently-scoped welcome email for a second Subscription is exactly correct behaviour, not a bug to guard against. `sendWelcomeEmailBestEffort` (see New Domain Behaviour) is therefore called unconditionally after the Subscription and its `RoleAssignment` grant are already saved, with no prior "already sent?" check.

**3. Failure posture: best-effort, never fails Subscription creation - the same posture `016` already established, applied a second time in the same method.**
`EmailDeliveryException` is caught inside `SubscriptionServiceImpl.create()` itself, logged at `ERROR` with the `Person`/`Subscription`/`Club` ids in the message (mirroring `016`'s own logging shape), and swallowed - the `POST /subscriptions` response still succeeds with `201`. No signal is persisted anywhere that the send failed (unlike `keycloakProvisionedAt`, there's no equivalent "did this welcome email actually go out" column) - a real, deliberate gap for this pass, flagged in Non-goals and Rollout Notes rather than solved. The alternative (failing the whole request over a downstream email problem) is rejected for the identical reason `016`'s own judgment call #1 already gives: an internal, otherwise-successful business action shouldn't inherit its failure mode from an external system's uptime.

**4. Template mechanism: Thymeleaf, rendered standalone to a `String` via `TemplateEngine.process(...)`, not through Spring MVC's `ViewResolver`.**
Confirmed by reading `backend/pom.xml`: no templating dependency exists in this codebase today (`014`'s own Non-goals already confirmed by grep that no `spring.mail`/SMTP-adjacent dependency exists either). `spring-boot-starter-thymeleaf` is the natural fit - a real Spring Boot starter (no manual version pin needed, unlike `016`'s Keycloak admin client), and Thymeleaf's `TemplateEngine.process(templateName, context)` renders directly to a `String` with no HTTP request/response involved at all, which is exactly what's needed to build an email body. This application has no server-rendered web views (it's a REST API, `ui/` is a separate SPA), so the `ViewResolver` bean this starter's auto-configuration also registers is simply unused, not harmful - there is no controller anywhere returning a view name for it to resolve against. No `thymeleaf-layout-dialect` or other extra library is added - plain Thymeleaf 3's own "pass a fragment as an argument" composition (`th:replace="~{email/base-layout :: layout(~{::content})}"`) is sufficient for one shared base layout with per-email content, and keeps the dependency count to exactly the two named in Configuration & Infrastructure Changes.

**5. Local dev SMTP sink: this app's own `spring.mail.*` should point at the same local Mailpit/MailHog instance `docs/deployment.md` already flags as needed for Keycloak's own invite email.**
`docs/deployment.md`'s "Email / SMTP - not yet configured anywhere" section already names the gap for `016`'s Keycloak-side email and suggests a MailHog/Mailpit-style sink, never committed anywhere. This spec's own `spring.mail.host`/`spring.mail.port` default to `localhost:1025` - Mailpit/MailHog's own default SMTP listener - so a single local sink (`docker run -p 1025:1025 -p 8025:8025 axllent/mailpit`, one command, not committed as a docker-compose service by this spec - see Rollout Notes) serves both this application's own welcome email and Keycloak's realm-level invite email at once, with zero property overrides needed for either. One sink, two independent SMTP clients pointed at it - not a shared client, since Keycloak's realm SMTP settings and this app's `spring.mail.*` remain configured in two entirely separate places (Keycloak's admin console vs. `application.properties`), exactly as `016` already established they should stay.

**6. "Other information deemed important": a fixed platform support address, not a specific human contact.**
The request's "other information deemed important" is deliberately resolved narrowly: the email names the club, the product, the subscription dates, and a support email address (`app.mail.support-address`, a new config property, default `support@cricketlegend.co.za`) for "questions? get in touch." No attempt is made to resolve a specific human contact (e.g. the vendor rep who onboarded this club) - no such entity exists in this codebase today. Flagged explicitly in Rollout Notes as a judgment call to revisit once a "Club Contacts" spec (`docs/roadmap.md`'s "Next up, not yet spec'd" item under `003`) exists, at which point the welcome email could show that club's own primary contact instead of, or alongside, the generic platform address.

**7. `app.frontend.base-url` is reused, unmodified, to build the club login link - no new "root domain" property is added.**
`016` already introduced `app.frontend.base-url` (`${FRONTEND_BASE_URL:http://localhost:5173}`), used today only to build Keycloak's `execute-actions-email` redirect URI. Parsing that same property's scheme and authority (`URI.create(frontendBaseUrl).getScheme()`/`getAuthority()`) and prefixing the club's `slug` produces exactly the URL shape `ui/src/pages/view/LandingPage/FindYourClubLogin.tsx`'s `goToClubLogin` already builds client-side (`${protocol}//${slug}.${ROOT_DOMAIN}/login`, where `ROOT_DOMAIN` defaults to the same `localhost:5173`) - `http://riverside-cc.localhost:5173/login` locally, `https://riverside-cc.cricketlegend.co.za/login` in production once `FRONTEND_BASE_URL` is set to `https://cricketlegend.co.za`. Per `CLAUDE.md`'s "reuse before you write," no second config property is introduced for this - `app.frontend.base-url` is the single source for both consumers.

## Data Model Changes

**None.** No new entity, no new column, no migration. This spec is the first real consumer of fields already shipped by prior specs, resolved through the exact same lookups `SubscriptionServiceImpl.create()` already performs to build its own `SubscriptionDto` (`club`, `product`, `responsiblePerson`, all already in scope at the point this spec's new call is added): `Subscription.startDate`/`endDate`/`ownerId`/`productId`, `Club.name`/`slug`, `Product.name`, `Person.firstName`/`lastName`/`email`. Nothing about this spec requires a schema change, matching `013`'s own precedent of a spec that's entirely backend infrastructure with zero domain-model impact.

## Configuration & Infrastructure Changes

Following `013`'s precedent of a dedicated section for concrete, checked-in configuration that isn't a domain data-model change.

### 1. New Maven dependencies

```xml
<!-- Outbound transactional email for this application's own backend - separate from Keycloak's
     own realm SMTP settings (016-keycloak-account-provisioning.md's execute-actions-email uses
     Keycloak's own transport, configured in its admin console, not here).
     017-subscription-welcome-email.md -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-mail</artifactId>
</dependency>

<!-- Server-rendered HTML email templates - a reusable base layout plus per-email content
     fragments, rendered standalone to a String via TemplateEngine.process(...), never through
     Spring MVC's ViewResolver (this app has no server-rendered web views to resolve).
     017-subscription-welcome-email.md -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-thymeleaf</artifactId>
</dependency>
```

Both are official Spring Boot starters, version resolved from `spring-boot-starter-parent` - unlike `016`'s Keycloak admin client or `013`'s Loki appender, neither needs a manual version pin.

### 2. New Spring config properties

Following `012`/`013`/`016`'s `${ENV_VAR:default}` convention, added to `backend/src/main/resources/application.properties`:

```properties
# Outbound SMTP for this application's own transactional email (currently: the Subscription
# welcome email below; future consumers per docs/roadmap.md: the self-serve signup OTP flow,
# 003's Invitation admin-invite email). Entirely separate from Keycloak's own realm-level Email
# settings (016) - this app authors and sends its own HTML emails, Keycloak only ever sends its
# own. Local dev default (localhost:1025, no auth, no TLS) matches Mailpit/MailHog's default SMTP
# listener out of the box - see 017-subscription-welcome-email.md Rollout Notes for the one-line
# local sink command, shared with 016's own still-unconfigured Keycloak-side email.
spring.mail.host=${SMTP_HOST:localhost}
spring.mail.port=${SMTP_PORT:1025}
spring.mail.username=${SMTP_USERNAME:}
spring.mail.password=${SMTP_PASSWORD:}
spring.mail.properties.mail.smtp.auth=${SMTP_AUTH:false}
spring.mail.properties.mail.smtp.starttls.enable=${SMTP_STARTTLS:false}

# The address/name this app's own emails are sent from, and where a "questions?" reply should
# go. 017-subscription-welcome-email.md.
app.mail.from-address=${MAIL_FROM_ADDRESS:no-reply@cricketlegend.co.za}
app.mail.from-name=${MAIL_FROM_NAME:Cricket Legend}
app.mail.support-address=${MAIL_SUPPORT_ADDRESS:support@cricketlegend.co.za}
```

`app.frontend.base-url` (already added by `016`) is reused unmodified to build the club login link - see judgment call #7. No new "root domain" or "scheme" property is added.

### 3. Base email layout - `backend/src/main/resources/templates/email/base-layout.html` (new)

The reusable shell every future themed email, not just this one, composes with. Inline styles only (email clients don't reliably support external stylesheets), table-based layout for the widest client compatibility. Every colour that renders as actual UI chrome (header, text, button, divider) is taken verbatim from `ui/src/theme.ts` (`docs/standards/design-system.md`'s Colour token table) rather than invented — `primary.main` (`#2f6e4f`), `text.primary`/`text.secondary` (`#14231c`/`#52655c`), `divider` (`#dee6e1`). One exception, called out explicitly rather than mis-claimed as a token: the outer page background behind the white card (`#f4f6f5`, a light grey) is *not* one of `theme.ts`'s own values — `background.default`/`paper` are both pure white there, since the app's own UI is a single canvas with no card-on-page contrast to render. An email needs that contrast (a white card on a white background would look like an unstyled blank message in most clients), so this one value is a deliberate, email-specific addition, not a theme.ts token — revisit if `theme.ts` ever gains a real "page background" token this could align with instead.

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org" lang="en" th:fragment="layout(content)">
<head>
    <meta charset="UTF-8"/>
    <title th:text="${subject}">Cricket Legend</title>
</head>
<body style="margin:0; padding:24px; background-color:#f4f6f5;
             font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
        <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0"
                   style="background-color:#ffffff; border:1px solid #dee6e1; border-radius:8px; overflow:hidden;">
                <!-- Header: primary.main background, contrastText foreground - ui/src/theme.ts -->
                <tr>
                    <td style="background-color:#2f6e4f; padding:20px 24px;">
                        <span style="color:#ffffff; font-size:18px; font-weight:600;">Cricket Legend</span>
                    </td>
                </tr>
                <!-- Per-email content, passed in as a fragment argument - see subscription-welcome.html -->
                <tr>
                    <td style="padding:24px; color:#14231c; font-size:15px; line-height:1.5;"
                        th:replace="${content}">
                        Content goes here.
                    </td>
                </tr>
                <!-- Footer: text.secondary, divider hairline - ui/src/theme.ts -->
                <tr>
                    <td style="padding:16px 24px; border-top:1px solid #dee6e1; color:#52655c; font-size:12px;">
                        Cricket Legend Platform &middot; Multi-club cricket management
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
```

### 4. Welcome email content - `backend/src/main/resources/templates/email/subscription-welcome.html` (new)

The first, and reference, consumer of the base layout above. Composes into it via Thymeleaf's own fragment-argument mechanism (`th:replace="~{email/base-layout :: layout(...)}"`), no separate layout-dialect library needed:

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      th:replace="~{email/base-layout :: layout(~{::content})}">
<body>
<div th:fragment="content">
    <p style="margin:0 0 16px;">
        Hi <span th:text="${firstName}">Jaco</span>, welcome to the crease!
    </p>
    <p style="margin:0 0 20px;">
        Your subscription for <strong th:text="${clubName}">Riverside CC</strong> is all set and ready
        to open the batting.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background-color:#f4f6f5; border-radius:8px; margin:0 0 24px;">
        <tr>
            <td style="padding:16px;">
                <table role="presentation" width="100%" cellpadding="4" cellspacing="0"
                       style="color:#14231c; font-size:14px;">
                    <tr>
                        <td style="color:#52655c;">Club</td>
                        <td style="text-align:right;" th:text="${clubName}">Riverside CC</td>
                    </tr>
                    <tr>
                        <td style="color:#52655c;">Product</td>
                        <td style="text-align:right;" th:text="${productName}">Club Standard</td>
                    </tr>
                    <tr>
                        <td style="color:#52655c;">Start date</td>
                        <td style="text-align:right;" th:text="${startDate}">1 March 2026</td>
                    </tr>
                    <tr>
                        <td style="color:#52655c;">End date</td>
                        <td style="text-align:right;" th:text="${endDate}">Ongoing - no fixed end date</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
            <td style="border-radius:8px; background-color:#2f6e4f;">
                <a th:href="${loginUrl}" href="#"
                   style="display:inline-block; padding:12px 24px; color:#ffffff; font-size:15px;
                          font-weight:600; text-decoration:none;">
                    Log in to your club
                </a>
            </td>
        </tr>
    </table>

    <p style="margin:24px 0 0; color:#52655c; font-size:13px;">
        Questions about your subscription? Drop us a line at
        <a th:href="'mailto:' + ${supportAddress}" th:text="${supportAddress}"
           style="color:#2f6e4f;">support@cricketlegend.co.za</a> - we're always happy to help,
        even off-season.
    </p>
</div>
</body>
</html>
```

Two real, checked-in example subject lines/opening lines - friendly, personal, a light cricket turn of phrase, matching the tone the feature request asked for:

- Subject: `Welcome to Riverside CC on Cricket Legend, Jaco!` - opening line: "Hi Jaco, welcome to the crease! Your subscription for Riverside CC is all set and ready to open the batting."
- Alternative subject (used for a second Subscription on a different club, same person): `You're in, Jaco - Northside Academy is ready for its first over` - opening line: "Hi Jaco, thanks for stepping up to the wicket with Cricket Legend."

## New Domain Behaviour

**`EmailService`/`EmailServiceImpl` (new) - the generic, reusable send primitive:**

```java
// backend/src/main/java/com/cricketlegend/service/EmailService.java (new)
package com.cricketlegend.service;

/**
 * Generic outbound transactional email transport - docs/specs/017-subscription-welcome-email.md.
 * Deliberately carries no knowledge of any specific email's content or subject copy - a caller
 * (SubscriptionWelcomeEmailService below, or a future OTP/invite email service) builds its own
 * HTML body (via the shared email/base-layout.html Thymeleaf fragment) and hands it here to
 * actually send. The reusable primitive future email-sending features should reuse rather than
 * standing up a second SMTP client, the same way KeycloakProvisioningService (016) is the
 * reusable primitive for future Keycloak account operations.
 */
public interface EmailService {
    /** @throws com.cricketlegend.exception.EmailDeliveryException if the underlying SMTP send fails */
    void send(String toAddress, String toName, String subject, String htmlBody);
}
```

```java
// backend/src/main/java/com/cricketlegend/service/impl/EmailServiceImpl.java (new)
package com.cricketlegend.service.impl;

import com.cricketlegend.exception.EmailDeliveryException;
import com.cricketlegend.service.EmailService;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;
    private final String fromAddress;
    private final String fromName;

    public EmailServiceImpl(
            JavaMailSender mailSender,
            @Value("${app.mail.from-address}") String fromAddress,
            @Value("${app.mail.from-name}") String fromName) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
        this.fromName = fromName;
    }

    @Override
    public void send(String toAddress, String toName, String subject, String htmlBody) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(fromAddress, fromName);
            helper.setTo(toAddress);
            helper.setSubject(subject);
            helper.setText(htmlBody, true); // true = HTML body
            mailSender.send(message);
        } catch (Exception e) {
            throw new EmailDeliveryException("Failed to send email to " + toAddress, e);
        }
    }
}
```

**`EmailDeliveryException` (new):**

```java
// backend/src/main/java/com/cricketlegend/exception/EmailDeliveryException.java (new)
package com.cricketlegend.exception;

/**
 * docs/specs/017-subscription-welcome-email.md. Deliberately does NOT extend
 * NotFoundException/ConflictException/ValidationException (docs/standards/backend.md) - an
 * external-system integration failure, not a business-rule violation, the same reasoning
 * KeycloakProvisioningException (016) already established. Always caught at the call site that
 * triggers a send as a best-effort side effect - never reaches GlobalExceptionHandler.
 */
public class EmailDeliveryException extends RuntimeException {
    public EmailDeliveryException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

**`SubscriptionWelcomeEmailService`/`SubscriptionWelcomeEmailServiceImpl` (new) - this specific email's content, composed on top of the generic primitive:**

```java
// backend/src/main/java/com/cricketlegend/service/SubscriptionWelcomeEmailService.java (new)
package com.cricketlegend.service;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.Product;
import com.cricketlegend.domain.Subscription;

/**
 * docs/specs/017-subscription-welcome-email.md. Composes the welcome email's subject/HTML body
 * (via the shared email/base-layout.html Thymeleaf fragment) and sends it through EmailService.
 * One method, one email - a future welcome-adjacent email (e.g. a renewal reminder) gets its own
 * method here, or its own service, not a growing parameter list on this one.
 */
public interface SubscriptionWelcomeEmailService {
    /** @throws com.cricketlegend.exception.EmailDeliveryException if EmailService.send(...) fails */
    void sendWelcomeEmail(Person responsiblePerson, Subscription subscription, Club club, Product product);
}
```

```java
// backend/src/main/java/com/cricketlegend/service/impl/SubscriptionWelcomeEmailServiceImpl.java (new)
package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.Product;
import com.cricketlegend.domain.Subscription;
import com.cricketlegend.service.EmailService;
import com.cricketlegend.service.SubscriptionWelcomeEmailService;
import java.net.URI;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

@Service
public class SubscriptionWelcomeEmailServiceImpl implements SubscriptionWelcomeEmailService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.UK);

    private final EmailService emailService;
    private final SpringTemplateEngine templateEngine;
    private final String frontendBaseUrl;
    private final String supportAddress;

    public SubscriptionWelcomeEmailServiceImpl(
            EmailService emailService,
            SpringTemplateEngine templateEngine,
            @Value("${app.frontend.base-url}") String frontendBaseUrl,
            @Value("${app.mail.support-address}") String supportAddress) {
        this.emailService = emailService;
        this.templateEngine = templateEngine;
        this.frontendBaseUrl = frontendBaseUrl;
        this.supportAddress = supportAddress;
    }

    @Override
    public void sendWelcomeEmail(Person person, Subscription subscription, Club club, Product product) {
        Context context = new Context();
        context.setVariable("firstName", person.getFirstName());
        context.setVariable("clubName", club.getName());
        context.setVariable("productName", product.getName());
        context.setVariable("startDate", DATE_FORMAT.format(subscription.getStartDate()));
        context.setVariable("endDate", subscription.getEndDate() == null
                ? "Ongoing - no fixed end date"
                : DATE_FORMAT.format(subscription.getEndDate()));
        context.setVariable("loginUrl", buildClubLoginUrl(club.getSlug()));
        context.setVariable("supportAddress", supportAddress);

        String htmlBody = templateEngine.process("email/subscription-welcome", context);
        String subject = "Welcome to " + club.getName() + " on Cricket Legend, " + person.getFirstName() + "!";

        emailService.send(person.getEmail(), person.getFirstName() + " " + person.getLastName(), subject, htmlBody);
    }

    private String buildClubLoginUrl(String slug) {
        // Same URL shape ui/src/pages/view/LandingPage/FindYourClubLogin.tsx's goToClubLogin
        // already builds client-side - see judgment call #7 for why app.frontend.base-url is
        // reused rather than a new "root domain" property being added.
        URI base = URI.create(frontendBaseUrl);
        return base.getScheme() + "://" + slug + "." + base.getAuthority() + "/login";
    }
}
```

**`SubscriptionServiceImpl.create()` - one more best-effort step, added after the existing two:**

```java
// backend/src/main/java/com/cricketlegend/service/impl/SubscriptionServiceImpl.java (amended)
Subscription subscription = subscriptionMapper.toEntity(request);
subscription.setResponsiblePersonId(responsiblePerson.getId());
subscription = subscriptionRepository.save(subscription);

grantClubAdminAccess(responsiblePerson, subscription.getOwnerId());
provisionKeycloakAccountIfNeeded(responsiblePerson, subscription);
sendWelcomeEmailBestEffort(responsiblePerson, subscription, club, product);

return toDto(subscription, club, product, responsiblePerson);
```

```java
private void sendWelcomeEmailBestEffort(Person person, Subscription subscription, Club club, Product product) {
    // Fires on every create() call, unlike provisionKeycloakAccountIfNeeded's one-time guard -
    // this email's content (product, dates, club) is specific to THIS Subscription. A person
    // responsible for a second Club's Subscription gets a second, differently-scoped welcome
    // email, not silently none - see judgment call #2.
    try {
        subscriptionWelcomeEmailService.sendWelcomeEmail(person, subscription, club, product);
    } catch (EmailDeliveryException e) {
        // Same best-effort posture 016 already established for Keycloak provisioning (judgment
        // call #2 there) - an SMTP outage never fails Subscription creation. No retry mechanism,
        // no admin-visible "email failed" indicator - logged only, same accepted gap (see
        // judgment call #3 / Non-goals / Rollout Notes).
        log.error(
                "Welcome email failed to send for person {} (subscription {}, club {}): {}",
                person.getId(), subscription.getId(), subscription.getOwnerId(), e.getMessage(), e);
    }
}
```

`SubscriptionServiceImpl`'s constructor gains one new dependency, `SubscriptionWelcomeEmailService subscriptionWelcomeEmailService`, injected alongside the existing `KeycloakProvisioningService` - the same shape `016` already used to add its own new dependency to this class.

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `POST /api/v1/platform/subscriptions` | `platform_admin` | **Behaviour change only, same request/response shape as `009`/`014`/`016`.** Additionally sends the responsible `Person` a welcome email once the Subscription (and its `RoleAssignment` grant, and any Keycloak provisioning) are already saved. Best-effort - a failed send never changes the response status or shape. |

No other endpoint changes. `GET`/`PUT`/`cancel` are all untouched - this email is sent once, at creation time, only.

## UI Requirements

None. This spec has no frontend surface - no new endpoint the frontend calls, no new page, no `ui/` change at all, matching `013`'s own precedent for a backend-and-infrastructure-only spec.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `EmailServiceImplTest` (new) - a mocked `JavaMailSender`/`MimeMessage` receives the correct from-address/name, to-address, subject, and HTML body with `isHtml=true`; any exception thrown by the mocked sender is wrapped in `EmailDeliveryException`. `SubscriptionWelcomeEmailServiceImplTest` (new, real `SpringTemplateEngine` against the checked-in templates, no Spring context needed) - the rendered HTML contains the substituted `firstName`/`clubName`/`productName`/formatted `startDate`; a `null` `endDate` renders "Ongoing - no fixed end date" instead of a blank/`null` string; the built `loginUrl` correctly prefixes the club's `slug` onto `app.frontend.base-url`'s own scheme/authority; the subject line contains the club name and the person's first name; `EmailService.send(...)` is called with the person's own email as the to-address. `SubscriptionServiceImplTest` (extended) - `create()` calls `subscriptionWelcomeEmailService.sendWelcomeEmail(...)` exactly once per call, including on a *second* `create()` call for a `Person` who's already Keycloak-provisioned (the regression proving this call is **not** gated the way Keycloak provisioning is - judgment call #2); a thrown `EmailDeliveryException` is caught, logged, and does **not** propagate - `create()` still returns a `SubscriptionDto` with `201`-equivalent success. |
| Integration | `SubscriptionControllerIntegrationTest` (extended) - `@MockitoBean SubscriptionWelcomeEmailService`, mirroring the exact `@MockitoBean KeycloakProvisioningService` pattern already in this file (per its own Javadoc, avoiding a real network call to an SMTP server that isn't running in CI); the existing `createValidSubscriptionPersistsAsActiveWithStatus201` test gains an assertion that `sendWelcomeEmail(...)` was invoked once with the correct `Person`/`Subscription`/`Club`/`Product`; a new test mirroring `createStillReturns201WhenKeycloakProvisioningThrows` - stubbing the mocked service to throw `EmailDeliveryException` still yields `201` and a persisted Subscription. |
| Contract | No schema change - `SubscriptionDto`'s shape, and every existing endpoint's documented shape, is confirmed unchanged in the checked-in OpenAPI schema, matching `016`'s own precedent for its invisible-to-the-wire Keycloak side effect. |
| Component | Not applicable - no frontend surface (`docs/standards/testing.md`'s Component tier is frontend-facing only), same precedent `013` already set for a backend-only spec. |
| End-to-end | Not wired into CI, same precedent as `005`/`008`-`016` - needs a real local SMTP sink. Manual/local Playwright-adjacent run: stand up a local Mailpit/MailHog instance, point `spring.mail.host`/`port` at it (already the default), create a Subscription through the admin UI, confirm the welcome email arrives at the sink with the correct club/product/date content, correct theme colours rendered, and a login link that resolves to that exact club's own subdomain `/login` route. |

## Acceptance Criteria

- Creating a Subscription successfully sends exactly one welcome email to the responsible `Person`'s own email address, naming the correct club, product, start date, and (if set) end date.
- A Subscription with no `endDate` produces a welcome email that reads "Ongoing - no fixed end date," never a blank or literal `null`.
- The welcome email's login link resolves to `{club's slug}.{the same host/scheme app.frontend.base-url resolves to}/login` - the same URL shape `FindYourClubLogin.tsx`'s `goToClubLogin` already produces client-side.
- A person responsible for two different clubs' Subscriptions receives two separate welcome emails, each correctly naming its own club/product/dates - not one email, and not a second email silently suppressed.
- An SMTP outage (or any other `EmailDeliveryException`) during Subscription creation does not prevent the Subscription, its `RoleAssignment` grant, or its Keycloak provisioning from completing - verifiable by a unit test simulating a thrown `EmailDeliveryException`.
- No Keycloak realm configuration, client, or email template is created, checked, or referenced anywhere in this spec's implementation - this spec's SMTP client and templates are entirely this application's own, independent of `016`'s Keycloak-side mechanism.
- The base email layout (`email/base-layout.html`) exists as a standalone, checked-in template file, reusable by a future email's own content template without needing this spec's own Java classes to change.
- `POST /api/v1/platform/subscriptions`'s request/response schema is byte-for-byte unchanged in the checked-in OpenAPI diff.

## Rollout Notes

- Ships as its own PR, amending `016`'s already-merged `SubscriptionServiceImpl` (which itself amended `014`'s) - no dependency on any other in-flight spec.
- **Found and fixed during `test-writer`'s own pass, both worth recording rather than leaving as unnamed gaps:** `base-layout.html`'s checked-in HTML sketch above (and the code transcribed from it) never declared `th:fragment="layout(content)"` on its root `<html>` tag - `subscription-welcome.html`'s own `th:replace="~{email/base-layout :: layout(~{::content})}"` therefore could never resolve, and every real (non-mocked) render threw `TemplateInputException`. Since that exception is not an `EmailDeliveryException`, it propagated straight out of `create()` - directly breaking judgment call #3's best-effort guarantee the moment this ran for real, caught only because the spec's own Test Plan requires `SubscriptionWelcomeEmailServiceImplTest` to exercise a real `SpringTemplateEngine` against the real templates rather than mocking rendering away too. Fixed in both the template and this section above. Additionally hardened `SubscriptionWelcomeEmailServiceImpl.sendWelcomeEmail` itself to wrap its entire body (template rendering included, not just the final `EmailService.send(...)` call) in a try/catch converting any exception to `EmailDeliveryException` - closes this class of gap generally, not just this one instance, so a future template bug can't repeat it.
- **Found and fixed during `standards-reviewer`'s pass, before this PR opened:** `base-layout.html`'s `<title th:text="${subject}">` read a Thymeleaf context variable the implementation never actually set - `sendWelcomeEmail` only ever built a local Java `subject` string, passed directly to `EmailService.send(...)`, entirely separate from the Thymeleaf `Context`. Thymeleaf resolves a missing context variable to `null` rather than throwing, so this never tripped the best-effort catch above - it just rendered every real welcome email's HTML `<title>` empty, silently. Fixed by moving the `subject` computation earlier and calling `context.setVariable("subject", subject)` before `templateEngine.process(...)`; a new regression test (`sendWelcomeEmailPropagatesTheSameSubjectIntoTheRenderedHtmlsTitleTag`) asserts on the rendered `<title>` tag's actual content so a future base-layout consumer can't silently repeat this.
- No migration - confirmed above, nothing to sequence against `012-add-person-keycloak-provisioned-at.sql` (the current highest-numbered migration).
- **`docs/deployment.md`'s "Email / SMTP - not yet configured anywhere" section needs a real edit as part of this spec's PR** - it currently only names the gap for `016`'s Keycloak-side invite email; it should be updated to note this application's own `spring.mail.*` now exists too, that both can share one local Mailpit/MailHog sink in development (judgment call #5 - a one-line `docker run` command, not a committed docker-compose service, since this spec doesn't touch `docker-compose.logging.yml` or add a second compose file), and that a real SMTP provider plus SPF/DKIM/DMARC DNS records for `cricketlegend.co.za` are still an open decision needed before either consumer works end-to-end in a real deployed environment.
- **`docs/roadmap.md`'s "Next up - notifications / email infrastructure" entry is resolved by this spec for its first named use case** (the Subscription responsible party's welcome email) - its own PR should update that entry, noting that the reusable `EmailService`/base-layout primitive now exists for the entry's second named use case (the self-serve signup flow's OTP-verification step) and for `003`'s still-unbuilt `Invitation` admin-invite email to reuse next, the same "flag as a reusable primitive for a named future spec" pattern `016`'s own Rollout Notes already used for `KeycloakProvisioningService`.
- **Flag for whenever a "Club Contacts" spec exists** (`docs/roadmap.md`'s "Next up, not yet spec'd" item under `003`): judgment call #6's fixed `app.mail.support-address` line is a deliberate placeholder - revisit showing that club's own primary contact instead of, or alongside, the generic platform address once that data exists.
- **Flag for whenever a server-side equivalent of `ClubBranding`'s runtime primary-colour override exists:** this email's HTML is deliberately platform-default-themed only (Non-goals) - revisit once resolving a club's own brand colour outside the SPA (e.g. from `ClubProfile`, `012`) is a real, callable service, not just `ui/src/theme.ts`'s `withClubBranding()`.
- **No retry mechanism or admin-visible indicator for a failed welcome-email send** (judgment call #3) - same accepted gap `016` already named for its own Keycloak provisioning step, now present twice in the same method. Worth a joint follow-up ("Subscription-creation side-effect health/retry dashboard," covering both this and `016`'s own gap) if either turns out to be a real, recurring operational pain point once this runs in production.
- **This spec's two new Maven dependencies (`spring-boot-starter-mail`, `spring-boot-starter-thymeleaf`) are both official Spring Boot starters** - no manual version pin needed, and neither should be assumed to auto-configure anything beyond what this spec actually uses (`JavaMailSender`, `SpringTemplateEngine`) - a plan built from this spec should double-check `spring-boot-starter-thymeleaf`'s auto-configured `ViewResolver` bean doesn't interfere with any existing `@RestController` behaviour (it shouldn't - no controller in this codebase returns a view name - but worth a quick confirmation at implementation time, the same "confirm, don't assume" discipline `016` applied to its own Keycloak version pin).
