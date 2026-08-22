# 016 — Keycloak Account Provisioning

**Depends on:** `001-tenancy-identity-model.md` (`Person`/`RoleAssignment` — this spec is the first to actually create a `RoleAssignment` row, not just resolve one), `002-realm-subdomain-auth.md` (the identity-vs-authorization split, the `platform-web` public client and its wildcard redirect URI, the `GET /api/v1/me/access` shape this spec builds a narrower first version of), `006-post-login-home-shells.md` (`ManagerHome.tsx`/`GridNavShell`, the destination shell this spec finally routes a real login into — built, unchanged by this spec), `013-centralized-logging.md` (`RequestCorrelationFilter`'s JWT-`sub`-as-`Authentication.getName()` precedent, and the "Configuration & Infrastructure Changes" section shape this spec reuses), `014-subscription-responsible-contact.md` (`Person`, `PersonService.findOrCreatePerson`, the "bridge by email" pattern this spec reuses for first login), `015-person-status-and-role-assignment.md` (`PersonStatus`, `RoleAssignment`/`RoleAssignmentRepository`, `AccessService.canAdministerClub` — this spec is the "next spec" `015`'s own Rollout Notes named and is what makes its `RoleAssignment` branch reachable in production for the first time).
**Status:** draft.

## Problem & Goals

`014` resolves a real `Person` for a Subscription's responsible party. `015` gave that `Person` a `status` lifecycle and built a real `RoleAssignment` table, wiring `AccessService.canAdministerClub` to check it — but flagged its own branch as "correct but dormant," because nothing sets `Person.keycloakUserId`. Nobody can actually log in as that `Person` today: no Keycloak account exists for them, no invite is ever sent, and even if one existed, a successful login has nowhere to resolve back to a `Person` or a shell to land on. This spec closes that loop end to end: provisioning a real Keycloak account when a Subscription is created, sending a working password-reset invite, resolving that account back to its `Person` on first login, and routing that login to the Manager shell `006` already built.

**Goals**
- Creating a Subscription provisions a real, login-capable Keycloak account for its responsible `Person`, if they don't already have one — reusing `014`'s established "don't create a second identity for someone the system already knows" discipline, this time for a Keycloak account rather than a `Person` row.
- That `Person` is granted a `CLUB_ADMIN` `RoleAssignment`, scoped to the Subscription's owning `Club`, via `RoleAssignmentRepository` directly — the exact next consumer `015`'s own Rollout Notes named.
- Keycloak sends a real password-reset invite email (`execute-actions-email`, `UPDATE_PASSWORD`) — not just a "required action" nobody's ever notified about.
- On first successful login, the backend resolves the JWT to a `Person` by email (the JWT has no `keycloakUserId` match yet), sets `Person.keycloakUserId`, and flips `Person.status` from `PENDING` to `ACTIVE`.
- That first (and every subsequent) login for a `CLUB_ADMIN`-only `Person` lands on `/manage` — `006`'s existing `ManagerHome`/`GridNavShell` — not `/admin`.
- `AccessService.canAdministerClub`'s `RoleAssignment` branch (`015`) becomes reachable in production for the first time.

## Non-goals

