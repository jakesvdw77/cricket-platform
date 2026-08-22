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
   `manage-users` from the `realm-management` client — that's the only role it currently needs;
   don't grant more (see the redirect-URI section below for why it doesn't need `manage-clients`
   despite `registerClubRedirectAccess` mutating client config — re-read that section before
   assuming it does).

### Valid Redirect URIs & Web Origins — what's automatic vs. still manual

**Confirmed empirically, not just theorized:** Keycloak's matching for both settings only treats a
trailing `*` as a real wildcard — one embedded in the hostname (`http://*.yourapp.com/*`) is
matched completely literally and never matches a real subdomain. `002-realm-subdomain-auth.md`'s
ADR-03 originally planned that wildcard; it's now marked superseded there. Don't register it
expecting it to work, on this Keycloak version or, per that spec's own updated note, likely any
version.

**What's automatic today:** every club's own subdomain is registered automatically —
`ClubServiceImpl.create()`/`update()` (on a slug rename) call
`KeycloakProvisioningService.registerClubRedirectAccess(slug)`, which appends
`https://{slug}.cricketlegend.co.za/*` (redirect URI) and `https://{slug}.cricketlegend.co.za`
(web origin) to the public SPA client via the Keycloak Admin API — best-effort, idempotent, never
fails the Club write if Keycloak is unreachable. This is why the `platform-provisioning` service
account needs `manage-users` only: this call runs as the backend's own service account through the
same client, without needing a broader `manage-clients` grant — confirm this still holds if that
implementation ever changes.

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

### Email / SMTP — not yet configured anywhere

`016-keycloak-account-provisioning.md`'s invite-email flow (`execute-actions-email`,
`UPDATE_PASSWORD` action) needs the realm's own SMTP settings configured (**Realm settings →
Email**) to actually deliver anything — confirmed by grep, no SMTP config exists in this repo or
any environment today. Locally this was worked around with an ad-hoc MailHog/Mailpit-style sink for
manual testing, not committed anywhere. **A real SMTP provider (transactional email service,
company mail relay, etc.) needs to be chosen and configured per environment before invite emails
can go out for real** — not solved here, and blocks `016` actually working end-to-end outside a
dev machine.

`017-subscription-welcome-email.md` adds a second, entirely separate SMTP client: this
application's own `spring.mail.*` properties, used to send the Subscription welcome email through
`EmailService`/Thymeleaf, independent of Keycloak's realm-level Email settings above. Locally,
both consumers can share a single Mailpit/MailHog sink (`docker run -p 1025:1025 -p 8025:8025
axllent/mailpit`) — `spring.mail.host`/`port` already default to `localhost:1025`, matching that
sink's own SMTP listener out of the box, no override needed. **A real SMTP provider plus SPF/DKIM/
DMARC DNS records for `cricketlegend.co.za` remain an open, unresolved decision for either
consumer** — this application's own emails and Keycloak's invite email both need it configured
per environment before either works end-to-end outside a dev machine.

### Known local-only caveat, not applicable to a real server

The local dev Keycloak container (`cricketlegend-keycloak-dev`) was started via a bare `docker run`
with no compose file and no mounted volume — every admin-console change described above (including
the Security Defenses/Headers one) is lost if that specific container is ever recreated, and has to
be redone by hand. A real server deployment should use a proper persistent Keycloak install (or
realm-export/import as part of provisioning) so this class of problem doesn't recur — worth
deciding how before the first real server realm is created, not after.

## Next up (not written yet)

Backend/frontend hosting, database provisioning, environment variable inventory per environment
(`KEYCLOAK_ADMIN_SERVER_URL`/`KEYCLOAK_ADMIN_CLIENT_SECRET`/`VITE_ROOT_DOMAIN`/etc.), DNS and TLS
for `cricketlegend.co.za` and its club subdomains, and CI/CD deploy steps. Add sections here as
each gets figured out — don't let this doc imply a section is done just because its heading exists.
