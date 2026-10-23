# Deployment Rollout

A living checklist of what has to happen outside this repo — infra and third-party admin console
changes — before a real environment (staging, then production) works the way the code already
assumes it does. Not a spec: it gates nothing here in the repo, but it does gate whether a real
deployment actually works. Update it whenever a spec or a piece of manual local-dev setup turns up
another one of these steps — the same living-document discipline `docs/roadmap.md` and
`docs/architecture.md` already follow. Each item notes which environment(s) it's been done in so
far; nothing here should be assumed done on the server just because it's done locally.

**Production domain (reference):** `cricketlegend.co.za`. Following spec 002's own
`{slug}.yourapp.com` pattern, that implies club subdomains at `{slug}.cricketlegend.co.za` and —
recommended, not yet formally decided — Keycloak itself at `auth.cricketlegend.co.za`. Confirm
before relying on that exact hostname anywhere.

## Keycloak Setup

Everything below was discovered by hand while building and locally testing
`016-keycloak-account-provisioning.md` against the local dev Keycloak
(`cricketlegend-keycloak-dev`, `quay.io/keycloak/keycloak:24.0.3`, realm `cricketlegend`) — treat
version-specific claims as verified against 24.0.3 specifically, not assumed to hold on a newer
server without re-checking.

### Realm & client naming — open decision, not yet made

Locally, the realm and the public SPA client are both literally named `cricketlegend` — a
pragmatic local choice, not what `002-realm-subdomain-auth.md` originally specified
(`platform-dev`/`platform-web`), and never reconciled (flagged already in `005-admin-login.md`'s
own "Flags for your review", still open). **Before provisioning a real server realm, decide the
actual production realm/client names** — reusing `cricketlegend`, adopting `002`'s original
`platform-prod`/`platform-web` naming, or something else — and update this doc plus the relevant
`application*.properties`/env var defaults once decided. Not assumed here.

### Clients to create

Two, matching the local setup:

1. **Public SPA client** (`cricketlegend` locally) — used by `ui/src/auth/keycloak.ts` for every
   real login. Standard flow enabled, PKCE (`S256`) enabled, direct access grants **should be
   disabled** in production (only enabled locally for `curl`-based diagnostic testing — turn it
   back off before going live).
2. **`platform-provisioning`** — confidential, service-account-only client
   (`backend/src/main/java/com/cricketlegend/config/KeycloakAdminClientConfig.java`'s
   `client_credentials` grant). Client authentication **on**, Standard flow **off**, Direct access
   grants **off**, Service accounts roles **on**. Under its **Service accounts roles** tab, grant
   **both** `manage-users` and `manage-clients` from the `realm-management` client — see the
   redirect-URI section below for why `manage-clients` is required too, not optional.

### Valid Redirect URIs & Web Origins — what's automatic vs. still manual

**Confirmed empirically, not just theorized:** Keycloak's matching for both settings only treats a
trailing `*` as a real wildcard — one embedded in the hostname (`http://*.yourapp.com/*`) is
matched completely literally and never matches a real subdomain. `002-realm-subdomain-auth.md`'s
ADR-03 originally planned that wildcard; it's now marked superseded there. Don't register it
expecting it to work, on this Keycloak version or, per that spec's own updated note, likely any
version.

**What's automatic today:** every club's own subdomain is registered automatically —
`ClubServiceImpl.create()`/`update()` (every update, not just a slug rename) call
`KeycloakProvisioningService.registerClubRedirectAccess(slug)`, which appends
`https://{slug}.cricketlegend.co.za/*` (redirect URI) and `https://{slug}.cricketlegend.co.za`
(web origin) to the public SPA client via the Keycloak Admin API — best-effort, idempotent, never
fails the Club write if Keycloak is unreachable.