- **Self-serve signup.** This is admin-initiated provisioning, triggered when a platform admin creates a Subscription — not a human registering themselves. `docs/roadmap.md`'s separate, still-unspec'd self-serve item is untouched.
- **Per-club branded Keycloak email templates.** Keycloak's default realm-wide email templates are used as-is. A fully branded, per-club-themed reset email is real custom Keycloak theme work, out of proportion to this pass, and orthogonal to `001`'s white-labelling model (which brands the app's own UI, not Keycloak's server-rendered emails). Flagged for `docs/roadmap.md`.
- **General notification/email infrastructure for the app's own use.** Only Keycloak's own SMTP configuration (Realm Settings → Email) is set up here, entirely separate from `docs/roadmap.md`'s still-unbuilt notifications/email-infrastructure spec. This spec sends zero emails from application code.
- **A UI to manually retry a failed provisioning attempt.** Provisioning failure is caught, logged, and leaves `Person.keycloakProvisionedAt` unset so a future retry mechanism has a clean signal to act on — but no such mechanism, and no admin-visible "provisioning failed" indicator, is built here. See Real Architectural Judgment Calls below and `docs/roadmap.md`.
- **A `RoleAssignment` management UI.** Still `015`'s own flagged gap, not resolved here. This spec's own grant is a direct `RoleAssignmentRepository.save(...)` call inside `SubscriptionServiceImpl`, exactly as `015`'s Rollout Notes anticipated — no `RoleAssignmentService`, no admin screen to view/revoke grants.
- **Any change to `platform_admin`'s own behavior, or to `SecurityConfig`'s `/api/v1/platform/**` gate.** `platform_admin` stays a flat Keycloak realm role, untouched, still a superset/override of everything this spec builds — see `015`'s own Non-goals, unchanged here.
- **Keycloak realm-role or group configuration for authorization.** `RoleAssignment` remains the sole authorization mechanism, entirely in the app's own database (`002`, `015`). Keycloak only ever carries identity (`sub`, `email`) — nothing here adds a Keycloak-side role, group, or client scope for permission purposes.
- **A real backend-verified authorization gate on the `/manage` route itself**, preventing an arbitrary authenticated user with no `CLUB_ADMIN` grant from typing `/manage` directly into the address bar. `006`'s own Non-goals already deferred "Manager authorization" pending `001`'s role model; this spec supplies the real signal (`RoleAssignment`, a resolved login) but only wires the **post-login routing decision** — where a fresh login is sent immediately after authenticating — not a standing guard on the route for direct navigation thereafter. A genuine route guard is a distinct, slightly larger piece of work (the Manager shell would need its own `useQuery`-backed identity check, mirroring `AdminHome`'s `getAdminIdentity` pattern) — flagged for a follow-up, not silently assumed solved by this spec.
- **`PersonStatus`-aware authorization enforcement.** `AccessService.canAdministerClub` checks for a matching `RoleAssignment` only — it does not, and this spec does not make it, consult `Person.status`. A `SUSPENDED` `Person` (nothing in this codebase can actually set that status yet — `015`'s own flagged gap) would still authenticate via Keycloak and still pass `canAdministerClub`'s check once bridged. Not resolved here; flagged again for whoever eventually makes `SUSPENDED` load-bearing (`015` and `docs/roadmap.md` already flag this same gap from the other direction).
- **Gating `findOrCreatePerson`/Keycloak provisioning on an existing `Person`'s `status`.** A `SUSPENDED` (or, after this spec, `PENDING`) `Person` found by email is still linked and still (if not already provisioned) provisioned — same "link, don't overwrite, don't status-check" posture `015` already established and flagged as unresolved.
- **Concurrency handling for two near-simultaneous Subscription creates racing on the same brand-new responsible party.** Same accepted, rare-edge-case posture `011`/`014` already established for their own non-atomic writes — not solved with locking here.
- **Storing the Keycloak-side user id Keycloak returns at account-creation time.** Deliberately discarded once `execute-actions-email` has been triggered — see Data Model Changes for why `Person.keycloakUserId` is set only later, at first login, by resolving the JWT's own `sub`, not by trusting a value the backend generated earlier.
- **`SECTION`/`TEAM`-scoped grants, `SECTION`-owned Subscriptions, and everything else `009`/`014`/`015` already ruled out.** None reopened here — this spec's `RoleAssignment` grant is `CLUB`-scoped only, matching the only owner type `Subscription` supports.

## User Stories

- As a platform admin, when I create a Subscription for a Club whose responsible person has never had a Subscription before, that person gets a real Keycloak account and receives a password-reset invite email, without me doing anything beyond filling in the Subscription form exactly as I already do today (`014`).
- As a platform admin, when I create a second Subscription for a person who's already responsible for another Club, they do **not** get a second Keycloak account or a second invite email — they get a second `CLUB_ADMIN` grant, scoped to the new Club, added to the one account they already have (or already have pending).
- As the person responsible for a Subscription, I receive an email, click the link, set my password, and log in — and I land on a Manager dashboard, not an admin console I have no business being in.
- As the platform's authorization layer, once that person has logged in once, every subsequent request correctly resolves their `CLUB_ADMIN` grant via `AccessService.canAdministerClub` — the branch `015` built and flagged as dormant is now live.
- As a developer reading `SubscriptionServiceImpl.create()`, I can see clearly that a Keycloak outage never blocks a Subscription from being created — the Subscription and its responsible `Person` are always saved first; Keycloak provisioning is a best-effort step after, logged if it fails, not rolled back into.

## Real Architectural Judgment Calls

Resolved explicitly here, not silently assumed — a reviewer should be able to challenge each one on its own terms.

**1. Transactional posture: Subscription/Person persist first, Keycloak provisioning second, non-atomic — same posture `011` already accepted for `POST /clubs` → `POST /subscriptions`.**
`SubscriptionServiceImpl.create()` today has no `@Transactional` wrapping it at all — `personService.findOrCreatePerson(...)` and `subscriptionRepository.save(...)` are already two independent, auto-committing writes, each safe on its own. This spec adds two more steps after the Subscription is saved: granting the `RoleAssignment` (a local DB write, always attempted) and calling Keycloak's Admin API (an external HTTP call, best-effort). If Keycloak is down or errors, the Subscription and its `RoleAssignment` grant are already durably saved — the `Person` is left `PENDING` with `keycloakProvisionedAt` still `null`, a Club exists with an assigned owner, and nothing about the *business* record is lost or rolled back. The alternative — calling Keycloak first and only saving the Subscription if it succeeds — would mean a transient Keycloak outage blocks a platform admin from doing an entirely local, otherwise-successful operation (linking a Club to a Product). That's the wrong failure mode for an internal business action to inherit from an external system's uptime, and it's exactly the trade `011`'s Rollout Notes already accepted for its own two-step, non-atomic `POST /clubs` → `POST /subscriptions` sequence. Persist-first, provision-second is the consistent continuation of that same posture.

**2. What happens if Keycloak provisioning fails: caught, logged, no retry mechanism, no admin-visible flag — a real, named gap, not silently absorbed.**
`KeycloakProvisioningException` is caught inside `SubscriptionServiceImpl.create()` itself, logged at `ERROR` with the `Person`/`Subscription`/`Club` ids in the message (see Data Model Changes — `RequestCorrelationFilter`'s path-derived `clubId` MDC key doesn't fire for `/platform/subscriptions/**`, so the ids are put directly in the log message instead of relying on MDC), and swallowed — the `POST /subscriptions` response still succeeds. `Person.keycloakProvisionedAt` stays `null`, which is the one honest signal that provisioning never completed; nothing currently reads that signal to retry automatically, and no admin screen surfaces it. This is a real, deliberate gap for this pass, not an oversight — flagged in Non-goals and `docs/roadmap.md`. The alternative (failing the whole Subscription creation) was rejected by judgment call #1's reasoning above.

**3. Multi-grant behaviour: yes, a second `Club` means a second `RoleAssignment` row — `015`'s "one row per grant" design, now actually exercised.**
`SubscriptionServiceImpl.create()` grants a `CLUB_ADMIN` `RoleAssignment` scoped to `request.ownerId()` every time a Subscription is created, guarded only by `RoleAssignmentRepository.existsByPersonIdAndRoleAndScopeTypeAndScopeId(...)` (already built by `015`) to stay idempotent against an unlikely exact-duplicate re-grant for the *same* Club — never against granting a *different* Club. A `Person` responsible for three Clubs ends up with three `CLUB_ADMIN` rows, each independently resolvable by `AccessService.canAdministerClub(authentication, clubId)`. This was always `001`'s design and `015`'s first real implementation of it; this spec is simply the first to actually produce more than one row for the same `Person`.

**4. `Person.status` for a newly-provisioned account: `PENDING`, not `ACTIVE` — a direct amendment of `015`'s `PersonServiceImpl.findOrCreatePerson`, safe because it has exactly one caller.**
`015` defaulted `findOrCreatePerson`'s create branch to `ACTIVE`, reasoned explicitly at the time: nothing in that spec's own scope could ever move a `Person` out of `PENDING`, so defaulting there would strand every new `Person` in a state the codebase couldn't yet resolve. This spec is exactly what removes that constraint — first-login activation (below) is the mechanism that flips `PENDING` → `ACTIVE`. Confirmed by grep (repeated here, not re-derived from scratch): `SubscriptionServiceImpl.create()` is the *only* call site of `PersonService.findOrCreatePerson` anywhere in `backend/src/main/java` — no `Person`-management screen, no `Invitation` flow (`003`, still unbuilt), nothing else reaches it. Changing the default therefore can't silently break a second caller's expectations, because there isn't one. `PersonServiceImpl.findOrCreatePerson`'s create branch changes from `.status(PersonStatus.ACTIVE)` to `.status(PersonStatus.PENDING)` — see Data Model Changes. `015`'s own unit test asserting `ACTIVE`-on-create is updated in this spec's PR to assert `PENDING`-on-create instead; `015`'s Javadoc/spec text describing `ACTIVE` as the default is superseded by this file, not edited in place (matching this codebase's "don't rewrite an already-shipped spec's own reasoning, supersede it explicitly" convention — see `014`'s Rollout Notes for the precedent). The "link, don't overwrite" rule is unaffected: an existing `Person` found by email keeps whatever `status` they already have, exactly as `015` built it — only the create branch's default changes.

**5. First-login activation's trigger: a dedicated `POST /api/v1/me/activate` endpoint the frontend calls once after Keycloak auth resolves — not a filter, not a per-request check.**
Investigated `SecurityConfig.java` and `RequestCorrelationFilter.java` (`013`) before deciding. A filter hooked into every authenticated request was rejected outright on the performance grounds the task itself names: after the very first login, `Person.keycloakUserId` is already set, so a filter would need to run a cheap "is it already set" check on literally every request forever to skip the expensive path — and even that cheap check is pure overhead for the ~100% of requests where nothing changes. A one-time, explicitly-called endpoint sidesteps this entirely: it runs exactly once per login (called by the new `PostLoginRedirect` page, below, immediately after `keycloak.init()` resolves), is naturally idempotent (a second call against an already-bridged `Person` is just a fast `findByKeycloakUserId` lookup, no write), and doubles as the exact mechanism the frontend needs anyway to *decide where to route the login* (judgment call #6) — one round trip serves both jobs instead of two. `SecurityConfig`'s filter chain and `JwtAuthenticationConverter` are untouched by this spec.

**6. Manager-view routing: `006` built the destination shell but never the routing decision that reaches it — this spec's own real gap to close, not something already handled.**
Reading `006-post-login-home-shells.md` in full and the actual current code (`ui/src/pages/view/Login.tsx`, `ui/src/App.tsx`) confirms `006` built exactly what its own scope says: three shells, reachable by URL, with no login-time decision about which one a given login should land on. Today, `Login.tsx` hardcodes `keycloak.login({ redirectUri: `${origin}/admin` })` unconditionally — **every** successful login, `platform_admin` or not, lands on `/admin`, and `AdminHome`'s `getAdminIdentity()` call 403s for anyone without `platform_admin`, rendering an "Not authorized" `EmptyState` (existing behaviour, unchanged for that case). There is no existing mechanism anywhere in this codebase that would route a `CLUB_ADMIN`-only login to `/manage` — `006`'s job stopped at building the shell, correctly, since no real identity signal existed yet to route by. This spec supplies that signal (`POST /me/activate`'s response) and the one small piece of connective routing logic (`PostLoginRedirect`, below) that was always going to be needed once a real non-`platform_admin` login existed to route — see UI Requirements.

## Data Model Changes

**`Person` gains one new nullable column — the only schema change this spec needs**, confirming the task's own expectation that `014`/`015` already built almost everything required:

```java
// backend/src/main/java/com/cricketlegend/domain/Person.java (amended)
@Column(name = "keycloak_provisioned_at")
private Instant keycloakProvisionedAt;
```

**Why this one field is necessary, and why it's not redundant with `keycloakUserId`:** `keycloakUserId` is set only at first login (judgment call #5) — by design, per the task's own "bridge by email" instruction, the backend never trusts or stores the Keycloak-generated id it receives back from the `POST /users` call at provisioning time, only the JWT `sub` a real login later proves. That leaves a real gap: between "a Keycloak account was created and an invite sent" and "that person actually logged in," `keycloakUserId` is `null` — indistinguishable, on that column alone, from "never provisioned at all." Without a second signal, a `Person` made responsible for a *second* Subscription before completing their *first* password reset would trigger a second `POST /admin/realms/cricketlegend/users` call for the same email — which Keycloak would reject (emails are unique per realm), turning an ordinary multi-club scenario into an avoidable provisioning failure. `keycloakProvisionedAt` (set only after both the user-create call and the `execute-actions-email` call succeed) is the honest, minimal signal that closes this gap: `SubscriptionServiceImpl.create()` only attempts provisioning when **both** `keycloakUserId == null` **and** `keycloakProvisionedAt == null`.

**Migration** (next sequential file after `011-add-role-assignment.sql`):

```sql
-- backend/src/main/resources/db/changelog/v1/012-add-person-keycloak-provisioned-at.sql
ALTER TABLE person ADD COLUMN keycloak_provisioned_at TIMESTAMPTZ;
```

Single nullable column add, no backfill needed — every existing `Person` row correctly has `null` here (none has ever been provisioned). Registered in `backend/src/main/resources/db/changelog/db.changelog-master.xml` alongside the existing eleven `<include>` entries.

**`PersonServiceImpl.findOrCreatePerson`'s create branch** (amending `015`'s version — see judgment call #4):

```java
// backend/src/main/java/com/cricketlegend/service/impl/PersonServiceImpl.java (amended)
.orElseGet(() -> personRepository.save(Person.builder()
        .firstName(firstName)
        .lastName(lastName)
        .email(email)
        .phone(phone)
        .status(PersonStatus.PENDING)   // was PersonStatus.ACTIVE as of 015 — see 016 judgment call #4
        .build()));
```

**`RoleAssignment`/`RoleAssignmentRepository`/`AccessService`: unchanged, used exactly as `015` shipped them.** No new field, no new query method — `RoleAssignmentRepository.save(...)` (inherited from `JpaRepository`) and the already-existing `existsByPersonIdAndRoleAndScopeTypeAndScopeId(...)` are sufficient. `AccessService` gains one small, purely-mechanical extraction (below), not a behaviour change.

**`AccessService` — extracting `isPlatformAdmin` so it has exactly one implementation, per `docs/standards/backend.md`'s "shared logic lives in one place" rule:**

```java
// backend/src/main/java/com/cricketlegend/config/AccessService.java (amended)
public boolean isPlatformAdmin(Authentication authentication) {
    if (authentication == null) {
        return false;
    }
    return authentication.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
            .anyMatch("ROLE_platform_admin"::equals);
}

public boolean canAdministerClub(Authentication authentication, UUID clubId) {
    if (authentication == null) {
        return false;
    }
    if (isPlatformAdmin(authentication)) {
        return true;
    }
    return personRepository
            .findByKeycloakUserId(authentication.getName())
            .map(person -> roleAssignmentRepository.existsByPersonIdAndRoleAndScopeTypeAndScopeId(
                    person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, clubId))
            .orElse(false);
}
```

`isPlatformAdmin` becomes the second real caller this spec needs (`MeServiceImpl`, below) — extracting it now, before writing that second call site, follows `docs/standards/backend.md`'s "extracted before the second use is written" rule to the letter, not after the fact.

## Configuration & Infrastructure Changes

Following `013-centralized-logging.md`'s precedent of a dedicated section for changes that aren't domain data model but are still concrete, checked-in configuration.

### 1. New Maven dependency

```xml
<!-- Keycloak Admin API client — server-to-server account provisioning, 016-keycloak-account-provisioning.md -->
<dependency>
    <groupId>org.keycloak</groupId>
    <artifactId>keycloak-admin-client</artifactId>
    <version>26.0.7</version> <!-- confirm at implementation time against the Keycloak server
                                    version actually deployed; keycloak-admin-client's Admin REST
                                    API surface is generally stable across recent majors, but pin
                                    and verify, don't assume -->
</dependency>
```

No Spring Boot starter exists for this (same situation `013` found for `loki-logback-appender`) — added directly, version-pinned.

### 2. New confidential Keycloak client — `platform-provisioning`

A second client in the `cricketlegend` realm, alongside the existing public SPA client (`platform-web`/`cricketlegend` locally — PKCE-only, no secret, per `002`). This new client is unsuitable to reuse for the SPA's own login flow and vice versa — they serve opposite trust models:

| Setting | Value |
|---|---|
| Client ID | `platform-provisioning` |
| Client authentication | On (confidential — has a secret) |
| Standard flow / Direct access grants | Off — this client never handles a browser login |
| Service accounts roles | **On** |
| Service account role | `manage-users` (from the `realm-management` client) — grants create/update/delete/execute-actions-email on realm users via the Admin REST API |

The client secret is backend configuration only (`app.keycloak.admin.client-secret`, below) — never sent to the browser, never referenced by anything in `ui/`.

### 3. Realm SMTP configuration (Keycloak Realm Settings → Email)

Keycloak needs its own outbound email transport configured for `execute-actions-email` to actually deliver anything — entirely separate from, and not a substitute for, `docs/roadmap.md`'s still-unbuilt application-level notifications spec. This is realm configuration (Keycloak's admin console or `kcadm.sh`), not application code — no code in this repo sets it. Local dev should point this at a catch-all SMTP sink (e.g. MailHog/Mailpit) so an invite email can actually be inspected without a real mail provider.

### 4. New Spring config properties

Following `012`/`013`'s `${ENV_VAR:default}` convention, added to `backend/src/main/resources/application.properties`:

```properties
# Keycloak Admin API — confidential service-account client for server-to-server user
# provisioning, distinct from the public platform-web/cricketlegend SPA client used for browser
# login (002-realm-subdomain-auth.md). 016-keycloak-account-provisioning.md.
app.keycloak.admin.server-url=${KEYCLOAK_ADMIN_SERVER_URL:http://auth.localhost:8180}
app.keycloak.admin.realm=${KEYCLOAK_ADMIN_REALM:cricketlegend}
app.keycloak.admin.client-id=${KEYCLOAK_ADMIN_CLIENT_ID:platform-provisioning}
app.keycloak.admin.client-secret=${KEYCLOAK_ADMIN_CLIENT_SECRET:}

# The PUBLIC SPA client id — reused only to pass as execute-actions-email's own client_id/
# redirect_uri params, so Keycloak's password-reset flow redirects back into the app rather than
# a bare Keycloak page. Same client 002/ui/src/auth/keycloak.ts already uses for login.
app.keycloak.public-client-id=${KEYCLOAK_PUBLIC_CLIENT_ID:cricketlegend}

# Base URL the frontend is served from — used only to build execute-actions-email's redirect_uri
# (.../post-login). 016-keycloak-account-provisioning.md.
app.frontend.base-url=${FRONTEND_BASE_URL:http://localhost:5173}
```

### 5. `KeycloakAdminClientConfig` — the Admin API client bean

```java
// backend/src/main/java/com/cricketlegend/config/KeycloakAdminClientConfig.java (new)
package com.cricketlegend.config;

import org.keycloak.OAuth2Constants;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.KeycloakBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Service-account-authenticated Keycloak Admin API client, per
 * docs/specs/016-keycloak-account-provisioning.md. Authenticates as the confidential
 * platform-provisioning client (client_credentials grant) — never the public SPA client browsers
 * use to log in.
 */
@Configuration
public class KeycloakAdminClientConfig {

    @Bean
    Keycloak keycloakAdminClient(
            @Value("${app.keycloak.admin.server-url}") String serverUrl,
            @Value("${app.keycloak.admin.realm}") String realm,
            @Value("${app.keycloak.admin.client-id}") String clientId,
            @Value("${app.keycloak.admin.client-secret}") String clientSecret) {
        return KeycloakBuilder.builder()
                .serverUrl(serverUrl)
                .realm(realm)
                .grantType(OAuth2Constants.CLIENT_CREDENTIALS)
                .clientId(clientId)
                .clientSecret(clientSecret)
                .build();
    }
}
```

### 6. Redirect URIs — confirmed, no new client-side config needed

`platform-web`/`cricketlegend`'s Valid Redirect URIs is already the wildcard `https://*.yourapp.com/*` (`https://*.localhost:5173/*`-equivalent locally) per `002` ADR-03 — the same client the `execute-actions-email` call's `redirect_uri` param points back into (`app.frontend.base-url` + `/post-login`, see below). Confirmed explicitly: no second client, no new allowlist entry, no `ui/src/auth/keycloak.ts` change is needed for the reset-link callback to land back on the right place — it's the exact same client and the exact same wildcard `002` already registered.

## New Domain Behaviour

**`SubscriptionServiceImpl.create()` — provisioning and grant, added after the existing Subscription save:**

```java
// backend/src/main/java/com/cricketlegend/service/impl/SubscriptionServiceImpl.java (amended)
Subscription subscription = subscriptionMapper.toEntity(request);
subscription.setResponsiblePersonId(responsiblePerson.getId());
subscription = subscriptionRepository.save(subscription);

grantClubAdminAccess(responsiblePerson, subscription.getOwnerId());
provisionKeycloakAccountIfNeeded(responsiblePerson, subscription);

return toDto(subscription, club, product, responsiblePerson);
```

```java
private void grantClubAdminAccess(Person person, UUID clubId) {
    boolean alreadyGranted = roleAssignmentRepository.existsByPersonIdAndRoleAndScopeTypeAndScopeId(
            person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, clubId);
    if (!alreadyGranted) {
        roleAssignmentRepository.save(RoleAssignment.builder()
                .personId(person.getId())
                .role(RoleAssignmentRole.CLUB_ADMIN)
                .scopeType(ScopeType.CLUB)
                .scopeId(clubId)
                .build());
    }
}

private void provisionKeycloakAccountIfNeeded(Person person, Subscription subscription) {
    if (person.getKeycloakUserId() != null || person.getKeycloakProvisionedAt() != null) {
        return; // already has, or already sent, an account — see judgment call #4 / Data Model Changes
    }
    try {
        keycloakProvisioningService.provisionAccount(person);
        person.setKeycloakProvisionedAt(Instant.now());
        personRepository.save(person);
    } catch (KeycloakProvisioningException e) {
        // Judgment call #2 — never fails Subscription creation over this. Subscription and its
        // RoleAssignment grant are already durably saved above; keycloakProvisionedAt stays null,
        // the one honest "not yet provisioned" signal for a future retry mechanism (not built).
        log.error(
                "Keycloak provisioning failed for person {} (subscription {}, club {}): {}",
                person.getId(), subscription.getId(), subscription.getOwnerId(), e.getMessage(), e);
    }
}
```

**`KeycloakProvisioningService`/`KeycloakProvisioningServiceImpl` (new):**

```java
// backend/src/main/java/com/cricketlegend/service/KeycloakProvisioningService.java (new)
package com.cricketlegend.service;

import com.cricketlegend.domain.Person;

/**
 * Per docs/specs/016-keycloak-account-provisioning.md. Caller is responsible for the
 * "don't call this twice for the same Person" guard (Person.keycloakUserId /
 * keycloakProvisionedAt) — this method always attempts to create a new Keycloak user.
 */
public interface KeycloakProvisioningService {

    /** @throws com.cricketlegend.exception.KeycloakProvisioningException if either Admin API call fails */
    void provisionAccount(Person person);
}
```

```java
// backend/src/main/java/com/cricketlegend/service/impl/KeycloakProvisioningServiceImpl.java (new)
package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Person;
import com.cricketlegend.exception.KeycloakProvisioningException;
import com.cricketlegend.service.KeycloakProvisioningService;
import jakarta.ws.rs.core.Response;
import java.util.List;
import org.keycloak.admin.client.CreatedResponseUtil;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.representations.idm.UserRepresentation;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class KeycloakProvisioningServiceImpl implements KeycloakProvisioningService {

    private final Keycloak keycloakAdminClient;
    private final String realm;
    private final String publicClientId;
    private final String resetRedirectUri;

    public KeycloakProvisioningServiceImpl(
            Keycloak keycloakAdminClient,
            @Value("${app.keycloak.admin.realm}") String realm,
            @Value("${app.keycloak.public-client-id}") String publicClientId,
            @Value("${app.frontend.base-url}") String frontendBaseUrl) {
        this.keycloakAdminClient = keycloakAdminClient;
        this.realm = realm;
        this.publicClientId = publicClientId;
        this.resetRedirectUri = frontendBaseUrl + "/post-login";
    }

    @Override
    public void provisionAccount(Person person) {
        UserRepresentation user = new UserRepresentation();
        user.setEnabled(true);
        user.setEmail(person.getEmail());
        user.setFirstName(person.getFirstName());
        user.setLastName(person.getLastName());
        user.setEmailVerified(false);

        String createdUserId;
        try (Response response = keycloakAdminClient.realm(realm).users().create(user)) {
            if (response.getStatus() != 201) {
                throw new KeycloakProvisioningException(
                        "Keycloak user creation failed for person " + person.getId()
                                + ": HTTP " + response.getStatus(), null);
            }
            createdUserId = CreatedResponseUtil.getCreatedId(response);
        } catch (KeycloakProvisioningException e) {
            throw e;
        } catch (Exception e) {
            throw new KeycloakProvisioningException(
                    "Keycloak user creation failed for person " + person.getId(), e);
        }

        try {
            keycloakAdminClient
                    .realm(realm)
                    .users()
                    .get(createdUserId)
                    .executeActionsEmail(publicClientId, resetRedirectUri, List.of("UPDATE_PASSWORD"));
        } catch (Exception e) {
            throw new KeycloakProvisioningException(
                    "execute-actions-email failed for person " + person.getId()
                            + " (Keycloak user " + createdUserId + " was created)", e);
        }
        // The Keycloak-generated createdUserId is deliberately not persisted anywhere — see
        // Non-goals. Person.keycloakUserId is set only at first login, from the JWT's own sub.
    }
}
```

**`KeycloakProvisioningException` (new):**

```java
// backend/src/main/java/com/cricketlegend/exception/KeycloakProvisioningException.java (new)
package com.cricketlegend.exception;

/**
 * Per docs/specs/016-keycloak-account-provisioning.md. Deliberately does NOT extend
 * NotFoundException/ConflictException/ValidationException (docs/standards/backend.md) — an
 * external-system integration failure, not a business-rule violation. Always caught inside
 * SubscriptionServiceImpl (judgment call #2) — never reaches GlobalExceptionHandler, never fails
 * a Subscription creation request.
 */
public class KeycloakProvisioningException extends RuntimeException {
    public KeycloakProvisioningException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

**`MeController`/`MeService`/`MeServiceImpl` (new) — first-login activation and access resolution, in one call:**

```java
// backend/src/main/java/com/cricketlegend/dto/MeAccessDto.java (new)
package com.cricketlegend.dto;

import com.cricketlegend.domain.PersonStatus;
import java.util.List;
import java.util.UUID;

public record MeAccessDto(
        UUID personId,             // null if this login resolves to no Person at all (e.g. a
                                    // platform_admin with no Person row — normal, not an error)
        PersonStatus personStatus, // null iff personId is null
        boolean platformAdmin,
        List<UUID> clubAdminClubIds) {
}
```

```java
// backend/src/main/java/com/cricketlegend/controller/MeController.java (new)
package com.cricketlegend.controller;

import com.cricketlegend.dto.MeAccessDto;
import com.cricketlegend.service.MeService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me")
class MeController {

    private final MeService meService;

    MeController(MeService meService) {
        this.meService = meService;
    }

    @PostMapping("/activate")
    MeAccessDto activate(Authentication authentication, @AuthenticationPrincipal Jwt jwt) {
        return meService.activateAndResolveAccess(authentication, jwt);
    }
}
```

```java
// backend/src/main/java/com/cricketlegend/service/impl/MeServiceImpl.java (new)
package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.dto.MeAccessDto;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.service.MeService;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Per docs/specs/016-keycloak-account-provisioning.md. Bridges a JWT to a Person by email
 * on first login only — the same "bridge by email" resolution
 * docs/specs/014-subscription-responsible-contact.md's PersonService.findOrCreatePerson already
 * established, reused here (not reimplemented) for identity rather than record de-duplication.
 * Safe to call on every login: once Person.keycloakUserId is set, the fast path is a single
 * indexed findByKeycloakUserId lookup with no write at all.
 */
@Service
public class MeServiceImpl implements MeService {

    private final PersonRepository personRepository;
    private final RoleAssignmentRepository roleAssignmentRepository;
    private final AccessService accessService;

    public MeServiceImpl(
            PersonRepository personRepository,
            RoleAssignmentRepository roleAssignmentRepository,
            AccessService accessService) {
        this.personRepository = personRepository;
        this.roleAssignmentRepository = roleAssignmentRepository;
        this.accessService = accessService;
    }

    @Override
    @Transactional
    public MeAccessDto activateAndResolveAccess(Authentication authentication, Jwt jwt) {
        boolean platformAdmin = accessService.isPlatformAdmin(authentication);
        String keycloakUserId = authentication.getName(); // JWT sub — see 013's same precedent

        Person person = personRepository.findByKeycloakUserId(keycloakUserId).orElse(null);
        if (person == null) {
            person = bridgeByEmail(keycloakUserId, jwt.getClaimAsString("email"));
        }

        List<java.util.UUID> clubAdminClubIds = person == null
                ? List.of()
                : roleAssignmentRepository.findByPersonId(person.getId()).stream()
                        .filter(ra -> ra.getRole() == RoleAssignmentRole.CLUB_ADMIN
                                && ra.getScopeType() == ScopeType.CLUB)
                        .map(com.cricketlegend.domain.RoleAssignment::getScopeId)
                        .toList();

        return new MeAccessDto(
                person == null ? null : person.getId(),
                person == null ? null : person.getStatus(),
                platformAdmin,
                clubAdminClubIds);
    }

    private Person bridgeByEmail(String keycloakUserId, String email) {
        if (email == null) {
            return null; // no email claim on this token — nothing to bridge against
        }
        Person person = personRepository.findByEmailIgnoreCase(email).orElse(null);
        if (person == null) {
            return null; // authenticated, but no Person record exists for this email at all
        }
        person.setKeycloakUserId(keycloakUserId);
        if (person.getStatus() == PersonStatus.PENDING) {
            person.setStatus(PersonStatus.ACTIVE);
        }
        return personRepository.save(person);
    }
}
```

`PersonRepository.findByEmailIgnoreCase` and `findByKeycloakUserId` are both already built (`014`, `015`) — no repository change needed. `RoleAssignmentRepository.findByPersonId` is likewise already built (`015`, originally flagged as "reusable by a future `/me/access` endpoint" — this is that endpoint's first real consumer).

## API Contract

| Endpoint | Access | Purpose |
|---|---|---|
| `POST /api/v1/me/activate` | Any authenticated user (falls under `SecurityConfig`'s existing `.anyRequest().authenticated()` — not under `/api/v1/platform/**`, no `SecurityConfig` change needed) | First-login activation and access resolution, in one call: bridges the JWT to a `Person` by email if not already linked, sets `keycloakUserId`, flips `PENDING` → `ACTIVE`, and returns `{ personId, personStatus, platformAdmin, clubAdminClubIds[] }`. Idempotent — safe to call on every login, cheap after the first (single indexed lookup, no write). Called once by `PostLoginRedirect` (below), immediately after Keycloak's own redirect completes. |
| `POST /api/v1/platform/subscriptions` | `platform_admin` | **Behaviour change, same request/response shape as `014`.** Additionally grants a `CLUB_ADMIN` `RoleAssignment` scoped to `ownerId`, and — if the responsible `Person` has no Keycloak account yet — provisions one and sends a password-reset invite. Both are best-effort side effects (judgment calls #1/#2); neither changes the response shape, and neither failing changes the response status. |

No other endpoint changes. `GET/PUT /api/v1/platform/subscriptions/**` and `GET /api/v1/platform/persons` are untouched.

## UI Requirements

- **`ui/src/api/meApi.ts` (new)**, one file per backend resource per `docs/standards/frontend.md`:

  ```ts
  import api from './axiosConfig'

  export interface MeAccess {
    personId: string | null
    personStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | null
    platformAdmin: boolean
    clubAdminClubIds: string[]
  }

  export async function activateSession(): Promise<MeAccess> {
    const { data } = await api.post<MeAccess>('/me/activate')
    return data
  }
  ```

- **`ui/src/pages/view/PostLoginRedirect.tsx` (new)** — a minimal transitional screen, styled identically to the existing `Login.tsx` ("Redirecting to login…") rather than introducing a new visual pattern. Uses `useQuery` (matching `AdminHome`'s existing `getAdminIdentity` convention, not a bespoke `useEffect`/async pattern) and navigates once resolved:

  ```tsx
  import { useEffect } from 'react'
  import { useNavigate } from 'react-router-dom'
  import { useQuery } from '@tanstack/react-query'
  import { Container, Typography } from '@mui/material'
  import { activateSession } from '../../api/meApi'

  export default function PostLoginRedirect() {
    const navigate = useNavigate()
    const { data, isError } = useQuery({ queryKey: ['me', 'activate'], queryFn: activateSession })

    useEffect(() => {
      if (isError) {
        navigate('/admin', { replace: true }) // same fallback as "no resolvable role" below
        return
      }
      if (!data) return
      if (data.platformAdmin) {
        navigate('/admin', { replace: true })
      } else if (data.clubAdminClubIds.length > 0) {
        navigate('/manage', { replace: true })
      } else {
        // No platform_admin authority and no CLUB_ADMIN grant — falls back to /admin, which
        // already renders its own "Not authorized" EmptyState for exactly this caller (005's
        // existing getAdminIdentity behaviour) rather than this page inventing a second one.
        navigate('/admin', { replace: true })
      }
    }, [data, isError, navigate])

    return (
      <Container maxWidth="sm" sx={{ py: 5, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">Signing you in…</Typography>
      </Container>
    )
  }
  ```

- **`ui/src/pages/view/Login.tsx`** — the one required change: `redirectUri` moves from the hardcoded `${origin}/admin` to `${origin}/post-login`, so every login now routes through the decision point above instead of assuming `/admin`.

  ```diff
  - keycloak.login({ redirectUri: `${window.location.origin}/admin` })
  + keycloak.login({ redirectUri: `${window.location.origin}/post-login` })
  ```

- **`ui/src/App.tsx`** — one new top-level route, club-agnostic like `/login` and `/admin` already are (a comment in `App.tsx` already explains why: a platform admin's — and now a `CLUB_ADMIN`'s — `RoleAssignment` isn't resolved from the URL's club subdomain in this codebase yet):

  ```tsx
  <Route path="/post-login" element={<PostLoginRedirect />} />
  ```

- **`ui/src/pages/manage/ManagerHome.tsx` — deliberately untouched.** Still renders `MOCK_MANAGER`'s static placeholder identity, exactly as `006` built it. This spec's job is getting the right login routed to this shell, not replacing its placeholder content with a real identity fetch — that remains `006`'s own still-open item (see Non-goals on the route guard).
- **Mobile-first**, per `docs/standards/frontend.md` — `PostLoginRedirect` is a single centered `Typography` at every breakpoint, no layout to adapt.

## Test Plan

| Tier | Coverage |
|---|---|
| Unit | `PersonServiceImplTest` (amended) — `findOrCreatePerson`'s create branch now asserts `status == PENDING`, not `ACTIVE`; the "link, don't overwrite" assertion for an existing `Person` (any status, unchanged) still passes as-is. `SubscriptionServiceImplTest` (extended) — `create()` grants a `CLUB_ADMIN` `RoleAssignment` scoped to `ownerId`; a second `create()` call for the same person against a different club id grants a second, independently-scoped row (judgment call #3); a second `create()` call for the same person against the *same* club id (edge case) does not violate the unique index (guarded by the `existsBy...` pre-check); `create()` calls `keycloakProvisioningService.provisionAccount(...)` when both `keycloakUserId` and `keycloakProvisionedAt` are `null`, and sets `keycloakProvisionedAt` on success; `create()` skips provisioning entirely when either is already set; a `KeycloakProvisioningException` thrown by the mocked provisioning service is caught, logged, and does **not** propagate — `create()` still returns a `SubscriptionDto` and `keycloakProvisionedAt` stays `null`. `KeycloakProvisioningServiceImplTest` (new, mocked `Keycloak` admin client) — `UserRepresentation` built with `enabled=true`/`emailVerified=false`/correct `email`/`firstName`/`lastName`; `executeActionsEmail` called with `["UPDATE_PASSWORD"]` and the configured `publicClientId`/`resetRedirectUri`; a non-`201` create response, or any thrown exception from either Admin API call, is wrapped in `KeycloakProvisioningException`. `MeServiceImplTest` (new) — a `Person` already resolvable by `keycloakUserId` is returned as-is, no email lookup attempted, no write; a `Person` resolvable only by email gets `keycloakUserId` set and `PENDING` flipped to `ACTIVE`; a `Person` found by email who is already `ACTIVE` (a second-device/second-browser first login, or a re-activation call) has their `status` left untouched, not reset; no `Person` at all (unknown email, or no email claim) returns `personId: null` without throwing; `clubAdminClubIds` correctly includes only `CLUB_ADMIN`/`CLUB`-scoped rows, excluding any `MANAGER`/`PLAYER` grant. `AccessServiceTest` (amended) — `isPlatformAdmin` covered directly as its own unit; `canAdministerClub`'s existing test matrix (per `015`) still passes unchanged against the refactor. |
| Integration | `PersonRepositoryTest` (extended, Testcontainers) — `012-add-person-keycloak-provisioned-at.sql` applies cleanly against a seeded pre-existing `person` row, column defaults to `NULL`, no backfill needed. `RoleAssignmentRepositoryTest` — no schema change, but a new assertion: two `CLUB_ADMIN` rows for the same `person_id` at two different `scope_id`s both persist and both come back from `findByPersonId` (already covered structurally by `015`'s own test, referenced here as regression coverage, not re-written). |
| Contract | `POST /api/v1/me/activate` and `MeAccessDto` reflected in the checked-in OpenAPI schema; `POST /api/v1/platform/subscriptions`'s request/response schema confirmed unchanged (the new side effects are invisible to the wire contract). |
| Component | `PostLoginRedirect.test.tsx` (new) — renders "Signing you in…"; navigates to `/admin` when `platformAdmin: true`; navigates to `/manage` when `clubAdminClubIds` is non-empty and `platformAdmin: false`; navigates to `/admin` when both are false/empty; navigates to `/admin` when `activateSession()` rejects. `Login.test.tsx` (amended, if it exists — otherwise new) — asserts `keycloak.login` is called with `redirectUri` ending in `/post-login`, not `/admin`. |
| E2E | Not wired into CI, same precedent as `005`/`008`–`011`/`014` — this one genuinely needs a real Keycloak with SMTP configured (see Configuration & Infrastructure Changes item 3), so it's a manual/local Playwright run, not a CI job: create a Subscription for a brand-new email against a local Keycloak (SMTP pointed at MailHog/Mailpit), confirm the invite email arrives, complete the password reset, confirm the browser lands back on `/post-login` and is redirected to `/manage`, confirm `AccessService.canAdministerClub` (exercised indirectly via `PUT /api/v1/platform/clubs/{id}/profile`, `012`'s existing `@PreAuthorize`-guarded endpoint) now returns `true` for that Club. A second Subscription created for the same email against a *different* Club confirms no second invite email is sent and the person gains a second `CLUB_ADMIN` grant only. |

## Acceptance Criteria

- Creating a Subscription for a brand-new responsible person creates exactly one Keycloak user in the `cricketlegend` realm and triggers exactly one `execute-actions-email` (`UPDATE_PASSWORD`) call.
- Creating a second Subscription for a person who already has a Keycloak account (set or pending) creates zero additional Keycloak users and sends zero additional invite emails — they get only a second `CLUB_ADMIN` `RoleAssignment`, scoped to the new Club.
- A newly-provisioned `Person`'s `status` is `PENDING` immediately after Subscription creation, not `ACTIVE`.
- Completing the Keycloak password-reset flow and logging in resolves that login to the correct `Person` (by email, since `keycloakUserId` wasn't set at creation time), sets `Person.keycloakUserId` to the JWT `sub`, and flips `status` to `ACTIVE`.
- That same login lands on `/manage`, not `/admin`, without the user navigating there manually.
- After that first login, `AccessService.canAdministerClub(authentication, clubId)` returns `true` for the Club(s) that person is `CLUB_ADMIN` for, and `false` for any other Club — `015`'s previously-dormant `RoleAssignment` branch is now genuinely exercised in production.
- A Keycloak outage during Subscription creation does not prevent the Subscription (or its `RoleAssignment` grant) from being created — verifiable by a unit test simulating a thrown `KeycloakProvisioningException`.
- No Keycloak realm role or group is created, checked, or referenced anywhere in this spec's implementation.
- `platform_admin` login behaviour (`AdminHome`, `getAdminIdentity`) is unchanged — a `platform_admin` login still lands on `/admin` exactly as before.
- `SecurityConfig`'s `/api/v1/platform/**` gate and `platform_admin` role check are byte-for-byte unchanged.

## Rollout Notes

- Migration `012-add-person-keycloak-provisioned-at.sql` is the next sequential migration after `011-add-role-assignment.sql` (the current highest-numbered file as of this spec).
- **Realm/client configuration (the `platform-provisioning` client, its `manage-users` service-account role, and realm SMTP settings) must exist before this spec's backend code will do anything useful** — none of it is created by application code or a migration. Treat as a deployment/environment prerequisite, the same way `002`'s realm itself already is.
- **Ships as its own PR**, amending `009`'s/`014`'s already-merged `SubscriptionServiceImpl`, `015`'s already-merged `PersonServiceImpl`/`AccessService`, and `006`'s already-merged `Login.tsx`/`App.tsx` — no dependency on any other in-flight spec.
- **`AccessService`'s "known, honest limitation" Javadoc note (`015`) is now resolved and should be removed/updated** as part of this spec's implementation — the `RoleAssignment` branch it describes as "correct but effectively unreachable in production" is exactly what this spec makes reachable. Flagged here so the doc comment doesn't go stale the way `014`'s `Contact.java` Javadoc briefly did (see `014`'s own Rollout Notes for that precedent and why it matters to fix promptly).
- **`015`'s own unit test asserting `ACTIVE`-on-create must be updated in this spec's PR** to assert `PENDING`-on-create instead (judgment call #4) — a plan built from this spec should flag this as an explicit "amend an existing test" step, not just new test coverage.
- **Flag for `docs/roadmap.md` (this spec's own PR updates that file directly, see below):** no retry mechanism or admin-visible indicator exists for a failed provisioning attempt (judgment call #2) — a `Person` stuck in `PENDING` with `keycloakProvisionedAt: null` is only discoverable today by a direct database query or a Grafana log search (`013`) for `KeycloakProvisioningException`. Worth a small follow-up spec once this has run in production long enough to know whether it's a real operational pain point.
- **Flag for whenever `PersonStatus.SUSPENDED` becomes a real, settable state:** neither `AccessService.canAdministerClub` nor `MeServiceImpl.bridgeByEmail` consult `status` at all today. Revisit both once something in this codebase can actually set `SUSPENDED` (still nobody's job — `015`'s original gap, restated here from the other direction).
- **Flag for a future "real Manager route guard" follow-up:** `PostLoginRedirect` decides where a *fresh login* goes, but nothing stops an already-authenticated user from typing `/manage` directly — `006`'s own deferred Non-goal, still deferred. `ManagerHome` gaining its own `useQuery`-backed identity check (mirroring `AdminHome`'s `getAdminIdentity`) would close this, likely by reusing `POST /api/v1/me/activate` itself (it's already idempotent and cheap after the first call) — not built here.
- **Flag for `003-club-onboarding.md`'s still-unbuilt `Invitation` entity:** this spec's `KeycloakProvisioningService` (create user + `execute-actions-email`) is very likely the exact primitive that future admin-invite-by-email flow needs too — worth reusing rather than rebuilding when `003` is eventually picked up.
- **Real-world testing of this spec surfaced that `002`'s ADR-03 wildcard redirect URI never worked at all** — not a version-specific edge case, a fundamental mismatch with how Keycloak matches redirect URIs/web origins (only a trailing `*` is a real wildcard; one embedded in the hostname is matched literally). Resolved directly rather than left as a known gap: `KeycloakProvisioningService` gained `registerClubRedirectAccess(String clubSlug)`, and `ClubServiceImpl.create()`/`update()` (on a slug rename) call it best-effort, same posture as this spec's own account-provisioning judgment calls above — a Keycloak outage must never fail a Club write. See `002` ADR-03's own update for the full account of what changed and why. Out of this spec's original scope (`ClubServiceImpl` belongs to `010`), but the fix lives here since it depends on the same `KeycloakProvisioningService`/Admin API wiring this spec already introduces.
- `docs/roadmap.md` is updated alongside this spec — see that file's own diff for exactly what's resolved and what's newly flagged.
- **Found and fixed during `standards-reviewer`'s pass before this PR opened, both worth recording here explicitly rather than leaving as unnamed gaps:**
  - `MeServiceImpl.bridgeByEmail` trusted the JWT's `email` claim with no `email_verified` check before permanently binding `Person.keycloakUserId` and flipping `PENDING`→`ACTIVE` — a real gap if this realm ever permits self-registration, a social IdP, or any login path beyond today's admin-provisioned-only accounts, since an attacker able to influence an unverified email claim could bind their own account to someone else's still-`PENDING` `Person` and inherit its `RoleAssignment` grant before the real invitee ever logs in. Fixed rather than just documented: `KeycloakProvisioningServiceImpl.provisionAccount`'s invite email now requires `VERIFY_EMAIL` alongside `UPDATE_PASSWORD` in the same link (no extra step for a real invitee), and `bridgeByEmail` now requires `email_verified: true` before bridging at all.
  - `KeycloakProvisioningServiceImpl.registerClubRedirectAccess` did an unguarded fetch-modify-`PUT` of the shared public SPA client's `ClientRepresentation` — Keycloak's Admin API has no optimistic locking on this, so two calls racing (two clubs created/renamed close together) could silently clobber each other, with no error or symptom beyond one club's login redirect quietly not working. Fixed with a `synchronized` guard around the critical section, serializing these calls within one backend process. **Does not protect across multiple backend replicas** sharing one Keycloak client — acceptable given this repo's current single-instance deployment model (see `docs/deployment.md`), but revisit if that ever changes to a multi-instance/clustered backend.