**The `platform-provisioning` service account needs `manage-clients` for this, not just
`manage-users`.** Originally assumed unnecessary here (wrongly — see below) since `manage-users`
alone is enough for `provisionAccount`'s user-creation calls; `registerClubRedirectAccess` is a
different operation (mutating the *public SPA client's* own `ClientRepresentation`, not a user),
and Keycloak's Admin API authorizes that by the caller's granted roles regardless of which client
it authenticated as — `manage-clients` is required to fetch/update another client's redirect
URIs/web origins, full stop. Found in production-adjacent local testing: the redirect/web-origin
entries for two real clubs (`riverside`, `cbc`) were silently never registered — both had to be
added by hand in the Keycloak console — because this role was missing and the failure is
deliberately caught-and-logged rather than surfaced (the same best-effort posture that keeps a
Keycloak outage from blocking a Club write also means a *permanent* misconfiguration like this one
produces no visible symptom beyond "that club's login redirect quietly doesn't work," discovered
only when someone actually tried to log into that club's subdomain). Granting `manage-clients`
fixes new Club creates/updates going forward; any Club that predates the grant needs one no-op edit
(open it, Save changes with no changes) to retrigger registration once the role is in place.

**What's still manual, per environment, because no `Club` row represents it:**
- The root marketing domain itself — `https://cricketlegend.co.za/*` and
  `https://cricketlegend.co.za` — since platform-admin login (`/login` → `/admin`) is club-agnostic
  and can happen from the bare root domain, which `registerClubRedirectAccess` never covers (there's
  no club to trigger it).
- `http://localhost:5173/*` / `http://localhost:5173` equivalents are already present locally for
  the same reason — this isn't new, just calling out that the pattern continues in production
  under the real domain.

### Security Defenses → Headers — turned out NOT to be needed, don't touch it

Session-persistence-across-refresh was first attempted via `check-sso`'s hidden-iframe mode
(`silentCheckSsoRedirectUri`), which does need Keycloak's default `X-Frame-Options`/CSP
`frame-ancestors` relaxed to allow cross-origin framing — real infra complexity, and it turned
into a genuine dead end (a regression on `/post-login`, then an unresolved "the realm setting
doesn't seem to take effect" investigation that never got to the bottom of things).

**Resolved by not needing it at all.** `ui/src/auth/keycloak.ts` now omits
`silentCheckSsoRedirectUri`, which falls back to `check-sso`'s other mode: a plain top-level
redirect through Keycloak with `prompt=none`, no framing involved — confirmed to be exactly what
the original single-tenant Cricket Legend app already does, and it has never needed any realm
header change. **No Security Defenses/Headers change is required for this, on any environment.**
If a `frame-ancestors`/`X-Frame-Options` change is ever made for some other reason in the future,
re-check this section first — it's very likely unrelated to auth.

### Email / SMTP — Google account SMTP, for testing only

Two separate consumers send email, and **both currently use the owner's Google account SMTP
server. That is a testing setup, not a production one.**

1. **Keycloak** sends verify email, forgot password and the manager invite
   (`016-keycloak-account-provisioning.md`'s `execute-actions-email` with `VERIFY_EMAIL` and
   `UPDATE_PASSWORD`). Configured by hand in the realm: **Realm settings, Email** (per realm, per
   environment; it is not in the repo).
2. **The backend** sends the Subscription welcome email (`017`) and, from spec 119 slice 3, the
   link-request outcome and hand-over invitation emails, through `EmailService` and Thymeleaf.
   Configured by environment variables read in `backend/src/main/resources/application.properties`:

   | Variable | Default | For Google account SMTP |
   |---|---|---|
   | `SMTP_HOST` | `localhost` | `smtp.gmail.com` |
   | `SMTP_PORT` | `1025` | `587` |
   | `SMTP_USERNAME` | empty | the Google account address |
   | `SMTP_PASSWORD` | empty | a Google **app password** (needs 2-Step Verification on the account), never the account password |
   | `SMTP_AUTH` | `false` | `true` |
   | `SMTP_STARTTLS` | `false` | `true` |
   | `MAIL_FROM_ADDRESS` | `no-reply@cricketlegend.co.za` | the account's own address (Google rewrites any other From to it) |
   | `MAIL_FROM_NAME` | `Cricket Legend` | unchanged |

   In the Keycloak realm Email tab use the same host, port 587, Enable StartTLS, Enable
   Authentication, the same username and app password, and From = the account address.

**Limits to know about (why this is testing only):** a personal Google account sends about 500
messages a day (a Workspace account about 2,000; check Google's current figures), Google may throttle or block a
burst, it rewrites the From address to the account's own, and deliverability is weaker than a club
domain sender. Reset and verify mails from a personal address are likelier to land in spam.
Keycloak and the backend share the one account's daily allowance.

**Open before real users: a proper transactional provider plus SPF, DKIM and DMARC DNS records for
`cricketlegend.co.za`**, for both consumers. Moving is a configuration change only (the same
variables for the backend, the realm's Email tab for Keycloak); no code changes. Until then email
is never a blocker: the app shows every status in the app regardless of email (spec 119,
Decision 13).

**Locally without sending real mail:** a Mailpit or MailHog sink on port 1025
(`docker run -p 1025:1025 -p 8025:8025 axllent/mailpit`). The backend's defaults already point at
`localhost:1025`; point the realm's Email tab at the same sink.

### Login theme and realm checklist

The Cricket Legend login theme lives in `keycloak/themes/cricketlegend/` (README: `keycloak/README.md`;
spec 119 Part 1). It is installed per environment by copying the folder or the CI artifact
(`keycloak-theme` job in `.github/workflows/ci.yml`, built by `keycloak/package.sh`) into
`/opt/keycloak/themes/`; no backend or UI deployment is involved.

Every setting below is done **by hand in the Keycloak admin console, per environment, and must be
verified against the real realm, never assumed**. Tick a box only after looking at the real
realm; the Local column is the owner's `cricketlegend` realm on `cricketlegend-keycloak-dev`.
Version-specific wording is for Keycloak 24.0.3.

| Setting (Admin console path) | Value | Why | Local | Staging | Production |
|---|---|---|---|---|---|
| Authentication, Required actions: **Verify Email** | **Enabled** (default action stays off: the realm Verify email switch and the app invite cover it) | `email_verified` is what the backend trusts; every agent and invited manager verifies before login completes. **Owner is checking.** | [x] | [ ] | [ ] |
| Realm settings, Login: **Verify email** | **On** | the same requirement as a realm login setting. Local confirmed on 2026-10-23: **On**. | [x] | [ ] | [ ] |
| Identity providers, Google: **Trust Email** | **On**, and a Google login arrives with `email_verified: true` (slice 2). **Owner is checking.** | satisfies spec 119 Decision 3 for Google users | [ ] | [ ] | [ ] |
| Realm settings, Themes: **Login theme** | `cricketlegend` | uses the theme | [ ] | [ ] | [ ] |
| Realm settings, General: **Display name** | `Cricket Legend` | tab titles and emails; the theme's wordmark does not depend on it | [ ] | [ ] | [ ] |
| Login: **Remember me** | On | the "Remember me" checkbox | [ ] | [ ] | [ ] |
| Login: **Forgot password** | On | the "Forgot password?" link; needs working realm email | [ ] | [ ] | [ ] |
| Login: **Login with email** | On | "Username or email" | [ ] | [ ] | [ ] |
| Login: **Email as username** | On | the registration page has no username field | [ ] | [ ] | [ ] |
| Login: **Edit username** | Off | email is the identity | [ ] | [ ] | [ ] |
| Login: **Duplicate emails** | **Off** | one Keycloak user per email; the foundation of bridge-by-email | [x] | [ ] | [ ] |
| Login: **User registration** | **Off in slices 1 and 2, On in slice 3** | shows "New here? Create an account" | [ ] | [ ] | [ ] |
| Authentication, Policies, Password policy | at least 10 characters, with a number (`length(10) and digits(1)`) | the wording the registration page promises | [ ] | [ ] | [ ] |
| Realm settings, Tokens: **Default user-initiated action lifespan** | the lifetime you want the reset link to have (default is 5 minutes, which is short for an email) | the reset and verify pages say how long the link works | [ ] | [ ] | [ ] |
| Realm settings, Sessions: SSO idle / max, Remember-me idle / max | per environment (suggest 30 min / 10 h; 30 days with Remember me) | makes the checkbox mean something | [ ] | [ ] | [ ] |
| Realm settings, Security defenses: **Brute force detection** | On | the login page is now a public face | [ ] | [ ] | [ ] |
| Realm settings, Email (SMTP) | Google account SMTP for testing, a proper provider later (section above) | verify email, forgot password and the manager invite are sent by Keycloak | [ ] | [ ] | [ ] |
| Authentication, Required actions: **Terms and Conditions** | Off unless terms text is provided | an enabled action with no terms text shows a placeholder | [ ] | [ ] | [ ] |

**Wording Keycloak decides, that the theme cannot change** (spec 119 plan, "Needs the owner" 2):
after "Send reset link" Keycloak returns to the sign-in page with a green message (there is no
separate "check your inbox" page and the message cannot echo the address); the lock-out message
after too many wrong passwords is Keycloak's generic "invalid username or password" unless
permanent lockout is configured; the "Opening Google..." state is not produced.

### Known local-only caveat, not applicable to a real server

The local dev Keycloak container (`cricketlegend-keycloak-dev`) was started via a bare
`docker run` with no compose file and **no mounted volume** — its realm lives in the container's
own filesystem. Every admin-console change described above (including the Security
Defenses/Headers one) is lost if that specific container is ever removed or recreated, and has to
be redone by hand. A restart (`docker restart`) keeps it.

- **Before recreating the container, export the realm first:** Admin console, realm
  `cricketlegend`, Realm settings, Action, **Partial export** (include groups, roles and clients),
  and keep the file. Or take a zero-risk copy of the whole data folder:
  `docker cp cricketlegend-keycloak-dev:/opt/keycloak/data ./keycloak-data-backup`.
- **Safe ways to get the theme in** without recreating anything: `docker cp keycloak/themes/cricketlegend
  cricketlegend-keycloak-dev:/opt/keycloak/themes/` then `docker restart cricketlegend-keycloak-dev`
  (`keycloak/README.md`, option A).
- **`docker-compose.keycloak.yml`** (repo root) starts a *new* container `cricketlegend-keycloak`
  (same image `quay.io/keycloak/keycloak:24.0.3`, same `8180:8080`, `start-dev`) with a **named
  volume** for the realm data and the theme bind-mounted read-only, so this class of loss does not
  recur. It starts empty: import the exported realm into it. Stop the old container first (same
  port).

A real server deployment should use a proper persistent Keycloak install (or realm-export/import
as part of provisioning) — worth deciding how before the first real server realm is created, not
after.

## Next up (not written yet)

Backend/frontend hosting, database provisioning, environment variable inventory per environment
(`KEYCLOAK_ADMIN_SERVER_URL`/`KEYCLOAK_ADMIN_CLIENT_SECRET`/`VITE_ROOT_DOMAIN`/etc.), DNS and TLS
for `cricketlegend.co.za` and its club subdomains, and CI/CD deploy steps. Add sections here as
each gets figured out — don't let this doc imply a section is done just because its heading exists.
